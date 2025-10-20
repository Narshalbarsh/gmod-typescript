declare function SortedPairsByValue<V>(
    t: readonly V[],
    desc?: boolean
): LuaIterable<LuaMultiReturn<[number, V]>>;

declare function SortedPairsByValue<K extends string | number, V>(
    t: LuaTable<K, V>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, V]>>;

declare function SortedPairsByValue<K extends string | number, V>(
    t: Record<K, V>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, V]>>;
