import * as fs from 'fs';
import * as path from "path";

import {interpret} from "../internals/Interpreter.ts";


const BEHAVIOR_FILE_PATH = path.join(import.meta.dirname, "behavior.json");
const STATEMENTS_FILE_PATH = path.join(import.meta.dirname, "statements.json");
/*
Let the size of the generated file be a reminder to fix the recursive expansion problem of objects!
 */

function computeMultipleStatements(statements: string[]) {
    const behaviors = {};
    statements.forEach(statement => {
        const start = performance.now() * 1_000_000;
        console.log("Interpreting " + statement)
        const result = interpret(statement);
        const end = performance.now() * 1_000_000;
        behaviors[statement] = {
            statement: statement,
            result: result,
            time: end - start
        }
    });

    return behaviors;
}

function statementHasNotChanged(result, lookup) {
    const resultBody = JSON.stringify(result['result']);
    const statement = result['statement'];
    if (statement in lookup) {
        const lookedUpValue = JSON.stringify(lookup[statement]['result']);
        const matchesOldValue = lookedUpValue === resultBody;
        if (!matchesOldValue) {
            console.log(`Failure to match with statement: ${statement}`)
            console.log(`Previous value: ${lookedUpValue}`);
            console.log(`Current value: ${resultBody}`);
        }

        return matchesOldValue;
    }

    console.log(`We thought statement ${statement} was recorded, but it wasn't.`)
    return false;
}

function readBehaviorTable() {
    return JSON.parse(fs.readFileSync(BEHAVIOR_FILE_PATH, 'utf-8'));
}

function readStatements() {
    return JSON.parse(fs.readFileSync(STATEMENTS_FILE_PATH, 'utf-8'))
}

export function addNewStatementsAndTest() {
    const statements = readStatements()['statements'];
    const behavior = readBehaviorTable();
    const statementResults = computeMultipleStatements(statements);
    const previouslyTestedResults = [];
    for (const result in statementResults) {
        if (result['statement'] in behavior) {
            previouslyTestedResults.push(result)
        } else {
            break;
        }
    }
    const regressedStatements = previouslyTestedResults.filter(result => !statementHasNotChanged(result, behavior)).map(result => result['statement']);

    if (regressedStatements.length > 0) {
        console.log("Cannot complete, a regression has occurred.")
        console.log(regressedStatements);
        return regressedStatements;
    }

    // Do all, so we can use variable assignments later.

    fs.writeFileSync(BEHAVIOR_FILE_PATH, JSON.stringify(statementResults, null, 2));

    return regressedStatements;
}

export function testAllStatements() {
    const statements = readStatements()['statements'];
    const behavior = readBehaviorTable();

    const results = computeMultipleStatements(statements);

    const regressedStatements = Object.values(results).filter(result => !statementHasNotChanged(result, behavior)).map(result => result['statement']);

    if (regressedStatements.length > 0) {
        console.log("Cannot complete, a regression has occurred.")
        console.log(regressedStatements);
        return regressedStatements;
    }

    return [];
}

