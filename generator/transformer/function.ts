import {
    isModifiyArgumentModification,
    isModifyReturnModification,
    getPageMods,
} from './modification_db';
import { TSArgument, TSFunction, TSReturn } from '../ts_types';
import { WikiArgument, WikiFunction, WikiReturn } from '../wiki_types';
import { createRealmString, transformDescription } from './description';
import { transformIdentifier, transformType } from './util';
import { inferType, parseFirstCallbackSigFrom, preferCallbackType } from './type_utils';

export function transformFunction(wikiFunc: WikiFunction): TSFunction {
    const args: TSArgument[] = transformArgs(wikiFunc);
    const ret = transformReturns(wikiFunc);

    const argToDocComment = (a: WikiArgument) => {
        const identifier = transformIdentifier(a.name);
        const description = transformDescription(a.description).replace(/\n{2,}/g, '\n');

        const d = typeof a.default === 'string' ? unescapeEntities(a.default) : undefined;
        const isOptional = a.default !== undefined;

        const argName = isOptional ? (d ? `[${identifier} = ${d}]` : `[${identifier}]`) : identifier;

        return `@param ${argName} - ${description}`;
    };

    const retToDocComment = (r: WikiReturn, i: number) => {
        const inferred = inferType(r.type, r.description);
        const t = transformType(inferred || r.type || '').trim() || 'void';

        const description = transformDescription(r.description).replace(/\n{2,}/g, '\n').trim();
        if (!description && (!t || t === 'void') && wikiFunc.rets.length === 0) {
            return '';
        }
        const prefix = wikiFunc.rets.length > 1 ? `@returns [${i + 1}] ${t}` : `@returns ${t}`;
        return description ? `${prefix} - ${description}` : prefix;
    };

    const paramsDoc = wikiFunc.args.map(argToDocComment).filter(Boolean).join('\n');
    const returnsDoc = wikiFunc.rets.map(retToDocComment).filter(Boolean).join('\n');

    const docComment =
        createRealmString(wikiFunc.realm) +
        '\n\n' +
        transformDescription(wikiFunc.description) +
        (paramsDoc ? '\n' + paramsDoc : '') +
        (returnsDoc ? '\n' + returnsDoc : '');

    return {
        identifier: wikiFunc.name,
        args,
        docComment,
        ret,
    };
}

function unescapeEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&grave;/g, '`');
}

function transformArgs(func: WikiFunction): TSArgument[] {
    const mods = getPageMods(func.address);
    const argMods = mods.filter(isModifiyArgumentModification);

    return func.args.map((arg) => {
        const rawWikiType = arg.type;
        let type = inferType(rawWikiType, arg.description);
        const argMod = argMods.find((a) => a.arg.identifier === arg.name);
        let defaultValue = arg.default;

        // special-cases
        const isEntitySetBodyGroups =
            func.parent === 'Entity' && func.name === 'SetBodyGroups' && arg.name === 'subModelIds';
        const isPMAddValidHands =
            func.parent === 'player_manager' &&
            func.name === 'AddValidHands' &&
            arg.name === 'bodygroups';
        if (isEntitySetBodyGroups || isPMAddValidHands) type = 'SubModelIds';

        if (argMod) {
            if (argMod.arg.type) type = argMod.arg.type;
            if (argMod.arg.default) defaultValue = argMod.arg.default;
        }

        if (typeof defaultValue === 'string') {
            defaultValue = unescapeEntities(defaultValue);
            if (defaultValue.includes('`')) defaultValue = 'nil';
        }

        // Prefer per-arg <callback>; fallback to function-level. Use RAW wiki type to avoid
        // false upgrades caused by <page> links within callback descriptions.
        const cb =
            parseFirstCallbackSigFrom(arg.description) ||
            parseFirstCallbackSigFrom(func.description);
        if (cb) {
            type = preferCallbackType(rawWikiType, cb);
        }

        const outType = /\)\s*=>/.test(type) ? type : transformType(type);

        return {
            identifier: (type == 'vararg' ? '...' : '') + transformIdentifier(arg.name),
            default: defaultValue,
            type: outType,
        } as TSArgument;
    });
}

function transformReturns(func: WikiFunction): TSReturn {
    const rets = func.rets;

    const mods = getPageMods(func.address);
    const retMod = mods.find(isModifyReturnModification);
    if (retMod) {
        return { type: retMod.return.type };
    }

    if (rets.length === 0) {
        return { type: 'void' };
    }
    if (rets.length === 1) {
        const t = inferType(rets[0].type, rets[0].description);
        if (t.trim().toLowerCase() === 'vararg') return { type: 'any' };
        return { type: transformType(t) };
    }
    return {
        type: `LuaMultiReturn<[${rets
            .map((r) => transformType(inferType(r.type, r.description)))
            .join(', ')}]>`,
    };
}
