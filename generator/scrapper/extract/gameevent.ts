import * as https from 'https';
import { GetPage, GetPagesInCategory } from '../scrapper';
import { TSField, TSTypeMap, TSTypeMapEntry } from '../../ts_types';
import { transformIdentifier, transformType } from '../../transformer/util';

const agent = new https.Agent({ maxSockets: 8 });

function fetchHtml(path: string): Promise<string> {
    const options: https.RequestOptions = {
        hostname: 'wiki.facepunch.com',
        path,
        method: 'GET',
        agent,
        headers: { Accept: 'text/html' },
    };

    return new Promise((resolve, reject) => {
        let response = '';
        const req = https.request(options, (res) => {
            res.on('data', (chunk) => (response += chunk));
        });
        req.on('close', () => resolve(response));
        req.on('error', reject);
        req.end();
    });
}

function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function descriptionFromMarkup(markup: string): string {
    if (!markup) return '';
    const m = markup.match(/<description>([\s\S]*?)<\/description>/i);
    return m ? stripTags(m[1]) : '';
}

function descriptionFromHtml(html: string): string {
    if (!html) return '';

    // content after the <h1>gameevent</h1> and before the first <ul> or next section header
    const section =
        (html.match(/<h1[^>]*>\s*gameevent\s*<\/h1>([\s\S]*?)(?:<ul\b|<h2\b)/i) || [])[1] || '';

    // top <p> blocks
    const paras = [...section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
    return paras.join('\n\n').trim();
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
    const [main, html] = await Promise.all([
        GetPage('/gmod/gameevent'),
        fetchHtml('/gmod/gameevent'),
    ]);

    const htmlIntro = descriptionFromHtml(html);
    const markupIntro = descriptionFromMarkup(main.markup || '');
    const topDoc = htmlIntro || markupIntro;

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
