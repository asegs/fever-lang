import {file} from "./interactives/file.js";
import {prompt} from "./interactives/repl.js";
import {instance} from "./interpreter.js";

const [variables, functions, morphisms] = instance();

if (process.argv.length > 2) {
    for (let i = 2 ; i < process.argv.length ; i ++ ) {
        const name = process.argv[i];
        file(name, variables, functions, morphisms);
    }
}

prompt(variables, functions, morphisms);