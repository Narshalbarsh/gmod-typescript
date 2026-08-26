// npm run wiki:stage -- <page> [<page> ...],
// copies the upstream version of a page into wiki/staging for editing,
// and records the revision it was copied from in wiki/staging/base.json, that is what wiki:diff's STALE reads.
// <page> is a wiki page name, Panel:SetContentAlignment or Enums/NavDir, a wiki URL,
// or a mirror file like class/Panel~SetContentAlignment.wiki.
// --new <category> <name> starts a page that does not exist upstream, --new enum Enums/ContentAlignment

import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import {
    CATEGORIES,
    Category,
    STAGING_BASE_FILE,
    fileForPage,
    pageNameFromUrlPath,
} from './layout';
import { findRepoRoot, loadWiki, stagingDir } from './local';

function usage(): never {
    console.log('usage: wiki:stage <page> [<page> ...]\n       wiki:stage --new <category> <name>');
    process.exit(1);
}

function main(): void {
    const argv = process.argv.slice(2);
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) usage();

    const repoRoot = findRepoRoot();
    const wiki = loadWiki({ repoRoot, staging: false });
    const basePath = path.join(stagingDir(repoRoot), STAGING_BASE_FILE);
    const base: Record<string, number> = fs.existsSync(basePath)
        ? JSON.parse(fs.readFileSync(basePath, 'utf8'))
        : {};

    if (argv[0] === '--new') {
        const [, category, name] = argv;
        if (!category || !name || !(CATEGORIES as readonly string[]).includes(category)) usage();
        const file = fileForPage(category as Category, name);
        const full = path.join(stagingDir(repoRoot), file);
        if (fs.existsSync(full)) {
            console.error(`${file} already exists in staging`);
            process.exit(1);
        }
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, '');
        console.log(
            `created empty wiki/staging/${file} for new page "${name}" (fill it in; an empty file means "removed")`
        );
        return;
    }

    for (const arg of argv) {
        // accept names, URLs and mirror files
        let name = arg;
        if (/^https?:\/\//.test(arg)) name = pageNameFromUrlPath(new URL(arg).pathname);
        else if (arg.startsWith('/gmod/')) name = pageNameFromUrlPath(arg);
        else {
            const byFile = [...wiki.pages.values()].find(
                (p) => p.file === arg.replace(/\\/g, '/').replace(/^wiki\/(upstream|staging)\//, '')
            );
            if (byFile) name = byFile.name;
        }

        const page = wiki.pages.get(name);
        if (!page) {
            console.error(
                `"${arg}" is not a page in the mirror (run wiki:sync, or use --new for a new page)`
            );
            process.exitCode = 1;
            continue;
        }
        const full = path.join(stagingDir(repoRoot), page.file);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        if (fs.existsSync(full)) {
            console.log(
                `wiki/staging/${page.file} already exists, leaving it alone (base rev ${
                    base[name] ?? 'unknown'
                })`
            );
            continue;
        }
        fs.writeFileSync(full, page.markup);
        base[name] = page.revisionId ?? 0;
        console.log(
            `staged ${name} -> wiki/staging/${page.file} (upstream rev ${page.revisionId})`
        );
    }

    const ordered: Record<string, number> = {};
    for (const k of Object.keys(base).sort()) ordered[k] = base[k];
    fs.mkdirSync(path.dirname(basePath), { recursive: true });
    fs.writeFileSync(basePath, JSON.stringify(ordered, null, 4) + '\n');
}

main();
