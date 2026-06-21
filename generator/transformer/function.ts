import {
    isModifiyArgumentModification,
    isModifyReturnModification,
    getPageMods,
} from './modification_db';
import { TSArgument, TSFunction, TSReturn } from '../ts_types';
import { WikiArgument, WikiFunction, WikiReturn } from '../wiki_types';
import { createRealmString, transformDescription } from './description';
import { transformIdentifier, transformType } from './util';
import {
    inferType,
    parseFirstCallbackSigFrom,
    preferCallbackType,
    unionWithAltType,
} from './type_utils';

export function transformFunction(wikiFunc: WikiFunction): TSFunction {
    const args: TSArgument[] = transformArgs(wikiFunc);
    const ret = transformReturns(wikiFunc);

    const argToDocComment = (a: WikiArgument) => {
        const identifier = transformIdentifier(a.name);
        const description = transformDescription(a.description).replace(/\n{2,}/g, '\n');

        const d = typeof a.default === 'string' ? unescapeEntities(a.default) : undefined;
        const isOptional = a.default !== undefined;

        const argName = isOptional
            ? d
                ? `[${identifier} = ${d}]`
                : `[${identifier}]`
            : identifier;

        return `@param ${argName} - ${description}`;
    };

    const retToDocComment = (r: WikiReturn, i: number) => {
        const t = resolveReturnType(r).trim() || 'void';

        const description = transformDescription(r.description)
            .replace(/\n{2,}/g, '\n')
            .trim();
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
        let typeOverriddenByMod = false;

        // special-cases
        const isEntitySetBodyGroups =
            func.parent === 'Entity' && func.name === 'SetBodyGroups' && arg.name === 'subModelIds';
        const isPMAddValidHands =
            func.parent === 'player_manager' &&
            func.name === 'AddValidHands' &&
            arg.name === 'bodygroups';
        if (isEntitySetBodyGroups || isPMAddValidHands) type = 'SubModelIds';

        if (argMod) {
            if (argMod.arg.type) {
                type = argMod.arg.type;
                typeOverriddenByMod = true;
            }
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

        let outType = /\)\s*=>/.test(type) ? type : transformType(type);

        // The wiki `alttype` attribute records a secondary accepted type (e.g.
        // Player:GiveAmmo's `type` arg is string | number). Fold it into a union.
        // Skipped when a manual modification dictates the type, for varargs, and for
        // the SubModelIds special-case (which the printer keys on by exact type).
        if (arg.alttype && !typeOverriddenByMod && type !== 'vararg' && type !== 'SubModelIds') {
            const altType = transformType(inferType(arg.alttype, arg.description));
            outType = unionWithAltType(outType, altType);
        }

        return {
            identifier: (type == 'vararg' ? '...' : '') + transformIdentifier(arg.name),
            default: defaultValue,
            type: outType,
        } as TSArgument;
    });
}

/**
 * Resolve a single wiki return into its final TS type, folding in the secondary
 * `alttype` as a union when present. Mirrors the argument pipeline so a return
 * documented as e.g. `string` with `alttype="number"` becomes `string | number`.
 */
function resolveReturnType(r: WikiReturn): string {
    const primary = transformType(inferType(r.type, r.description));
    if (!r.alttype) return primary;
    const alt = transformType(inferType(r.alttype, r.description));
    return unionWithAltType(primary, alt);
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
        return { type: resolveReturnType(rets[0]) };
    }
    return {
        type: `LuaMultiReturn<[${rets.map(resolveReturnType).join(', ')}]>`,
    };
}
