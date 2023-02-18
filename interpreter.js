import {lex} from "./prefixer.js";
import {inferTypeAndValue} from "./literals.js";

const goals = {
    EVALUATE: Symbol("EVALUATE"),
    MISSING: Symbol("MISSING"),
}

//.. as infix function

const interpret = (text, variables, functions, goal) => {
    const lexed = lex()
    const result = evaluate(lexed, variables, functions, goal);
}

const stripRedundantParens = (text) => {
    while (text.startsWith("(") && text.endsWith(")")) {
        text = text.slice(1, text.length - 1);
    }
    return text;
}

const isFunctionCall = (text) => {
    return /^.+\(.*\)$/gm.test(text);
}

const callFunction = (name, args, functions) => {
    if (!(name in functions)) {
        throw "Unknown function " + name + " invoked."
    }

    const func = functions[name];
    const candidates = func.filter(f => f.arity === args.length);

    if (!candidates) {
        throw "No definition of " + name + " that takes " + args.length + " arguments";
    }
}

const evaluate = (text, variables, functions, goal) => {
    const cleanText = stripRedundantParens(text);
    if (isFunctionCall(text)) {
        //interpret recursively
    }

    return inferTypeAndValue(cleanText, variables, functions);
}