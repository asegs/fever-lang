module.exports = {
    primitives,
    meta
}

const primitives = {
    NUMBER: Symbol("NUMBER"),
    STRING: Symbol("STRING"),
    BOOLEAN: Symbol("BOOLEAN"),
    OBJECT: Symbol("OBJECT")
}

const meta = {
    LIST: Symbol("LIST"),
    SET: Symbol("SET"),
    DICT: Symbol("DICT")
}