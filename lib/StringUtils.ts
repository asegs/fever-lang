import {
  createVar,
  FeverType,
  FeverVar,
  isAlias,
  Meta,
  Primitives,
} from "../middleware/Types";

export function typeToString(t: FeverType): string {
  return typeToStringRec(t, "");
}

export function typeToStringRec(t, contents) {
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

export function feverStringFromJsString(jsString: string): FeverVar {
  return createVar(
    jsString.split("").map((char) => createVar(char, Primitives.CHARACTER)),
    Meta.STRING,
  );
}

export function lineShouldBeEvaluated (line: string) {
  const trimmedLine = line.trim();
  return trimmedLine.length > 0 && !trimmedLine.startsWith("//");
};
