import { printGlobalFunction } from './printer/function';
import { extractEnum } from './scrapper/extract/enum';
import { extractFunction } from './scrapper/extract/function';
import { extractStruct } from './scrapper/extract/struct';
import { GetPage, GetPagesInCategory } from './scrapper/scrapper';
import { transformFunction } from './transformer/function';
import * as fs from 'fs';
import { transformEnum } from './transformer/enum';
import { printEnum } from './printer/enum';
import { transformStruct } from './transformer/struct';
import { printInterface } from './printer/interface';
import { transformFunctionCollection } from './transformer/function_collection';
import { extractClass } from './scrapper/extract/class';
import { extractLibrary } from './scrapper/extract/library';
import { isWikiFunction } from './wiki_types';
import { TSCollection, TSEnum, TSField, TSFunction } from './ts_types';
import { fetchGameEventTypeMap } from './scrapper/extract/gameevent';
import { printTypeMap } from './printer/typemap';
import { transformIdentifier } from './transformer/util';

(async (): Promise<void> => {
    const globalFuncs = await GetPagesInCategory('Global');
    const globalFunctionPages = await Promise.all(globalFuncs.map(GetPage));
    const globalFunctionResult = globalFunctionPages
        .map(extractFunction)
        .filter(isWikiFunction)
        .map(transformFunction)
        .map(printGlobalFunction)
        .join('\n\n');

    const enums = await GetPagesInCategory('enum');
    const enumPages = await Promise.all(enums.map(GetPage));
    const enumResult = enumPages.map(extractEnum).map(transformEnum).map(printEnum).join('\n\n');

    const structs = await GetPagesInCategory('struct');
    const structPages = await Promise.all(structs.map(GetPage));
    const transformedStructs: TSCollection[] = structPages.map(extractStruct).map(transformStruct);

    const classFuncPaths = [
        ...(await GetPagesInCategory('classfunc')),
        ...(await GetPagesInCategory('panelfunc')),
    ];

    const panelClassPaths = await GetPagesInCategory('panel');
    const classTypePaths = await GetPagesInCategory('class');
    const containerPaths = Array.from(new Set([...panelClassPaths, ...classTypePaths]));

    const hookIndexPaths = [
        '/gmod/GM_Hooks',
        '/gmod/ENTITY_Hooks',
        '/gmod/WEAPON_Hooks',
        '/gmod/TOOL_Hooks',
        '/gmod/EFFECT_Hooks',
        '/gmod/PLAYER_Hooks',
        '/gmod/SANDBOX_Hooks',
        '/gmod/PANEL_Hooks',
    ];
    const hookIndexPages = await Promise.all(hookIndexPaths.map(GetPage));

    const hookPathsAll = await GetPagesInCategory('hook');
    const hookMemberPaths = hookPathsAll.filter(
        (p) => /\/gmod\/[A-Z]+%3A/.test(p) || /[A-Z]+:/.test(p),
    );

    const allFuncPaths = Array.from(new Set([...classFuncPaths, ...hookMemberPaths]));
    const classFuncsPages = await Promise.all(allFuncPaths.map(GetPage));

    const explicitContainerPages = await Promise.all(containerPaths.map(GetPage));
    const classContainerPages = Array.from(
        new Set([
            ...explicitContainerPages,
            ...classFuncsPages.filter((p) => !p.title.includes(':') && !p.title.includes('.')),
            ...hookIndexPages,
        ]),
    );

    const classFuncs = classFuncsPages
        .filter((p) => p.title.includes(':') || p.title.includes('.'))
        .map(extractFunction);

    const transformedClassesRaw: TSCollection[] = classContainerPages
        .map(extractClass)
        .map((wikiClass) =>
            transformFunctionCollection(
                wikiClass,
                classFuncs.filter((cf) => cf.parent === wikiClass.name),
            ),
        );

    function aliasName(id: string): string {
        if (id === 'GM') return 'Gamemode';
        if (id === 'PANEL') return 'Panel';
        if (id === 'ENT') return 'ENTITY';
        if (id === 'WEAPON') return 'Weapon';
        return id;
    }

    function mergeParents(a?: string, b?: string): string | undefined {
        const parts = [
            ...(a ? a.split(',').map((s) => s.trim()).filter(Boolean) : []),
            ...(b ? b.split(',').map((s) => s.trim()).filter(Boolean) : []),
        ];
        const unique = Array.from(new Set(parts));
        return unique.length ? unique.join(', ') : undefined;
    }

    function dedupeFields(lists: TSField[][]): TSField[] {
        const map = new Map<string, TSField>();
        for (const arr of lists) {
            for (const fld of arr) {
                const prev = map.get(fld.identifier);
                if (!prev) {
                    map.set(fld.identifier, { ...fld });
                } else {
                    if (fld.optional && !prev.optional) prev.optional = true;
                    if (fld.docComment && prev.docComment && fld.docComment !== prev.docComment) {
                        prev.docComment = `${prev.docComment}\n\n${fld.docComment}`;
                    } else if (!prev.docComment && fld.docComment) {
                        prev.docComment = fld.docComment;
                    }
                }
            }
        }
        return Array.from(map.values());
    }

    function dedupeFunctions(lists: TSFunction[][]): TSFunction[] {
        const map = new Map<string, TSFunction>();
        for (const arr of lists) {
            for (const fn of arr) {
                const prev = map.get(fn.identifier);
                if (!prev) {
                    map.set(fn.identifier, { ...fn });
                } else {
                    if (fn.optional && !prev.optional) prev.optional = true;
                    if (fn.docComment && prev.docComment && fn.docComment !== prev.docComment) {
                        prev.docComment = `${prev.docComment}\n\n${fn.docComment}`;
                    } else if (!prev.docComment && fn.docComment) {
                        prev.docComment = fn.docComment;
                    }
                }
            }
        }
        return Array.from(map.values());
    }

    function mergeCollections(a: TSCollection, b: TSCollection): TSCollection {
        return {
            identifier: a.identifier,
            docComment: [a.docComment, b.docComment].filter(Boolean).join('\n\n'),
            fields: dedupeFields([a.fields, b.fields]),
            functions: dedupeFunctions([a.functions, b.functions]),
            innerCollections: [...a.innerCollections, ...b.innerCollections],
            parent: mergeParents(a.parent, b.parent),
            namespace: a.namespace || b.namespace,
        };
    }

    function cleanupSelfParent(c: TSCollection): TSCollection {
        if (!c.parent) return c;
        const uniqueParents = Array.from(
            new Set(
                c.parent
                    .split(',')
                    .map((p) => p.trim())
                    .filter((p) => p && p !== c.identifier),
            ),
        );
        return {
            ...c,
            parent: uniqueParents.length ? uniqueParents.join(', ') : undefined,
        };
    }

    const aliasGroupedClasses = new Map<string, TSCollection>();
    for (const cls of transformedClassesRaw) {
        const key = aliasName(cls.identifier);
        const normalized: TSCollection = { ...cls, identifier: key };

        const prev = aliasGroupedClasses.get(key);
        if (!prev) {
            aliasGroupedClasses.set(key, normalized);
        } else {
            aliasGroupedClasses.set(key, mergeCollections(prev, normalized));
        }
    }

    const structById = new Map<string, TSCollection>();
    for (const s of transformedStructs) {
        const key = aliasName(s.identifier);
        structById.set(key, { ...s, identifier: key });
    }

    const mergedClassesWithStructs: TSCollection[] = [];
    for (const [key, cls] of aliasGroupedClasses.entries()) {
        const maybeStruct = structById.get(key);
        if (!maybeStruct) {
            mergedClassesWithStructs.push(cls);
        } else {
            const merged: TSCollection = {
                identifier: cls.identifier,
                docComment: [maybeStruct.docComment, cls.docComment].filter(Boolean).join('\n\n'),
                fields: dedupeFields([maybeStruct.fields, cls.fields]),
                functions: cls.functions,
                innerCollections: [...cls.innerCollections, ...maybeStruct.innerCollections],
                parent: cls.parent,
                namespace: cls.namespace,
            };
            mergedClassesWithStructs.push(merged);
            structById.delete(key);
        }
    }

    const remainingStructs: TSCollection[] = Array.from(structById.values());

    const cleanedClasses: TSCollection[] = mergedClassesWithStructs.map(cleanupSelfParent);

    let gmHookResult = '';
    {
        const gm = cleanedClasses.find((c) => c.identifier === 'Gamemode');
        if (gm) {
            const seen = new Set<string>();
            const fields = gm.functions
                .map((f) => f.identifier.trim())
                .filter((n) => n.length > 0 && !seen.has(n) && (seen.add(n), true))
                .map((name) => ({
                    identifier: transformIdentifier(name),
                    docComment: '',
                    value: JSON.stringify(name),
                }));

            const gmHookEnum: TSEnum = {
                identifier: 'GMHook',
                docComment: '',
                fields,
                compileMembersOnly: true,
            };

            gmHookResult = printEnum(gmHookEnum);
        }
    }

    const libraryFuncPaths = await GetPagesInCategory('libraryfunc');
    const libraryFuncPages = await Promise.all(libraryFuncPaths.map(GetPage));
    const libraryFuncs = libraryFuncPages.filter((p) => p.title.includes('.')).map(extractFunction);
    const libraries = libraryFuncPages.filter((p) => !p.title.includes('.')).map(extractLibrary);

    const libraryResult = libraries
        .map((wikiLibrary) =>
            transformFunctionCollection(
                wikiLibrary,
                libraryFuncs.filter((cf) => cf.parent === wikiLibrary.name),
            ),
        )
        .map(printInterface)
        .join('\n\n');

    const gameeventTypeMap = await fetchGameEventTypeMap();
    const gameeventResult = printTypeMap(gameeventTypeMap);

    const classResult = cleanedClasses.map(printInterface).join('\n\n');
    const structResult = remainingStructs.map(printInterface).join('\n\n');

    const result = [
        '/// <reference types="typescript-to-lua/language-extensions" />',
        '/// <reference path="./extras.d.ts" />',
        '/** @noSelfInFile **/',
        classResult,
        structResult,
        enumResult,
        gmHookResult,
        gameeventResult,
        globalFunctionResult,
        libraryResult,
    ].join('\n\n');

    const cleaned =
        result
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+$/gm, '')
            .trimEnd() + '\n';

    fs.writeFileSync('types/generated.d.ts', cleaned);
})();
