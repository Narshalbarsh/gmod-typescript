declare function pairs<T>(
    t: readonly T[]
): LuaIterable<LuaMultiReturn<[number, T]>>;

declare function pairs<K extends string | number, V>(
    t: LuaMap<K, V>
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function pairs<K extends string | number, V>(
    t: Readonly<LuaMap<K, V>>
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function pairs<K, V>(
    t: LuaTable<K, V>
): LuaIterable<LuaMultiReturn<[K, NonNullable<V>]>>;

declare function pairs<T extends object>(
    t: T
): LuaIterable<LuaMultiReturn<
    [Extract<keyof T, string | number>, T[Extract<keyof T, string | number>]]
>>;
