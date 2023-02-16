import {lexer, splitAssignment} from "./prefixer.js";

const goals = {
    EVALUATE: Symbol("EVALUATE"),
    MISSING: Symbol("MISSING"),
}

//.. as infix function

const interpret = (text, variables, functions, goal) => {
    const [name, body] = splitAssignment(text);
    const result = evaluate(body, variables, functions, goal);
}

const evaluate = (text, variables, functions, goal) => {

}

const exprToTree = (text) => {
    //...
}