import { FeverVar } from "./types";

export class Context {
  scopes: { [key: string]: FeverVar }[];
  depth: number;
  morphisms: {};
  constructor() {
    this.scopes = [{}];
    this.depth = 0;
    this.morphisms = {};
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
}
