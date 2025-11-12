// internals/Parser.ts
var operatorsToPrecedences = {
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 8,
  ">": 6,
  "<": 6,
  "<=": 6,
  ">=": 6,
  "==": 6,
  "..": 7,
  "&": 5,
  "|": 5,
  "->": 4,
  "~>": 4,
  "\\>": 4,
  "=>": 3,
  "=": 2
};
function getSucceedingCharacter(text, idx) {
  const char = text[idx];
  const nextChar = text.length > idx - 1 ? text[idx + 1] : null;
  return {
    current: char,
    next: nextChar
  };
}
function handleAmbiguousOperators(text, idx) {
  const surroundings = getSucceedingCharacter(text, idx);
  if (!surroundings.next) {
    return surroundings.current in operatorsToPrecedences ? 1 /* TAKE */ : 0 /* IGNORE */;
  }
  if (surroundings.current + surroundings.next in operatorsToPrecedences) {
    return 2 /* TAKE_AND_NEXT */;
  }
  if (surroundings.current in operatorsToPrecedences) {
    return 1 /* TAKE */;
  }
  return 0 /* IGNORE */;
}
var prevCharAfterSpaces = (text, idx) => {
  for (let i = idx - 1; i >= 0; i--) {
    if (text[i] !== " ") {
      return text[i];
    }
  }
  return null;
};
var isNegation = (text, idx) => {
  const extras = ["=", ","];
  const prev = prevCharAfterSpaces(text, idx);
  if (prev === null) {
    return true;
  }
  return prev in operatorsToPrecedences || extras.includes(prev);
};
var specialOperatorCases = {
  "-": (text, idx) => {
    const action = handleAmbiguousOperators(text, idx);
    if (action === 2 /* TAKE_AND_NEXT */) {
      return 2 /* TAKE_AND_NEXT */;
    }
    return isNegation(text, idx) ? 0 /* IGNORE */ : 1 /* TAKE */;
  }
};
function getCharacterAction(char, source, position) {
  if (char in specialOperatorCases) {
    return specialOperatorCases[char](source, position);
  }
  return handleAmbiguousOperators(source, position);
}
var Tracker = class {
  constructor() {
    // Only changed when not in double quotes.
    this.singleQuotes = 0;
    // Only changed when not in single quotes.
    this.doubleQuotes = 0;
    this.openParens = 0;
    this.openBrackets = 0;
    this.openBraces = 0;
  }
  inSingleQuotes() {
    return this.singleQuotes % 2 === 1;
  }
  inDoubleQuotes() {
    return this.doubleQuotes % 2 === 1;
  }
  quoted() {
    return this.inSingleQuotes() || this.inDoubleQuotes();
  }
  // Switches on input char, mutates proper (if any) nesting tracker.
  handleSyntaxChars(char) {
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
  isInTopLevelContext() {
    return this.openParens === 0 && this.openBrackets === 0 && this.openBraces === 0 && !this.quoted();
  }
  // Counts the number of open nesting characters.
  syntaxTermCount() {
    return this.openParens + this.openBrackets + this.openBraces;
  }
};
function syntaxToken(text) {
  return {
    text,
    type: 0 /* TERM */,
    children: []
  };
}
function operatorToken(text) {
  return {
    text,
    type: 1 /* OPERATOR_TERM */,
    children: []
  };
}
function splitGeneral(text, on) {
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
function splitOnCommas(text) {
  return splitGeneral(text, ",");
}
function isNumeric(char) {
  return char.charCodeAt(0) >= "0".charCodeAt(0) && char.charCodeAt(0) <= "9".charCodeAt(0);
}
function infixEndsWith(buf) {
  return Object.keys(operatorsToPrecedences).some((key) => key.endsWith(buf));
}
function preprocessMethodSyntax(text) {
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
      let functionIndex;
      let offset = 0;
      let itemBuffer;
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
          const char2 = text[i + backwardsOffset];
          if (char2 === ",") {
            break;
          }
          if (char2 === "(") {
            break;
          }
          if (char2 === " ") {
            break;
          }
          if (infixEndsWith(char2 + operatorBuffer)) {
            operatorBuffer = char2 + operatorBuffer;
            if (operatorBuffer in operatorsToPrecedences) {
              backwardsOffset += operatorBuffer.length - 1;
              break;
            }
          } else {
            if (infixEndsWith(char2)) {
              operatorBuffer = char2;
            } else {
              operatorBuffer = "";
            }
          }
          backwardsOffset--;
        }
        itemBuffer = text.slice(i + backwardsOffset + 1, i);
      }
      if (itemBuffer) {
        text = text.slice(0, i - itemBuffer.length) + text.slice(i + 1, functionIndex + 1) + itemBuffer + "," + text.slice(functionIndex + 1);
        i = 1;
        mainTracker = new Tracker();
        mainTracker.handleSyntaxChars(text[0]);
      }
    }
  }
  return text;
}
function tokenize(segment) {
  const tokens = [];
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
      const score = getCharacterAction(char, segment, i);
      if (score === 0 /* IGNORE */) {
        buffer += char;
      } else {
        if (buffer.length > 0) {
          tokens.push(syntaxToken(buffer));
          buffer = "";
        }
        if (score === 1 /* TAKE */) {
          tokens.push(operatorToken(char));
        } else if (score === 2 /* TAKE_AND_NEXT */) {
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
function reverse(list) {
  const reversed = new Array(list.length);
  for (let i = 0; i < list.length; i++) {
    reversed[list.length - i - 1] = list[i];
  }
  return reversed;
}
function getCaptureGroup(text) {
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
        nestingDimensions: [firstCaptureIndex, i]
      };
    }
  }
  return {
    nestedText: "",
    nestingSeparator: null,
    nestingDimensions: [-1, -1]
  };
}
function processSyntaxNode(node) {
  const nodeText = node.text;
  const group = getCaptureGroup(nodeText);
  const [start, _] = group.nestingDimensions;
  let entries = [];
  if (start !== -1) {
    const subText = group.nestedText.slice(1, group.nestedText.length - 1);
    const isSignature = group.nestedText[0] === "{";
    const lines = splitGeneral(subText, "\n").filter((s) => s.length > 0).map((s) => s.trim());
    if (lines.length > 1) {
      const parsedLines = lines.map((l) => shunt(l));
      return {
        text: "",
        type: 6 /* GROUP */,
        children: parsedLines
      };
    }
    entries = splitOnCommas(subText).map(
      (e) => isSignature ? makeSignatureFromText(e) : shunt(e)
    );
  }
  const prefix = nodeText.slice(0, start);
  const type = NODE_TYPES_FOR_CLOSING_TOKEN[group.nestingSeparator];
  const isFunctionCall = type === 4 /* TUPLE */ && prefix;
  if (entries.length > 0) {
    return {
      text: isFunctionCall ? prefix : "",
      type: isFunctionCall ? 2 /* FUNCTION_CALL */ : NODE_TYPES_FOR_CLOSING_TOKEN[group.nestingSeparator],
      children: entries
    };
  } else if (isFunctionCall) {
    return {
      text: prefix,
      type: 2 /* FUNCTION_CALL */,
      children: entries
    };
  }
  return node;
}
var NODE_TYPES_FOR_CLOSING_TOKEN = {
  "]": 3 /* LIST */,
  "}": 5 /* SIGNATURE */,
  ")": 4 /* TUPLE */
};
function operatorNode(operator, leftTerm, rightTerm) {
  return {
    text: operator,
    type: 2 /* FUNCTION_CALL */,
    children: [leftTerm, rightTerm]
  };
}
function nodeListToNodeTreeRec(tokens, offset) {
  if (tokens[offset].type !== 1 /* OPERATOR_TERM */) {
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
function nodeListToNodeTree(tokens) {
  return nodeListToNodeTreeRec(tokens, 0)[0];
}
function shunt(segment, isTopLevel) {
  const tokens = tokenize(segment);
  if (isTopLevel && tokens.length >= 3 && tokens[1].type === 1 /* OPERATOR_TERM */ && tokens[1].text === "=") {
    tokens[0].type = 0 /* TERM */;
  }
  const stack = [];
  const result = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    let pushedToken = false;
    const token = tokens[i];
    if (token.type === 0 /* TERM */) {
      result.push(processSyntaxNode(token));
      continue;
    }
    const precedence = operatorsToPrecedences[token.text];
    if (stack.length === 0) {
      stack.push(token);
      continue;
    }
    if (operatorsToPrecedences[stack[stack.length - 1].text] <= precedence) {
      stack.push(token);
      pushedToken = true;
    }
    while (stack.length > 0 && operatorsToPrecedences[stack[stack.length - 1].text] > precedence) {
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
function parse(rawText) {
  return shunt(preprocessMethodSyntax(rawText), true);
}
function makeSignatureFromText(signatureText) {
  return {
    text: signatureText,
    type: 5 /* SIGNATURE */,
    children: []
  };
}

// lib/TypeUtils.ts
function morphTypes(value, toType, ctx2) {
  let intermediateValue = value;
  const typePath = ctx2.pathBetween(value.type, toType.value);
  for (let i = 0; i < typePath.length - 1; i++) {
    const transformation = ctx2.morphisms[typePath[i]][typePath[i + 1]];
    intermediateValue = callFunctionByReference(
      transformation,
      [intermediateValue],
      ctx2,
      "morph_transform"
    );
  }
  return intermediateValue;
}
function charListToJsString(v) {
  let concatenated = "";
  for (let i = 0; i < v.value.length; i++) {
    concatenated += v.value[i].value;
  }
  return concatenated;
}

// middleware/Types.ts
function createType(baseName, types, meta, alias) {
  const type = {
    baseName,
    types: [],
    meta: false
  };
  if (types) {
    type["types"] = types;
  }
  if (meta) {
    type["meta"] = meta;
  }
  if (alias) {
    type["alias"] = alias;
  }
  return type;
}
function createVar(value, type) {
  return {
    value,
    type
  };
}
var Primitives = {
  NUMBER: createType("NUMBER"),
  BOOLEAN: createType("BOOLEAN"),
  CHARACTER: createType("CHARACTER"),
  ANY: createType("ANY"),
  VOID: createType("VOID"),
  EXPRESSION: createType("EXPRESSION"),
  TYPE: createType("TYPE"),
  ERROR: createType("ERROR"),
  VARIABLE: createType("VARIABLE")
};
function createTypeVar(type) {
  return createVar(type, Primitives.TYPE);
}
function createTypedList(ofType, name) {
  return createType("LIST", [ofType], true, name);
}
function createTypedTuple(types, name) {
  return createType("TUPLE", types, true, name);
}
function createGeneric(type, name) {
  return { ...type, generic: name };
}
function createError(message) {
  return createVar(message, Primitives.ERROR);
}
function createPattern(condition, type) {
  return createVar([condition, type], Meta.PATTERN);
}
function createTuple(items) {
  return createVar(items, createTypedTuple(items.map((i) => i.type)));
}
function createCall(name, args) {
  return createVar(
    createTuple([createVar(name, Primitives.VARIABLE), createTuple(args)]),
    Meta.CALL
  );
}
function createConcreteCall(fn, args) {
  return createVar(createTuple([fn, createTuple(args)]), Meta.CONCRETE_CALL);
}
function getFunctionNameAndArgs(call) {
  return [call.value.value[0].value, call.value.value[1].value];
}
function getFunctionObjectAndArgs(call) {
  return [call.value.value[0], call.value.value[1].value];
}
function createCondition(name, expr, specificity) {
  return createVar([name, expr, specificity], Meta.CONDITION);
}
function createMonadPassthrough(value) {
  return createVar(value, createTypedTuple([Primitives.ANY], "PASSTHROUGH"));
}
var STRING = createTypedList(Primitives.CHARACTER, "STRING");
var CONDITION = createTypedTuple(
  [STRING, Primitives.EXPRESSION, Primitives.NUMBER],
  "CONDITION"
);
var PATTERN = createTypedTuple([CONDITION, Primitives.TYPE], "PATTERN");
var SIGNATURE = createTypedList(PATTERN, "SIGNATURE");
var CASE = createTypedTuple([SIGNATURE, Primitives.EXPRESSION], "CASE");
var FUNCTION = createTypedList(CASE, "FUNCTION");
var DEFAULT_TUPLE = createTypedTuple([]);
var Meta = {
  CONDITION,
  PATTERN,
  SIGNATURE,
  LIST: createTypedList(Primitives.ANY),
  STRING,
  CASE,
  FUNCTION,
  TUPLE: DEFAULT_TUPLE,
  CALL: createTypedTuple([Primitives.VARIABLE, DEFAULT_TUPLE], "CALL"),
  CONCRETE_CALL: createTypedTuple([FUNCTION, DEFAULT_TUPLE], "CONCRETE_CALL"),
  MULTI_EXPRESSION: createTypedList(Primitives.EXPRESSION, "MULTI_EXPRESSION")
};
var Shorthands = {
  "#": Primitives.NUMBER,
  fn: Meta.FUNCTION
};
function isAlias(t) {
  return "alias" in t;
}
function isGeneric(t) {
  return "generic" in t;
}
function weightedAnyType(depth) {
  return (0.5 /* ANY */ + 1 /* EQUIVALENT */ * depth) / (depth + 1);
}
var typeSatisfaction = (child, parent, genericTable, depth, actualChild) => {
  if (child.baseName === "VARIABLE" && parent.baseName !== "VARIABLE") {
    return [0, genericTable];
  }
  if (parent.baseName === "ANY") {
    if (isGeneric(parent)) {
      if (parent.generic in genericTable) {
        return typeSatisfaction(
          child,
          genericTable[parent.generic],
          genericTable,
          depth,
          actualChild
        );
      }
      genericTable[parent.generic] = child;
      return [1 /* GENERIC */, genericTable];
    }
    return [weightedAnyType(depth), genericTable];
  }
  if (child.baseName !== parent.baseName) {
    return [0, genericTable];
  }
  if (isAlias(parent)) {
    if (isAlias(child)) {
      if (child["alias"] === parent["alias"]) {
        return [1.1 /* NOMINAL */, genericTable];
      }
    }
    return [0, genericTable];
  }
  if (!child.meta && !parent.meta) {
    return [
      child.baseName === parent.baseName ? 1.1 /* NOMINAL */ : 0,
      genericTable
    ];
  }
  if (child.types.length !== parent.types.length) {
    return [
      parent.baseName === "TUPLE" && parent.types.length === 0 ? 0.75 /* BASE_TUPLE */ : 0,
      genericTable
    ];
  }
  let combinedScore = 0;
  if (parent.baseName === "LIST" && child.baseName === "LIST" && actualChild.value.length === 0) {
    return [1 /* EQUIVALENT */, genericTable];
  }
  for (let i = 0; i < child.types.length; i++) {
    let subChild;
    if (child.baseName === "LIST") {
      subChild = actualChild.value[0];
    } else {
      subChild = actualChild.value[i];
    }
    const [satisfaction, gt] = typeSatisfaction(
      child.types[i],
      parent.types[i],
      genericTable,
      depth + 1,
      subChild
    );
    if (satisfaction === 0) {
      return [0, genericTable];
    }
    combinedScore += satisfaction;
    genericTable = { ...genericTable, ...gt };
  }
  return [combinedScore / child.types.length, genericTable];
};
function typeAssignableFrom(child, parent) {
  if (parent === Primitives.ANY) {
    return true;
  }
  if (isAlias(parent)) {
    if (isAlias(child)) {
      if (child["alias"] === parent["alias"]) {
        return true;
      }
    }
    return false;
  }
  if (!child.meta && !parent.meta) {
    return child.baseName === parent.baseName;
  }
  if (child.types.length !== parent.types.length) {
    return parent.baseName === "TUPLE" && parent.types.length === 0;
  }
  return child.types.every(
    (item, index) => typeAssignableFrom(item, parent.types[index])
  );
}
function recursiveToString(v) {
  if (v.type.baseName === "VOID" && v.value === null) {
    return "null";
  }
  if (Array.isArray(v.value)) {
    if (v.type.types[0] === Primitives.CHARACTER) {
      return '"' + charListToJsString(v) + '"';
    }
    const [open, close] = v.type.baseName === "TUPLE" ? ["(", ")"] : ["[", "]"];
    return open + v.value.map((i) => recursiveToString(i)).join(",") + close;
  }
  if (v.value !== void 0 && v.value !== null) {
    return v.value.toString();
  }
  return "";
}
var inferTypeFromString = (rawString, variables) => {
  const string = rawString.trim();
  for (const [, prim] of Object.entries(Primitives)) {
    if (string.toLowerCase() === prim.baseName.toLowerCase()) {
      return prim;
    }
    if (isAlias(prim) && string.toLowerCase() === prim.alias.toLowerCase()) {
      return prim;
    }
  }
  for (const [, m] of Object.entries(Meta)) {
    if (isAlias(m) && string.toLowerCase() === m.alias.toLowerCase()) {
      return m;
    }
  }
  if (string in Shorthands) {
    return Shorthands[string];
  }
  if (string[0] === "[") {
    const internalType = inferTypeFromString(
      string.slice(1, string.length - 1),
      variables
    );
    return createTypedList(internalType);
  }
  if (string[0] === "(") {
    const types = splitOnCommas(string.slice(1, string.length - 1)).map(
      (e) => inferTypeFromString(e, variables)
    );
    return createTypedTuple(types);
  }
  const typeVar = variables.getOrNull(string);
  if (typeVar && typeVar.type.baseName === "TYPE") {
    return typeVar.value;
  }
  if (string.endsWith("s") && string.length > 1) {
    const singular = string.slice(0, string.length - 1);
    const newType = inferTypeFromString(singular, variables);
    if (newType.baseName !== "ANY") {
      return createTypedList(newType);
    }
  }
  return createGeneric(Primitives.ANY, string);
};
var inferConditionFromString = (rawString, ctx2, takenVars) => {
  const string = rawString.trim();
  if (string === "_") {
    return [
      createCondition(
        createVar("_", Meta.STRING),
        createVar(createVar(true, Primitives.BOOLEAN), Primitives.EXPRESSION),
        createVar(0.5 /* ANY */, Primitives.NUMBER)
      ),
      Primitives.ANY,
      null
    ];
  }
  const expressionObject = parseToExpr(string);
  const missing = unknownVariablesInExpression(expressionObject).missing;
  if (missing.length === 0) {
    let isPreviouslyDeclaredFunction = false;
    if (!string.startsWith("(")) {
      const consideredValue = ctx2.getOrNull(string);
      if (consideredValue && isAlias(consideredValue.type) && consideredValue.type.alias === "FUNCTION") {
        isPreviouslyDeclaredFunction = true;
        missing.push({
          value: string,
          type: { baseName: "VARIABLE", types: [], meta: false }
        });
      }
    }
    if (!isPreviouslyDeclaredFunction) {
      const result = interpret(string);
      return [
        createCondition(
          createVar("__repr", Meta.STRING),
          createVarEqualityCheckExpression("__repr", result),
          createVar(1.2 /* VALUE */, Primitives.NUMBER)
        ),
        result.type,
        null
      ];
    }
  }
  const acceptedMissing = missing.filter((item) => !takenVars.has(item.value));
  if (acceptedMissing.length === 0) {
    if (string[0] === "(") {
      return [
        createCondition(
          createVar("__repr", Meta.STRING),
          createVar(parseToExpr("__repr ==" + string), Primitives.EXPRESSION),
          createVar(1.15 /* EXPRESSION */, Primitives.NUMBER)
        ),
        Primitives.ANY,
        null
      ];
    } else {
      return [
        createCondition(
          createVar("__repr", Meta.STRING),
          createVar(
            parseToExpr("__repr ==" + missing[0].value),
            Primitives.EXPRESSION
          ),
          createVar(1.2 /* VALUE */, Primitives.NUMBER)
        ),
        Primitives.ANY,
        null
      ];
    }
  }
  const name = acceptedMissing[0].value;
  if (string[0] === "(") {
    return [
      createCondition(
        createVar(name, Meta.STRING),
        createVar(parseToExpr(string).value, Primitives.EXPRESSION),
        createVar(1.15 /* EXPRESSION */, Primitives.NUMBER)
      ),
      Primitives.ANY,
      name
    ];
  }
  return [
    createCondition(
      createVar(name, Meta.STRING),
      createVar(createVar(true, Primitives.BOOLEAN), Primitives.EXPRESSION),
      createVar(0.5 /* ANY */, Primitives.NUMBER)
    ),
    Primitives.ANY,
    name
  ];
};
var createPatternFromVar = (pattern, ctx2, takenVars) => {
  const conditionAndType = splitGeneral(pattern, ":");
  let type = conditionAndType.length === 1 ? Primitives.ANY : inferTypeFromString(conditionAndType[1], ctx2);
  const [condition, inferredType, namedVar] = inferConditionFromString(
    conditionAndType[0],
    ctx2,
    takenVars
  );
  if (type === Primitives.ANY) {
    type = inferredType;
  }
  return [createPattern(condition, createTypeVar(type)), namedVar];
};
function aliasMatches(type, alias) {
  return type.alias && type.alias === alias;
}
function createVarEqualityCheckExpression(varName, comparedTo) {
  return createVar(
    createCall("==", [createVar(varName, Primitives.VARIABLE), comparedTo]),
    Primitives.EXPRESSION
  );
}

// lib/StringUtils.ts
function typeToString(t) {
  return typeToStringRec(t, "");
}
function typeToStringRec(t, contents) {
  if (!t.meta) {
    return contents + t.baseName.toLowerCase();
  }
  if (isAlias(t)) {
    contents += t.alias;
  }
  const [open, close] = t.baseName === "LIST" ? ["[", "]"] : ["(", ")"];
  const types = t.types;
  contents += open;
  for (let i = 0; i < types.length; i++) {
    contents = typeToStringRec(types[i], contents);
    if (i < types.length - 1) {
      contents += ",";
    }
  }
  contents += close;
  return contents;
}
function feverStringFromJsString(jsString) {
  return createVar(
    jsString.split("").map((char) => createVar(char, Primitives.CHARACTER)),
    Meta.STRING
  );
}
function lineShouldBeEvaluated(line) {
  const trimmedLine = line.trim();
  return trimmedLine.length > 0 && !trimmedLine.startsWith("//");
}

// middleware/Literals.ts
function everyCharNumeric(text) {
  return text.match(/^-?[0-9]+$/g) !== null || text.match(/^-?[0-9]+\.[0-9]+$/g) !== null;
}
function isStringLiteral(text) {
  return text.match(/^".+"$/g) !== null || text.match(/^'.+'$/g) !== null;
}
function isWord(text) {
  return text.match(/^[a-zA-z]$/g) !== null || text.match(/^[a-zA-Z][a-zA-Z0-9]+$/g) !== null;
}
function wordIsBoolean(text) {
  return text === "true" || text === "false";
}
function wordIsNull(text) {
  return text === "null";
}
function getAsTypeVar(text) {
  const tName = text.toUpperCase();
  if (tName in Primitives) {
    return createTypeVar(Primitives[tName]);
  }
  if (tName in Meta) {
    return createTypeVar(Meta[tName]);
  }
  return null;
}
var recursiveTypeMatch = new RegExp(/^(list|tuple)\[(.*)]$/m);
function maybeVarFromLiteral(parent) {
  const parentText = parent.text;
  if (parentText === "[]") {
    return createVar([], Meta.LIST);
  }
  if (parentText === '""' || parentText === "''") {
    return createVar([], Meta.STRING);
  }
  if (parentText === "()") {
    return createVar([], Meta.TUPLE);
  }
  if (parentText === "{}") {
    return createVar([], Meta.SIGNATURE);
  }
  const asTypeVar = getAsTypeVar(parentText);
  if (asTypeVar) {
    return asTypeVar;
  }
  const normalVar = ctx.getOrNull(parentText);
  if (normalVar) {
    return normalVar;
  }
  if (everyCharNumeric(parentText)) {
    return createVar(Number(parentText), Primitives.NUMBER);
  }
  if (isStringLiteral(parentText)) {
    return feverStringFromJsString(parentText.slice(1, parentText.length - 1));
  }
  if (isWord(parentText)) {
    if (wordIsBoolean(parentText)) {
      return createVar(parentText === "true", Primitives.BOOLEAN);
    }
    if (wordIsNull(parentText)) {
      return createVar(null, Primitives.VOID);
    }
  }
}
function abstractNodeToRealNode(parent, skipVarLookup) {
  const maybeVar = maybeVarFromLiteral(parent);
  if (maybeVar && parent.type !== 2 /* FUNCTION_CALL */ && !skipVarLookup) {
    return maybeVar;
  } else {
    const isAssignment = parent.type === 2 /* FUNCTION_CALL */ && parent.text === "=";
    const realChildren = parent.children.map(
      (child, index) => abstractNodeToRealNode(child, index === 0 && isAssignment)
    );
    switch (parent.type) {
      case 2 /* FUNCTION_CALL */:
        return createCall(parent.text, realChildren);
      case 3 /* LIST */:
        return createVar(realChildren, inferListType(realChildren));
      case 4 /* TUPLE */:
        if (realChildren.length > 1) {
          return createTuple(realChildren);
        } else {
          if (unknownVariablesInExpression(realChildren[0]).missing.length > 0) {
            return createVar(realChildren[0], Primitives.EXPRESSION);
          }
          return evaluate(realChildren[0]);
        }
      case 5 /* SIGNATURE */:
        const takenVars = /* @__PURE__ */ new Set();
        const signatureItems = [];
        for (let i = 0; i < realChildren.length; i++) {
          const [pattern, varName] = createPatternFromVar(
            parent.children[i].text,
            ctx,
            takenVars
          );
          if (varName !== null) {
            takenVars.add(varName);
          }
          signatureItems.push(pattern);
        }
        return createVar(signatureItems, Meta.SIGNATURE);
      case 6 /* GROUP */:
        const expressionList = parent.children.map(
          (child) => abstractNodeToRealNode(child, skipVarLookup)
        );
        return createVar(expressionList, Meta.MULTI_EXPRESSION);
      default:
        return createVar(parent.text, Primitives.VARIABLE);
    }
  }
}
function inferListType(items, optionalAlias) {
  if (items.length > 0) {
    const first = items[0];
    if (items.every(
      (i) => typeAssignableFrom(i.type, first.type) || i.type.baseName === "LIST" && i.value.length === 0
    )) {
      return createTypedList(first.type, optionalAlias);
    }
  }
  return Meta.LIST;
}

// internals/Context.ts
var Context = class {
  constructor() {
    this.scopes = [{}];
    this.depth = 0;
    this.morphisms = {};
    this.useCallStack = false;
  }
  enterScope() {
    this.depth++;
    this.scopes.push({});
  }
  exitScope() {
    this.depth--;
    this.scopes.pop();
  }
  assignValue(name, value) {
    this.scopes[this.depth][name] = value;
  }
  globalAssignValue(name, value) {
    this.scopes[0][name] = value;
  }
  deleteValue(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        delete this.scopes[i][name];
        return;
      }
    }
  }
  hasVariable(name) {
    if (name === "_") {
      return false;
    }
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        return true;
      }
    }
    return false;
  }
  lookupValue(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        return this.scopes[i][name];
      }
    }
    throw "Unknown variable";
  }
  getOrNull(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        return this.scopes[i][name];
      }
    }
    return null;
  }
  hasVariableInScope(name) {
    return name in this.scopes[this.scopes.length - 1];
  }
  lookupValueInScope(name) {
    if (name in this.scopes[this.scopes.length - 1]) {
      return this.scopes[this.scopes.length - 1][name];
    }
    throw "Unknown variable";
  }
  flattenToMap() {
    let vars = {};
    for (let i = 0; i < this.scopes.length; i++) {
      vars = { ...vars, ...this.scopes[i] };
    }
    return vars;
  }
  registerMorphism(from, to, by) {
    const fromName = typeToString(from);
    const toName = typeToString(to);
    if (!(fromName in this.morphisms)) {
      this.morphisms[fromName] = {};
    }
    this.morphisms[fromName][toName] = by;
  }
  setDiff(a, b) {
    const c = /* @__PURE__ */ new Set();
    a.forEach((e) => c.add(e));
    b.forEach((e) => c.delete(e));
    return c;
  }
  pathBetweenRec(end, path) {
    const pathEnd = path[path.length - 1];
    const keys = new Set(
      pathEnd in this.morphisms ? Object.keys(this.morphisms[pathEnd]) : []
    );
    if (keys.has(end)) {
      return [...path, end];
    }
    const freshKeys = this.setDiff(keys, new Set(path));
    for (const key of freshKeys) {
      const result = this.pathBetweenRec(end, [...path, key]);
      if (result.length > 0) {
        return result;
      }
    }
    return [];
  }
  pathBetween(start, end) {
    return this.pathBetweenRec(typeToString(end), [typeToString(start)]);
  }
};

// middleware/CallStackDebugger.ts
var currentFunctionPath = [];
var enteredStackTiming = [];
var encounteredSet = /* @__PURE__ */ new Set();
var callHistory = {};
var callDurations = {};
function enterFunction(name) {
  currentFunctionPath.push(name);
  encounteredSet.add(name);
  enteredStackTiming.push(getNsTime());
  trackCurrentCall();
}
function exitFunction() {
  const fnName = currentFunctionPath.pop();
  const doneAt = getNsTime();
  if (!(fnName in callDurations)) {
    callDurations[fnName] = [];
  }
  callDurations[fnName].push(doneAt - enteredStackTiming.pop());
}
function callStackToPathString() {
  return currentFunctionPath.join(" ");
}
function trackCurrentCall() {
  const path = callStackToPathString();
  if (!(path in callHistory)) {
    callHistory[path] = 0;
  }
  callHistory[path]++;
}
function getNsTime() {
  const hrTime = process.hrtime();
  return hrTime[0] * 1e6 + hrTime[1] / 1e3;
}

// lib/CommonUtils.ts
function newOfType(t, args, ctx2) {
  const typeVar = createTypeVar(t);
  return dispatchFunction("new", [typeVar, ...args]);
}
function isNumeric2(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
function stringify(value) {
  return dispatchFunction("stringify", [value]);
}
function equals(v1, v2) {
  return dispatchFunction("==", [v1, v2]);
}

// lib/HigherOrder.ts
function namedMap(list, action, ctx2, [element, index, intermediate]) {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    const mapping = {};
    mapping[element] = item;
    mapping[index] = createVar(i, Primitives.NUMBER);
    mapping[intermediate] = createVar(
      [...internalList],
      createTypedList(
        internalList.length > 0 ? internalList[0].type : Primitives.ANY
      )
    );
    const result2 = evaluate(
      recreateExpressionWithVariables(action.value, mapping)
    );
    internalList.push(result2);
  }
  const result = createVar(
    internalList,
    inferListType(internalList, list.type.alias)
  );
  if (isAlias(list.type)) {
    const created = newOfType(result.type, [result], ctx2);
    if (created.type.baseName !== "ERROR") {
      return created;
    }
  }
  return result;
}
function namedFilter(list, action, ctx2, [element, index, intermediate], funcRef) {
  const internalList = [];
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    const mapping = {};
    mapping[element] = item;
    mapping[index] = createVar(i, Primitives.NUMBER);
    mapping[intermediate] = createVar(
      [...internalList],
      createTypedList(
        internalList.length > 0 ? internalList[0].type : Primitives.ANY
      )
    );
    let result2;
    if (funcRef) {
      result2 = callFunctionByReference(funcRef, [item], ctx2, "lambda");
    } else {
      result2 = evaluate(recreateExpressionWithVariables(action, mapping).value);
    }
    if (result2.value) {
      internalList.push(item);
    }
  }
  const result = createVar(
    internalList,
    inferListType(internalList, list.type.alias)
  );
  if (isAlias(list.type)) {
    const created = newOfType(result.type, [result], ctx2);
    if (created.type.baseName !== "ERROR") {
      return created;
    }
  }
  return result;
}
function namedReduce(list, acc, expr, ctx2, [element, index, accumulator], earlyTerminateIfNotFalse) {
  const initialAcc = acc;
  for (let i = 0; i < list.value.length; i++) {
    const item = list.value[i];
    const mapping = {};
    mapping[element] = item;
    mapping[index] = createVar(i, Primitives.NUMBER);
    mapping[accumulator] = acc;
    acc = evaluate(recreateExpressionWithVariables(expr, mapping));
    if (earlyTerminateIfNotFalse && !equals(initialAcc, acc).value) {
      return acc;
    }
  }
  return acc;
}
function namedMonadicMap(item, expression, varNames) {
  const variablesFromItem = lift(item);
  const varMappings = variablesFromItem.value[0];
  const mappings = {};
  for (let i = 0; i < 3; i++) {
    if (varMappings.value.length <= i) {
      break;
    }
    mappings[varNames[i]] = varMappings.value[i];
  }
  let result;
  if (aliasMatches(mappings[varNames[0]].type, "PASSTHROUGH")) {
    result = mappings[varNames[0]].value;
  } else {
    const recreatedExpression = recreateExpressionWithVariables(
      expression,
      mappings
    );
    result = evaluate(recreatedExpression);
  }
  return drop(result, item);
}
function namedMonadicFilter(item, expression, varNames) {
  const variablesFromItem = lift(item);
  const varMappings = variablesFromItem.value[0];
  const falseCaseValue = variablesFromItem.value[1];
  const mappings = {};
  for (let i = 0; i < 3; i++) {
    if (varMappings.value.length <= i) {
      break;
    }
    mappings[varNames[i]] = varMappings.value[i];
  }
  let result;
  if (aliasMatches(mappings[varNames[0]].type, "PASSTHROUGH")) {
    result = mappings[varNames[0]].value;
    if (equals(result, falseCaseValue)) {
      return drop(result, item);
    }
  } else {
    const recreatedExpression = recreateExpressionWithVariables(
      expression,
      mappings
    );
    const boolean = evaluate(recreatedExpression);
    if (boolean.value) {
      result = mappings[varNames[0]];
    } else {
      result = falseCaseValue;
    }
    return drop(result, item);
  }
}
function namedMonadicReduce(item, fallback) {
  const variablesFromItem = lift(item);
  const varMappings = variablesFromItem.value[0];
  const falseCaseValue = variablesFromItem.value[1];
  const supplied = varMappings.value[0];
  if (aliasMatches(supplied.type, "PASSTHROUGH")) {
    if (equals(supplied, falseCaseValue)) {
      return fallback;
    }
  }
  return supplied;
}
function lift(value) {
  return dispatchFunction("lift", [value]);
}
function drop(value, initialValue) {
  return dispatchFunction("drop", [value, initialValue]);
}

// lib/Errors.ts
function argumentCountError(name, argumentCount) {
  return createError(
    "No definition of " + name + " that takes " + argumentCount + " arguments"
  );
}
function noPatternMatch(name) {
  return createError("No satisfactory match for " + name + ".");
}
function indexOutOfRange(index, structureString) {
  return createError("Index " + index + " out of range on " + structureString);
}
function failureToParseString(value, targetType) {
  return createError(
    '"' + value + '" cannot be interpreted as a ' + targetType + "."
  );
}
function unknownFunctionError(name) {
  return createError("Unknown function " + name + " invoked.");
}

// middleware/Builtins.ts
function newFunction(arity, types, functionOperation, args) {
  const func = {
    arity,
    types,
    function: functionOperation
  };
  if (args) {
    if ("specificities" in args) {
      func["specificities"] = args.specificities;
    } else {
      func["specificities"] = Array(arity).fill(0.5);
    }
    if ("conditions" in args) {
      func["conditions"] = args.conditions;
    } else {
      func["conditions"] = Array(arity).fill(() => true);
    }
  } else {
    func["conditions"] = Array(arity).fill(() => true);
    func["specificities"] = Array(arity).fill(0.5);
  }
  return func;
}
var builtins = {
  "+": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value + b.value, a.type)
    ),
    newFunction(2, [Meta.LIST, Meta.LIST], ([a, b]) => {
      const l = a.value.concat(b.value);
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.LIST, Meta.STRING], ([a, b]) => {
      const l = [...a.value, b];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.STRING, Meta.LIST], ([a, b]) => {
      const l = [a, ...b.value];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.STRING, Meta.STRING], ([a, b]) => {
      return createVar(a.value.concat(b.value), a.type);
    }),
    newFunction(2, [Primitives.ANY, Meta.LIST], ([a, b]) => {
      const l = [a, ...b.value];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.LIST, Primitives.ANY], ([a, b]) => {
      const l = [...a.value, b];
      return createVar(l, inferListType(l));
    }),
    newFunction(2, [Meta.STRING, Primitives.ANY], ([a, b]) => {
      const jsString = charListToJsString(a);
      return feverStringFromJsString(jsString + b.value);
    }),
    newFunction(2, [Primitives.ANY, Meta.STRING], ([a, b]) => {
      const jsString = charListToJsString(b);
      return feverStringFromJsString(a.value + jsString);
    }),
    newFunction(
      2,
      [Primitives.CHARACTER, Primitives.NUMBER],
      ([char, shift]) => createVar(
        String.fromCharCode(char.value.charCodeAt(0) + shift.value),
        Primitives.CHARACTER
      )
    ),
    newFunction(2, [Primitives.CHARACTER, Primitives.CHARACTER], ([c1, c2]) => {
      return feverStringFromJsString(c1.value + c2.value);
    })
  ],
  "*": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value * b.value, a.type)
    ),
    newFunction(2, [Meta.LIST, Primitives.NUMBER], ([a, b]) => {
      const list = [];
      for (let i = 0; i < b.value; i++) {
        for (let z = 0; z < a.value.length; z++) {
          list.push(a.value[z]);
        }
      }
      return createVar(list, a.type);
    }),
    newFunction(2, [Primitives.NUMBER, Meta.LIST], ([a, b]) => {
      const list = [];
      for (let i = 0; i < a.value; i++) {
        for (let z = 0; z < b.value.length; z++) {
          list.push(b.value[z]);
        }
      }
      return createVar(list, b.type);
    })
  ],
  "-": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value - b.value, a.type)
    )
  ],
  "/": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value / b.value, a.type)
    )
  ],
  ">": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value > b.value, Primitives.BOOLEAN)
    )
  ],
  "<": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value < b.value, Primitives.BOOLEAN)
    )
  ],
  "&": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value && b.value, Primitives.BOOLEAN)
    )
  ],
  "|": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value || b.value, Primitives.BOOLEAN)
    )
  ],
  "<=": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value <= b.value, Primitives.BOOLEAN)
    )
  ],
  ">=": [
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([a, b]) => createVar(a.value >= b.value, Primitives.BOOLEAN)
    )
  ],
  "->": [
    newFunction(
      2,
      [Meta.LIST, Primitives.EXPRESSION],
      ([list, action], ctx2) => {
        return namedMap(list, action, ctx2, ["@", "#", "^"]);
      }
    ),
    // [1,2,3] -> (['item','index','intermediate'], (item + 1))
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.EXPRESSION
        ])
      ],
      ([list, namedAction], ctx2) => {
        const [names, action] = namedAction.value;
        const nameTable = ["@", "#", "^"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedMap(list, action, ctx2, nameTable);
      }
    ),
    newFunction(2, [Meta.LIST, Primitives.ANY], ([list, result], ctx2) => {
      const results = list.value.map((ignored) => result);
      const res = createVar(
        results,
        createTypedList(
          results.length > 0 ? results[0].type : Primitives.ANY,
          list.type.alias
        )
      );
      if (isAlias(res.type)) {
        const created = newOfType(res.type, [res], ctx2);
        if (created.type.baseName !== "ERROR") {
          return created;
        }
      }
      return res;
    }),
    newFunction(2, [Meta.LIST, Meta.FUNCTION], ([list, func], ctx2) => {
      const results = list.value.map(
        (item) => callFunctionByReference(func, [item], ctx2, "lambda")
      );
      const errors = results.filter((res2) => res2.type.baseName === "ERROR");
      if (errors.length > 0) {
        return errors[0];
      }
      const res = createVar(
        results,
        createTypedList(
          results.length > 0 ? results[0].type : Primitives.ANY,
          list.type.alias
        )
      );
      if (isAlias(res.type)) {
        const created = newOfType(res.type, [res], ctx2);
        if (created.type.baseName !== "ERROR") {
          return created;
        }
      }
      return res;
    }),
    newFunction(2, [Primitives.ANY, Primitives.EXPRESSION], ([item, expr]) => {
      return namedMonadicMap(item, expr, ["@", "#", "^"]);
    })
  ],
  "\\>": [
    newFunction(
      2,
      [Meta.LIST, createTypedTuple([Primitives.ANY, Primitives.EXPRESSION])],
      ([list, reduce], ctx2) => {
        const [acc, reduction] = reduce.value;
        return namedReduce(list, acc, reduction, ctx2, ["@", "#", "$"], false);
      }
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.ANY,
          Primitives.EXPRESSION
        ])
      ],
      ([list, namedReduction], ctx2) => {
        const [names, acc, reduction] = namedReduction.value;
        const nameTable = ["@", "#", "$"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedReduce(list, acc, reduction, ctx2, nameTable, false);
      }
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          Primitives.ANY,
          Primitives.EXPRESSION,
          Primitives.BOOLEAN
        ])
      ],
      ([list, reduce], ctx2) => {
        const [acc, reduction, flag] = reduce.value;
        return namedReduce(
          list,
          acc,
          reduction,
          ctx2,
          ["@", "#", "$"],
          flag.value
        );
      }
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.ANY,
          Primitives.EXPRESSION,
          Primitives.BOOLEAN
        ])
      ],
      ([list, namedReduction], ctx2) => {
        const [names, acc, reduction, flag] = namedReduction.value;
        const nameTable = ["@", "#", "$"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedReduce(list, acc, reduction, ctx2, nameTable, flag.value);
      }
    ),
    newFunction(
      2,
      [Primitives.ANY, Primitives.ANY],
      ([item, fallback]) => namedMonadicReduce(item, fallback)
    )
  ],
  "~>": [
    newFunction(
      2,
      [Meta.LIST, Primitives.EXPRESSION],
      ([list, action], ctx2) => {
        return namedFilter(list, action, ctx2, ["@", "#", "^"], null);
      }
    ),
    newFunction(
      2,
      [
        Meta.LIST,
        createTypedTuple([
          createTypedList(Primitives.VARIABLE),
          Primitives.EXPRESSION
        ])
      ],
      ([list, namedAction], ctx2) => {
        const [names, filter] = namedAction.value;
        const nameTable = ["@", "#", "^"];
        const providedNames = names.value;
        for (let i = 0; i < Math.min(3, providedNames.length); i++) {
          nameTable[i] = providedNames[i].value;
        }
        return namedFilter(list, filter, ctx2, nameTable, null);
      }
    ),
    newFunction(2, [Meta.LIST, Meta.FUNCTION], ([list, funcRef], ctx2) => {
      return namedFilter(list, null, ctx2, ["@", "#", "^"], funcRef);
    }),
    newFunction(2, [Primitives.ANY, Primitives.EXPRESSION], ([item, expr]) => {
      return namedMonadicFilter(item, expr, ["@", "#", "^"]);
    })
  ],
  "==": [
    newFunction(2, [Primitives.ANY, Primitives.ANY], ([a, b]) => {
      if (a.type.baseName === "LIST" && b.type.baseName === "LIST" && a.value.length !== b.value.length) {
        return createVar(false, Primitives.BOOLEAN);
      }
      return createVar(
        JSON.stringify(a.value) === JSON.stringify(b.value),
        Primitives.BOOLEAN
      );
    })
  ],
  "%": [
    newFunction(
      2,
      [Primitives.NUMBER, Primitives.NUMBER],
      ([a, b]) => createVar(a.value % b.value, Primitives.NUMBER)
    )
  ],
  "=>": [
    newFunction(
      2,
      [Meta.SIGNATURE, Primitives.EXPRESSION],
      ([signature, expression]) => {
        return createVar([signature, expression], Meta.CASE);
      }
    ),
    newFunction(
      2,
      [Meta.SIGNATURE, Meta.MULTI_EXPRESSION],
      ([signature, expression]) => {
        return createVar([signature, expression], Meta.CASE);
      }
    ),
    newFunction(2, [Meta.SIGNATURE, Primitives.ANY], ([signature, value]) => {
      return createVar(
        [signature, createVar(value, Primitives.EXPRESSION)],
        Meta.CASE
      );
    })
  ],
  "=": [
    newFunction(
      2,
      [Primitives.VARIABLE, Primitives.ANY],
      ([name, value], variables) => {
        variables.assignValue(name.value, value);
        return value;
      }
    ),
    newFunction(
      2,
      [Primitives.VARIABLE, Meta.CASE],
      ([name, func], variables) => addFunctionCase(name, func, variables)
    ),
    newFunction(
      2,
      [Primitives.VARIABLE, Meta.SIGNATURE],
      ([name, signature], variables) => {
        const realName = name.value;
        const types = typesFromSignature(signature);
        const size = types.length;
        const isListAlias = size === 1 && types[0].baseName === "LIST";
        let newInnerType;
        if (isListAlias) {
          newInnerType = createType("LIST", types[0].types, true);
        }
        const newType = isListAlias ? createTypedList(types[0].types[0], realName) : createTypedTuple(types, realName);
        Meta[realName.toUpperCase()] = newType;
        const permutations = [];
        for (let i = 0; i < size; i++) {
          const condition = signature.value[i].value[0].value;
          const name2 = condition[0];
          const expression = condition[1];
          if (expression.value.value === true) {
            permutations.push((arg) => arg);
          } else {
            permutations.push((arg, ctx2) => {
              variables.enterScope();
              variables.assignValue(name2.value, arg);
              const result = evaluate(expression.value);
              variables.exitScope();
              return result;
            });
          }
          registerNewFunction(
            name2.value,
            variables,
            newFunction(1, [newType], ([ofType]) => {
              return isListAlias ? createVar(ofType.value, newInnerType) : ofType.value[i];
            })
          );
        }
        for (let i = 0; i < size; i++) {
          const condition = signature.value[i].value[0].value;
          const name2 = condition[0];
          registerNewFunction(
            name2.value,
            variables,
            newFunction(2, [newType, types[i]], ([ofType, newValue], ctx2) => {
              ofType.value[i] = permutations[i](newValue, ctx2);
              return ofType;
            })
          );
        }
        const operation = ([, ...args], ctx2) => {
          const mutatedArgs = [];
          for (let i = 0; i < size; i++) {
            mutatedArgs.push(permutations[i](args[i], ctx2));
          }
          return isListAlias ? createVar(
            mutatedArgs[0].value,
            inferListType(mutatedArgs[0].value, realName)
          ) : createVar(mutatedArgs, newType);
        };
        registerNewFunction(
          "new",
          variables,
          newFunction(size + 1, [Primitives.TYPE, ...types], operation, {
            conditions: [
              (arg) => {
                return typeAssignableFrom(arg.value, newType);
              },
              ...Array(size).fill(() => true)
            ],
            specificities: Array(size + 1).fill(1)
          })
        );
        const typeVar = createVar(newType, Primitives.TYPE);
        variables.assignValue(realName, typeVar);
        return typeVar;
      }
    )
  ],
  show: [
    newFunction(
      1,
      [Primitives.ANY],
      ([v], ctx2) => {
        console.log(charListToJsString(stringify(v)));
        return v;
      },
      {
        specificities: [1]
      }
    ),
    newFunction(1, [Primitives.ERROR], ([e]) => {
      console.log(e.value);
      return e;
    }),
    newFunction(2, [Primitives.ANY, Meta.STRING], ([v, delimiter]) => {
      process.stdout.write(recursiveToString(v) + delimiter.value);
      return v;
    }),
    newFunction(2, [Meta.STRING, Meta.STRING], ([v, delimiter]) => {
      process.stdout.write(charListToJsString(v) + delimiter.value);
      return v;
    })
  ],
  explain: [
    newFunction(1, [Primitives.ANY], ([v]) => {
      console.dir(v, { depth: null });
      return v;
    })
  ],
  "..": [
    newFunction(
      2,
      [Primitives.NUMBER, Primitives.NUMBER],
      ([a, b]) => {
        const direction = a.value < b.value ? 1 : -1;
        const numbers = [];
        for (let i = a.value; i !== b.value; i += direction) {
          numbers.push(createVar(i, Primitives.NUMBER));
        }
        numbers.push(b);
        return createVar(numbers, createTypedList(Primitives.NUMBER));
      },
      {
        conditions: [
          (num) => Number.isInteger(num.value),
          (num) => Number.isInteger(num.value)
        ],
        specificities: [1, 1]
      }
    )
  ],
  get: [
    newFunction(2, [Meta.LIST, Primitives.NUMBER], ([list, num]) => {
      if (num.value < list.value.length) {
        return list.value[num.value];
      }
      return indexOutOfRange(num.value, recursiveToString(list));
    }),
    newFunction(2, [Meta.TUPLE, Primitives.NUMBER], ([tuple, num]) => {
      if (num.value < tuple.value.length) {
        return tuple.value[num.value];
      }
      return indexOutOfRange(num.value, recursiveToString(tuple));
    })
  ],
  append: [
    newFunction(2, [Meta.LIST, Primitives.ANY], ([list, item]) => {
      return createVar([...list.value, item], list.type);
    })
  ],
  floor: [
    newFunction(1, [Primitives.NUMBER], ([num]) => {
      return createVar(Math.floor(num.value), Primitives.NUMBER);
    })
  ],
  ceil: [
    newFunction(1, [Primitives.NUMBER], ([num]) => {
      return createVar(Math.ceil(num.value), Primitives.NUMBER);
    })
  ],
  "?": [
    newFunction(
      3,
      [Primitives.BOOLEAN, Primitives.ANY, Primitives.ANY],
      ([truth, a, b]) => {
        return truth.value ? a : b;
      }
    )
  ],
  nl: [
    newFunction(1, [Primitives.ANY], ([ignored]) => {
      console.log();
      return ignored;
    })
  ],
  sqrt: [
    newFunction(
      1,
      [Primitives.NUMBER],
      ([val]) => {
        return createVar(Math.sqrt(val.value), Primitives.NUMBER);
      },
      {
        conditions: [(arg) => arg.value >= 0],
        specificities: [1]
      }
    )
  ],
  not: [
    newFunction(1, [Primitives.BOOLEAN], ([truth]) => {
      return createVar(!truth.value, Primitives.BOOLEAN);
    })
  ],
  len: [
    newFunction(1, [Meta.LIST], ([list]) => {
      return createVar(list.value.length, Primitives.NUMBER);
    })
  ],
  stringify: [
    newFunction(
      1,
      [Primitives.ANY],
      ([v]) => {
        return feverStringFromJsString(recursiveToString(v));
      },
      {
        specificities: [0.6]
      }
    ),
    newFunction(
      1,
      [Meta.FUNCTION],
      ([func]) => {
        return feverStringFromJsString(serializeFunction(func));
      },
      {
        specificities: [0.6]
      }
    ),
    newFunction(
      1,
      [Primitives.TYPE],
      ([typeVar]) => {
        return feverStringFromJsString(typeToString(typeVar.value));
      },
      {
        specificities: [0.6]
      }
    )
  ],
  type: [
    newFunction(
      1,
      [Primitives.ANY],
      ([v]) => {
        return createVar(v.type, Primitives.TYPE);
      },
      {
        specificities: [0.6]
      }
    )
  ],
  ord: [
    newFunction(
      1,
      [Primitives.CHARACTER],
      ([c]) => createVar(c.value.charCodeAt(0), Primitives.NUMBER)
    )
  ],
  depth: [
    newFunction(1, [Primitives.ANY], ([ignored], variables) => {
      return createVar(variables.scopes.length, Primitives.NUMBER);
    })
  ],
  time: [
    newFunction(1, [Primitives.NUMBER], ([diff]) => {
      return createVar(Date.now() - diff.value, Primitives.NUMBER);
    }),
    newFunction(0, [], () => {
      return createVar(Date.now(), Primitives.NUMBER);
    })
  ],
  morph: [
    newFunction(
      2,
      [Meta.FUNCTION, Primitives.TYPE],
      ([transformation, toType], ctx2) => {
        const fromType = transformation.invocations[0].types[0];
        ctx2.registerMorphism(fromType, toType.value, transformation);
        return createVar(true, Primitives.BOOLEAN);
      },
      {
        conditions: [
          (transformation) => {
            return transformation.invocations.every(
              (invocation) => invocation.types.length === 1
            );
          },
          () => true
        ],
        specificities: [1, 1]
      }
    ),
    newFunction(
      3,
      [Meta.FUNCTION, Primitives.TYPE, Primitives.TYPE],
      ([transformation, fromType, toType], ctx2) => {
        ctx2.registerMorphism(fromType.value, toType.value, transformation);
        return createVar(true, Primitives.BOOLEAN);
      },
      {
        conditions: [
          (transformation) => {
            return transformation.invocations.every(
              (invocation) => invocation.types.length === 1
            );
          },
          () => true,
          () => true
        ],
        specificities: [1, 1, 1]
      }
    )
  ],
  convert: [
    newFunction(
      2,
      [Primitives.ANY, Primitives.TYPE],
      ([value, toType], ctx2) => {
        return morphTypes(value, toType, ctx2);
      }
    )
  ],
  to_number: [
    newFunction(1, [Meta.STRING], ([feverString]) => {
      const jsString = charListToJsString(feverString);
      if (isNumeric2(jsString)) {
        return createVar(Number(jsString), Primitives.NUMBER);
      } else {
        return failureToParseString(jsString, "number");
      }
    })
  ],
  is_numeric: [
    newFunction(1, [Meta.STRING], ([string]) => {
      const jsString = charListToJsString(string);
      if (isNumeric2(jsString)) {
        return createVar(true, Primitives.BOOLEAN);
      } else {
        return createVar(false, Primitives.BOOLEAN);
      }
    })
  ],
  replace: [
    newFunction(
      3,
      [Meta.STRING, Meta.STRING, Meta.STRING],
      ([original, pattern, replacement]) => {
        return feverStringFromJsString(
          charListToJsString(original).replaceAll(
            charListToJsString(pattern),
            charListToJsString(replacement)
          )
        );
      }
    )
  ],
  fast_slice: [
    newFunction(2, [Meta.LIST, Primitives.NUMBER], ([lst, idx]) => {
      const newList = lst.value.slice(idx.value);
      return createVar(newList, inferListType(newList));
    }),
    newFunction(
      3,
      [Meta.LIST, Primitives.NUMBER, Primitives.NUMBER],
      ([lst, startIdx, endIdx]) => {
        const newList = lst.value.slice(startIdx.value, endIdx.value);
        return createVar(newList, inferListType(newList));
      }
    )
  ],
  fast_sort: [
    newFunction(2, [Meta.LIST, Meta.FUNCTION], ([lst, fn]) => {
      const sortedList = lst.value.sort(
        (v1, v2) => callFunctionByReference(fn, [v1, v2], ctx, "compare").value
      );
      return createVar(sortedList, inferListType(sortedList));
    })
  ],
  global_assign: [
    newFunction(2, [Meta.STRING, Primitives.ANY], ([name, value]) => {
      const realName = charListToJsString(name);
      ctx.globalAssignValue(realName, value);
      return createVar(true, Primitives.BOOLEAN);
    })
  ],
  add_to_global_list: [
    newFunction(2, [Meta.STRING, Primitives.ANY], ([name, value]) => {
      const realName = charListToJsString(name);
      const globalListValue = ctx.getOrNull(realName);
      ctx.globalAssignValue(
        realName,
        dispatchFunction("+", [globalListValue, value])
      );
      return createVar(true, Primitives.BOOLEAN);
    })
  ],
  passthrough: [
    newFunction(1, [Primitives.ANY], ([item]) => createMonadPassthrough(item))
  ]
};

// lib/FunctionUtils.ts
var nativeFunctionMessage = "<natively defined function>";
function typesFromSignature(signature) {
  return signature.value.map((i) => i.value[1].value);
}
function conditionsFromSignature(signature) {
  const conditions = [];
  const sigPatterns = signature.value;
  const size = sigPatterns.length;
  for (let i = 0; i < size; i++) {
    const pattern = sigPatterns[i];
    const condition = pattern.value[0];
    const conditionName = condition.value[0];
    const conditionExpression = condition.value[1];
    conditions.push((argument, ctx2) => {
      ctx2.assignValue(conditionName.value, argument);
      const result = evaluate(conditionExpression.value);
      if (result.type.baseName === "ERROR") {
        return false;
      }
      return result.value;
    });
  }
  return conditions;
}
function namesFromSignature(signature) {
  return signature.value.map((i) => i.value[0].value[0].value);
}
function specificitiesFromSignature(signature) {
  return signature.value.map((i) => i.value[0].value[2].value);
}
function registerNewFunction(name, variables, functionObject, rawCase) {
  let newCase;
  if (rawCase) {
    newCase = rawCase;
  } else {
    newCase = generateCaseFromNative(functionObject);
  }
  const named = variables.getOrNull(name);
  if (!named) {
    const newFunc = createVar([newCase], Meta.FUNCTION);
    newFunc["invocations"] = [functionObject];
    variables.assignValue(name, newFunc);
    return newFunc;
  }
  named.invocations.push(functionObject);
  named.value.push(newCase);
  return named;
}
function generateCaseFromNative(functionObject) {
  const types = functionObject["types"];
  const conditions = functionObject["conditions"];
  const specificities = functionObject["specificities"];
  const names = argNamesFromFunction(functionObject["function"].toString());
  const patterns = [];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const condition = conditions[i];
    const pattern = createVar(
      [
        createVar(
          [
            createVar(names[i], Meta.STRING),
            createVar(
              condition.toString() === "() => true" ? "true" : nativeFunctionMessage,
              Primitives.EXPRESSION
            ),
            createVar(specificities[i], Primitives.NUMBER)
          ],
          Meta.CONDITION
        ),
        createVar(type, Primitives.TYPE)
      ],
      Meta.PATTERN
    );
    patterns.push(pattern);
  }
  return createVar(
    [
      createVar(patterns, Meta.SIGNATURE),
      createVar(nativeFunctionMessage, Primitives.EXPRESSION)
    ],
    Meta.CASE
  );
}
function argNamesFromFunction(functionBody) {
  const args = [];
  let stack = "";
  let inDestructure = false;
  for (const letter of functionBody) {
    if (inDestructure) {
      switch (letter) {
        case "]":
          args.push(stack);
          return args;
        case ",":
          args.push(stack);
          stack = "";
          break;
        default:
          stack += letter;
          break;
      }
    } else if (letter === "[") {
      inDestructure = true;
    }
  }
  return args;
}
function serializeCase(c) {
  const [signature, expression] = c.value;
  const patterns = signature.value;
  let caseText = patterns.length >= 1 ? "(" : "() => ";
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const [condition, type] = pattern.value;
    const [varName, conditionExpr] = condition.value;
    caseText += conditionExpr.value.value === true ? varName.value : "<condition>";
    if (type.value.baseName !== "ANY") {
      caseText += ":" + (isAlias(type.value) ? type.value.alias : type.value.baseName.toLowerCase());
    }
    if (i < patterns.length - 1) {
      caseText += ",";
    } else {
      caseText += ") => ";
    }
  }
  if (!(typeof expression.value === "object")) {
    caseText += expression.value;
  } else if (aliasMatches(expression.type, "MULTI_EXPRESSION")) {
    caseText += "<multi-action>";
  } else if (aliasMatches(expression.value.type, "CALL")) {
    caseText += "<action>";
  } else if (expression.value.type.baseName === "VARIABLE") {
    caseText += expression.value.value;
  } else {
    caseText += charListToJsString(
      dispatchFunction("stringify", [expression.value])
    );
  }
  return caseText;
}
function serializeFunction(f) {
  const rankedCases = simpleRankCases(f.value);
  return rankedCases.map((c) => serializeCase(c)).join("\n");
}
function simpleRankCases(cases) {
  return cases.sort((c1, c2) => {
    let c1Spec = 0;
    let c2Spec = 0;
    const c1Patterns = c1.value[0].value;
    const c2Patterns = c2.value[0].value;
    for (let i = 0; i < c1Patterns.length; i++) {
      const [c1Condition, c1Type] = c1Patterns[i].value;
      c1Spec += simpleTypeSpec(c1Type.value) * c1Condition.value[2].value;
    }
    c1Spec = c1Spec / c1Patterns.length;
    for (let i = 0; i < c2Patterns.length; i++) {
      const [c2Condition, c2Type] = c2Patterns[i].value;
      c2Spec += simpleTypeSpec(c2Type.value) * c2Condition.value[2].value;
    }
    c2Spec = c2Spec / c2Patterns.length;
    return c2Spec - c1Spec;
  });
}
function simpleTypeSpec(t) {
  if (t.baseName === "ANY") {
    return 0.5 /* ANY */;
  }
  if (t.baseName === "TUPLE" && t.types.length === 0) {
    return 0.75 /* BASE_TUPLE */;
  }
  if (isAlias(t)) {
    return 1.1 /* NOMINAL */;
  }
  return 1 /* EQUIVALENT */;
}
function addFunctionCase(name, func, ctx2) {
  {
    const signature = func.value[0];
    const expression = func.value[1];
    const size = signature.value.length;
    const types = typesFromSignature(signature);
    const conditions = conditionsFromSignature(signature);
    const names = namesFromSignature(signature);
    const specificities = specificitiesFromSignature(signature);
    const operation = (args, ctx3) => {
      const mapping = {};
      for (let i = 0; i < args.length; i++) {
        mapping[names[i]] = args[i];
      }
      if (aliasMatches(expression.type, "MULTI_EXPRESSION")) {
        const recreatedMultiExpression = createVar(
          expression.value.map(
            (line) => recreateExpressionWithVariables(line, mapping)
          ),
          Meta.MULTI_EXPRESSION
        );
        return evaluate(recreatedMultiExpression);
      } else {
        return evaluate(
          recreateExpressionWithVariables(expression, mapping).value
        );
      }
    };
    return registerNewFunction(
      name.value,
      ctx2,
      newFunction(size, types, operation, {
        conditions,
        specificities
      }),
      func
    );
  }
}

// lib/StandardLib.ts
var standardLib = [
  "copies = {of, count:#} => (1..count -> (of))",
  "contains? = {lst:[], item} => (lst \\> (false, (item == @ | $), true))",
  "unique_add = {lst:[], (contains?(lst, item))} => (lst)",
  "unique_add = {lst:[], item} => (lst + item)",
  "unique = {lst:[]} => (lst \\> ([], (unique_add($,@))))",
  "is_whole? = {n:#} => (floor(n) == n)",
  "sum = {lst:[]} => (lst \\> (0, ($ + @)))",
  "min = {a:#, (a<=b):#} => (a)",
  "min = {_:#, b: #} => (b)",
  "min = {(len(lst) > 0):[]} => (lst \\> ((get(lst,0)), (?((@ < $), @, $))))",
  "max = {a:#, (a >= b):#} => (a)",
  "max = {_:#, b:#} => (b)",
  "max = {(len(lst) > 0):[]} => (lst \\> ((get(lst,0)), (?((@ > $), @, $))))",
  "slice = {lst:[], from:#} => (lst ~> (# >= from))",
  "in_range? = {target:#, (lower <= target):#, (target < higher):#} => true",
  "in_range? = {_:#, _:#, _: #} => false",
  "slice = {lst:[], from:#, to:#} => (lst ~> (in_range?(#, from, to)))",
  "head = {(len(lst) > 0):[]} => (get(lst,0))",
  "tail = {lst:[]} => (fast_slice(lst,1))",
  "set = {(unique(entries)):[]}",
  "halve = {lst:[]} => ([fast_slice(lst,0,floor(len(lst) / 2)), fast_slice(lst, floor(len(lst) / 2 ))])",
  "merge = {_:fn, [], l2:[]} => (l2)",
  "merge = {_:fn, l1:[], []} => (l1)",
  "merge = {compare:fn, l1:[], ((compare(get(l1,0),get(l2,0))) < 0):[]} => ((get(l1,0)) + (merge(compare,tail(l1),l2)))",
  "merge = {compare:fn, l1:[], l2:[]} => ((get(l2,0)) + (merge(compare, l1, tail(l2))))",
  "sort = {(len(lst) <= 1):[], _:fn} => (lst)",
  "sort_helper = {split_list:[], compare:fn} => (merge(compare,sort(get(split_list,0),compare), sort(get(split_list,1),compare)))",
  "sort = {lst:[], compare:fn} => (sort_helper(halve(lst), compare))",
  "compare = {n1:#,(n1 < n2):#} => -1",
  "compare = {n1:#,(n1 > n2):#} => 1",
  "compare = {_:#,_:#} => 0",
  "sort = {nums:[#]} => (sort(nums, compare))",
  "reverse = {lst:[]} => (lst -> (get(lst, len(lst) - # - 1)))",
  "sum = {str:string} => (str \\> (0, ($ + ord(@))))",
  "hash = {str:string, mod:#} => (sum(str) % mod)",
  "abs = {(a < 0):#} => (a * -1)",
  "abs = {a:#} => (a)",
  "all = {vs:[], mapper:fn} => (vs \\> (true,(mapper(@) & $)))",
  "any = {vs:[], mapper:fn} => (vs \\> (false, (mapper(@) | $)))",
  "reverse = {vs:[]} => (vs -> (get(vs, len(vs) - # - 1)))",
  "first = {vs:[]} => (get(vs,0))",
  "last = {vs:[]} => (get(vs, len(vs) - 1))",
  "time_diff = {result: []} => (last(result) - first(result))"
];
var registerBuiltins = (ctx2, extraBuiltins) => {
  const builtinReference = !!extraBuiltins ? extraBuiltins : builtins;
  for (const functionName of Object.keys(builtinReference)) {
    const patterns = builtinReference[functionName];
    for (const pattern of patterns) {
      registerNewFunction(functionName, ctx2, pattern);
    }
  }
  if (!extraBuiltins) {
    for (const line of standardLib) {
      interpret(line);
    }
  }
};

// internals/Interpreter.ts
var ERROR_CATCHING_FUNCTIONS = ["show"];
var ctx = new Context();
var assignGenericTableToTypeVars = (ctx2, genericTable) => {
  for (const genericName of Object.keys(genericTable)) {
    ctx2.assignValue(genericName, createTypeVar(genericTable[genericName]));
  }
};
var unassignGenericTableToTypeVars = (ctx2, genericTable) => {
  for (const genericName of Object.keys(genericTable)) {
    ctx2.deleteValue(genericName);
  }
};
function callFunctionByReference(ref, args, ctx2, name) {
  const errors = args.filter((arg) => arg.type.baseName === "ERROR");
  if (errors.length > 0) {
    if (!ERROR_CATCHING_FUNCTIONS.includes(name)) {
      return errors[0];
    }
  }
  const func = ref["invocations"];
  const candidates = func.filter((f) => f.arity === args.length);
  if (candidates.length === 0) {
    return argumentCountError(name, args.length);
  }
  if (args.length === 0) {
    return candidates[0].function([], ctx2);
  }
  let bestScore = 0;
  let bestCandidate = void 0;
  let modifiedArgs = args;
  let usedGenericTable = {};
  for (const candidateFunction of candidates) {
    ctx2.enterScope();
    const tempArgs = [...args];
    let genericTable = {};
    let score = 0;
    for (let i = 0; i < candidateFunction.types.length; i++) {
      let type = candidateFunction.types[i];
      const condition = candidateFunction.conditions[i];
      const specificity = "specificities" in candidateFunction ? candidateFunction.specificities[i] : 1;
      let [typeScore, gt] = typeSatisfaction(
        args[i].type,
        type,
        genericTable,
        0,
        args[i]
      );
      genericTable = { ...genericTable, ...gt };
      if (typeScore === 0) {
        const path = ctx2.pathBetween(args[i].type, type);
        if (path.length === 0) {
          score = -1;
          break;
        }
        tempArgs[i] = morphTypes(args[i], createTypeVar(type), ctx2);
        typeScore = Math.pow(0.5, path.length - 1);
      }
      const intScore = typeScore * (condition(tempArgs[i], ctx2) ? 1 : 0) * specificity;
      if (intScore === 0) {
        score = -1;
        break;
      }
      score += intScore;
    }
    if (score >= bestScore) {
      bestScore = score;
      bestCandidate = candidateFunction;
      modifiedArgs = tempArgs;
      usedGenericTable = genericTable;
    }
    ctx2.exitScope();
  }
  if (bestScore / modifiedArgs.length < 0.25) {
    if (modifiedArgs.every((entry) => entry.type.baseName === "TUPLE")) {
      const tupleSize = modifiedArgs[0].value.length;
      if (modifiedArgs.every((arg) => arg.value.length === tupleSize)) {
        const result2 = [];
        assignGenericTableToTypeVars(ctx2, usedGenericTable);
        for (let i = 0; i < tupleSize; i++) {
          result2.push(
            callFunctionByReference(
              ref,
              modifiedArgs.map((arg) => arg.value[i]),
              ctx2,
              name
            )
          );
        }
        unassignGenericTableToTypeVars(ctx2, usedGenericTable);
        if (result2.every((elem) => elem.type.baseName !== "ERROR")) {
          return createVar(result2, args[0].type);
        }
      }
    }
  }
  if (bestScore <= 0) {
    return noPatternMatch(name);
  }
  assignGenericTableToTypeVars(ctx2, usedGenericTable);
  if (ctx2.useCallStack) {
    enterFunction(name);
  }
  const result = bestCandidate.function(modifiedArgs, ctx2);
  if (ctx2.useCallStack) {
    exitFunction();
  }
  unassignGenericTableToTypeVars(ctx2, usedGenericTable);
  return result;
}
function dispatchFunction(fnName, args) {
  let named = ctx.getOrNull(fnName);
  if (!named) {
    const booleanName = ctx.getOrNull(fnName + "?");
    const assertionName = ctx.getOrNull(fnName + "!");
    if (booleanName && assertionName) {
      return createError(
        "Ambiguous conversion from " + fnName + " to " + fnName + "? and " + fnName + "! found."
      );
    }
    if (!booleanName && !assertionName) {
      return unknownFunctionError(fnName);
    }
    named = booleanName ?? assertionName;
  }
  if (!isAlias(named.type) || named.type.alias !== "FUNCTION") {
    return named;
  }
  return callFunctionByReference(named, args, ctx, fnName);
}
function evaluate(realNode, skipVarLookup, ignoreExpressions) {
  if (realNode.type.baseName === "EXPRESSION" && unknownVariablesInExpression(realNode.value).missing.length > 0) {
    return realNode;
  }
  if (aliasMatches(realNode.type, "MULTI_EXPRESSION")) {
    let assignmentArgs = { missing: [], assignments: [] };
    for (const line of realNode.value) {
      unknownVariablesInExpressionRec(line, assignmentArgs);
      if (assignmentArgs.missing.length > 0) {
        return realNode;
      }
      assignmentArgs = { assignments: assignmentArgs.assignments, missing: [] };
    }
  }
  while (!ignoreExpressions && realNode.type.baseName === "EXPRESSION") {
    realNode = realNode.value;
  }
  if (aliasMatches(realNode.type, "MULTI_EXPRESSION")) {
    let interimValue;
    for (const line of realNode.value) {
      interimValue = evaluate(line, skipVarLookup, ignoreExpressions);
    }
    return interimValue;
  }
  if (aliasMatches(realNode.type, "CALL")) {
    const [name, args] = getFunctionNameAndArgs(realNode);
    const isAssignment = name === "=";
    if (name === "?") {
      return earlyReturnTernary(args);
    } else if (name === "&") {
      return earlyReturnAnd(args);
    } else if (name === "|") {
      return earlyReturnOr(args);
    }
    return dispatchFunction(
      name,
      args.map((arg, index) => evaluate(arg, isAssignment && index === 0))
    );
  }
  if (aliasMatches(realNode.type, "CONCRETE_CALL")) {
    const [fn, args] = getFunctionObjectAndArgs(realNode);
    return callFunctionByReference(
      fn,
      args.map((arg) => evaluate(arg)),
      ctx,
      "lambda"
    );
  }
  if (realNode.type.baseName === "VARIABLE" && !skipVarLookup) {
    const varName = realNode.value;
    if (ctx.hasVariable(varName)) {
      return ctx.getOrNull(varName);
    }
  }
  if (Array.isArray(realNode.value) && !aliasMatches(realNode.type, "CONDITION") && !aliasMatches(realNode.type, "PATTERN") && !aliasMatches(realNode.type, "SIGNATURE") && !aliasMatches(realNode.type, "FUNCTION") && realNode.type.baseName !== "EXPRESSION") {
    return createVar(
      realNode.value.map((item) => evaluate(item, skipVarLookup, true)),
      realNode.type
    );
  }
  return realNode;
}
function unknownVariablesInExpression(expr) {
  const foundVars = { missing: [], assignments: [] };
  unknownVariablesInExpressionRec(expr, foundVars);
  return foundVars;
}
function unknownVariablesInExpressionRec(expr, table) {
  if (aliasMatches(expr.type, "FUNCTION")) {
    return;
  }
  if (aliasMatches(expr.type, "CALL")) {
    const [name, args] = getFunctionNameAndArgs(expr);
    if (name === "=") {
      table.assignments.push(args[0].value);
    }
  }
  if (expr.type.baseName === "VARIABLE" && !ctx.hasVariable(expr.value) && !table.assignments.includes(expr.value)) {
    table.missing.push(expr);
    return;
  }
  if (Array.isArray(expr.value)) {
    for (const child of expr.value) {
      unknownVariablesInExpressionRec(child, table);
    }
  }
  if (typeof expr.value === "object" && expr.value !== null && "value" in expr.value) {
    unknownVariablesInExpressionRec(expr.value, table);
  }
}
function recreateExpressionWithVariables(expr, mapping) {
  if (expr === null || expr.value === void 0) {
    return expr;
  }
  let newValue;
  if (aliasMatches(expr.type, "CALL")) {
    const [name, args] = getFunctionNameAndArgs(expr);
    const newArgs = args.map(
      (arg) => recreateExpressionWithVariables(arg, mapping)
    );
    if (name in mapping) {
      return createConcreteCall(mapping[name], newArgs);
    }
    return createCall(name, newArgs);
  } else if (Array.isArray(expr.value)) {
    newValue = createVar(
      expr.value.map((v) => recreateExpressionWithVariables(v, mapping)),
      expr.type
    );
    if ("invocations" in expr) {
      newValue.invocations = expr.invocations;
    }
    if ("arity" in expr) {
      newValue.arity = expr.arity;
    }
  } else {
    if (expr.type.baseName === "VARIABLE") {
      if (expr.value in mapping) {
        newValue = mapping[expr.value];
      }
    } else {
      return createVar(
        recreateExpressionWithVariables(expr.value, mapping),
        expr.type
      );
    }
  }
  if (newValue) {
    return newValue;
  }
  return expr;
}
function earlyReturnTernary(args) {
  const result = evaluate(args[0]);
  if (result.value) {
    return evaluate(args[1]);
  } else {
    return evaluate(args[2]);
  }
}
function earlyReturnAnd(args) {
  const firstResult = evaluate(args[0]);
  if (!firstResult.value) {
    return createVar(false, Primitives.BOOLEAN);
  }
  const secondResult = evaluate(args[1]);
  return createVar(firstResult.value && secondResult.value, Primitives.BOOLEAN);
}
function earlyReturnOr(args) {
  const firstResult = evaluate(args[0]);
  if (firstResult.value) {
    return createVar(true, Primitives.BOOLEAN);
  }
  const secondResult = evaluate(args[1]);
  return createVar(firstResult.value || secondResult.value, Primitives.BOOLEAN);
}
function parseToExpr(text) {
  const parsedTree = parse(text);
  return abstractNodeToRealNode(parsedTree);
}
function interpret(text) {
  if (lineShouldBeEvaluated(text)) {
    const realNode = parseToExpr(text);
    return evaluate(realNode);
  }
  return null;
}
registerBuiltins(ctx);
export {
  ERROR_CATCHING_FUNCTIONS,
  callFunctionByReference,
  ctx,
  dispatchFunction,
  earlyReturnAnd,
  earlyReturnOr,
  earlyReturnTernary,
  evaluate,
  interpret,
  parseToExpr,
  recreateExpressionWithVariables,
  unknownVariablesInExpression
};
