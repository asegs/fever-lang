import {
  charListToJsString,
  createError,
  createType,
  createTypedList,
  createTypedTuple,
  createTypeVar,
  createVar,
  isAlias,
  meta,
  primitives,
  recursiveToString,
  typeAssignableFrom,
  typeWeights,
} from "./types.js";
import {
  callFunction,
  callFunctionByReference,
  evaluate,
  goals,
} from "./interpreter.js";
import { feverStringFromJsString, inferListType } from "./literals.js";
import { readFileSync } from "fs";

const newFunction = (arity, types, functionOperation, args) => {
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
};

export const builtins = {
  "+": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value + b.value, a.type),
    ),
    newFunction(2, [meta.LIST, meta.LIST], ([a, b]) => {
      const l = a.value.concat(b.value);
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [meta.LIST, meta.STRING], ([a, b]) => {
      const l = [...a.value, b];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [meta.STRING, meta.LIST], ([a, b]) => {
      const l = [a, ...b.value];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [meta.STRING, meta.STRING], ([a, b]) =>
      createVar(a.value.concat(b.value), a.type),
    ),
    newFunction(2, [primitives.ANY, meta.LIST], ([a, b]) => {
      const l = [a, ...b.value];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [meta.LIST, primitives.ANY], ([a, b]) => {
      const l = [...a.value, b];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [primitives.CHARACTER, primitives.NUMBER], ([char, shift]) =>
      createVar(
        String.fromCharCode(char.value.charCodeAt(0) + shift.value),
        primitives.CHARACTER,
      ),
    ),
    newFunction(2, [primitives.CHARACTER, primitives.CHARACTER], ([c1, c2]) => {
      return feverStringFromJsString(c1.value + c2.value);
    }),
  ],
  "*": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value * b.value, a.type),
    ),
    newFunction(2, [meta.LIST, primitives.NUMBER], ([a, b]) => {
      const list = [];
      for (let i = 0; i < b.value; i++) {
        for (let z = 0; z < a.value.length; z++) {
          list.push(a.value[z]);
        }
      }
      return createVar(list, a.type);
    }),
    newFunction(2, [primitives.NUMBER, meta.LIST], ([a, b]) => {
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
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value - b.value, a.type),
    ),
  ],
  "/": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value / b.value, a.type),
    ),
  ],
  ">": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value > b.value, primitives.BOOLEAN),
    ),
  ],
  "<": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value < b.value, primitives.BOOLEAN),
    ),
  ],
  "&": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value && b.value, primitives.BOOLEAN),
    ),
  ],
  "|": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value || b.value, primitives.BOOLEAN),
    ),
  ],
  "<=": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value <= b.value, primitives.BOOLEAN),
    ),
  ],
  ">=": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(a.value >= b.value, primitives.BOOLEAN),
    ),
  ],
  "->": [
    newFunction(
      2,
      [meta.LIST, primitives.EXPRESSION],
      ([list, action], variables, morphisms) => {
        return namedMap(list, action, variables, morphisms, ["@", "#", "^"]);
      },
    ),
    // [1,2,3] -> (['item','index','intermediate'], (item + 1))
    newFunction(
      2,
      [
        meta.LIST,
        createTypedTuple([createTypedList(meta.STRING), primitives.EXPRESSION]),
      ],
      ([list, namedAction], variables, morphisms) => {
        const [names, action] = namedAction.value;
        const nameTable = ["@", "#", "^"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = charListToJsString(providedNames[i]);
        }
        return namedMap(list, action, variables, morphisms, nameTable);
      },
    ),
    newFunction(
      2,
      [meta.LIST, primitives.ANY],
      ([list, result], variables, morphisms) => {
        const results = list.value.map((ignored) => result);
        const res = createVar(
          results,
          createTypedList(
            results.length > 0 ? results[0].type : primitives.ANY,
            list.type.alias,
          ),
        );

        if (isAlias(res.type)) {
          const created = newOfType(res.type, [res], variables, morphisms);
          if (created.type.baseName !== "ERROR") {
            return created;
          }
        }
        return res;
      },
    ),
    newFunction(
      2,
      [meta.LIST, meta.FUNCTION],
      ([list, func], variables, morphisms) => {
        const results = list.value.map((item) =>
          callFunctionByReference(func, [item], variables, morphisms, "lambda"),
        );
        const errors = results.filter((res) => res.type.baseName === "ERROR");
        if (errors.length > 0) {
          return errors[0];
        }
        const res = createVar(
          results,
          createTypedList(
            results.length > 0 ? results[0].type : primitives.ANY,
            list.type.alias,
          ),
        );

        if (isAlias(res.type)) {
          const created = newOfType(res.type, [res], variables, morphisms);
          if (created.type.baseName !== "ERROR") {
            return created;
          }
        }

        return res;
      },
    ),
  ],
  "\\>": [
    newFunction(
      2,
      [meta.LIST, createTypedTuple([primitives.ANY, primitives.EXPRESSION])],
      ([list, reduce], variables, morphisms) => {
        const [acc, reduction] = reduce.value;
        return namedReduce(
          list,
          acc,
          reduction,
          variables,
          morphisms,
          ["@", "#", "$"],
          false,
        );
      },
    ),
    newFunction(
      2,
      [
        meta.LIST,
        createTypedTuple([
          createTypedList(meta.STRING),
          primitives.ANY,
          primitives.EXPRESSION,
        ]),
      ],
      ([list, namedReduction], variables, morphisms) => {
        const [names, acc, reduction] = namedReduction.value;
        const nameTable = ["@", "#", "$"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = charListToJsString(providedNames[i]);
        }
        return namedReduce(
          list,
          acc,
          reduction,
          variables,
          morphisms,
          nameTable,
          false,
        );
      },
    ),
    newFunction(
      2,
      [
        meta.LIST,
        createTypedTuple([
          primitives.ANY,
          primitives.EXPRESSION,
          primitives.BOOLEAN,
        ]),
      ],
      ([list, reduce], variables, morphisms) => {
        const [acc, reduction, flag] = reduce.value;
        return namedReduce(
          list,
          acc,
          reduction,
          variables,
          morphisms,
          ["@", "#", "$"],
          flag.value,
        );
      },
    ),
    newFunction(
      2,
      [
        meta.LIST,
        createTypedTuple([
          createTypedList(meta.STRING),
          primitives.ANY,
          primitives.EXPRESSION,
          primitives.BOOLEAN,
        ]),
      ],
      ([list, namedReduction], variables, morphisms) => {
        const [names, acc, reduction, flag] = namedReduction.value;
        const nameTable = ["@", "#", "$"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = charListToJsString(providedNames[i]);
        }
        return namedReduce(
          list,
          acc,
          reduction,
          variables,
          morphisms,
          nameTable,
          flag.value,
        );
      },
    ),
  ],
  "~>": [
    newFunction(
      2,
      [meta.LIST, primitives.EXPRESSION],
      ([list, action], variables, morphisms) => {
        return namedFilter(
          list,
          action,
          variables,
          morphisms,
          ["@", "#", "^"],
          null,
        );
      },
    ),
    newFunction(
      2,
      [
        meta.LIST,
        createTypedTuple([createTypedList(meta.STRING), primitives.EXPRESSION]),
      ],
      ([list, namedAction], variables, morphisms) => {
        const [names, filter] = namedAction.value;
        const nameTable = ["@", "#", "^"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = charListToJsString(providedNames[i]);
        }
        return namedFilter(list, filter, variables, morphisms, nameTable, null);
      },
    ),
    newFunction(
      2,
      [meta.LIST, meta.FUNCTION],
      ([list, funcRef], variables, morphisms) => {
        return namedFilter(
          list,
          null,
          variables,
          morphisms,
          ["@", "#", "^"],
          funcRef,
        );
      },
    ),
  ],
  "==": [
    newFunction(2, [primitives.ANY, primitives.ANY], ([a, b]) =>
      createVar(
        JSON.stringify(a.value) === JSON.stringify(b.value),
        primitives.BOOLEAN,
      ),
    ),
  ],
  "%": [
    newFunction(2, [primitives.NUMBER, primitives.NUMBER], ([a, b]) =>
      createVar(a.value % b.value, primitives.NUMBER),
    ),
  ],
  "=>": [
    newFunction(
      2,
      [meta.SIGNATURE, primitives.EXPRESSION],
      ([signature, expression]) => {
        return createVar([signature, expression], meta.CASE);
      },
    ),
    newFunction(2, [meta.SIGNATURE, primitives.ANY], ([signature, value]) => {
      return createVar(
        [signature, createVar(recursiveToString(value), primitives.EXPRESSION)],
        meta.CASE,
      );
    }),
  ],
  "=": [
    newFunction(
      2,
      [meta.STRING, primitives.ANY],
      ([name, value], variables) => {
        variables.assignValue(charListToJsString(name), value);
        return value;
      },
    ),
    newFunction(2, [meta.STRING, meta.CASE], ([name, func], variables) => {
      const realName = charListToJsString(name);

      const signature = func.value[0];
      const expression = func.value[1];
      const size = signature.value.length;

      const types = typesFromSignature(signature);
      const conditions = conditionsFromSignature(signature);
      const names = namesFromSignature(signature);
      const specificities = specificitiesFromSignature(signature);

      const operation = (args, variables, morphisms) => {
        variables.enterScope();
        for (let i = 0; i < args.length; i++) {
          variables.assignValue(names[i], args[i]);
        }
        const result = evaluate(
          expression.value,
          variables,
          morphisms,
          goals.EVALUATE,
        );
        variables.exitScope();
        return result;
      };
      return registerNewFunction(
        realName,
        variables,
        newFunction(size, types, operation, {
          conditions: conditions,
          specificities: specificities,
        }),
        func,
      );
    }),
    newFunction(
      2,
      [meta.STRING, meta.SIGNATURE],
      ([name, signature], variables) => {
        const realName = charListToJsString(name);
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
        meta[realName.toUpperCase()] = newType;

        const permutations = [];

        for (let i = 0; i < size; i++) {
          const condition = signature.value[i].value[0].value;
          const name = condition[0];

          //Handle 1 <-> 1 members
          const expression = condition[1];
          if (
            expression.value.startsWith("==") ||
            expression.value === "true"
          ) {
            permutations.push((arg) => arg);
          } else {
            permutations.push((arg, variables, morphisms) => {
              variables.enterScope();
              variables.assignValue(name.value, arg);
              const result = evaluate(
                expression.value,
                variables,
                morphisms,
                goals.EVALUATE,
              );
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
            newFunction(
              2,
              [newType, types[i]],
              ([ofType, newValue], variables, morphisms) => {
                ofType.value[i] = permutations[i](
                  newValue,
                  variables,
                  morphisms,
                );
                return ofType;
              },
            ),
          );
        }

        //Apply relevant condition to each arg if not simple var name.
        const operation = ([, ...args], variables, morphisms) => {
          const mutatedArgs = [];

          for (let i = 0; i < size; i++) {
            mutatedArgs.push(permutations[i](args[i], variables, morphisms));
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
          newFunction(size + 1, [primitives.TYPE, ...types], operation, {
            conditions: [
              (arg) => {
                return typeAssignableFrom(arg.value, newType);
              },
              ...Array(size).fill(() => true),
            ],
            specificities: Array(size + 1).fill(1),
          }),
        );

        const typeVar = createVar(newType, primitives.TYPE);
        variables.assignValue(realName, typeVar);
        return typeVar;
      },
    ),
  ],
  show: [
    newFunction(
      1,
      [primitives.ANY],
      ([v], variables, morphisms) => {
        console.log(
          charListToJsString(
            callFunction("stringify", [v], variables, morphisms),
          ),
        );
        return v;
      },
      {
        specificities: [1],
      },
    ),
    newFunction(1, [primitives.ERROR], ([e]) => {
      console.log(e.value);
      return e;
    }),
    newFunction(2, [primitives.ANY, meta.STRING], ([v, delimiter]) => {
      process.stdout.write(recursiveToString(v) + delimiter.value);
      return v;
    }),
    newFunction(2, [meta.STRING, meta.STRING], ([v, delimiter]) => {
      process.stdout.write(charListToJsString(v) + delimiter.value);
      return v;
    }),
  ],
  explain: [
    newFunction(1, [primitives.ANY], ([v]) => {
      console.dir(v, { depth: null });
      return v;
    }),
  ],
  "..": [
    newFunction(
      2,
      [primitives.NUMBER, primitives.NUMBER],
      ([a, b]) => {
        const direction = a.value < b.value ? 1 : -1;
        const numbers = [];
        for (let i = a.value; i !== b.value; i += direction) {
          numbers.push(createVar(i, primitives.NUMBER));
        }
        numbers.push(b);
        return createVar(numbers, createTypedList(primitives.NUMBER));
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
    newFunction(2, [meta.LIST, primitives.NUMBER], ([list, num]) => {
      if (num.value < list.value.length) {
        return list.value[num.value];
      }

      return createError(
        "Index " + num.value + " out of range on " + recursiveToString(list),
      );
    }),
    newFunction(2, [meta.TUPLE, primitives.NUMBER], ([tuple, num]) => {
      if (num.value < tuple.value.length) {
        return tuple.value[num.value];
      }

      return createError(
        "Index " + num.value + " out of range on " + recursiveToString(tuple),
      );
    }),
  ],
  floor: [
    newFunction(1, [primitives.NUMBER], ([num]) => {
      return createVar(Math.floor(num.value), primitives.NUMBER);
    }),
  ],
  ceil: [
    newFunction(1, [primitives.NUMBER], ([num]) => {
      return createVar(Math.ceil(num.value), primitives.NUMBER);
    }),
  ],
  "?": [
    newFunction(
      3,
      [primitives.BOOLEAN, primitives.ANY, primitives.ANY],
      ([truth, a, b]) => {
        return truth.value ? a : b;
      },
    ),
  ],
  nl: [
    newFunction(1, [primitives.ANY], ([ignored]) => {
      console.log();
      return ignored;
    }),
  ],
  sqrt: [
    newFunction(
      1,
      [primitives.NUMBER],

      ([val]) => {
        return createVar(Math.sqrt(val.value), primitives.NUMBER);
      },
      {
        conditions: [(arg) => arg.value >= 0],
        specificities: [1],
      },
    ),
  ],
  not: [
    newFunction(1, [primitives.BOOLEAN], ([truth]) => {
      return createVar(!truth.value, primitives.BOOLEAN);
    }),
  ],
  len: [
    newFunction(1, [meta.LIST], ([list]) => {
      return createVar(list.value.length, primitives.NUMBER);
    }),
  ],
  stringify: [
    newFunction(
      1,
      [primitives.ANY],
      ([v]) => {
        return feverStringFromJsString(recursiveToString(v));
      },
      {
        specificities: [0.6],
      },
    ),
    newFunction(
      1,
      [meta.FUNCTION],
      ([func]) => {
        return feverStringFromJsString(serializeFunction(func));
      },
      {
        specificities: [0.6],
      },
    ),
    newFunction(
      1,
      [primitives.TYPE],
      ([typeVar]) => {
        return feverStringFromJsString(typeToString(typeVar.value, ""));
      },
      {
        specificities: [0.6],
      },
    ),
  ],
  type: [
    newFunction(
      1,
      [primitives.ANY],
      ([v]) => {
        return createVar(v.type, primitives.TYPE);
      },
      {
        specificities: [0.6],
      },
    ),
  ],
  ord: [
    newFunction(1, [primitives.CHARACTER], ([c]) =>
      createVar(c.value.charCodeAt(0), primitives.NUMBER),
    ),
  ],
  depth: [
    newFunction(1, [primitives.ANY], ([ignored], variables) => {
      return createVar(variables.scopes.length, primitives.NUMBER);
    }),
  ],
  time: [
    newFunction(1, [primitives.NUMBER], ([diff]) => {
      return createVar(Date.now() - diff.value, primitives.NUMBER);
    }),
  ],
  morph: [
    newFunction(
      2,
      [meta.FUNCTION, primitives.TYPE],
      ([transformation, toType], variables, morphisms) => {
        const fromType = transformation.invocations[0].types[0];
        morphisms.registerMorphism(fromType, toType.value, transformation);
        return createVar(true, primitives.BOOLEAN);
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
      [meta.FUNCTION, primitives.TYPE, primitives.TYPE],
      ([transformation, fromType, toType], variables, morphisms) => {
        morphisms.registerMorphism(
          fromType.value,
          toType.value,
          transformation,
        );
        return createVar(true, primitives.BOOLEAN);
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
      [primitives.ANY, primitives.TYPE],
      ([value, toType], variables, morphisms) => {
        return morphTypes(value, toType, variables, morphisms);
      },
    ),
  ],
  read: [
    newFunction(1, [meta.STRING], ([path]) => {
      // We should have global state based on a passed in file to get its directory.
      const pathSlug = charListToJsString(path);
      const dir = process.cwd();
      const fileText = readFileSync(dir + "/" + pathSlug).toString();
      const fileLines = fileText.split("\n");
      return createVar(
        fileLines.map((line) => feverStringFromJsString(line)),
        createTypedList(meta.STRING),
      );
    }),
  ],
  to_number: [
    newFunction(1, [meta.STRING], ([string]) => {
      const jsString = charListToJsString(string);
      if (isNumeric(jsString)) {
        return createVar(Number(jsString), primitives.NUMBER);
      } else {
        return createError(
          '"' + jsString + '" cannot be interpreted as a number.',
        );
      }
    }),
  ],
  is_numeric: [
    newFunction(1, [meta.STRING], ([string]) => {
      const jsString = charListToJsString(string);
      if (isNumeric(jsString)) {
        return createVar(true, primitives.BOOLEAN);
      } else {
        return createVar(false, primitives.BOOLEAN);
      }
    }),
  ],
  replace: [
    newFunction(
      3,
      [meta.STRING, meta.STRING, meta.STRING],
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

export const morphTypes = (value, toType, variables, morphisms) => {
  let intermediateValue = value;
  const typePath = morphisms.pathBetween(value.type, toType.value);
  for (let i = 0; i < typePath.length - 1; i++) {
    const transformation = morphisms.table[typePath[i]][typePath[i + 1]];
    intermediateValue = callFunctionByReference(
      transformation,
      [intermediateValue],
      variables,
      morphisms,
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
  "+ = {s:set, item} => (new(set, entries(s) + item))",
  "halve = {lst:[]} => ([(slice(lst,0,floor(len(lst) / 2))), (slice(lst, floor(len(lst) / 2 )))])",
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
];

export const registerBuiltins = (variables) => {
  for (const functionName of Object.keys(builtins)) {
    const patterns = builtins[functionName];
    for (const pattern of patterns) {
      registerNewFunction(functionName, variables, pattern);
    }
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
    conditions.push((argument, variables, morphisms) => {
      variables.assignValue(conditionName.value, argument);
      const result = evaluate(
        conditionExpression.value,
        variables,
        morphisms,
        goals.EVALUATE,
      );
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

const registerNewFunction = (name, variables, functionObject, rawCase) => {
  let newCase;

  if (rawCase) {
    newCase = rawCase;
  } else {
    newCase = generateCaseFromNative(functionObject);
  }
  const named = variables.getOrNull(name);
  if (!named) {
    const newFunc = createVar([newCase], meta.FUNCTION);
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
            createVar(names[i], meta.STRING),
            createVar(
              condition.toString() === "() => true"
                ? "true"
                : nativeFunctionMessage,
              primitives.EXPRESSION,
            ),
            createVar(specificities[i], primitives.NUMBER),
          ],
          meta.CONDITION,
        ),
        createVar(type, primitives.TYPE),
      ],
      meta.PATTERN,
    );
    patterns.push(pattern);
  }

  return createVar(
    [
      createVar(patterns, meta.SIGNATURE),
      createVar(nativeFunctionMessage, primitives.EXPRESSION),
    ],
    meta.CASE,
  );
};

const newOfType = (t, args, vars, morphisms) => {
  const typeVar = createTypeVar(t);
  return callFunction("new", [typeVar, ...args], vars, morphisms);
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
  let caseText = "(";
  const [signature, expression] = c.value;
  const patterns = signature.value;
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const [condition, type] = pattern.value;
    const [varName, conditionExpr] = condition.value;
    caseText +=
      conditionExpr.value === "true" ? varName.value : conditionExpr.value;
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
  caseText += expression.value;

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
    return typeWeights.ANY;
  }

  if (t.baseName === "TUPLE" && t.types.length === 0) {
    return typeWeights.BASE_TUPLE;
  }

  if (isAlias(t)) {
    return typeWeights.NOMINAL;
  }

  return typeWeights.EQUIVALENT;
};

export const typeToString = (t) => {
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
  list,
  action,
  variables,
  morphisms,
  [element, index, intermediate],
) => {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    variables.enterScope();
    variables.assignValue(element, item);
    variables.assignValue(index, createVar(i, primitives.NUMBER));
    variables.assignValue(
      intermediate,
      createVar(
        [...internalList],
        createTypedList(
          internalList.length > 0 ? internalList[0].type : primitives.ANY,
        ),
      ),
    );
    const result = evaluate(action.value, variables, morphisms, goals.EVALUATE);
    internalList.push(result);
    variables.exitScope();
  }

  const result = createVar(
    internalList,
    inferListType(internalList, list.type.alias),
  );

  if (isAlias(list.type)) {
    const created = newOfType(result.type, [result], variables, morphisms);
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
  variables,
  morphisms,
  [element, index, accumulator],
  earlyTerminateIfNotFalse,
) => {
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    variables.enterScope();
    variables.assignValue(element, item);
    variables.assignValue(index, createVar(i, primitives.NUMBER));
    variables.assignValue(accumulator, acc);
    acc = evaluate(expr.value, variables, morphisms, goals.EVALUATE);
    variables.exitScope();
    if (earlyTerminateIfNotFalse && acc.value !== false) {
      return acc;
    }
  }
  return acc;
};

const namedFilter = (
  list,
  action,
  variables,
  morphisms,
  [element, index, intermediate],
  funcRef,
) => {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    variables.enterScope();
    variables.assignValue(element, item);
    variables.assignValue(index, createVar(i, primitives.NUMBER));
    variables.assignValue(
      intermediate,
      createVar(
        internalList,
        createTypedList(
          internalList.length > 0 ? internalList[0].type : primitives.ANY,
        ),
      ),
    );
    let result;
    if (funcRef) {
      result = callFunctionByReference(
        funcRef,
        [item],
        variables,
        morphisms,
        "lambda",
      );
    } else {
      result = evaluate(action.value, variables, morphisms, goals.EVALUATE);
    }
    if (result.value) {
      internalList.push(item);
    }
    variables.exitScope();
  }

  const result = createVar(
    internalList,
    inferListType(internalList, list.type.alias),
  );

  if (isAlias(list.type)) {
    const created = newOfType(result.type, [result], variables, morphisms);
    if (created.type.baseName !== "ERROR") {
      return created;
    }
  }
  return result;
};

const isNumeric = (n) => {
  return !isNaN(parseFloat(n)) && isFinite(n);
};
