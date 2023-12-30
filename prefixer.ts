// All built in operators and their precedence.  Higher precedence is grouped first.
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

// The opening token for various closing tokens.
const closingTokenBackRefs = {
    ']': '[',
    '}': '{',
    ')': '('
}

// A character from a string and its next character as well.
type SucceededCharacter = {
    current: string;
    next: string | null;
}

// How to handle what looks like it might be a full or partial operator character in source.
enum OperatorAction {
    IGNORE,
    TAKE,
    TAKE_AND_NEXT
}

// Gets the current and next character (if present) in text at an index.
function getSucceedingCharacter (text: string, idx: number): SucceededCharacter {
    const char = text[idx];
    const nextChar = text.length > idx - 1 ? text[idx + 1] : null;
    return {
        current: char,
        next: nextChar
    };
}

// Checks to see if the next character added to the current is a valid operator.
// If so, takes those two.  If not, checks the current one.  If it is, takes that.
// If neither are valid, decides not an operator.
function handleAmbiguousOperators(text: string, idx: number): OperatorAction {
    const surroundings = getSucceedingCharacter(text, idx);
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

// Finds the last non-space character in a string at a position.
const prevCharAfterSpaces = (text: string, idx: number): string | null => {
    for (let i = idx -1 ; i >= 0 ; i -- ) {
        if (text[i] !== ' ') {
            return text[i];
        }
    }
    return null;
}

// Checks if the occurrence of a hyphen in text signifies a negative sign or other operator.
const isNegation = (text: string, idx: number): boolean => {
    const extras = ['=',','];
    const prev = prevCharAfterSpaces(text,idx);
    if (prev === null) {
        return true;
    }
    return (prev in operatorsToPrecedences) || extras.includes(prev);
}

// Handles cases where more context than the next character is needed to disambiguate a potential operator.
const specialOperatorCases = {
    '-': (text: string, idx: number): OperatorAction => {
        const action = handleAmbiguousOperators(text, idx);
        if (action === OperatorAction.TAKE_AND_NEXT) {
            return OperatorAction.TAKE_AND_NEXT;
        }
        return isNegation(text, idx) ? OperatorAction.IGNORE : OperatorAction.TAKE;
    }
}

// Wraps the special cases and normal operator disambiguation logic into one function.
function getCharacterAction(char: string, source: string, position: number): OperatorAction {
    if (char in specialOperatorCases) {
        return specialOperatorCases[char](source, position);
    }

    return handleAmbiguousOperators(source, position);
}

// Used when traversing through source with nesting to track current depth in various structures.
class Tracker {
    // Only changed when not in double quotes.
    singleQuotes = 0;
    // Only changed when not in single quotes.
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

    // Switches on input char, mutates proper (if any) nesting tracker.
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

    // Checks if at the top of a statement and therefore not nested at all.
    isInTopLevelContext(): boolean {
        return this.openParens === 0 && this.openBrackets === 0 && this.openBraces === 0 && !this.quoted();
    }

    // Counts the number of open nesting characters.
    syntaxTermCount(): number {
        return this.openParens + this.openBrackets + this.openBraces;
    }
}

// Used in parsing to tell if a given text token is an operator or plain syntax.
export enum TokenType {
    SYNTAX,
    OPERATOR
}

// A source token of text and an operator/syntax type.
type Token = {
    value: string,
    type: TokenType
}

// Constructs a new syntax token from text.
function syntaxToken (text: string): Token {
    return {
        value: text,
        type: TokenType.SYNTAX
    }
}

// Constructs a new operator token from text.
function operatorToken (text: string): Token {
    return {
        value: text,
        type: TokenType.OPERATOR
    }
}

// Splits a piece of source at the top level on a given splitter.
// Example: "1,2,3" on ',' becomes ["1","2","3"].
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

// Wraps generic splitter with splitter for common comma case.
export function splitOnCommas (text: string): string[] {
    return splitGeneral(text, ',');
}

// Checks if an individual character is numeric.
// Used to disambiguate method calls from decimals and ranges.
function isNumeric (char: string) {
    return char.charCodeAt(0) >= '0'.charCodeAt(0) && char.charCodeAt(0) <= '9'.charCodeAt(0)
}

// Checks if the current text buffer is the end of any valid infix operator.
function infixEndsWith (buf: string) {
    return Object.keys(operatorsToPrecedences).some(key => key.endsWith(buf));
}

// Takes method calls and rewrites them as function invocations, preserving order.
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

// Breaks a string of text into syntax and operator token objects.
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


// Reverses the order of any list.
function reverse<T>(list: T[]):T[] {
    const reversed: T[] = new Array(list.length);
    for (let i = 0 ; i < list.length ; i ++ ) {
        reversed[list.length - i - 1] = list[i];
    }

    return reversed;
}

// Given a list of tokens, build them into a prefix string.
function stringifyTokens (tokens: Token[]): string{
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

// Data on a nested group found in source to be potentially unnested.
type CaptureGroupMeta = {
    nestedText: string,
    nestingSeparator: string,
    nestingDimensions: [number, number]
}

// Gets the nested portion of a piece of source text.
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

// Corecursively prefixes and orders infixes on tokens in text with `shunt`.
function processSyntaxNode (node: Token): string {
    const nodeText = node.value;
    const group = getCaptureGroup(nodeText);
    const [start, end] = group.nestingDimensions;
    let innerText: string;
    if (start !== -1) {
        const subText = group.nestedText.slice(1, group.nestedText.length - 1);
        innerText = splitOnCommas(subText).map(e => shunt(e)).join(',');
    }

    if (innerText) {
        return nodeText.slice(0, start) + closingTokenBackRefs[group.nestingSeparator] + innerText + group.nestingSeparator + nodeText.slice(end + 1);
    }

    return nodeText;
}

// Shunting yard algorithm implementation that recursively applies itself on nested blocks.
// Treats function calls and non infix/parenthesized operations as simple tokens, akin to numbers.
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

// Removes the opening and closing characters of a group and splits it on commas.
export function trimAndSplitOnCommas (text: string): string[] {
    return splitOnCommas(text.slice(1, text.length - 1));
}

// Converts infix/prefix mixed string to all prefix string recursively.
// "x = 3 + 5" becomes "=(x,+(3,5))"
export function lex (rawText:string): string {
    // Convert methods to function calls, then orders infix operators
    return shunt(preprocessMethodSyntax(rawText));
}