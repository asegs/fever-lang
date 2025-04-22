import { createError, FeverVar } from "../middleware/Types.js";

export function argumentCountError(
  name: string,
  argumentCount: number,
): FeverVar {
  return createError(
    "No definition of " + name + " that takes " + argumentCount + " arguments",
  );
}

export function noPatternMatch(name: string) {
  return createError("No satisfactory match for " + name + ".");
}

export function indexOutOfRange(index: number, structureString: string) {
  return createError("Index " + index + " out of range on " + structureString);
}

export function failureToParseString(value: string, targetType: string) {
  return createError(
    '"' + value + '" cannot be interpreted as a ' + targetType + ".",
  );
}

export function unknownFunctionError(name: string) {
  return createError("Unknown function " + name + " invoked.");
}
