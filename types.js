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
    //A type for the whole list, object if different types
    LIST: Symbol("LIST"),
    SET: Symbol("SET"),
    DICT: Symbol("DICT"),
    //A list of input types and output types, as well as a text component.  Can be self referential.
    FUNCTION: Symbol("FUNCTION"),
    TUPLE: Symbol("TUPLE")
}