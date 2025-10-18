declare function Add<
  N extends HookName,
  A extends any[] = HookArgsFor<N>
>(
  name: N,
  id: string,
  cb: ((...args: A) => any) &
      (Equals<A, HookArgsFor<N>> extends true ? unknown : never)
): any;
