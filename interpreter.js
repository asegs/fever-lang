import {lexer} from "./prefixer.js";

const goals = {
    EVALUATE: Symbol("EVALUATE"),
    MISSING: Symbol("MISSING"),
}

//.. as infix function

const interpret = (text, variables, functions, goal) => {
    const firstEq = text.indexOf("=");
    const name = firstEq !== -1 ? text.slice(0, firstEq) : "_";
    const body = firstEq !== -1 ? text.slice(firstEq + 1) : text;

}