import {primitives, meta, createTypedFunction, createTypedTuple, createVar} from './types.js'


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
            'types': [meta.LIST, createTypedFunction([primitives.ANY, primitives.ANY])],
            'conditions': [() => true, () => true],
            'function': (list, action, variables, functions, parseFunction) => {
                return list.map((item, index) => {
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', index);
                    variables.assignValue('^', list);
                    const result = parseFunction(action['body'], variables, functions);
                    variables.exitScope();
                    return result;
                })
            }
        },
        {
            'arity': 2,
            'types': [primitives.ANY, createTypedFunction([primitives.ANY, primitives.ANY])],
            'conditions': [() => true, () => true],
            'function': (obj, action, variables, functions, parseFunction) => {
                variables.enterScope();
                variables.assignValue('@', obj);
                variables.assignValue('#', 0);
                variables.assignValue('^', obj);
                const result = parseFunction(action['body'], variables, functions);
                variables.exitScope();
                return result;
            }
        },
    ],
    '\\>': [
        {
            'arity': 2,
            'types': [meta.LIST, createTypedTuple([createTypedFunction([primitives.ANY, primitives.ANY]), primitives.ANY])],
            'conditions': [() => true, () => true],
            'function': (list, reducer, variables, functions, parseFunction) => {
                let acc = reducer.value[1].value;
                return list.reduce((acc, item, index) => {
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', index);
                    variables.assignValue('^', list);
                    variables.assignValue('$', acc);
                    const result = parseFunction(reducer.value[0].value['body'], variables, functions);
                    variables.exitScope();
                    return result;
                }, acc)
            }
        }
    ],
    '~>': [
        {
            'arity': 2,
            'types': [meta.LIST, createTypedFunction([primitives.ANY, primitives.BOOLEAN])],
            'conditions': [() => true, () => true],
            'function': (list, filterer, variables, functions, parseFunction) => {
                return list.filter((item, index) => {
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', index);
                    variables.assignValue('^', list);
                    const result = parseFunction(filterer.value['body'], variables, functions);
                    variables.exitScope();
                    return result;
                })
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
    ]
}

const recursiveToString = (v) => {
    if (Array.isArray(v.value)) {
        return "[" + v.value.map(i => recursiveToString(i)).join(",") + "]";
    }
    return v.value.toString();
}