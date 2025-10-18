declare function Run<N extends HookName>(
    eventName: N,
    ...args: Parameters<NoThis<ExpectedCallback<N>>>
): ReturnType<NoThis<ExpectedCallback<N>>> | undefined;
