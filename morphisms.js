import { typeToString } from "./builtins.js";

export class Morphisms {
  constructor() {
    this.table = {};
    this.cache = {};
  }

  //Make from and true into string
  registerMorphism(fromType, toType, func) {
    const fromName = typeToString(fromType);
    const toName = typeToString(toType);
    if (!(fromName in this.table)) {
      this.table[fromName] = {};
    }
    this.table[fromName][toName] = func;
  }

  //Just track the type path, no need to generate composed functions.
  rebuildCaches() {}

  //We basically already have a graph, just add visited stat and children
  buildGraph() {}

  setDiff(a, b) {
    const c = new Set();
    a.forEach((e) => c.add(e));
    b.forEach((e) => c.delete(e));

    return c;
  }

  pathBetweenRec(end, m, path) {
    const pathEnd = path[path.length - 1];
    const keys = new Set(pathEnd in m ? Object.keys(m[pathEnd]) : []);
    if (keys.has(end)) {
      return [...path, end];
    }

    const freshKeys = this.setDiff(keys, new Set(path));

    for (const key of freshKeys) {
      const result = this.pathBetweenRec(end, m, [...path, key]);
      if (result.length > 0) {
        return result;
      }
    }

    return [];
  }

  pathBetween(start, end) {
    return this.pathBetweenRec(typeToString(end), this.table, [
      typeToString(start),
    ]);
  }
}
