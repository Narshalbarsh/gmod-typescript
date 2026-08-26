import { GetPage, GetPagesInCategory } from '../../wiki/local';
import { TSField, TSTypeMap, TSTypeMapEntry } from '../../ts_types';
import { transformIdentifier, transformType } from '../../transformer/util';

function stripTags(s: string): string {
    return s
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function descriptionFromMarkup(markup: string): string {
    if (!markup) return '';
    const m = markup.match(/<description>([\s\S]*?)<\/description>/i);
    return m ? stripTags(m[1]) : '';
}

// The gameevent page is a <type> page, its text is in <summary>.
// Keep the plain paragraphs and drop the <note> and the <pagelist>, the type map already lists the events
function libraryIntroFromMarkup(markup: string): string {
    if (!markup) return '';
    const m = markup.match(/<summary>([\s\S]*?)<\/summary>/i);
    if (!m) return '';
    const body = m[1]
        .replace(/<note>[\s\S]*?<\/note>/gi, '')
        .replace(/<pagelist\b[^>]*>[\s\S]*?<\/pagelist>/gi, '')
        .replace(/<pagelist\b[^>]*\/?>/gi, '');
    return body
        .split(/\n\s*\n/)
        .map((p) => stripTags(p))
        .filter(Boolean)
        .join('\n\n');
}

function membersFromMarkup(markup: string): TSField[] {
    if (!markup) return [];
    const block = markup.match(/<fields>([\s\S]*?)<\/fields>/i);
    if (!block) return [];

    const body = block[1];
    const items = [...body.matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/gi)];
    if (!items.length) return [];

    const out: TSField[] = [];
    for (const m of items) {
        const attrs = m[1] || '';
        const inner = m[2] || '';

        const name = (attrs.match(/\bname="([^"]+)"/i) || [])[1];
        const type = (attrs.match(/\btype="([^"]+)"/i) || [])[1];
        if (!name || !type) continue;

        out.push({
            identifier: transformIdentifier(name),
            type: transformType(type),
            optional: false,
            docComment: stripTags(inner),
        });
    }
    return out;
}

export async function fetchGameEventTypeMap(): Promise<TSTypeMap> {
    const main = await GetPage('/gmod/gameevent');
    const topDoc =
        libraryIntroFromMarkup(main.markup || '') || descriptionFromMarkup(main.markup || '');

    const all = await GetPagesInCategory('gameevent');
    const eventPaths = all.filter((p) => /^\/gmod\/gameevent\/[A-Za-z0-9_]+$/.test(p));

    const entries: TSTypeMapEntry[] = [];
    for (const path of eventPaths) {
        const p = await GetPage(path);
        const markup = p.markup || '';
        entries.push({
            key: p.title.trim(),
            fields: membersFromMarkup(markup),
            docComment: descriptionFromMarkup(markup),
        });
    }
    entries.sort((a, b) => a.key.localeCompare(b.key));

    return {
        identifier: 'gameevent',
        docComment: topDoc,
        entries,
    };
}
