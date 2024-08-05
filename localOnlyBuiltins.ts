import { readFileSync } from "fs";
import { newFunction } from "./builtins.ts";
import {
  charListToJsString,
  createTypedList,
  createVar,
  feverStringFromJsString,
  Meta,
} from "./types.ts";

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
};
