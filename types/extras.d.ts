type thread = { readonly __internal__: unique symbol };
type userdata = { readonly __internal__: unique symbol };
type sensor = { readonly __internal__: unique symbol };

declare const SERVER: boolean;
declare const CLIENT: boolean;
declare const MENU: boolean;
declare const GAMEMODE: Gamemode;
declare const GM: Gamemode;

/**
 * SubModelIds
 * A non-empty string of per-bodygroup Sub Model IDs for use with Entity:SetBodyGroups.
 * Each character is the Sub Model ID for Body Group ID at the same index:
 * index 0 -> Body Group ID 0, index 1 -> Body Group ID 1, etc.
 */
// prettier-ignore
type SubModelChar =
  | '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'
  | 'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'|'i'|'j'|'k'|'l'|'m'
  | 'n'|'o'|'p'|'q'|'r'|'s'|'t'|'u'|'v'|'w'|'x'|'y'|'z';
type _ValidateSubModelIdsLiteral<S extends string> = S extends ''
    ? never
    : S extends `${SubModelChar}${infer R}`
      ? R extends ''
          ? S
          : _ValidateSubModelIdsLiteral<R>
      : never;
type _ValidatedSubModelIdsOK<S extends string> =
    _ValidateSubModelIdsLiteral<S> extends never ? never : S;


type Equals<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

interface CustomHookMap {}
declare const enum CustomHook {}

type CustomHookKey = keyof CustomHookMap;
type CustomHookName = `${CustomHook}`;

type GMHookKey = {
    [K in keyof Gamemode]: Gamemode[K] extends (...a: any) => any ? K : never;
}[keyof Gamemode];

type GMHookName = `${GMHook}`;

type HookName =
  | keyof gameevent
  | GMHookKey | GMHookName
  | CustomHookKey | CustomHookName;

type FnFrom<T> = T extends (...a: infer P) => any ? (...a: P) => any : never;

type GMFnFromKey<K extends GMHookKey> = FnFrom<Gamemode[K]>;
type GMFnFromEnum<E extends GMHookName> = E extends keyof Gamemode ? FnFrom<Gamemode[E]> : never;

type CustomFnFromKey<K extends CustomHookKey> = FnFrom<CustomHookMap[K]>;
type CustomFnFromEnum<E extends CustomHookName> =
    E extends keyof CustomHookMap ? FnFrom<CustomHookMap[E]> : never;

type IsGameEvent<N>    = N extends keyof gameevent    ? true : false;
type IsGMKey<N>        = N extends GMHookKey          ? true : false;
type IsGMEnum<N>       = N extends GMHookName         ? true : false;
type IsCustomKey<N>    = N extends CustomHookKey      ? true : false;
type IsCustomEnum<N>   = N extends CustomHookName     ? true : false;

type When<B extends boolean, T> = B extends true ? T : never;

type ExpectedCallback<N extends HookName> =
    | When<IsGameEvent<N>,   (data: gameevent[N]) => any>
    | When<IsGMKey<N>,       GMFnFromKey<Extract<N, GMHookKey>>>
    | When<IsGMEnum<N>,      GMFnFromEnum<Extract<N, GMHookName>>>
    | When<IsCustomKey<N>,   CustomFnFromKey<Extract<N, CustomHookKey>>>
    | When<IsCustomEnum<N>,  CustomFnFromEnum<Extract<N, CustomHookName>>>;

type NoThis<T extends (...args: any) => any> = OmitThisParameter<T>;
type HookArgsFor<N extends HookName> = Parameters<NoThis<ExpectedCallback<N>>>;
type HookRetFor<N extends HookName>  = ReturnType<NoThis<ExpectedCallback<N>>>;

type Metatable<T> = {
    [K in keyof T]:
        T[K] extends (...args: infer A) => infer R
            ? (this: T, ...args: A) => R
            : T[K]
};

const color_white: Color
const color_black: Color
const color_transparent: Color

interface DCheckBoxLabel extends DPanel {
    Button: DCheckBox;
    Label: DLabel;
}
