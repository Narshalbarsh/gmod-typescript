export function transformType(type: string) {
    let t = (type || '').trim();

    // if already a TS function type, keep it as-is
    if (/^\(.*\)\s*=>\s*.+$/.test(t)) return t;

    if (/^vararg$/i.test(t)) return 'any[]';

    // number{ENUM} -> ENUM
    t = t.replace(/\bnumber\s*\{\s*([A-Za-z0-9_\.]+)\s*\}/gi, '$1');

    // Panel{T} -> T
    t = t.replace(/\bPanel\s*\{\s*([A-Za-z0-9_\.]+)\s*\}/gi, '$1');

    // table{T} -> T   (do before [] so `table{T}[]` -> `T[]`)
    t = t.replace(/\btable\s*\{\s*([A-Za-z0-9_\.]+)\s*\}/gi, '$1');

    // table<T> / table<K,V>
    t = t.replace(/\btable<\s*([^>]+)\s*>/gi, (_m, inner: string) => {
        const parts = inner.split(',').map((s) => s.trim());
        const map = (x: string) => x.replace(/^table$/i, 'any').replace(/^function$/i, 'Function');
        if (parts.length === 1) return `${map(parts[0])}[]`;
        const [k, v] = parts;
        return `Record<${map(k)}, ${map(v)}>`;
    });

    t = t.replace(/\btable\b/gi, 'any').replace(/\bfunction\b/gi, 'Function');
    t = t.replace(/ or /gi, ' | ');
    t = t.replace(/(\w) (\w)/g, '$1_$2');

    return t;
}

export function transformIdentifier(id: string) {
    if (id == 'constructor') {
        return 'constructor';
    }

    const invalidIDMap: Record<string, string> = {
        class: 'class_',
        function: 'function_',
        var: 'var_',
        default: 'default_',
        new: 'new_',
        delete: 'delete_',
    };

    if (invalidIDMap[id]) {
        return invalidIDMap[id];
    }
    if (id === '') {
        return 'MISSING_WIKI_DATA';
    }
    if (id === '...') {
        return 'vararg';
    }

    return (
        id
            ?.replace(/\./g, '')
            // https://wiki.facepunch.com/gmod/Structures/PropertyAdd StructureField (Order)
            ?.replace(/\(.*\)/g, '')
            ?.replace(/[\/ ]/g, '_')
    );
}
