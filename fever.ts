import { prompt } from "./interactives/repl.ts";
import { ctx } from "./interpreter.ts";
import { externalFile } from "./interactives/file.ts";

export enum SpecialAction {
  NONE,
  PROFILE,
}
if (process.argv.length > 2) {
  const filename = process.argv[2];
  let specialAction = SpecialAction.NONE;
  if (process.argv.length > 3) {
    switch (process.argv[3]) {
      case "--prof":
        specialAction = SpecialAction.PROFILE;
        break;
      default:
        break;
    }
  }
  externalFile(filename, specialAction);
}

prompt();
