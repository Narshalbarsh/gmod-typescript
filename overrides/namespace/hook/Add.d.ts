declare function Add<
    N extends HookName,
    F extends (...args: any) => any = ExpectedCallback<N>
>(
    name: N,
    id: string,
    cb: NoThis<F> &
        (Equals<Parameters<NoThis<F>>, Parameters<ExpectedCallback<N>>> extends true
            ? unknown
            : never)
): any;
