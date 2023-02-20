import {lex, splitArray} from "./prefixer.js";
import {inferTypeAndValue} from "./literals.js";

const goals = {
    EVALUATE: Symbol("EVALUATE"),
    MISSING: Symbol("MISSING"),
}

//.. as infix function

const interpret = (text, variables, functions, morphisms ,goal) => {
    const lexed = lex()
    return evaluate(lexed, variables, functions, morphisms, goal);
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

const splitIntoNameAndBody = (text) => {
    const firstParen = text.indexOf("(");
    return [text.slice(0, firstParen), text.slice(firstParen)]
}

const callFunction = (name, args, functions, morphisms) => {
    if (!(name in functions)) {
        throw "Unknown function " + name + " invoked."
    }

    const func = functions[name];
    const candidates = func.filter(f => f.arity === args.length);

    if (!candidates) {
        throw "No definition of " + name + " that takes " + args.length + " arguments";
    }
}

const evaluate = (text, variables, functions, morphisms, goal) => {
    const cleanText = stripRedundantParens(text);
    if (isFunctionCall(text)) {
        const [name, body] = splitIntoNameAndBody(text);
        const args = splitArray(body).map(e => evaluate(e, variables, functions, morphisms, goal));
        return callFunction(name, args, functions, morphisms);
    }

    return inferTypeAndValue(cleanText, variables, functions);
}