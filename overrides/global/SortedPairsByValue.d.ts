declare function SortedPairsByValue<V>(
    t: readonly V[],
    desc?: boolean
): LuaIterable<LuaMultiReturn<[number, V]>>;

declare function SortedPairsByValue<K extends string | number, V>(
    t: LuaMap<K, V> | Readonly<LuaMap<K, V>>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function SortedPairsByValue<K, V>(
    t: LuaTable<K, V> | Readonly<LuaTable<K, V>>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function SortedPairsByValue<K extends string | number, V>(
    t: Record<K, V> | Readonly<Record<K, V>>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, V]>>;
