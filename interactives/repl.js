import {createInterface} from 'readline';
import {builtins} from "../builtins.js";
import {callFunction, goals, interpret} from "../interpreter.js";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

export const prompt = (vars, morphisms) => {
    rl.question(">", (inp) => {
        const result = interpret(inp, vars, morphisms, goals.EVALUATE);
        callFunction('show', [result], vars, morphisms);
        prompt(vars, morphisms);
    })
}