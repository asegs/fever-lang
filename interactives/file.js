import * as path from "path";
import * as fs from "fs";
import {goals, interpret} from "../interpreter.js";

//Handle comments better later on
const lineShouldBeEvaluated = (line) => {
    return line.length > 0 && !line.startsWith("//");
}

export const file = (inputFile, vars, functions, morphisms) => {
    const inputPath = path.resolve(inputFile);
    if (!fs.existsSync(inputPath)) {
        console.error("No such input file: " + inputPath);
        process.exit(1);
    }
    const file = fs.readFileSync(inputPath,'utf8');
    file.split('\n').forEach((line, index) => {
        try {
            if (lineShouldBeEvaluated(line)) {
                interpret(line, vars, functions, morphisms, goals.EVALUATE);
            }
        } catch (e) {
            console.log("Error on line " + (index + 1) + ": " + e);
        }
    });
}