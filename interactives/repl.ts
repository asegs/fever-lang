import { createInterface } from "readline";
import { ctx, dispatchFunction, interpret } from "../interpreter.ts";
import { Meta, Primitives, Shorthands } from "../types.ts";

export const prompt = () => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: complete,
  });

  promptRec(rl);
};

const promptRec = (int) => {
  int.question(">", (inp) => {
    try {
      const result = interpret(inp);
      dispatchFunction("show", [result]);
    } catch (e) {
      console.log(e);
    }
    promptRec(int);
  });
};

const breakingChars = ["(", ")", ",", "[", "]", ":", "{", "}", " ", "="];
const getFromLeft = (line) => {
  let terminator = "";
  for (let i = line.length - 1; i >= 0; i--) {
    const char = line[i];
    if (breakingChars.includes(char)) {
      return [char, terminator];
    }

    terminator = char + terminator;
  }

  return ["", terminator];
};

const completeLine = (line, partial, match) => {
  return line.slice(0, line.length - partial.length) + match;
};

const complete = (line) => {
  const [breaker, token] = getFromLeft(line);
  let varNames;
  if (breaker === ":") {
    //Options include types
    varNames = Object.keys(Primitives)
      .concat(Object.keys(Meta))
      .concat(Object.keys(Shorthands))
      .map((name) => name.toLowerCase());
  } else {
    //Normal values
    varNames = Object.keys(ctx.flattenToMap());
  }
  const options = varNames.filter((v) => v.startsWith(token));
  return [options, token];
};
