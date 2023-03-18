import {createInterface} from 'readline';
import {builtins} from "../builtins.js";
import {goals, interpret} from "../interpreter.js";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

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