import { abstractNodeToRealNode } from "./literals.ts";
import { parse } from "./parser.ts";
import { Context } from "./vars.ts";
import {
  createVar,
  FeverVar,
  getFunctionNameAndArgs,
  Primitives,
} from "./types.ts";

const ctx = new Context();

function dispatchFunction(fnName: string, args: FeverVar[]): FeverVar {
  if (fnName === "=") {
    const name = args[0];
    const val = args[1];
    ctx.set(name.value, val);
    return val;
  } else if (fnName === "+") {
    const sum = args[0].value + args[1].value;
    return createVar(sum, Primitives.NUMBER);
  }
}

function evaluate(realNode: FeverVar): FeverVar {
  if (realNode.type.alias && realNode.type.alias === "CALL") {
    const [name, args] = getFunctionNameAndArgs(realNode);
    return dispatchFunction(name, args.map(evaluate));
  }
  return realNode;
}

function handle(text: string): void {
  const parsedTree = parse(text);
  const realNode = abstractNodeToRealNode(parsedTree);
  const result = evaluate(realNode);
  console.dir(result, { depth: null });
}

handle("x = 3 + 5");
