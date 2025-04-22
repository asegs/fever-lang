import { callFunctionByReference } from "../internals/Interpreter.js";

export function morphTypes(value, toType, ctx) {
  let intermediateValue = value;
  const typePath = ctx.pathBetween(value.type, toType.value);
  for (let i = 0; i < typePath.length - 1; i++) {
    const transformation = ctx.morphisms[typePath[i]][typePath[i + 1]];
    intermediateValue = callFunctionByReference(
      transformation,
      [intermediateValue],
      ctx,
      "morph_transform",
    );
  }
  return intermediateValue;
}
