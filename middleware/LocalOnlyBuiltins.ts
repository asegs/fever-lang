import { readFileSync } from "fs";
import readlineSync from "readline-sync";
import { newFunction } from "./Builtins.ts";
import {
  createList,
  createTypedList,
  createVar,
  Meta,
  Primitives,
} from "./Types.ts";
import { ctx, interpret } from "../internals/Interpreter";
import { inferListType } from "./Literals";
import { feverStringFromJsString } from "../lib/StringUtils";
import {charListToJsString, morphTypes} from "../lib/TypeUtils";

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
      let pathSlug = charListToJsString(path);
      if (!pathSlug.endsWith(".fv")) {
        pathSlug += ".fv";
      }
      const dir = process.cwd();
      const fileText = readFileSync(dir + "/" + pathSlug).toString();
      const fileLines = fileText.split("\n");
      for (const line of fileLines) {
        interpret(line);
      }
      return createVar(true, Primitives.BOOLEAN);
    }),
  ],
  parseCsv: [
    newFunction(1, [Meta.STRING], ([csvString]) => {
      const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const realString = charListToJsString(csvString);
      const feverList = realString.split(csvRegex).map(feverStringFromJsString);
      return createList(feverList, Meta.STRING);
    }),
    newFunction(
      2,
      [Meta.STRING, createTypedList(Primitives.TYPE)],
      ([csvString, typeCasts]) => {
        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const realString = charListToJsString(csvString);
        const feverList = realString
          .split(csvRegex)
          .map(feverStringFromJsString)
          .map((feverString, index) =>
            morphTypes(feverString, typeCasts.value[index], ctx),
          );
        return createList(feverList, inferListType(feverList));
      },
    ),
  ],
};
