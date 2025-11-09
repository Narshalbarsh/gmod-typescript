// These aren't on the wiki for some reason
VBar: DBScollBar
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
OnModified(): void;
SizeToContents(): void;
EnableHorizontal(enabled: boolean): void;
GetCanvas(): DPanel;
InsertBefore(before: Panel, insert: Panel, strLineState?: string): void;
InsertAfter(before: Panel, insert: Panel, strLineState?: string): void;
OnMouseWheeled(delta: number): any;
OnVScroll(offset: number): void;
OnChildRemoved(): void;
ScrollToChild(panel: Panel): void;
SortByMember(key: string, desc?: boolean): void;

// table-style function
DropAction: (slot: any, rcvSlot: any) => void;
