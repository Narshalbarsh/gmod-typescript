// Unified diff, LCS based, pages are small so the O(n*m) table is fine

export interface UnifiedDiffOptions {
    context?: number;
    oldLabel?: string;
    newLabel?: string;
}

type Op = { kind: ' ' | '-' | '+'; line: string };

function diffOps(a: string[], b: string[]): Op[] {
    const n = a.length;
    const m = b.length;
    // lcs[i][j] = LCS length of a[i..] and b[j..]
    const lcs: Uint32Array[] = new Array(n + 1);
    for (let i = 0; i <= n; i++) lcs[i] = new Uint32Array(m + 1);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i][j] =
                a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    const ops: Op[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ kind: ' ', line: a[i] });
            i++;
            j++;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            ops.push({ kind: '-', line: a[i] });
            i++;
        } else {
            ops.push({ kind: '+', line: b[j] });
            j++;
        }
    }
    while (i < n) ops.push({ kind: '-', line: a[i++] });
    while (j < m) ops.push({ kind: '+', line: b[j++] });
    return ops;
}

function splitLines(text: string): string[] {
    if (text === '') return [];
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

// '' when the texts are identical
export function unifiedDiff(
    oldText: string,
    newText: string,
    options: UnifiedDiffOptions = {}
): string {
    if (oldText === newText) return '';
    const context = options.context ?? 3;
    const a = splitLines(oldText);
    const b = splitLines(newText);
    const ops = diffOps(a, b);

    // group changes into hunks with `context` lines around them
    const out: string[] = [`--- ${options.oldLabel ?? 'a'}`, `+++ ${options.newLabel ?? 'b'}`];
    let idx = 0;
    while (idx < ops.length) {
        // find next change
        while (idx < ops.length && ops[idx].kind === ' ') idx++;
        if (idx >= ops.length) break;
        const start = Math.max(0, idx - context);
        let end = idx;
        // extend the hunk while changes are within 2*context of each other
        for (;;) {
            while (end < ops.length && ops[end].kind !== ' ') end++;
            let k = end;
            while (k < ops.length && ops[k].kind === ' ' && k - end < 2 * context) k++;
            if (k < ops.length && ops[k].kind !== ' ') {
                end = k;
                continue;
            }
            end = Math.min(ops.length, end + context);
            break;
        }
        // compute old/new line offsets of ops[start]
        let oldLine = 1;
        let newLine = 1;
        for (let k = 0; k < start; k++) {
            if (ops[k].kind !== '+') oldLine++;
            if (ops[k].kind !== '-') newLine++;
        }
        let oldCount = 0;
        let newCount = 0;
        const body: string[] = [];
        for (let k = start; k < end; k++) {
            const op = ops[k];
            if (op.kind !== '+') oldCount++;
            if (op.kind !== '-') newCount++;
            body.push(`${op.kind}${op.line}`);
        }
        out.push(`@@ -${oldLine},${oldCount} +${newLine},${newCount} @@`);
        out.push(...body);
        idx = end;
    }
    return out.join('\n') + '\n';
}
