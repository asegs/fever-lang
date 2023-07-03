import {splitGeneral, splitArray} from "./prefixer.js";
import {evaluate, goals} from "./interpreter.js";


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

export const conditionFromAst = (ast, variables) => {
    if (ast.type.baseName === 'VARIABLE' && ast.value === '_') {
        return [createCondition(createVar('_', meta.STRING), createVar(createVar(true, primitives.BOOLEAN), primitives.EXPRESSION), createVar(patternWeights.ANY, primitives.NUMBER)), primitives.ANY, null];
    }

    //Populate ast from variables table.  Evaluate what can be evaluated?  Not necessary...but a little bit necessary
}

/**
 Patterns can be:
 a (unknown)

 [_,_3] (later)
 (len(a) % 2 == 0) (expression with unknown)
 */
export const inferConditionFromString = (rawString, vars, morphisms, takenVars) => {
    const string = rawString.trim();

    if (string === '_') {
        return [createCondition(createVar('_', meta.STRING), createVar("true", primitives.EXPRESSION), createVar(patternWeights.ANY, primitives.NUMBER)), primitives.ANY, null];
    }

    const missing = evaluate(string, vars, morphisms, goals.MISSING);
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
        if (!string.startsWith('(')) {
            const consideredValue = vars.getOrNull(string);
            if (consideredValue && isAlias(consideredValue.type) && consideredValue.type.alias === 'FUNCTION') {
                isPreviouslyDeclaredFunction = true;
                missing.push({'name': string, 'type': 'VARIABLE'});
            }
        }
        if (!isPreviouslyDeclaredFunction) {
            const result = evaluate(string, vars, morphisms, goals.EVALUATE);
            return [createCondition(createVar('__repr', meta.STRING), createVar("==(__repr," + recursiveToString(result) + ")", primitives.EXPRESSION), createVar(patternWeights.VALUE, primitives.NUMBER)), result.type, null];
        }
       }

    const acceptedMissing = missing.filter(item => !takenVars.has(item.name));

    if (acceptedMissing.length === 0) {
        //Then we have an expression or variable entirely using previous variables.
        if (string[0] === '(') {
            //Only reasonable case is (b * 2) where b is defined
            return [createCondition(createVar('__repr', meta.STRING), createVar("==(__repr," + string + ")", primitives.EXPRESSION), createVar(patternWeights.EXPRESSION, primitives.NUMBER)), primitives.ANY, null];
            //b where b is defined
        } else {
            //Only reasonable case is (b * 2) where b is defined
            return [createCondition(createVar('__repr', meta.STRING), createVar("==(__repr," + missing[0].name + ")", primitives.EXPRESSION), createVar(patternWeights.VALUE, primitives.NUMBER)), primitives.ANY, null];
        }
    }

    /**
     Distinguish between a, [1,2, a] (len(a) % 2 == 0)...let's just use parens.
     */
    const name = acceptedMissing[0].name;
    if (string[0] === '(') {
        // (len(a) % 2 == 0)
        return [createCondition(createVar(name, meta.STRING), createVar(string, primitives.EXPRESSION), createVar(patternWeights.EXPRESSION, primitives.NUMBER)), primitives.ANY, name];
    }

    // a, won't support [1,2,a] yet, will need to destructure (what if we are actually testing for [1, 2, sublist]?)
    return [createCondition(createVar(name, meta.STRING), createVar("true", primitives.EXPRESSION), createVar(patternWeights.ANY, primitives.NUMBER)), primitives.ANY, name];
}

export const createPatternFromString = (string, vars, morphisms, takenVars) => {
    const conditionAndType = splitGeneral(string, ':');
    let type = conditionAndType.length === 1 ? primitives.ANY : inferTypeFromString(conditionAndType[1], vars);
    const [condition, inferredType, namedVar] = inferConditionFromString(conditionAndType[0], vars, morphisms, takenVars);
    if (type === primitives.ANY) {
        type = inferredType;
    }
    return [createPattern(condition, createTypeVar(type)), namedVar];
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

