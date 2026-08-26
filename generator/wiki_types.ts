export enum WikiElementKind {
    Page,
    Element,
    PageLink,
    Example,
    Function,
    Argument,
    Return,
    Enum,
    EnumItem,
    Struct,
    StructItem,
    FunctionCollection,
}

export interface WikiElement {
    kind: WikiElementKind;
}

export interface WikiPage extends WikiElement {
    kind: WikiElementKind.Page;
    title: string;
    // without the /gmod/ prefix, Panel:SetContentAlignment, Enums/NavDir
    address: string;
    markup: string;
    revisionId: number;
    updateCount: number;
    // only on pages fetched live from the wiki API, the local mirror does not keep them
    wikiName?: string;
    wikiIcon?: string;
    wikiUrl?: string;
    createdTime?: Date;
    html?: string;
    footer?: string;
    pageLinks?: WikiPageLink[];
}

export interface WikiAddressable {
    address: string;
}

export interface WikiPageLink extends WikiElement {
    kind: WikiElementKind.PageLink;
    url: string;
    label: string;
    icon: string;
    description: string;
}

export interface WikiExample extends WikiElement {
    kind: WikiElementKind.Example;
    description: string;
    code: string;
    output: boolean;
}

export interface WikiFunction extends WikiAddressable, WikiElement {
    kind: WikiElementKind.Function;
    name: string;
    parent: string;
    description: string;
    realm: string;
    args: WikiArgument[];
    examples: WikiExample[];
    rets: WikiReturn[];
}

export function isWikiFunction(e: WikiElement): e is WikiFunction {
    return e.kind === WikiElementKind.Function;
}

export interface WikiArgument extends WikiElement {
    kind: WikiElementKind.Argument;
    description: string;
    name: string;
    type: string;
    /**
     * Optional secondary type the argument also accepts (Facepunch wiki `alttype`
     * attribute). e.g. Player:GiveAmmo's `type` arg is `string` with `alttype="number"`.
     */
    alttype?: string;
    default?: string;
}

export interface WikiReturn extends WikiElement {
    kind: WikiElementKind.Return;
    description: string;
    type: string;
    /** Optional secondary return type (Facepunch wiki `alttype` attribute). */
    alttype?: string;
}

export interface WikiEnum extends WikiAddressable, WikiElement {
    kind: WikiElementKind.Enum;
    name: string;
    description: string;
    realm: string;
    items: WikiEnumItem[];
}

export interface WikiEnumItem {
    description: string;
    key: string;
    value: string;
}

export interface WikiStruct extends WikiAddressable, WikiElement {
    kind: WikiElementKind.Struct;
    name: string;
    description: string;
    realm: string;
    items: WikiStructItem[];
}

export interface WikiStructItem extends WikiAddressable, WikiElement {
    kind: WikiElementKind.StructItem;
    description: string;
    parent: string;
    name: string;
    type: string;
    /** Optional secondary type the field also accepts (Facepunch wiki `alttype` attribute). */
    alttype?: string;
    default?: string;
}

export function isWikiStructItem(e: WikiElement): e is WikiStructItem {
    return e.kind === WikiElementKind.StructItem;
}

export interface WikiFunctionCollection extends WikiAddressable, WikiElement {
    kind: WikiElementKind.FunctionCollection;
    name: string;
    description: string;
    parent?: string;
    library: boolean;
    isHookContainer?: boolean;
}
