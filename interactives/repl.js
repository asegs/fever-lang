import {createInterface} from 'readline';
import {builtins} from "../builtins.js";
import {callFunction, goals, interpret} from "../interpreter.js";

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
            return terminator;
        }

        terminator = char + terminator;
    }

    return terminator;
}

const completeLine = (line, partial, match) => {
    return line.slice(0, line.length - partial.length) + match;
}

const complete = (line) => {
    const varNames = Object.keys(vars.flattenToMap());
    const token = getFromLeft(line);
    const options = varNames.filter(v => v.startsWith(token));
    const completions = options.map(option => completeLine(line, token, option));
    return [options.length > 1 ? options : completions, line];
}