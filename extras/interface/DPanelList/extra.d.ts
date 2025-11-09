// These aren't on the wiki for some reason
VBar: DVScrollBar;
pnlCanvas: DPanel;
Items: Panel[];

// AccessorFunc-generated
GetAutoSize(): boolean;
GetStretchHorizontally(): boolean;
SetStretchHorizontally(v: boolean): void;
GetNoSizing(): boolean;
SetNoSizing(v: boolean): void;
GetSortable(): boolean;
SetSortable(v: boolean): void;
GetAnimTime(): number;
SetAnimTime(seconds: number): void;
GetAnimEase(): number;
SetAnimEase(ease: number): void;
GetDraggableName(): string;
SetDraggableName(name: string): void;

// methods
EnableHorizontal(enabled: boolean): void;
GetCanvas(): DPanel;
InsertAfter(before: Panel, insert: Panel, strLineState?: string): void;
InsertBefore(before: Panel, insert: Panel, strLineState?: string): void;
OnChildRemoved(): void;
OnModified(): void;
OnMouseWheeled(delta: number): any;
OnVScroll(offset: number): void;
RemoveItem(pnl: Panel, dontDelete?: boolean): void;
ScrollToChild(panel: Panel): void;
SizeToContents(): void;
SortByMember(key: string, desc?: boolean): void;

// table-style function
DropAction: (slot: any, rcvSlot: any) => void;
