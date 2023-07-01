import {
    createError,
    createPatternFromString, createType,
    createTypedList,
    createTypedTuple, createTypeVar,
    createVar, inferTypeFromString, meta,
    primitives, typeAssignableFrom, typeFromString
} from './types.js'
import {lex, splitArray, splitGeneral, trimAndSplitArray} from "./prefixer.js";
import {evaluate, goals, findMissing} from "./interpreter.js";

const everyCharNumeric = (string) => {
   return string.match(/^-?[0-9]+$/g) || string.match(/^-?[0-9]+\.[0-9]+$/g);
}

const isStringLiteral = (string) => {
    return string.match(/^".+"$/g) || string.match(/^'.+'$/g);
}

const isWord = (string) => {
    return string.match(/^[a-zA-z]$/g) || string.match(/^[a-zA-Z][a-zA-Z0-9]+$/g);
}

const wordIsBoolean = (string) => {
    return string === "true" || string === "false";
}

const isList = (string) => {
    return string.match(/^\[.+]$/g);
}

const isTuple = (string) => {
    if (!isExpression(string)) {
        return false;
    }
    return parseCollectionToItems(string).length > 1;
}

const isExpression = (string) => {
    return string.match(/^\(.+\)$/g);
}

const isSignature = (string) => {
    return string.match(/^{.+}$/g);
}

const getAsTypeVar = (string) => {
    const tName = string.toUpperCase();
    if (tName in primitives) {
        return createTypeVar(primitives[tName]);
    }

    if (tName in meta) {
        return createTypeVar(meta[tName]);
    }

    return null;
}


const parseCollectionToItems = (string) => {
    return splitArray(string.slice(1, string.length - 1));
}

const recursiveTypeMatch = new RegExp(/^(list|tuple)\[(.*)]$/m);

export const AST_NODE = (text, obj) => {
    return {
        'text': text,
        'obj': obj
    }
}

export const AST_SPECIAL_TYPES = {
    "VARIABLE": createType("VARIABLE",[], false),
    "FUNCTION_INVOCATION": createType("FUNCTION_INVOCATION", [], false)
}

const isFunctionCall = (text) => {
    return /^[^(]+\(.*\)$/gm.test(text);
}

const splitIntoNameAndBody = (text) => {
    const firstParen = text.indexOf("(");
    return [text.slice(0, firstParen), text.slice(firstParen)]
}

export const expressionToAst = (expr) => {
    if (expr === '[]') {
        return AST_NODE(expr, createVar([], meta.LIST));
    }

    if (expr === '""') {
        return AST_NODE(expr, createVar([], meta.STRING));
    }

    if (expr === '()') {
        return AST_NODE(expr, createVar([], meta.TUPLE));
    }

    if (everyCharNumeric(expr)) {
        return AST_NODE(expr, createVar(Number(expr), primitives.NUMBER));
    }

    if (isStringLiteral(expr)) {
        return AST_NODE(expr, feverStringFromJsString(expr.slice(1, expr.length - 1)));
    }

    if (wordIsBoolean(expr)) {
        return AST_NODE(expr, createVar(expr === "true", primitives.BOOLEAN));
    }

    if (isList(expr)) {
        const entries = parseCollectionToItems(expr);
        const items = entries.map(e => expressionToAst(e));
        return AST_NODE(expr, createVar(items, inferListType(items)));
    }

    else if (isTuple(expr)) {
        const entries = parseCollectionToItems(expr);
        const items = entries.map(e => expressionToAst(e));
        return AST_NODE(expr, createVar(items, createTypedTuple(items.map(i => i.type))));
    }

    if (isExpression(expr)) {
        const expression = expr.slice(1, expr.length - 1);
        return expressionToAst(expression);
    }

    if (isSignature(expr)) {
        const entries = parseCollectionToItems(expr);
        return AST_NODE(expr, createVar(entries.map(entry => createPatternAstFromSting(entry)), meta.SIGNATURE));
    }

    if (isFunctionCall(expr)) {
        const [name, body] = splitIntoNameAndBody(expr);
        const args = trimAndSplitArray(body).map(arg => expressionToAst(arg));
        return AST_NODE(name, createVar(args, AST_SPECIAL_TYPES.FUNCTION_INVOCATION));
    }

    return AST_NODE(expr, createVar(expr, AST_SPECIAL_TYPES.VARIABLE));
}


const createPatternAstFromSting = (string) => {
    const conditionAndType = splitGeneral(string, ':');
    const hasType = conditionAndType.length === 2;

    const condition = conditionAndType[0];

    let conditionAst;
    if (condition[0] === '(' && condition[condition.length - 1] === ')') {
        conditionAst = expressionToAst(condition.slice(1, condition.length - 1));
    } else {
        conditionAst = expressionToAst(condition);
    }

    let inferredType = primitives.ANY;
    if (hasType) {
        inferredType = typeFromString(conditionAndType[1]);
    }

    return [createVar([conditionAst, hasType ? (inferredType.baseName === 'ANY' ? createVar(conditionAndType[1], AST_SPECIAL_TYPES.VARIABLE) : createTypeVar(inferredType)): createTypeVar(primitives.ANY)], meta.TUPLE)]
}

export const populateTypeHierarchy = (typeNode, variables) => {
    if (typeNode.obj.type.baseName === 'VARIABLE') {
        return AST_NODE(typeNode.text, )
    }
}

//Evaluates all non static items as missing.
export const missing = (astNode) => {
    if (astNode.obj.type.baseName === 'VARIABLE') {
        return {
            'var': {
                [astNode.text]: astNode
            },
            'func': {
            }
        }
    }

    if (astNode.obj.type.baseName === 'FUNCTION_INVOCATION') {
        return {
            'var': {
            },
            'func': {
                [astNode.text]: astNode
            }
        }
    }

    let missingEntries = {'var':{}, 'func':{}};
    if (Array.isArray(astNode.obj.value)) {
        for (const item of astNode.obj.value) {
            const result = missing(item);
            missingEntries = {'var': {...missingEntries.var, ...result.var}, 'func': {...missingEntries.func, ...result.func}};
        }
        return missingEntries;
    }

    return {'var': {}, 'func': {}};
}

export const inferTypeAndValue = (string, vars, morphisms, goal) => {
    if (goal === goals.MISSING) {
        if (vars.hasVariableInScope(string)) {
            return vars.lookupValueInScope(string);
        }
    } else {
        if (vars.hasVariable(string)) {
            return vars.lookupValue(string);
        }
    }
    if (string === "[]") {
        return createVar([], meta.LIST);
    }
    if (string === '""') {
        return createVar([], meta.STRING);
    }
    if (string === '()') {
        return createVar([], meta.TUPLE);
    }
    const asTypeVar = getAsTypeVar(string);
    if (asTypeVar) {
        return asTypeVar;
    }
    if (everyCharNumeric(string)) {
        return createVar(Number(string), primitives.NUMBER);
    } else if (isStringLiteral(string)) {
        return feverStringFromJsString(string.slice(1, string.length - 1));
    } else if (isWord(string)) {
        if (wordIsBoolean(string)) {
            return createVar(string === "true", primitives.BOOLEAN);
        }
    } else if (isList(string)) {
        const entries = parseCollectionToItems(string);
        const items = entries.map(e => inferTypeAndValue(e, vars, morphisms, goal));
        if (goals.MISSING === goal) {
            const missing = findMissing(items);
            if (missing.length > 0) {
                return missing;
            }
        }
        return createVar(items, inferListType(items));
    } else if (isTuple(string)) {
        const entries = parseCollectionToItems(string);
        const items = entries.map(e => inferTypeAndValue(e, vars, morphisms, goal));
        if (goals.MISSING === goal) {
            const missing = findMissing(items);
            if (missing.length > 0) {
                return missing;
            }
        }
        return createVar(items, createTypedTuple(items.map(i => i.type)))
    } else if (isExpression(string)) {
        const expr = string.slice(1, string.length - 1);
        const missing = evaluate(expr, vars, morphisms, goals.MISSING);
        if (missing.length === 0) {
            return evaluate(expr, vars, morphisms, goals.EVALUATE);
        }

        if (goal === goals.MISSING && missing.length > 0 ) {
            return missing;
        }
        return createVar(expr, primitives.EXPRESSION);
    } else if (isSignature(string)) {
        const entries = parseCollectionToItems(string);
        const takenVars = new Set();
        const signatureItems = [];
        for (let i = 0 ; i < entries.length ; i ++ ) {
            const [pattern, varName] = createPatternFromString(entries[i], vars, morphisms, takenVars);
            if (varName !== null) {
                takenVars.add(varName);
            }
            signatureItems.push(pattern);
        }
        return createVar(signatureItems, meta.SIGNATURE);
    }

    const match = recursiveTypeMatch.exec(string);
    if (match) {
        const baseTypeString = match[1];
        const subTypeString = match[2];

       const returnType = (baseTypeString === 'list') ?
           inferTypeFromString('[' + subTypeString + ']', vars) :
           inferTypeFromString('(' + subTypeString + ')', vars);

       if (returnType.baseName !== 'ANY') {
           return createTypeVar(returnType);
       }
    }

    if (goal === goals.EVALUATE) {
        return createError("No variable named " + string);
    } else {
        return {
            "type": "VARIABLE",
            "name": string
        };
    }
}

export const feverStringFromJsString = (jsString) => {
    return createVar(jsString.split('').map(char => createVar(char, primitives.CHARACTER)), meta.STRING);
}

export const inferListType = (items, optionalAlias) => {
    if (items.length > 0) {
        if (items.some(item => item.type.baseName === 'VARIABLE' || item.type.baseName === 'FUNCTION_INVOCATION')) {
            return meta.LIST;
        }
        const first = items[0];
        if (items.every(i => typeAssignableFrom(i.type, first.type))) {
            return createTypedList(first.type, optionalAlias);
        }
    }
    return meta.LIST;
}
// console.log(inferTypeAndValue(lex("3"), vars))
// console.log(inferTypeAndValue(lex("3.5"), vars))
// console.log(inferTypeAndValue(lex("-82.13"), vars))
// console.log(inferTypeAndValue(lex('"hello"'), vars))
// console.log(inferTypeAndValue(lex("'hello'"), vars))
// console.log(inferTypeAndValue(lex("true"), vars))
// console.log(inferTypeAndValue(lex("false"), vars))
// console.log(inferTypeAndValue(lex("[1,2,3]"), vars))
// console.log(inferTypeAndValue(lex('[1,2,"hello"]'), vars))
// console.log(inferTypeAndValue(lex("(1,2)"), vars))
// console.log(inferTypeAndValue(lex("(1,'hello')"), vars))
// console.log(inferTypeAndValue(lex("(1,(2,'hello'))"), vars))
// console.log(inferTypeAndValue(lex("(3+1)"), vars))
// console.log(inferTypeAndValue(lex("(1,2,(3+5))")), vars)
// console.log(inferTypeAndValue("{a: String, b: String}"))
// console.log(inferTypeAndValue("{a: String, b}"))
// console.log(inferTypeAndValue("{true, a: String}"))
// console.log(inferTypeAndValue(lex("{true, (length(a) > 1): String}"), vars))
// console.log(inferTypeAndValue(lex("a = ({true} => 3)"), vars))
// console.log(inferTypeAndValue(lex("a = 3")))
// console.log(inferTypeAndValue(lex("3+5")))
/**
 * Conditions:
 *
 */