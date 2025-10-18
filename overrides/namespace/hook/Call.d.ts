declare function Call<N extends HookName>(
    eventName: N,
    gamemodeTable?: any,
    ...args: HookArgsFor<N>
): HookRetFor<N> | undefined;
