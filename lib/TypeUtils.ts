import { callFunctionByReference } from "../internals/Interpreter";

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

//Could definitely tune performance!
export function charListToJsString (v) {
  let concatenated = "";
  for (let i = 0; i < v.value.length; i++) {
    concatenated += v.value[i].value;
  }
  return concatenated;
};
