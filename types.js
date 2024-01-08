import {splitArray} from "./prefixer.js";
import {evaluateAst} from "./interpreter.js";
import {AST_SPECIAL_TYPES, missing} from "./literals.js";


export const typeWeights = {
    ANY: 0.5,
    BASE_TUPLE: 0.75,
    NOMINAL: 1.1,
    EQUIVALENT: 1,
    GENERIC: 1
}

export const patternWeights = {
    ANY: 0.5,
    EXPRESSION: 1,
    TYPE: 1,
    VALUE: 1.2
}



export const createType = (baseName, types, meta, alias) => {
    const type = {
        'baseName': baseName,
        'types': types,
        'meta': meta
    };

    if (alias) {
        type['alias'] = alias;
    }

    return type;
}

export const primitives = {
    NUMBER: createType("NUMBER", [], false),
    BOOLEAN: createType("BOOLEAN", [], false),
    CHARACTER: createType("CHARACTER",[],  false),
    ANY: createType("ANY", [],  false),
    VOID: createType("VOID"),
    EXPRESSION: createType("EXPRESSION", [],  false),
    TYPE: createType("TYPE", [],  false),
    ERROR: createType("ERROR", [], false)
}

export const createVar = (value, type) => {
    return {
        'value': value,
        'type': type
    }
}

export const typeAssignableFrom = (child, parent) => {
    if (parent === primitives.ANY) {
        return true;
    }

    if (isAlias(parent)) {
        if (isAlias(child)) {
            if (child['alias'] === parent['alias']) {
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

    return child.types.every((item, index) => typeAssignableFrom(item, parent.types[index]));
}

const weightedAnyType = (depth) => {
    return (typeWeights.ANY + (typeWeights.EQUIVALENT * depth)) / (depth + 1);
}


export const typeSatisfaction = (child, parent, genericTable, depth, actualChild) => {
    if (parent.baseName === "ANY") {

        if (isGeneric(parent)) {
            //We are either matching against a known type
            if (parent.generic in genericTable) {
                return typeSatisfaction(child, genericTable[parent.generic], genericTable, depth, actualChild);
            }

            //Or we just encountered some generic for the first time
            genericTable[parent.generic] = child;
            return [typeWeights.GENERIC, genericTable];
        }

        return [weightedAnyType(depth), genericTable];
    }

    if (isAlias(parent)) {
        if (isAlias(child)) {
            if (child['alias'] === parent['alias']) {
                return [typeWeights.NOMINAL, genericTable];
            }
        }
        return [0, genericTable];
    }

    if (!child.meta && !parent.meta) {
        return [((child.baseName === parent.baseName) ? typeWeights.NOMINAL : 0), genericTable];
    }

    if (child.types.length !== parent.types.length) {
        return [((parent.baseName === "TUPLE" && parent.types.length === 0) ? typeWeights.BASE_TUPLE : 0), genericTable];
    }

    let combinedScore = 0;

    if (parent.baseName === 'LIST' && child.baseName === 'LIST' && actualChild.value.length === 0) {
        return [typeWeights.EQUIVALENT, genericTable];
    }

    for (let i = 0 ; i < child.types.length ; i ++ ) {
        let subChild;
        if (child.baseName === 'LIST') {
            subChild = actualChild;
        } else {
            subChild = actualChild.value[i];
        }
        const [satisfaction, gt] = typeSatisfaction(child.types[i], parent.types[i], genericTable, depth + 1, subChild);
        if (satisfaction === 0) {
            return [0, genericTable];
        }

        combinedScore += satisfaction;
        genericTable = {...genericTable, ...gt};
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
}

export const createTypedList = (ofType, name) => {
    return createType("LIST", [ofType], true, name);
}

export const createTypedTuple = (types, name) => {
    return createType("TUPLE", types, true, name);
}

export const createTypeVar = (type) => {
    return createVar(type, primitives.TYPE);
}

export const createGeneric = (type, name) => {
    return {...type, 'generic': name};
}

export const createError = (message) => {
    return createVar(message, primitives.ERROR);
}

export const createPattern = (condition, type) => {
    return createVar([condition, type], meta.PATTERN);
}

export const createCondition = (name, expr, specificity) => {
    return createVar([name, expr, specificity], meta.CONDITION);
}

export const typeFromString = (typeString) => {
    const string = typeString.trim();
    for (const [, prim] of Object.entries(primitives)) {
        if (string.toLowerCase() === prim.baseName.toLowerCase()) {
            return prim;
        }
        if (isAlias(prim) && (string.toLowerCase() === prim.alias.toLowerCase())) {
            return prim;
        }
    }

    for (const [, m] of Object.entries(meta)) {
        if (isAlias(m) && (string.toLowerCase() === m.alias.toLowerCase())) {
            return m;
        }
    }

    if (string in shorthands) {
        return shorthands[string];
    }

    if (string[0] === '[') {
        const internalType = typeFromString(string.slice(1, string.length - 1));
        return createTypedList(internalType);
    }
    if (string[0] === '(') {
        const types = splitArray(string.slice(1, string.length - 1)).map(e => typeFromString(e));
        return createTypedTuple(types);
    }

    return primitives.ANY;
}

export const typeFromStringWithContext = (typeString, variables) => {
    return inferTypeFromString(typeString, variables);
}

export const inferTypeFromString = (rawString, variables) => {
    const string = rawString.trim();
    for (const [, prim] of Object.entries(primitives)) {
        if (string.toLowerCase() === prim.baseName.toLowerCase()) {
            return prim;
        }
        if (isAlias(prim) && (string.toLowerCase() === prim.alias.toLowerCase())) {
            return prim;
        }
    }

    for (const [, m] of Object.entries(meta)) {
        if (isAlias(m) && (string.toLowerCase() === m.alias.toLowerCase())) {
            return m;
        }
    }

    if (string in shorthands) {
        return shorthands[string];
    }

    if (string[0] === '[') {
        const internalType = inferTypeFromString(string.slice(1, string.length - 1), variables);
        return createTypedList(internalType);
    }
    if (string[0] === '(') {
        const types = splitArray(string.slice(1, string.length - 1)).map(e => inferTypeFromString(e, variables));
        return createTypedTuple(types);
    }

    const typeVar = variables.getOrNull(string);
    if (typeVar && typeVar.type.baseName === 'TYPE') {
        return typeVar.value;
    }

    if (string.endsWith('s') && string.length > 1) {
        const singular = string.slice(0, string.length -1);
        const newType = inferTypeFromString(singular, variables);
        if (newType.baseName !== 'ANY') {
            return createTypedList(newType);
        }
    }

    return createGeneric(primitives.ANY, string);
}

//Returns [new populated ast, boolean if all children are populated]
export const populateAst = (ast, vars, morphisms) => {
    if (isAlias(ast.type) && ast.type.alias === 'CONDITION' && ast.value[2] === -1) {
        return [conditionFromAst(ast.value[1], vars, morphisms), true]
    }

    if (!Array.isArray(ast.value)) {
        if (ast.type.baseName === 'VARIABLE') {
            const lookupValue = vars.getOrNull(ast.name);
            if (lookupValue) {
                return [lookupValue, true];
            }
            return [ast, false];
        }
        return [ast, true];
    }

    const populatedArgs = [];
    let previousChildrenPopulated = true;
    for (const child of ast.value) {
        const [newChild, allPopulated] = populateAst(child, vars, morphisms);
        previousChildrenPopulated = allPopulated && previousChildrenPopulated;
        populatedArgs.push(newChild);
    }

    if (previousChildrenPopulated && ast.type.baseName === 'FUNCTION_INVOCATION') {
        const populatedFunctionCall = createVar(populatedArgs, AST_SPECIAL_TYPES.FUNCTION_INVOCATION);
        populatedFunctionCall.functionName = ast.functionName;
        return [evaluateAst(populatedFunctionCall, vars, morphisms), true];
    }

    if (ast.type.baseName === 'FUNCTION_INVOCATION') {
        const unpopulatedFunctionCall = createVar(populatedArgs, AST_SPECIAL_TYPES.FUNCTION_INVOCATION);
        unpopulatedFunctionCall.functionName = ast.functionName;
        return [unpopulatedFunctionCall, false];
    }

    return [createVar(populatedArgs, ast.type), previousChildrenPopulated];
}

export const conditionFromAst = (ast, variables, morphisms) => {
    if (ast.type.baseName === 'VARIABLE' && ast.value === '_') {
        return createCondition(createVar('_', meta.STRING), createVar(true, primitives.BOOLEAN), createVar(patternWeights.ANY, primitives.NUMBER));
    }

    const [populatedAst, isComplete] = populateAst(ast, variables, morphisms);

    let missingNames = {'var':{}, 'func':{}};
    if (!isComplete) {
        missingNames = Object.keys(missing(populatedAst).var);
    }

    if (populatedAst.type.baseName === 'FUNCTION_INVOCATION') {
        return createCondition(createVar(missingNames[0], meta.STRING), populatedAst, createVar(patternWeights.EXPRESSION, primitives.NUMBER));
    } else if (populatedAst.type.baseName === 'VARIABLE') {
        return createCondition(createVar(missingNames[0], meta.STRING), createVar(true, primitives.BOOLEAN), createVar(patternWeights.ANY, primitives.NUMBER));
    } else {
        const equalityCheck = createVar([createVar('__repr', AST_SPECIAL_TYPES.VARIABLE), ast], AST_SPECIAL_TYPES.FUNCTION_INVOCATION);
        equalityCheck.functionName = '==';
        return createCondition(createVar('__repr', meta.STRING), equalityCheck, createVar(patternWeights.VALUE, primitives.NUMBER));
    }
}

const STRING = createTypedList(primitives.CHARACTER, "STRING");
const CONDITION = createTypedTuple([STRING, primitives.EXPRESSION, primitives.NUMBER], "CONDITION");
const PATTERN = createTypedTuple([CONDITION, primitives.TYPE], "PATTERN");
const SIGNATURE = createTypedList(PATTERN, "SIGNATURE");
const CASE = createTypedTuple([SIGNATURE, primitives.EXPRESSION], "CASE");
//These also have a special invocations property!
const FUNCTION = createTypedList(CASE, 'FUNCTION');

export const meta = {
    CONDITION: CONDITION,
    PATTERN: PATTERN,
    SIGNATURE: SIGNATURE,
    LIST: createTypedList(primitives.ANY),
    STRING: STRING,
    CASE: CASE,
    FUNCTION: FUNCTION,
    TUPLE: createTypedTuple([]),
}

export const shorthands = {
    '#': primitives.NUMBER,
    'fn': meta.FUNCTION
}
export const recursiveToString = (v) => {
    if (Array.isArray(v.value)) {
        if (v.type.types[0] === primitives.CHARACTER) {
            return '"' + charListToJsString(v) + '"';
        }
        const [open, close] = v.type.baseName === "TUPLE" ? ['(',')'] : ['[', ']'];
        return open + v.value.map(i => recursiveToString(i)).join(",") + close;
    }
    return v.value.toString();
}

//Could definitely tune performance!
export const charListToJsString = (v) => {
    let concatenated = "";
    for (let i = 0 ; i < v.value.length ; i ++ ) {
        concatenated += v.value[i].value;
    }
    return concatenated;
}

export const isAlias = (t) => {
    return 'alias' in t;
}

export const isGeneric = (t) => {
    return 'generic' in t;
}

