import {ScopedVars} from "./vars.js";
import {builtins} from "./builtins.js";
import {Morphisms} from "./morphisms.js";
import {file} from "./interactives/file.js";
import {prompt} from "./interactives/repl.js";

const variables = new ScopedVars();
const functions = builtins;
const morphisms = new Morphisms();

if (process.argv.length > 2) {
    for (let i = 2 ; i < process.argv.length ; i ++ ) {
        const name = process.argv[i];
        file(name, variables, functions, morphisms);
    }
}

prompt(variables, functions, morphisms);