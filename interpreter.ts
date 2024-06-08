import { abstractNodeToRealNode } from "./literals.ts";
import { parse, ParseNodeType } from "./parser.ts";
import { Context } from "./vars.ts";
import {
  createError,
  createTypeVar,
  createVar,
  FeverType,
  FeverVar,
  getFunctionNameAndArgs,
  isAlias,
  typeSatisfaction,
} from "./types.ts";
import { morphTypes, registerBuiltins } from "./builtins.ts";

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

  // 'show' is the only function that catches errors, the rest fall through.
  if (errors.length > 0) {
    if (name !== "show") {
      return errors[0];
    }
  }

  const func = ref["invocations"];
  const candidates = func.filter((f) => f.arity === args.length);

  if (candidates.length === 0) {
    return createError(
      "No definition of " + name + " that takes " + args.length + " arguments",
    );
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
  if (bestScore / modifiedArgs.length <= 0.25) {
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
    return createError("No satisfactory match for " + name + ".");
  }

  assignGenericTableToTypeVars(ctx, usedGenericTable);
  const result = bestCandidate.function(modifiedArgs, ctx);
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
      return createError("Unknown function " + fnName + " invoked.");
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
): FeverVar {
  if (
    realNode.type.baseName === "EXPRESSION" &&
    unknownVariablesInExpression(realNode.value).length > 0
  ) {
    return realNode;
  }

  if (realNode.type.alias && realNode.type.alias === "CALL") {
    const [name, args] = getFunctionNameAndArgs(realNode);
    const isAssignment = name === "=";
    return dispatchFunction(
      name,
      args.map((arg, index) => evaluate(arg, isAssignment && index === 0)),
    );
  }
  if (realNode.type.baseName === "VARIABLE" && !skipVarLookup) {
    const varName = realNode.value;
    if (ctx.hasVariable(varName)) {
      return ctx.lookupValue(varName);
    }
  }
  return realNode;
}

export function unknownVariablesInExpression(expr: FeverVar): FeverVar[] {
  const foundVars: FeverVar[] = [];
  unknownVariablesInExpressionRec(expr, foundVars);

  return foundVars;
}

function unknownVariablesInExpressionRec(
  expr: FeverVar,
  table: FeverVar[],
): void {
  // Probably need to check context for variable being defined
  if (expr.type.baseName === "VARIABLE" && !ctx.hasVariable(expr.value)) {
    table.push(expr);
    return;
  }
  // List type value
  if (Array.isArray(expr.value)) {
    for (const child of expr.value) {
      unknownVariablesInExpressionRec(child, table);
    }
  }
  // Object type value
  if (typeof expr.value === "object" && "value" in expr.value) {
    unknownVariablesInExpressionRec(expr.value, table);
  }
}

export function parseToExpr(text: string): FeverVar {
  const parsedTree = parse(text);
  return abstractNodeToRealNode(parsedTree);
}

export function interpret(text: string): FeverVar {
  const realNode = parseToExpr(text);
  return evaluate(realNode);
}
registerBuiltins(ctx);
