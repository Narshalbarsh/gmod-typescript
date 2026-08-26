// The upstream mirror with the staging overlay applied.
// GetPagesInCategory and GetPage have the same shape as the network ones in the scrapper,
// so the generator does not care where pages come from, only wiki:sync ever touches the network.
//
// Staging, wiki/staging/<root>/<page>.wiki:
//   - a file that also exists upstream replaces that page's markup
//   - a file that does not exist upstream is a new page in the category its root implies
//     (class/ -> classfunc, lib/ -> libraryfunc, enum/ -> enum, ...),
//     name and title come from the file name, or from wiki/staging/pages.json
//   - an empty file removes the page, handy to see what happens when a page goes away

import * as fs from 'fs';
import * as path from 'path';
import { WikiElementKind, WikiPage } from '../wiki_types';
import {
    CATEGORIES,
    Category,
    DerivedPage,
    PAGE_EXT,
    ROOTS,
    STAGING_DIR,
    STAGING_PAGES_FILE,
    UPSTREAM_DIR,
    WIKI_DIR,
    derivePageFromFile,
    pageNameFromUrlPath,
} from './layout';
import { Manifest, ManifestPage, readManifest } from './manifest';

export interface LocalPage {
    name: string;
    title: string;
    category: Category;
    // e.g. class/Panel~SetContentAlignment.wiki, relative to the mirror dir it came from
    file: string;
    markup: string;
    source: 'upstream' | 'staging';
    // also set for staged pages that exist upstream
    revisionId?: number;
    updateCount?: number;
}

export interface LoadedWiki {
    repoRoot: string;
    manifest: Manifest;
    // after the staging overlay
    categories: Record<Category, string[]>;
    // after the staging overlay, keyed by page name
    pages: Map<string, LocalPage>;
    // removed by an empty staging file
    removed: Set<string>;
}

export interface LoadOptions {
    // default true
    staging?: boolean;
    // auto-detected when omitted
    repoRoot?: string;
}

export function findRepoRoot(start?: string): string {
    const anchors = [
        start,
        process.cwd(),
        __dirname,
        path.dirname(require.main?.filename || __dirname),
    ].filter((s): s is string => !!s);
    for (const anchor of anchors) {
        let cur = path.resolve(anchor);
        for (;;) {
            if (
                fs.existsSync(path.join(cur, WIKI_DIR)) ||
                fs.existsSync(path.join(cur, 'generator', 'tsconfig.json'))
            ) {
                return cur;
            }
            const parent = path.dirname(cur);
            if (parent === cur) break;
            cur = parent;
        }
    }
    throw new Error(
        'Could not locate the repository root (no wiki/ or generator/ directory found)'
    );
}

export function upstreamDir(repoRoot: string): string {
    return path.join(repoRoot, UPSTREAM_DIR);
}

export function stagingDir(repoRoot: string): string {
    return path.join(repoRoot, STAGING_DIR);
}

// <root>/<page>.wiki files present under dir, relative to it
export function listPageFiles(dir: string): string[] {
    const out: string[] = [];
    for (const root of ROOTS) {
        const rootDir = path.join(dir, root);
        if (!fs.existsSync(rootDir)) continue;
        for (const f of fs.readdirSync(rootDir).sort()) {
            if (f.endsWith(PAGE_EXT)) out.push(`${root}/${f}`);
        }
    }
    return out;
}

type StagingOverrides = Record<string, Partial<DerivedPage>>;

function readStagingOverrides(repoRoot: string): StagingOverrides {
    const p = path.join(stagingDir(repoRoot), STAGING_PAGES_FILE);
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8')) as StagingOverrides;
}

// page name -> category and file -> page name, computed once per manifest
const manifestIndexes = new WeakMap<
    Manifest,
    { categoryOf: Map<string, Category>; nameOfFile: Map<string, string> }
>();

function indexManifest(manifest: Manifest) {
    let idx = manifestIndexes.get(manifest);
    if (!idx) {
        const categoryOf = new Map<string, Category>();
        for (const c of CATEGORIES)
            for (const n of manifest.categories[c] || [])
                if (!categoryOf.has(n)) categoryOf.set(n, c);
        const nameOfFile = new Map<string, string>();
        for (const [name, page] of Object.entries(manifest.pages)) nameOfFile.set(page.file, name);
        idx = { categoryOf, nameOfFile };
        manifestIndexes.set(manifest, idx);
    }
    return idx;
}

// the upstream page with the same file, or a derived new one
export function resolveStagedFile(
    relFile: string,
    manifest: Manifest,
    overrides: StagingOverrides
): { name: string; title: string; category: Category; upstream?: ManifestPage } {
    const { categoryOf, nameOfFile } = indexManifest(manifest);
    const name = nameOfFile.get(relFile);
    if (name !== undefined) {
        const page = manifest.pages[name];
        return {
            name,
            title: page.title,
            category: categoryOf.get(name) ?? derivePageFromFile(relFile).category,
            upstream: page,
        };
    }
    const derived = derivePageFromFile(relFile);
    const override = overrides[relFile] || {};
    return { ...derived, ...override };
}

// category listings come back from the wiki roughly case-insensitively sorted, keep new pages in that order
function insertSorted(list: string[], name: string): void {
    const key = name.toLowerCase();
    const idx = list.findIndex((n) => n.toLowerCase() > key);
    if (idx === -1) list.push(name);
    else list.splice(idx, 0, name);
}

let cache: { key: string; wiki: LoadedWiki } | undefined;

export function loadWiki(options: LoadOptions = {}): LoadedWiki {
    const repoRoot = options.repoRoot ?? findRepoRoot();
    const useStaging = options.staging !== false;
    const key = `${repoRoot}|${useStaging}`;
    if (cache && cache.key === key) return cache.wiki;

    const manifest = readManifest(upstreamDir(repoRoot));
    if (!manifest) {
        throw new Error(
            `No wiki mirror found at ${upstreamDir(repoRoot)}. Run \`npm run wiki:sync\` first.`
        );
    }

    const categories = {} as Record<Category, string[]>;
    for (const c of CATEGORIES) categories[c] = [...(manifest.categories[c] || [])];

    const { categoryOf } = indexManifest(manifest);
    const pages = new Map<string, LocalPage>();
    for (const [name, meta] of Object.entries(manifest.pages)) {
        pages.set(name, {
            name,
            title: meta.title,
            category: categoryOf.get(name) ?? derivePageFromFile(meta.file).category,
            file: meta.file,
            markup: fs.readFileSync(path.join(upstreamDir(repoRoot), meta.file), 'utf8'),
            source: 'upstream',
            revisionId: meta.revisionId,
            updateCount: meta.updateCount,
        });
    }

    const removed = new Set<string>();
    if (useStaging && fs.existsSync(stagingDir(repoRoot))) {
        const overrides = readStagingOverrides(repoRoot);
        for (const relFile of listPageFiles(stagingDir(repoRoot))) {
            const resolved = resolveStagedFile(relFile, manifest, overrides);
            const markup = fs.readFileSync(path.join(stagingDir(repoRoot), relFile), 'utf8');

            if (markup.trim() === '') {
                pages.delete(resolved.name);
                removed.add(resolved.name);
                for (const c of CATEGORIES)
                    categories[c] = categories[c].filter((n) => n !== resolved.name);
                continue;
            }

            if (
                !pages.has(resolved.name) &&
                !categories[resolved.category].includes(resolved.name)
            ) {
                insertSorted(categories[resolved.category], resolved.name);
            }
            pages.set(resolved.name, {
                name: resolved.name,
                title: resolved.title,
                category: resolved.category,
                file: relFile,
                markup,
                source: 'staging',
                revisionId: resolved.upstream?.revisionId,
                updateCount: resolved.upstream?.updateCount,
            });
        }
    }

    const wiki: LoadedWiki = { repoRoot, manifest, categories, pages, removed };
    cache = { key, wiki };
    return wiki;
}

// set by the generator entry point, --no-staging for example
let defaultOptions: LoadOptions = {};
export function configureLocalWiki(options: LoadOptions): void {
    defaultOptions = options;
    cache = undefined;
}

// same contract as the scrapper's, served from the mirror, paths come back unencoded
export async function GetPagesInCategory(category: string): Promise<string[]> {
    const wiki = loadWiki(defaultOptions);
    const names = wiki.categories[category as Category];
    if (!names)
        throw new Error(
            `Category "${category}" is not part of the mirror (see CATEGORIES in wiki/layout.ts)`
        );
    return names.map((n) => `/gmod/${n}`);
}

// same contract as the scrapper's, served from the mirror, accepts encoded or plain paths
export async function GetPage(urlPath: string): Promise<WikiPage> {
    const wiki = loadWiki(defaultOptions);
    const name = pageNameFromUrlPath(urlPath);
    const page = wiki.pages.get(name);
    if (!page) {
        throw new Error(
            wiki.removed.has(name)
                ? `Page "${name}" is removed by an empty staging file`
                : `Page "${name}" is not in the wiki mirror; run \`npm run wiki:sync\` or add it to wiki/staging`
        );
    }
    return {
        kind: WikiElementKind.Page,
        title: page.title,
        address: page.name,
        markup: page.markup,
        revisionId: page.revisionId ?? 0,
        updateCount: page.updateCount ?? 0,
    };
}
