import {splitGeneral, splitArray} from "./prefixer.js";

const ANY_VALUE = 0.5;

export const createType = (baseName, types, methods, meta) => {
    return {
        'baseName': baseName,
        'types': types,
        'methods': methods,
        'meta': meta
    }
}

export const createVar = (value, type) => {
    return {
        'value': value,
        'type': type
    }
}

export const typesEqual = (t1, t2) => {
    if (t1 === primitives.ANY || t2 === primitives.ANY) {
        return true;
    }
    if (!t1.meta && !t2.meta) {
        return t1.baseName === t2.baseName;
    }
    if (t1.baseName !== t2.baseName) {
        return false;
    }
    if (t1.types.length !== t2.types.length) {
        return false;
    }
    return t1.types.every((item, index) => typesEqual(item, t2.types[index]));
}

export const typeCloseness = (testType, comparedTo) => {
    if (testType.baseName === "ANY") {
        return ANY_VALUE;
    }

    if (typesEqual(testType, comparedTo)) {
        return 1;
    }
    return 0;
    //Exact match is 1
    //Same base type is something
    //Handle [String, String, Int] never working with [String, String, String] (aside from morphisms)
    //String <-> String => 1
    //String <-> List => 0.5?
    //String <-> List(Character) => 1 or 0.75 etc..
    //Tuple(String, Number, Character) <-> Tuple => 0.5
    //Tuple(String, Number, Character) <-> Tuple(String, Character, Character) => 0.8333 (assuming 1 step morphism from number to character)
}

export const primitives = {
    NUMBER: createType("NUMBER", [], {}, false),
    BOOLEAN: createType("BOOLEAN", [], {}, false),
    CHARACTER: createType("CHARACTER",[], {}, false),
    ANY: createType("ANY", [], {}, false),
    VOID: createType("VOID"),
    EXPRESSION: createType("EXPRESSION", [], {}, false),
    TYPE: createType("TYPE", [], {}, false),
}

export const createTypedList = (ofType) => {
    return createType("LIST", [ofType], {
        'match': (l) => l.every(item => typesEqual(item.type, ofType))
    }, true);
}

export const createTypedTuple = (types) => {
    return createType("TUPLE", types, {
        'match': (t) => t.every((item, index) => typesEqual(item.type, types[index]))
    }, true);
}

export const createTypeVar = (type) => {
    return createVar(type, primitives.TYPE);
}

export const createCondition = (pattern, type) => {
    return createVar([pattern, type], meta.CONDITION);
}

export const inferTypeFromString = (rawString) => {
    const string = rawString.trim();
    for (const [, prim] of Object.entries(primitives)) {
        if (string.toLowerCase() === prim.baseName.toLowerCase()) {
            return prim;
        }
    }
    if (string[0] === '[') {
        const internalType = inferTypeFromString(string.slice(1, string.length - 1));
        return createTypedList(internalType);
    }
    if (string[0] === '(') {
        const types = splitArray(string.slice(1, string.length - 1)).map(e => inferTypeFromString(e));
        return createTypedTuple(types);
    }
    return primitives.ANY;
}

export const inferPatternFromString = (rawString, vars, functions) => {
    const string = rawString.trim();
    return createVar(string, primitives.EXPRESSION);
}

export const createConditionFromString = (string, vars, functions) => {
    const conditionAndType = splitGeneral(string, ':');
    const type = conditionAndType.length === 1 ? primitives.ANY : inferTypeFromString(conditionAndType[1]);
    const condition = inferPatternFromString(conditionAndType[0], vars, functions);
    return createCondition(condition, createTypeVar(type));
}

const CONDITION = createTypedTuple([primitives.EXPRESSION, primitives.TYPE]);
const SIGNATURE = createTypedList(CONDITION);

export const meta = {
    CONDITION: CONDITION,
    SIGNATURE: SIGNATURE,
    LIST: createTypedList(primitives.ANY),
    STRING: createTypedList(primitives.CHARACTER),
    FUNCTION: createTypedTuple([SIGNATURE, primitives.EXPRESSION]),
    TUPLE: createTypedTuple([primitives.ANY]),


}

/**
 *Signature:
  {
  "types": ["LIST"],
  "value": [
  {
  "type": "STRING",
  "test": () => interpret("len(x) > 5")
  }
  ]
  }

 *Function:
 {
 "types"
 }
 */