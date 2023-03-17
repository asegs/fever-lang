import {lex, trimAndSplitArray} from "./prefixer.js";
import {inferTypeAndValue} from "./literals.js";
import {createInterface} from 'readline';
import {typeCloseness} from "./types.js";
import * as path from "path";
import * as fs from "fs";
import {builtins} from "./builtins.js";

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

window.interpret = interpret;

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

export const prompt = (vars, functions, morphisms) => {
    rl.question(">", (inp) => {
        try {
            const result = interpret(inp, vars, functions, morphisms, goals.EVALUATE);
            builtins.show[0]['function']([result]);
        } catch (e) {
            console.log(e)
        }
        prompt(vars, functions, morphisms);
    })
}

//Handle comments better later on
const lineShouldBeEvaluated = (line) => {
    return line.length > 0 && !line.startsWith("//");
}

export const file = (inputFile, vars, functions, morphisms) => {
    const inputPath = path.resolve(inputFile);
    if (!fs.existsSync(inputPath)) {
        console.error("No such input file: " + inputPath);
        process.exit(1);
    }
    const file = fs.readFileSync(inputPath,'utf8');
    file.split('\n').forEach((line, index) => {
        try {
            if (lineShouldBeEvaluated(line)) {
                interpret(line, vars, functions, morphisms, goals.EVALUATE);
            }
        } catch (e) {
            console.log("Error on line " + (index + 1) + ": " + e);
        }
    });
}