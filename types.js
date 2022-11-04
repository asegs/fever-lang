module.exports = {
    primitives,
    meta,
    createType,
    createTypedList,
    createTypedTuple,
    createTypedFunction
}

const createType = (baseName, types, methods, meta) => {
    return {
        'baseName': baseName,
        'types': types,
        'methods': methods,
        'meta': meta
    }
}

const createVar = (value, type) => {
    return {
        'value': value,
        'type': type
    }
}

const typesEqual = (t1, t2) => {
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

const primitives = {
    NUMBER: createType("NUMBER", [], {}, false),
    STRING: createType("STRING", [], {}, false),
    BOOLEAN: createType("BOOLEAN", [], {}, false),
    ANY: createType("ANY", [], {}, false),
    VOID: createType("VOID")
}

const createTypedList = (ofType) => {
    return createType("LIST", [ofType], {
        'match': (l) => l.every(item => typesEqual(item.type, ofType))
    }, true);
}

const createTypedTuple = (types) => {
    return createType("TUPLE", types, {
        'match': (t) => t.every((item, index) => typesEqual(item.type, types[index]))
    }, true);
}

const createTypedFunction = (types) => {
    return createType("FUNCTION", types, {
        'match': (t) => t.every((item, index) => typesEqual(item.type, types[index]))
    }, true);
}

const meta = {
    LIST: createTypedList(primitives.ANY),
    FUNCTION: createTypedFunction([primitives.VOID]),
    TUPLE: createTypedTuple([primitives.ANY])
}