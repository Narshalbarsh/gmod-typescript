import { TSArgument, TSFunction } from '../ts_types';
import { printDocComent } from './util';
import { tryLoadFunctionOverride, OverrideKind } from '../override_loader';

export function printNamespaceFunction(func: TSFunction, container?: string): string {
    return printFunction(func, true, false, { kind: 'namespace', container });
}

export function printInterfaceFunction(func: TSFunction, container?: string): string {
    return printFunction(func, false, false, { kind: 'interface', container });
}

export function printGlobalFunction(func: TSFunction): string {
    return printFunction(func, true, true, { kind: 'global' });
}

function printFunction(
    func: TSFunction,
    prependFunction: boolean,
    prependDeclare: boolean,
    ctx?: { kind: OverrideKind; container?: string },
): string {
    const docComment = printDocComent(func.docComment);

    // Signature override (keep scraped doc, replace only the declaration)
    const override = tryLoadFunctionOverride(ctx?.kind ?? 'interface', ctx?.container, func.identifier);
    if (override) {
        return `
${docComment}
${override}
`.trim();
    }

    const prefix = `${prependDeclare ? 'declare ' : ''}${prependFunction ? 'function ' : ''}`;

    const firstOptionalIdx = func.args.findIndex((a) => a.default !== undefined);
    const optionalStartsAt = firstOptionalIdx === -1 ? Number.POSITIVE_INFINITY : firstOptionalIdx;

    const formatParam = (a: TSArgument, i: number, typeOverride?: string) => {
        const isRest = a.identifier.startsWith('...');
        const makeOptional = !isRest && i >= optionalStartsAt;
        const name = makeOptional ? `${a.identifier}?` : a.identifier;
        const ty = typeOverride ?? a.type;
        return `${name}: ${ty}`;
    };

    // special case: for any SubModelIds parameter print some overloads
    const subIdxs = func.args
        .map((a, i) => ({ a, i }))
        .filter((x) => x.a.type === 'SubModelIds')
        .map((x) => x.i);

    if (subIdxs.length > 0) {
        const genNames1 = subIdxs.map((_, k) => `S${k} extends string`);
        const gen1 = genNames1.length ? `<${genNames1.join(', ')}>` : '';
        const args1 = func.args.map((a, i) => {
            const pos = subIdxs.indexOf(i);
            if (pos === -1) return formatParam(a, i);
            const S = `S${pos}`;
            return formatParam(a, i, `(string extends ${S} ? never : _ValidatedSubModelIdsOK<${S}>)`);
        });
        const sig1 = `${prefix}${func.identifier}${gen1}(${args1.join(', ')}): ${func.ret.type};`;

        const genNames2 = subIdxs.map((_, k) => `W${k} extends string`);
        const gen2 = genNames2.length ? `<${genNames2.join(', ')}>` : '';
        const args2 = func.args.map((a, i) => {
            const pos = subIdxs.indexOf(i);
            if (pos === -1) return formatParam(a, i);
            const W = `W${pos}`;
            return formatParam(a, i, `string & (string extends ${W} ? ${W} : never)`);
        });
        const sig2 = `${prefix}${func.identifier}${gen2}(${args2.join(', ')}): ${func.ret.type};`;
        return `
${docComment}
${sig1}
${sig2}
`.trim();
    }

    // No parameter initializers in .d.ts. Use optionals instead.
    const args = func.args.map((a, i) => formatParam(a, i)).join(', ');

    return `
${docComment}
${prefix}${func.identifier}(${args}): ${func.ret.type};
`.trim();
}
