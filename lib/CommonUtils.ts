import { Context } from "../internals/Context";
import { createTypeVar, FeverVar } from "../middleware/Types";
import { dispatchFunction } from "../internals/Interpreter";

export function newOfType(t, args, ctx: Context) {
  const typeVar = createTypeVar(t);
  return dispatchFunction("new", [typeVar, ...args]);
}

export function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

export function stringify(value: FeverVar) {
  return dispatchFunction("stringify", [value]);
}

export function equals(v1: FeverVar, v2: FeverVar) {
  return dispatchFunction("==", [v1, v2]);
}
