declare function Add<
    N extends keyof gameevent | GMHookKey | GMHook,
    Expected extends (...args: any) => any =
        N extends keyof gameevent
            ? (data: gameevent[N]) => any
            : Gamemode[N extends GMHook ? `${N}` : Extract<N, GMHookKey>],
    F extends (...args: any) => any = Expected
>(
    name: N,
    id: string,
    cb: F & (Equals<Parameters<F>, Parameters<Expected>> extends true ? unknown : never)
): void;
