import { createError, FeverVar } from "../types.js";

export function argumentCountError(
  name: string,
  argumentCount: number,
): FeverVar {
  return createError(
    "No definition of " + name + " that takes " + argumentCount + " arguments",
  );
}
