import { TSEnum, TSEnumField } from '../ts_types';
import { indentStr, printDocComent } from './util';

export function printEnum(tsEnum: TSEnum): string {
    const doc = tsEnum.docComment + (tsEnum.compileMembersOnly ? '\n@compileMembersOnly' : '');
    // `const` is what makes TSTL inline a member to its literal value.
    // Without it a @compileMembersOnly member emits as a bare global,
    // which is nil for an enum that only exists on the wiki
    const constKw = tsEnum.compileMembersOnly ? 'const ' : '';
    return `
${printDocComent(doc)}
declare ${constKw}enum ${tsEnum.identifier} {
${indentStr(tsEnum.fields.filter(hasIdentifier(tsEnum)).map(printEnumField).join('\n\n'), '    ')}
}
`.trim();
}

// SCREENFADE has an item with an empty key, its "no flag" entry, that cannot become a member
function hasIdentifier(tsEnum: TSEnum) {
    return (field: TSEnumField): boolean => {
        if (field.identifier && field.identifier !== 'undefined') return true;
        console.warn(
            `enum ${tsEnum.identifier}: skipping item with empty key (value ${field.value})`
        );
        return false;
    };
}

export function printEnumField(tsEnumField: TSEnumField) {
    return `
${printDocComent(tsEnumField.docComment)}
${tsEnumField.identifier} = ${tsEnumField.value},
`.trim();
}
