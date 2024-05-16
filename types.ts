export enum TypeWeights {
  ANY = 0.5,
  BASE_TUPLE = 0.75,
  NOMINAL = 1.1,
  EQUIVALENT = 1,
  GENERIC = 1,
}

export enum PatternWeights {
  ANY = 0.5,
  EXPRESSION = 1,
  TYPE = 1,
  VALUE = 1.2,
}

export type FeverType = {
  baseName: string;
  types: FeverType[];
  meta: boolean;
  alias?: string;
  generic?: string;
};

export type FeverVar = {
  value: any;
  type: FeverType;
  invocations?: FeverVar[];
  types?: FeverType[];
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

export const Shorthands = {
  "#": Primitives.NUMBER,
  fn: Meta.FUNCTION,
};

export function feverStringFromJsString(jsString: string): FeverVar {
  return createVar(
    jsString.split("").map((char) => createVar(char, Primitives.CHARACTER)),
    Meta.STRING,
  );
}

export function isAlias(t: FeverType): boolean {
  return "alias" in t;
}

export function isGeneric(t: FeverType): boolean {
  return "generic" in t;
}

function weightedAnyType(depth: number): number {
  return (TypeWeights.ANY + TypeWeights.EQUIVALENT * depth) / (depth + 1);
}

export const typeSatisfaction = (
  child: FeverType,
  parent: FeverType,
  genericTable: { [key: string]: FeverType },
  depth: number,
  actualChild: FeverVar,
) => {
  if (parent.baseName === "ANY") {
    if (isGeneric(parent)) {
      //We are either matching against a known type
      if (parent.generic in genericTable) {
        return typeSatisfaction(
          child,
          genericTable[parent.generic],
          genericTable,
          depth,
          actualChild,
        );
      }

      //Or we just encountered some generic for the first time
      genericTable[parent.generic] = child;
      return [TypeWeights.GENERIC, genericTable];
    }

    return [weightedAnyType(depth), genericTable];
  }

  if (isAlias(parent)) {
    if (isAlias(child)) {
      if (child["alias"] === parent["alias"]) {
        return [TypeWeights.NOMINAL, genericTable];
      }
    }
    return [0, genericTable];
  }

  if (!child.meta && !parent.meta) {
    return [
      child.baseName === parent.baseName ? TypeWeights.NOMINAL : 0,
      genericTable,
    ];
  }

  if (child.types.length !== parent.types.length) {
    return [
      parent.baseName === "TUPLE" && parent.types.length === 0
        ? TypeWeights.BASE_TUPLE
        : 0,
      genericTable,
    ];
  }

  let combinedScore = 0;

  if (
    parent.baseName === "LIST" &&
    child.baseName === "LIST" &&
    actualChild.value.length === 0
  ) {
    return [TypeWeights.EQUIVALENT, genericTable];
  }

  for (let i = 0; i < child.types.length; i++) {
    let subChild;
    if (child.baseName === "LIST") {
      subChild = actualChild;
    } else {
      subChild = actualChild.value[i];
    }
    const [satisfaction, gt] = typeSatisfaction(
      child.types[i],
      parent.types[i],
      genericTable,
      depth + 1,
      subChild,
    );
    if (satisfaction === 0) {
      return [0, genericTable];
    }

    combinedScore += satisfaction;
    genericTable = { ...genericTable, ...gt };
  }

  return [combinedScore / child.types.length, genericTable];
  //Exact match is 1
  //Same base type is something
  //Handle [String, String, Int] never working with [String, String, String] (aside from morphisms)
  //String <-> String => 1
  //String <-> List => 0.5?
  //String <-> List(Character) => 1 or 0.75 etc..
  //Tuple(String, Number, Character) <-> Tuple => 0.5
  //Tuple(String, Number, Character) <-> Tuple(String, Character, Character) => 0.8333 (assuming 1 step morphism from number to character)
};

//Could definitely tune performance!
export const charListToJsString = (v) => {
  let concatenated = "";
  for (let i = 0; i < v.value.length; i++) {
    concatenated += v.value[i].value;
  }
  return concatenated;
};

export function typeAssignableFrom(child, parent) {
  if (parent === Primitives.ANY) {
    return true;
  }

  if (isAlias(parent)) {
    if (isAlias(child)) {
      if (child["alias"] === parent["alias"]) {
        return true;
      }
    }
    return false;
  }

  if (!child.meta && !parent.meta) {
    return child.baseName === parent.baseName;
  }

  if (child.types.length !== parent.types.length) {
    return parent.baseName === "TUPLE" && parent.types.length === 0;
  }

  return child.types.every((item, index) =>
    typeAssignableFrom(item, parent.types[index]),
  );
}

export function recursiveToString(v) {
  if (Array.isArray(v.value)) {
    if (v.type.types[0] === Primitives.CHARACTER) {
      return '"' + charListToJsString(v) + '"';
    }
    const [open, close] = v.type.baseName === "TUPLE" ? ["(", ")"] : ["[", "]"];
    return open + v.value.map((i) => recursiveToString(i)).join(",") + close;
  }
  return v.value.toString();
}
