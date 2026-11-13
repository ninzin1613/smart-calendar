const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appScripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), match => match[1]);
const reviewScript = fs.readFileSync(path.join(__dirname, '..', 'weekly-review.js'), 'utf8');
const studyPlanningScript = fs.readFileSync(path.join(__dirname, '..', 'study-planning.js'), 'utf8');
const spareTimeScript = fs.readFileSync(path.join(__dirname, '..', 'spare-time.js'), 'utf8');
const dashboardEnhancementsScript = fs.readFileSync(path.join(__dirname, '..', 'dashboard-enhancements.js'), 'utf8');
const quickInputScript = fs.readFileSync(path.join(__dirname, '..', 'quick-input.js'), 'utf8');
assert.match(html, /<script src="\.\/weekly-review\.js"><\/script>/, 'index.html must load the weekly review script');
assert.match(html, /<script src="\.\/study-planning\.js"><\/script>/, 'index.html must load the study planning script');
assert.match(html, /<script src="\.\/spare-time\.js"><\/script>/, 'index.html must load the spare-time suggestion script');
assert.match(html, /<script src="\.\/dashboard-enhancements\.js\?v=20261113"><\/script>/, 'index.html must load the current dashboard enhancements');
assert.match(html, /<script src="\.\/quick-input\.js"><\/script>/, 'index.html must load quick input support');
assert.ok(appScripts.length, 'index.html must contain the application script');

function createAppHarness(values = new Map(), browserFeatures = {}) {
  const elements = new Map();
  const makeElement = () => ({
    style: {},
    classList: {
      added: [],
      add(value) { this.added.push(value); },
      remove(value) { this.added = this.added.filter(item => item !== value); }
    },
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) || null; },
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
    appendChild() {},
    parentElement: { hidden: false, insertAdjacentHTML() {} },
    querySelectorAll() { return []; },
    reset() {},
    focus() {},
    click() { this.clicked = true; this.dispatch('click', { currentTarget: this }); },
    textContent: '',
    innerHTML: '',
    value: ''
  });
  const document = {
    body: makeElement(),
    head: { appendChild() {} },
    createElement() { return makeElement(); },
    querySelectorAll() { return []; },
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
    setInterval() { return 1; },
    clearTimeout() {},
    ...browserFeatures
  });
  for (const [index, script] of appScripts.entries()) new vm.Script(script, { filename: `index.html#script-${index + 1}` }).runInContext(context);
  new vm.Script(reviewScript, { filename: 'weekly-review.js' }).runInContext(context);
  new vm.Script(studyPlanningScript, { filename: 'study-planning.js' }).runInContext(context);
  new vm.Script(spareTimeScript, { filename: 'spare-time.js' }).runInContext(context);
  new vm.Script(dashboardEnhancementsScript, { filename: 'dashboard-enhancements.js' }).runInContext(context);
  new vm.Script(quickInputScript, { filename: 'quick-input.js' }).runInContext(context);
  return {
    document,
    run(source) { return vm.runInContext(source, context); }
  };
}

function createMemoryImageDatabase() {
  const records = new Map();
  const database = {
    objectStoreNames: { contains() { return true; } },
    close() {},
    transaction() {
      const transaction = {
        objectStore() {
          return {
            put(record, key) {
              records.set(key, record);
              queueMicrotask(() => transaction.oncomplete?.());
            },
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = records.get(key);
                request.onsuccess?.();
              });
              return request;
            }
          };
        }
      };
      return transaction;
    }
  };
  return {
    records,
    indexedDB: {
      open() {
        const request = { result: database };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      }
    }
  };
}

test('sample dates are relative to the current day', () => {
  assert.doesNotMatch(html, /class="brand-sub"/);
  assert.doesNotMatch(html, /class="crumb"/);
  assert.doesNotMatch(html, /class="free-badge"/);
  assert.doesNotMatch(html, /getElementById\('freeBadge'\)/);

  const app = createAppHarness();
  const dates = JSON.parse(app.run(`JSON.stringify({
    today: dateKey(today),
    taskOffsets: data.tasks.map(task => Math.round((new Date(task.due + 'T00:00:00') - today) / 86400000)),
    sessionOffsets: data.sessions.map(session => Math.round((new Date(session.day + 'T00:00:00') - today) / 86400000))
  })`));

  assert.deepEqual(dates.taskOffsets, [5, 2, 7]);
  assert.deepEqual(dates.sessionOffsets, [0, 1, 2]);
  assert.match(app.document.querySelector('.mini-calendar .section-label').innerHTML, new RegExp(`${new Date().getFullYear()}&#x5E74; ${new Date().getMonth() + 1}&#x6708;`));
});

test('mini calendar arrows navigate between months and preserve the weekday order', () => {
  const app = createAppHarness();
  const originalMonth = app.run('`${miniMonth.getFullYear()}-${miniMonth.getMonth() + 1}`');

  app.run('shiftMiniMonth(1)');
  assert.equal(app.run('`${miniMonth.getFullYear()}-${miniMonth.getMonth() + 1}`'), (() => {
    const [year, month] = originalMonth.split('-').map(Number);
    return month === 12 ? `${year + 1}-1` : `${year}-${month + 1}`;
  })());
  assert.match(app.document.querySelector('.mini-calendar .section-label').innerHTML, /id="nextMiniMonth"/);
  assert.ok(app.document.getElementById('miniGrid').innerHTML.match(/<(?:span|button)\b/g).length >= 35);

  app.run('shiftMiniMonth(-1)');
  assert.equal(app.run('`${miniMonth.getFullYear()}-${miniMonth.getMonth() + 1}`'), originalMonth);
  assert.deepEqual(JSON.parse(app.run('JSON.stringify(weekNames)')), ['日', '月', '火', '水', '木', '金', '土']);
});

test('mini calendar marks today in red and selecting a date shows that day', () => {
  const app = createAppHarness();
  const styles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
  const todayKey = app.run('dateKey(today)');
  const todayButton = new RegExp(`<button type="button" class=" today selected" data-mini-date="${todayKey}"`);

  assert.match(styles, /\.mini-grid \.today\s*\{[^}]*background:\s*var\(--coral\)/);
  assert.match(styles, /\.mini-grid \.selected:not\(\.today\)\s*\{[^}]*background:\s*var\(--ink\);[^}]*color:\s*white/);
  assert.match(app.document.getElementById('miniGrid').innerHTML, todayButton);

  app.run("miniMonth = new Date('2026-10-01T00:00:00'); renderMiniCalendar(); selectCalendarDate('2026-10-28')");
  const selected = JSON.parse(app.run(`JSON.stringify({
    selectedDate: dateKey(selectedDate),
    dayMode,
    renderedDays: [...document.getElementById('calendarGrid').innerHTML.matchAll(/data-day="([^"]+)"/g)].map(match => match[1]),
    dayButton: document.getElementById('miniGrid').innerHTML.includes('data-mini-date="2026-10-28"')
  })`));

  assert.equal(selected.selectedDate, '2026-10-28');
  assert.equal(selected.dayMode, true);
  assert.deepEqual(selected.renderedDays, ['2026-10-28']);
  assert.equal(selected.dayButton, true);
  assert.match(app.document.getElementById('calendarGrid').innerHTML, /data-day="2026-10-28"/);
});

test('today and current-week buttons return to their respective views', () => {
  const styles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
  const miniCalendar = html.indexOf('<div class="side-section mini-calendar">');
  const miniGrid = html.indexOf('<div class="mini-grid" id="miniGrid"></div>', miniCalendar);
  const returnButtons = html.indexOf('<div class="calendar-return-actions">', miniGrid);
  const calendarLegend = html.indexOf('予定の種類', miniGrid);
  assert.match(styles, /\.calendar-return-actions\s*\{\s*display:\s*flex;/);
  assert.match(styles, /\.calendar-return-actions \.secondary-btn\s*\{[^}]*flex:\s*1;[^}]*height:\s*28px;[^}]*font-size:\s*10px/);
  assert.ok(miniCalendar >= 0 && miniGrid > miniCalendar && returnButtons > miniGrid && returnButtons < calendarLegend, 'return buttons should appear directly after the mini calendar');
  assert.ok(html.indexOf('id="todayBtn"') > returnButtons);
  assert.ok(html.indexOf('id="weekBtn"') > returnButtons);
  assert.match(html, /id="todayBtn">&#x4ECA;&#x65E5;&#x306B;&#x623B;&#x308B;<\/button>/);
  assert.match(html, /id="weekBtn">&#x4ECA;&#x9031;&#x306B;&#x623B;&#x308B;<\/button>/);

  const app = createAppHarness();
  const todayKey = app.run('dateKey(today)');
  const todayButton = app.document.getElementById('todayBtn');
  const weekButton = app.document.getElementById('weekBtn');

  app.run("selectCalendarDate('2026-10-28')");
  todayButton.dispatch('click', {});
  assert.equal(app.run('dayMode'), true);
  assert.deepEqual(JSON.parse(app.run('JSON.stringify([...document.getElementById("calendarGrid").innerHTML.matchAll(/data-day="([^"]+)"/g)].map(match => match[1]))')), [todayKey]);

  app.run("selectCalendarDate('2026-10-28')");
  weekButton.dispatch('click', {});
  const currentWeek = JSON.parse(app.run(`JSON.stringify({
    dayMode,
    weekStart: dateKey(weekStart),
    todayWeekStart: dateKey(startOfWeek(today)),
    days: [...document.getElementById('calendarGrid').innerHTML.matchAll(/data-day="([^"]+)"/g)].map(match => match[1])
  })`));
  assert.equal(currentWeek.dayMode, false);
  assert.equal(currentWeek.weekStart, currentWeek.todayWeekStart);
  assert.equal(currentWeek.days.length, 7);
  assert.equal(currentWeek.days[0], currentWeek.todayWeekStart);
});

test('calendar weeks and mini calendar run from Sunday through Saturday', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const sunday = startOfWeek(new Date('2026-10-25T00:00:00'));
    const monday = startOfWeek(new Date('2026-10-26T00:00:00'));
    const yearBoundary = startOfWeek(new Date('2027-01-01T00:00:00'));
    weekStart = sunday;
    renderCalendar();
    return JSON.stringify({
      sunday: dateKey(sunday),
      monday: dateKey(monday),
      yearBoundary: dateKey(yearBoundary),
      days: [...document.getElementById('calendarGrid').innerHTML.matchAll(/data-day="([^"]+)"/g)].map(match => match[1]),
      miniWeekdays: [...document.getElementById('miniGrid').innerHTML.matchAll(/<span>([^<]*)<\\/span>/g)].slice(0, 7).map(match => match[1])
    });
  })()`));

  assert.equal(result.sunday, '2026-10-25');
  assert.equal(result.monday, '2026-10-25');
  assert.equal(result.yearBoundary, '2026-12-27');
  assert.deepEqual(result.days, ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
  assert.deepEqual(result.miniWeekdays, ['日', '月', '火', '水', '木', '金', '土']);
});

test('calendar time axis stays aligned to its reserved first column', () => {
  const styles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');

  assert.match(styles, /\.calendar-grid\s*\{[^}]*position:\s*relative/);
  assert.match(styles, /\.calendar-grid::before\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*2;[^}]*height:\s*1080px/);
  assert.match(styles, /\.time-label\s*\{[^}]*left:\s*0;[^}]*width:\s*48px;[^}]*translateY\(calc\(-50% \+ 54px\)\)/);
  assert.match(styles, /\.day-column\s*\{[^}]*height:\s*1080px/);

  const app = createAppHarness();
  const labels = app.document.getElementById('calendarGrid').innerHTML.match(/>\d{2}:00<\/div>/g);
  assert.equal(app.run("slotTop('00:00')"), 0);
  assert.equal(app.run("slotTop('24:00')"), 1080);
  assert.equal(labels.length, 25);
  assert.match(labels[0], />00:00<\/div>/);
  assert.match(labels.at(-1), />24:00<\/div>/);
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
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).extras[0].day, date);
  const reloadedApp = createAppHarness(storage);
  const calendarMarkup = reloadedApp.document.getElementById('calendarGrid').innerHTML;

  assert.match(calendarMarkup, /図書館でレポート/);
  assert.match(calendarMarkup, /15:00 – 16:00/);
});

test('migrates saved planner data from the legacy storage key', () => {
  const legacyData = { fixed: [], tasks: [], sessions: [], extras: [{ id: 'legacy-event', name: '以前の予定', day: '2026-10-25', start: '10:00', end: '11:00', type: 'personal' }] };
  const storage = new Map([['michi-planner-v1', JSON.stringify(legacyData)]]);

  createAppHarness(storage);

  assert.deepEqual(JSON.parse(storage.get('smart-calendar-v1')), legacyData);
  assert.equal(storage.has('michi-planner-v1'), true);
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

test('automatic scheduling does not overlap recurring, one-off, or existing commitments', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    data.fixed = [{ id: 'class', name: '授業', day: today.getDay(), start: '09:30', end: '10:30' }];
    data.extras = [{ id: 'appointment', name: '用事', day, start: '13:00', end: '14:00' }];
    data.sessions = [{ id: 'existing', taskId: 'other-task', name: '既存の学習', day, start: '15:00', end: '16:00', type: 'study', done: false }];
    data.tasks = [{ id: 'scheduled-task', name: '課題', due: day, hours: 3.5, remaining: 3.5, done: false }];
    createSchedule();
    return JSON.stringify({
      day,
      commitments: [
        { start: '09:30', end: '10:30' },
        { start: '13:00', end: '14:00' },
        { start: '15:00', end: '16:00' }
      ],
      sessions: data.sessions.filter(session => session.taskId === 'scheduled-task'),
      allActiveSessions: data.sessions.filter(session => !session.done)
    });
  })()`));

  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const overlaps = (left, right) => minutes(left.start) < minutes(right.end) && minutes(right.start) < minutes(left.end);
  assert.equal(result.sessions.reduce((sum, session) => sum + (minutes(session.end) - minutes(session.start)) / 60, 0), 3.5);
  for (const session of result.sessions) {
    for (const commitment of result.commitments) assert.equal(overlaps(session, commitment), false);
  }
  for (let index = 0; index < result.allActiveSessions.length; index++) {
    for (let other = index + 1; other < result.allActiveSessions.length; other++) {
      assert.equal(overlaps(result.allActiveSessions[index], result.allActiveSessions[other]), false);
    }
  }
});

test('automatic scheduling reports insufficient free time before the deadline', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    data.fixed = [{ id: 'class', name: '授業', day: today.getDay(), start: '09:00', end: '21:00' }];
    data.extras = [];
    data.sessions = [];
    data.tasks = [{ id: 'tight-deadline', name: '締め切り間近の課題', due: day, hours: 2, remaining: 2, done: false }];
    createSchedule();
    return JSON.stringify({
      day,
      sessions: data.sessions.filter(session => session.taskId === 'tight-deadline'),
      capacityWarning: document.getElementById('capacityWarningList').innerHTML,
      notification: document.getElementById('toast').textContent
    });
  })()`));

  assert.equal(result.sessions.length, 1);
  assert.equal(result.sessions[0].day, result.day);
  assert.equal(result.sessions[0].start, '21:00');
  assert.equal(result.sessions[0].end, '22:00');
  assert.match(result.notification, /空き時間が足りません/);
  assert.match(result.capacityWarning, /締め切り間近の課題/);
  assert.match(result.capacityWarning, /1時間/);
  assert.deepEqual(JSON.parse(storage.get('smart-calendar-v1')).capacityShortages, ['tight-deadline']);

  const reloadedApp = createAppHarness(storage);
  assert.match(reloadedApp.document.getElementById('capacityWarningList').innerHTML, /締め切り間近の課題/);
  assert.match(reloadedApp.document.getElementById('capacityWarningList').innerHTML, /1時間/);
});

test('toggling a study session done and undone persists both states and restores remaining effort', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const sessionId = app.run('data.sessions[0].id');
  const initial = app.run('data.tasks.find(item => item.id === data.sessions[0].taskId).remaining');

  app.run(`toggleSession('${sessionId}')`);
  const completed = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(completed.sessions.find(session => session.id === sessionId).done, true);
  assert.equal(completed.tasks.find(task => task.id === completed.sessions.find(session => session.id === sessionId).taskId).remaining, initial - 1);

  const reloadedApp = createAppHarness(storage);
  reloadedApp.run(`toggleSession('${sessionId}')`);
  const reopened = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(reopened.sessions.find(session => session.id === sessionId).done, false);
  assert.equal(reopened.tasks.find(task => task.id === reopened.sessions.find(session => session.id === sessionId).taskId).remaining, initial);
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

test('scheduling fills multiple open study slots for one task in a day', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    const due = dateKey(today);
    data.tasks = [{ id: 'multi-slot', name: '集中して進める課題', due, hours: 3, remaining: 3, done: false }];
    createSchedule();
    const sessions = data.sessions.filter(session => session.taskId === 'multi-slot');
    return JSON.stringify({
      totalHours: sessions.reduce((sum, session) => sum + durationHours(session.start, session.end), 0),
      sessions: sessions.map(session => [session.start, session.end])
    });
  })()`));

  assert.equal(result.totalHours, 3);
  assert.deepEqual(result.sessions, [['09:00', '10:00'], ['10:00', '11:00'], ['11:00', '12:00']]);
});

test('study effort estimates scale with workload and difficulty and reject invalid inputs', () => {
  const app = createAppHarness();
  const estimates = JSON.parse(app.run(`JSON.stringify({
    report: estimateStudyHours('report', 3000, 3),
    reading: estimateStudyHours('reading', 50, 5),
    easyExam: estimateStudyHours('exam', 50, 1),
    invalid: estimateStudyHours('report', 0, 3)
  })`));

  assert.equal(estimates.report, 2.5);
  assert.equal(estimates.reading, 6);
  assert.equal(estimates.easyExam, 2.25);
  assert.equal(estimates.invalid, 0);
});

test('report plans split into ordered subtasks, schedule them, and persist the plan', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const result = JSON.parse(app.run(`(() => {
    const due = dateKey(addDays(today, 5));
    const plan = createStudyPlan({
      name: '経済学レポート',
      kind: 'report',
      due,
      workload: 3000,
      difficulty: 3,
      hours: 2.5,
      credits: 2,
      progress: 0,
      scope: ''
    });
    return JSON.stringify({
      plan,
      phases: data.tasks.filter(task => task.planId === plan.id).map(task => ({
        phase: task.phase,
        hours: task.hours,
        remaining: task.remaining
      })),
      scheduled: data.sessions.filter(session => data.tasks.some(task => task.id === session.taskId && task.planId === plan.id)),
      priority: document.getElementById('priorityList').innerHTML
    });
  })()`));
  const saved = JSON.parse(storage.get('smart-calendar-v1'));

  assert.deepEqual(result.phases.map(phase => phase.phase), ['調査・構成', '執筆', '推敲']);
  assert.equal(result.phases.reduce((sum, phase) => sum + phase.hours, 0), 2.5);
  assert.equal(result.phases.reduce((sum, phase) => sum + phase.remaining, 0), 2.5);
  assert.equal(result.scheduled.reduce((sum, session) => sum + (Number(session.end.slice(0, 2)) * 60 + Number(session.end.slice(3)) - Number(session.start.slice(0, 2)) * 60 - Number(session.start.slice(3))) / 60, 0), 2.5);
  assert.match(result.priority, /経済学レポート/);
  assert.equal(saved.plans[0].credits, 2);
  assert.equal(saved.tasks.filter(task => task.planId === result.plan.id).length, 3);
});

test('fractional study estimates split into whole-minute sessions and fit the existing time input', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    const plan = createStudyPlan({
      name: '小さめのレポート',
      kind: 'report',
      due: dateKey(addDays(today, 3)),
      workload: 2000,
      difficulty: 3,
      hours: 1.75,
      credits: 1,
      progress: 10,
      scope: ''
    });
    const tasks = data.tasks.filter(task => task.planId === plan.id);
    const sessions = data.sessions.filter(session => tasks.some(task => task.id === session.taskId));
    const invalid = createStudyPlan({
      name: '不正な分単位',
      kind: 'report',
      due: plan.due,
      workload: 1000,
      difficulty: 3,
      hours: 1.333,
      credits: 1,
      progress: 0,
      scope: ''
    });
    return JSON.stringify({
      taskMinutes: tasks.map(task => [task.hours * 60, task.remaining * 60]),
      sessionTimes: sessions.map(session => [session.start, session.end]),
      scheduledMinutes: sessions.reduce((sum, session) => sum + clockMinutes(session.end) - clockMinutes(session.start), 0),
      invalid
    });
  })()`));

  assert.match(html, /id="eventDuration"[^>]*step="0\.25"/);
  assert.deepEqual(result.taskMinutes.flat().every(Number.isInteger), true);
  assert.equal(result.sessionTimes.every(([start, end]) => /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)), true);
  assert.equal(result.scheduledMinutes, 94);
  assert.equal(result.invalid, null);
});

test('exam revision sessions are placed 7, 3, and 1 days before the test', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    const due = dateKey(addDays(today, 10));
    const plan = createStudyPlan({
      name: '統計学テスト',
      kind: 'exam',
      due,
      workload: 50,
      difficulty: 3,
      hours: 3,
      credits: 4,
      progress: 0,
      scope: '教科書 p.50〜100'
    });
    return JSON.stringify({
      due,
      phases: data.tasks.filter(task => task.planId === plan.id).map(task => [task.phase, task.scheduleOnDate]),
      sessions: data.sessions.filter(session => data.tasks.some(task => task.id === session.taskId && task.planId === plan.id)).map(session => session.day),
      scope: plan.scope
    });
  })()`));
  const expectedDates = [7, 3, 1].map(offset => app.run(`dateKey(addDays(new Date('${result.due}T00:00:00'), -${offset}))`));

  assert.deepEqual(result.phases.map(phase => phase[1]), expectedDates);
  assert.deepEqual(result.sessions.sort(), [...expectedDates].sort());
  assert.equal(result.scope, '教科書 p.50〜100');
});

test('nearby exam dates compress revision spacing without scheduling sessions in the past', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const tomorrow = dateKey(addDays(today, 1));
    const inTwoDays = dateKey(addDays(today, 2));
    return JSON.stringify({
      tomorrow: getReviewDates(tomorrow),
      inTwoDays: getReviewDates(inTwoDays),
      today: getReviewDates(dateKey(today))
    });
  })()`));

  assert.deepEqual(result.tomorrow, [app.run('dateKey(today)')]);
  assert.deepEqual(result.inTwoDays, [app.run('dateKey(today)'), app.run('dateKey(addDays(today, 1))')]);
  assert.deepEqual(result.today, [app.run('dateKey(today)')]);
});

test('priority ranking reflects credits, deadlines, and remaining progress', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const due = dateKey(addDays(today, 4));
    createStudyPlan({ name: '低単位課題', kind: 'report', due, workload: 1000, difficulty: 3, hours: 1, credits: 1, progress: 0, scope: '' });
    createStudyPlan({ name: '重要な試験', kind: 'exam', due, workload: 10, difficulty: 3, hours: 1, credits: 4, progress: 0, scope: '第1〜3回' });
    createStudyPlan({ name: '進捗済み課題', kind: 'report', due, workload: 1000, difficulty: 3, hours: 1, credits: 4, progress: 90, scope: '' });
    return JSON.stringify({
      html: document.getElementById('priorityList').innerHTML,
      names: getPriorityPlans().map(plan => plan.name)
    });
  })()`));

  assert.equal(result.names[0], '重要な試験');
  assert.ok(result.names.indexOf('進捗済み課題') > result.names.indexOf('低単位課題'));
  assert.ok(result.html.indexOf('重要な試験') < result.html.indexOf('低単位課題'));
});

test('task form submission creates a local plan and requires a test scope', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const form = app.document.getElementById('eventForm');
  const due = app.run('dateKey(addDays(today, 7))');
  app.document.getElementById('eventType').value = 'task';
  app.document.getElementById('studyType').value = 'exam';
  app.document.getElementById('studyScope').value = '講義 第1〜5回';
  form.formValues = {
    name: '生物テスト',
    due,
    start: '13:00',
    end: '14:00',
    studyType: 'exam',
    studyWorkload: '40',
    studyDifficulty: '3',
    duration: '2',
    courseCredits: '3',
    studyProgress: '25',
    studyScope: '講義 第1〜5回'
  };
  const event = {
    currentTarget: form,
    defaultPrevented: false,
    immediateStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.immediateStopped = true; }
  };

  form.dispatch('submit', event);

  const saved = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.immediateStopped, true);
  assert.equal(saved.plans[0].scope, '講義 第1〜5回');
  assert.equal(saved.plans[0].progressPercent, 25);
  assert.equal(saved.plans[0].credits, 3);
  assert.equal(app.document.getElementById('studyScopeField').hidden, true);
  assert.match(app.document.getElementById('taskList').innerHTML, /講義 第1〜5回/);

  app.document.getElementById('studyScope').value = '';
  assert.equal(app.run("createStudyPlan({ name: '範囲なし', kind: 'exam', due: dateKey(addDays(today, 3)), workload: 10, difficulty: 3, hours: 1, credits: 1, progress: 0, scope: '' })"), null);
});

test('spare-time detection finds a 90-minute gap between class periods', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const date = addDays(today, 1);
    data.fixed = [
      { id: 'class-a', name: '1限', day: date.getDay(), start: '09:00', end: '10:30', type: 'class' },
      { id: 'class-b', name: '2限', day: date.getDay(), start: '12:00', end: '13:30', type: 'class' }
    ];
    data.extras = [];
    data.sessions = [];
    return JSON.stringify(getDayStudyGaps(date, 7 * 60));
  })()`));
  const classGap = result.find(gap => gap.start === 630 && gap.end === 720);

  assert.ok(classGap);
  assert.equal(classGap.minutes, 90);
  assert.equal(classGap.classGap, true);
});

test('upcoming spare-time detection starts from the current time and ignores committed periods', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [{ id: 'class-now', name: '授業', day: today.getDay(), start: '09:00', end: '10:30', type: 'class' }];
    data.extras = [];
    data.sessions = [];
    const now = new Date(today);
    now.setHours(8, 30, 0, 0);
    return JSON.stringify(getUpcomingStudyGaps(now, 1)[0]);
  })()`));

  assert.equal(result.start, 510);
  assert.equal(result.end, 540);
  assert.equal(result.minutes, 30);
});

test('spare-time recommendations adapt to location, fatigue, and the available duration', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const due = dateKey(addDays(today, 5));
    data.tasks = [
      { id: 'reading-task', planId: 'reading-plan', name: '教科書', due, hours: 1, remaining: 1, done: false },
      { id: 'writing-task', planId: 'writing-plan', name: 'レポート', due, hours: 1, remaining: 1, done: false }
    ];
    data.plans = [
      { id: 'reading-plan', kind: 'reading', due, credits: 1 },
      { id: 'writing-plan', kind: 'report', due, credits: 1 }
    ];
    data.sessions = [];
    const gap = { minutes: 40 };
    const libraryWhenTired = getSmartStudySuggestions(gap, 'library', 1, 25, 'easy');
    const homeWhenEnergetic = getSmartStudySuggestions(gap, 'home', 5);
    return JSON.stringify({
      tiredTop: libraryWhenTired[0].task.id,
      energeticTop: homeWhenEnergetic[0].task.id,
      suggestionCount: libraryWhenTired.length,
      suggestedMinutes: libraryWhenTired[0].minutes,
      tooShort: getSmartStudySuggestions({ minutes: 10 }, 'library', 3).length
    });
  })()`));

  assert.equal(result.tiredTop, 'reading-task');
  assert.equal(result.energeticTop, 'writing-task');
  assert.equal(result.suggestionCount, 1);
  assert.equal(result.suggestedMinutes, 25);
  assert.equal(result.tooShort, 0);
});

test('adding a spare-time suggestion persists its session and local context', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const result = JSON.parse(app.run(`(() => {
    const due = dateKey(addDays(today, 3));
    data.tasks = [{ id: 'short-task', name: '短い復習', due, hours: 1, remaining: 1, done: false }];
    data.sessions = [];
    studyLocation.value = 'cafe';
    studyFatigue.value = '2';
    saveStudyContext();
    const added = addStudySuggestionSession(data.tasks[0], {
      day: dateKey(addDays(today, 1)),
      start: 630,
      end: 670,
      minutes: 40
    }, 25);
    const session = data.sessions[0];
    return JSON.stringify({ added, session, context: data.context });
  })()`));
  const saved = JSON.parse(storage.get('smart-calendar-v1'));

  assert.equal(result.added, true);
  assert.equal(result.session.start, '10:30');
  assert.equal(result.session.end, '10:55');
  assert.equal(result.session.day, app.run('dateKey(addDays(today, 1))'));
  assert.deepEqual(result.context, { location: 'cafe', fatigue: 2, duration: 30, mode: 'focus' });
  assert.deepEqual(saved.context, { location: 'cafe', fatigue: 2, duration: 30, mode: 'focus' });
  assert.equal(saved.sessions.at(-1).taskId, 'short-task');
});

test('spare-time duration and condition filters persist and change recommendations', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const result = JSON.parse(app.run(`(() => {
    const due = dateKey(addDays(today, 3));
    data.tasks = [
      { id: 'reading', name: '読書の復習', due, remaining: 1, done: false },
      { id: 'writing', name: 'レポート執筆', due, remaining: 1, done: false }
    ];
    data.sessions = [];
    setSpareTimeDuration(60);
    setSpareTimeMode('easy');
    const easyIds = getSmartStudySuggestions({ minutes: 60 }, 'library', 3, 60).map(item => item.task.id);
    setSpareTimeMode('focus');
    const focusIds = getSmartStudySuggestions({ minutes: 60 }, 'library', 3, 60).map(item => item.task.id);
    const invalidDuration = setSpareTimeDuration(45);
    const saved = JSON.parse(localStorage.getItem('smart-calendar-v1')).context;
    return JSON.stringify({ easyIds, focusIds, invalidDuration, saved });
  })()`));

  assert.deepEqual(result.easyIds, ['reading']);
  assert.deepEqual(result.focusIds, ['writing']);
  assert.equal(result.invalidDuration, false);
  assert.deepEqual(result.saved, { location: 'library', fatigue: 3, duration: 60, mode: 'focus' });
});

test('character station warns about overloaded days and supports resting and resuming', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    data.fixed = [{ id: 'long-day', name: '予定', day: today.getDay(), start: '07:00', end: '21:00', type: 'class' }];
    data.tasks = [{ id: 'urgent', name: '明日期限', due: day, remaining: 5, done: false }];
    data.sessions = [];
    renderCharacterStation();
    const overloaded = {
      markup: document.getElementById('characterAvatar').innerHTML,
      label: document.getElementById('characterAvatar').getAttribute('aria-label'),
      message: document.getElementById('characterMessage').textContent,
      warningHidden: document.getElementById('capacityPanic').hidden
    };
    document.getElementById('takeRestDay').dispatch('click', {});
    const resting = { markup: document.getElementById('characterAvatar').innerHTML, restDays: data.restDays };
    document.getElementById('takeRestDay').dispatch('click', {});
    return JSON.stringify({ overloaded, resting, resumed: data.restDays });
  })()`));

  assert.match(result.overloaded.markup, /data-mood="concerned"/);
  assert.equal(result.overloaded.label, 'TASKROU、心配の表情');
  assert.match(result.overloaded.message, /無理はしないで/);
  assert.equal(result.overloaded.warningHidden, false);
  assert.match(result.resting.markup, /data-mood="resting"/);
  assert.equal(result.resting.restDays.length, 1);
  assert.deepEqual(result.resumed, []);
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).restDays.length, 0);
});

test('AI character is rendered as inline owl artwork with a mood-specific expression', () => {
  const app = createAppHarness();
  const rawResult = app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    data.tasks = [{ id: 'priority', name: '小テスト対策', due: dateKey(addDays(today, 3)), hours: 2, remaining: 2, done: false }];
    data.plans = [];
    renderCharacterStation();
    return JSON.stringify({
      markup: document.getElementById('characterAvatar').innerHTML,
      label: document.getElementById('characterAvatar').getAttribute('aria-label')
    });
  })()`);
  const result = JSON.parse(rawResult);

  assert.match(result.markup, /<svg class="owl-mascot" data-mood="encouraging"/);
  assert.match(result.markup, /class="owl-glasses"/);
  assert.match(result.markup, /class="owl-clock"/);
  assert.match(result.markup, /class="owl-quill"/);
  assert.match(result.markup, /viewBox="0 0 180 205"/);
  assert.match(result.markup, /cx="69" cy="73" r="24"/);
  assert.match(result.markup, /cx="69" cy="73" rx="13" ry="16"/);
  assert.match(result.markup, /class="owl-crown"/);
  assert.equal(result.label, 'TASKROU、応援の表情');
  assert.match(dashboardEnhancementsScript, /TASKROU · AI STUDY COMPANION/);
  assert.match(dashboardEnhancementsScript, /owl-mascot\[data-mood="concerned"\]/);
  assert.match(dashboardEnhancementsScript, /owl-mascot\[data-mood="celebratory"\]/);
  assert.match(dashboardEnhancementsScript, /owl-blink/);
  assert.match(dashboardEnhancementsScript, /prefers-reduced-motion:\s*reduce/);
});

test('completing a task activates the celebratory owl expression', () => {
  const app = createAppHarness();
  const result = app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    data.tasks = [{ id: 'finished', name: '読書課題', due: dateKey(addDays(today, 2)), hours: 1, remaining: 0, done: true }];
    celebrateTaskCompletion('finished');
    return document.getElementById('characterAvatar').innerHTML;
  })()`);

  assert.match(result, /data-mood="celebratory"/);
  assert.match(result, /class="owl-eye" d="M48 75/);
  assert.match(result, /owl-confetti/);
  assert.match(result, /owl-books/);
});

test('quick text input opens task entry and image input stores a local attachment', async () => {
  const textApp = createAppHarness();
  textApp.document.getElementById('quickTextInput').dispatch('click', {});
  assert.ok(textApp.document.getElementById('modalBackdrop').classList.added.includes('open'));
  assert.equal(textApp.document.getElementById('eventType').value, 'task');

  const imageDatabase = createMemoryImageDatabase();
  const storage = new Map();
  const openedImageUrls = [];
  const imageApp = createAppHarness(storage, {
    indexedDB: imageDatabase.indexedDB,
    URL: { createObjectURL(blob) { const url = `blob:${blob.name}`; openedImageUrls.push(url); return url; }, revokeObjectURL() {} }
  });
  const file = { name: 'lecture-notes.png', type: 'image/png', size: 1024 };
  const fileInput = imageApp.document.getElementById('quickImageFile');
  imageApp.document.getElementById('quickImageInput').dispatch('click', {});
  assert.equal(fileInput.clicked, true);
  fileInput.files = [file];
  fileInput.dispatch('change', { currentTarget: fileInput });

  assert.equal(imageApp.document.getElementById('eventType').value, 'task');
  assert.equal(imageApp.document.getElementById('quickImagePending').hidden, false);
  imageApp.run(`createStudyPlan({
    name: '講義ノートの復習',
    kind: 'reading',
    due: dateKey(addDays(today, 2)),
    workload: 10,
    difficulty: 2,
    hours: 1,
    credits: 1,
    progress: 0,
    scope: ''
  })`);
  await new Promise(resolve => setImmediate(resolve));

  const plan = JSON.parse(storage.get('smart-calendar-v1')).plans.at(-1);
  assert.equal(plan.imageAttachmentName, 'lecture-notes.png');
  assert.equal(imageDatabase.records.get(plan.id).blob, file);
  imageApp.run('renderTaskOverview()');
  assert.match(imageApp.document.getElementById('taskOverviewList').innerHTML, /画像を開く：lecture-notes\.png/);
  imageApp.run(`openTaskImage('${plan.id}')`);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(openedImageUrls, ['blob:lecture-notes.png']);
});

test('character station schedules a 20-minute task in the next open interval', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    data.tasks = [{ id: 'quick-task', name: '小テスト復習', due: dateKey(addDays(today, 2)), remaining: 1, done: false }];
    data.context.mode = 'easy';
    const added = startTwentyMinuteTask();
    return JSON.stringify({ added, session: data.sessions[0] });
  })()`));

  assert.equal(result.added, true);
  assert.equal(result.session.taskId, 'quick-task');
  assert.equal(app.run('durationHours(data.sessions[0].start, data.sessions[0].end)'), 1 / 3);
  assert.equal(result.session.id, app.run('data.activeTimer.sessionId'));
  assert.match(app.document.getElementById('studyTimerReadout').textContent, /作業中 20:00/);
  assert.equal(app.document.getElementById('startTwentyMinuteTask').disabled, true);
  assert.match(app.document.getElementById('characterAvatar').innerHTML, /data-timer-active="true"/);
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).sessions[0].taskId, 'quick-task');
  const restoredApp = createAppHarness(storage);
  assert.equal(restoredApp.run('data.activeTimer.sessionId'), result.session.id);

  app.run('data.activeTimer.endsAt = Date.now() - 1; updateStudyTimer()');
  assert.equal(app.run('data.activeTimer'), null);
  assert.equal(app.document.getElementById('studyTimerReadout').hidden, true);
  assert.equal(app.run('data.sessions[0].done'), false);
});

test('calendar keeps its existing grid layout while marking AI tasks, progress, and deadlines', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    const due = dateKey(addDays(today, 1));
    const plan = createStudyPlan({
      name: 'レポート課題',
      kind: 'report',
      due,
      workload: 1000,
      difficulty: 3,
      hours: 2,
      credits: 2,
      progress: 0,
      scope: ''
    });
    const calendar = document.getElementById('calendarGrid').innerHTML;
    toggleSession(data.sessions.find(session => session.taskId.startsWith(plan.id)).id);
    return JSON.stringify({
      calendar,
      completedCalendar: document.getElementById('calendarGrid').innerHTML,
      due
    });
  })()`));
  const styles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\\n');

  assert.match(styles, /\.calendar-grid\s*\{[^}]*min-width:\s*740px/);
  assert.match(dashboardEnhancementsScript, /\.calendar-grid \.event\.ai-generated/);
  assert.match(result.calendar, /ai-generated/);
  assert.match(result.calendar, /<span class="ai-badge">AI<\/span>/);
  assert.match(result.calendar, /0\/3完了（0%）/);
  assert.match(result.calendar, /class="day-head[^"]*has-deadline"/);
  assert.match(result.calendar, /締め切り/);
  assert.match(result.completedCalendar, /1\/3完了（25%）/);
});

test('floating task button opens the existing task modal without replacing calendar controls', () => {
  const app = createAppHarness();
  app.document.getElementById('taskFab').dispatch('click', {});

  assert.match(dashboardEnhancementsScript, /position: fixed; right: 24px; bottom: 24px; z-index: 9/);
  assert.match(html, /\.modal-backdrop\{[^}]*z-index:10/);
  assert.ok(app.document.getElementById('modalBackdrop').classList.added.includes('open'));
  assert.equal(app.document.getElementById('eventType').value, 'task');
  assert.match(html, /id="calendarGrid"/);
});

test('workspace task navigation opens the complete task list without opening the add form', () => {
  const app = createAppHarness();
  app.run(`(() => {
    data.plans.push({ id: 'archived-plan', kind: 'exam' });
    data.tasks.push({
      id: 'archived-test',
      planId: 'archived-plan',
      name: '歴史学期末テスト',
      phase: '直前確認',
      scope: '第1章〜第4章',
      due: dateKey(addDays(today, 2)),
      hours: 1,
      remaining: 0,
      done: true,
      order: 1
    });
    renderTasks();
  })()`);
  app.document.getElementById('tasksNav').dispatch('click', {});

  const list = app.document.getElementById('taskOverviewList').innerHTML;
  assert.equal(app.document.getElementById('taskOverview').hidden, false);
  assert.match(list, /歴史学期末テスト · 直前確認/);
  assert.match(list, /テスト/);
  assert.match(list, /完了/);
  assert.match(app.document.getElementById('taskOverviewSummary').textContent, /全4件/);
  assert.equal(app.document.getElementById('modalBackdrop').classList.added.includes('open'), false);
  assert.ok(app.document.body.classList.added.includes('task-overview-active'));

  app.document.querySelector('.nav-item.active').dispatch('click', {});
  assert.equal(app.document.getElementById('taskOverview').hidden, true);
  assert.equal(app.document.body.classList.added.includes('task-overview-active'), false);
});

test('opening a task in the list shows its saved plan details and lets the user collapse them', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    const plan = createStudyPlan({
      name: '生物学期末テスト',
      kind: 'exam',
      due: dateKey(addDays(today, 7)),
      workload: 40,
      difficulty: 4,
      hours: 2,
      credits: 3,
      progress: 25,
      scope: '教科書 p.50〜100'
    });
    const task = data.tasks.find(item => item.planId === plan.id);
    toggleTaskDetail(task.id);
    const expanded = document.getElementById('taskOverviewList').innerHTML;
    toggleTaskDetail(task.id);
    const collapsed = document.getElementById('taskOverviewList').innerHTML;
    return JSON.stringify({ expanded, collapsed });
  })()`));

  assert.match(result.expanded, /aria-expanded="true"/);
  assert.match(result.expanded, /40ページ/);
  assert.match(result.expanded, /4\/5/);
  assert.match(result.expanded, /3単位/);
  assert.match(result.expanded, /教科書 p\.50〜100/);
  assert.match(result.expanded, /約0\.7時間/);
  assert.match(result.collapsed, /aria-expanded="false"/);
  assert.match(result.collapsed, /task-overview-details[^>]* hidden/);
});

test('planning duration and actual session deviation persist for the selected week', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  app.run('recordPlanningTime(42)');
  app.run(`recordSessionActual(data.sessions[0].id, '14:15', '15:10')`);
  const records = JSON.parse(storage.get('smart-calendar-v1'));
  const weekKey = app.run('dateKey(weekStart)');

  assert.equal(records.reviews[weekKey].planningMinutes, 42);
  assert.equal(records.sessions[0].actualStart, '14:15');
  assert.equal(records.sessions[0].actualEnd, '15:10');

  const reloadedApp = createAppHarness(storage);
  assert.match(reloadedApp.document.getElementById('planningTimeSummary').textContent, /42分/);
  assert.match(reloadedApp.document.getElementById('reviewSessionList').innerHTML, /開始 \+15分 ／ 終了 \+10分/);
});

test('weekly review follows the selected calendar week and rejects invalid records', () => {
  const app = createAppHarness();
  const accepted = app.run(`(() => {
    const saved = recordPlanningTime(25);
    const invalidDuration = recordPlanningTime(0);
    const invalidActual = recordSessionActual(data.sessions[0].id, '15:00', '14:00');
    const invalidClock = recordSessionActual(data.sessions[0].id, '25:70', '26:00');
    setWeek(1);
    const nextWeekSummary = document.getElementById('planningTimeSummary').textContent;
    return JSON.stringify({ saved, invalidDuration, invalidActual, invalidClock, nextWeekSummary });
  })()`);
  const result = JSON.parse(accepted);

  assert.equal(result.saved, true);
  assert.equal(result.invalidDuration, false);
  assert.equal(result.invalidActual, false);
  assert.equal(result.invalidClock, false);
  assert.match(result.nextWeekSummary, /まだ記録されていません/);
});

test('GitHub Pages deploy waits for the passing test job', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'pages.yml'), 'utf8');
  const testJob = workflow.match(/test:\s*\n([\s\S]*?)\n\s+deploy:/);
  const deployJob = workflow.match(/deploy:\s*\n([\s\S]*)/);
  assert.ok(testJob, 'workflow must define a test job before deployment');
  assert.match(testJob[1], /- run: npm test/);
  assert.ok(deployJob, 'workflow must define a deployment job');
  assert.match(deployJob[1], /\n\s+needs: test(?:\r?\n|$)/);
  assert.doesNotMatch(deployJob[1], /\balways\(\)/);
  assert.match(deployJob[1], /cp weekly-review\.js dist\/weekly-review\.js/);
  assert.match(deployJob[1], /cp study-planning\.js dist\/study-planning\.js/);
  assert.match(deployJob[1], /cp spare-time\.js dist\/spare-time\.js/);
  assert.match(deployJob[1], /cp dashboard-enhancements\.js dist\/dashboard-enhancements\.js/);
  assert.match(deployJob[1], /cp quick-input\.js dist\/quick-input\.js/);
});
