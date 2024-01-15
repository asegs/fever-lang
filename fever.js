import { externalFile } from "./interactives/file.js";
import { prompt } from "./interactives/repl.js";
import { instance } from "./interpreter.js";

const [variables, morphisms] = instance();

if (process.argv.length > 2) {
  for (let i = 2; i < process.argv.length; i++) {
    const name = process.argv[i];
    externalFile(name, variables, morphisms);
  }
}

prompt(variables, morphisms);
