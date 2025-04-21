import { callFunction, goals, instance, interpret } from "../interpreter.js";
import { charListToJsString, primitives } from "../types.js";

const [variables, morphisms] = instance();

const history = [];
let historyIndex = 0;
const interpretInBrowser = (text) => {
  const resultsDiv = document.getElementById("results");

  const inputPara = document.createElement("p");
  const inputNode = document.createTextNode("> " + text);
  inputPara.style.color = "grey";
  inputPara.style.fontSize = "24px";
  inputPara.appendChild(inputNode);
  resultsDiv.appendChild(inputPara);
  if (history[history.length - 1] !== text) {
    history.push(text);
    historyIndex++;
  }
  let output;

  const result = interpret(text, variables, morphisms, goals.EVALUATE);
  if (result.type === primitives.ERROR) {
    output = result.value;
  } else {
    output = charListToJsString(
      callFunction("stringify", [result], variables, morphisms),
    );
  }

  const outputPara = document.createElement("p");
  const outputNode = document.createTextNode(output);
  outputPara.style.color = "white";
  outputPara.style.fontSize = "24px";
  outputPara.appendChild(outputNode);

  resultsDiv.appendChild(inputPara);
  resultsDiv.appendChild(outputPara);

  document.getElementById("line").value = "";
  scrollToBottom("terminal");
};

window.interpretInBrowser = interpretInBrowser;

const input = document.getElementById("line");
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    interpretInBrowser(input.value);
    historyIndex = history.length;
  }

  let switchHappened = false;

  if (event.key === "ArrowUp") {
    if (historyIndex > 0) {
      historyIndex--;
      switchHappened = true;
    }
  }

  if (event.key === "ArrowDown") {
    if (historyIndex < history.length) {
      historyIndex++;
      switchHappened = true;
    }
  }

  if (switchHappened) {
    if (historyIndex === history.length) {
      input.value = "";
    } else {
      input.value = history[historyIndex];
    }
  }
});
input.focus();
input.onblur = () => {
  setTimeout(() => {
    input.focus();
  }, 1);
};
const scrollToBottom = (id) => {
  const element = document.getElementById(id);
  element.scrollTop = element.scrollHeight;
};
