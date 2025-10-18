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
import { TSCollection, TSEnum } from './ts_types';
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

    // Explicit CLASS/PANEL container pages (e.g., Label, URLLabel, TGAImage, Slider)
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
    ];
    const hookIndexPages = await Promise.all(hookIndexPaths.map(GetPage));

    // Hook member pages from "hook" category (e.g., /gmod/GM%3APlayerSpawn)
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

    const transformedClasses: TSCollection[] = classContainerPages
        .map(extractClass)
        .map((wikiClass) =>
            transformFunctionCollection(
                wikiClass,
                classFuncs.filter((cf) => cf.parent === wikiClass.name),
            ),
        );

    // Merge classes with structs sharing the same identifier
    const structById = new Map<string, TSCollection>();
    for (const s of transformedStructs) structById.set(s.identifier, s);

    const mergedClasses: TSCollection[] = transformedClasses.map((cls) => {
        const s = structById.get(cls.identifier);
        if (!s) return cls;
        const merged: TSCollection = {
            identifier: cls.identifier,
            docComment: [s.docComment, cls.docComment].filter(Boolean).join('\n\n'),
            fields: [...s.fields, ...cls.fields],
            functions: cls.functions,
            innerCollections: cls.innerCollections,
            parent: cls.parent,
            namespace: cls.namespace,
        };
        structById.delete(cls.identifier);
        return merged;
    });

    // Rename GM interface to Gamemode, expose runtime GM const
    const remapName = (id: string) => (id === 'GM' ? 'Gamemode' : id);

    const remappedClasses: TSCollection[] = mergedClasses.map((c) => ({
        ...c,
        identifier: remapName(c.identifier),
    }));

    const remainingStructs = Array.from(structById.values()).map((s) => ({
        ...s,
        identifier: remapName(s.identifier),
    }));

    // Build GMHook enum from Gamemode methods for use with things like hook.Add
    let gmHookResult = '';
    {
        const gm = remappedClasses.find((c) => c.identifier === 'Gamemode');
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

    const classResult = remappedClasses.map(printInterface).join('\n\n');
    const structResult = remainingStructs.map(printInterface).join('\n\n');

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
