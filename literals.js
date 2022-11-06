import {createVar, primitives} from './types.js'

const everyCharNumeric = (string) => {
    for (let i = 0 ; i < string.length ; i ++ ) {
        if (string[i] < '0' || string[i] > '9') {
            return false;
        }
    }
    return true;
}

const startsAndEndsWith = (str, char) => {
    return str[0] === char && str[str.length - 1];
}

const isStringLiteral = (string) => {
    if (string.length < 2) {
        return false;
    }
    return startsAndEndsWith(string, '"') || startsAndEndsWith(string, "'");
}

//Will need to take variable table and maybe function table
const inferTypeAndValue = (string) => {
    if (everyCharNumeric(string)) {
        return createVar(Number(string), primitives.NUMBER);
    } else if (isStringLiteral(string)) {
        return createVar(string.slice(1, string.length - 1), primitives.STRING);
    }
}

console.log(inferTypeAndValue("3"))
console.log(inferTypeAndValue('"hello"'))
console.log(inferTypeAndValue("'hello'"))
console.log(inferTypeAndValue("true"))
console.log(inferTypeAndValue("[1,2,3]"))
console.log(inferTypeAndValue('[1,2,"hello"'))
console.log(inferTypeAndValue("(1,2)"))
console.log(inferTypeAndValue("(1,'hello')"))
console.log(inferTypeAndValue("(1,(2,'hello'))"))
console.log(inferTypeAndValue("(+(3,1))"))