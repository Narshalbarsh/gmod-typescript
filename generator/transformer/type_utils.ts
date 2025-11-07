import { transformType } from './util';
import { getPageMods, isRenameIndentifierModification } from './modification_db';

/** Lift vague/wiki types using inline <page> links and rename mods. */
export function inferType(type: string, desc: string) {
    let t = (type || '').trim();

    const m = /<page\b([^>]*)>(.*?)<\/page>/i.exec(desc || '');
    if (!m) return t;

    const attrs = m[1] || '';
    const inner = (m[2] || '').trim();

    const textAttr = /(?:^|\s)text="([^"]+)"/i.exec(attrs)?.[1] || '';
    let rawPage = inner || textAttr;
    if (!rawPage) return t;

    if (rawPage.includes('#')) rawPage = rawPage.split('#')[0];

    const parts = rawPage.split('/');
    const leaf = parts[parts.length - 1] || rawPage;
    const cat = parts.length > 1 ? parts[parts.length - 2] : '';

    const mods = getPageMods(rawPage);
    const renameMods = mods.filter(isRenameIndentifierModification);
    if (renameMods.length > 0) return renameMods[0].newName;

    const isEnumLink = /^(enum|enums)$/i.test(cat) || /\/(enum|enums)\//i.test(rawPage);
    const isStructLink =
        /^(structure|structures)$/i.test(cat) || /\/(structure|structures)\//i.test(rawPage);

    const isVague = /^(number|string|any|table|function)$/i.test(t) || t === '';

    if (isEnumLink && (isVague || /^number(\s*\{.*\})?$/i.test(t))) return leaf;
    if (isStructLink && isVague) return leaf;
    if ((/\/Color$/i.test(rawPage) || leaf === 'Color') && isVague) return 'Color';

    return t;
}

/** Parse the first `<callback>` block into a TS function type. */
export function parseFirstCallbackSigFrom(desc: string): string | undefined {
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
            args.push(`${rawName.replace(/[^\w$]/g, '_')}: ${tsType}`);
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

/** Replace only the `Function` member (if present) in a union/intersection with a concrete callback type. */
export function mergeCallbackIntoType(rawType: string, cbSig: string): string {
    const t = transformType(rawType).trim();

    const isComposite = /[|&]/.test(t);
    const isFunc = t === 'Function' || /^function$/i.test(t);

    if (isComposite) {
        const parts = t.split(/[|&]/).map(s => s.trim());
        const joiner = t.includes('|') ? ' | ' : ' & ';
        const wrapped = cbSig.startsWith('(') && cbSig.endsWith(')') ? cbSig : `(${cbSig})`;

        const mapped = parts.map(p =>
            p === 'Function' || /^function$/i.test(p) ? wrapped : p
        );

        return mapped.join(joiner);
    }

    if (isFunc) {
        return cbSig;
    }

    return t;
}

/** Prefer the callback over vague types; keep precise types as-is. */
export function preferCallbackType(rawType: string, cbSig: string): string {
    const t = transformType(rawType);
    if (/\bFunction\b/i.test(t)) return mergeCallbackIntoType(rawType, cbSig);
    if (/^(any|Function)?$/i.test(t) || t === '') return cbSig; // upgrade vague, no extra parens
    return t;
}
