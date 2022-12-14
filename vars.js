export class ScopedVars {
    constructor() {
        this.scopes = [{}];
        this.depth = 0;
    }

    enterScope () {
        this.depth ++;
        this.scopes.push({});
    }

    exitScope () {
        this.depth --;
        this.scopes.pop();
    }

    assignValue (name, value) {
        this.scopes[this.depth][name] = value;
    }

    assignVariableUpScope (name, value) {
        this.scopes.forEach(scope => scope[name] = value);
    }

    hasVariable (name) {
        for (let i = this.scopes.length - 1 ; i >= 0 ; i -- ) {
            const scope = this.scopes[i];
            if (name in scope) {
                return true;
            }
        }
        return false;
    }

    lookupValue (name) {
        for (let i = this.scopes.length - 1 ; i >= 0 ; i -- ) {
            const scope = this.scopes[i];
            if (name in scope) {
                return scope[name];
            }
        }
        throw "Unknown variable";
    }

    flattenToMap () {
        let vars = {};
        for (let i = 0 ; i < this.scopes.length; i ++ ) {
            vars = {...vars, ...this.scopes[i]}
        }
        return vars;
    }

    mergeHere (map) {
        for (const [key,value] of Object.entries(map)) {
            this.scopes[this.depth][key] = value;
        }
    }
}