import * as parser from 'fast-xml-parser';
export const xmlParserDefaultOptions: parser.X2jOptionsOptional = {
    textNodeName: '__text',
    ignoreAttributes: false,
    attributeNamePrefix: '',
    attrNodeName: 'attr',
    arrayMode: true,
};

/**
 * Set of tag names that are part of the Facepunch wiki markup schema.
 * Anything that looks like an XML tag but isn't in this set gets escaped
 * to entities so the parser doesn't choke on stray markup like `<eof>`.
 */
const KNOWN_WIKI_TAGS = new Set([
    'root',
    'function',
    'hook',
    'type',
    'panel',
    'structure',
    'enum',
    'description',
    'summary',
    'realm',
    'added',
    'args',
    'arg',
    'rets',
    'ret',
    'fields',
    'field',
    'items',
    'item',
    'page',
    'bug',
    'note',
    'warning',
    'deprecated',
    'internal',
    'example',
    'code',
    'output',
    'callback',
    'parent',
    'pagelist',
]);

export function parseMarkup(markup: string, extraOptions: parser.X2jOptionsOptional = {}) {
    // insert root because wiki pages can have multiple
    markup = `<root>${markup}</root>`;

    markup = markup
        .replace(/&/g, '&amp;')
        .replace(/ < /g, ' &lt; ')
        .replace(/<\?php/g, '&lt;?php')
        .replace(/\?>/g, '?&gt;')
        .replace(/ > /g, ' &gt; ')
        .replace(/ <= /g, ' &lt;= ')
        .replace(/ >= /g, ' &gt;= ');

    // Protect angle brackets inside attribute values (e.g. type="table<Entity>")
    // from being mistaken for unknown tags. Uses control characters as temporary
    // placeholders since they won't appear in wiki markup.
    markup = markup.replace(/="([^"]*)"/g, (_m, val: string) =>
        '="' + val.replace(/</g, '\x01').replace(/>/g, '\x02') + '"',
    );

    // Escape any <tag> or </tag> whose name isn't a recognised wiki element.
    // This prevents stray markup such as `<eof>`, `<br>`, `<div>`, etc. from
    // being interpreted as real XML elements and breaking sibling parsing.
    markup = markup.replace(
        /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)\/?>/g,
        (match, _slash: string, tag: string) => {
            if (KNOWN_WIKI_TAGS.has(tag.toLowerCase())) return match;
            return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },
    );

    // Restore angle brackets inside attribute values
    markup = markup.replace(/\x01/g, '<').replace(/\x02/g, '>');

    markup = markup.replace(/`/g, '&grave;');

    markup = markup.replace(
        /<([a-z0-9:_-]+)\s+([^>]*?)(\/?)>/gi,
        (_full, tag: string, attrs: string, selfClose: string) => {
            const fixedAttrs = attrs
                .replace(/" *,\s*/g, '" ') // commas after double-quoted values
                .replace(/' *,\s*/g, `' `) // commas after single-quoted values
                .replace(/\\\"/g, '&quot;') // escaped double quote -> entity
                .replace(/\\'/g, '&apos;'); // escaped single quote -> entity
            return `<${tag} ${fixedAttrs}${selfClose}>`;
        },
    );

    // escape placeholders like GAMEMODE:<eventName>
    markup = markup.replace(
        /\b[A-Z][A-Z0-9_]*:\s*<([A-Za-z0-9_]+)>/g,
        (_m, name) => `:&lt;${name}&gt;`,
    );

    const validation = parser.validate(markup);
    if (validation != true) {
        if (validation.err.code != 'InvalidTag') {
            throw new Error(
                `Invalid markup: \n${JSON.stringify(validation.err, undefined, 4)}\n ${markup}`,
            );
        }
    }

    const markupObj = parser.parse(markup, {
        ...xmlParserDefaultOptions,
        ...extraOptions,
    });

    return markupObj.root[0];
}
