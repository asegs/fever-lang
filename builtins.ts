import {
  aliasMatches,
  charListToJsString,
  createError,
  createType,
  createTypedList,
  createTypedTuple,
  createTypeVar,
  createVar,
  FeverType,
  FeverVar,
  isAlias,
  Meta,
  Primitives,
  recursiveToString,
  typeAssignableFrom,
  TypeWeights,
} from "./types.ts";
import {
  dispatchFunction,
  callFunctionByReference,
  evaluate,
  interpret,
} from "./interpreter.ts";
import { feverStringFromJsString, inferListType } from "./literals.ts";
import { readFileSync } from "fs";
import { Context } from "./vars";

function newFunction(
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
  ],
  "==": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) =>
      createVar(
        JSON.stringify(a.value) === JSON.stringify(b.value),
        Primitives.BOOLEAN,
      ),
    ),
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
        console.log(charListToJsString(dispatchFunction("stringify", [v])));
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

      return createError(
        "Index " + num.value + " out of range on " + recursiveToString(list),
      );
    }),
    newFunction(2, [Meta.TUPLE, Primitives.NUMBER], ([tuple, num]) => {
      if (num.value < tuple.value.length) {
        return tuple.value[num.value];
      }

      return createError(
        "Index " + num.value + " out of range on " + recursiveToString(tuple),
      );
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
  read: [
    newFunction(1, [Meta.STRING], ([path]) => {
      // We should have global state based on a passed in file to get its directory.
      const pathSlug = charListToJsString(path);
      const dir = process.cwd();
      const fileText = readFileSync(dir + "/" + pathSlug).toString();
      const fileLines = fileText.split("\n");
      return createVar(
        fileLines.map((line) => feverStringFromJsString(line)),
        createTypedList(Meta.STRING),
      );
    }),
  ],
  to_number: [
    newFunction(1, [Meta.STRING], ([string]) => {
      const jsString = charListToJsString(string);
      if (isNumeric(jsString)) {
        return createVar(Number(jsString), Primitives.NUMBER);
      } else {
        return createError(
          '"' + jsString + '" cannot be interpreted as a number.',
        );
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
};

export const morphTypes = (value, toType, ctx) => {
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
};

export const standardLib = [
  "contains? = {lst:[], item} => (lst \\> (false, (item == @ | $), true))",
  "unique_add = {lst:[], (contains?(lst, item))} => (lst)",
  "unique_add = {lst:[], item} => (lst + item)",
  "unique = {lst:[]} => (lst \\> ([], (unique_add($,@))))",
  "is_whole? = {n:#} => (floor(n) == n)",
  "sum = {lst:[]} => (lst \\> (0, ($ + @)))",
  "min = {a:#, (a<=b):#} => (a)",
  "min = {_:#, b: #} => (b)",
  "min = {(len(lst) > 0):[]} => (lst \\> ((get(lst,0)), (?((@ < $), @, $))))",
  "max = {a:#, (a >= b):#} => (a)",
  "max = {_:#, b:#} => (b)",
  "max = {(len(lst) > 0):[]} => (lst \\> ((get(lst,0)), (?((@ > $), @, $))))",
  "slice = {lst:[], from:#} => (lst ~> (# >= from))",
  "in_range? = {target:#, (lower <= target):#, (target < higher):#} => true",
  "in_range? = {_:#, _:#, _: #} => false",
  "slice = {lst:[], from:#, to:#} => (lst ~> (in_range?(#, from, to)))",
  "head = {(len(lst) > 0):[]} => (get(lst,0))",
  "tail = {lst:[]} => (slice(lst,1))",
  "set = {(unique(entries)):[]}",
  "halve = {lst:[]} => ([slice(lst,0,floor(len(lst) / 2)), slice(lst, floor(len(lst) / 2 ))])",
  "merge = {_:fn, [], l2:[]} => (l2)",
  "merge = {_:fn, l1:[], []} => (l1)",
  "merge = {compare:fn, l1:[], ((compare(get(l1,0),get(l2,0))) < 0):[]} => ((get(l1,0)) + (merge(compare,tail(l1),l2)))",
  "merge = {compare:fn, l1:[], l2:[]} => ((get(l2,0)) + (merge(compare, l1, tail(l2))))",
  "sort = {(len(lst) <= 1):[], _:fn} => (lst)",
  "sort = {lst:[], compare:fn} => (merge(compare,sort(get(halve(lst),0),compare), sort(get(halve(lst),1),compare)))",
  "compare = {n1:#,(n1 < n2):#} => -1",
  "compare = {n1:#,(n1 > n2):#} => 1",
  "compare = {_:#,_:#} => 0",
  "sort = {nums:[#]} => (sort(nums, compare))",
  "reverse = {lst:[]} => (lst -> (get(lst, len(lst) - # - 1)))",
  "sum = {str:string} => (str \\> (0, ($ + ord(@))))",
  "hash = {str:string, mod:#} => (sum(str) % mod)",
  "abs = {(a < 0):#} => (a * -1)",
  "abs = {a:#} => (a)",
  "all = {vs:[], mapper:fn} => (vs \\> (true,(mapper(@) & $)))",
  "any = {vs:[], mapper:fn} => (vs \\> (false, (mapper(@) | $)))",
  "reverse = {vs:[]} => (vs -> (get(vs, len(vs) - # - 1)))",
  "first = {vs:[]} => (get(vs,0))",
  "last = {vs:[]} => (get(vs, len(vs) - 1))",
  "time_diff = {result: []} => (last(result) - first(result))",
];

// Defining adds doesn't work, ie.   "+ = {s:set, item} => (new(set, entries(s) + item))",

export const registerBuiltins = (ctx: Context) => {
  for (const functionName of Object.keys(builtins)) {
    const patterns = builtins[functionName];
    for (const pattern of patterns) {
      registerNewFunction(functionName, ctx, pattern);
    }
  }
  for (const line of standardLib) {
    interpret(line);
  }
};

const typesFromSignature = (signature) => {
  return signature.value.map((i) => i.value[1].value);
};

const conditionsFromSignature = (signature) => {
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
};

const namesFromSignature = (signature) => {
  return signature.value.map((i) => i.value[0].value[0].value);
};

const specificitiesFromSignature = (signature) => {
  return signature.value.map((i) => i.value[0].value[2].value);
};

const registerNewFunction = (name, variables, functionObject, rawCase?) => {
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
};

const nativeFunctionMessage = "<natively defined function>";

const generateCaseFromNative = (functionObject) => {
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
};

const newOfType = (t, args, ctx: Context) => {
  const typeVar = createTypeVar(t);
  return dispatchFunction("new", [typeVar, ...args]);
};

const argNamesFromFunction = (functionBody) => {
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
};

const serializeCase = (c) => {
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
};

const serializeFunction = (f) => {
  const rankedCases = simpleRankCases(f.value);
  return rankedCases.map((c) => serializeCase(c)).join("\n");
};

const simpleRankCases = (cases) => {
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
};

const simpleTypeSpec = (t) => {
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
};

export const typeToString = (t: FeverType): string => {
  return typeToStringRec(t, "");
};

const typeToStringRec = (t, contents) => {
  if (!t.meta) {
    return contents + t.baseName.toLowerCase();
  }

  if (isAlias(t)) {
    contents += t.alias;
  }

  const [open, close] = t.baseName === "LIST" ? ["[", "]"] : ["(", ")"];

  const types = t.types;
  contents += open;
  for (let i = 0; i < types.length; i++) {
    contents = typeToStringRec(types[i], contents);
    if (i < types.length - 1) {
      contents += ",";
    }
  }
  contents += close;
  return contents;
};

const namedMap = (
  list: FeverVar,
  action: FeverVar,
  ctx: Context,
  [element, index, intermediate]: string[],
) => {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    ctx.enterScope();
    ctx.assignValue(element, item);
    ctx.assignValue(index, createVar(i, Primitives.NUMBER));
    ctx.assignValue(
      intermediate,
      createVar(
        [...internalList],
        createTypedList(
          internalList.length > 0 ? internalList[0].type : Primitives.ANY,
        ),
      ),
    );
    const result = evaluate(action.value);
    internalList.push(result);
    ctx.exitScope();
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
};

const namedReduce = (
  list,
  acc,
  expr,
  ctx: Context,
  [element, index, accumulator]: string[],
  earlyTerminateIfNotFalse,
) => {
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    ctx.enterScope();
    ctx.assignValue(element, item);
    ctx.assignValue(index, createVar(i, Primitives.NUMBER));
    ctx.assignValue(accumulator, acc);
    acc = evaluate(expr);
    ctx.exitScope();
    if (earlyTerminateIfNotFalse && acc.value !== false) {
      return acc;
    }
  }
  return acc;
};

const namedFilter = (
  list,
  action,
  ctx: Context,
  [element, index, intermediate]: string[],
  funcRef,
) => {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    ctx.enterScope();
    ctx.assignValue(element, item);
    ctx.assignValue(index, createVar(i, Primitives.NUMBER));
    ctx.assignValue(
      intermediate,
      createVar(
        internalList,
        createTypedList(
          internalList.length > 0 ? internalList[0].type : Primitives.ANY,
        ),
      ),
    );
    let result;
    if (funcRef) {
      result = callFunctionByReference(funcRef, [item], ctx, "lambda");
    } else {
      result = evaluate(action.value);
    }
    if (result.value) {
      internalList.push(item);
    }
    ctx.exitScope();
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
};

const isNumeric = (n) => {
  return !isNaN(parseFloat(n)) && isFinite(n);
};

function addFunctionCase(name: FeverVar, func: FeverVar, ctx: Context) {
  {
    const signature = func.value[0];
    const expression = func.value[1];
    const size = signature.value.length;

    const types = typesFromSignature(signature);
    const conditions = conditionsFromSignature(signature);
    const names = namesFromSignature(signature);
    const specificities = specificitiesFromSignature(signature);

    const operation = (args, ctx) => {
      ctx.enterScope();
      for (let i = 0; i < args.length; i++) {
        ctx.assignValue(names[i], args[i]);
      }
      const result = evaluate(expression.value);
      ctx.exitScope();
      return result;
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
