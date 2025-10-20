declare function SortedPairsByMemberValue<
    V extends object,
    M extends keyof V
>(
    t: readonly V[] | V[],
    memberKey: M,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[number, V]>>;

declare function SortedPairsByMemberValue<
    K,
    V extends object,
    M extends keyof V
>(
    t: LuaTable<K, V>,
    memberKey: M,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, V]>>;

declare function SortedPairsByMemberValue<
    K extends string | number,
    V extends object,
    M extends keyof V
>(
    t: Record<K, V>,
    memberKey: M,
    desc?: boolean
): LuaIterable<LuaMultiReturn<[K, V]>>;
