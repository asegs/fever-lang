import {
    charListToJsString,
    createTypedList,
    createTypedTuple,
    createVar,
    meta,
    primitives,
    recursiveToString
} from './types.js'
import {evaluate, goals} from "./interpreter.js";

const newFunction = (arity, types, conditions, functionOperation, specificities) => {
    const func = {
        'arity': arity,
        'types': types,
        'conditions': conditions,
        'function': functionOperation
    };

    if (specificities) {
        func['specificities'] = specificities;
    }

    return func;
}

export const builtins = {
    '+': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value + b.value, a.type)
        ),
        newFunction(
            2,
            [meta.LIST, meta.LIST],
            [() => true, () => true],
            ([a, b]) => createVar(a.value.concat(b.value), a.type)

        ),
        newFunction(
            2,
            [primitives.ANY, meta.LIST],
            [() => true, () => true],
            ([a, b]) => createVar([a, ...b.value], b.type)
        ),
        newFunction(
            2,
            [meta.LIST, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar([...a.value, b], a.type)
        ),
        newFunction(
            2,
            [primitives.CHARACTER, primitives.NUMBER],
            [() => true, () => true],
            ([char, shift]) => createVar(String.fromCharCode(char.value.charCodeAt(0) + shift.value), primitives.CHARACTER)
        )
    ],
    '*': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value * b.value, a.type)
        ),
        newFunction(
            2,
            [meta.LIST, primitives.NUMBER],
            [() => true, () => true],
            ([a, b]) => {
                const list = [];
                for (let i = 0 ; i < b.value ; i ++ ) {
                    for (let z = 0 ; z < a.value.length ; z ++ ) {
                        list.push(a.value[z]);
                    }
                }
                return createVar(list, a.type);
            }
        ),
        newFunction(
            2,
            [primitives.NUMBER, meta.LIST],
            [() => true, () => true],
            ([a, b]) => {
                const list = [];
                for (let i = 0 ; i < a.value ; i ++ ) {
                    for (let z = 0 ; z < b.value.length ; z ++ ) {
                        list.push(b.value[z]);
                    }
                }
                return createVar(list, b.type);
            }
        )
    ],
    '-': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value - b.value, a.type)
        )
    ],
    '/': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value / b.value, a.type)
        )
    ],
    '>': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value > b.value, primitives.BOOLEAN)
        )
    ],
    '<': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value < b.value, primitives.BOOLEAN)
        )
    ],
    '&': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value && b.value, primitives.BOOLEAN)
        )
    ],
    '|': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value || b.value, primitives.BOOLEAN)
        )
    ],
    '<=': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value <= b.value, primitives.BOOLEAN)
        )
    ],
    '>=': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a, b]) => createVar(a.value >= b.value, primitives.BOOLEAN)
        )
    ],
    '->': [
        newFunction(
            2,
            [meta.LIST, primitives.EXPRESSION],
            [() => true, () => true],
            ([list, action], variables, functions, morphisms) => {
                const internalList = [];
                for (let i = 0 ; i < list.value.length ; i ++ ) {
                    const item = list.value[i];
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(i, primitives.NUMBER));
                    variables.assignValue('^', createVar([...internalList], createTypedList(internalList.length > 0 ? internalList[0].type : primitives.ANY)));
                    const result = evaluate(action.value, variables, functions, morphisms, goals.EVALUATE);
                    internalList.push(result);
                    variables.exitScope();
                }
                return createVar(internalList, createTypedList(internalList.length > 0 ? internalList[0].type : primitives.ANY));
            }
        )
    ],
    '\\>': [
        newFunction(
            2,
            [meta.LIST, createTypedTuple([primitives.ANY, primitives.EXPRESSION])],
            [() => true, () => true],
            ([list, reduce], variables, functions, morphisms) => {
                let acc = reduce.value[0];
                const expr = reduce.value[1].value;
                for (let i = 0 ; i < list.value.length ; i ++ ) {
                    const item = list.value[i];
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(i, primitives.NUMBER));
                    variables.assignValue('$', acc);
                    acc = evaluate(expr, variables, functions, morphisms, goals.EVALUATE);
                    variables.exitScope();
                }
                return acc;
            }
        )
    ],
    '~>': [
        newFunction(
            2,
            [meta.LIST, primitives.EXPRESSION],
            [() => true, () => true],
            ([list, action], variables, functions, morphisms) => {
                const internalList = [];
                for (let i = 0 ; i < list.value.length ; i ++ ) {
                    const item = list.value[i];
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(i, primitives.NUMBER));
                    variables.assignValue('^', createVar(internalList, createTypedList(internalList.length > 0 ? internalList[0].type : primitives.ANY)));
                    const result = evaluate(action.value, variables, functions, morphisms, goals.EVALUATE);
                    if (result.value) {
                        internalList.push(item);
                    }
                    variables.exitScope();
                }

                return createVar(internalList, createTypedList(internalList.length > 0 ? internalList[0].type : primitives.ANY));
            }
        )
    ],
    '==': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            [() => true, () => true],
            ([a,b]) => createVar(JSON.stringify(a.value) === JSON.stringify(b.value), primitives.BOOLEAN)
        )
    ],
    '%': [
        newFunction(
            2,
            [primitives.NUMBER, primitives.NUMBER],
            [() => true, () => true],
            ([a,b]) => createVar(a.value % b.value, primitives.NUMBER)
        )
    ],
    '=>': [
        newFunction(
            2,
            [meta.SIGNATURE, primitives.EXPRESSION],
            [() => true, () => true],
            ([signature, expression]) => {
                return createVar(
                    [signature, expression],
                    meta.FUNCTION
                );
            }
        ),
        newFunction(
            2,
            [meta.SIGNATURE, primitives.ANY],
            [() => true, () => true],
            ([signature, value]) => {
                return createVar(
                    [signature, createVar(recursiveToString(value), primitives.EXPRESSION)],
                    meta.FUNCTION
                );
            }
        )
    ],
    '=': [
        newFunction(
            2,
            [meta.STRING, primitives.ANY],
            [() => true, () => true],
            ([name, value], variables) => {
                variables.assignValue(charListToJsString(name), value);
                return value;
            }
        ),
        newFunction(
            2,
            [meta.STRING, meta.FUNCTION],
            [() => true, () => true],
            ([name, func], variables, functions, morphisms) => {
                const realName = charListToJsString(name);
                variables.assignValue(realName, func);

                const signature = func.value[0];
                const expression = func.value[1];
                const size = signature.value.length;

                const types = typesFromSignature(signature);
                const conditions = conditionsFromSignature(signature);
                const names = namesFromSignature(signature);
                const specificities = specificitiesFromSignature(signature);

                const operation = (args, variables, functions, morphisms) => {
                    variables.enterScope();
                    for (let i = 0 ; i < args.length ; i ++ ) {
                        variables.assignValue(names[i], args[i]);
                    }
                    const result = evaluate(expression.value, variables, functions, morphisms, goals.EVALUATE);
                    variables.exitScope();
                    return result;
                }
                registerNewFunction(
                    realName,
                    functions,
                    newFunction(
                        size,
                        types,
                        conditions,
                        operation,
                        specificities
                    )
                );

                return func;
            }
        ),
        newFunction(
            2,
            [meta.STRING, meta.SIGNATURE],
            [() => true, () => true],
            ([name, signature], variables, functions) => {
                const realName = charListToJsString(name);
                variables.assignValue(realName, signature);
                const types = typesFromSignature(signature);
                const size = types.length;
                const newType = createTypedTuple(types, realName);
                meta[realName] = newType;

                const permutations = [];

                for (let i = 0 ; i < size ; i ++ ) {
                    const condition = signature.value[i].value[0].value;
                    const name = condition[0];

                    registerNewFunction(
                        realName + "_" + name.value,
                        functions,
                        newFunction(
                            1,
                            [newType],
                            [() => true],
                            ([ofType]) => {
                                return ofType.value[i];
                            }
                        )
                    )

                    const expression = condition[1];
                    if (expression.value.startsWith('==')) {
                        permutations.push(arg => arg);
                        continue;
                    }

                    //Conditions table is still putting out raw strings, not lists!
                    permutations.push(
                        (arg, variables, functions, morphisms) => {
                            variables.enterScope();
                            variables.assignValue(name.value, arg);
                            const result = evaluate(expression.value, variables, functions, morphisms, goals.EVALUATE);
                            variables.exitScope();
                            return result;
                        }
                    );
                }


                //Apply relevant condition to each arg if not simple var name.
                const operation = (args, variables, functions, morphisms) => {
                    const mutatedArgs = [];

                    for (let i = 0 ; i < size ; i ++) {
                        mutatedArgs.push(permutations[i](args[i], variables, functions, morphisms));
                    }
                    return createVar(mutatedArgs, newType);
                }

                const conditions = [];

                for (let i = 0 ; i < size ; i ++ ) {
                    conditions.push(() => true);
                }

                registerNewFunction(
                    "new_" + realName,
                    functions,
                    newFunction(
                        size,
                        types,
                        conditions,
                        operation
                    )
                );

                //Implement constructor that applies conditions to inputs
                //Implement getters for each property in global scope
                return signature;
            }
        )
    ],
    'show': [
        newFunction(
            1,
            [primitives.ANY],
            [() => true],
            ([v]) => {
                console.log(recursiveToString(v));
                return v;
            }
        ),
        newFunction(
            2,
            [primitives.ANY, meta.STRING],
            [() => true, () => true],
            ([v, delimiter]) => {
                process.stdout.write(recursiveToString(v) + delimiter.value);
                return v;
            }
        ),
        newFunction(
            2,
            [meta.STRING, meta.STRING],
            [() => true, () => true],
            ([v, delimiter]) => {
                process.stdout.write(charListToJsString(v) + delimiter.value);
                return v;
            }
        )
    ],
    'explain': [
        newFunction(
            1,
            [primitives.ANY],
            [() => true],
            ([v]) => {
                console.dir(v, { depth: null });
                return createVar(v.value, v.type);
            }
        )
    ],
    '..': [
        newFunction(
            2,
            [primitives.NUMBER, primitives.NUMBER],
            [(num) => Number.isInteger(num.value), (num) => Number.isInteger(num.value)],
            ([a, b]) => {
                const direction = (a.value < b.value) ? 1 : -1;
                const numbers = [];
                for (let i = a.value ; i !== b.value ; i += direction) {
                    numbers.push(createVar(i, primitives.NUMBER));
                }
                numbers.push(b);
                return createVar(numbers, createTypedList(primitives.NUMBER));
            }
        )
    ],
    'get': [
        newFunction(
            2,
            [meta.LIST, primitives.NUMBER],
            [() => true, () => true],
            ([list, num]) => {
                return list.value[num.value];
            }
        ),
        newFunction(
            2,
            [meta.TUPLE, primitives.NUMBER],
            [() => true, () => true],
            ([tuple, num]) => {
                return tuple.value[num.value];
            }
        )
    ],
    'floor': [
        newFunction(
            1,
            [primitives.NUMBER],
            [() => true],
            ([num]) => {
                return createVar(Math.floor(num.value), primitives.NUMBER);
            }
        )
    ],
    'ceil': [
        newFunction(
            1,
            [primitives.NUMBER],
            [() => true],
            ([num]) => {
                return createVar(Math.ceil(num.value), primitives.NUMBER);
            }
        )
    ],
    '?': [
        newFunction(
            3,
            [primitives.BOOLEAN, primitives.ANY, primitives.ANY],
            [() => true, () => true, () => true],
            ([truth, a, b]) => {
                return truth.value ? a : b;
            }
        )
    ],
    'nl': [
        newFunction(
            1,
            [primitives.ANY],
            [() => true],
            ([ignored]) => {
                console.log();
                return ignored;
            }
        )
    ],
    'sqrt': [
        newFunction(
            1,
            [primitives.NUMBER],
            [(arg) => arg.value >= 0],
            ([val]) => {
                return createVar(Math.sqrt(val.value), primitives.NUMBER);
            }
        )
    ],
    'not': [
        newFunction(
            1,
            [primitives.BOOLEAN],
            [() => true],
            ([truth]) => {
                return createVar(!truth.value, primitives.BOOLEAN);
            }
        )
    ],
    'len': [
        newFunction(
            1,
            [meta.LIST],
            [() => true],
            ([list]) => {
                return createVar(list.value.length, primitives.NUMBER);
            }
        )
    ],
    'stringify': [
        newFunction(
            1,
            [primitives.ANY],
            [() => true],
            ([v]) => {
                return createVar(recursiveToString(v), meta.STRING);
            }
        )
    ],
    'type': [
        newFunction(
            1,
            [primitives.ANY],
            [() => true],
            ([v]) => {
                if ('alias' in v.type) {
                    return createVar(v.type.alias, meta.STRING);
                }
                return createVar(v.type.baseName, meta.STRING);
             }
        )
    ]
}

export const standardLib = [
    "contains = {list:[], item} => (list \\> (false, (item == @ | $)))",
    "is_whole = {n:number} => (floor(n) == n)",
    "sum = {list:[]} => (list \\> (0, ($ + @)))",
    "min = {a:number, (a<=b):number} => (a)",
    "min = {_:number, b: number} => (b)",
    "min = {(len(list) > 0):[]} => (list \\> ((get(list,0)), (?((@ < $), @, $))))",
    "max = {a:number, (a >= b):number} => (a)",
    "max = {_:number, b:number} => (b)",
    "max = {(len(list) > 0):[]} => (list \\> ((get(list,0)), (?((@ > $), @, $))))",
    "slice = {list:[], from:number} => (list ~> (# >= from))",
    "in_range = {target:number, (lower <= target):number, (target < higher):number} => true",
    "in_range = {_:number, _:number, _: number} => false",
    "slice = {list:[], from:number, to:number} => (list ~> (in_range(#, from, to)))",
    "head = {(len(list) > 0):[]} => (get(list,0))",
    "tail = {list:[]} => (slice(list,1))",
    "set_add = {list:[], (contains(list, item))} => (list)",
    "set_add = {list:[], item} => (list + item)",
    "unique = {list:[]} => (list \\> ([], (set_add($, @))))",
    "halve = {list:[]} => ([(slice(list,0,floor(len(list) / 2))), (slice(list, floor(len(list) / 2 )))])",
    "merge = {[], l2:[]} => (l2)",
    "merge = {l1:[], []} => (l1)",
    "merge = {l1:[], ((get(l1,0)) < (get(l2,0))):[]} => ((get(l1,0)) + (merge(tail(l1),l2)))",
    "merge = {l1:[], l2:[]} => ((get(l2,0)) + (merge(l1,tail(l2))))",
    "sort = {(len(arr) <= 1):[]} => (arr)",
    "sort = {arr:[]} => (merge(sort(get(halve(arr),0)), sort(get(halve(arr),1))))",
    "reverse = {list:[]} => (list -> (get(list, len(list) - # - 1)))"
]

const typesFromSignature = (signature) => {
    return signature.value.map(i => i.value[1].value);
}

const conditionsFromSignature = (signature) => {
    const conditions = [];

    const sigPatterns = signature.value;
    const size = sigPatterns.length;
    for (let i = 0 ; i < size ; i ++ ) {
        const pattern = sigPatterns[i];
        const condition = pattern.value[0];
        const conditionName = condition.value[0];
        const conditionExpression = condition.value[1];
        conditions.push((argument, variables, functions, morphisms) => {
            variables.assignValue(conditionName.value, argument);
            try {
                return evaluate(conditionExpression.value, variables, functions, morphisms, goals.EVALUATE).value;
            } catch (e) {
                return false;
            }
        });
    }
    return conditions;
}

const namesFromSignature = (signature) => {
    return signature.value.map(i => i.value[0].value[0].value);
}

const specificitiesFromSignature = (signature) => {
    return signature.value.map(i => i.value[0].value[2].value);
}

const registerNewFunction = (name, functions, functionObject) => {
    if (!(name in functions)) {
        functions[name] = [];
    }

    functions[name].push(functionObject);
}

