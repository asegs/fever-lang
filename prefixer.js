const infixPrecedences = {
    '+': 9,
    '-': 9,
    '*': 10,
    '/': 10,
    '%': 8,
    '>': 6,
    '<': 6,
    '<=': 6,
    '>=': 6,
    '==': 6,
    '..': 7,
    '&': 5,
    '|': 5,
    '->': 4,
    '~>': 4,
    '\\>': 4,
    '=>': 3,
    '=': 2
}


const pairBackRefs = {
    ']': '[',
    '}': '{',
    ')': '('
}

const getSurroundingChars = (text, idx) => {
    const prevChar = idx > 0 ? text[idx - 1] : null;
    const char = text[idx];
    const nextChar = text.length > idx - 1 ? text[idx + 1] : null;
    return [prevChar, char, nextChar];
}

//1 means take next, 0 means take this, -1 means not operator
//This doesn't need to be handwritten
const unusualCases = {
    '-': (text, idx) => {
        const nextChar = getSurroundingChars(text, idx)[2];
        if (nextChar === '>') {
            return 1;
        }
        return isNegation(text, idx) ? -1 : 0;
    },
    '>': (text, idx) => {
        const nextChar = getSurroundingChars(text, idx)[2];
        return nextChar === '=' ? 1 : 0;
    },
    '<': (text, idx) => {
        const nextChar = getSurroundingChars(text, idx)[2];
        return nextChar === '=' ? 1 : 0;
    },
    '\\': (text, idx) => {
        const nextChar = getSurroundingChars(text, idx)[2];
        return nextChar === '>' ? 1 : -1;
    },
    '~': (text, idx) => {
        const nextChar = getSurroundingChars(text, idx)[2];
        return nextChar === '>' ? 1 : -1;
    },
    '=': (text, idx) => {
        const nextChar = getSurroundingChars(text, idx)[2];
        return nextChar === '=' || nextChar === '>' ? 1 : 0;
    },
    '.': (text, idx) => {
        const nextChar = getSurroundingChars(text, idx)[2];
        return nextChar === '.' ? 1 : -1;
    }


}

const newTracker = () => {
    return {
        'doubleQuotes': 0,
        'singleQuotes': 0,
        'openParens': 0,
        'openBrackets': 0,
        'openBraces': 0
    }
}

const inSingleQuotes = (tracker) => {
    return tracker.singleQuotes % 2 === 1;
}

const inDoubleQuotes = (tracker) => {
    return tracker.doubleQuotes % 2 === 1;
}

const quoted = (tracker) => {
    return inSingleQuotes(tracker) || inDoubleQuotes(tracker);
}

const handleSyntaxChars = (char, tracker) => {
    switch (char) {
        case '"':
            if (!inSingleQuotes(tracker)) {
                tracker.doubleQuotes++;
                return true;
            }
            break;
        case "'":
            if (!inDoubleQuotes(tracker)) {
                tracker.singleQuotes++;
                return true;
            }
            break;
        case '(':
            tracker.openParens++;
            return true;
        case '[':
            tracker.openBrackets++;
            return true;
        case ')':
            tracker.openParens--;
            return true;
        case ']':
            tracker.openBrackets--;
            return true;
        case '{':
            tracker.openBraces++;
            return true;
        case '}':
            tracker.openBraces--;
            return true;
    }

    return false;
}

const isInTopLevelContext = (tracker) => {
    return tracker.openParens === 0 &&
        tracker.openBrackets === 0 &&
        tracker.openBraces === 0 &&
        !quoted(tracker)
}

export const tokenTypes = {
    SYNTAX: Symbol("SYNTAX"),
    OPERATOR: Symbol("OPERATOR"),
}

const syntaxToken = (text) => {
    return {
        'value': text,
        'type': tokenTypes.SYNTAX
    }
}

const operatorToken = (text) => {
    return {
        'value': text,
        'type': tokenTypes.OPERATOR
    }
}

/**
 * This requires trimming of the initial characters, ie. [1,2,3] -> 1,2,3
 */
export const splitGeneral = (text, on) => {
    const tracker = newTracker();
    const chunks = [];
    let current = "";
    for (let i = 0 ; i < text.length ; i ++ ) {
        const char = text[i];
        handleSyntaxChars(char, tracker);
        if (char === on && isInTopLevelContext(tracker)) {
            chunks.push(current);
            current = ""
        } else {
            current += char;
        }
    }
    if (current.length > 0) {
        chunks.push(current)
    }
    return chunks;
}

export const splitArray = (text) => {
    return splitGeneral(text, ',');
}

const isNumeric = (char) => {
    return char.charCodeAt(0) >= '0'.charCodeAt(0) && char.charCodeAt(0) <= '9'.charCodeAt(0)
}

const infixEndsWith = (buf) => {
    return Object.keys(infixPrecedences).some(key => key.endsWith(buf));
}

const preprocessMethodSyntax = (text) => {
    let mainTracker = newTracker();
    handleSyntaxChars(text[0], mainTracker);
    //Handle . in quotes
    for (let i = 1 ; i < text.length - 1 ; i ++ ) {
        const char = text[i];
        handleSyntaxChars(char, mainTracker);
        if (!quoted(mainTracker) && char === '.') {
            const next = text[i + 1];
            if (next === '.') {
                continue;
            }
            if (isNumeric(next)) {
                continue;
            }

            let functionIndex;
            let offset = 0;
            let itemBuffer;

            while ((i + offset) < text.length && text[i + offset] !== '(') {
                offset ++;
            }

            functionIndex = i + offset;

            let backwardsOffset = -1;

            if ([')',']','}','"',"'"].includes(text[i + backwardsOffset])) {
                const tracker = newTracker();
                handleSyntaxChars(text[i + backwardsOffset], tracker);
                while ((i + backwardsOffset) > 0 && !isInTopLevelContext(tracker)) {
                    backwardsOffset --;
                    handleSyntaxChars(text[i + backwardsOffset], tracker);
                }
                itemBuffer = text.slice(i + backwardsOffset, i);
            }

            if (!itemBuffer || itemBuffer.startsWith('(')) {
                if (itemBuffer) {
                    backwardsOffset --;
                }
                let operatorBuffer = '';
                while (i + backwardsOffset >= 0) {
                    const char = text[i + backwardsOffset];
                    if (char === ',') {
                        break;
                    }
                    if (char === '(') {
                        break;
                    }
                    if (char === ' ') {
                        break;
                    }

                    //Match operators
                    if (infixEndsWith(char + operatorBuffer)) {
                        operatorBuffer = char + operatorBuffer;
                        if (operatorBuffer in infixPrecedences) {
                            //End, bump index back to before operator, minus 1 so it hits the last char of it.
                            backwardsOffset += operatorBuffer.length - 1;
                            break;
                        }
                    } else {
                        if (infixEndsWith(char)) {
                            operatorBuffer = char;
                        } else {
                            operatorBuffer = '';
                        }
                    }
                    backwardsOffset --;
                }
                itemBuffer = text.slice(i + backwardsOffset + 1, i);
            }

            if (itemBuffer) {
                //Restructured, start over with one less method
                text = text.slice(0, i - itemBuffer.length) + text.slice(i + 1, functionIndex + 1) + itemBuffer + ',' + text.slice(functionIndex + 1);
                i = 0;
                mainTracker = newTracker();
                handleSyntaxChars(text[0], mainTracker);
            }
        }
    }

    return text;
}

// console.log(preprocessMethodSyntax('".".times(2)'))
// console.log(preprocessMethodSyntax("f(1).times(2)"))
// console.log(preprocessMethodSyntax("1<=3.times(2).divided(4)"))
// console.log(preprocessMethodSyntax("3.times(2)"))
// console.log(preprocessMethodSyntax("f(3.times(2,3))"))
// console.log(preprocessMethodSyntax("[1,2,3].contains(3)"))


const tokenize = (segment) => {
    const tokens = [];
    let buffer = '';
    const tracker = newTracker();

    for (let i = 0 ; i < segment.length ; i ++ ) {
        const char = segment[i];
        if (char === ' ') {
            if (!quoted(tracker)) {
                continue;
            }
        }
        handleSyntaxChars(char, tracker);
        if (isInTopLevelContext(tracker)) {
            if (char in unusualCases) {
                const score = unusualCases[char](segment, i);
                if (buffer.length > 0 && score >= 0) {
                    tokens.push(syntaxToken(buffer));
                    buffer = '';
                }

                if (score === 1) {
                    tokens.push(operatorToken(char + segment[i + 1]))
                    i ++;
                } else if (score === 0) {
                    tokens.push(operatorToken(char));
                } else {
                    buffer += char;
                }
            } else if (char in infixPrecedences) {
                if (buffer.length > 0) {
                    tokens.push(syntaxToken(buffer));
                    buffer = '';
                }
                tokens.push(operatorToken(char));
            } else {
                buffer += char;
            }
        } else {
            buffer += char;
        }
    }
    if (buffer.length > 0) {
        tokens.push(syntaxToken(buffer));
    }

    return tokens;
}

const reverse = (list) => {
    const reversed = new Array(list.length);
    for (let i = 0 ; i < list.length ; i ++ ) {
        reversed[list.length - i - 1] = list[i];
    }

    return reversed;
}

const stringifyTokens = (tokens) => {
    const scopes = [];
    let index = -1;
    let buffer = '';

    for (let i = 0 ; i < tokens.length ; i ++) {
        const token = tokens[i];
        if (token.type === tokenTypes.OPERATOR) {
            buffer += token.value + '(';
            index ++;
            scopes.push(2);
        } else {
            buffer += token.value;
            scopes[index]--;
            if (scopes[index] === 1) {
                buffer += ',';
            } else if (scopes[index] === 0) {
                buffer += ')';
                scopes.pop();
                index--;
                while (scopes[index] === 1) {
                    buffer += ')';
                    scopes.pop();
                    index --;
                }
                if (scopes.length > 0) {
                    scopes[index] = 1;
                    buffer += ',';
                }
            }
        }
    }

    return buffer;

}

const syntaxTermCount = (tracker) => {
    return tracker.openParens + tracker.openBrackets + tracker.openBraces;
}

const getCaptureGroup = (text) => {
    let firstCaptureIndex = -1;
    const tracker = newTracker();

    for (let i = 0 ; i < text.length ; i ++ ) {
        const char = text[i];
        const prevCount = syntaxTermCount(tracker);
        handleSyntaxChars(char, tracker);
        if (prevCount === 0 && syntaxTermCount(tracker) === 1) {
            firstCaptureIndex = i;
        }

        if (prevCount === 1 && syntaxTermCount(tracker) === 0) {
            return [text.slice(firstCaptureIndex, i + 1), char, [firstCaptureIndex, i]];
        }
    }
    return ['',false, [-1,-1]];
}

const processSyntaxNode = (node) => {
    const nodeText = node.value;
    const [nestedText, nestingType,[start, end]] = getCaptureGroup(nodeText);
    let innerText;
    if (start !== -1) {
        const subText = nestedText.slice(1, nestedText.length - 1);
        innerText = splitArray(subText).map(e => shunt(e)).join(',');
    }

    if (innerText) {
        return nodeText.slice(0, start) + pairBackRefs[nestingType] + innerText + nestingType + nodeText.slice(end + 1);
    }

    return nodeText;
}

export const shunt = (segment) => {
    const tokens = tokenize(segment);
    const stack = [];
    const result = [];
    for (let i = tokens.length - 1 ; i >= 0 ; i -- ) {
        const token = tokens[i];
        if (token.type === tokenTypes.SYNTAX) {
            result.push(syntaxToken(processSyntaxNode(token)));
            continue;
        }

        const precedence = infixPrecedences[token.value];

        if (stack.length === 0) {
            stack.push(token);
            continue;
        }

        if (infixPrecedences[stack[stack.length - 1]] <= precedence) {
            stack.push(token);
        }

        while ( stack.length > 0 && infixPrecedences[stack[stack.length - 1].value] > precedence) {
            result.push(stack.pop());
        }

        stack.push(token);
    }
    while (stack.length > 0) {
        result.push(stack.pop());
    }

    return stringifyTokens(reverse(result));
}

shunt('1.1..10')
// shunt("1");
// console.log(shunt('[1,2,3]'))
// console.log(shunt('(1,2,3)'))
// console.log(shunt('{(a > 3):#, (b > a * 2):#}'))
// console.log(shunt('[1,2, 5 + 3, (3 + 2) * 3] -> 3 + 5 * (3 + 1 * f([1,2,3]))'))


/*
3 + 5 -> +(3, 5)
3 + f(a + 5)
+(3, f(+(a,5))
-5 (not minus)
3 - 5 (minus)
a - 5 (minus)
(...) - 5 (minus)
a + -5 (not minus)
5 + -a
 */

const prevCharAfterSpaces = (text, idx) => {
    for (let i = idx -1 ; i >= 0 ; i -- ) {
        if (text[i] !== ' ') {
            return text[i];
        }
    }
    return null;
}

const isNegation = (text, idx) => {
    const extras = ['=',','];
    const prev = prevCharAfterSpaces(text,idx);
    if (prev === null) {
        return true;
    }
    return (prev in infixPrecedences) || extras.includes(prev);
}

export const trimAndSplitArray = (text) => {
    return splitArray(text.slice(1, text.length - 1));
}



const assignmentRegex = new RegExp(/^[^\s()0-9"'[\]][^\s()"'[\]]* ?=[^=].*$/gm);

//Would rather be anything but whitespace, parens, quotes, brackets/braces
export const isAssignment = (text) => {
    assignmentRegex.lastIndex = 0;
    return assignmentRegex.test(text);
}

export const splitAssignment = (text) => {
    const firstEq = text.indexOf("=");
    const name = (firstEq !== -1 ? text.slice(0, firstEq) : "_").trim();
    const body = (firstEq !== -1 ? text.slice(firstEq + 1) : text).trim();
    return [name, body];
}

export const handleAssignment = (rawText) => {
    return isAssignment(rawText) ? splitAssignment(rawText) : ["_", rawText];
}

export const lex = (rawText) => {
    const ufcsText = preprocessMethodSyntax(rawText);
    //This will cause issues if anything with lower precedence than assignment is ever added
    const [name, body] = handleAssignment(ufcsText);
    if (name !== '_') {
        return "=(\"" + name + "\"," + shunt(body) + ")";
    }
    return shunt(body);
}

