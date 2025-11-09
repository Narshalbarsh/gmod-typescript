declare function ipairs<T>(
    t: readonly T[]
): LuaIterable<LuaMultiReturn<[number, T]>>;

declare function ipairs<V>(
    t: LuaTable<number, V> | Readonly<LuaTable<number, V>>
): LuaIterable<LuaMultiReturn<[number, V]>>;
