import {lex, trimAndSplitArray} from "./prefixer.js";
import {inferTypeAndValue} from "./literals.js";
import {createInterface} from 'readline';
import {typeCloseness} from "./types.js";
import {ScopedVars} from "./vars.js";
import {builtins} from "./builtins.js";
import {Morphisms} from "./morphisms.js";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

export const goals = {
    EVALUATE: Symbol("EVALUATE"),
    MISSING: Symbol("MISSING"),
}

//.. as infix function

const interpret = (text, variables, functions, morphisms ,goal) => {
    const lexed = lex(text)
    //Uncomment for debugging
    //console.log(lexed)
    return evaluate(lexed, variables, functions, morphisms, goal);
}

const stripRedundantParens = (text) => {
    while (text.startsWith("(") && text.endsWith(")")) {
        text = text.slice(1, text.length - 1);
    }
    return text;
}

const isFunctionCall = (text) => {
    return /^[^(]+\(.*\)$/gm.test(text);
}

const splitIntoNameAndBody = (text) => {
    const firstParen = text.indexOf("(");
    return [text.slice(0, firstParen), text.slice(firstParen)]
}

const callFunction = (name, args, variables, functions, morphisms) => {
    if (!(name in functions)) {
        throw "Unknown function " + name + " invoked."
    }

    const func = functions[name];
    const candidates = func.filter(f => f.arity === args.length);

    if (candidates.length === 0) {
        throw "No definition of " + name + " that takes " + args.length + " arguments";
    }
    let bestScore = 0;
    let bestCandidate = undefined;
    for (const candidateFunction of candidates) {
        let score = 0;
        for (let i = 0 ; i < candidateFunction.types.length ; i ++ ) {
            const type = candidateFunction.types[i];
            const condition = candidateFunction.conditions[i];
            const intScore = typeCloseness(type, args[i].type) * (condition() ? 1 : 0);
            if (intScore === 0) {
                score = -1;
                break;
            }
            score += intScore;
        }
        if (score >= bestScore) {
            bestScore = score;
            bestCandidate = candidateFunction;
        }
    }
    if (bestScore <= 0) {
        throw "No satisfactory match for " + name + ".";
    }
    return bestCandidate.function(args, variables, functions, morphisms);
}

export const evaluate = (text, variables, functions, morphisms, goal) => {
    //const cleanText = stripRedundantParens(text);
    const cleanText = text;
    if (isFunctionCall(text)) {
        const [name, body] = splitIntoNameAndBody(text);
        const args = trimAndSplitArray(body).map(e => evaluate(e, variables, functions, morphisms, goal));
        return callFunction(name, args,variables, functions, morphisms);
    }

    return inferTypeAndValue(cleanText, variables, functions);
}

const v = new ScopedVars();

const prompt = () => {
    rl.question(">", (inp) => {
        try {
            interpret(inp, v, builtins, new Morphisms(), goals.EVALUATE);
            evaluate("show(_)", v, builtins, new Morphisms(), goals.EVALUATE)
        } catch (e) {
            console.log(e)
        }
        prompt();
    })
}
prompt();
