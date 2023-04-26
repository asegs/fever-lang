import {createInterface} from 'readline';
import {builtins} from "../builtins.js";
import {callFunction, goals, interpret} from "../interpreter.js";
import {primitives, meta, shorthands} from "../types.js";

let vars;
let morphisms;

export const prompt = (v, m) => {
    const rl = createInterface(
        {
            input: process.stdin,
            output: process.stdout,
            completer: complete
        }
    );
    vars = v;
    morphisms = m;

    promptRec(rl, vars, morphisms);
}

const promptRec = (int) => {
    int.question(">", (inp) => {
        const result = interpret(inp, vars, morphisms, goals.EVALUATE);
        callFunction('show', [result], vars, morphisms);
        promptRec(int);
    })
}

const breakingChars = ['(',')',',','[',']',':','{','}',' ','='];
const getFromLeft = (line) => {
    let terminator = '';
    for (let i = line.length - 1 ; i >= 0 ; i -- ) {
        const char = line[i];
        if (breakingChars.includes(char)) {
            return [char, terminator];
        }

        terminator = char + terminator;
    }

    return ['', terminator];
}

const completeLine = (line, partial, match) => {
    return line.slice(0, line.length - partial.length) + match;
}

const complete = (line) => {
    const [breaker, token] = getFromLeft(line);
    let varNames;
    if (breaker === ':') {
        //Options include types
        varNames = Object.keys(primitives).concat(Object.keys(meta)).concat(Object.keys(shorthands)).map(name => name.toLowerCase());
    } else {
        //Normal values
        varNames = Object.keys(vars.flattenToMap());
    }
    const options = varNames.filter(v => v.startsWith(token));
    return [options, token];
}