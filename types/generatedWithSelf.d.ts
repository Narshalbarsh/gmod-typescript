/// <reference types="typescript-to-lua/language-extensions" />

/// <reference path="./extras.d.ts" />

/// <reference path="./generated.d.ts" />

/**
 * The hook library allows you to add hooks called by the game engine, allowing multiple scripts to modify game function.
 */
declare namespace hook {


    /**
     * 🟨🟦🟩 [Shared and Menu]
     *
     * Registers a function (or "callback") with the [Hook](https://wiki.facepunch.com/gmod/Hook) system so that it will be called automatically whenever a specific event (or "hook") occurs.
     * @param eventName - The event to hook on to. This can be any <page text="GM">GM_Hooks</page> hook, gameevent after using [gameevent.Listen](https://wiki.facepunch.com/gmod/gameevent.Listen), or custom hook run with [hook.Call](https://wiki.facepunch.com/gmod/hook.Call) or [hook.Run](https://wiki.facepunch.com/gmod/hook.Run).
     * @param identifier - The unique identifier, usually a string. This can be used elsewhere in the code to replace or remove the hook. The identifier **should** be unique so that you do not accidentally override some other mods hook, unless that's what you are trying to do.
     * 			The identifier can be either a [string](https://wiki.facepunch.com/gmod/string), or a [table](https://wiki.facepunch.com/gmod/table)/object with an IsValid function defined such as an [Entity](https://wiki.facepunch.com/gmod/Entity) or [Panel](https://wiki.facepunch.com/gmod/Panel). [number](https://wiki.facepunch.com/gmod/number)s and [boolean](https://wiki.facepunch.com/gmod/boolean)s, for example, are not allowed.
     * 			If the identifier is a table/object, it will be inserted in front of the other arguments in the callback and the hook will be called as long as it's valid. However, if IsValid( identifier ) returns false when **any** eventName hook is called, the hook will be removed.
     * @param func - The function to be called, arguments given to it depend on the identifier used.
     * **Warning:**
     * >Returning any value besides nil from the hook's function will stop other hooks of the same event down the loop from being executed. Only return a value when absolutely necessary and when you know what you are doing.
     * 				It will also prevent the associated `GM:*` hook from being called on the gamemode.
     * 				It WILL break other addons.
     */
    /* Manual override from: namespace/hook/Add */
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

    /**
     * 🟨🟦🟩 [Shared and Menu]
     *
     * Calls all hooks associated with the given event until one returns something other than `nil`, and then returns that data.
     *
     * In almost all cases, you should use [hook.Run](https://wiki.facepunch.com/gmod/hook.Run) instead - it calls hook.Call internally but supplies the gamemode table by itself, making your code neater.
     * @param eventName - The event to call hooks for.
     * @param [gamemodeTable = nil] - If the gamemode is specified, the gamemode hook within will be called, otherwise not.
     * @param [args = nil] - The arguments to be passed to the hooks.
     */
    /* Manual override from: namespace/hook/Call */
    declare function Call<N extends HookName>(
        eventName: N,
        gamemodeTable?: any,
        ...args: Parameters<NoThis<ExpectedCallback<N>>>
    ): ReturnType<NoThis<ExpectedCallback<N>>> | undefined;

    /**
     * 🟨🟦🟩 [Shared and Menu]
     *
     * Returns a list of all the hooks registered with [hook.Add](https://wiki.facepunch.com/gmod/hook.Add).
     */
    function GetTable(): any;

    /**
     * 🟨🟦🟩 [Shared and Menu]
     *
     * Removes the hook with the supplied identifier from the given event.
     * @param eventName - The event name.
     * @param identifier - The unique identifier of the hook to remove, usually a string.
     */
    function Remove(eventName: string, identifier: any): void;

    /**
     * 🟨🟦🟩 [Shared and Menu]
     *
     * Calls all hooks associated with the given event **until** one returns something other than `nil` and then returns that data. If no hook returns any data, it will try to call the `:<eventName>` alternative, if one exists.
     *
     * This function internally calls [hook.Call](https://wiki.facepunch.com/gmod/hook.Call).
     *
     * See also: [gamemode.Call](https://wiki.facepunch.com/gmod/gamemode.Call) - same as this, but does not call hooks if the gamemode hasn't defined the function.
     * @param eventName - The event to call hooks for.
     * @param args - The arguments to be passed to the hooks.
     */
    /* Manual override from: namespace/hook/Run */
    declare function Run<N extends HookName>(
        eventName: N,
        ...args: Parameters<NoThis<ExpectedCallback<N>>>
    ): ReturnType<NoThis<ExpectedCallback<N>>> | undefined;

}
