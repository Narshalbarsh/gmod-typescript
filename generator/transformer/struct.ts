import { TSCollection, TSField } from '../ts_types';
import { WikiStruct, WikiStructItem } from '../wiki_types';
import { createRealmString, transformDescription } from './description';
import { transformIdentifier, transformType } from './util';
import {
    parseFirstCallbackSigFrom,
    mergeCallbackIntoType,
    unionWithAltType,
    parseInlineTableType,
    findSameFieldsReference,
} from './type_utils';

export function transformStruct(wikiStruct: WikiStruct): TSCollection {
    const plainName = wikiStruct.name.replace(/^.*\//, '');

    // Pre-pass: for any field documented as a generic `table` whose shape is only
    // described by an inline bullet list, build a concrete object-literal type
    // keyed by the field name. A second resolution step lets sibling fields that
    // say "same fields as X" reuse X's shape (e.g. SWEP.Secondary -> Primary).
    const inlineTableTypes = new Map<string, string>();
    for (const item of wikiStruct.items) {
        const t = parseInlineTableType(item.description);
        if (t) inlineTableTypes.set(item.name, t);
    }

    const fields = wikiStruct.items.map((item) => {
        const field = transformStructField(item);

        // Only upgrade vague (`any`) fields; never override a concrete type.
        if (field.type === 'any' || field.type === '') {
            const own = inlineTableTypes.get(item.name);
            if (own) {
                field.type = own;
            } else {
                const ref = findSameFieldsReference(item.description);
                const refType = ref ? inlineTableTypes.get(ref) : undefined;
                if (refType) field.type = refType;
            }
        }

        return field;
    });

    return {
        identifier: transformIdentifier(plainName),
        docComment:
            createRealmString(wikiStruct.realm) +
            '\n\n' +
            transformDescription(wikiStruct.description),
        fields,
        functions: [],
        namespace: false,
        innerCollections: [],
    };
}

export function transformStructField(wikiStructItem: WikiStructItem): TSField {
    const defaultString = wikiStructItem.default ? '\n' + `@default ${wikiStructItem.default}` : '';
    const cb = parseFirstCallbackSigFrom(wikiStructItem.description);
    let resolvedType = cb
        ? mergeCallbackIntoType(wikiStructItem.type, cb)
        : transformType(wikiStructItem.type);

    // Fold the wiki `alttype` attribute in as a union (mirrors argument handling).
    if (wikiStructItem.alttype) {
        resolvedType = unionWithAltType(resolvedType, transformType(wikiStructItem.alttype));
    }

    return {
        identifier: transformIdentifier(wikiStructItem.name),
        docComment: transformDescription(wikiStructItem.description) + defaultString,
        type: resolvedType,
        optional: !!wikiStructItem.default,
    };
}
