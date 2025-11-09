/** True while the button is held down. Used by skins and IsDown(). */
Depressed?: boolean;

/** Internal selected state read by UpdateColours. Prefer SetSelected/IsSelected. */
m_bSelected?: boolean;

/** Image child created by SetImage/SetMaterial. */
m_Image?: DImage;

/** Click callback; commonly overridden or assigned. */
DoClick?: (this: DButton, val?: any) => void;
