// Where a wiki page lives on disk.
// wiki/upstream is a verbatim mirror written by wiki:sync,
// wiki/staging is local edits laid on top with the same layout, a file there replaces the upstream page.
//
// Pages are stored flat inside a per-kind root under their wiki page name, so the mapping is obvious both ways.
// The only substitution is `:` -> `~`, colons are not valid in file names on Windows.
// Do NOT group by parent instead, Color/COLOR, Entity/ENTITY, effects/Effects and menu/Menu differ only in case,
// and collide as directories on a case-insensitive file system.
//
//   Global.AddCSLuaFile        -> global/AddCSLuaFile.wiki
//   Enums/NavDir               -> enum/NavDir.wiki
//   Structures/AmmoData        -> struct/AmmoData.wiki
//   Panel:SetContentAlignment  -> class/Panel~SetContentAlignment.wiki
//   Panel (the class page)     -> class/Panel.wiki
//   GM:Think                   -> hook/GM~Think.wiki
//   GM_Hooks (hook index page) -> hook/GM_Hooks.wiki
//   math.floor                 -> lib/math.floor.wiki
//   math (the library page)    -> lib/math.wiki
//   gameevent/player_say       -> gameevent/player_say.wiki
//
// A page "name" in this file is the wiki address, the URL path without the leading /gmod/ and not URL encoded,
// Panel:SetContentAlignment, Enums/NavDir, math.floor

import * as path from 'path';

export const PAGE_EXT = '.wiki';

// The categories we sync, in this order, a page listed in more than one is stored under the first
export const CATEGORIES = [
    'Global',
    'enum',
    'struct',
    'classfunc',
    'panelfunc',
    'panel',
    'class',
    'hook',
    'libraryfunc',
    'gameevent',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const ROOTS = ['global', 'enum', 'struct', 'class', 'hook', 'lib', 'gameevent'] as const;
export type Root = (typeof ROOTS)[number];

const ROOT_OF_CATEGORY: Record<Category, Root> = {
    Global: 'global',
    enum: 'enum',
    struct: 'struct',
    classfunc: 'class',
    panelfunc: 'class',
    panel: 'class',
    class: 'class',
    hook: 'hook',
    libraryfunc: 'lib',
    gameevent: 'gameevent',
};

// what a new staged page in each root counts as
const CATEGORY_OF_ROOT: Record<Root, Category> = {
    global: 'Global',
    enum: 'enum',
    struct: 'struct',
    class: 'classfunc',
    hook: 'hook',
    lib: 'libraryfunc',
    gameevent: 'gameevent',
};

export const WIKI_DIR = 'wiki';
export const UPSTREAM_DIR = path.join(WIKI_DIR, 'upstream');
export const STAGING_DIR = path.join(WIKI_DIR, 'staging');
export const MANIFEST_FILE = 'manifest.json';
// upstream revision each staged page was copied from, written by wiki:stage
export const STAGING_BASE_FILE = 'base.json';
// optional name, title and category overrides for staged pages the file name can't derive
export const STAGING_PAGES_FILE = 'pages.json';

export function rootOfCategory(category: Category): Root {
    return ROOT_OF_CATEGORY[category];
}

export function categoryOfRoot(root: Root): Category {
    return CATEGORY_OF_ROOT[root];
}

// /gmod/Panel%3ASetContentAlignment -> Panel:SetContentAlignment
export function pageNameFromUrlPath(urlPath: string): string {
    const decoded = decodeURIComponent(urlPath);
    return decoded.replace(/^\/gmod\//, '');
}

// Panel:SetContentAlignment -> /gmod/Panel:SetContentAlignment, minimally encoded for the request
export function urlPathFromPageName(name: string): string {
    return `/gmod/${encodeURI(name)}`;
}

export function pageUrl(name: string): string {
    return `https://wiki.facepunch.com${urlPathFromPageName(name)}`;
}

export function pageEditUrl(name: string): string {
    return `${pageUrl(name)}~edit`;
}

export function pageHistoryUrl(name: string): string {
    return `${pageUrl(name)}~history`;
}

function encodeStem(stem: string): string {
    return stem.replace(/:/g, '~');
}

function decodeStem(stem: string): string {
    return stem.replace(/~/g, ':');
}

// e.g. class/Panel~SetContentAlignment.wiki, relative to the mirror dir
export function fileForPage(category: Category, name: string): string {
    const root = rootOfCategory(category);
    let stem = name;
    switch (root) {
        case 'global':
            stem = name.replace(/^Global\./, '');
            break;
        case 'enum':
            stem = name.replace(/^Enums\//, '');
            break;
        case 'struct':
            stem = name.replace(/^Structures\//, '');
            break;
        case 'gameevent':
            stem = name.replace(/^gameevent\//, '');
            break;
    }
    if (stem.includes('/')) {
        throw new Error(
            `Cannot map wiki page "${name}" (category ${category}) to a file: unexpected "/"`
        );
    }
    return `${root}/${encodeStem(stem)}${PAGE_EXT}`;
}

export interface DerivedPage {
    name: string;
    title: string;
    category: Category;
}

// Only for staged files that do not exist upstream, upstream files get name, title and category from the manifest.
// Titles follow the wiki's default for a new page,
// Enums/X -> X, Global.X -> X, GM_Hooks -> GM Hooks, otherwise the page name itself,
// anything else goes in wiki/staging/pages.json
export function derivePageFromFile(relFile: string): DerivedPage {
    const norm = relFile.replace(/\\/g, '/');
    const m = /^([^/]+)\/([^/]+)\.wiki$/.exec(norm);
    if (!m || !(ROOTS as readonly string[]).includes(m[1])) {
        throw new Error(
            `Unrecognised mirror file "${relFile}": expected <root>/<page>.wiki with root one of ${ROOTS.join(
                ', '
            )}`
        );
    }
    const root = m[1] as Root;
    const stem = decodeStem(m[2]);
    const category = categoryOfRoot(root);

    switch (root) {
        case 'global':
            return { name: `Global.${stem}`, title: stem, category };
        case 'enum':
            return { name: `Enums/${stem}`, title: stem, category };
        case 'struct':
            return { name: `Structures/${stem}`, title: stem, category };
        case 'gameevent':
            return { name: `gameevent/${stem}`, title: stem, category };
        case 'hook':
            return {
                name: stem,
                title: /_Hooks$/.test(stem) ? stem.replace(/_/g, ' ') : stem,
                category,
            };
        default:
            return { name: stem, title: stem, category };
    }
}

// LF line endings and exactly one trailing newline
export function normalizeMarkup(markup: string): string {
    return markup.replace(/\r\n?/g, '\n').replace(/\s+$/, '') + '\n';
}
