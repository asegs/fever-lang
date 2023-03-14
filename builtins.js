import {primitives, meta, createTypedTuple, createVar, createTypedList, recursiveToString} from './types.js'
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
                for (let i = 0 ; i < b.value ; i ++ ) {
                    for (let z = 0 ; z < a.value.length ; z ++ ) {
                        list.push(a.value[z]);
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
                const internalList = list.value.map((item, index) => {
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(index, primitives.NUMBER));
                    variables.assignValue('^', list);
                    const result = evaluate(action.value, variables, functions, morphisms, goals.EVALUATE);
                    variables.exitScope();
                    return result;
                    }
                );
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
                const res = list.value.reduce((acc, item, index) => {
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(index, primitives.NUMBER));
                    variables.assignValue('^', list);
                    variables.assignValue('$', acc);
                    const result = evaluate(expr, variables, functions, morphisms, goals.EVALUATE);
                    variables.exitScope();
                    return result;
                }, acc);

                return res;
            }
        }
    ],
    '~>': [
        {
            'arity': 2,
            'types': [meta.LIST, primitives.EXPRESSION],
            'conditions': [() => true, () => true],
            'function': ([list, action], variables, functions, morphisms) => {
                const internalList = list.value.filter((item, index) => {
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(index, primitives.NUMBER));
                    variables.assignValue('^', list);
                    const result = evaluate(action.value, variables, functions, morphisms, goals.EVALUATE);
                    variables.exitScope();
                    return result.value;
                });

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
            //Default function is only no return, this just takes any expression
            //Expression is expression
            //Function is expression with inputs
            'types': [meta.SIGNATURE, primitives.EXPRESSION],
            'conditions': [() => true, () => true],
            'function': ([signature, expression]) => {
                return createVar(
                    [signature, expression],
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
                variables.assignValue(name.value, value);
                return value;
            }
        },
        {
            'arity': 2,
            'types': [primitives.ANY, meta.FUNCTION],
            'conditions': [() => true, () => true],
            'function': ([name, func], variables, functions, morphisms) => {
                const realName = name.value;
                variables.assignValue(realName, func);
                if (!(realName in functions)) {
                    functions[realName] = [];
                }

                const signature = func.value[0];
                const expression = func.value[1];
                const sigConditions = signature.value;
                const size = sigConditions.length;

                const newFunction = {};
                newFunction['arity'] = size;
                const types = [];
                const conditions = [];

                for (let i = 0 ; i < size ; i ++ ) {
                    //Should handle case where there is no pattern to match!
                    //Either unknown variable, something from variable table, value, or expression.  This just assumes expression.
                    //This is just stubbed out now.
                    //Instead of using ==, use typed match operator?
                    //Enter scope before performing.
                    //Argument should be expression but instead right now it is JS Fever object.
                    conditions.push((argument, variables, functions, morphisms) => evaluate("true", variables, functions, morphisms, goals.EVALUATE).value);
                    types.push(sigConditions[i].value[1].value);
                }
                newFunction['types'] = types;
                newFunction['conditions'] = conditions;
                newFunction['function'] = (args, variables, functions, morphisms) => {
                    variables.enterScope();
                    //Get variable name from signature and assign in scope.
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
                return createVar(v.value, v.type);
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
    ]
}

