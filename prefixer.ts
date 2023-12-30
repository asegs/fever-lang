const operatorsToPrecedences = {
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

const closingTokenBackRefs = {
    ']': '[',
    '}': '{',
    ')': '('
}

type SurroundedCharacter = {
    last: string | null;
    current: string;
    next: string | null;
}

enum OperatorAction {
    IGNORE,
    TAKE,
    TAKE_AND_NEXT
}

function getSurroundingChars (text: string, idx: number): SurroundedCharacter {
    const prevChar = idx > 0 ? text[idx - 1] : null;
    const char = text[idx];
    const nextChar = text.length > idx - 1 ? text[idx + 1] : null;
    return {
        last: prevChar,
        current: char,
        next: nextChar
    };
}

function handleAmbiguousOperators(text: string, idx: number): OperatorAction {
    const surroundings = getSurroundingChars(text, idx);
    if (!surroundings.next) {
        return surroundings.current in operatorsToPrecedences ? OperatorAction.TAKE : OperatorAction.IGNORE;
    }
    if ((surroundings.current + surroundings.next) in operatorsToPrecedences) {
        return OperatorAction.TAKE_AND_NEXT;
    }
    if (surroundings.current in operatorsToPrecedences) {
        return OperatorAction.TAKE;
    }
    return OperatorAction.IGNORE;

}

const prevCharAfterSpaces = (text: string, idx: number): string | null => {
    for (let i = idx -1 ; i >= 0 ; i -- ) {
        if (text[i] !== ' ') {
            return text[i];
        }
    }
    return null;
}

const isNegation = (text: string, idx: number): boolean => {
    const extras = ['=',','];
    const prev = prevCharAfterSpaces(text,idx);
    if (prev === null) {
        return true;
    }
    return (prev in operatorsToPrecedences) || extras.includes(prev);
}

const specialOperatorCases = {
    '-': (text: string, idx: number): OperatorAction => {
        const nextChar = getSurroundingChars(text, idx).next;
        const action = handleAmbiguousOperators(text, idx);
        if (action === OperatorAction.TAKE_AND_NEXT) {
            return OperatorAction.TAKE_AND_NEXT;
        }
        return isNegation(text, idx) ? OperatorAction.IGNORE : OperatorAction.TAKE;
    }
}

function getCharacterAction(char: string, source: string, position: number): OperatorAction {
    if (char in specialOperatorCases) {
        return specialOperatorCases[char](source, position);
    }

    return handleAmbiguousOperators(source, position);
}

class Tracker {
    singleQuotes = 0;
    doubleQuotes = 0;
    openParens = 0;
    openBrackets = 0;
    openBraces = 0;

    inSingleQuotes(): boolean {
        return this.singleQuotes % 2 === 1;
    }

    inDoubleQuotes(): boolean {
        return this.doubleQuotes % 2 === 1;
    }

    quoted(): boolean {
        return this.inSingleQuotes() || this.inDoubleQuotes();
    }

    handleSyntaxChars(char: string): boolean {
        switch (char) {
            case '"':
                if (!this.inSingleQuotes()) {
                    this.doubleQuotes++;
                    return true;
                }
                break;
            case "'":
                if (!this.inDoubleQuotes()) {
                    this.singleQuotes++;
                    return true;
                }
                break;
            case '(':
                this.openParens++;
                return true;
            case '[':
                this.openBrackets++;
                return true;
            case '{':
                this.openBraces++;
                return true;
            case ')':
                this.openParens--;
                return true;
            case ']':
                this.openBrackets--;
                return true;
            case '}':
                this.openBraces--;
                return true
        }
        return false;
    }

    isInTopLevelContext(): boolean {
        return this.openParens === 0 && this.openBrackets === 0 && this.openBraces === 0 && !this.quoted();
    }

    syntaxTermCount(): number {
        return this.openParens + this.openBrackets + this.openBraces;
    }
}

export enum TokenType {
    SYNTAX,
    OPERATOR
}

type Token = {
    value: string,
    type: TokenType
}

function syntaxToken (text: string): Token {
    return {
        value: text,
        type: TokenType.SYNTAX
    }
}

function operatorToken (text: string): Token {
    return {
        value: text,
        type: TokenType.OPERATOR
    }
}

export function splitGeneral (text: string, on: string): string[] {
    const tracker = new Tracker();
    const chunks = [];
    let current = "";
    for (let i = 0 ; i < text.length ; i ++ ) {
        const char = text[i];
        tracker.handleSyntaxChars(char);
        if (char === on && tracker.isInTopLevelContext()) {
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

export function splitArray (text: string): string[] {
    return splitGeneral(text, ',');
}

function isNumeric (char: string) {
    return char.charCodeAt(0) >= '0'.charCodeAt(0) && char.charCodeAt(0) <= '9'.charCodeAt(0)
}

function infixEndsWith (buf: string) {
    return Object.keys(operatorsToPrecedences).some(key => key.endsWith(buf));
}

function preprocessMethodSyntax (text: string): string {
    let mainTracker = new Tracker();
    mainTracker.handleSyntaxChars(text[0]);
    for (let i = 1 ; i < text.length - 1 ; i ++ ) {
        const char = text[i];
        mainTracker.handleSyntaxChars(char);
        if (!mainTracker.quoted() && char === '.') {
            const next = text[i + 1];
            if (text[i - 1] === '.') {
                continue;
            }
            if (next === '.') {
                continue;
            }
            if (isNumeric(next)) {
                continue;
            }

            let functionIndex: number;
            let offset = 0;
            let itemBuffer: string;

            while ((i + offset) < text.length && text[i + offset] !== '(') {
                offset ++;
            }

            functionIndex = i + offset;

            let backwardsOffset = -1;

            if ([')',']','}','"',"'"].includes(text[i + backwardsOffset])) {
                const tracker = new Tracker();
                tracker.handleSyntaxChars(text[i + backwardsOffset]);
                while ((i + backwardsOffset) > 0 && !tracker.isInTopLevelContext()) {
                    backwardsOffset --;
                    tracker.handleSyntaxChars(text[i + backwardsOffset]);
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
                        if (operatorBuffer in operatorsToPrecedences) {
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
                i = 1;
                mainTracker = new Tracker();
                mainTracker.handleSyntaxChars(text[0]);
            }
        }
    }

    return text;
}

function tokenize (segment: string): Token[] {
    const tokens:Token[] = [];
    let buffer = '';
    const tracker = new Tracker();

    for (let i = 0 ; i < segment.length ; i ++ ) {
        const char = segment[i];
        if (char === ' ') {
            if (!tracker.quoted()) {
                continue;
            }
        }
        tracker.handleSyntaxChars(char);
        if (tracker.isInTopLevelContext()) {
            const score = getCharacterAction(char, segment, i);
            if (score === OperatorAction.IGNORE) {
                // Not an operator
                buffer += char;
            } else {
                // Yes an operator, push current buffer to stack
                if (buffer.length > 0) {
                    tokens.push(syntaxToken(buffer));
                    buffer = '';
                }
                if (score === OperatorAction.TAKE) {
                    // Single char operator
                    tokens.push(operatorToken(char));
                } else if (score === OperatorAction.TAKE_AND_NEXT) {
                    // Double char operator
                    tokens.push(operatorToken(char + segment[i + 1]));
                    i++;
                }
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

function reverse<T>(list: T[]):T[] {
    const reversed: T[] = new Array(list.length);
    for (let i = 0 ; i < list.length ; i ++ ) {
        reversed[list.length - i - 1] = list[i];
    }

    return reversed;
}

function stringifyTokens (tokens: any[]): string{
    const scopes = [];
    let index = -1;
    let buffer = '';

    for (let i = 0 ; i < tokens.length ; i ++) {
        const token = tokens[i];
        if (token.type === TokenType.OPERATOR) {
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

type CaptureGroupMeta = {
    nestedText: string,
    nestingSeparator: string,
    nestingDimensions: [number, number]
}

function getCaptureGroup (text: string): CaptureGroupMeta {
    let firstCaptureIndex = -1;
    const tracker = new Tracker();

    for (let i = 0 ; i < text.length ; i ++ ) {
        const char = text[i];
        const prevCount = tracker.syntaxTermCount();
        tracker.handleSyntaxChars(char);
        if (prevCount === 0 && tracker.syntaxTermCount() === 1) {
            firstCaptureIndex = i;
        }

        if (prevCount === 1 && tracker.syntaxTermCount() === 0) {
            return {
                nestedText: text.slice(firstCaptureIndex, i + 1),
                nestingSeparator: char,
                nestingDimensions: [firstCaptureIndex, i]
            }
        }
    }
    return {
        nestedText: '',
        nestingSeparator: null,
        nestingDimensions: [-1, -1]
    }
}

function processSyntaxNode (node: object): string {
    const nodeText = node['value'];
    const group = getCaptureGroup(nodeText);
    const [start, end] = group.nestingDimensions;
    let innerText: string;
    if (start !== -1) {
        const subText = group.nestedText.slice(1, group.nestedText.length - 1);
        innerText = splitArray(subText).map(e => shunt(e)).join(',');
    }

    if (innerText) {
        return nodeText.slice(0, start) + closingTokenBackRefs[group.nestingSeparator] + innerText + group.nestingSeparator + nodeText.slice(end + 1);
    }

    return nodeText;
}

export function shunt(segment: string): string{
    const tokens = tokenize(segment);
    const stack = [];
    const result = [];
    for (let i = tokens.length - 1 ; i >= 0 ; i -- ) {
        const token = tokens[i];
        if (token.type === TokenType.SYNTAX) {
            result.push(syntaxToken(processSyntaxNode(token)));
            continue;
        }

        const precedence = operatorsToPrecedences[token.value];

        if (stack.length === 0) {
            stack.push(token);
            continue;
        }

        if (operatorsToPrecedences[stack[stack.length - 1]] <= precedence) {
            stack.push(token);
        }

        while ( stack.length > 0 && operatorsToPrecedences[stack[stack.length - 1].value] > precedence) {
            result.push(stack.pop());
        }

        stack.push(token);
    }
    while (stack.length > 0) {
        result.push(stack.pop());
    }

    return stringifyTokens(reverse(result));
}

export function trimAndSplitArray (text: string): string[] {
    return splitArray(text.slice(1, text.length - 1));
}

const assignmentRegex = new RegExp(/^[^\s()0-9"'[\]][^\s()"'[\]]* ?=[^=].*$/gm);

export function isAssignment (text: string): boolean {
    assignmentRegex.lastIndex = 0;
    return assignmentRegex.test(text);
}

export function splitAssignment (text: string): [string, string] {
    const firstEq = text.indexOf("=");
    const name = (firstEq !== -1 ? text.slice(0, firstEq) : "_").trim();
    const body = (firstEq !== -1 ? text.slice(firstEq + 1) : text).trim();
    return [name, body];
}

export function handleAssignment (rawText: string): [string, string]  {
    return isAssignment(rawText) ? splitAssignment(rawText) : ["_", rawText];
}
export function lex (rawText:string): string {
    const ufcsText = preprocessMethodSyntax(rawText);
    //This will cause issues if anything with lower precedence than assignment is ever added
    const [name, body] = handleAssignment(ufcsText);
    if (name !== '_') {
        return "=(\"" + name + "\"," + shunt(body) + ")";
    }
    return shunt(body);
}