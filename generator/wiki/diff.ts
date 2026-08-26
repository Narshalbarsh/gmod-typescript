// npm run wiki:diff [-- page-or-file ...] [--context=N] [--summary],
// for every page in wiki/staging, what would have to change on the real wiki:
//
//   NEW      -> page does not exist upstream, the whole staged file is the page to create
//   MODIFIED -> unified diff upstream to staging, apply it by hand in the wiki editor
//   LANDED   -> staged file matches upstream, the edit went in, delete it from staging
//   REMOVED  -> staged file is empty, we are simulating the page going away
//
// STALE is added when the upstream revision moved since the page was staged with wiki:stage,
// compare and merge before applying.
// Exits 1 when anything is NEW or MODIFIED so it doubles as a pending-edits check

import * as fs from 'fs';
import * as path from 'path';
import { STAGING_BASE_FILE, pageEditUrl, pageHistoryUrl } from './layout';
import {
    findRepoRoot,
    listPageFiles,
    loadWiki,
    resolveStagedFile,
    stagingDir,
    upstreamDir,
} from './local';
import { unifiedDiff } from './udiff';

interface Args {
    context: number;
    summary: boolean;
    filters: string[];
}

function parseArgs(argv: string[]): Args {
    const args: Args = { context: 3, summary: false, filters: [] };
    for (const a of argv) {
        const m = /^--context=(\d+)$/.exec(a);
        if (m) args.context = parseInt(m[1], 10);
        else if (a === '--summary') args.summary = true;
        else if (a === '--help' || a === '-h') {
            console.log('usage: wiki:diff [--context=N] [--summary] [page-or-file ...]');
            process.exit(0);
        } else args.filters.push(a);
    }
    return args;
}

type Base = Record<string, number>;

function readBase(repoRoot: string): Base {
    const p = path.join(stagingDir(repoRoot), STAGING_BASE_FILE);
    return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as Base) : {};
}

// the wiki editor strips trailing whitespace when a page is saved
function stripTrailingWhitespace(text: string): string {
    return text
        .split('\n')
        .map((l) => l.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n+$/, '\n');
}

function matches(filters: string[], name: string, file: string): boolean {
    if (filters.length === 0) return true;
    const norm = (s: string) =>
        s
            .replace(/\\/g, '/')
            .replace(/^wiki\/staging\//, '')
            .replace(/^wiki\/upstream\//, '');
    return filters.some((f) => {
        const n = norm(f);
        return (
            n === name ||
            n === file ||
            n === file.replace(/\.wiki$/, '') ||
            name.toLowerCase() === n.toLowerCase()
        );
    });
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = findRepoRoot();
    const wiki = loadWiki({ repoRoot, staging: false });
    const base = readBase(repoRoot);
    const overrides = (() => {
        const p = path.join(stagingDir(repoRoot), 'pages.json');
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
    })();

    const files = listPageFiles(stagingDir(repoRoot));
    if (files.length === 0) {
        console.log(`nothing staged in ${stagingDir(repoRoot)}`);
        return;
    }

    let pending = 0;
    const lines: string[] = [];
    for (const relFile of files) {
        const resolved = resolveStagedFile(relFile, wiki.manifest, overrides);
        if (!matches(args.filters, resolved.name, relFile)) continue;

        const staged = fs.readFileSync(path.join(stagingDir(repoRoot), relFile), 'utf8');
        const upstreamPage = resolved.upstream;
        const upstreamText = upstreamPage
            ? fs.readFileSync(path.join(upstreamDir(repoRoot), upstreamPage.file), 'utf8')
            : undefined;

        let status: 'NEW' | 'MODIFIED' | 'LANDED' | 'REMOVED';
        let whitespaceOnly = false;
        if (staged.trim() === '') status = 'REMOVED';
        else if (upstreamText === undefined) status = 'NEW';
        else if (upstreamText === staged) status = 'LANDED';
        else if (stripTrailingWhitespace(upstreamText) === stripTrailingWhitespace(staged)) {
            status = 'LANDED';
            whitespaceOnly = true;
        } else status = 'MODIFIED';
        if (status === 'NEW' || status === 'MODIFIED') pending++;

        // a moved upstream revision is only interesting while the edit is still pending
        const stale =
            status === 'MODIFIED' &&
            upstreamPage &&
            base[resolved.name] !== undefined &&
            base[resolved.name] !== upstreamPage.revisionId;

        const header = [
            `${status.padEnd(8)} ${resolved.name}   (wiki/staging/${relFile})`,
            upstreamPage
                ? `         upstream rev ${upstreamPage.revisionId}` +
                  (base[resolved.name] !== undefined
                      ? `, staged from rev ${base[resolved.name]}`
                      : '') +
                  (stale
                      ? '   ** STALE: upstream changed since this was staged, re-check before applying **'
                      : '')
                : `         category ${resolved.category}, title "${
                      resolved.title
                  }"  (create at ${pageEditUrl(resolved.name)})`,
            upstreamPage
                ? `         edit: ${pageEditUrl(resolved.name)}   history: ${pageHistoryUrl(
                      resolved.name
                  )}`
                : '',
        ].filter(Boolean);

        lines.push('='.repeat(100), ...header);
        if (args.summary) continue;

        if (status === 'NEW') {
            lines.push(
                '',
                ...staged
                    .replace(/\n$/, '')
                    .split('\n')
                    .map((l) => `+${l}`),
                ''
            );
        } else if (status === 'MODIFIED') {
            lines.push(
                '',
                unifiedDiff(upstreamText!, staged, {
                    context: args.context,
                    oldLabel: `upstream/${upstreamPage!.file}`,
                    newLabel: `staging/${relFile}`,
                })
            );
        } else if (status === 'LANDED') {
            lines.push(
                (whitespaceOnly
                    ? '         identical to upstream except for trailing whitespace (the wiki editor strips it on save)'
                    : '         identical to upstream') +
                    ': delete the staged file (git rm wiki/staging/' +
                    relFile +
                    ')',
                ''
            );
        } else {
            lines.push(
                '         empty file: the generator behaves as if this page did not exist',
                ''
            );
        }
    }

    console.log(lines.join('\n'));
    console.log('='.repeat(100));
    console.log(`${pending} page(s) with pending wiki edits`);
    if (pending > 0) process.exitCode = 1;
}

main();
