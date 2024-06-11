import { prompt } from "./interactives/repl.ts";
import { ctx } from "./interpreter.ts";
import { externalFile } from "./interactives/file.ts";

if (process.argv.length > 2) {
  for (let i = 2; i < process.argv.length; i++) {
    const name = process.argv[i];
    externalFile(name);
  }
}

prompt();
