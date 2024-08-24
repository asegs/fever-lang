let currentFunctionPath = [];
let enteredStackTiming = [];
let encounteredSet: Set<string> = new Set();
export let callHistory: { [key: string]: number } = {};
export let callDurations: { [key: string]: number[] } = {};
export function enterFunction(name: string) {
  currentFunctionPath.push(name);
  encounteredSet.add(name);
  enteredStackTiming.push(getNsTime());
  trackCurrentCall();
}

export function exitFunction() {
  const fnName = currentFunctionPath.pop();
  const doneAt = getNsTime();
  if (!(fnName in callDurations)) {
    callDurations[fnName] = [];
  }
  callDurations[fnName].push(doneAt - enteredStackTiming.pop());
}
function callStackToPathString(): string {
  return currentFunctionPath.join(" ");
}

function trackCurrentCall() {
  const path = callStackToPathString();
  if (!(path in callHistory)) {
    callHistory[path] = 0;
  }
  callHistory[path]++;
}

export function orderedHistory() {
  return Object.entries(callHistory).sort((r1, r2) => r2[1] - r1[1]);
}

export function clear() {
  currentFunctionPath = [];
  callHistory = {};
  encounteredSet.clear();
  callDurations = {};
  enteredStackTiming = [];
}

export function totalContainingPercentage(keyword: string) {
  const hist = orderedHistory();
  let total = 0;
  let matches = 0;
  hist.forEach((record) => {
    const [path, count] = record;
    total += count;
    if (path.includes(keyword)) {
      matches += count;
    }
  });
  return matches / total;
}

export function totalCalls() {
  return orderedHistory()
    .map((r) => r[1])
    .reduce((acc, v) => acc + v, 0);
}

export function breakdown() {
  const totals = {};
  for (const fnName of encounteredSet) {
    totals[fnName] = totalContainingPercentage(fnName);
  }
  return totals;
}

export function timingBreakdown() {
  const totals = {};
  for (const fnName of encounteredSet) {
    totals[fnName] =
      callDurations[fnName].reduce((total, item) => total + item, 0) /
      callDurations[fnName].length;
  }
  return totals;
}
export function getNsTime() {
  const hrTime = process.hrtime();
  return hrTime[0] * 1000000 + hrTime[1] / 1000;
}
