const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(appScript, 'index.html must contain the application script');

function createAppHarness() {
  const elements = new Map();
  const values = new Map();
  const makeElement = () => ({
    style: {},
    classList: { add() {}, remove() {} },
    addEventListener() {},
    querySelectorAll() { return []; },
    reset() {},
    textContent: '',
    innerHTML: '',
    value: ''
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelector() { return makeElement(); }
  };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
  const context = vm.createContext({
    document,
    localStorage,
    structuredClone(value) { return structuredClone(value); },
    setTimeout() { return 1; },
    clearTimeout() {}
  });
  new vm.Script(appScript, { filename: 'index.html' }).runInContext(context);
  return {
    document,
    run(source) { return vm.runInContext(source, context); }
  };
}

test('sample dates are relative to the current day', () => {
  const app = createAppHarness();
  const dates = JSON.parse(app.run(`JSON.stringify({
    today: dateKey(today),
    taskOffsets: data.tasks.map(task => Math.round((new Date(task.due + 'T00:00:00') - today) / 86400000)),
    sessionOffsets: data.sessions.map(session => Math.round((new Date(session.day + 'T00:00:00') - today) / 86400000))
  })`));

  assert.deepEqual(dates.taskOffsets, [5, 2, 7]);
  assert.deepEqual(dates.sessionOffsets, [0, 1, 2]);
  assert.equal(app.document.getElementById('miniMonth').textContent, `${new Date().getFullYear()}年 ${new Date().getMonth() + 1}月`);
});

test('running automatic scheduling repeatedly does not duplicate sessions', () => {
  const app = createAppHarness();
  const counts = () => JSON.parse(app.run(`JSON.stringify(Object.fromEntries(data.tasks.map(task => [
    task.id,
    data.sessions.filter(session => session.taskId === task.id && !session.done).length
  ])))`));

  app.run('createSchedule()');
  const firstRun = counts();
  app.run('createSchedule()');

  assert.deepEqual(counts(), firstRun);
});

test('toggling a study session done and undone restores remaining effort', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const session = data.sessions[0];
    const task = data.tasks.find(item => item.id === session.taskId);
    const initial = task.remaining;
    toggleSession(session.id);
    const afterDone = task.remaining;
    toggleSession(session.id);
    return JSON.stringify({ initial, afterDone, afterUndo: task.remaining, done: session.done });
  })()`));

  assert.equal(result.afterDone, result.initial - 1);
  assert.equal(result.afterUndo, result.initial);
  assert.equal(result.done, false);
});

test('rerouting preserves completed sessions and creates no duplicate active time', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    createSchedule();
    const session = data.sessions.find(item => item.day > dateKey(today) && !item.done);
    toggleSession(session.id);
    const completedId = session.id;
    createSchedule({ reroute: true });
    const activeHours = taskId => data.sessions.filter(item => item.taskId === taskId && !item.done && item.day >= dateKey(today)).reduce((sum, item) => sum + durationHours(item.start, item.end), 0);
    return JSON.stringify({
      completedPreserved: data.sessions.some(item => item.id === completedId && item.done),
      activeTimeWithinRemaining: data.tasks.filter(task => !task.done).every(task => activeHours(task.id) <= task.remaining)
    });
  })()`));

  assert.equal(result.completedPreserved, true);
  assert.equal(result.activeTimeWithinRemaining, true);
});
