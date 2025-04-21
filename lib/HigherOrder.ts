import {
  aliasMatches,
  createTypedList,
  createVar,
  FeverVar,
  isAlias,
  Primitives,
} from "../types.js";
import { Context } from "../Context.js";
import {
  callFunctionByReference,
  dispatchFunction,
  evaluate,
  recreateExpressionWithVariables,
} from "../interpreter.js";
import { inferListType } from "../literals.js";
import { equals, newOfType } from "./CommonUtils.js";

export function namedMap(
  list: FeverVar,
  action: FeverVar,
  ctx: Context,
  [element, index, intermediate]: string[],
) {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    const mapping = {};
    mapping[element] = item;
    mapping[index] = createVar(i, Primitives.NUMBER);
    mapping[intermediate] = createVar(
      [...internalList],
      createTypedList(
        internalList.length > 0 ? internalList[0].type : Primitives.ANY,
      ),
    );
    const result = evaluate(
      recreateExpressionWithVariables(action.value, mapping),
    );
    internalList.push(result);
  }

  const result = createVar(
    internalList,
    inferListType(internalList, list.type.alias),
  );

  if (isAlias(list.type)) {
    const created = newOfType(result.type, [result], ctx);
    if (created.type.baseName !== "ERROR") {
      return created;
    }
  }
  return result;
}

export function namedFilter(
  list,
  action,
  ctx: Context,
  [element, index, intermediate]: string[],
  funcRef,
) {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    const mapping = {};
    mapping[element] = item;
    mapping[index] = createVar(i, Primitives.NUMBER);
    mapping[intermediate] = createVar(
      [...internalList],
      createTypedList(
        internalList.length > 0 ? internalList[0].type : Primitives.ANY,
      ),
    );
    let result;
    if (funcRef) {
      // Hmmm...how do we supply vars here?
      result = callFunctionByReference(funcRef, [item], ctx, "lambda");
    } else {
      result = evaluate(recreateExpressionWithVariables(action, mapping).value);
    }
    if (result.value) {
      internalList.push(item);
    }
  }

  const result = createVar(
    internalList,
    inferListType(internalList, list.type.alias),
  );

  if (isAlias(list.type)) {
    const created = newOfType(result.type, [result], ctx);
    if (created.type.baseName !== "ERROR") {
      return created;
    }
  }
  return result;
}

export function namedReduce(
  list,
  acc,
  expr,
  ctx: Context,
  [element, index, accumulator]: string[],
  earlyTerminateIfNotFalse,
) {
  const initialAcc = acc;
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    const mapping = {};
    mapping[element] = item;
    mapping[index] = createVar(i, Primitives.NUMBER);
    mapping[accumulator] = acc;
    acc = evaluate(recreateExpressionWithVariables(expr, mapping));
    // Maybe this will be slow but it seems ok
    if (earlyTerminateIfNotFalse && !equals(initialAcc, acc).value) {
      return acc;
    }
  }
  return acc;
}

export function namedMonadicMap(
  item: FeverVar,
  expression: FeverVar,
  varNames: string[],
) {
  const variablesFromItem = lift(item);
  const varMappings = variablesFromItem.value[0];
  const mappings = {};
  // Also this assumes there is just one concrete failure case, true for optionals but not errors
  for (let i = 0; i < 3; i++) {
    if (varMappings.value.length <= i) {
      // No monad mappings registered
      break;
    }
    mappings[varNames[i]] = varMappings.value[i];
  }

  let result;

  // If the @ value is a constant and we want to skip evaluation, set the value directly!
  if (aliasMatches(mappings[varNames[0]].type, "PASSTHROUGH")) {
    result = mappings[varNames[0]].value;
  } else {
    const recreatedExpression = recreateExpressionWithVariables(
      expression,
      mappings,
    );
    result = evaluate(recreatedExpression);
  }

  return drop(result, item);
}

export function namedMonadicFilter(
  item: FeverVar,
  expression: FeverVar,
  varNames: string[],
) {
  const variablesFromItem = lift(item);
  const varMappings = variablesFromItem.value[0];
  const falseCaseValue = variablesFromItem.value[1];

  const mappings = {};
  // Also this assumes there is just one concrete failure case, true for optionals but not errors
  for (let i = 0; i < 3; i++) {
    if (varMappings.value.length <= i) {
      // No monad mappings registered
      break;
    }
    mappings[varNames[i]] = varMappings.value[i];
  }

  let result;

  if (aliasMatches(mappings[varNames[0]].type, "PASSTHROUGH")) {
    result = mappings[varNames[0]].value;
    if (equals(result, falseCaseValue)) {
      return drop(result, item);
    }
  } else {
    const recreatedExpression = recreateExpressionWithVariables(
      expression,
      mappings,
    );
    const boolean = evaluate(recreatedExpression);
    if (boolean.value) {
      // The provided item will be returned
      result = mappings[varNames[0]];
    } else {
      result = falseCaseValue;
    }

    return drop(result, item);
  }
}

export function lift(value: FeverVar): FeverVar {
  return dispatchFunction("lift", [value]);
}

export function drop(value: FeverVar, initialValue: FeverVar): FeverVar {
  return dispatchFunction("drop", [value, initialValue]);
}
