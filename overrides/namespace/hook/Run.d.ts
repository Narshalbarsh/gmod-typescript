declare function Run<N extends HookName>(
    eventName: N,
    ...args: HookArgsFor<N>
): HookRetFor<N> | undefined;
