import {
    WikiFunction,
    WikiPage,
    WikiArgument,
    WikiReturn,
    WikiStructItem,
    WikiElementKind,
} from '../../wiki_types';
import { parseMarkup } from '../util';

function textOf(v: any): string {
    if (v == null) return '';
    if (Array.isArray(v)) return textOf(v[0]);
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'object') {
        // prefer explicit text payloads
        if (typeof v.__text === 'string') return v.__text.trim();
        if (typeof v.description === 'string') return v.description.trim();
        // some nodes wrap description as an array/object
        if (v.description) return textOf(v.description);
        // do not coerce arbitrary objects to string -> avoid "[object Object]"
        return '';
    }
    return String(v).trim();
}

function arr<T = any>(v: any): T[] {
    if (v == null) return [];
    return Array.isArray(v) ? (v as T[]) : [v as T];
}

function parentNameFromTitle(title: string): { parent?: string; name?: string } {
    const m = /^(.*?)[\.:](.+)$/.exec(title);
    return m ? { parent: m[1], name: m[2] } : {};
}

export function extractFunction(page: WikiPage): WikiFunction | WikiStructItem {
    const markupObj = parseMarkup(page.markup, { stopNodes: ['description', 'ret', 'arg'] });

    const fnNode = markupObj.function ? markupObj.function[0] : undefined;
    const hookNode = markupObj.hook ? markupObj.hook[0] : undefined;

    const argObjToArgument = (argObj: any) => {
        const arg = {
            description: textOf(argObj),
            ...argObj.attr,
        } as WikiArgument;

        if (!arg.name || arg.name === '') arg.name = '__unnamedArg';

        if (arg.name.includes('=')) {
            const [realName, defaultValue] = arg.name.split('=').map((s) => s.trim());
            arg.name = realName;
            arg.default = defaultValue;
        }

        return arg;
    };

    const retObjToReturn = (retObj: any) =>
        ({
            description: textOf(retObj),
            type: retObj.attr.type,
        }) as WikiReturn;

    const fromTitle = parentNameFromTitle(page.title);

    if (fnNode) {
        const args = fnNode.args ? arr(fnNode.args[0]?.arg).map(argObjToArgument) : [];
        const rets = fnNode.rets ? arr(fnNode.rets[0]?.ret).map(retObjToReturn) : [];

        // Always prefer title-derived parent/name
        const parent: string = fromTitle.parent ?? fnNode.attr.parent ?? '';
        const name: string = (fromTitle.name ?? fnNode.attr.name) as string;

        return {
            name,
            parent,
            examples: [],
            kind: WikiElementKind.Function,
            description: textOf(fnNode.description),
            realm: textOf(fnNode.realm) || 'Shared',
            args,
            rets,
            address: page.address,
        };
    }

    if (hookNode) {
        const args = hookNode.args ? arr(hookNode.args[0]?.arg).map(argObjToArgument) : [];
        const rets = hookNode.rets ? arr(hookNode.rets[0]?.ret).map(retObjToReturn) : [];

        const parent: string = fromTitle.parent ?? hookNode.attr.parent ?? '';
        const name: string = (fromTitle.name ?? hookNode.attr.name) as string;

        return {
            name,
            parent,
            examples: [],
            kind: WikiElementKind.Function,
            description: textOf(hookNode.description),
            realm: textOf(hookNode.realm) || 'Shared',
            args,
            rets,
            address: page.address,
        };
    }

    // Fallback: derive from title "Parent:Name" or "Parent.Name"
    {
        let parent = '';
        let name = '';
        if (fromTitle.parent && fromTitle.name) {
            parent = fromTitle.parent;
            name = fromTitle.name;
        } else {
            name = page.title;
        }

        const description = textOf(markupObj);

        if (description.includes('# Not a function')) {
            return {
                kind: WikiElementKind.StructItem,
                name,
                parent,
                description,
                address: page.address,
                type: 'any',
            };
        } else {
            return {
                kind: WikiElementKind.Function,
                name,
                parent,
                description,
                realm: 'Shared',
                args: [],
                examples: [],
                rets: [],
                address: page.address,
            };
        }
    }
}
