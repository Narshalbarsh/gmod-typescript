import {
    getPageMods,
    isOmitParentFieldModification,
    isInnerNamespaceModification,
    isAddParentModification,
    isAddFieldModification,
} from './modification_db';
import { TSCollection, TSFunction, TSField } from '../ts_types';
import {
    WikiFunctionCollection,
    WikiFunction,
    WikiStructItem,
    isWikiFunction,
    isWikiStructItem,
} from '../wiki_types';
import { transformDescription } from './description';
import { transformFunction } from './function';
import { transformIdentifier } from './util';
import { transformStructField } from './struct';

export function transformFunctionCollection(
    wikiClass: WikiFunctionCollection,
    wikiMembers: (WikiFunction | WikiStructItem)[],
): TSCollection {
    const mods = getPageMods(wikiClass.address);

    let membersCopy = [...wikiMembers];

    // explicit inner namespaces from modifications.json
    const innerNamespacesFromMods = mods.filter(isInnerNamespaceModification).map((mod) => {
        const namespaceFuncs = membersCopy.filter((f) => f.address.includes(mod.prefix + '.'));
        // remove from original funcs
        membersCopy = membersCopy.filter(
            (f) => !f.address.includes(mod.prefix + '.') && f.name !== mod.prefix,
        );

        const namespaceRoot = namespaceFuncs.find((f) => f.name === mod.prefix);
        const namespaceFuncsWithoutRoot = namespaceFuncs.filter((f) => f.name !== mod.prefix);

        return {
            identifier: mod.prefix,
            docComment: transformDescription(namespaceRoot?.description ?? ''),
            functions: namespaceFuncsWithoutRoot
                .filter(isWikiFunction)
                .map(transformFunction)
                .map((f) => {
                    f.identifier = f.identifier.replace(`${mod.prefix}.`, '');
                    if (wikiClass.isHookContainer) f.optional = true;
                    return f;
                }),
            fields: namespaceFuncsWithoutRoot
                .filter(isWikiStructItem)
                .map(transformStructField)
                .map((f) => {
                    f.identifier = f.identifier.replace(`${mod.prefix}.`, '');
                    return f;
                }),
            innerCollections: [],
            namespace: true,
        } as TSCollection;
    });

    // parents handling/omits
    const parents: string[] = mods.filter(isAddParentModification).map((mod) => mod.parent);
    if (wikiClass.parent) parents.push(wikiClass.parent);

    const omits = mods.filter(isOmitParentFieldModification);
    const parentsModified = [...parents];
    for (const omit of omits) {
        if (parentsModified.length > 0) {
            const idx = omit.parent ? parentsModified.indexOf(omit.parent) : 0;
            if (idx !== -1) {
                parentsModified[idx] = `Omit<${parentsModified[idx]}, ${omit.omits
                    .map((o) => `"${o}"`)
                    .join(' | ')}>`;
            }
        }
    }

    const addFieldMods: TSField[] = mods.filter(isAddFieldModification).map((afm) => afm.field);
    const isNamespace = wikiClass.library;
    const isHookContainer = !!wikiClass.isHookContainer;

    // transform members into ts
    let transformedFuncs: TSFunction[] = membersCopy
        .filter(isWikiFunction)
        .map(transformFunction)
        .map((f) => {
            if (isNamespace) {
                // strip parent prefix (e.g., "math." / "math:")
                const esc = wikiClass.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const prefixDot = new RegExp(`^${esc}\\.`, 'i');
                const prefixCol = new RegExp(`^${esc}:`, 'i');
                f.identifier = f.identifier.replace(prefixDot, '').replace(prefixCol, '');
            }
            if (isHookContainer) {
                f.optional = true;
            }
            return f;
        });

    const transformedFields: TSField[] = membersCopy
        .filter(isWikiStructItem)
        .map(transformStructField);

    // generic dotted grouping for namespaces (e.g. ease.InBack under math)
    const innerCollections: TSCollection[] = [...innerNamespacesFromMods];

    if (isNamespace) {
        const dottedFuncGroups = new Map<string, TSFunction[]>();
        const flatFuncs: TSFunction[] = [];

        for (const fn of transformedFuncs) {
            const m = /^([^.\s]+)\.(.+)$/.exec(fn.identifier);
            if (m) {
                const seg = m[1];
                const rest = m[2];
                const list = dottedFuncGroups.get(seg) ?? [];
                list.push({ ...fn, identifier: rest });
                dottedFuncGroups.set(seg, list);
            } else {
                flatFuncs.push(fn);
            }
        }

        // move dotted groups into inner namespaces
        for (const [seg, fns] of dottedFuncGroups) {
            innerCollections.push({
                identifier: transformIdentifier(seg),
                docComment: '',
                functions: fns,
                fields: [],
                innerCollections: [],
                namespace: true,
            });
        }

        transformedFuncs = flatFuncs;
    }

    if (isNamespace && innerCollections.length > 0) {
        transformedFuncs = transformedFuncs.filter((fn) => {
            const hasMatchingInner = innerCollections.some((ic) => ic.identifier === fn.identifier);
            const isPlaceholder = fn.args.length === 0 && fn.ret.type === 'void';
            return !(hasMatchingInner && isPlaceholder);
        });
    }

    return {
        identifier: transformIdentifier(wikiClass.name),
        docComment: transformDescription(wikiClass.description),
        fields: transformedFields.concat(addFieldMods),
        functions: transformedFuncs,
        parent: Array.from(new Set(parentsModified.filter((p) => p && p.trim()))).join(', '),
        namespace: isNamespace,
        innerCollections,
    };
}
