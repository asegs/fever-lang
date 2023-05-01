import {lex, trimAndSplitArray} from "./prefixer.js";
import {inferTypeAndValue} from "./literals.js";
import {typeSatisfaction, createVar, isAlias, primitives, createError, createTypeVar, isGeneric} from "./types.js";
import {ScopedVars} from "./vars.js";
import {Morphisms} from "./morphisms.js";
import {builtins, morphTypes, registerBuiltins, standardLib} from "./builtins.js";
import {internalFile} from "./interactives/file.js";

export const goals = {
    EVALUATE: Symbol("EVALUATE"),
    MISSING: Symbol("MISSING"),
}

//.. as infix function

export const interpret = (text, variables, morphisms ,goal) => {
    const lexed = lex(text)
    //Uncomment for debugging
    //console.log(lexed)
    return evaluate(lexed, variables, morphisms, goal);
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

const assignGenericTableToTypeVars = (vars, genericTable) => {
    for (const genericName of Object.keys(genericTable)) {
        vars.assignValue(genericName, createTypeVar(genericTable[genericName]));
    }
}

const unassignGenericTableToTypeVars = (vars, genericTable) => {
    for (const genericName of Object.keys(genericTable)) {
        vars.deleteValue(genericName);
    }
}

export const callFunctionByReference = (ref, args, variables, morphisms, name) => {
    const errors = args.filter(arg => arg.type.baseName === 'ERROR');

    if (errors.length > 0) {
        if (name !== 'show') {
            return errors[0];
        }
    }

    const func = ref['invocations'];
    const candidates = func.filter(f => f.arity === args.length);

    if (candidates.length === 0) {
        return createError("No definition of " + name + " that takes " + args.length + " arguments");
    }

    let bestScore = 0;
    let bestCandidate = undefined;
    let modifiedArgs = args;
    let usedGenericTable = {};
    for (const candidateFunction of candidates) {
        //For the conditions analysis
        variables.enterScope();
        const tempArgs = [...args];
        const genericTable = {};
        let score = 0;
        for (let i = 0 ; i < candidateFunction.types.length ; i ++ ) {
            let type = candidateFunction.types[i];
            if (isGeneric(type)) {
                const genericName = type.generic;
                if (genericName in genericTable) {
                    type = genericTable[genericName];
                } else {
                    genericTable[genericName] = args[i].type;
                    variables.assignValue(genericName, genericTable[genericName]);
                }
            }
            const condition = candidateFunction.conditions[i];
            const specificity = 'specificities' in candidateFunction ? candidateFunction.specificities[i] : 1;
            let typeScore = typeSatisfaction(args[i].type, type);
            if (typeScore === 0) {
                //Try to find a morphism path
                const path = morphisms.pathBetween(args[i].type, type);
                if (path.length === 0) {
                    score = -1;
                    break;
                }
                tempArgs[i] = morphTypes(args[i], createTypeVar(type), variables, morphisms);
                //Farther morphism step means lower type score
                typeScore = Math.pow(0.5, path.length - 1);
            }

            const intScore = typeScore * (condition(tempArgs[i], variables, morphisms) ? 1 : 0) * specificity;
            if (intScore === 0) {
                score = -1;
                break;
            }
            score += intScore;
        }
        if (score >= bestScore) {
            bestScore = score;
            bestCandidate = candidateFunction;
            modifiedArgs = tempArgs;
            usedGenericTable = genericTable;
        }
        variables.exitScope();
    }

    //Auto-operations on tuples
    //Best match was maybe an ANY for condition and type
    if (bestScore / modifiedArgs.length <= 0.25) {
        //All arguments are tuples
        if (modifiedArgs.every(entry => entry.type.baseName === "TUPLE")) {
            const tupleSize = modifiedArgs[0].value.length;
            //All tuples are the same size
            if (modifiedArgs.every(arg => arg.value.length === tupleSize)) {
                const result = [];
                assignGenericTableToTypeVars(variables, usedGenericTable);
                for (let i = 0 ; i < tupleSize ; i ++ ) {
                    result.push(callFunctionByReference(ref, modifiedArgs.map(arg => arg.value[i]), variables, morphisms));
                }
                unassignGenericTableToTypeVars(variables, usedGenericTable);

                if (result.every(elem => elem.type.baseName !== 'ERROR')) {
                    return createVar(result, args[0].type);
                }
            }
        }
    }


    if (bestScore <= 0) {
        return createError("No satisfactory match for " + name + ".");
    }

    assignGenericTableToTypeVars(variables, usedGenericTable);
    const result = bestCandidate.function(modifiedArgs, variables, morphisms);
    unassignGenericTableToTypeVars(variables, usedGenericTable);

    return result;
}

export const callFunction = (name, args, variables, morphisms) => {

    const named = variables.getOrNull(name);
    if (!named) {
        return createError("Unknown function " + name + " invoked.");
    }

    if (!isAlias(named.type) || named.type.alias !== "FUNCTION") {
        return named;
    }

    return callFunctionByReference(named, args, variables, morphisms, name);


}

export const findMissing = (args) => {
    const missingLeaves = args.filter(arg => 'name' in arg);
    const arrays = args.filter(arg => Array.isArray(arg));
    const flattenedLeaves = arrays.flatMap(array => findMissing(array));
    return missingLeaves.concat(flattenedLeaves);
}



export const evaluate = (text, variables, morphisms, goal) => {
    //const cleanText = stripRedundantParens(text);
    const cleanText = text;
    if (isFunctionCall(text)) {
        const [name, body] = splitIntoNameAndBody(text);
        const args = trimAndSplitArray(body).map(e => evaluate(e, variables, morphisms, goal));
        if (goal === goals.EVALUATE) {
            return callFunction(name, args, variables, morphisms);
        } else {
            if (variables.hasVariable(name)) {
                return findMissing(args, variables, morphisms);
            } else {
                return findMissing([{'name': name, 'type': 'FUNCTION'}, ...args], variables, morphisms);
            }

        }
    }

    const result = inferTypeAndValue(cleanText, variables, morphisms, goal);
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
    const morphisms = new Morphisms();

    registerBuiltins(variables);

    internalFile('../examples/lib.fv', variables, morphisms);


    return [variables, morphisms];

}
