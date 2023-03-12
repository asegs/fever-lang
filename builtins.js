import {primitives, meta, createTypedFunction, createTypedTuple, createVar, createTypedList} from './types.js'
import {evaluate, goals} from "./interpreter.js";


export const builtins = {
    '+': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value + b.value, a.type)
        },
        {
            'arity': 2,
            'types': [meta.LIST, meta.LIST],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value.concat(b.value), a.type)
        },
        {
            'arity': 2,
            'types': [primitives.ANY, meta.LIST],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar([a, ...b.value], b.type)
        },
        {
            'arity': 2,
            'types': [meta.LIST, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar([...a.value, b], a.type)
        },
    ],
    '*': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value * b.value, a.type)
        },
        {
            'arity': 2,
            'types': [meta.LIST, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': (a, b) => {
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
            'function': (a, b) => {
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
            'function': (a, b) => createVar(a.value - b.value, a.type)
        }
    ],
    '/': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value / b.value, a.type)
        }
    ],
    '>': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value > b.value, primitives.BOOLEAN)
        }
    ],
    '<': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value < b.value, primitives.BOOLEAN)
        }
    ],
    '&': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value && b.value, primitives.BOOLEAN)
        }
    ],
    '|': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value || b.value, primitives.BOOLEAN)
        }
    ],
    '<=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value <= b.value, primitives.BOOLEAN)
        }
    ],
    '>=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => createVar(a.value >= b.value, primitives.BOOLEAN)
        }
    ],
    '->': [
        {
            'arity': 2,
            'types': [meta.LIST, primitives.EXPRESSION],
            'conditions': [() => true, () => true],
            'function': (list, action, variables, functions, morphisms) => {
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
            'function': (list, reduce, variables, functions, morphisms) => {
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
            'function': (list, action, variables, functions, morphisms) => {
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
            'function': (a,b) => JSON.stringify(a.value) === JSON.stringify(b.value)
        }
    ],
    '%': [
        {
            'arity': 2,
            'types': [primitives.NUMBER, primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': (a,b) => a.value % b.value
        }
    ],
    '=>': [
        {
            'arity': 2,
            //Default function is only no return, this just takes any expression
            //Expression is expression
            //Function is expression with inputs
            'types': [meta.SIGNATURE, primitives.EXPRESSION],
            'function': (signature, expression) => {
                const funcType = createTypedFunction(signature);
                return createVar(
                    {
                        'body': expression
                    },
                    funcType
                );
            }

        }
    ],
    '=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (name, value, variables) => {
                variables.assignValue(name.value, value);
                //Assign to string value of name, wrap name in string at parser level.
                return value;
            }
        }
    ],
    'show': [
        {
            'arity': 1,
            'types': [primitives.ANY],
            'conditions': [() => true],
            'function': (v) => {
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
            'function': (v) => {
                console.dir(v, { depth: null });
                return createVar(v.value, v.type);
            }
        }
    ]
}

const recursiveToString = (v) => {
    if (Array.isArray(v.value)) {
        return "[" + v.value.map(i => recursiveToString(i)).join(",") + "]";
    }
    return v.value.toString();
}