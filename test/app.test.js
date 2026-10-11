const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appScripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), match => match[1]);
assert.ok(appScripts.length, 'index.html must contain the application script');

function createAppHarness(values = new Map()) {
  const elements = new Map();
  const makeElement = () => ({
    style: {},
    classList: { add() {}, remove() {} },
    listeners: new Map(),
    formValues: {},
    addEventListener(name, listener, options = {}) {
      const handlers = this.listeners.get(name) || [];
      handlers.push({ listener, capture: options === true || Boolean(options.capture) });
      this.listeners.set(name, handlers);
    },
    dispatch(name, event) {
      const handlers = this.listeners.get(name) || [];
      const ordered = [...handlers.filter(handler => handler.capture), ...handlers.filter(handler => !handler.capture)];
      for (const handler of ordered) {
        handler.listener(event);
        if (event.immediateStopped) break;
      }
    },
    insertAdjacentHTML() {},
    parentElement: { hidden: false, insertAdjacentHTML() {} },
    querySelectorAll() { return []; },
    reset() {},
    focus() {},
    textContent: '',
    innerHTML: '',
    value: ''
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelector(selector) {
      const key = `selector:${selector}`;
      if (!elements.has(key)) elements.set(key, makeElement());
      return elements.get(key);
    }
  };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
  class FormDataStub {
    constructor(form) { this.values = form.formValues; }
    get(name) { return this.values[name] ?? null; }
  }
  const context = vm.createContext({
    document,
    localStorage,
    FormData: FormDataStub,
    structuredClone(value) { return structuredClone(value); },
    setTimeout() { return 1; },
    clearTimeout() {}
  });
  for (const [index, script] of appScripts.entries()) new vm.Script(script, { filename: `index.html#script-${index + 1}` }).runInContext(context);
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
  assert.equal(app.document.querySelector('.mini-calendar .section-label').textContent, `${new Date().getFullYear()}年 ${new Date().getMonth() + 1}月`);
});

test('one-off event submitted in the form persists and appears after reload', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const date = app.run('dateKey(today)');
  const repeatSelect = app.document.getElementById('eventRepeat');
  repeatSelect.value = 'once';
  const form = app.document.getElementById('eventForm');
  form.formValues = { name: '図書館でレポート', type: 'personal', oneOffDate: date, start: '15:00', end: '16:00' };
  const event = {
    currentTarget: form,
    defaultPrevented: false,
    immediateStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.immediateStopped = true; }
  };

  form.dispatch('submit', event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(JSON.parse(storage.get('michi-planner-v1')).extras[0].day, date);
  const reloadedApp = createAppHarness(storage);
  const calendarMarkup = reloadedApp.document.getElementById('calendarGrid').innerHTML;

  assert.match(calendarMarkup, /図書館でレポート/);
  assert.match(calendarMarkup, /15:00 – 16:00/);
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
