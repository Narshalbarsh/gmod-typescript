interface thread { readonly __internal__: unique symbol }
interface userdata { readonly __internal__: unique symbol }
interface sensor { readonly __internal__: unique symbol }

declare const SERVER: boolean;
declare const CLIENT: boolean;
declare const MENU: boolean;
declare const GAMEMODE: Gamemode;
declare const GM: Gamemode;
declare const ENT: ENTITY;
// The wiki uses the value names GM and ENT as types in a few places, table{GM}, table{ENT}
type GM = Gamemode;
type ENT = ENTITY;

/**
 * GMod's Error global, the non-halting one, see the Global.Error wiki page.
 * NEVER call plain Error(...) from TS expecting the GMod global,
 * TSTL compiles any Error call to its own lualib class no matter what is declared,
 * so Global.Error is skipped in modifications.json and this renamed declaration is the way to reach it
 * @customName Error
 * @noSelf
 */
declare function GmodError(...args: any[]): void;

// The invalid entity, what the engine returns when it has nothing, player.GetByID for example,
// and what it wants where an Entity means "none", Player:SetActiveWeapon(NULL).
// Not the same thing as nil or undefined, it is an Entity object that fails IsValid.
// Branded so a `Player | NULL` has to go through IsValid before it can be used as a Player
interface NULL extends Entity {
    readonly __nullEntity: unique symbol;
}
declare const NULL: NULL;

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
    | When<IsGameEvent<N>,   (data: gameevent[Extract<N, keyof gameevent>]) => any>
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

declare const color_white: Color;
declare const color_black: Color;
declare const color_transparent: Color;

// TODO: replace this stub once the wiki has a CtrlColor page, ControlPanel:ColorPicker links one that does not exist
interface CtrlColor extends DPanel {}

interface DCheckBoxLabel extends DPanel {
    Button: DCheckBox;
    Label: DLabel;
}

type PanelDef<T> = {
    [K in keyof T]?: NonNullable<T[K]> extends (this: any, ...args: infer A) => infer R
        ? (this: T, ...args: A) => R
        : T[K];
};

// What scripted_ents.Register takes, every ENT field and hook optional.
// Pass your own subtype as T and the hooks get it as `this`
type EntityDef<T extends ENTITY = ENTITY> = {
    [K in keyof T]?: NonNullable<T[K]> extends (this: any, ...args: infer A) => infer R
        ? (this: T, ...args: A) => R
        : T[K];
};

// same as EntityDef, for weapons.Register
type SWEPDef<T extends SWEP = SWEP> = {
    [K in keyof T]?: NonNullable<T[K]> extends (this: any, ...args: infer A) => infer R
        ? (this: T, ...args: A) => R
        : T[K];
};

interface LuaErrorStackEntry {
    /** The file path where the error occurred, or `[C]` for C functions. */
    File: string;
    /** The function name, or an empty string if unavailable. */
    Function: string;
    /** The line number, or `-1` for C functions. */
    Line: number;
}
