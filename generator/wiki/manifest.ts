import * as fs from 'fs';
import * as path from 'path';
import { Category, MANIFEST_FILE } from './layout';

export interface ManifestPage {
    // as reported by the API, it is NOT always derivable from the name, COLOR:AddHue is titled Color:AddHue
    title: string;
    // e.g. class/Panel~SetContentAlignment.wiki, relative to the mirror dir
    file: string;
    revisionId: number;
    updateCount: number;
}

export interface Manifest {
    // ISO timestamp
    syncedAt: string;
    // in the order the wiki returned them, the generator's output follows it
    categories: Record<Category, string[]>;
    pages: Record<string, ManifestPage>;
}

export function manifestPath(mirrorDir: string): string {
    return path.join(mirrorDir, MANIFEST_FILE);
}

export function readManifest(mirrorDir: string): Manifest | undefined {
    const p = manifestPath(mirrorDir);
    if (!fs.existsSync(p)) return undefined;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Manifest;
}

// sorted so the manifest diff in git only ever shows real changes
function sortObject<T>(obj: Record<string, T>): Record<string, T> {
    const out: Record<string, T> = {};
    for (const k of Object.keys(obj).sort()) out[k] = obj[k];
    return out;
}

export function writeManifest(mirrorDir: string, manifest: Manifest): void {
    const ordered: Manifest = {
        syncedAt: manifest.syncedAt,
        categories: manifest.categories,
        pages: sortObject(manifest.pages),
    };
    let text = JSON.stringify(ordered, null, 4) + '\n';
    // so npm run lint passes without a .prettierignore entry
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const prettier = require('prettier');
        const options = prettier.resolveConfig.sync(manifestPath(mirrorDir)) || {};
        text = prettier.format(text, { ...options, parser: 'json' });
    } catch {
        /* prettier not installed, plain JSON is fine */
    }
    fs.mkdirSync(mirrorDir, { recursive: true });
    fs.writeFileSync(manifestPath(mirrorDir), text);
}
