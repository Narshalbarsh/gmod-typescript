import { TSTypeMap } from '../ts_types';

function doc(d?: string, indent = ''): string {
    const text = d && d.trim() ? d.replace(/\*\//g, '*\\/') : '';
    return text ? `${indent}/** ${text} */\n` : '';
}

export function printTypeMap(t: TSTypeMap): string {
    const entries = t.entries.map(e => {
        const fields = e.fields.map(f =>
            `        ${f.identifier}${f.optional ? '?' : ''}: ${f.type};`
        ).join('\n');
        return `${doc(e.docComment, '    ')}    ${e.key}: {\n${fields}\n    };`;
    }).join('\n');

    return `${doc(t.docComment)}type ${t.identifier} = {\n${entries}\n};`;
}
