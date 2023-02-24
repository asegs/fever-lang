export class Morphisms {
    constructor() {
        this.table = {};
        this.cache = {};
    }

    //Make from and true into string
    registerMorphism (morph)  {
        const signature = morph.value.signature;
        const from = signature.conditions[0];
        const to = signature.returned.value;

        if (!(from in this.table)) {
            this.table[from] = {}
        }

        this.table[from][to] = morph;
    }

    //Just track the type path, no need to generate composed functions.
    rebuildCaches () {

    }

    //We basically already have a graph, just add visited stat and children
    buildGraph () {

    }
}