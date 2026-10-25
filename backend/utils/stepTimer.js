// Cheap per-request step timer. `mark(label)` records the time since the
// previous mark; `report()` returns one log line such as
// "auth=40ms reads=95ms insert=60ms total=410ms".
function createStepTimer() {
  const start = process.hrtime.bigint();
  let last = start;
  const steps = [];

  const ms = (from, to) => Math.round(Number(to - from) / 1e6);

  return {
    mark(label) {
      const now = process.hrtime.bigint();
      steps.push(`${label}=${ms(last, now)}ms`);
      last = now;
    },
    report() {
      return [...steps, `total=${ms(start, process.hrtime.bigint())}ms`].join(" ");
    },
  };
}

module.exports = { createStepTimer };
