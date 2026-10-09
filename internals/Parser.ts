type Operator = {
  operator: string,
  precedence: number,
  leftSpace?: boolean,
  rightSpace?: boolean
}

const operators:{ [id: string] : Operator; } = {};

export function registerOperator(operator: string, precedence: number, leftSpace?: boolean, rightSpace?: boolean) {
    const operatorEntry: Operator = {
        operator: operator,
        precedence: precedence,
        leftSpace: !!leftSpace,
        rightSpace: !!rightSpace
    };

    operators[operator] = operatorEntry;
}

registerOperator("+", 9);
registerOperator("-", 9);
registerOperator("*", 10);
registerOperator("/", 10);
registerOperator("^", 11);
registerOperator("%", 8);
registerOperator(">", 6);
registerOperator("<", 6);
registerOperator("<=", 6);
registerOperator(">=", 6);
registerOperator("==", 6);
registerOperator("..", 7);
registerOperator("&", 5);
registerOperator("|", 5);
registerOperator("->", 4);
registerOperator("~>", 4);
registerOperator("\\>", 4);
registerOperator("=>", 3);
registerOperator("=", 2);
registerOperator(":=", 2);

registerOperator("and", 5, true, true);
registerOperator("or", 5, true, true);
registerOperator("in", 6, true, true);

// A character from a string and its next character as well.
type SucceededCharacter = {
  current: string;
  next: string | null;
};

// How to handle what looks like it might be a full or partial operator character in source.
enum OperatorAction {
  IGNORE,
  TAKE,
  TAKE_AND_NEXT,
}

// Gets the current and next character (if present) in text at an index.
function getSucceedingCharacter(text: string, idx: number): SucceededCharacter {
  const char = text[idx];
  const nextChar = text.length > idx - 1 ? text[idx + 1] : null;
  return {
    current: char,
    next: nextChar,
  };
}

// Checks to see if the next character added to the current is a valid operator.
// If so, takes those two.  If not, checks the current one.  If it is, takes that.
// If neither are valid, decides not an operator.

// This unfortunately restricts >2 character operators.  Maybe a different more advanced lookahead and response?
// I.e. return the operator?
function handleAmbiguousOperators(text: string, idx: number): OperatorAction {
  const surroundings = getSucceedingCharacter(text, idx);
  if (!surroundings.next) {
    return surroundings.current in operators
      ? OperatorAction.TAKE
      : OperatorAction.IGNORE;
  }
  if (surroundings.current + surroundings.next in operators) {
    return OperatorAction.TAKE_AND_NEXT;
  }
  if (surroundings.current in operators) {
    return OperatorAction.TAKE;
  }
  return OperatorAction.IGNORE;
}

function nextOperator(text: string, idx: number): string {
    const preceededBySpace = idx > 0 && text[idx - 1] === ' ';
    let buffer = "";
    let candidates = Object.values(operators);
    let lastExactMatch = null;
    let offset = 0;
    do {
      if (idx + offset >= text.length) {
        if (lastExactMatch) {
            // Will we still need to do a space check here?
            return lastExactMatch.operator;
        }
        return "";
      }
      buffer += text[idx + offset++];
      candidates = candidates.filter(o => {
        if (!o.operator.startsWith(buffer)) {
          return false;
        }
        if (!preceededBySpace && o.leftSpace) {
          return false;
        }
        return !(idx + offset >= text.length && o.rightSpace);
      });
      const exactMatches = candidates.filter(o => {
        if (o.operator !== buffer) {
          return false;
        }

        return !(o.rightSpace && text[idx + offset] !== " ");



      });
      if (exactMatches.length === 1) {
        lastExactMatch = exactMatches[0];

        if (candidates.length === 1) {
          break;
        }
      }
    } while (candidates.length > 0);

    let returnedOperator = "";

    if (candidates.length === 0) {
      if (lastExactMatch) {
        returnedOperator = lastExactMatch.operator;
      } else {
        return "";
      }
    } else {
      returnedOperator = lastExactMatch.operator;
    }

    if (returnedOperator === "-") {
      if (isNegation(text, idx)) {
            return "";
      }
    }

    return returnedOperator;
}

// Finds the last non-space character in a string at a position.
const prevCharAfterSpaces = (text: string, idx: number): string | null => {
  for (let i = idx - 1; i >= 0; i--) {
    if (text[i] !== " ") {
      return text[i];
    }
  }
  return null;
};

// Checks if the occurrence of a hyphen in text signifies a negative sign or other operator.
const isNegation = (text: string, idx: number): boolean => {
  const extras = ["=", ","];
  const prev = prevCharAfterSpaces(text, idx);
  if (prev === null) {
    return true;
  }
  return prev in operators || extras.includes(prev);
};

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
      case "(":
        this.openParens++;
        return true;
      case "[":
        this.openBrackets++;
        return true;
      case "{":
        this.openBraces++;
        return true;
      case ")":
        this.openParens--;
        return true;
      case "]":
        this.openBrackets--;
        return true;
      case "}":
        this.openBraces--;
        return true;
    }
    return false;
  }

  // Checks if at the top of a statement and therefore not nested at all.
  isInTopLevelContext(): boolean {
    return (
      this.openParens === 0 &&
      this.openBrackets === 0 &&
      this.openBraces === 0 &&
      !this.quoted()
    );
  }

  // Counts the number of open nesting characters.
  syntaxTermCount(): number {
    return this.openParens + this.openBrackets + this.openBraces;
  }
}

// Constructs a new syntax token from text.
function syntaxToken(text: string): ParseNode {
  return {
    text: text,
    type: ParseNodeType.TERM,
    children: [],
  };
}

// Constructs a new operator token from text.
function operatorToken(text: string): ParseNode {
  return {
    text: text,
    type: ParseNodeType.OPERATOR_TERM,
    children: [],
  };
}

// Splits a piece of source at the top level on a given splitter.
// Example: "1,2,3" on ',' becomes ["1","2","3"].
export function splitGeneral(text: string, on: string): string[] {
  const tracker = new Tracker();
  const chunks = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    tracker.handleSyntaxChars(char);
    if (char === on && tracker.isInTopLevelContext()) {
      chunks.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

// Wraps generic splitter with splitter for common comma case.
export function splitOnCommas(text: string): string[] {
  return splitGeneral(text, ",");
}

// Checks if an individual character is numeric.
// Used to disambiguate method calls from decimals and ranges.
function isNumeric(char: string) {
  return (
    char.charCodeAt(0) >= "0".charCodeAt(0) &&
    char.charCodeAt(0) <= "9".charCodeAt(0)
  );
}

// Checks if the current text buffer is the end of any valid infix operator.
function infixEndsWith(buf: string) {
  return Object.keys(operators).some((key) => key.endsWith(buf));
}

// Takes method calls and rewrites them as function invocations, preserving order.
function preprocessMethodSyntax(text: string): string {
  let mainTracker = new Tracker();
  mainTracker.handleSyntaxChars(text[0]);
  for (let i = 1; i < text.length - 1; i++) {
    const char = text[i];
    mainTracker.handleSyntaxChars(char);
    if (!mainTracker.quoted() && char === ".") {
      const next = text[i + 1];
      if (text[i - 1] === ".") {
        continue;
      }
      if (next === ".") {
        continue;
      }
      if (isNumeric(next)) {
        continue;
      }

      let functionIndex: number;
      let offset = 0;
      let itemBuffer: string;

      while (i + offset < text.length && text[i + offset] !== "(") {
        offset++;
      }

      functionIndex = i + offset;

      let backwardsOffset = -1;

      if ([")", "]", "}", '"', "'"].includes(text[i + backwardsOffset])) {
        const tracker = new Tracker();
        tracker.handleSyntaxChars(text[i + backwardsOffset]);
        while (i + backwardsOffset > 0 && !tracker.isInTopLevelContext()) {
          backwardsOffset--;
          tracker.handleSyntaxChars(text[i + backwardsOffset]);
        }
        itemBuffer = text.slice(i + backwardsOffset, i);
      }

      if (!itemBuffer || itemBuffer.startsWith("(")) {
        if (itemBuffer) {
          backwardsOffset--;
        }
        let operatorBuffer = "";
        while (i + backwardsOffset >= 0) {
          const char = text[i + backwardsOffset];
          if (char === ",") {
            break;
          }
          if (char === "(") {
            break;
          }
          if (char === " ") {
            break;
          }

          //Match operators
          if (infixEndsWith(char + operatorBuffer)) {
            operatorBuffer = char + operatorBuffer;
            if (operatorBuffer in operators) {
              //End, bump index back to before operator, minus 1 so it hits the last char of it.
              backwardsOffset += operatorBuffer.length - 1;
              break;
            }
          } else {
            if (infixEndsWith(char)) {
              operatorBuffer = char;
            } else {
              operatorBuffer = "";
            }
          }
          backwardsOffset--;
        }
        itemBuffer = text.slice(i + backwardsOffset + 1, i);
      }

      if (itemBuffer) {
        //Restructured, start over with one less method
        text =
          text.slice(0, i - itemBuffer.length) +
          text.slice(i + 1, functionIndex + 1) +
          itemBuffer +
          "," +
          text.slice(functionIndex + 1);
        i = 1;
        mainTracker = new Tracker();
        mainTracker.handleSyntaxChars(text[0]);
      }
    }
  }

  return text;
}

// Breaks a string of text into syntax and operator token objects.
function tokenize(segment: string): ParseNode[] {
  const tokens: ParseNode[] = [];
  let buffer = "";
  const tracker = new Tracker();

  for (let i = 0; i < segment.length; i++) {
    const char = segment[i];
    if (char === " ") {
      if (!tracker.quoted()) {
        continue;
      }
    }
    tracker.handleSyntaxChars(char);
    if (tracker.isInTopLevelContext()) {
      const operatorMaybe = nextOperator(segment, i);
      if (operatorMaybe.length === 0) {
        // Not an operator
        buffer += char;
      } else {
        // Yes an operator, push current buffer to stack
        if (buffer.length > 0) {
          tokens.push(syntaxToken(buffer));
          buffer = "";
        }
        tokens.push(operatorToken(operatorMaybe));
        i += operatorMaybe.length - 1;
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
function reverse<T>(list: T[]): T[] {
  const reversed: T[] = new Array(list.length);
  for (let i = 0; i < list.length; i++) {
    reversed[list.length - i - 1] = list[i];
  }

  return reversed;
}

// Given a list of tokens, build them into a prefix string.
function stringifyTokens(tokens: ParseNode[]): string {
  const scopes = [];
  let index = -1;
  let buffer = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === ParseNodeType.OPERATOR_TERM) {
      buffer += token.text + "(";
      index++;
      scopes.push(2);
    } else {
      buffer += token.text;
      scopes[index]--;
      if (scopes[index] === 1) {
        buffer += ",";
      } else if (scopes[index] === 0) {
        buffer += ")";
        scopes.pop();
        index--;
        while (scopes[index] === 1) {
          buffer += ")";
          scopes.pop();
          index--;
        }
        if (scopes.length > 0) {
          scopes[index] = 1;
          buffer += ",";
        }
      }
    }
  }
  return buffer;
}

// Data on a nested group found in source to be potentially unnested.
type CaptureGroupMeta = {
  nestedText: string;
  nestingSeparator: string;
  nestingDimensions: [number, number];
};

// Gets the nested portion of a piece of source text.
function getCaptureGroup(text: string): CaptureGroupMeta {
  let firstCaptureIndex = -1;
  const tracker = new Tracker();

  for (let i = 0; i < text.length; i++) {
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
        nestingDimensions: [firstCaptureIndex, i],
      };
    }
  }
  return {
    nestedText: "",
    nestingSeparator: null,
    nestingDimensions: [-1, -1],
  };
}

// Corecursively prefixes and orders infixes on tokens in text with `shunt`.
function processSyntaxNode(node: ParseNode): ParseNode {
  const nodeText = node.text;
  const group = getCaptureGroup(nodeText);
  const [start, _] = group.nestingDimensions;
  let entries: ParseNode[] = [];
  if (start !== -1) {
    const subText = group.nestedText.slice(1, group.nestedText.length - 1);
    const isSignature = group.nestedText[0] === "{";
    // Could be newline later on!
    const lines = splitGeneral(subText, "\n")
      .filter((s) => s.length > 0)
      .map((s) => s.trim());
    if (lines.length > 1) {
      const parsedLines = lines.map((l) => shunt(l));
      return {
        text: "",
        type: ParseNodeType.GROUP,
        children: parsedLines,
      };
    }

    entries = splitOnCommas(subText).map((e) =>
      isSignature ? makeSignatureFromText(e) : shunt(e),
    );
  }
  const prefix = nodeText.slice(0, start);
  const type = NODE_TYPES_FOR_CLOSING_TOKEN[group.nestingSeparator];
  // Handle function call case
  const isFunctionCall = type === ParseNodeType.TUPLE && prefix;

  if (entries.length > 0) {
    return {
      text: isFunctionCall ? prefix : "",
      type: isFunctionCall
        ? ParseNodeType.FUNCTION_CALL
        : NODE_TYPES_FOR_CLOSING_TOKEN[group.nestingSeparator],
      children: entries,
    };
  } else if (isFunctionCall) {
    return {
      text: prefix,
      type: ParseNodeType.FUNCTION_CALL,
      children: entries,
    };
  }
  return node;
}

export enum ParseNodeType {
  TERM,
  OPERATOR_TERM,
  FUNCTION_CALL,
  LIST,
  TUPLE,
  SIGNATURE,
  GROUP,
}

export type ParseNode = {
  text: string;
  type: ParseNodeType;
  children: ParseNode[];
};

// The node type for various closing tokens.
const NODE_TYPES_FOR_CLOSING_TOKEN = {
  "]": ParseNodeType.LIST,
  "}": ParseNodeType.SIGNATURE,
  ")": ParseNodeType.TUPLE,
};

function leafNode(leafText: string): ParseNode {
  return {
    text: leafText,
    type: ParseNodeType.TERM,
    children: [],
  };
}

function operatorNode(
  operator: string,
  leftTerm: ParseNode,
  rightTerm: ParseNode,
): ParseNode {
  return {
    text: operator,
    type: ParseNodeType.FUNCTION_CALL,
    children: [leftTerm, rightTerm],
  };
}

// Given a flat list of operator and non-operator nodes, builds a tree.
function nodeListToNodeTreeRec(
  tokens: ParseNode[],
  offset: number,
): [ParseNode, number] {
  if (tokens[offset].type !== ParseNodeType.OPERATOR_TERM) {
    return [tokens[offset], ++offset];
  }
  const operatorName = tokens[offset++].text;

  const firstTermResult = nodeListToNodeTreeRec(tokens, offset);
  const firstNode = firstTermResult[0];
  offset = firstTermResult[1];

  const secondTermResult = nodeListToNodeTreeRec(tokens, offset);
  const secondNode = secondTermResult[0];
  offset = secondTermResult[1];

  return [operatorNode(operatorName, firstNode, secondNode), offset];
}

function nodeListToNodeTree(tokens: ParseNode[]): ParseNode {
  return nodeListToNodeTreeRec(tokens, 0)[0];
}

// Shunting yard algorithm implementation that recursively applies itself on nested blocks.
// Treats function calls and non infix/parenthesized operations as simple tokens, akin to numbers.
export function shunt(segment: string, isTopLevel?: boolean): ParseNode {
  const tokens = tokenize(segment);
  //If we are assigning to an operator, we aren't calling it.
  if (
    isTopLevel &&
    tokens.length >= 3 &&
    tokens[1].type === ParseNodeType.OPERATOR_TERM &&
    tokens[1].text === "="
  ) {
    tokens[0].type = ParseNodeType.TERM;
  }
  const stack = [];
  const result = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    let pushedToken = false;
    const token = tokens[i];
    if (token.type === ParseNodeType.TERM) {
      result.push(processSyntaxNode(token));
      continue;
    }

    const precedence = operators[token.text].precedence;

    if (stack.length === 0) {
      stack.push(token);
      continue;
    }
    if (operators[stack[stack.length - 1].text].precedence <= precedence) {
      stack.push(token);
      pushedToken = true;
    }

    while (
      stack.length > 0 &&
      operators[stack[stack.length - 1].text].precedence > precedence
    ) {
      result.push(stack.pop());
    }
    if (!pushedToken) {
      stack.push(token);
    }
  }
  while (stack.length > 0) {
    result.push(stack.pop());
  }
  return nodeListToNodeTree(reverse(result));
}

// Removes the opening and closing characters of a group and splits it on commas.
export function trimAndSplitOnCommas(text: string): string[] {
  return splitOnCommas(text.slice(1, text.length - 1));
}

// Converts infix/prefix mixed string to all prefix string recursively.
// "x = 3 + 5" becomes "=(x,+(3,5))"
export function parse(rawText: string): ParseNode {
  // Convert methods to function calls, then orders infix operators
  return shunt(preprocessMethodSyntax(rawText), true);
}

function makeSignatureFromText(signatureText: string): ParseNode {
  return {
    text: signatureText,
    type: ParseNodeType.SIGNATURE,
    children: [],
  };
}
