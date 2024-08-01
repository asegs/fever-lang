import * as path from "path";
import * as fs from "fs";
import { interpret } from "../interpreter.ts";
import { Context } from "../vars.ts";

//Handle comments better later on
const lineShouldBeEvaluated = (line: string) => {
  return line.length > 0 && !line.startsWith("//");
};

function file(inputPath: string) {
  if (!fs.existsSync(inputPath)) {
    console.error("No such input file: " + inputPath);
    process.exit(1);
  }
  const file = fs.readFileSync(inputPath, "utf8");
  file.split("\n").forEach((line, index) => {
    try {
      if (lineShouldBeEvaluated(line)) {
        interpret(line);
      }
    } catch (e) {
      console.log(
        "Error on line " + (index + 1) + ": " + (e.stack ? e.stack : e),
      );
    }
  });
}

export function internalFile(inputFile: string) {
  let dirPath = import.meta.url;
  dirPath = dirPath.slice(7, dirPath.length - 7);
  const inputPath = path.resolve(dirPath + inputFile);
  file(inputPath);
}

export function externalFile(inputFile: string) {
  file(inputFile);
}
