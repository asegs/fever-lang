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

const lexer = (text) => {
    const reorderStack = [];
    const operatorStack = [];
    let currentBuffer = "";

    for (let i = 0 ; i < text.length ; i ++ ) {
        const char = text[i];
        if (char in unusualCases) {
            const score = unusualCases[char](text, i);
            if (score === 1) {
                operatorStack.push(char + text[i + 1]);
                i ++;

            } else if (score === 0) {
                operatorStack.push(char);
            } else {
                currentBuffer += char;
            }
        } else if (infixes.includes(char)) {
            operatorStack.push(char);
        } else if (char !== ' ') {
            currentBuffer += char;
        }

        if (char === ' ' || i === text.length - 1) {
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
    return reorderStack[0];
}

console.log(lexer("3 + 5 + 8 / 2.2 * 3 + f(a,b)"))
console.log(lexer("[1,2,3] -> (3 + @)"))

/*
Handle parens, text, expression blocks
Put spaces around infix operators
 */