import { WikiElementKind, WikiFunctionCollection, WikiPage } from '../../wiki_types';
import { parseMarkup } from '../util';

function textOf(v: any): string {
    if (v == null) return '';
    if (Array.isArray(v)) return textOf(v[0]);
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'object' && typeof v.__text === 'string') return v.__text.trim();
    return String(v).trim();
}

export function extractClass(page: WikiPage): WikiFunctionCollection {
    const markupObj = parseMarkup(page.markup, { stopNodes: ['summary', 'description'] });

    // page titles like "PANEL Hooks", "GM Hooks", etc.
    const titleUnderscored = page.title.replace(/\s+/g, '_');
    const hookLike = /_Hooks$/i.test(titleUnderscored);

    // <type ...> ... </type>
    if (markupObj.type) {
        const classObj = markupObj.type[0];
        return {
            kind: WikiElementKind.FunctionCollection,
            name: classObj.attr.name,
            parent: classObj.attr.parent,
            description: textOf(classObj.summary),
            library: false,
            address: page.address,
            isHookContainer: false,
        };
    }

    // <panel ...> ... </panel>
    if (markupObj.panel) {
        const classObj = markupObj.panel[0];

        // parent can be in attr, or as <parent>Panel</parent>, or missing entirely
        const parentFromAttr = classObj.attr?.parent as string | undefined;
        const parentFromNode =
            typeof classObj.parent === 'string' ? classObj.parent : textOf(classObj.parent);

        const parent = parentFromAttr ?? (parentFromNode || 'Panel');

        return {
            kind: WikiElementKind.FunctionCollection,
            name: page.title.replace(/\s+/g, '_'),
            parent,
            description: textOf(classObj.description),
            library: false,
            address: page.address,
            isHookContainer: hookLike,
        };
    }

    let derived = page.title.replace(/\s+/g, '_');
    if (/_Hooks$/i.test(derived)) derived = derived.replace(/_Hooks$/i, '');

    return {
        kind: WikiElementKind.FunctionCollection,
        name: derived,
        description: '',
        library: false,
        address: page.address,
        isHookContainer: hookLike,
    };
}
