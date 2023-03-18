import {ScopedVars} from "../vars.js";
import {Morphisms} from "../morphisms.js";
import {builtins} from "../builtins.js";
import {goals, interpret} from "../interpreter.js";

const variables = new ScopedVars();
const morphisms = new Morphisms();
const functions = builtins;
const results = [];

window.variables = variables;
window.morphisms = morphisms;
window.functions = functions;
window.results = results;

const interpretInBrowser = (text) => {
    const resultsDiv = document.getElementById("results");

    const inputPara = document.createElement("p");
    const inputNode = document.createTextNode(">" + text);
    inputPara.style.color = "grey";
    inputPara.appendChild(inputNode);
    resultsDiv.appendChild(inputPara);
    results.push(">" + text);
    let output;

    try {
        const result = interpret(text, variables, functions, morphisms, goals.EVALUATE);
        output = functions['stringify'][0]['function']([result]).value;

    } catch (e) {
        output = e;
    }
    results.push(output);

    const outputPara = document.createElement("p");
    const outputNode = document.createTextNode(output);
    outputPara.style.color = "white";
    outputPara.appendChild(outputNode);

    resultsDiv.appendChild(inputPara);
    resultsDiv.appendChild(outputPara);

    document.getElementById("line").value = "";
    scrollToBottom("results");

}

window.interpretInBrowser = interpretInBrowser;

const input = document.getElementById("line");
input.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        interpretInBrowser(input.value);
    }
});

const scrollToBottom = (id) => {
    const element = document.getElementById(id);
    element.scrollTop = element.scrollHeight;
}