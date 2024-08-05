import { readFileSync } from "fs";
import readlineSync from "readline-sync";
import { newFunction } from "./builtins.ts";
import {
  charListToJsString,
  createTypedList,
  createVar,
  feverStringFromJsString,
  Meta,
  Primitives,
} from "./types.ts";
import { interpret } from "./interpreter.js";

export const LOCAL_ONLY_BUILTINS = {
  read: [
    newFunction(1, [Meta.STRING], ([path]) => {
      // We should have global state based on a passed in file to get its directory.
      const pathSlug = charListToJsString(path);
      const dir = process.cwd();
      const fileText = readFileSync(dir + "/" + pathSlug).toString();
      const fileLines = fileText.split("\n");
      return createVar(
        fileLines.map((line) => feverStringFromJsString(line)),
        createTypedList(Meta.STRING),
      );
    }),
  ],
  input: [
    newFunction(1, [Meta.STRING], ([promptText]) => {
      const response = readlineSync.question(charListToJsString(promptText));
      return feverStringFromJsString(response);
    }),
  ],
  import: [
    newFunction(1, [Meta.STRING], ([path]) => {
      // This is the dumbest import ever
      const pathSlug = charListToJsString(path);
      const dir = process.cwd();
      const fileText = readFileSync(dir + "/" + pathSlug).toString();
      const fileLines = fileText.split("\n");
      for (const line of fileLines) {
        interpret(line);
      }
      return createVar(true, Primitives.BOOLEAN);
    }),
  ],
};
