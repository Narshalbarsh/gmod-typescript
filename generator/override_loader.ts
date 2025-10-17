import * as fs from 'fs';
import * as path from 'path';

export type OverrideKind = 'namespace' | 'interface' | 'global';

function readIfExists(p: string): string | undefined {
    try {
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim();
    } catch {}
    return undefined;
}

function findOverridesRoot(startDir: string): string | undefined {
    let cur = startDir;
    for (;;) {
        const candidate = path.join(cur, 'overrides');
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;

        const parent = path.dirname(cur);
        if (parent === cur) break;
        cur = parent;
    }
    return undefined;
}

function norm(s: string | undefined): string | undefined {
    if (!s) return s;
    return s.replace(/\s+/g, '').trim();
}

export function tryLoadFunctionOverride(
    kind: OverrideKind,
    container: string | undefined,
    funcName: string,
): string | undefined {
    const c = norm(container);
    const f = norm(funcName);
    if (!c || !f) return undefined;

    const folders = kind === 'global'
        ? ['global', 'namespace']
        : kind === 'interface'
        ? ['interface', 'namespace']
        : ['namespace'];

    const anchors = [
        process.cwd(),
        __dirname,
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../..'),
        path.dirname(require.main?.filename || __dirname),
    ];

    for (const a of anchors) {
        const root = findOverridesRoot(a);
        if (!root) continue;

        for (const folder of folders) {
            const candidates = [
                path.join(root, folder, c, `${f}.d.ts`),
                path.join(root, folder, c.toLowerCase(), `${f}.d.ts`),
                path.join(root, folder, c, `${f.toLowerCase()}.d.ts`),
                path.join(root, folder, c.toLowerCase(), `${f.toLowerCase()}.d.ts`),
            ];
            for (const p of candidates) {
                const s = readIfExists(p);
                if (s) {
                    return `/* Manual override from: ${folder}/${c}/${f} */\n${s}`;
                }
            }
        }
    }
    return undefined;
}
