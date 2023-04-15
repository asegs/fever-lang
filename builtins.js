import {
    charListToJsString,
    createTypedList,
    createTypedTuple, createTypeVar,
    createVar, isAlias,
    meta,
    primitives,
    recursiveToString, typeAssignableFrom
} from './types.js'
import {callFunction, evaluate, goals} from "./interpreter.js";
import {feverStringFromJsString} from "./literals.js";

const newFunction = (arity, types, functionOperation, args) => {
    const func = {
        'arity': arity,
        'types': types,
        'function': functionOperation
    };
    if (args) {
        if ('specificities' in args) {
            func['specificities'] = args.specificities;
        } else {
            func['specificities'] = Array(arity).fill(0.5);
        }

        if ('conditions' in args) {
            func['conditions'] = args.conditions;
        } else {
            func['conditions'] = Array(arity).fill(() => true);
        }
    } else {
        func['conditions'] = Array(arity).fill(() => true);
        func['specificities'] = Array(arity).fill(0.5);
    }

    return func;
}

export const builtins = {
    '+': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value + b.value, a.type)
        ),
        newFunction(
            2,
            [meta.LIST, meta.LIST],
            ([a, b]) => createVar(a.value.concat(b.value), a.type)

        ),
        newFunction(
            2,
            [meta.STRING, meta.STRING],
            ([a, b]) => createVar(a.value.concat(b.value), a.type)

        ),
        newFunction(
            2,
            [primitives.ANY, meta.LIST],
            ([a, b]) => createVar([a, ...b.value], b.type)
        ),
        newFunction(
            2,
            [meta.LIST, primitives.ANY],
            ([a, b]) => createVar([...a.value, b], a.type)
        ),
        newFunction(
            2,
            [primitives.CHARACTER, primitives.NUMBER],
            ([char, shift]) => createVar(String.fromCharCode(char.value.charCodeAt(0) + shift.value), primitives.CHARACTER)
        )
    ],
    '*': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value * b.value, a.type)
        ),
        newFunction(
            2,
            [meta.LIST, primitives.NUMBER],
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
            ([a, b]) => createVar(a.value - b.value, a.type)
        )
    ],
    '/': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value / b.value, a.type)
        )
    ],
    '>': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value > b.value, primitives.BOOLEAN)
        )
    ],
    '<': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value < b.value, primitives.BOOLEAN)
        )
    ],
    '&': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value && b.value, primitives.BOOLEAN)
        )
    ],
    '|': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value || b.value, primitives.BOOLEAN)
        )
    ],
    '<=': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value <= b.value, primitives.BOOLEAN)
        )
    ],
    '>=': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a, b]) => createVar(a.value >= b.value, primitives.BOOLEAN)
        )
    ],
    '->': [
        newFunction(
            2,
            [meta.LIST, primitives.EXPRESSION],
            ([list, action], variables, morphisms) => {
                const internalList = [];
                for (let i = 0 ; i < list.value.length ; i ++ ) {
                    const item = list.value[i];
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(i, primitives.NUMBER));
                    variables.assignValue('^', createVar([...internalList], createTypedList(internalList.length > 0 ? internalList[0].type : primitives.ANY)));
                    const result = evaluate(action.value, variables, morphisms, goals.EVALUATE);
                    internalList.push(result);
                    variables.exitScope();
                }

                const result = createVar(internalList, createTypedList((internalList.length > 0 ? internalList[0].type : primitives.ANY), list.type.alias));

                if (isAlias(list.type)) {
                    const created = newOfType(result.type, [result], variables, morphisms);
                    if (created) {
                        return created;
                    }
                }
                return result;
            }
        ),
        newFunction(
            2,
            [meta.LIST, primitives.ANY],
            ([list, result],variables, morphisms) => {
                const results = list.value.map(ignored => result);
                const res = createVar(results, createTypedList((results.length > 0 ? results[0].type : primitives.ANY), list.type.alias));

                if (isAlias(res.type)) {
                    const created = newOfType(res.type, [res], variables, morphisms);
                    if (created) {
                        return created;
                    }
                }
                return res;
            }

        )
    ],
    '\\>': [
        newFunction(
            2,
            [meta.LIST, createTypedTuple([primitives.ANY, primitives.EXPRESSION])],
            ([list, reduce], variables, morphisms) => {
                let acc = reduce.value[0];
                const expr = reduce.value[1].value;
                for (let i = 0 ; i < list.value.length ; i ++ ) {
                    const item = list.value[i];
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(i, primitives.NUMBER));
                    variables.assignValue('$', acc);
                    acc = evaluate(expr, variables, morphisms, goals.EVALUATE);
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
            ([list, action], variables, morphisms) => {
                const internalList = [];
                for (let i = 0 ; i < list.value.length ; i ++ ) {
                    const item = list.value[i];
                    variables.enterScope();
                    variables.assignValue('@', item);
                    variables.assignValue('#', createVar(i, primitives.NUMBER));
                    variables.assignValue('^', createVar(internalList, createTypedList(internalList.length > 0 ? internalList[0].type : primitives.ANY)));
                    const result = evaluate(action.value, variables, morphisms, goals.EVALUATE);
                    if (result.value) {
                        internalList.push(item);
                    }
                    variables.exitScope();
                }

                const result = createVar(internalList, createTypedList((internalList.length > 0 ? internalList[0].type : primitives.ANY), list.type.alias));

                if (isAlias(list.type)) {
                    const created = newOfType(result.type, [result], variables, morphisms);
                    if (created) {
                        return created;
                    }
                }
                return result;
            }
        )
    ],
    '==': [
        newFunction(
            2,
            [primitives.ANY, primitives.ANY],
            ([a,b]) => createVar(JSON.stringify(a.value) === JSON.stringify(b.value), primitives.BOOLEAN)
        )
    ],
    '%': [
        newFunction(
            2,
            [primitives.NUMBER, primitives.NUMBER],
            ([a,b]) => createVar(a.value % b.value, primitives.NUMBER)
        )
    ],
    '=>': [
        newFunction(
            2,
            [meta.SIGNATURE, primitives.EXPRESSION],
            ([signature, expression]) => {
                return createVar(
                    [signature, expression],
                    meta.CASE
                );
            }
        ),
        newFunction(
            2,
            [meta.SIGNATURE, primitives.ANY],
            ([signature, value]) => {
                return createVar(
                    [signature, createVar(recursiveToString(value), primitives.EXPRESSION)],
                    meta.CASE
                );
            }
        )
    ],
    '=': [
        newFunction(
            2,
            [meta.STRING, primitives.ANY],
            ([name, value], variables) => {
                variables.assignValue(charListToJsString(name), value);
                return value;
            }
        ),
        newFunction(
            2,
            [meta.STRING, meta.CASE],
            ([name, func], variables) => {
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
                    for (let i = 0 ; i < args.length ; i ++ ) {
                        variables.assignValue(names[i], args[i]);
                    }
                    const result = evaluate(expression.value, variables, morphisms, goals.EVALUATE);
                    variables.exitScope();
                    return result;
                }
                return registerNewFunction(
                    realName,
                    variables,
                    newFunction(
                        size,
                        types,
                        operation,
                        {
                            'conditions': conditions,
                            'specificities': specificities
                        }
                    ),
                    func
                );
            }
        ),
        newFunction(
            2,
            [meta.STRING, meta.SIGNATURE],
            ([name, signature], variables) => {
                const realName = charListToJsString(name);
                const types = typesFromSignature(signature);
                const size = types.length;
                const isListAlias = size === 1 && types[0].baseName === "LIST";
                const newType = isListAlias ? createTypedList(types[0].types[0], realName) :createTypedTuple(types, realName);
                meta[realName] = newType;

                const permutations = [];

                for (let i = 0 ; i < size ; i ++ ) {
                    const condition = signature.value[i].value[0].value;
                    const name = condition[0];

                    registerNewFunction(
                        name.value,
                        variables,
                        newFunction(
                            1,
                            [newType],
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
                        (arg, variables, morphisms) => {
                            variables.enterScope();
                            variables.assignValue(name.value, arg);
                            const result = evaluate(expression.value, variables, morphisms, goals.EVALUATE);
                            variables.exitScope();
                            return result;
                        }
                    );
                }


                //Apply relevant condition to each arg if not simple var name.
                const operation = ([,...args], variables, morphisms) => {
                    const mutatedArgs = [];

                    for (let i = 0 ; i < size ; i ++) {
                        mutatedArgs.push(permutations[i](args[i], variables, morphisms));
                    }
                    return isListAlias ? createVar(mutatedArgs[0].value, newType) : createVar(mutatedArgs, newType);
                }

                registerNewFunction(
                    "new",
                    variables,
                    newFunction(
                        size + 1,
                        [primitives.TYPE, ...types],
                        operation,
                        {
                            'conditions': [(arg) => {
                                return typeAssignableFrom(arg.value, newType);
                            }, ...Array(size).fill(() => true)],
                            'specificities': Array(size + 1).fill(1)
                        }
                    )
                );

                const typeVar = createVar(newType, primitives.TYPE);
                variables.assignValue(realName, typeVar);
                return typeVar;
            }
        )
    ],
    'show': [
        newFunction(
            1,
            [primitives.ANY],
            ([v], variables, morphisms) => {
                console.log(charListToJsString(callFunction('stringify', [v], variables, morphisms)));
                return v;
            },
            {
                'specificities': [1]
            }
        ),
        newFunction(
            2,
            [primitives.ANY, meta.STRING],
            ([v, delimiter]) => {
                process.stdout.write(recursiveToString(v) + delimiter.value);
                return v;
            }
        ),
        newFunction(
            2,
            [meta.STRING, meta.STRING],
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
            ([v]) => {
                console.dir(v, { depth: null });
                return v;
            }
        )
    ],
    '..': [
        newFunction(
            2,
            [primitives.NUMBER, primitives.NUMBER],
            ([a, b]) => {
                const direction = (a.value < b.value) ? 1 : -1;
                const numbers = [];
                for (let i = a.value ; i !== b.value ; i += direction) {
                    numbers.push(createVar(i, primitives.NUMBER));
                }
                numbers.push(b);
                return createVar(numbers, createTypedList(primitives.NUMBER));
            },
            {
                'conditions': [(num) => Number.isInteger(num.value), (num) => Number.isInteger(num.value)],
                'specificities': [1,1]
            }
        )
    ],
    'get': [
        newFunction(
            2,
            [meta.LIST, primitives.NUMBER],
            ([list, num]) => {
                return list.value[num.value];
            }
        ),
        newFunction(
            2,
            [meta.TUPLE, primitives.NUMBER],
            ([tuple, num]) => {
                return tuple.value[num.value];
            }
        )
    ],
    'floor': [
        newFunction(
            1,
            [primitives.NUMBER],
            ([num]) => {
                return createVar(Math.floor(num.value), primitives.NUMBER);
            }
        )
    ],
    'ceil': [
        newFunction(
            1,
            [primitives.NUMBER],
            ([num]) => {
                return createVar(Math.ceil(num.value), primitives.NUMBER);
            }
        )
    ],
    '?': [
        newFunction(
            3,
            [primitives.BOOLEAN, primitives.ANY, primitives.ANY],
            ([truth, a, b]) => {
                return truth.value ? a : b;
            }
        )
    ],
    'nl': [
        newFunction(
            1,
            [primitives.ANY],
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

            ([val]) => {
                return createVar(Math.sqrt(val.value), primitives.NUMBER);
            },
            {
                'conditions':[(arg) => arg.value >= 0],
                'specificities': [1]
            }
            )
    ],
    'not': [
        newFunction(
            1,
            [primitives.BOOLEAN],
            ([truth]) => {
                return createVar(!truth.value, primitives.BOOLEAN);
            }
        )
    ],
    'len': [
        newFunction(
            1,
            [meta.LIST],
            ([list]) => {
                return createVar(list.value.length, primitives.NUMBER);
            }
        )
    ],
    'stringify': [
        newFunction(
            1,
            [primitives.ANY],
            ([v]) => {
                return feverStringFromJsString(recursiveToString(v));
            },
            {
                'specificities': [0.6]
            }
        ),
        newFunction(
            1,
            [meta.FUNCTION],
            ([func]) => {
                return feverStringFromJsString(serializeFunction(func));
            },
            {
                'specificities': [0.6]
            }

        )
    ],
    'type': [
        newFunction(
            1,
            [primitives.ANY],
            ([v]) => {
                if (isAlias(v.type)) {
                    return createVar(v.type.alias, meta.STRING);
                }
                return createVar(v.type.baseName, meta.STRING);
             }
        )
    ],
    'ord': [
        newFunction(
            1,
            [primitives.CHARACTER],
            ([c]) => createVar(c.value.charCodeAt(0), primitives.NUMBER)
        )
    ]
}

export const standardLib = [
    "contains = {list:[], item} => (list \\> (false, (item == @ | $)))",
    "unique_add = {list:[], (contains(list, item))} => (list)",
    "unique_add = {list:[], item} => (list + item)",
    "unique = {list:[]} => (list \\> ([], (unique_add($,@))))",
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
    "set = {(unique(entries)):[]}",
    "add = {s:set, item} => (new(set, s + item))",
    "halve = {list:[]} => ([(slice(list,0,floor(len(list) / 2))), (slice(list, floor(len(list) / 2 )))])",
    "merge = {[], l2:[]} => (l2)",
    "merge = {l1:[], []} => (l1)",
    "merge = {l1:[], ((get(l1,0)) < (get(l2,0))):[]} => ((get(l1,0)) + (merge(tail(l1),l2)))",
    "merge = {l1:[], l2:[]} => ((get(l2,0)) + (merge(l1,tail(l2))))",
    "sort = {(len(arr) <= 1):[]} => (arr)",
    "sort = {arr:[]} => (merge(sort(get(halve(arr),0)), sort(get(halve(arr),1))))",
    "reverse = {list:[]} => (list -> (get(list, len(list) - # - 1)))",
    "sum = {str:string} => (str \\> (0, ($ + ord(@))))",
    "hash = {str:string, mod:#} => (sum(str) % mod)"
]

export const registerBuiltins = (variables) => {
    for (const functionName of Object.keys(builtins)) {
        const patterns = builtins[functionName];
        for (const pattern of patterns) {
            registerNewFunction(functionName, variables, pattern);
        }
    }
}

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
        conditions.push((argument, variables, morphisms) => {
            variables.assignValue(conditionName.value, argument);
            try {
                return evaluate(conditionExpression.value, variables, morphisms, goals.EVALUATE).value;
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
        newFunc['invocations'] = [functionObject];
        variables.assignValue(name, newFunc);
        return newFunc;
    }


    named.invocations.push(functionObject);
    named.value.push(newCase);
    return named;
}

const nativeFunctionMessage = '<natively defined function>';

const generateCaseFromNative = (functionObject) => {
    const types = functionObject['types'];
    const conditions = functionObject['conditions'];
    const specificities = functionObject['specificities'];
    const names = argNamesFromFunction(functionObject['function'].toString());

    const patterns = [];
    for (let i = 0 ; i < types.length ; i ++ ) {
        const type = types[i];
        const condition = conditions[i];
        const pattern = createVar(
            [
                createVar(
                    [
                        createVar(names[i], meta.STRING),
                        createVar(condition.toString() === '() => true' ? 'true' : nativeFunctionMessage, primitives.EXPRESSION),
                        createVar(specificities[i], primitives.NUMBER)
                    ],
                    meta.CONDITION
                ),
                createVar(type, primitives.TYPE)
            ],
            meta.PATTERN
        )
        patterns.push(pattern);
    }

    return createVar(
        [
            createVar(patterns, meta.SIGNATURE),
            createVar(nativeFunctionMessage, primitives.EXPRESSION)
        ],
        meta.CASE
    );
}

const newOfType = (t, args, vars, morphisms) => {
    const typeVar = createTypeVar(t);
    try {
        return callFunction("new", [typeVar, ...args], vars, morphisms);
    }
    catch (e) {
        return null;
    }
}

const argNamesFromFunction = (functionBody) => {
    const args = [];
    let stack = "";
    let inDestructure = false;
    for (const letter of functionBody) {
        if (inDestructure) {
            switch (letter) {
                case ']':
                    args.push(stack);
                    return args;
                case ',':
                    args.push(stack);
                    stack = '';
                    break;
                default:
                    stack += letter;
                    break;
            }
        } else if (letter === '[') {
            inDestructure = true;
        }
    }
    return args;
}

const serializeCase = (c) => {
    let caseText = "(";
    const [signature, expression] = c.value;
    const patterns = signature.value;
    for (let i = 0 ; i < patterns.length ; i ++) {
        const pattern = patterns[i];
        const [condition, type] = pattern.value;
        const [varName, conditionExpr] = condition.value;
        caseText += conditionExpr.value === 'true' ? varName.value : conditionExpr.value;
        if (type.value.baseName !== 'ANY') {
            caseText += ':' + (isAlias(type.value) ? type.value.alias : type.value.baseName.toLowerCase());
        }
        if (i < patterns.length - 1) {
            caseText += ',';
        } else {
            caseText += ') => '
        }
    }
    caseText += expression.value;

    return caseText;

}

const serializeFunction = (f) => {
    return f.value.map(c => serializeCase(c)).join('\n');
}

