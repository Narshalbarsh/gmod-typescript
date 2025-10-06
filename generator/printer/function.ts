import { TSArgument, TSFunction } from '../ts_types';
import { printDocComent } from './util';

export function printNamespaceFunction(func: TSFunction): string {
    return printFunction(func, true, false);
}

export function printInterfaceFunction(func: TSFunction): string {
    return printFunction(func, false, false);
}

export function printGlobalFunction(func: TSFunction): string {
    return printFunction(func, true, true);
}

export function printFunction(
    func: TSFunction,
    prependFunction: boolean,
    prependDeclare: boolean
): string {
    const docComment = printDocComent(func.docComment);
    const prefix = `${prependDeclare ? 'declare ' : ''}${prependFunction ? 'function ' : ''}`;

    // special case: for any SubModelIds parameter print some overloads
    const subIdxs = func.args
        .map((a, i) => ({ a, i }))
        .filter((x) => x.a.type === 'SubModelIds')
        .map((x) => x.i);

    if (subIdxs.length > 0) {
        // (literal-only): reject widened string + validate
        const genNames1 = subIdxs.map((_, k) => `S${k} extends string`);
        const gen1 = genNames1.length ? `<${genNames1.join(', ')}>` : '';
        const args1 = func.args.map((a, i) => {
            const pos = subIdxs.indexOf(i);
            if (pos === -1) return `${a.identifier}: ${a.type}`;
            const S = `S${pos}`;
            return `${a.identifier}: (string extends ${S} ? never : _ValidatedSubModelIdsOK<${S}>)`;
        });
        const sig1 = `${prefix}${func.identifier}${gen1}(${args1.join(', ')}): ${func.ret.type};`;

        // (widened-string only): accept dynamic strings
        const genNames2 = subIdxs.map((_, k) => `W${k} extends string`);
        const gen2 = genNames2.length ? `<${genNames2.join(', ')}>` : '';
        const args2 = func.args.map((a, i) => {
            const pos = subIdxs.indexOf(i);
            if (pos === -1) return `${a.identifier}: ${a.type}`;
            const W = `W${pos}`;
            return `${a.identifier}: string & (string extends ${W} ? ${W} : never)`;
        });
        const sig2 = `${prefix}${func.identifier}${gen2}(${args2.join(', ')}): ${func.ret.type};`;
        return `
${docComment}
${sig1}
${sig2}
`.trim();
    }

    const mapArg = (a: TSArgument) => {
        const hasDefault = a.default !== undefined;
        if (!hasDefault) return `${a.identifier}: ${a.type}`;

        const dRaw = String(a.default).trim();
        const isNil = /^nil$/i.test(dRaw);
        const isBool = dRaw === 'false' || dRaw === 'true';
        const isNum = dRaw !== '' && !isNaN(Number(dRaw));
        const isQuoted = /^(['"]).*\1$/.test(dRaw);
        const isStringType = a.type === 'string';
        const isSubModelIds = a.type === 'SubModelIds';

        if (isNil) return `${a.identifier}?: ${a.type}`;

        if (isStringType || isSubModelIds) {
            const literal = isQuoted ? dRaw : JSON.stringify(dRaw);
            return `${a.identifier}: ${a.type} = ${literal}`;
        }

        if (isBool || isNum) return `${a.identifier} = ${dRaw}`;

        return `${a.identifier}?: ${a.type}`;
    };

    const args = func.args.map(mapArg).join(', ');

    return `
${docComment}
${prefix}${func.identifier}(${args}): ${func.ret.type};
`.trim();
}
