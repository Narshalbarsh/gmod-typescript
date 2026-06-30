import { transformType, transformIdentifier } from './util';
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

    // Split "vague" by what we're inferring into
    const isEmpty = t === '';
    const isObjectVague = /^(any|table|function)$/i.test(t) || isEmpty;

    // Keep number->enum inference (this is the useful one)
    const isEnumCandidate = /^number(\s*\{.*\})?$/i.test(t) || /^(any|table)$/i.test(t) || isEmpty;

    if (isEnumLink && isEnumCandidate) return leaf;

    // IMPORTANT: do NOT upgrade number/string -> struct
    if (isStructLink && isObjectVague) return leaf;

    // Color is object-like in practice; don't upgrade number/string here either
    if ((/\/Color$/i.test(rawPage) || leaf === 'Color') && isObjectVague) return 'Color';

    return t;
}

/**
 * Parse an inline "the table contains these fields" bullet list into a TS
 * object-literal type. Mirrors `parseFirstCallbackSigFrom`, but for fields that
 * the wiki documents as a generic `table` whose shape is only described by a
 * markdown bullet list in the body (e.g. `SWEP.Primary`/`Secondary`), rather
 * than as a dedicated `Structures/X` page.
 *
 * Each recognised bullet looks like (backticks may be the literal char or the
 * `&grave;` entity the scraper escapes them to):
 *
 *     * <page>string</page> `Ammo` - Ammo type ...
 *     * <page>number</page> `ClipSize` - ...
 *
 * Returns e.g. `{ Ammo: string; ClipSize: number; DefaultClip: number; Automatic: boolean }`
 * or `undefined` when no field bullets are present.
 */
export function parseInlineTableType(desc: string): string | undefined {
    const text = desc || '';

    // Bullet line: leading * or -, a <page ...>TYPE</page> link, a `Name` in
    // backticks (literal or &grave; entity), then a separator (-, –, —, or :).
    const bulletRe =
        /^[ \t]*[*\-][ \t]*<page\b[^>]*>([^<]+)<\/page>[ \t]*(?:`|&grave;)\s*([A-Za-z_]\w*)\s*(?:`|&grave;)[ \t]*[-–—:]/gim;

    const seen = new Set<string>();
    const fields: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = bulletRe.exec(text))) {
        const rawType = (m[1] || '').trim();
        const name = (m[2] || '').trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const tsType = transformType(rawType) || 'any';
        fields.push(`${transformIdentifier(name)}: ${tsType}`);
    }

    if (fields.length === 0) return undefined;
    return `{ ${fields.join('; ')} }`;
}

/**
 * Detect cross-references of the form "(has) the same fields as Primary" and
 * return the referenced sibling field name. Used so `Secondary`, documented only
 * as "has same fields as Primary attack settings", reuses `Primary`'s shape.
 */
export function findSameFieldsReference(desc: string): string | undefined {
    const m = /same\s+(?:fields|settings|structure|table)\s+as\s+(?:the\s+)?([A-Za-z_]\w*)/i.exec(
        desc || ''
    );
    return m ? m[1] : undefined;
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
            const safeName = transformIdentifier(rawName.replace(/[^\w$]/g, '_'));
            args.push(`${safeName}: ${tsType}`);
        }
    }

    const retTypes = Array.from(block.matchAll(/<ret\b[^>]*type="([^"]*)"/gi)).map((mm) =>
        transformType((mm[1] || 'void').trim())
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
        const parts = t.split(/[|&]/).map((s) => s.trim());
        const joiner = t.includes('|') ? ' | ' : ' & ';
        const wrapped = cbSig.startsWith('(') && cbSig.endsWith(')') ? cbSig : `(${cbSig})`;

        const mapped = parts.map((p) => (p === 'Function' || /^function$/i.test(p) ? wrapped : p));

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

/**
 * Split a TS type string on top-level `|`, ignoring separators nested inside
 * generics (`<>`), parentheses (`()`), object/mapped types (`{}`), array/tuple
 * (`[]`), or function arrows (`=>`).
 */
export function splitTopLevelUnion(type: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < type.length; i++) {
        const c = type[i];
        // Skip arrow tokens so the `>` of `=>` isn't treated as a bracket close.
        if (c === '=' && type[i + 1] === '>') {
            i++;
            continue;
        }
        if (c === '<' || c === '(' || c === '{' || c === '[') depth++;
        else if (c === '>' || c === ')' || c === '}' || c === ']') depth--;
        else if (c === '|' && depth === 0) {
            parts.push(type.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(type.slice(start));
    return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** True when `type` is itself a function type at the top level, e.g. `(a: x) => y`. */
function isTopLevelArrow(type: string): boolean {
    let depth = 0;
    for (let i = 0; i < type.length - 1; i++) {
        const c = type[i];
        if (c === '=' && type[i + 1] === '>') {
            if (depth === 0) return true;
            i++; // skip the `>` of a nested arrow
            continue;
        }
        if (c === '<' || c === '(' || c === '{' || c === '[') depth++;
        else if (c === '>' || c === ')' || c === '}' || c === ']') depth--;
    }
    return false;
}

/**
 * Combine an already-transformed primary TS type with an alternative one (derived
 * from the wiki `alttype` attribute) into a single de-duplicated union.
 *
 * - Identical/empty alt types are a no-op, so callers without an `alttype` keep
 *   their exact previous output.
 * - Function-type members are parenthesised so they stay valid inside the union
 *   (`(() => void) | number`).
 */
export function unionWithAltType(primary: string, alt: string): string {
    const primaryTrimmed = (primary || '').trim();
    const primaryParts = splitTopLevelUnion(primaryTrimmed);
    const altParts = splitTopLevelUnion(alt || '');

    const seen = new Set<string>();
    const parts: string[] = [];
    for (const p of [...primaryParts, ...altParts]) {
        if (!seen.has(p)) {
            seen.add(p);
            parts.push(p);
        }
    }

    if (parts.length <= 1) return primaryTrimmed;
    return parts.map((p) => (isTopLevelArrow(p) ? `(${p})` : p)).join(' | ');
}
