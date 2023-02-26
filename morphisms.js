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

const example = {
    "BOOLEAN": {
        "INTEGER": "conv",
        "STRING": "conv",
        "LIST(BOOLEAN)": "conv",
        "CHARACTER": "conv"
    },
    "INTEGER": {
        "BOOLEAN": "conv",
        "STRING": "conv",
        "LIST(INTEGER)": "conv",
        "CHARACTER": "conv"
    }
}

const setDiff = (a, b) => {
    const c = new Set();
    a.forEach(e => c.add(e));
    b.forEach(e => c.delete(e));

    return c;
}

const pathBetween = (start, end, m) => {
    return pathBetweenRec(end, m, [start]);
}

const pathBetweenRec = (end, m, path) => {
    const pathEnd = path[path.length - 1];
    const keys = new Set((pathEnd in m) ? Object.keys(m[pathEnd]) : []);
    if (keys.has(end)) {
        return [...path, end];
    }

    const freshKeys = setDiff(keys, new Set(path));

    for (const key of freshKeys) {
        const result = pathBetweenRec(end, m, [...path, key]);
        if (result.length > 0) {
            return result;
        }
    }

    return [];
}

console.log(pathBetween("BOOLEAN", "LIST(INTEGER)", example))