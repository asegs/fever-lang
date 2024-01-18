export const TYPE_WEIGHTS = {
  ANY: 0.5,
  BASE_TUPLE: 0.75,
  NOMINAL: 1.1,
  EQUIVALENT: 1,
  GENERIC: 1,
};

export const PATTERN_WEIGHTS = {
  ANY: 0.5,
  EXPRESSION: 1,
  TYPE: 1,
  VALUE: 1.2,
};

export type FeverType = {
  baseName: string;
  types: FeverType[];
  meta: boolean;
  alias?: string;
};

export type FeverVar = {
  value: any;
  type: FeverType;
};

export function createType(
  baseName: string,
  types?: FeverType[],
  meta?: boolean,
  alias?: string,
) {
  const type = {
    baseName: baseName,
    types: [],
    meta: false,
  };

  if (types) {
    type["types"] = types;
  }

  if (meta) {
    type["meta"] = meta;
  }

  if (alias) {
    type["alias"] = alias;
  }

  return type;
}

export function createVar(value: any, type: FeverType): FeverVar {
  return {
    value: value,
    type: type,
  };
}

export const Primitives = {
  NUMBER: createType("NUMBER"),
  BOOLEAN: createType("BOOLEAN"),
  CHARACTER: createType("CHARACTER"),
  ANY: createType("ANY"),
  VOID: createType("VOID"),
  EXPRESSION: createType("EXPRESSION"),
  TYPE: createType("TYPE"),
  ERROR: createType("ERROR"),
  VARIABLE: createType("VARIABLE"),
};

export function createTypeVar(type: FeverType): FeverVar {
  return createVar(type, Primitives.TYPE);
}

export function createTypedList(ofType: FeverType, name?: string): FeverType {
  return createType("LIST", [ofType], true, name);
}

export function createTypedTuple(types: FeverType[], name?: string): FeverType {
  return createType("TUPLE", types, true, name);
}

export function createGeneric(type: FeverType, name: string): any {
  return { ...type, generic: name };
}

export function createError(message: string): FeverVar {
  return createVar(message, Primitives.ERROR);
}

export function createPattern(condition: FeverVar, type: FeverType): FeverVar {
  return createVar([condition, type], Meta.PATTERN);
}

export function createList(items: FeverVar[], type?: FeverType): FeverVar {
  return createVar(items, type ? createTypedList(type) : Meta.LIST);
}

export function createTuple(items: FeverVar[]): FeverVar {
  return createVar(items, createTypedTuple(items.map((i) => i.type)));
}

export function createCall(name: string, args: FeverVar[]): FeverVar {
  return createVar(
    createTuple([createVar(name, Primitives.VARIABLE), createTuple(args)]),
    Meta.CALL,
  );
}

export function getFunctionNameAndArgs(call: FeverVar): [string, FeverVar[]] {
  return [call.value.value[0].value, call.value.value[1].value];
}

export function createCondition(
  name: FeverVar,
  expr: FeverVar,
  specificity: FeverVar,
): FeverVar {
  return createVar([name, expr, specificity], Meta.CONDITION);
}

const STRING = createTypedList(Primitives.CHARACTER, "STRING");
const CONDITION = createTypedTuple(
  [STRING, Primitives.EXPRESSION, Primitives.NUMBER],
  "CONDITION",
);
const PATTERN = createTypedTuple([CONDITION, Primitives.TYPE], "PATTERN");
const SIGNATURE = createTypedList(PATTERN, "SIGNATURE");
const CASE = createTypedTuple([SIGNATURE, Primitives.EXPRESSION], "CASE");
//These also have a special invocations property!
const FUNCTION = createTypedList(CASE, "FUNCTION");
const DEFAULT_TUPLE = createTypedTuple([]);

export const Meta = {
  CONDITION: CONDITION,
  PATTERN: PATTERN,
  SIGNATURE: SIGNATURE,
  LIST: createTypedList(Primitives.ANY),
  STRING: STRING,
  CASE: CASE,
  FUNCTION: FUNCTION,
  TUPLE: DEFAULT_TUPLE,
  CALL: createTypedTuple([Primitives.VARIABLE, DEFAULT_TUPLE], "CALL"),
};

export function feverStringFromJsString(jsString: string): FeverVar {
  return createVar(
    jsString.split("").map((char) => createVar(char, Primitives.CHARACTER)),
    Meta.STRING,
  );
}
