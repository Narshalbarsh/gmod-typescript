// npm run wiki:sync, mirror wiki.facepunch.com into wiki/upstream.
// Fetches the category listings the generator consumes, then every page in them,
// and writes each page's markup verbatim with LF line endings to <root>/<page>.wiki,
// plus a manifest with titles and revision ids.
// Pages that disappeared upstream get their file deleted,
// so after a sync git status is exactly what changed on the wiki.
//
//   --concurrency=N -> parallel page requests, default 8
//   --quiet         -> only print the summary

import * as fs from 'fs';
import * as path from 'path';
import { GetPage, GetPagesInCategory } from '../scrapper/scrapper';
import { CATEGORIES, Category, fileForPage, normalizeMarkup, pageNameFromUrlPath } from './layout';
import { Manifest, ManifestPage, readManifest, writeManifest } from './manifest';
import { findRepoRoot, listPageFiles, upstreamDir } from './local';

interface Args {
    concurrency: number;
    quiet: boolean;
}

function parseArgs(argv: string[]): Args {
    const args: Args = { concurrency: 8, quiet: false };
    for (const a of argv) {
        const m = /^--concurrency=(\d+)$/.exec(a);
        if (m) args.concurrency = Math.max(1, parseInt(m[1], 10));
        else if (a === '--quiet') args.quiet = true;
        else if (a === '--help' || a === '-h') {
            console.log('usage: wiki:sync [--concurrency=N] [--quiet]');
            process.exit(0);
        } else throw new Error(`unknown argument ${a}`);
    }
    return args;
}

async function mapLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    async function worker(): Promise<void> {
        for (;;) {
            const i = next++;
            if (i >= items.length) return;
            results[i] = await fn(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = findRepoRoot();
    const dir = upstreamDir(repoRoot);
    const previous = readManifest(dir);
    const log = (s: string) => {
        if (!args.quiet) console.log(s);
    };

    // 1. category listings -> page names,
    //    a page listed in several categories is stored once, under the root of the first one
    const categories = {} as Record<Category, string[]>;
    const categoryOf = new Map<string, Category>();
    for (const category of CATEGORIES) {
        const urlPaths = await GetPagesInCategory(category);
        const names = urlPaths.map(pageNameFromUrlPath);
        categories[category] = names;
        for (const n of names) if (!categoryOf.has(n)) categoryOf.set(n, category);
        log(`${category.padEnd(12)} ${names.length} pages`);
    }
    const names = [...categoryOf.keys()];
    log(`fetching ${names.length} pages with concurrency ${args.concurrency} ...`);

    // 2. pages
    const pages: Record<string, ManifestPage> = {};
    const contents = new Map<string, string>();
    let done = 0;
    const failures: string[] = [];
    await mapLimit(names, args.concurrency, async (name) => {
        try {
            const page = await GetPage(`/gmod/${encodeURI(name)}`);
            const file = fileForPage(categoryOf.get(name)!, name);
            pages[name] = {
                title: page.title,
                file,
                revisionId: page.revisionId,
                updateCount: page.updateCount,
            };
            contents.set(file, normalizeMarkup(page.markup || ''));
        } catch (err) {
            failures.push(`${name}: ${(err as Error).message}`);
        }
        done++;
        if (!args.quiet && done % 500 === 0) console.log(`  ${done}/${names.length}`);
    });

    if (failures.length > 0) {
        // NEVER write a partial mirror, a missing page would look like a wiki deletion
        console.error(`\n${failures.length} page(s) failed to download, mirror NOT updated:`);
        for (const f of failures) console.error(`  ${f}`);
        process.exit(1);
    }

    // 3. write files, delete stale ones
    const stats = { added: 0, changed: 0, unchanged: 0, removed: 0 };
    const existing = new Set(listPageFiles(dir));
    for (const [file, markup] of contents) {
        const full = path.join(dir, file);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        if (!existing.has(file)) {
            stats.added++;
        } else if (fs.readFileSync(full, 'utf8') !== markup) {
            stats.changed++;
        } else {
            stats.unchanged++;
            continue;
        }
        fs.writeFileSync(full, markup);
    }
    for (const file of existing) {
        if (!contents.has(file)) {
            fs.unlinkSync(path.join(dir, file));
            stats.removed++;
        }
    }

    const manifest: Manifest = { syncedAt: new Date().toISOString(), categories, pages };
    writeManifest(dir, manifest);

    const revisionChanges = previous
        ? Object.keys(pages).filter(
              (n) => previous.pages[n] && previous.pages[n].revisionId !== pages[n].revisionId
          ).length
        : 0;
    console.log(
        `wiki:sync done: ${names.length} pages; ${stats.added} added, ${stats.changed} changed, ` +
            `${stats.removed} removed, ${stats.unchanged} unchanged` +
            (previous ? ` (${revisionChanges} new revisions since ${previous.syncedAt})` : '')
    );
}

main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
});
