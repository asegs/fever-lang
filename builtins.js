import  {primitives, meta, createType, createTypedList, createTypedTuple, createTypedFunction} from './types'

module.exports = {
 builtins
}

const builtins = {
    '+': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a + b
        },
        {
            'arity': 2,
            'types': [meta.LIST, meta.LIST],
            'conditions': [() => true, () => true],
            'function': (a, b) => a.concat(b)
        },
        {
            'arity': 2,
            'types': [primitives.ANY, meta.LIST],
            'conditions': [() => true, () => true],
            'function': (a, b) => [a, ...b]
        },
        {
            'arity': 2,
            'types': [meta.LIST, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => [...a, b]
        },
    ],
    '*': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a * b
        },
        {
            'arity': 2,
            'types': [meta.LIST, primitives.NUMBER],
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
            'types': [primitives.NUMBER, meta.LIST],
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
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a - b
        }
    ],
    '/': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a / b
        }
    ],
    '>': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a > b
        }
    ],
    '<': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a < b
        }
    ],
    '&': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a && b
        }
    ],
    '|': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a || b
        }
    ],
    '<=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a <= b
        }
    ],
    '>=': [
        {
            'arity': 2,
            'types': [primitives.ANY, primitives.ANY],
            'conditions': [() => true, () => true],
            'function': (a, b) => a >= b
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
        }
    ],
    '~>': [

    ]
}