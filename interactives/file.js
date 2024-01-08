import * as path from "path";
import * as fs from "fs";
import {goals, interpret} from "../interpreter.js";

//Handle comments better later on
const lineShouldBeEvaluated = (line) => {
    return line.length > 0 && !line.startsWith("//");
}

const file = (inputPath, vars, morphisms) => {
    if (!fs.existsSync(inputPath)) {
        console.error("No such input file: " + inputPath);
        process.exit(1);
    }
    const file = fs.readFileSync(inputPath,'utf8');
    file.split('\n').forEach((line, index) => {
        try {
            if (lineShouldBeEvaluated(line)) {
                interpret(line, vars, morphisms);
            }
        } catch (e) {
            console.log("Error on line " + (index + 1) + ": " + (e.stack ? e.stack : e));
        }
    });
}

export const internalFile = (inputFile, vars, morphisms) => {
    let dirPath = import.meta.url;
    dirPath = dirPath.slice(7, dirPath.length - 7);
    const inputPath = path.resolve(dirPath + inputFile);
    file(inputPath, vars, morphisms);
}

export const externalFile = (inputFile, vars, morphisms) => {
    file(inputFile, vars, morphisms);
}