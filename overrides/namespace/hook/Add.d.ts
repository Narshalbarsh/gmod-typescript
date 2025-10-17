declare function Add<
    N extends HookName,
    F extends (...args: any) => any = ExpectedCallback<N>
>(
    name: N,
    id: string,
    cb: F & (Equals<Parameters<F>, Parameters<ExpectedCallback<N>>> extends true ? unknown : never)
): any;
