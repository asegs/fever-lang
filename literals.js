import {
    createConditionFromString,
    createTypedList,
    createTypedTuple,
    createVar,
    meta,
    primitives,
    typesEqual
} from './types.js'
import {splitArray, lex} from "./prefixer.js";
import {ScopedVars} from "./vars.js";

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


const parseCollectionToItems = (string) => {
    return splitArray(string.slice(1, string.length - 1));
}

//Will need to take variable table and maybe function table
export const inferTypeAndValue = (string, vars, functions) => {
    if (vars.hasVariable(string)) {
        return vars.lookupValue(string);
    }
    if (everyCharNumeric(string)) {
        return createVar(Number(string), primitives.NUMBER);
    } else if (isStringLiteral(string)) {
        return createVar(string.slice(1, string.length - 1), meta.STRING);
    } else if (isWord(string)) {
        if (wordIsBoolean(string)) {
            return createVar(string === "true", primitives.BOOLEAN);
        }
        //Return from vars table.
    } else if (isList(string)) {
        const entries = parseCollectionToItems(string);
        const items = entries.map(e => inferTypeAndValue(e, vars, functions));
        if (items.length > 0) {
            const first = items[0];
            if (items.every(i => typesEqual(first.type, i.type))) {
                return createVar(items, createTypedList(first.type));
            }
        }
        return createVar(items, meta.LIST);
    } else if (isTuple(string)) {
        const entries = parseCollectionToItems(string);
        const items = entries.map(e => inferTypeAndValue(e, vars, functions));
        return createVar(items, createTypedTuple(items.map(i => i.type)))
    } else if (isExpression(string)) {
        return createVar(string.slice(1, string.length - 1), primitives.EXPRESSION);
    } else if (isSignature(string)) {
        const entries = parseCollectionToItems(string);
        //Signature is value: list of conditions
        return createVar(entries.map(e => createConditionFromString(e)), meta.SIGNATURE);
    }

    throw "No variable named " + string;
}

const vars = new ScopedVars();

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