import types from './types'

module.exports = {
 builtins
}

const builtins = {
    '+': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a + b
        },
        {
            'arity': 2,
            'types': [types.meta.LIST, types.meta.LIST],
            'conditions': [() => true, () => true],
            'function': (a, b) => a.concat(b)
        },
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.meta.LIST],
            'conditions': [() => true, () => true],
            'function': (a, b) => [a, ...b]
        },
        {
            'arity': 2,
            'types': [types.meta.LIST, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => [...a, b]
        },
    ],
    '*': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a * b
        },
        {
            'arity': 2,
            'types': [types.meta.LIST, types.primitives.NUMBER],
            'conditions': [() => true, () => true],
            'function': (a, b) => {
                const list = [];
                for (let i = 0 ; i < b ; i ++ ) {
                    for (let z = 0 ; z < a.length ; z ++ ) {
                        list.push(a[z]);
                    }
                }
                return list;
            }
        },
        {
            'arity': 2,
            'types': [types.primitives.NUMBER, types.meta.LIST],
            'conditions': [() => true, () => true],
            'function': (a, b) => {
                const list = [];
                for (let i = 0 ; i < b ; i ++ ) {
                    for (let z = 0 ; z < a.length ; z ++ ) {
                        list.push(a[z]);
                    }
                }
                return list;
            }
        }
    ],
    '-': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a - b
        }
    ],
    '/': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a / b
        }
    ],
    '>': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a > b
        }
    ],
    '<': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a < b
        }
    ],
    '&': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a && b
        }
    ],
    '|': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a || b
        }
    ],
    '<=': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a <= b
        }
    ],
    '>=': [
        {
            'arity': 2,
            'types': [types.primitives.OBJECT, types.primitives.OBJECT],
            'conditions': [() => true, () => true],
            'function': (a, b) => a >= b
        }
    ],
    '->': [
        {
            'arity': 2,
            'types': [types.meta.LIST, types.meta.TUPLE],
            'conditions': [() => true, () => true],
            'function': (list, action, variables, functions, parseFunction) => {
                return list.reduce((item, index) => {
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
            'types': [types.primitives.OBJECT, types.meta.FUNCTION],
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
        }
    ]
}