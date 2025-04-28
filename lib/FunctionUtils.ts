import {
  dispatchFunction,
  evaluate,
  recreateExpressionWithVariables,
} from "../internals/Interpreter";
import {
  aliasMatches,
  charListToJsString,
  createVar,
  FeverVar,
  isAlias,
  Meta,
  Primitives,
  TypeWeights,
} from "../middleware/Types";
import { Context } from "../internals/Context.ts";
import { newFunction } from "../middleware/Builtins.ts";

export const nativeFunctionMessage = "<natively defined function>";

export function typesFromSignature(signature: FeverVar) {
  return signature.value.map((i) => i.value[1].value);
}

export function conditionsFromSignature(signature: FeverVar) {
  const conditions = [];

  const sigPatterns = signature.value;
  const size = sigPatterns.length;
  for (let i = 0; i < size; i++) {
    const pattern = sigPatterns[i];
    const condition = pattern.value[0];
    const conditionName = condition.value[0];
    const conditionExpression = condition.value[1];
    conditions.push((argument, ctx) => {
      ctx.assignValue(conditionName.value, argument);
      const result = evaluate(conditionExpression.value);
      if (result.type.baseName === "ERROR") {
        return false;
      }
      return result.value;
    });
  }
  return conditions;
}

export function namesFromSignature(signature: FeverVar) {
  return signature.value.map((i: FeverVar) => i.value[0].value[0].value);
}

export function specificitiesFromSignature(signature: FeverVar) {
  return signature.value.map((i: FeverVar) => i.value[0].value[2].value);
}

export function registerNewFunction(
  name: string,
  variables: Context,
  functionObject,
  rawCase?,
) {
  let newCase;

  if (rawCase) {
    newCase = rawCase;
  } else {
    newCase = generateCaseFromNative(functionObject);
  }
  const named = variables.getOrNull(name);
  if (!named) {
    const newFunc = createVar([newCase], Meta.FUNCTION);
    newFunc["invocations"] = [functionObject];
    variables.assignValue(name, newFunc);
    return newFunc;
  }

  named.invocations.push(functionObject);
  named.value.push(newCase);
  return named;
}

export function generateCaseFromNative(functionObject) {
  const types = functionObject["types"];
  const conditions = functionObject["conditions"];
  const specificities = functionObject["specificities"];
  const names = argNamesFromFunction(functionObject["function"].toString());

  const patterns = [];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const condition = conditions[i];
    const pattern = createVar(
      [
        createVar(
          [
            createVar(names[i], Meta.STRING),
            createVar(
              condition.toString() === "() => true"
                ? "true"
                : nativeFunctionMessage,
              Primitives.EXPRESSION,
            ),
            createVar(specificities[i], Primitives.NUMBER),
          ],
          Meta.CONDITION,
        ),
        createVar(type, Primitives.TYPE),
      ],
      Meta.PATTERN,
    );
    patterns.push(pattern);
  }

  return createVar(
    [
      createVar(patterns, Meta.SIGNATURE),
      createVar(nativeFunctionMessage, Primitives.EXPRESSION),
    ],
    Meta.CASE,
  );
}

export function argNamesFromFunction(functionBody) {
  const args = [];
  let stack = "";
  let inDestructure = false;
  for (const letter of functionBody) {
    if (inDestructure) {
      switch (letter) {
        case "]":
          args.push(stack);
          return args;
        case ",":
          args.push(stack);
          stack = "";
          break;
        default:
          stack += letter;
          break;
      }
    } else if (letter === "[") {
      inDestructure = true;
    }
  }
  return args;
}

export function serializeCase(c) {
  const [signature, expression] = c.value;
  const patterns = signature.value;

  let caseText = patterns.length >= 1 ? "(" : "() => ";
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const [condition, type] = pattern.value;
    const [varName, conditionExpr] = condition.value;
    caseText +=
      conditionExpr.value.value === true ? varName.value : "<condition>";
    if (type.value.baseName !== "ANY") {
      caseText +=
        ":" +
        (isAlias(type.value)
          ? type.value.alias
          : type.value.baseName.toLowerCase());
    }
    if (i < patterns.length - 1) {
      caseText += ",";
    } else {
      caseText += ") => ";
    }
  }
  if (!(typeof expression.value === "object")) {
    // Natively defined function
    caseText += expression.value;
  } else if (aliasMatches(expression.type, "MULTI_EXPRESSION")) {
    caseText += "<multi-action>";
  } else if (aliasMatches(expression.value.type, "CALL")) {
    caseText += "<action>";
  } else if (expression.value.type.baseName === "VARIABLE") {
    caseText += expression.value.value;
  } else {
    caseText += charListToJsString(
      dispatchFunction("stringify", [expression.value]),
    );
  }

  return caseText;
}

export function serializeFunction(f) {
  const rankedCases = simpleRankCases(f.value);
  return rankedCases.map((c) => serializeCase(c)).join("\n");
}

export function simpleRankCases(cases) {
  return cases.sort((c1, c2) => {
    let c1Spec = 0;
    let c2Spec = 0;

    const c1Patterns = c1.value[0].value;
    const c2Patterns = c2.value[0].value;

    for (let i = 0; i < c1Patterns.length; i++) {
      const [c1Condition, c1Type] = c1Patterns[i].value;
      c1Spec += simpleTypeSpec(c1Type.value) * c1Condition.value[2].value;
    }

    c1Spec = c1Spec / c1Patterns.length;

    for (let i = 0; i < c2Patterns.length; i++) {
      const [c2Condition, c2Type] = c2Patterns[i].value;
      c2Spec += simpleTypeSpec(c2Type.value) * c2Condition.value[2].value;
    }

    c2Spec = c2Spec / c2Patterns.length;

    return c2Spec - c1Spec;
  });
}

export function simpleTypeSpec(t) {
  if (t.baseName === "ANY") {
    return TypeWeights.ANY;
  }

  if (t.baseName === "TUPLE" && t.types.length === 0) {
    return TypeWeights.BASE_TUPLE;
  }

  if (isAlias(t)) {
    return TypeWeights.NOMINAL;
  }

  return TypeWeights.EQUIVALENT;
}

export function addFunctionCase(name: FeverVar, func: FeverVar, ctx: Context) {
  {
    const signature = func.value[0];
    const expression = func.value[1];
    const size = signature.value.length;

    const types = typesFromSignature(signature);
    const conditions = conditionsFromSignature(signature);
    const names = namesFromSignature(signature);
    const specificities = specificitiesFromSignature(signature);

    const operation = (args, ctx) => {
      const mapping = {};
      for (let i = 0; i < args.length; i++) {
        mapping[names[i]] = args[i];
      }
      if (aliasMatches(expression.type, "MULTI_EXPRESSION")) {
        const recreatedMultiExpression = createVar(
          expression.value.map((line: FeverVar) =>
            recreateExpressionWithVariables(line, mapping),
          ),
          Meta.MULTI_EXPRESSION,
        );
        return evaluate(recreatedMultiExpression);
      } else {
        return evaluate(
          recreateExpressionWithVariables(expression, mapping).value,
        );
      }
    };
    return registerNewFunction(
      name.value,
      ctx,
      newFunction(size, types, operation, {
        conditions: conditions,
        specificities: specificities,
      }),
      func,
    );
  }
}
