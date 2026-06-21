import { TSCollection, TSField } from '../ts_types';
import { WikiStruct, WikiStructItem } from '../wiki_types';
import { createRealmString, transformDescription } from './description';
import { transformIdentifier, transformType } from './util';
import { parseFirstCallbackSigFrom, mergeCallbackIntoType, unionWithAltType } from './type_utils';

export function transformStruct(wikiStruct: WikiStruct): TSCollection {
    const plainName = wikiStruct.name.replace(/^.*\//, '');
    return {
        identifier: transformIdentifier(plainName),
        docComment:
            createRealmString(wikiStruct.realm) +
            '\n\n' +
            transformDescription(wikiStruct.description),
        fields: wikiStruct.items.map(transformStructField),
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
