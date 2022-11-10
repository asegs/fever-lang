import {createInterface} from 'readline';
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});
const infixes = ['+','-','*','/','>','<','&','|','<=','>=','->','\\>','~>','=>','==','%']

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
        return nextChar === '=' || nextChar === '>' ? 1 : -1;
    }


}

const getSurroundingChars = (text, idx) => {
    const prevChar = idx > 0 ? text[idx - 1] : null;
    const char = text[idx];
    const nextChar = text.length > idx - 1 ? text[idx + 1] : null;
    return [prevChar, char, nextChar];
}

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

const notQuoted = (s, d) => {
    return s % 2 === 0 && d % 2 === 0;
}

const preprocess = (text) => {
    let builder = "";
    for (let i = 0 ; i < text.length ; i ++ ) {
        const [prev, char, next] = getSurroundingChars(text, i);
        if (char in unusualCases) {
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
        } else if (infixes.includes(char)) {
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

const prompt = () => {
    rl.question(">", (inp) => {
        console.log(lexer(inp));
        prompt();
    })
}