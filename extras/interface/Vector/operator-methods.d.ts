/** a + b */ add: LuaAdditionMethod<Vector, Vector>;
/** a - b */ sub: LuaSubtractionMethod<Vector, Vector>;
/** a * (b|n) */ mul: LuaMultiplicationMethod<number | Vector, Vector>;
/** a / (b|n) */ div: LuaDivisionMethod<number | Vector, Vector>;
/** -a */ unm: LuaNegationMethod<Vector>;
