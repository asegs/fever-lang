function everyCharNumeric(text: String):boolean {
    return (text.match(/^-?[0-9]+$/g) !== null) || (text.match(/^-?[0-9]+\.[0-9]+$/g) !== null);
}

function isStringLiteral(text: String): boolean {
    return (text.match(/^".+"$/g) !== null) || (text.match(/^'.+'$/g) !== null);
}

function isWord(text: String): boolean {
    return (text.match(/^[a-zA-z]$/g) !== null) || (text.match(/^[a-zA-Z][a-zA-Z0-9]+$/g) !== null);
}
