import { abstractNodeToRealNode } from "../middleware/Literals.ts";
import { parse } from "./Parser.ts";
import { Context } from "./Context.ts";
import {
  aliasMatches,
  createCall,
  createConcreteCall,
  createError,
  createTypeVar,
  createVar,
  FeverType,
  FeverVar,
  getFunctionNameAndArgs,
  getFunctionObjectAndArgs,
  isAlias, Primitives,
  typeSatisfaction,
} from "../middleware/Types.ts";
import { LOCAL_ONLY_BUILTINS } from "../middleware/LocalOnlyBuiltins.ts";
import { lineShouldBeEvaluated } from "../interactives/file";
import {
  enterFunction,
  exitFunction,
} from "../middleware/CallStackDebugger.ts";
import { registerBuiltins } from "../lib/StandardLib";
import { morphTypes } from "../lib/TypeUtils";
import {
  argumentCountError,
  noPatternMatch,
  unknownFunctionError,
} from "../lib/Errors";

// 'show' is the only function that catches errors, the rest fall through.
export const ERROR_CATCHING_FUNCTIONS = ["show"];

export const ctx = new Context();

const assignGenericTableToTypeVars = (
  ctx: Context,
  genericTable: { [key: string]: FeverType },
) => {
  for (const genericName of Object.keys(genericTable)) {
    ctx.assignValue(genericName, createTypeVar(genericTable[genericName]));
  }
};

const unassignGenericTableToTypeVars = (
  ctx: Context,
  genericTable: { [key: string]: FeverType },
) => {
  for (const genericName of Object.keys(genericTable)) {
    ctx.deleteValue(genericName);
  }
};

export function callFunctionByReference(
  ref: FeverVar,
  args: FeverVar[],
  ctx: Context,
  name: string,
) {
  const errors = args.filter((arg) => arg.type.baseName === "ERROR");

  if (errors.length > 0) {
    if (!ERROR_CATCHING_FUNCTIONS.includes(name)) {
      return errors[0];
    }
  }

  const func = ref["invocations"];
  const candidates = func.filter((f) => f.arity === args.length);

  if (candidates.length === 0) {
    return argumentCountError(name, args.length);
  }

  if (args.length === 0) {
    return candidates[0].function([], ctx);
  }

  let bestScore = 0;
  let bestCandidate = undefined;
  let modifiedArgs = args;
  let usedGenericTable = {};
  for (const candidateFunction of candidates) {
    //For the conditions analysis
    ctx.enterScope();
    const tempArgs = [...args];
    let genericTable = {};
    let score = 0;
    for (let i = 0; i < candidateFunction.types.length; i++) {
      let type = candidateFunction.types[i];
      const condition = candidateFunction.conditions[i];
      const specificity =
        "specificities" in candidateFunction
          ? candidateFunction.specificities[i]
          : 1;
      let [typeScore, gt] = typeSatisfaction(
        args[i].type,
        type,
        genericTable,
        0,
        args[i],
      );
      genericTable = { ...genericTable, ...gt };
      if (typeScore === 0) {
        // Try to find a morphism path
        const path = ctx.pathBetween(args[i].type, type);
        if (path.length === 0) {
          score = -1;
          break;
        }
        tempArgs[i] = morphTypes(args[i], createTypeVar(type), ctx);
        //Farther morphism step means lower type score
        typeScore = Math.pow(0.5, path.length - 1);
      }

      const intScore =
        typeScore * (condition(tempArgs[i], ctx) ? 1 : 0) * specificity;
      if (intScore === 0) {
        score = -1;
        break;
      }
      score += intScore;
    }

    if (score >= bestScore) {
      bestScore = score;
      bestCandidate = candidateFunction;
      modifiedArgs = tempArgs;
      usedGenericTable = genericTable;
    }
    ctx.exitScope();
  }

  //Auto-operations on tuples
  //Best match was maybe an ANY for condition and type
  if (bestScore / modifiedArgs.length < 0.25) {
    //All arguments are tuples
    if (modifiedArgs.every((entry) => entry.type.baseName === "TUPLE")) {
      const tupleSize = modifiedArgs[0].value.length;
      //All tuples are the same size
      if (modifiedArgs.every((arg) => arg.value.length === tupleSize)) {
        const result = [];
        assignGenericTableToTypeVars(ctx, usedGenericTable);
        for (let i = 0; i < tupleSize; i++) {
          result.push(
            callFunctionByReference(
              ref,
              modifiedArgs.map((arg) => arg.value[i]),
              ctx,
              name,
            ),
          );
        }
        unassignGenericTableToTypeVars(ctx, usedGenericTable);

        if (result.every((elem) => elem.type.baseName !== "ERROR")) {
          return createVar(result, args[0].type);
        }
      }
    }
  }

  if (bestScore <= 0) {
    return noPatternMatch(name);
  }

  assignGenericTableToTypeVars(ctx, usedGenericTable);
  if (ctx.useCallStack) {
    enterFunction(name);
  }
  const result = bestCandidate.function(modifiedArgs, ctx);
  if (ctx.useCallStack) {
    exitFunction();
  }
  unassignGenericTableToTypeVars(ctx, usedGenericTable);

  return result;
}

export function dispatchFunction(fnName: string, args: FeverVar[]): FeverVar {
  let named = ctx.getOrNull(fnName);
  // Here is where we handle optional ? and ! functions
  if (!named) {
    const booleanName = ctx.getOrNull(fnName + "?");
    const assertionName = ctx.getOrNull(fnName + "!");

    // You have defined both and we have no idea which one you want.
    if (booleanName && assertionName) {
      return createError(
        "Ambiguous conversion from " +
          fnName +
          " to " +
          fnName +
          "? and " +
          fnName +
          "! found.",
      );
    }

    // You have defined neither and we have no idea what you want.
    if (!booleanName && !assertionName) {
      return unknownFunctionError(fnName);
    }

    named = booleanName ?? assertionName;
  }

  if (!isAlias(named.type) || named.type.alias !== "FUNCTION") {
    return named;
  }

  return callFunctionByReference(named, args, ctx, fnName);
}

export function evaluate(
  realNode: FeverVar,
  skipVarLookup?: boolean,
  ignoreExpressions?: boolean,
): FeverVar {
  if (
    realNode.type.baseName === "EXPRESSION" &&
    unknownVariablesInExpression(realNode.value).missing.length > 0
  ) {
    return realNode;
  }
  if (aliasMatches(realNode.type, "MULTI_EXPRESSION")) {
    // Unknown vars should also return assignment var if present
    // Add to tracked list of assigned vars
    let assignmentArgs = { missing: [], assignments: [] };
    for (const line of realNode.value) {
      unknownVariablesInExpressionRec(line, assignmentArgs);
      if (assignmentArgs.missing.length > 0) {
        return realNode;
      }
      assignmentArgs = { assignments: assignmentArgs.assignments, missing: [] };
    }
  }
  while (!ignoreExpressions && realNode.type.baseName === "EXPRESSION") {
    realNode = realNode.value;
  }
  if (aliasMatches(realNode.type, "MULTI_EXPRESSION")) {
    let interimValue: FeverVar;
    for (const line of realNode.value) {
      interimValue = evaluate(line, skipVarLookup, ignoreExpressions);
    }
    return interimValue;
  }
  if (aliasMatches(realNode.type, "CALL")) {
    const [name, args] = getFunctionNameAndArgs(realNode);
    const isAssignment = name === "=";
    // Early returns!  Fun!
    if (name === '?') {
      return earlyReturnTernary(args);
    } else if (name === '&') {
      return earlyReturnAnd(args);
    } else if (name === '|') {
      return earlyReturnOr(args);
    }
    return dispatchFunction(
      name,
      args.map((arg, index) => evaluate(arg, isAssignment && index === 0)),
    );
  }
  if (aliasMatches(realNode.type, "CONCRETE_CALL")) {
    const [fn, args] = getFunctionObjectAndArgs(realNode);
    return callFunctionByReference(
      fn,
      args.map((arg) => evaluate(arg)),
      ctx,
      "lambda",
    );
  }
  if (realNode.type.baseName === "VARIABLE" && !skipVarLookup) {
    const varName = realNode.value;
    if (ctx.hasVariable(varName)) {
      return ctx.getOrNull(varName);
    }
  }

  if (
    Array.isArray(realNode.value) &&
    !aliasMatches(realNode.type, "CONDITION") &&
    !aliasMatches(realNode.type, "PATTERN") &&
    !aliasMatches(realNode.type, "SIGNATURE") &&
    !aliasMatches(realNode.type, "FUNCTION") &&
    realNode.type.baseName !== "EXPRESSION"
  ) {
    // Make a copy, otherwise fully resolved values will overwrite expressions
    return createVar(
      realNode.value.map((item) => evaluate(item, skipVarLookup, true)),
      realNode.type,
    );
  }
  return realNode;
}

export function unknownVariablesInExpression(expr: FeverVar): {
  [key: string]: FeverVar[];
} {
  const foundVars: {
    [key: string]: FeverVar[];
  } = { missing: [], assignments: [] };
  unknownVariablesInExpressionRec(expr, foundVars);

  return foundVars;
}

function unknownVariablesInExpressionRec(
  expr: FeverVar,
  table: {
    [key: string]: FeverVar[];
  },
): void {
  if (aliasMatches(expr.type, "FUNCTION")) {
    return;
  }
  if (aliasMatches(expr.type, "CALL")) {
    const [name, args] = getFunctionNameAndArgs(expr);
    if (name === "=") {
      table.assignments.push(args[0].value);
    }
  }
  // Probably need to check context for variable being defined
  if (
    expr.type.baseName === "VARIABLE" &&
    !ctx.hasVariable(expr.value) &&
    !table.assignments.includes(expr.value)
  ) {
    table.missing.push(expr);
    return;
  }
  // List type value
  if (Array.isArray(expr.value)) {
    for (const child of expr.value) {
      unknownVariablesInExpressionRec(child, table);
    }
  }
  // Object type value
  if (
    typeof expr.value === "object" &&
    expr.value !== null &&
    "value" in expr.value
  ) {
    unknownVariablesInExpressionRec(expr.value, table);
  }
}

export function recreateExpressionWithVariables(
  expr: FeverVar,
  mapping: { [key: string]: FeverVar },
): FeverVar {
  if (expr === null || expr.value === undefined) {
    return expr;
  }
  let newValue;
  if (aliasMatches(expr.type, "CALL")) {
    // Possibly substitute in function object for first value
    // Then recreate arguments recursively and build back better
    const [name, args] = getFunctionNameAndArgs(expr);
    const newArgs = args.map((arg) =>
      recreateExpressionWithVariables(arg, mapping),
    );
    if (name in mapping) {
      return createConcreteCall(mapping[name], newArgs);
    }
    // Return standard call
    return createCall(name, newArgs);
  } else if (Array.isArray(expr.value)) {
    // Should check if any were actually evaled for performance
    // Make variable types into new type
    newValue = createVar(
      expr.value.map((v) => recreateExpressionWithVariables(v, mapping)),
      expr.type,
    );

    // Fields that may be set on functions
    if ("invocations" in expr) {
      newValue.invocations = expr.invocations;
    }
    if ("arity" in expr) {
      newValue.arity = expr.arity;
    }
  } else {
    // Are we in a function name?
    // Probably could have a call dynamically contain either function name to dispatch or function object
    // Or we could just eval functions into scope
    if (expr.type.baseName === "VARIABLE") {
      if (expr.value in mapping) {
        newValue = mapping[expr.value];
      }
      // In function, mapping might have extra properties
    } else {
      return createVar(
        recreateExpressionWithVariables(expr.value, mapping),
        expr.type,
      );
    }
  }
  if (newValue) {
    return newValue;
  }

  return expr;
}

export function earlyReturnTernary(args: FeverVar[]): FeverVar {
  const result = evaluate(args[0]);
  if (result.value) {
    return evaluate(args[1]);
  } else {
    return evaluate(args[2]);
  }
}

export function earlyReturnAnd(args: FeverVar[]): FeverVar {
  const firstResult = evaluate(args[0]);
  if (!firstResult.value) {
    return createVar(false, Primitives.BOOLEAN);
  }
  const secondResult = evaluate(args[1]);
  return createVar(firstResult.value && secondResult.value, Primitives.BOOLEAN);
}

export function earlyReturnOr(args: FeverVar[]): FeverVar {
  const firstResult = evaluate(args[0]);
  if (firstResult.value) {
    return createVar(true, Primitives.BOOLEAN);
  }
  const secondResult = evaluate(args[1]);
  return createVar(firstResult.value || secondResult.value, Primitives.BOOLEAN);
}

export function parseToExpr(text: string): FeverVar {
  const parsedTree = parse(text);
  return abstractNodeToRealNode(parsedTree);
}

export function interpret(text: string): FeverVar {
  if (lineShouldBeEvaluated(text)) {
    const realNode = parseToExpr(text);
    return evaluate(realNode);
  }

  return null;
}
registerBuiltins(ctx);
registerBuiltins(ctx, LOCAL_ONLY_BUILTINS);
