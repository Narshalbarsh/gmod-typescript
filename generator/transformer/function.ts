import {
    isModifiyArgumentModification,
    isModifyReturnModification,
    getPageMods,
    isRenameIndentifierModification,
} from './modification_db';
import { TSArgument, TSFunction, TSReturn } from '../ts_types';
import { WikiArgument, WikiFunction } from '../wiki_types';
import { createRealmString, transformDescription } from './description';
import { transformIdentifier, transformType } from './util';

export function transformFunction(wikiFunc: WikiFunction): TSFunction {
    const args: TSArgument[] = transformArgs(wikiFunc);

    const ret = transformReturns(wikiFunc);

    const argToDocComment = (a: WikiArgument) => {
        const identifier = transformIdentifier(a.name);
        const description = transformDescription(a.description).replace(/\n{2,}/g, '\n');

        // keep the displayed default, including backticks, but unescape entities
        const d = typeof a.default === 'string' ? unescapeEntities(a.default) : undefined;

        const isOptional = a.default !== undefined; // presence of a wiki default -> optional

        const argName = isOptional
            ? d
                ? `[${identifier} = ${d}]`
                : `[${identifier}]`
            : identifier;

        return `@param ${argName} - ${description}`;
    };

    const docComment =
        createRealmString(wikiFunc.realm) +
        '\n\n' +
        transformDescription(wikiFunc.description) +
        '\n' +
        wikiFunc.args.map(argToDocComment).join('\n');

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

function parseFirstCallbackSigFrom(desc: string): string | undefined {
    const m = /<callback>([\s\S]*?)<\/callback>/i.exec(desc || '');
    if (!m) return;
    const block = m[1];

    const args: string[] = [];
    const argTagRe = /<arg\b([^>]*)>([\s\S]*?)<\/arg>/gi;
    let mt: RegExpExecArray | null;
    while ((mt = argTagRe.exec(block))) {
        const attrs = mt[1] || '';
        const inner = mt[2] || '';
        const rawName = /name="([^"]+)"/i.exec(attrs)?.[1] || 'arg';
        const rawType = /type="([^"]*)"/i.exec(attrs)?.[1] || 'any';

        const isVararg = rawName === '...' || /^vararg$/i.test(rawType);

        if (isVararg) {
            args.push('...args: any[]');
            break;
        } else {
            const resolved = inferType(rawType, inner);
            const tsType = transformType(resolved);
            args.push(`${transformIdentifier(rawName)}: ${tsType}`);
        }
    }

    const retTypes = Array.from(block.matchAll(/<ret\b[^>]*type="([^"]*)"/gi)).map((mm) =>
        transformType((mm[1] || 'void').trim()),
    );
    let retType = 'void';
    if (retTypes.length === 1) retType = retTypes[0];
    else if (retTypes.length > 1) retType = `LuaMultiReturn<[${retTypes.join(', ')}]>`;

    return `(${args.join(', ')}) => ${retType}`;
}

function transformArgs(func: WikiFunction): TSArgument[] {
    const mods = getPageMods(func.address);
    const argMods = mods.filter(isModifiyArgumentModification);

    return func.args.map((arg) => {
        let type = inferType(arg.type, arg.description);
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

        // Prefer per-arg <callback>; fallback to function-level
        const cb =
            parseFirstCallbackSigFrom(arg.description) ||
            parseFirstCallbackSigFrom(func.description);
        if (cb) type = cb;

        const outType = /\)\s*=>/.test(type) ? type : transformType(type);

        return {
            identifier: (type == 'vararg' ? '...' : '') + transformIdentifier(arg.name),
            default: defaultValue,
            type: outType,
        } as TSArgument;
    });
}

function inferType(type: string, desc: string) {
    let t = (type || '').trim();

    // find a <page ...>...</page> and capture attrs + inner text
    const m = /<page\b([^>]*)>(.*?)<\/page>/i.exec(desc || '');
    if (!m) return t;

    const attrs = m[1] || '';
    const inner = (m[2] || '').trim();

    const textAttr = /(?:^|\s)text="([^"]+)"/i.exec(attrs)?.[1] || '';
    // prefer the concrete path in inner; fall back to text="...".
    // examples: inner: "Enums/DOCK", "Structures/TraceResult", "Color"
    let rawPage = inner || textAttr;
    if (!rawPage) return t;

    if (rawPage.includes('#')) rawPage = rawPage.split('#')[0];

    const parts = rawPage.split('/');
    const leaf = parts[parts.length - 1] || rawPage;
    const cat = parts.length > 1 ? parts[parts.length - 2] : '';

    // renames take precedence
    const mods = getPageMods(rawPage);
    const renameMods = mods.filter(isRenameIndentifierModification);
    if (renameMods.length > 0) return renameMods[0].newName;

    const isEnumLink = /^(enum|enums)$/i.test(cat) || /\/(enum|enums)\//i.test(rawPage);
    const isStructLink =
        /^(structure|structures)$/i.test(cat) || /\/(structure|structures)\//i.test(rawPage);

    // treat these as "vague" and safe to upgrade
    const isVague = /^(number|string|any|table|function)$/i.test(t) || t === '';

    if (isEnumLink && (isVague || /^number(\s*\{.*\})?$/i.test(t))) {
        // number|string → Enum leaf (e.g., DOCK)
        return leaf;
    }

    if (isStructLink && isVague) {
        // any|table|string|function -> struct leaf (e.g., TraceResult)
        return leaf;
    }

    // Color often appears without a category; upgrade vague types to Color
    if ((/\/Color$/i.test(rawPage) || leaf === 'Color') && isVague) {
        return 'Color';
    }

    return t;
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
        // special-case: a single vararg return => any
        if (t.trim().toLowerCase() === 'vararg') return { type: 'any' };
        return { type: transformType(t) };
    }
    return {
        type: `LuaMultiReturn<[${rets
            .map((r) => transformType(inferType(r.type, r.description)))
            .join(', ')}]>`,
    };
}
