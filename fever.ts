import { externalFile } from "./interactives/file.js";
import { prompt } from "./interactives/repl.ts";
import { ctx } from "./interpreter.ts";

if (process.argv.length > 2) {
  for (let i = 2; i < process.argv.length; i++) {
    const name = process.argv[i];
    externalFile(name, ctx);
  }
}

prompt();
