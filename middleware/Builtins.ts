import {
  charListToJsString,
  createMonadPassthrough,
  createType,
  createTypedList,
  createTypedTuple,
  createVar,
  FeverType,
  FeverVar,
  isAlias,
  Meta,
  Primitives,
  recursiveToString,
  typeAssignableFrom,
} from "./Types";
import {
  callFunctionByReference,
  ctx,
  dispatchFunction,
  evaluate,
} from "../internals/Interpreter";
import { inferListType } from "./Literals";
import { Context } from "../internals/Context.ts";
import {
  namedFilter,
  namedMap,
  namedMonadicFilter,
  namedMonadicMap,
  namedMonadicReduce,
  namedReduce,
} from "../lib/HigherOrder";
import { isNumeric, newOfType, stringify } from "../lib/CommonUtils";
import {
  addFunctionCase,
  registerNewFunction,
  serializeFunction,
  typesFromSignature,
} from "../lib/FunctionUtils";
import { feverStringFromJsString, typeToString } from "../lib/StringUtils";
import { morphTypes } from "../lib/TypeUtils";
import { failureToParseString, indexOutOfRange } from "../lib/Errors";

export function newFunction(
  arity: number,
  types: FeverType[],
  functionOperation: (args: FeverVar[], ctx: Context) => FeverVar,
  args?,
) {
  const func = {
    arity: arity,
    types: types,
    function: functionOperation,
  };
  if (args) {
    if ("specificities" in args) {
      func["specificities"] = args.specificities;
    } else {
      func["specificities"] = Array(arity).fill(0.5);
    }

    if ("conditions" in args) {
      func["conditions"] = args.conditions;
    } else {
      func["conditions"] = Array(arity).fill(() => true);
    }
  } else {
    func["conditions"] = Array(arity).fill(() => true);
    func["specificities"] = Array(arity).fill(0.5);
  }

  return func;
}

export const builtins = {
  "+": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value + b.value, a.type),
    ),
    newFunction(2, [Meta.LIST, Meta.LIST], ([a, b]) => {
      const l = a.value.concat(b.value);
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.LIST, Meta.STRING], ([a, b]) => {
      const l = [...a.value, b];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.STRING, Meta.LIST], ([a, b]) => {
      const l = [a, ...b.value];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.STRING, Meta.STRING], ([a, b]) => {
      return createVar(a.value.concat(b.value), a.type);
    }),
    newFunction(2, [Primitives.ANY, Meta.LIST], ([a, b]) => {
      const l = [a, ...b.value];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.LIST, Primitives.ANY], ([a, b]) => {
      const l = [...a.value, b];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.STRING, Primitives.ANY], ([a, b]) => {
      const jsString = charListToJsString(a);
      return feverStringFromJsString(jsString + b.value);
    }),
    newFunction(2, [Primitives.ANY, Meta.STRING], ([a, b]) => {
      const jsString = charListToJsString(b);
      return feverStringFromJsString(a.value + jsString);
    }),
    newFunction(2, [Primitives.CHARACTER, Primitives.NUMBER], ([char, shift]) =>
      createVar(
        String.fromCharCode(char.value.charCodeAt(0) + shift.value),
        Primitives.CHARACTER,
      ),
    ),
    newFunction(2, [Primitives.CHARACTER, Primitives.CHARACTER], ([c1, c2]) => {
      return feverStringFromJsString(c1.value + c2.value);
    }),
  ],
  "*": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value * b.value, a.type),
    ),
    newFunction(2, [Meta.LIST, Primitives.NUMBER], ([a, b]) => {
      const list = [];
      for (let i = 0; i < b.value; i++) {
        for (let z = 0; z < a.value.length; z++) {
          list.push(a.value[z]);
        }
      }
      return createVar(list, a.type);
    }),
    newFunction(2, [Primitives.NUMBER, Meta.LIST], ([a, b]) => {
      const list = [];
      for (let i = 0; i < a.value; i++) {
        for (let z = 0; z < b.value.length; z++) {
          list.push(b.value[z]);
        }
      }
      return createVar(list, b.type);
    }),
  ],
  "-": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value - b.value, a.type),
    ),
  ],
  "/": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value / b.value, a.type),
    ),
  ],
  ">": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value > b.value, Primitives.BOOLEAN),
    ),
  ],
  "<": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value < b.value, Primitives.BOOLEAN),
    ),
  ],
  "&": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value && b.value, Primitives.BOOLEAN),
    ),
  ],
  "|": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value || b.value, Primitives.BOOLEAN),
    ),
  ],
  "<=": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value <= b.value, Primitives.BOOLEAN),
    ),
  ],
  ">=": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(a.value >= b.value, Primitives.BOOLEAN),
    ),
  ],
  "->": [
    newFunction(
      2,
      [Meta.LIST, Primitives.EXPRESSION],
      ([list, action], ctx) => {
        return namedMap(list, action, ctx, ["@", "#", "^"]);
      },
    ),
    // [1,2,3] -> (['item','index','intermediate'], (item + 1))
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.EXPRESSION,
        ]),
      ],
      ([list, namedAction], ctx) => {
        const [names, action] = namedAction.value;
        const nameTable = ["@", "#", "^"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedMap(list, action, ctx, nameTable);
      },
    ),
    newFunction(2, [Meta.LIST, Primitives.ANY], ([list, result], ctx) => {
      const results = list.value.map((ignored) => result);
      const res = createVar(
        results,
        createTypedList(
          results.length > 0 ? results[0].type : Primitives.ANY,
          list.type.alias,
        ),
      );

      if (isAlias(res.type)) {
        const created = newOfType(res.type, [res], ctx);
        if (created.type.baseName !== "ERROR") {
          return created;
        }
      }
      return res;
    }),
    newFunction(2, [Meta.LIST, Meta.FUNCTION], ([list, func], ctx) => {
      const results = list.value.map((item) =>
        callFunctionByReference(func, [item], ctx, "lambda"),
      );
      const errors = results.filter((res) => res.type.baseName === "ERROR");
      if (errors.length > 0) {
        return errors[0];
      }
      const res = createVar(
        results,
        createTypedList(
          results.length > 0 ? results[0].type : Primitives.ANY,
          list.type.alias,
        ),
      );

      if (isAlias(res.type)) {
        const created = newOfType(res.type, [res], ctx);
        if (created.type.baseName !== "ERROR") {
          return created;
        }
      }

      return res;
    }),
    newFunction(2, [Primitives.ANY, Primitives.EXPRESSION], ([item, expr]) => {
      return namedMonadicMap(item, expr, ["@", "#", "^"]);
    }),
  ],
  "\\>": [
    newFunction(
      2,
      [Meta.LIST, createTypedTuple([Primitives.ANY, Primitives.EXPRESSION])],
      ([list, reduce], ctx) => {
        const [acc, reduction] = reduce.value;
        return namedReduce(list, acc, reduction, ctx, ["@", "#", "$"], false);
      },
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.ANY,
          Primitives.EXPRESSION,
        ]),
      ],
      ([list, namedReduction], ctx) => {
        const [names, acc, reduction] = namedReduction.value;
        const nameTable = ["@", "#", "$"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedReduce(list, acc, reduction, ctx, nameTable, false);
      },
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          Primitives.ANY,
          Primitives.EXPRESSION,
          Primitives.BOOLEAN,
        ]),
      ],
      ([list, reduce], ctx) => {
        const [acc, reduction, flag] = reduce.value;
        return namedReduce(
          list,
          acc,
          reduction,
          ctx,
          ["@", "#", "$"],
          flag.value,
        );
      },
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.ANY,
          Primitives.EXPRESSION,
          Primitives.BOOLEAN,
        ]),
      ],
      ([list, namedReduction], ctx) => {
        const [names, acc, reduction, flag] = namedReduction.value;
        const nameTable = ["@", "#", "$"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedReduce(list, acc, reduction, ctx, nameTable, flag.value);
      },
    ),
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([item, fallback]) =>
      namedMonadicReduce(item, fallback),
    ),
  ],
  "~>": [
    newFunction(
      2,
      [Meta.LIST, Primitives.EXPRESSION],
      ([list, action], ctx) => {
        return namedFilter(list, action, ctx, ["@", "#", "^"], null);
      },
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.EXPRESSION,
        ]),
      ],
      ([list, namedAction], ctx) => {
        const [names, filter] = namedAction.value;
        const nameTable = ["@", "#", "^"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedFilter(list, filter, ctx, nameTable, null);
      },
    ),
    newFunction(2, [Meta.LIST, Meta.FUNCTION], ([list, funcRef], ctx) => {
      return namedFilter(list, null, ctx, ["@", "#", "^"], funcRef);
    }),
    newFunction(2, [Primitives.ANY, Primitives.EXPRESSION], ([item, expr]) => {
      return namedMonadicFilter(item, expr, ["@", "#", "^"]);
    }),
  ],
  "==": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) => {
      // Special cases
      // List length mismatch
      if (
        a.type.baseName === "LIST" &&
        b.type.baseName === "LIST" &&
        a.value.length !== b.value.length
      ) {
        return createVar(false, Primitives.BOOLEAN);
      }
      return createVar(
        JSON.stringify(a.value) === JSON.stringify(b.value),
        Primitives.BOOLEAN,
      );
    }),
  ],
  "%": [
    newFunction(2, [Primitives.NUMBER, Primitives.NUMBER], ([a, b]) =>
      createVar(a.value % b.value, Primitives.NUMBER),
    ),
  ],
  "=>": [
    newFunction(
      2,
      [Meta.SIGNATURE, Primitives.EXPRESSION],
      ([signature, expression]) => {
        return createVar([signature, expression], Meta.CASE);
      },
    ),
    newFunction(
      2,
      [Meta.SIGNATURE, Meta.MULTI_EXPRESSION],
      ([signature, expression]) => {
        return createVar([signature, expression], Meta.CASE);
      },
    ),
    newFunction(2, [Meta.SIGNATURE, Primitives.ANY], ([signature, value]) => {
      return createVar(
        [signature, createVar(value, Primitives.EXPRESSION)],
        Meta.CASE,
      );
    }),
  ],
  "=": [
    newFunction(
      2,
      [Primitives.VARIABLE, Primitives.ANY],
      ([name, value], variables) => {
        variables.assignValue(name.value, value);
        return value;
      },
    ),
    newFunction(
      2,
      [Primitives.VARIABLE, Meta.CASE],
      ([name, func], variables) => addFunctionCase(name, func, variables),
    ),
    newFunction(
      2,
      [Primitives.VARIABLE, Meta.SIGNATURE],
      ([name, signature], variables) => {
        const realName = name.value;
        const types = typesFromSignature(signature);
        const size = types.length;
        const isListAlias = size === 1 && types[0].baseName === "LIST";
        let newInnerType;
        if (isListAlias) {
          newInnerType = createType("LIST", types[0].types, true);
        }
        const newType = isListAlias
          ? createTypedList(types[0].types[0], realName)
          : createTypedTuple(types, realName);
        Meta[realName.toUpperCase()] = newType;
        const permutations = [];

        for (let i = 0; i < size; i++) {
          const condition = signature.value[i].value[0].value;
          const name = condition[0];

          //Handle 1 <-> 1 members
          const expression = condition[1];
          if (expression.value.value === true) {
            permutations.push((arg) => arg);
          } else {
            permutations.push((arg, ctx) => {
              variables.enterScope();
              variables.assignValue(name.value, arg);
              const result = evaluate(expression.value);
              variables.exitScope();
              return result;
            });
          }

          //Register getters
          registerNewFunction(
            name.value,
            variables,
            newFunction(1, [newType], ([ofType]) => {
              return isListAlias
                ? createVar(ofType.value, newInnerType)
                : ofType.value[i];
            }),
          );
        }

        for (let i = 0; i < size; i++) {
          const condition = signature.value[i].value[0].value;
          const name = condition[0];
          //Register setters
          registerNewFunction(
            name.value,
            variables,
            newFunction(2, [newType, types[i]], ([ofType, newValue], ctx) => {
              ofType.value[i] = permutations[i](newValue, ctx);
              return ofType;
            }),
          );
        }

        //Apply relevant condition to each arg if not simple var name.
        const operation = ([, ...args], ctx) => {
          const mutatedArgs = [];

          for (let i = 0; i < size; i++) {
            mutatedArgs.push(permutations[i](args[i], ctx));
          }
          return isListAlias
            ? createVar(
                mutatedArgs[0].value,
                inferListType(mutatedArgs[0].value, realName),
              )
            : createVar(mutatedArgs, newType);
        };

        registerNewFunction(
          "new",
          variables,
          newFunction(size + 1, [Primitives.TYPE, ...types], operation, {
            conditions: [
              (arg) => {
                return typeAssignableFrom(arg.value, newType);
              },
              ...Array(size).fill(() => true),
            ],
            specificities: Array(size + 1).fill(1),
          }),
        );

        const typeVar = createVar(newType, Primitives.TYPE);
        variables.assignValue(realName, typeVar);
        return typeVar;
      },
    ),
  ],
  show: [
    newFunction(
      1,
      [Primitives.ANY],
      ([v], ctx) => {
        console.log(charListToJsString(stringify(v)));
        return v;
      },
      {
        specificities: [1],
      },
    ),
    newFunction(1, [Primitives.ERROR], ([e]) => {
      console.log(e.value);
      return e;
    }),
    newFunction(2, [Primitives.ANY, Meta.STRING], ([v, delimiter]) => {
      process.stdout.write(recursiveToString(v) + delimiter.value);
      return v;
    }),
    newFunction(2, [Meta.STRING, Meta.STRING], ([v, delimiter]) => {
      process.stdout.write(charListToJsString(v) + delimiter.value);
      return v;
    }),
  ],
  explain: [
    newFunction(1, [Primitives.ANY], ([v]) => {
      console.dir(v, { depth: null });
      return v;
    }),
  ],
  "..": [
    newFunction(
      2,
      [Primitives.NUMBER, Primitives.NUMBER],
      ([a, b]) => {
        const direction = a.value < b.value ? 1 : -1;
        const numbers = [];
        for (let i = a.value; i !== b.value; i += direction) {
          numbers.push(createVar(i, Primitives.NUMBER));
        }
        numbers.push(b);
        return createVar(numbers, createTypedList(Primitives.NUMBER));
      },
      {
        conditions: [
          (num) => Number.isInteger(num.value),
          (num) => Number.isInteger(num.value),
        ],
        specificities: [1, 1],
      },
    ),
  ],
  get: [
    newFunction(2, [Meta.LIST, Primitives.NUMBER], ([list, num]) => {
      if (num.value < list.value.length) {
        return list.value[num.value];
      }

      return indexOutOfRange(num.value, recursiveToString(list));
    }),
    newFunction(2, [Meta.TUPLE, Primitives.NUMBER], ([tuple, num]) => {
      if (num.value < tuple.value.length) {
        return tuple.value[num.value];
      }

      return indexOutOfRange(num.value, recursiveToString(tuple));
    }),
  ],
  append: [
    newFunction(2, [Meta.LIST, Primitives.ANY], ([list, item]) => {
      return createVar([...list.value, item], list.type);
    }),
  ],
  floor: [
    newFunction(1, [Primitives.NUMBER], ([num]) => {
      return createVar(Math.floor(num.value), Primitives.NUMBER);
    }),
  ],
  ceil: [
    newFunction(1, [Primitives.NUMBER], ([num]) => {
      return createVar(Math.ceil(num.value), Primitives.NUMBER);
    }),
  ],
  "?": [
    newFunction(
      3,
      [Primitives.BOOLEAN, Primitives.ANY, Primitives.ANY],
      ([truth, a, b]) => {
        return truth.value ? a : b;
      },
    ),
  ],
  nl: [
    newFunction(1, [Primitives.ANY], ([ignored]) => {
      console.log();
      return ignored;
    }),
  ],
  sqrt: [
    newFunction(
      1,
      [Primitives.NUMBER],

      ([val]) => {
        return createVar(Math.sqrt(val.value), Primitives.NUMBER);
      },
      {
        conditions: [(arg) => arg.value >= 0],
        specificities: [1],
      },
    ),
  ],
  not: [
    newFunction(1, [Primitives.BOOLEAN], ([truth]) => {
      return createVar(!truth.value, Primitives.BOOLEAN);
    }),
  ],
  len: [
    newFunction(1, [Meta.LIST], ([list]) => {
      return createVar(list.value.length, Primitives.NUMBER);
    }),
  ],
  stringify: [
    newFunction(
      1,
      [Primitives.ANY],
      ([v]) => {
        return feverStringFromJsString(recursiveToString(v));
      },
      {
        specificities: [0.6],
      },
    ),
    newFunction(
      1,
      [Meta.FUNCTION],
      ([func]) => {
        return feverStringFromJsString(serializeFunction(func));
      },
      {
        specificities: [0.6],
      },
    ),
    newFunction(
      1,
      [Primitives.TYPE],
      ([typeVar]) => {
        return feverStringFromJsString(typeToString(typeVar.value));
      },
      {
        specificities: [0.6],
      },
    ),
  ],
  type: [
    newFunction(
      1,
      [Primitives.ANY],
      ([v]) => {
        return createVar(v.type, Primitives.TYPE);
      },
      {
        specificities: [0.6],
      },
    ),
  ],
  ord: [
    newFunction(1, [Primitives.CHARACTER], ([c]) =>
      createVar(c.value.charCodeAt(0), Primitives.NUMBER),
    ),
  ],
  depth: [
    newFunction(1, [Primitives.ANY], ([ignored], variables) => {
      return createVar(variables.scopes.length, Primitives.NUMBER);
    }),
  ],
  time: [
    newFunction(1, [Primitives.NUMBER], ([diff]) => {
      return createVar(Date.now() - diff.value, Primitives.NUMBER);
    }),
    newFunction(0, [], () => {
      return createVar(Date.now(), Primitives.NUMBER);
    }),
  ],
  morph: [
    newFunction(
      2,
      [Meta.FUNCTION, Primitives.TYPE],
      ([transformation, toType], ctx) => {
        const fromType = transformation.invocations[0].types[0];
        ctx.registerMorphism(fromType, toType.value, transformation);
        return createVar(true, Primitives.BOOLEAN);
      },
      {
        conditions: [
          (transformation) => {
            return transformation.invocations.every(
              (invocation) => invocation.types.length === 1,
            );
          },
          () => true,
        ],
        specificities: [1, 1],
      },
    ),
    newFunction(
      3,
      [Meta.FUNCTION, Primitives.TYPE, Primitives.TYPE],
      ([transformation, fromType, toType], ctx) => {
        ctx.registerMorphism(fromType.value, toType.value, transformation);
        return createVar(true, Primitives.BOOLEAN);
      },
      {
        conditions: [
          (transformation) => {
            return transformation.invocations.every(
              (invocation) => invocation.types.length === 1,
            );
          },
          () => true,
          () => true,
        ],
        specificities: [1, 1, 1],
      },
    ),
  ],
  convert: [
    newFunction(
      2,
      [Primitives.ANY, Primitives.TYPE],
      ([value, toType], ctx) => {
        return morphTypes(value, toType, ctx);
      },
    ),
  ],
  to_number: [
    newFunction(1, [Meta.STRING], ([feverString]) => {
      const jsString = charListToJsString(feverString);
      if (isNumeric(jsString)) {
        return createVar(Number(jsString), Primitives.NUMBER);
      } else {
        return failureToParseString(jsString, "number");
      }
    }),
  ],
  is_numeric: [
    newFunction(1, [Meta.STRING], ([string]) => {
      const jsString = charListToJsString(string);
      if (isNumeric(jsString)) {
        return createVar(true, Primitives.BOOLEAN);
      } else {
        return createVar(false, Primitives.BOOLEAN);
      }
    }),
  ],
  replace: [
    newFunction(
      3,
      [Meta.STRING, Meta.STRING, Meta.STRING],
      ([original, pattern, replacement]) => {
        return feverStringFromJsString(
          charListToJsString(original).replaceAll(
            charListToJsString(pattern),
            charListToJsString(replacement),
          ),
        );
      },
    ),
  ],
  fast_slice: [
    newFunction(2, [Meta.LIST, Primitives.NUMBER], ([lst, idx]) => {
      const newList = lst.value.slice(idx.value);
      return createVar(newList, inferListType(newList));
    }),
    newFunction(
      3,
      [Meta.LIST, Primitives.NUMBER, Primitives.NUMBER],
      ([lst, startIdx, endIdx]) => {
        const newList = lst.value.slice(startIdx.value, endIdx.value);
        return createVar(newList, inferListType(newList));
      },
    ),
  ],
  fast_sort: [
    newFunction(2, [Meta.LIST, Meta.FUNCTION], ([lst, fn]) => {
      const sortedList = lst.value.sort(
        (v1: FeverVar, v2: FeverVar) =>
          callFunctionByReference(fn, [v1, v2], ctx, "compare").value,
      );
      return createVar(sortedList, inferListType(sortedList));
    }),
  ],
  global_assign: [
    newFunction(2, [Meta.STRING, Primitives.ANY], ([name, value]) => {
      const realName = charListToJsString(name);
      ctx.globalAssignValue(realName, value);
      return createVar(true, Primitives.BOOLEAN);
    }),
  ],
  add_to_global_list: [
    newFunction(2, [Meta.STRING, Primitives.ANY], ([name, value]) => {
      const realName = charListToJsString(name);
      const globalListValue = ctx.getOrNull(realName);
      ctx.globalAssignValue(
        realName,
        dispatchFunction("+", [globalListValue, value]),
      );
      return createVar(true, Primitives.BOOLEAN);
    }),
  ],
  passthrough: [
    newFunction(1, [Primitives.ANY], ([item]) => createMonadPassthrough(item)),
  ],
};
