import { TSCollection, TSField } from '../ts_types';
import { printInterfaceFunction, printNamespaceFunction } from './function';
import { indentStr, printDocComent } from './util';
import { tryLoadFunctionOverride } from '../override_loader';
import { loadExtras } from '../extras_loader';

export function printInterface(tsInterface: TSCollection): string {
    return _printInterface(tsInterface);
}

export function _printInterface(
    tsInterface: TSCollection,
    indent = '    ',
    innerCollection = false,
): string {
    let head: string;
    let functions: string;
    let fields: string;
    let docComment: string = printDocComent(tsInterface.docComment);

    if (tsInterface.namespace) {
        head = `${!innerCollection ? 'declare ' : ''}namespace ${tsInterface.identifier} {`;
        head = innerCollection ? indentStr(head, '    ') : head;
        docComment = innerCollection ? indentStr(docComment, '    ') : docComment;

        const renderedFns = tsInterface.functions.map((f) => {
            const override = tryLoadFunctionOverride(
                'namespace',
                tsInterface.identifier,
                f.identifier,
            );
            if (override) {
                return `
${printDocComent(f.docComment)}
${override}
`.trim();
            }
            return printNamespaceFunction(f, tsInterface.identifier);
        });

        functions = indentStr(renderedFns.join('\n\n'), indent);
        fields = indentStr(
            tsInterface.fields.map((f) => printInterfaceField(f, true)).join('\n\n'),
            indent,
        );
    } else {
        const parent = tsInterface.parent ? `extends ${tsInterface.parent} ` : '';
        head = `interface ${tsInterface.identifier} ${parent}{`;
        functions = indentStr(
            tsInterface.functions
                .map((f) => printInterfaceFunction(f, tsInterface.identifier))
                .join('\n\n'),
            indent,
        );
        fields = indentStr(
            tsInterface.fields.map((f) => printInterfaceField(f)).join('\n\n'),
            indent,
        );
    }

    const extrasKind = tsInterface.namespace ? 'namespace' : 'interface';
    const extrasMap = loadExtras(extrasKind, tsInterface.identifier);

    const takenNames = new Set<string>([
        ...tsInterface.functions.map((f) => f.identifier),
        ...tsInterface.fields.map((f) => f.identifier),
    ]);

    for (const extraName of Object.keys(extrasMap)) {
        if (takenNames.has(extraName)) {
            throw new Error(
                `extras conflict: ${tsInterface.identifier}.${extraName} already exists ` +
                    `from scrape/overrides. Remove it from extras or rename it.`,
            );
        }
    }

    const extrasBlockRaw = Object.values(extrasMap).join('\n\n');
    const extrasBlock = extrasBlockRaw ? indentStr(extrasBlockRaw, indent) : '';

    const innerCollectionsBlock = tsInterface.innerCollections
        .map((ic) => _printInterface(ic, indent + indent, true))
        .join('\n\n');

    const chunks = [fields, functions, extrasBlock, innerCollectionsBlock].filter(
        (s) => s && s.trim().length > 0,
    );

    const bodyPieces = chunks.join('\n\n');

    const closing = innerCollection ? indentStr('}', '    ') : '}';

    return `
${docComment}
${head}
${bodyPieces}
${closing}
`.trim();
}

export function printInterfaceField(tsInterfaceField: TSField, isNamespace = false) {
    return `
${printDocComent(tsInterfaceField.docComment)}
${isNamespace ? 'const ' : ''}${tsInterfaceField.identifier}${
        !isNamespace && tsInterfaceField.optional ? '?' : ''
    }: ${tsInterfaceField.type}${isNamespace ? ';' : ','}
`.trim();
}
