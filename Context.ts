import { FeverType, FeverVar } from "./types.ts";
import { typeToString } from "./lib/StringUtils.js";

export class Context {
  scopes: { [key: string]: FeverVar }[];
  useCallStack: boolean;
  depth: number;
  morphisms: {};
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
  assignValue(name: string, value: FeverVar) {
    this.scopes[this.depth][name] = value;
  }

  globalAssignValue(name: string, value: FeverVar) {
    this.scopes[0][name] = value;
  }

  deleteValue(name: string) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        delete this.scopes[i][name];
        return;
      }
    }
  }

  hasVariable(name: string): boolean {
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

  lookupValue(name: string): FeverVar {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        return this.scopes[i][name];
      }
    }
    throw "Unknown variable";
  }

  getOrNull(name: string): FeverVar | null {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        return this.scopes[i][name];
      }
    }

    return null;
  }

  hasVariableInScope(name: string): boolean {
    return name in this.scopes[this.scopes.length - 1];
  }

  lookupValueInScope(name: string): FeverVar {
    if (name in this.scopes[this.scopes.length - 1]) {
      return this.scopes[this.scopes.length - 1][name];
    }

    throw "Unknown variable";
  }

  flattenToMap(): { [key: string]: FeverVar } {
    let vars = {};
    for (let i = 0; i < this.scopes.length; i++) {
      vars = { ...vars, ...this.scopes[i] };
    }
    return vars;
  }

  registerMorphism(from: FeverType, to: FeverType, by: FeverVar) {
    const fromName = typeToString(from);
    const toName = typeToString(to);
    if (!(fromName in this.morphisms)) {
      this.morphisms[fromName] = {};
    }

    this.morphisms[fromName][toName] = by;
  }

  setDiff(a, b): Set<any> {
    const c = new Set();
    a.forEach((e) => c.add(e));
    b.forEach((e) => c.delete(e));

    return c;
  }

  pathBetweenRec(end: string, path: string[]): string[] {
    const pathEnd = path[path.length - 1];
    const keys = new Set(
      pathEnd in this.morphisms ? Object.keys(this.morphisms[pathEnd]) : [],
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

  pathBetween(start: FeverType, end: FeverType): string[] {
    return this.pathBetweenRec(typeToString(end), [typeToString(start)]);
  }
}
