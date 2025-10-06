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
 * index 0 → Body Group ID 0, index 1 → Body Group ID 1, etc.
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
type _ValidatedSubModelIdsOK<S extends string> = _ValidateSubModelIdsLiteral<S> extends never
    ? never
    : S;
