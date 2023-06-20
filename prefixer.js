const infixes = ['+','-','*','/','>','<','&','|','<=','>=','->','\\>','~>','=>','==','%', '..'];

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
        !inSingleQuotes(tracker) &&
        !inDoubleQuotes(tracker);
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

const notQuoted = (s, d) => {
    return s % 2 === 0 && d % 2 === 0;
}

/**
 * This requires trimming of the initial characters, ie. [1,2,3] -> 1,2,3
 */
export const splitGeneral = (text, on) => {
    let doubleQuotes = 0;
    let singleQuotes = 0;
    let openParens = 0;
    let openBrackets = 0;
    let openBraces = 0;
    const chunks = [];
    let current = "";
    for (let i = 0 ; i < text.length ; i ++ ) {
        const char = text[i];
        switch (char) {
            case '"':
                doubleQuotes++;
                break;
            case "'":
                singleQuotes++;
                break;
            case '(':
                openParens++;
                break;
            case '[':
                openBrackets++;
                break;
            case ')':
                openParens--;
                break;
            case ']':
                openBrackets--;
                break;
            case '{':
                openBraces ++;
                break;
            case '}':
                openBraces --;
        }
        if (char === on && (notQuoted(singleQuotes, doubleQuotes) && openParens === 0 && openBrackets === 0 && openBraces === 0)) {
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


const tokenize = (segment) => {
    const tokens = [];
    let buffer = '';
    const tracker = newTracker();

    for (let i = 0 ; i < segment.length ; i ++ ) {
        const char = segment[i];
        if (char === ' ') {
            if (!inSingleQuotes(tracker) && !inDoubleQuotes(tracker)) {
                continue;
            }
        }
        handleSyntaxChars(char, tracker);
        if (isInTopLevelContext(tracker)) {
            if (char in unusualCases) {
                const score = unusualCases[char](segment, i);
                if (buffer.length > 0) {
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

shunt('"I love you"');
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
    return infixes.includes(prev) || extras.includes(prev);
}

const preprocess = (text) => {
    let singleQuotes = 0;
    let doubleQuotes = 0;
    let builder = "";
    for (let i = 0 ; i < text.length ; i ++ ) {
        const [prev, char, next] = getSurroundingChars(text, i);
        if (char === '"') {
            doubleQuotes ++;
        } else if (char === "'") {
            singleQuotes ++;
        }
        if (notQuoted(singleQuotes, doubleQuotes) && char in unusualCases) {
            const score = unusualCases[char](text, i);
            if (score >= 0) {
                if (prev !== null && prev !== ' ') {
                    builder += ' ';
                }
                builder += text.slice(i, i + score + 1);
                i += score;
                if (score === 1) {
                    const superNext = getSurroundingChars(text, i)[2];
                    if (superNext !== null && superNext !== ' ') {
                        builder += ' ';
                    }
                } else if (next !== null && next !== ' ') {
                    builder += ' ';
                }

            } else {
                builder += char;
            }
        } else if (notQuoted(singleQuotes, doubleQuotes) && infixes.includes(char)) {
            if (prev !== null && prev !== ' ') {
                builder += ' ';
            }
            builder += char;
            if (next !== null && next !== ' ') {
                builder += ' ';
            }
        } else {
            builder += char;
        }
    }
    return builder;
}

const pairs = [
    ['[',']'],
    ['(',')'],
    ['{','}']
]


const unensconce = (text, pair) => {
    const [start, end] = pair;
    if (text[0] === start && text[text.length - 1] === end) {
        return text.slice(1, text.length - 1);
    }
    return text;
}

export const unshiftRedundantNesting = (text) => {
    let interestedPair = undefined;
    while (true) {
        const before = text;
        if (interestedPair) {
            text = unensconce(text, interestedPair);
        } else {
            for (const pair of pairs) {
                text = unensconce(text, pair);
                if (text.length < before.length) {
                    interestedPair = pair;
                }
            }
        }
        if (text.length === before.length) {
            return text;
        }
    }
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
    //This will cause issues if anything with lower precedence than assignment is ever added
    const [name, body] = handleAssignment(rawText);
    if (name !== '_') {
        return "=(\"" + name +"\"," + shunt(body) + ")";
    }
    return shunt(body);
}

export const lexer = (rawText) => {
    const text = preprocess(rawText);
    const reorderStack = [];
    const operatorStack = [];
    let doubleQuotes = 0;
    let singleQuotes = 0;
    let currentBuffer = "";
    let recursiveBuffer = "";
    let openParens = 0;
    let openBrackets = 0;
    let openBraces = 0;
    for (let i = 0 ; i < text.length ; i ++ ) {
        const char = text[i];
        if (char in unusualCases && notQuoted(singleQuotes, doubleQuotes) && (openParens === 0 && openBrackets === 0 && openBraces === 0)) {
            const score = unusualCases[char](text, i);
            if (score === 1) {
                operatorStack.push(char + text[i + 1]);
                i ++;
            } else if (score === 0) {
                operatorStack.push(char);
            } else {
                currentBuffer += char;
            }
        } else if (infixes.includes(char) && notQuoted(singleQuotes, doubleQuotes) && (openParens === 0 && openBrackets === 0 && openBraces === 0)) {
            operatorStack.push(char);
        } else if (char !== ' ' || !notQuoted(singleQuotes, doubleQuotes)) {
            if (notQuoted(singleQuotes, doubleQuotes)) {
                switch (char) {
                    case '(':
                        openParens++;
                        break;
                    case '[':
                        openBrackets++;
                        break;
                    case ')':
                        openParens--;
                        break;
                    case ']':
                        openBrackets--;
                        break;
                    case '{':
                        openBraces ++;
                        break;
                    case '}':
                        openBraces --;
                }
            }
            if (openBrackets === 0 && openParens === 0 && openBraces === 0) {
                if (recursiveBuffer.length > 0) {
                    if (char === ')' || char === ']' || char === '}') {
                        recursiveBuffer += char;
                    }
                    const internal = recursiveBuffer.slice(1, recursiveBuffer.length - 1);
                    let newBuffer = "";
                    const entries = splitArray(internal);
                    //(Un)wrapped expressions in list literals don't work
                    if (char === ']' || char === '}') {
                        newBuffer = entries.map(e => lexer(e)).join(',');
                    } else {
                        if (entries.length > 1) {
                            newBuffer = entries.map(e => lexer(e)).join(',');
                        } else {
                            newBuffer = lexer(internal);
                        }
                    }
                    currentBuffer += recursiveBuffer[0] + newBuffer + recursiveBuffer[recursiveBuffer.length - 1];
                    recursiveBuffer = "";
                } else {
                    currentBuffer += char;
                }
            } else {
                recursiveBuffer += char;
            }
        }
        if (char === '"') {
            doubleQuotes++;
        } else if (char === "'") {
            singleQuotes++;
        }

        if ((char === ' ' && notQuoted(singleQuotes, doubleQuotes)) || i === text.length - 1) {
            if (currentBuffer.length > 0) {
                reorderStack.push(currentBuffer);
            }
            currentBuffer = "";
            if (operatorStack.length > 0 && reorderStack.length > 1) {
                const operand2 = reorderStack.pop();
                const operand1 = reorderStack.pop();
                const operator = operatorStack.pop();
                reorderStack.push(operator + '(' + operand1+ ',' + operand2 + ')')
            }
        }
    }
    return reorderStack.join('');
}

