declare function SortedPairs<K extends string | number, V>(
    t: LuaMap<K, V>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function SortedPairs<K extends string | number, V>(
    t: Readonly<LuaMap<K, V>>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function SortedPairs<K, V>(
    t: LuaTable<K, V>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function SortedPairs<K, V>(
    t: Readonly<LuaTable<K, V>>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function SortedPairs<K extends string | number, V>(
    t: Record<K, V> | Readonly<Record<K, V>>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, V]>>;
