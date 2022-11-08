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
    STRING: createType("STRING", [], {}, false),
    BOOLEAN: createType("BOOLEAN", [], {}, false),
    ANY: createType("ANY", [], {}, false),
    VOID: createType("VOID"),
    TYPE: createType("TYPE", [], {}, false),
    EXPRESSION: createType("EXPRESSION", [], {}, false),
    CONDITION: createType("CONDITION", [], {}, false)
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

export const meta = {
    SIGNATURE: createTypedList(primitives.TYPE),
    LIST: createTypedList(primitives.ANY),
    FUNCTION: createTypedFunction([primitives.VOID]),
    TUPLE: createTypedTuple([primitives.ANY])
}