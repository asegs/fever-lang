import {createTypedList, createTypedTuple, createVar, meta, primitives, typesEqual} from './types.js'

const everyCharNumeric = (string) => {
   return string.match(/^-?[0-9]+$/g) || string.match(/^-?[0-9]+\.[0-9]+$/g);
}

const startsAndEndsWith = (str, char) => {
    return str[0] === char && str[str.length - 1];
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


const parseCollectionToItems = (string) => {
    const internal = string.slice(1, string.length - 1);
    let brackets = 0;
    let parens = 0;
    let singleQuotes = 0;
    let doubleQuotes = 0;
    let currentBuffer = "";
    const result = [];
    for (let i = 0 ; i < internal.length ; i ++ ) {
        const char = internal[i];
        switch (char) {
            case '"':
                doubleQuotes ++;
                break;
            case "'":
                singleQuotes ++;
                break;
            case '[':
                brackets ++;
                break;
            case ']':
                brackets --;
                break;
            case '(':
                parens ++;
                break;
            case ')':
                parens --;
                break;
        }
        if (char === ',' && parens === 0 && brackets === 0 && doubleQuotes % 2 === 0 && singleQuotes % 2 === 0 && currentBuffer.length > 0) {
            result.push(currentBuffer);
            currentBuffer = "";
        } else {
            currentBuffer += char;
        }
    }
    if (currentBuffer.length > 0) {
        result.push(currentBuffer);
    }
    return result;
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
    }
}

console.log(inferTypeAndValue("3"))
console.log(inferTypeAndValue("3.5"))
console.log(inferTypeAndValue("-82.13"))
console.log(inferTypeAndValue('"hello"'))
console.log(inferTypeAndValue("'hello'"))
console.log(inferTypeAndValue("true"))
console.log(inferTypeAndValue("false"))
console.log(inferTypeAndValue("[1,2,3]"))
console.log(inferTypeAndValue('[1,2,"hello"]'))
console.log(inferTypeAndValue("(1,2)"))
console.log(inferTypeAndValue("(1,'hello')"))
console.log(inferTypeAndValue("(1,(2,'hello'))"))
console.log(inferTypeAndValue("(+(3,1))"))