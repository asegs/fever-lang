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


export const builtins = {
    '+': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value + b.value, a.type)
        },
        {
            'arity': 2,
            'types': [meta.LIST, meta.LIST],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value.concat(b.value), a.type)
        },
        {
            'arity': 2,
            'types': [primitives.ANY, meta.LIST],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar([a, ...b.value], b.type)
        },
        {
            'arity': 2,
            'types': [meta.LIST, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar([...a.value, b], a.type)
        },
        {
            'arity': 2,
            'types': [primitives.CHARACTER, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': ([char, shift]) => createVar(String.fromCharCode(char.value.charCodeAt(0) + shift.value), primitives.CHARACTER)
        },
    ],
    '*': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value * b.value, a.type)
        },
        {
            'arity': 2,
            'types': [meta.LIST, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => {
                const list = [];
                for (let i = 0 ; i < b.value ; i ++ ) {
                    for (let z = 0 ; z < a.value.length ; z ++ ) {
                        list.push(a.value[z]);
                    }
                }
                //For strings in general, handle the switch between list and string better.
                return createVar(list, a.type);
            }
        },
        {
            'arity': 2,
            'types': [primitives.NUMBER, meta.LIST],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => {
                const list = [];
                for (let i = 0 ; i < a.value ; i ++ ) {
                    for (let z = 0 ; z < b.value.length ; z ++ ) {
                        list.push(b.value[z]);
                    }
                }
                return createVar(list, b.type);
            }
        }
    ],
    '-': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value - b.value, a.type)
        }
    ],
    '/': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value / b.value, a.type)
        }
    ],
    '>': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value > b.value, primitives.BOOLEAN)
        }
    ],
    '<': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value < b.value, primitives.BOOLEAN)
        }
    ],
    '&': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value && b.value, primitives.BOOLEAN)
        }
    ],
    '|': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value || b.value, primitives.BOOLEAN)
        }
    ],
    '<=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value <= b.value, primitives.BOOLEAN)
        }
    ],
    '>=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => createVar(a.value >= b.value, primitives.BOOLEAN)
        }
    ],
    '->': [
        {
            'arity': 2,
            'types': [meta.LIST, primitives.EXPRESSION],
            'conditions': [() => true, () => true],
            'function': ([list, action], variables, functions, morphisms) => {
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
        },
    ],
    '\\>': [
        {
            'arity': 2,
            'types': [meta.LIST, createTypedTuple([primitives.ANY, primitives.EXPRESSION])],
            'conditions': [() => true, () => true],
            'function': ([list, reduce], variables, functions, morphisms) => {
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
        }
    ],
    '~>': [
        {
            'arity': 2,
            'types': [meta.LIST, primitives.EXPRESSION],
            'conditions': [() => true, () => true],
            'function': ([list, action], variables, functions, morphisms) => {
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
        }
    ],
    '==': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([a,b]) => createVar(JSON.stringify(a.value) === JSON.stringify(b.value), primitives.BOOLEAN)
        }
    ],
    '%': [
        {
            'arity': 2,
            'types': [primitives.NUMBER, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': ([a,b]) => createVar(a.value % b.value, primitives.NUMBER)
        }
    ],
    '=>': [
        {
            'arity': 2,
            'types': [meta.SIGNATURE, primitives.EXPRESSION],
            'conditions': [() => true, () => true],
            'function': ([signature, expression]) => {
                return createVar(
                    [signature, expression],
                    meta.FUNCTION
                );
            }

        },
        {
            'arity': 2,
            'types': [meta.SIGNATURE, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([signature, value]) => {
                return createVar(
                    [signature, createVar(recursiveToString(value), primitives.EXPRESSION)],
                    meta.FUNCTION
                );
            }

        }
    ],
    '=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': ([name, value], variables) => {
                variables.assignValue(charListToJsString(name), value);
                return value;
            }
        },
        {
            'arity': 2,
            'types': [primitives.ANY, meta.FUNCTION],
            'conditions': [() => true, () => true],
            'function': ([name, func], variables, functions, morphisms) => {
                const realName = charListToJsString(name);
                variables.assignValue(realName, func);
                if (!(realName in functions)) {
                    functions[realName] = [];
                }

                const signature = func.value[0];
                const expression = func.value[1];
                const sigPatterns = signature.value;
                const size = sigPatterns.length;

                const newFunction = {};
                newFunction['arity'] = size;
                const types = [];
                const conditions = [];
                const names = [];
                const specificities = [];

                for (let i = 0 ; i < size ; i ++ ) {
                    const pattern = sigPatterns[i];
                    const condition = pattern.value[0];
                    const type = pattern.value[1];
                    const conditionName = condition.value[0];
                    const conditionExpression = condition.value[1];
                    const conditionSpecificity = condition.value[2];
                    names.push(conditionName.value);
                    specificities.push(conditionSpecificity.value)
                    conditions.push((argument, variables, functions, morphisms) => {
                        variables.assignValue(conditionName.value, argument);
                        try {
                            return evaluate(conditionExpression.value, variables, functions, morphisms, goals.EVALUATE).value;
                        } catch (e) {
                            return false;
                        }
                    });
                    types.push(type.value);
                }
                newFunction['types'] = types;
                newFunction['conditions'] = conditions;
                newFunction['specificities'] = specificities;
                newFunction['function'] = (args, variables, functions, morphisms) => {
                    variables.enterScope();
                    for (let i = 0 ; i < args.length ; i ++ ) {
                        variables.assignValue(names[i], args[i]);
                    }
                    const result = evaluate(expression.value, variables, functions, morphisms, goals.EVALUATE);
                    variables.exitScope();
                    return result;
                }
                functions[realName].push(newFunction);

                return func;
            }
        }
    ],
    'show': [
        {
            'arity': 1,
            'types': [primitives.ANY],
            'conditions': [() => true],
            'function': ([v]) => {
                console.log(recursiveToString(v));
                return v;
            }
        },
        {
            'arity': 3,
            'types': [primitives.ANY, meta.STRING, primitives.BOOLEAN],
            'conditions': [() => true, () => true, () => true],
            'function': ([v, delimiter, simple]) => {
                if (simple.value) {
                    process.stdout.write(v.value.toString() + delimiter.value);
                } else {
                    process.stdout.write(recursiveToString(v) + delimiter.value);
                }
                return v;
            }
        }
    ],
    'explain': [
        {
            'arity': 1,
            'types': [primitives.ANY],
            'conditions': [() => true],
            'function': ([v]) => {
                console.dir(v, { depth: null });
                return createVar(v.value, v.type);
            }
        }
    ],
    '..': [
        {
            'arity': 2,
            'types': [primitives.NUMBER, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': ([a, b]) => {
                const direction = (a.value < b.value) ? 1 : -1;
                const numbers = [];
                for (let i = a.value ; i !== b.value ; i += direction) {
                    numbers.push(createVar(i, primitives.NUMBER));
                }
                numbers.push(b);
                return createVar(numbers, createTypedList(primitives.NUMBER));
            }
        }
    ],
    'get': [
        {
            'arity': 2,
            'types': [meta.LIST, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': ([list, num]) => {
                return list.value[num.value];
            }
        },
        {
            'arity': 2,
            'types': [meta.TUPLE, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': ([tuple, num]) => {
                return tuple.value[num.value];
            }
        }
    ],
    'floor': [
        {
            'arity': 1,
            'types': [primitives.NUMBER],
            'conditions': [() => true],
            'function': ([num]) => {
                return createVar(Math.floor(num.value), primitives.NUMBER);
            }
        }
    ],
    'ceil': [
        {
            'arity': 1,
            'types': [primitives.NUMBER],
            'conditions': [() => true],
            'function': ([num]) => {
                return createVar(Math.ceil(num.value), primitives.NUMBER);
            }
        }
    ],
    '?': [
        {
            'arity': 3,
            'types': [primitives.BOOLEAN, primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true, () => true],
            'function': ([truth, a, b]) => {
                return truth.value ? a : b;
            }
        }
    ],
    'nl': [
        {
            'arity': 1,
            'types': [primitives.ANY],
            'conditions': [() => true],
            'function': ([ignored]) => {
                console.log();
                return ignored;
            }
        }
    ],
    'sqrt': [
        {
            'arity': 1,
            'types': [primitives.NUMBER],
            'conditions': [(arg) => arg.value >= 0],
            'function': ([val]) => {
                return createVar(Math.sqrt(val.value), primitives.NUMBER);
            }
        }
    ],
    'not': [
        {
            'arity': 1,
            'types': [primitives.BOOLEAN],
            'conditions': [() => true],
            'function': ([truth]) => {
                return createVar(!truth.value, primitives.BOOLEAN);
            }
        }
    ],
    'len': [
        {
            'arity': 1,
            'types': [meta.LIST],
            'conditions': [() => true],
            'function': ([list]) => {
                return createVar(list.value.length, primitives.NUMBER);
            }
        }
    ],
    'stringify': [
        {
            'arity': 1,
            'types': [primitives.ANY],
            'conditions': [() => true],
            'function': ([v]) => {
                return createVar(recursiveToString(v), meta.STRING);
            }
        }
    ],
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
    "tail = {list:[]} => (slice(list,1))"

]

