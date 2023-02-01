import {splitGeneral, splitArray} from "./prefixer.js";

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

export const primitives = {
    NUMBER: createType("NUMBER", [], {}, false),
    BOOLEAN: createType("BOOLEAN", [], {}, false),
    CHARACTER: createType("CHARACTER",[], {}, false),
    ANY: createType("ANY", [], {}, false),
    VOID: createType("VOID"),
    EXPRESSION: createType("EXPRESSION", [], {}, false),
    CONDITION: createType("CONDITION", [], {}, false),
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

//Has body to eval and var names table.
export const createTypedFunction = (signature) => {
    return createType("FUNCTION", signature.value, {
        'match': (t) => t.every((item, index) => typesEqual(item.type, signature.value[index]))
    }, true);
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

}

export const createConditionFromString = (string) => {
    const conditionAndType = splitGeneral(string, ':');
    let type;
    if (conditionAndType.length === 1) {
        type = primitives.ANY;
    } else {
        type = inferTypeFromString(conditionAndType[1]);
    }
    console.log(type)

}

export const meta = {
    SIGNATURE: createTypedList(primitives.CONDITION),
    LIST: createTypedList(primitives.ANY),
    STRING: createTypedList(primitives.CHARACTER),
    FUNCTION: createTypedFunction([primitives.VOID]),
    TUPLE: createTypedTuple([primitives.ANY])
}