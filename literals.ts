import {
  createCall,
  createList,
  createPatternFromString,
  createTuple,
  createTypedList,
  createTypeVar,
  createVar,
  FeverType,
  FeverVar,
  Meta,
  Primitives,
  typeAssignableFrom,
} from "./types.ts";
import { ParseNode, ParseNodeType, trimAndSplitOnCommas } from "./parser";
import { ctx } from "./interpreter.ts";

function everyCharNumeric(text: string): boolean {
  return (
    text.match(/^-?[0-9]+$/g) !== null ||
    text.match(/^-?[0-9]+\.[0-9]+$/g) !== null
  );
}

function isStringLiteral(text: string): boolean {
  return text.match(/^".+"$/g) !== null || text.match(/^'.+'$/g) !== null;
}

function isWord(text: string): boolean {
  return (
    text.match(/^[a-zA-z]$/g) !== null ||
    text.match(/^[a-zA-Z][a-zA-Z0-9]+$/g) !== null
  );
}

function wordIsBoolean(text: string): boolean {
  return text === "true" || text === "false";
}

function isList(text: string): boolean {
  return text.match(/^\[.+]$/g) !== null;
}

function isTuple(text: string): boolean {
  if (!isExpression(text)) {
    return false;
  }

  return trimAndSplitOnCommas(text).length > 1;
}

function isExpression(text: string): boolean {
  return text.match(/^\(.+\)$/g) !== null;
}

function isSignature(text: string): boolean {
  return text.match(/^{.+}$/g) !== null;
}

function getAsTypeVar(text: string): FeverVar | null {
  const tName = text.toUpperCase();
  if (tName in Primitives) {
    return createTypeVar(Primitives[tName]);
  }

  if (tName in Meta) {
    return createTypeVar(Meta[tName]);
  }

  return null;
}

const recursiveTypeMatch = new RegExp(/^(list|tuple)\[(.*)]$/m);

export function maybeVarFromLiteral(parent: ParseNode): FeverVar | null {
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
  const asTypeVar = getAsTypeVar(parentText);
  if (asTypeVar) {
    return asTypeVar;
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
  }
}

export function abstractNodeToRealNode(parent: ParseNode): FeverVar {
  const maybeVar = maybeVarFromLiteral(parent);
  if (maybeVar) {
    return maybeVar;
  } else {
    const realChildren = parent.children.map(abstractNodeToRealNode);
    switch (parent.type) {
      case ParseNodeType.FUNCTION_CALL:
        return createCall(parent.text, realChildren);
      case ParseNodeType.LIST:
        return createList(realChildren);
      case ParseNodeType.TUPLE:
        if (realChildren.length > 1) {
          return createTuple(realChildren);
        } else {
          return createVar(realChildren[0], Primitives.EXPRESSION);
        }

      case ParseNodeType.SIGNATURE:
        const takenVars: Set<string> = new Set();
        const signatureItems = [];
        for (let i = 0; i < realChildren.length; i++) {
          const [pattern, varName] = createPatternFromString(
            realChildren[i].value,
            ctx,
            takenVars,
          );
          if (varName !== null) {
            takenVars.add(varName);
          }
          signatureItems.push(pattern);
        }
        return createVar(signatureItems, Meta.SIGNATURE);
      default:
        return createVar(parent.text, Primitives.VARIABLE);
    }
  }
}

export function feverStringFromJsString(jsString) {
  return createVar(
    jsString.split("").map((char) => createVar(char, Primitives.CHARACTER)),
    Meta.STRING,
  );
}

export function inferListType(items: FeverVar[], optionalAlias?: string) {
  if (items.length > 0) {
    const first = items[0];
    if (items.every((i) => typeAssignableFrom(i.type, first.type))) {
      return createTypedList(first.type, optionalAlias);
    }
  }
  return Meta.LIST;
}
