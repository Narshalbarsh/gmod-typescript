import { TSEnum, TSEnumField } from '../ts_types';
import { indentStr, printDocComent } from './util';

export function printEnum(tsEnum: TSEnum): string {
    const doc = tsEnum.docComment + (tsEnum.compileMembersOnly ? '\n@compileMembersOnly' : '');
    const constKw = tsEnum.compileMembersOnly ? 'const ' : '';
    // TODO is const actually correct here?
    return `
${printDocComent(doc)}
declare ${constKw}enum ${tsEnum.identifier} {
${indentStr(tsEnum.fields.map(printEnumField).join('\n\n'), '    ')}
}
`.trim();
}

export function printEnumField(tsEnumField: TSEnumField) {
    return `
${printDocComent(tsEnumField.docComment)}
${tsEnumField.identifier} = ${tsEnumField.value},
`.trim();
}
