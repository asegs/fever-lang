import { FeverVar } from "./types";

export class Context {
  vars: object;

  constructor() {
    this.vars = {};
  }

  set(name: string, value: FeverVar) {
    this.vars[name] = value;
  }

  get(name: string): FeverVar {
    return this.vars[name];
  }

  exists(name: string): boolean {
    return name in this.vars;
  }
}
