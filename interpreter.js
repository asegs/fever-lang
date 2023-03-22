import {lex, trimAndSplitArray} from "./prefixer.js";
import {inferTypeAndValue} from "./literals.js";
import {typeCloseness} from "./types.js";
import {ScopedVars} from "./vars.js";
import {Morphisms} from "./morphisms.js";
import {builtins, standardLib} from "./builtins.js";

export const goals = {
    EVALUATE: Symbol("EVALUATE"),
    MISSING: Symbol("MISSING"),
}

//.. as infix function

export const interpret = (text, variables, functions, morphisms ,goal) => {
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
        //For the conditions analysis
        variables.enterScope();
        let score = 0;
        for (let i = 0 ; i < candidateFunction.types.length ; i ++ ) {
            const type = candidateFunction.types[i];
            const condition = candidateFunction.conditions[i];
            const specificity = 'specificities' in candidateFunction ? candidateFunction.specificities[i] : 1;
            const intScore = typeCloseness(type, args[i].type) * (condition(args[i], variables, functions, morphisms) ? 1 : 0) * specificity;
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
        variables.exitScope();
    }
    if (bestScore <= 0) {
        throw "No satisfactory match for " + name + ".";
    }
    return bestCandidate.function(args, variables, functions, morphisms);
}

export const findMissing = (args) => {
    const missingLeaves = args.filter(arg => 'name' in arg);
    const arrays = args.filter(arg => Array.isArray(arg));
    const flattenedLeaves = arrays.flatMap(array => findMissing(array));
    return missingLeaves.concat(flattenedLeaves);
}



export const evaluate = (text, variables, functions, morphisms, goal) => {
    //const cleanText = stripRedundantParens(text);
    const cleanText = text;
    if (isFunctionCall(text)) {
        const [name, body] = splitIntoNameAndBody(text);
        const args = trimAndSplitArray(body).map(e => evaluate(e, variables, functions, morphisms, goal));
        if (goal === goals.EVALUATE) {
            return callFunction(name, args, variables, functions, morphisms);
        } else {
            return findMissing(args, variables, functions, morphisms);
        }
    }

    const result = inferTypeAndValue(cleanText, variables, functions, morphisms, goal);
    if (goal === goals.MISSING ) {
        if (('value' in result) && Array.isArray(result.value)) {
            return findMissing(result.value);
        }
        if ('name' in result) {
            return [result];
        }

        if (Array.isArray(result)) {
            return findMissing(result);
        }

        return [];
    }
    return result;
}

export const instance = () => {
    const variables = new ScopedVars();
    const functions = builtins;
    const morphisms = new Morphisms();

    standardLib.forEach(line => {
        interpret(line, variables, functions, morphisms, goals.EVALUATE);
    });

    return [variables, functions, morphisms];

}
