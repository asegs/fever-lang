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
  } else if (fnName === "show") {
    console.log(args[0].value);
    return args[0];
  } else if (fnName === "->") {
    return args[0].value.map(() => args[1].value);
  }
}

function evaluate(realNode: FeverVar): FeverVar {
  if (realNode.type.alias && realNode.type.alias === "CALL") {
    const [name, args] = getFunctionNameAndArgs(realNode);
    return dispatchFunction(name, args.map(evaluate));
  }
  if (realNode.type.baseName === "VARIABLE") {
    const varName = realNode.value;
    if (ctx.exists(varName)) {
      return ctx.get(varName);
    }
  }
  return realNode;
}

function handle(text: string): void {
  const parsedTree = parse(text);
  const realNode = abstractNodeToRealNode(parsedTree);
  const result = evaluate(realNode);
  console.dir(result, { depth: null });
}
