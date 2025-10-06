import * as parser from 'fast-xml-parser';

export const xmlParserDefaultOptions: parser.X2jOptionsOptional = {
    textNodeName: '__text',
    ignoreAttributes: false,
    attributeNamePrefix: '',
    attrNodeName: 'attr',
    arrayMode: true,
};

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
        .replace(/ >= /g, ' &gt;= ')
        .replace(/`/g, '&grave;');

    markup = markup.replace(
        /<([a-z0-9:_-]+)\s+([^>]*?)(\/?)>/gi,
        (_full, tag: string, attrs: string, selfClose: string) => {
            const fixedAttrs = attrs
                .replace(/" *,\s*/g, '" ') // commas after double-quoted values
                .replace(/' *,\s*/g, `' `) // commas after single-quoted values
                .replace(/\\\"/g, '&quot;') // escaped double quote -> entity
                .replace(/\\'/g, '&apos;'); // escaped single quote -> entity
            return `<${tag} ${fixedAttrs}${selfClose}>`;
        }
    );

    // escape placeholders like GAMEMODE:<eventName>
    markup = markup.replace(
        /\b[A-Z][A-Z0-9_]*:\s*<([A-Za-z0-9_]+)>/g,
        (_m, name) => `:&lt;${name}&gt;`
    );

    const validation = parser.validate(markup);
    if (validation != true) {
        if (validation.err.code != 'InvalidTag') {
            throw new Error(
                `Invalid markup: \n${JSON.stringify(validation.err, undefined, 4)}\n ${markup}`
            );
        }
    }

    const markupObj = parser.parse(markup, {
        ...xmlParserDefaultOptions,
        ...extraOptions,
    });

    return markupObj.root[0];
}
