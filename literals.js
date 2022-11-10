import {
    createConditionFromString,
    createTypedList,
    createTypedTuple,
    createVar,
    meta,
    primitives,
    typesEqual
} from './types.js'
import {splitArray, lexer} from "./prefixer.js";

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
    if (!string.match(/^\(.+\)$/g)) {
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
const inferTypeAndValue = (string) => {
    if (everyCharNumeric(string)) {
        return createVar(Number(string), primitives.NUMBER);
    } else if (isStringLiteral(string)) {
        return createVar(string.slice(1, string.length - 1), primitives.STRING);
    } else if (isWord(string)) {
        if (wordIsBoolean(string)) {
            return createVar(string === "true", primitives.BOOLEAN);
        }
        //Return from vars table.
    } else if (isList(string)) {
        const entries = parseCollectionToItems(string);
        const items = entries.map(e => inferTypeAndValue(e));
        if (items.length > 0) {
            const first = items[0];
            if (items.every(i => typesEqual(first.type, i.type))) {
                return createVar(items, createTypedList(first.type));
            }
        }
        return createVar(items, meta.LIST);
    } else if (isTuple(string)) {
        const entries = parseCollectionToItems(string);
        const items = entries.map(e => inferTypeAndValue(e));
        return createVar(items, createTypedTuple(items.map(i => i.type)))
    } else if (isExpression(string)) {
        return createVar(string.slice(1, string.length - 1), primitives.EXPRESSION);
    } else if (isSignature(string)) {
        const entries = parseCollectionToItems(string);
        return createVar(entries.map(e => createConditionFromString(e)), meta.SIGNATURE);
    }
    //Handle case of function call using function table.
    return createVar(null, primitives.VOID);
}

console.log(inferTypeAndValue(lexer("3")))
console.log(inferTypeAndValue(lexer("3.5")))
console.log(inferTypeAndValue(lexer("-82.13")))
console.log(inferTypeAndValue(lexer('"hello"')))
console.log(inferTypeAndValue(lexer("'hello'")))
console.log(inferTypeAndValue(lexer("true")))
console.log(inferTypeAndValue(lexer("false")))
console.log(inferTypeAndValue(lexer("[1,2,3]")))
console.log(inferTypeAndValue(lexer('[1,2,"hello"]')))
console.log(inferTypeAndValue(lexer("(1,2)")))
console.log(inferTypeAndValue(lexer("(1,'hello')")))
console.log(inferTypeAndValue(lexer("(1,(2,'hello'))")))
console.log(inferTypeAndValue(lexer("(3+1)")))
console.log(inferTypeAndValue(lexer("(1,2,3+5)")))
console.log(inferTypeAndValue("{a: String, b: String}"))
console.log(inferTypeAndValue("{a: String, b}"))
console.log(inferTypeAndValue("{true, a: String}"))
console.log(inferTypeAndValue(lexer("{true, (length(a) > 1): String}")))
/**
 * Conditions:
 *
 */