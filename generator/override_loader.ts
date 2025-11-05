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

function tryLoadMemberOverride(
    kind: OverrideKind,
    container: string | undefined,
    memberName: string,
): string | undefined {
    const c = norm(container);
    const m = norm(memberName);
    if (!m) return undefined;

    const folders =
        kind === 'global' ? ['global', 'namespace'] :
            kind === 'interface' ? ['interface', 'namespace'] :
                ['namespace'];

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
            const candidates = c
                ? [
                      path.join(root, folder, c, `${m}.d.ts`),
                      path.join(root, folder, c.toLowerCase(), `${m}.d.ts`),
                      path.join(root, folder, c, `${m.toLowerCase()}.d.ts`),
                      path.join(root, folder, c.toLowerCase(), `${m.toLowerCase()}.d.ts`),
                  ]
                : kind === 'global'
                    ? [
                          path.join(root, folder, `${m}.d.ts`),
                          path.join(root, folder, `${m.toLowerCase()}.d.ts`),
                      ]
                    : [];

            for (const p of candidates) {
                const s = readIfExists(p);
                if (s) {
                    const loc = c ? `${folder}/${c}/${m}` : `${folder}/${m}`;
                    return `/* Manual override from: ${loc} */\n${s}`;
                }
            }
        }
    }
    return undefined;
}

export function tryLoadFunctionOverride(
    kind: OverrideKind,
    container: string | undefined,
    funcName: string,
): string | undefined {
    return tryLoadMemberOverride(kind, container, funcName);
}

export function tryLoadFieldOverride(
    kind: OverrideKind,
    container: string | undefined,
    fieldName: string,
): string | undefined {
    return tryLoadMemberOverride(kind, container, fieldName);
}
