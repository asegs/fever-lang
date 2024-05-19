import { splitGeneral, splitOnCommas } from "./parser.ts";
import {
  evaluate,
  interpret,
  parseToExpr,
  unknownVariablesInExpression,
} from "./interpreter.ts";
import { Context } from "./vars.ts";

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

export function createPattern(condition: FeverVar, type: FeverVar): FeverVar {
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
  if (child.baseName === "VARIABLE" && parent.baseName !== "VARIABLE") {
    return [0, genericTable];
  }
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
  if (v.value !== undefined && v.value !== null) {
    return v.value.toString();
  }

  return "";
}

export const inferTypeFromString = (rawString, variables) => {
  const string = rawString.trim();
  for (const [, prim] of Object.entries(Primitives)) {
    if (string.toLowerCase() === prim.baseName.toLowerCase()) {
      return prim;
    }
    if (isAlias(prim) && string.toLowerCase() === prim.alias.toLowerCase()) {
      return prim;
    }
  }

  for (const [, m] of Object.entries(Meta)) {
    if (isAlias(m) && string.toLowerCase() === m.alias.toLowerCase()) {
      return m;
    }
  }

  if (string in Shorthands) {
    return Shorthands[string];
  }

  if (string[0] === "[") {
    const internalType = inferTypeFromString(
      string.slice(1, string.length - 1),
      variables,
    );
    return createTypedList(internalType);
  }
  if (string[0] === "(") {
    const types = splitOnCommas(string.slice(1, string.length - 1)).map((e) =>
      inferTypeFromString(e, variables),
    );
    return createTypedTuple(types);
  }

  const typeVar = variables.getOrNull(string);
  if (typeVar && typeVar.type.baseName === "TYPE") {
    return typeVar.value;
  }

  if (string.endsWith("s") && string.length > 1) {
    const singular = string.slice(0, string.length - 1);
    const newType = inferTypeFromString(singular, variables);
    if (newType.baseName !== "ANY") {
      return createTypedList(newType);
    }
  }

  return createGeneric(Primitives.ANY, string);
};

/**
 Patterns can be:
 a (unknown)

 [_,_3] (later)
 (len(a) % 2 == 0) (expression with unknown)
 */
export const inferConditionFromString = (
  rawString: string,
  ctx: Context,
  takenVars: Set<string>,
) => {
  const string = rawString.trim();

  if (string === "_") {
    return [
      createCondition(
        createVar("_", Meta.STRING),
        createVar(createVar(true, Primitives.BOOLEAN), Primitives.EXPRESSION),
        createVar(PatternWeights.ANY, Primitives.NUMBER),
      ),
      Primitives.ANY,
      null,
    ];
  }

  const expressionObject = parseToExpr(string);
  const missing = unknownVariablesInExpression(expressionObject);
  if (missing.length === 0) {
    /**
     123
     [1,2,3]
     b (known)
     (b + 3) (expression with known)
     */
    // Catch case where it's just a function, we want to be able to redefine function names.
    //ie. type 1 is: {name: string, price:#}
    //and type 2 is: {name: string, size: #}
    // Even though declaring type 1 introduced name as a function, we will never want to match function equality
    let isPreviouslyDeclaredFunction = false;
    if (!string.startsWith("(")) {
      const consideredValue = ctx.getOrNull(string);
      if (
        consideredValue &&
        isAlias(consideredValue.type) &&
        consideredValue.type.alias === "FUNCTION"
      ) {
        isPreviouslyDeclaredFunction = true;
        missing.push({
          value: string,
          type: { baseName: "VARIABLE", types: [], meta: false },
        });
      }
    }
    if (!isPreviouslyDeclaredFunction) {
      const result = interpret(string);
      return [
        createCondition(
          createVar("__repr", Meta.STRING),
          createVar(
            parseToExpr("==(__repr," + recursiveToString(result) + ")"),
            Primitives.EXPRESSION,
          ),
          createVar(PatternWeights.VALUE, Primitives.NUMBER),
        ),
        result.type,
        null,
      ];
    }
  }

  const acceptedMissing = missing.filter((item) => !takenVars.has(item.value));

  if (acceptedMissing.length === 0) {
    //Then we have an expression or variable entirely using previous variables.
    if (string[0] === "(") {
      //Only reasonable case is (b * 2) where b is defined
      return [
        createCondition(
          createVar("__repr", Meta.STRING),
          createVar(
            parseToExpr("==(__repr," + string + ")"),
            Primitives.EXPRESSION,
          ),
          createVar(PatternWeights.EXPRESSION, Primitives.NUMBER),
        ),
        Primitives.ANY,
        null,
      ];
      //b where b is defined
    } else {
      //Only reasonable case is (b * 2) where b is defined
      return [
        createCondition(
          createVar("__repr", Meta.STRING),
          createVar(
            parseToExpr("==(__repr," + missing[0].value + ")"),
            Primitives.EXPRESSION,
          ),
          createVar(PatternWeights.VALUE, Primitives.NUMBER),
        ),
        Primitives.ANY,
        null,
      ];
    }
  }

  /**
   Distinguish between a, [1,2, a] (len(a) % 2 == 0)...let's just use parens.
   */
  const name = acceptedMissing[0].value;
  if (string[0] === "(") {
    // (len(a) % 2 == 0)
    return [
      createCondition(
        createVar(name, Meta.STRING),
        createVar(parseToExpr(string), Primitives.EXPRESSION),
        createVar(PatternWeights.EXPRESSION, Primitives.NUMBER),
      ),
      Primitives.ANY,
      name,
    ];
  }

  // a, won't support [1,2,a] yet, will need to destructure (what if we are actually testing for [1, 2, sublist]?)
  return [
    createCondition(
      createVar(name, Meta.STRING),
      createVar(createVar(true, Primitives.BOOLEAN), Primitives.EXPRESSION),
      createVar(PatternWeights.ANY, Primitives.NUMBER),
    ),
    Primitives.ANY,
    name,
  ];
};

export const createPatternFromString = (
  pattern: string,
  ctx: Context,
  takenVars: Set<string>,
) => {
  const conditionAndType = splitGeneral(pattern, ":");
  let type =
    conditionAndType.length === 1
      ? Primitives.ANY
      : inferTypeFromString(conditionAndType[1], ctx);
  const [condition, inferredType, namedVar] = inferConditionFromString(
    conditionAndType[0],
    ctx,
    takenVars,
  );
  if (type === Primitives.ANY) {
    type = inferredType;
  }
  return [createPattern(condition, createTypeVar(type)), namedVar];
};
