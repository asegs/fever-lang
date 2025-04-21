import * as path from "path";
import * as fs from "fs";
import { ctx, interpret } from "../internals/Interpreter.ts";
import {
  breakdown,
  clear,
  orderedHistory,
  timingBreakdown,
  totalCalls,
} from "../middleware/CallStackDebugger.ts";
import { SpecialAction } from "../Fever.js";
import { splitGeneral } from "../internals/Parser.js";

//Handle comments better later on
export const lineShouldBeEvaluated = (line: string) => {
  return line.length > 0 && !line.startsWith("//");
};

function file(inputPath: string, specialAction: SpecialAction) {
  if (specialAction === SpecialAction.PROFILE) {
    ctx.useCallStack = true;
  }
  if (!fs.existsSync(inputPath)) {
    console.error("No such input file: " + inputPath);
    process.exit(1);
  }
  const file = fs.readFileSync(inputPath, "utf8");
  clear();
  splitGeneral(file, "\n").forEach((line, index) => {
    try {
      if (lineShouldBeEvaluated(line)) {
        interpret(line);
      } else {
        if (ctx.useCallStack) {
          clear();
        }
      }
    } catch (e) {
      console.log(
        "Error on line " + (index + 1) + ": " + (e.stack ? e.stack : e),
      );
    }
  });
  if (ctx.useCallStack) {
    console.log(orderedHistory());
    console.log(totalCalls());
    console.log(breakdown());
    console.log(timingBreakdown());
  }
}

export function internalFile(inputFile: string) {
  let dirPath = import.meta.url;
  dirPath = dirPath.slice(7, dirPath.length - 7);
  const inputPath = path.resolve(dirPath + inputFile);
  file(inputPath, SpecialAction.NONE);
}

export function externalFile(inputFile: string, specialAction: SpecialAction) {
  file(inputFile, specialAction);
}
