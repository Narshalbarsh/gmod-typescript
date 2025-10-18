declare function Call<N extends HookName>(
    eventName: N,
    gamemodeTable?: any,
    ...args: Parameters<NoThis<ExpectedCallback<N>>>
): ReturnType<NoThis<ExpectedCallback<N>>> | undefined;
