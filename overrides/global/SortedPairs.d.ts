declare function SortedPairs<K extends string | number, V>(
    t: LuaTable<K, V> | Record<K, V>,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, V]>>;
