import { TSCollection, TSField } from '../ts_types';
import { WikiStruct, WikiStructItem } from '../wiki_types';
import { createRealmString, transformDescription } from './description';
import { transformIdentifier, transformType } from './util';

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
    return {
        identifier: transformIdentifier(wikiStructItem.name),
        docComment: transformDescription(wikiStructItem.description) + defaultString,
        type: transformType(wikiStructItem.type),
        optional: !!wikiStructItem.default,
    };
}
