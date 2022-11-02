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
    ]
}