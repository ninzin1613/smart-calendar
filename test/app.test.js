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
const smartInputScript = fs.readFileSync(path.join(__dirname, '..', 'smart-input.js'), 'utf8');
assert.match(html, /<script src="\.\/weekly-review\.js"><\/script>/, 'index.html must load the weekly review script');
assert.match(html, /<script src="\.\/study-planning\.js"><\/script>/, 'index.html must load the study planning script');
assert.match(html, /<script src="\.\/spare-time\.js"><\/script>/, 'index.html must load the spare-time suggestion script');
assert.match(html, /<script src="\.\/dashboard-enhancements\.js\?v=20261114-taskrou-choice-dialogue"><\/script>/, 'index.html must load the current dashboard enhancements');
assert.match(html, /<script src="\.\/quick-input\.js\?v=20261113-taskrou-chat-input"><\/script>/, 'index.html must load task image support');
assert.match(html, /<script src="\.\/smart-input\.js\?v=20261116-smart-input-time-edit"><\/script>/, 'index.html must load local smart input');
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
    insertAdjacentElement(position, element) {
      if (position === 'afterend') element.previousElementSibling = this;
      if (position === 'afterbegin') {
        element.previousElementSibling = null;
        element.nextElementSibling = this.firstElementChild || null;
        this.firstElementChild = element;
      }
      return element;
    },
    appendChild() {},
    parentElement: { hidden: false, insertAdjacentHTML() {} },
    querySelector() { return makeElement(); },
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
    confirm() { return false; },
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
  new vm.Script(smartInputScript, { filename: 'smart-input.js' }).runInContext(context);
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

function createFixedDate(hour = 12) {
  const fixedNow = new Date();
  fixedNow.setHours(hour, 0, 0, 0);
  return class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow.getTime()])); }
    static now() { return fixedNow.getTime(); }
  };
}

test('new calendars start empty and show generic local-only profile information', () => {
  const storage = new Map();
  const app = createAppHarness(storage);

  assert.doesNotMatch(html, /佐藤 葵|経済学部 · 2年/);
  assert.match(html, /このブラウザーに保存/);
  assert.deepEqual(JSON.parse(app.run(`JSON.stringify({
    fixed: data.fixed.length,
    tasks: data.tasks.length,
    sessions: data.sessions.length,
    extras: data.extras.length
  })`)), { fixed: 0, tasks: 0, sessions: 0, extras: 0 });
  assert.equal(storage.has('smart-calendar-v1'), true);
  assert.equal(app.document.getElementById('taskCount').textContent, 0);
  assert.match(app.document.getElementById('taskList').innerHTML, /課題はすべて完了/);
  assert.doesNotMatch(app.document.getElementById('calendarGrid').innerHTML, /ミクロ経済学|統計学|カフェのシフト/);
});

test('removes legacy demo records but preserves user-created calendar data', () => {
  const storedData = {
    fixed: [
      { id: 'f1', name: 'ミクロ経済学', day: 1, start: '09:00', end: '10:30', type: 'class' },
      { id: 'my-class', name: '自分の授業', day: 2, start: '10:00', end: '11:00', type: 'class' }
    ],
    tasks: [
      { id: 't1', name: 'マーケティング論 レポート', due: '2026-10-05', hours: 3, remaining: 2, done: false },
      { id: 'my-task', name: '自分の課題', due: '2026-10-05', hours: 1, remaining: 1, done: false }
    ],
    sessions: [
      { id: 's1', taskId: 't1', name: 'マーケティング論 レポート', day: '2026-09-30', start: '14:00', end: '15:00', type: 'study', done: false },
      { id: 'my-session', taskId: 'my-task', name: '自分の課題', day: '2026-09-30', start: '15:00', end: '16:00', type: 'study', done: false }
    ],
    extras: [{ id: 'my-event', name: '自分の予定', day: '2026-09-30', start: '12:00', end: '13:00', type: 'personal' }]
  };
  const storage = new Map([['smart-calendar-v1', JSON.stringify(storedData)]]);

  createAppHarness(storage);

  const migrated = JSON.parse(storage.get('smart-calendar-v1'));
  assert.deepEqual(migrated.fixed.map(item => item.id), ['my-class']);
  assert.deepEqual(migrated.tasks.map(task => task.id), ['my-task']);
  assert.deepEqual(migrated.sessions.map(session => session.id), ['my-session']);
  assert.deepEqual(migrated.extras, storedData.extras);
});

test('mini calendar dates reflect the current day', () => {
  assert.doesNotMatch(html, /class="brand-sub"/);
  assert.doesNotMatch(html, /class="crumb"/);
  assert.doesNotMatch(html, /class="free-badge"/);
  assert.doesNotMatch(html, /getElementById\('freeBadge'\)/);

  const app = createAppHarness();
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

test('week date navigation sits at the right side of the calendar toolbar', () => {
  const styles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');
  const toolbarStart = html.indexOf('<div class="calendar-toolbar">');
  const viewToggle = html.indexOf('<div class="view-toggle">', toolbarStart);
  const spacer = html.indexOf('<div class="toolbar-spacer"></div>', viewToggle);
  const weekControls = html.indexOf('<div class="week-controls">', spacer);
  const calendarScroll = html.indexOf('<div class="calendar-scroll">', weekControls);

  assert.match(html, /<main class="main"><section class="metrics"/);
  assert.doesNotMatch(html, /class="intro"/);
  assert.ok(toolbarStart >= 0 && viewToggle > toolbarStart && spacer > viewToggle);
  assert.ok(weekControls > spacer && calendarScroll > weekControls);
  assert.match(styles, /\.calendar-toolbar \.week-controls\s*\{[^}]*margin-left:\s*auto/);
  assert.match(styles, /\.calendar-toolbar \.week-label\s*\{\s*min-width:\s*108px/);
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

test('mobile layout uses full-width content and touch-friendly navigation', () => {
  const styles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]).join('\n');

  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.app\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.sidebar\s*\{[^}]*flex-direction:\s*row/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.sidebar \.nav-item span:not\(\.nav-icon\)\s*\{[^}]*display:\s*block/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.calendar-scroll\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*?\.form-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test('weekly summary sits below the sidebar calendar on desktop and returns to content on smaller screens', () => {
  assert.doesNotMatch(html, /YOUR WEEK, IN BALANCE|今日の予定と、これからの計画。/);
  const resizeHandlers = [];
  const browser = { window: {
    innerWidth: 1024,
    addEventListener(name, handler) {
      if (name === 'resize') resizeHandlers.push(handler);
    }
  } };
  const app = createAppHarness(new Map(), browser);
  const metrics = app.document.querySelector('.metrics');

  assert.equal(metrics.previousElementSibling, app.document.querySelector('.mini-calendar'));

  browser.window.innerWidth = 768;
  resizeHandlers[0]();
  assert.equal(app.document.querySelector('.main').firstElementChild, metrics);

  browser.window.innerWidth = 1280;
  resizeHandlers[0]();
  assert.equal(metrics.previousElementSibling, app.document.querySelector('.mini-calendar'));
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

test('calendar event details support keyboard access and safe deletion', () => {
  const storage = new Map();
  const confirmationMessages = [];
  let acceptDeletion = false;
  const app = createAppHarness(storage, {
    confirm(message) {
      confirmationMessages.push(message);
      return acceptDeletion;
    }
  });
  app.run(`data.fixed = [{ id: 'weekly-event', name: 'ゼミ', day: today.getDay(), start: '10:00', end: '11:00', type: 'class' }];
    data.extras = [{ id: 'one-off', name: '歯医者', day: dateKey(today), start: '11:00', end: '12:00', type: 'personal' }];
    data.tasks = [{ id: 'detail-task', name: 'レポート', due: dateKey(addDays(today, 2)), hours: 1, remaining: 1, done: false }];
    data.sessions = [{ id: 'study-session', taskId: 'detail-task', name: 'レポート', day: dateKey(today), start: '13:00', end: '14:00', type: 'study', done: false }];
    renderCalendar()`);
  const calendar = app.document.getElementById('calendarGrid');
  const activateEvent = (source, id, type = 'click', key = undefined) => {
    const element = { dataset: { eventSource: source, eventId: id } };
    calendar.dispatch(type, {
      key,
      target: { closest(selector) { return selector === '[data-event-source]' ? element : null; } },
      preventDefault() { this.defaultPrevented = true; }
    });
  };

  assert.match(calendar.innerHTML, /data-event-source="fixed" data-event-id="weekly-event"/);
  assert.match(calendar.innerHTML, /data-event-source="extras" data-event-id="one-off"/);
  assert.match(calendar.innerHTML, /data-event-source="sessions" data-event-id="study-session"/);

  activateEvent('extras', 'one-off');
  assert.equal(app.document.getElementById('eventDetailTitle').textContent, '歯医者');
  assert.equal(app.document.getElementById('eventDetailType').textContent, '個人予定');
  assert.equal(app.document.getElementById('eventDetailDate').textContent, app.run('formatEventDate(dateKey(today))'));
  assert.equal(app.document.getElementById('eventDetailTime').textContent, '11:00〜12:00');
  app.document.getElementById('deleteCalendarEvent').dispatch('click', {});
  assert.equal(app.run('data.extras.length'), 1, 'declining confirmation must keep the event');
  assert.match(confirmationMessages[0], /歯医者を削除/);

  acceptDeletion = true;
  app.document.getElementById('deleteCalendarEvent').dispatch('click', {});
  assert.equal(app.run('data.extras.length'), 0);
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).extras.length, 0);
  assert.equal(app.document.getElementById('eventDetailBackdrop').classList.added.includes('open'), false);

  activateEvent('fixed', 'weekly-event', 'keydown', 'Enter');
  assert.equal(app.document.getElementById('eventDetailDate').textContent, `毎週 ${app.run('weekNames[today.getDay()]')}曜日`);
  assert.equal(app.document.getElementById('deleteCalendarEvent').textContent, '毎週の予定を削除');
  app.document.getElementById('deleteCalendarEvent').dispatch('click', {});
  assert.equal(app.run('data.fixed.length'), 0);

  activateEvent('sessions', 'study-session');
  assert.equal(app.document.getElementById('eventDetailStatus').textContent, '未完了');
  assert.match(app.document.getElementById('eventDetailNote').textContent, /関連する課題：レポート/);
  app.document.getElementById('toggleEventCompletion').dispatch('click', {});
  assert.equal(app.document.getElementById('eventDetailStatus').textContent, '完了');
  assert.equal(app.run('data.tasks[0].remaining'), 0);
  app.document.getElementById('toggleEventCompletion').dispatch('click', {});
  assert.equal(app.document.getElementById('eventDetailStatus').textContent, '未完了');
  assert.equal(app.run('data.tasks[0].remaining'), 1);
  app.document.getElementById('deleteCalendarEvent').dispatch('click', {});
  assert.equal(app.run('data.sessions.length'), 0);
  assert.equal(app.run('data.tasks.length'), 0, 'deleting a task session on the calendar also deletes its task from the task list');
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).tasks.length, 0);
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
  app.run(`data.tasks = [{ id: 'repeat-task', name: '繰り返し確認', due: dateKey(addDays(today, 3)), hours: 2, remaining: 2, done: false }]`);
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
  const app = createAppHarness(new Map(), { Date: createFixedDate(8) });
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    data.fixed = [{ id: 'class', name: '授業', day: today.getDay(), start: '09:30', end: '10:30' }];
    data.extras = [{ id: 'appointment', name: '用事', day, start: '13:00', end: '14:00' }];
    data.sessions = [{ id: 'existing', taskId: 'other-task', name: '既存の学習', day, start: '15:00', end: '16:00', type: 'study', done: false }];
    data.tasks = [{ id: 'scheduled-task', name: '課題', due: dateKey(addDays(today, 3)), hours: 3.5, remaining: 3.5, done: false }];
    createSchedule();
    return JSON.stringify({
      day,
      commitments: [
        { start: '09:30', end: '10:30' },
        { start: '13:00', end: '14:00' },
        { start: '15:00', end: '16:00' }
      ],
      sessions: data.sessions.filter(session => session.taskId === 'scheduled-task'),
      allActiveSessions: data.sessions.filter(session => !session.done),
      today
    });
  })()`));

  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const overlaps = (left, right) => minutes(left.start) < minutes(right.end) && minutes(right.start) < minutes(left.end);
  assert.equal(result.sessions.reduce((sum, session) => sum + session.allocatedHours, 0), 3.5);
  for (const session of result.sessions) {
    if (session.day === result.today) {
      for (const commitment of result.commitments) assert.equal(overlaps(session, commitment), false);
    }
  }
  for (let index = 0; index < result.allActiveSessions.length; index++) {
    for (let other = index + 1; other < result.allActiveSessions.length; other++) {
      if (result.allActiveSessions[index].day === result.allActiveSessions[other].day) {
        assert.equal(overlaps(result.allActiveSessions[index], result.allActiveSessions[other]), false);
      }
    }
  }
  const generatedPerDay = result.allActiveSessions.filter(session => session.aiGenerated).reduce((counts, session) => {
    counts[session.day] = (counts[session.day] || 0) + 1;
    return counts;
  }, {});
  assert.ok(Object.values(generatedPerDay).every(count => count <= 2));
  for (const session of result.sessions) {
    const start = minutes(session.start);
    const end = minutes(session.end);
    assert.ok(start >= 8 * 60 && end <= 23 * 60);
    assert.ok(end - start >= 45 && end - start <= 60);
    assert.ok(session.day < app.run("dateKey(addDays(today, 3))"));
  }
});

test('automatic scheduling reports insufficient free time before the deadline', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    data.fixed = [{ id: 'class', name: '授業', day: today.getDay(), start: '09:00', end: '21:00' }];
    data.extras = [];
    data.sessions = [];
    data.tasks = [{ id: 'tight-deadline', name: '締め切り間近の課題', due: dateKey(addDays(today, 1)), hours: 3, remaining: 3, done: false }];
    createSchedule();
    return JSON.stringify({
      day,
      sessions: data.sessions.filter(session => session.taskId === 'tight-deadline'),
      capacityWarning: document.getElementById('capacityWarningList').innerHTML,
      notification: document.getElementById('toast').textContent
    });
  })()`));

  assert.equal(result.sessions.length, 2);
  assert.equal(result.sessions[0].day, result.day);
  assert.equal(result.sessions[0].start, '21:00');
  assert.equal(result.sessions[0].end, '22:00');
  assert.equal(result.sessions[1].start, '22:00');
  assert.equal(result.sessions[1].end, '23:00');
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
  app.run(`data.tasks = [{ id: 'toggle-task', name: '完了確認', due: dateKey(addDays(today, 2)), hours: 1, remaining: 1, done: false }]; data.sessions = [{ id: 'toggle-session', taskId: 'toggle-task', name: '完了確認', day: dateKey(today), start: '14:00', end: '15:00', type: 'study', done: false }]`);
  const sessionId = app.run('data.sessions[0].id');
  const initial = app.run('data.tasks.find(item => item.id === data.sessions[0].taskId).remaining');

  app.run(`toggleSession('${sessionId}')`);
  const completed = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(completed.sessions.find(session => session.id === sessionId).done, true);
  assert.equal(completed.tasks.find(task => task.id === completed.sessions.find(session => session.id === sessionId).taskId).remaining, initial - 1);
  assert.equal(completed.tasks.find(task => task.id === completed.sessions.find(session => session.id === sessionId).taskId).done, true);

  const reloadedApp = createAppHarness(storage);
  reloadedApp.run(`toggleSession('${sessionId}')`);
  const reopened = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(reopened.sessions.find(session => session.id === sessionId).done, false);
  assert.equal(reopened.tasks.find(task => task.id === reopened.sessions.find(session => session.id === sessionId).taskId).remaining, initial);
  assert.equal(reopened.tasks.find(task => task.id === reopened.sessions.find(session => session.id === sessionId).taskId).done, false);
});

test('rerouting preserves completed sessions and creates no duplicate active time', () => {
  const app = createAppHarness();
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [{ id: 'today-busy', name: '予定', day: today.getDay(), start: '07:00', end: '22:00', type: 'class' }];
    data.tasks = [{ id: 'reroute-task', name: '振り替え確認', due: dateKey(addDays(today, 3)), hours: 2, remaining: 2, done: false }];
    data.sessions = [];
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

test('rerouting counts completed AI blocks toward the two-block daily limit', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    data.fixed = [];
    data.extras = [];
    data.tasks = [{ id: 'daily-cap-task', name: '日次上限確認', due: dateKey(addDays(today, 3)), hours: 3, remaining: 2, done: false }];
    data.sessions = [
      { id: 'completed-ai', taskId: 'daily-cap-task', name: '完了済み', day, start: '08:00', end: '09:00', type: 'study', done: true, aiGenerated: true },
      { id: 'active-ai', taskId: 'daily-cap-task', name: '未完了', day, start: '09:00', end: '10:00', type: 'study', done: false, aiGenerated: true, allocatedHours: 1 }
    ];
    createSchedule({ reroute: true });
    return JSON.stringify({
      todayAi: data.sessions.filter(session => session.aiGenerated && session.day === day),
      completedPreserved: data.sessions.some(session => session.id === 'completed-ai' && session.done)
    });
  })()`));

  assert.equal(result.completedPreserved, true);
  assert.equal(result.todayAi.length, 2);
});

test('scheduling fills multiple open study slots for one task in a day', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(8) });
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    const due = dateKey(addDays(today, 1));
    data.tasks = [{ id: 'multi-slot', name: '集中して進める課題', due, hours: 3, remaining: 3, done: false }];
    createSchedule();
    const sessions = data.sessions.filter(session => session.taskId === 'multi-slot');
    return JSON.stringify({
      totalHours: sessions.reduce((sum, session) => sum + durationHours(session.start, session.end), 0),
      sessions: sessions.map(session => [session.start, session.end])
    });
  })()`));

  assert.equal(result.totalHours, 2);
  assert.deepEqual(result.sessions, [['08:00', '09:00'], ['09:00', '10:00']]);
});

test('local parser stages clear rows and leaves ambiguous rows for confirmation', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
  const taskDate = app.run('addDays(today, 5)');
  const taskLine = `${taskDate.getMonth() + 1}/${taskDate.getDate()}までに英語レポート（重め）`;
  const text = `明日 18:00-22:00 バイト\n${taskLine}\n明日 バイト`;
  const parsed = JSON.parse(app.run(`JSON.stringify(parseSmartInput(${JSON.stringify(text)}))`));
  const weekly = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('毎週月曜 09:00-10:30 授業'))`));

  assert.equal(parsed[0].ready, true);
  assert.equal(parsed[0].kind, 'event');
  assert.equal(parsed[0].type, 'work');
  assert.deepEqual([parsed[0].start, parsed[0].end], ['18:00', '22:00']);
  assert.equal(parsed[1].ready, true);
  assert.equal(parsed[1].kind, 'task');
  assert.equal(parsed[1].hours, 3);
  assert.equal(parsed[2].ready, false);
  assert.match(parsed[2].reason, /開始・終了時刻/);
  assert.equal(weekly.ready, true);
  assert.equal(weekly.repeat, 'weekly');
  assert.equal(weekly.weekday, 1);

  app.document.getElementById('smartInputText').value = `${text.split('\n')[0]}\n明日 バイト`;
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});
  const saved = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(saved.extras.length, 0);
  assert.equal(app.run('smartInputPending.length'), 2);
  assert.equal(app.document.getElementById('smartInputEntry').hidden, true);
  assert.equal(app.document.getElementById('smartInputReview').hidden, false);
  assert.equal(app.document.getElementById('smartInputReviewPrompt').textContent, '情報が足りません。必要事項を記入してください。');
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /data-smart-field="start" type="time" value=""/);

  app.run(`smartInputPending[1].start = '19:00'; smartInputPending[1].end = '22:00'; confirmSmartInputReview()`);
  const confirmed = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(confirmed.extras.length, 2);
  assert.equal(confirmed.extras[0].type, 'work');
  assert.equal(app.run('smartInputPending.length'), 0);
  assert.equal(app.document.getElementById('smartInputStatus').textContent, '2件を追加しました。');

  const editedEntryId = app.run('smartInputLastEntries[0].id');
  app.run('openSmartEntryEditor(smartInputLastEntries[0])');
  assert.equal(app.document.getElementById('eventName').value, 'バイト');
  assert.equal(app.document.getElementById('manualInputTab').getAttribute('aria-selected'), 'true');
  const form = app.document.getElementById('eventForm');
  form.formValues = {
    name: 'シフト変更',
    type: 'work',
    repeat: 'once',
    oneOffDate: app.run('dateKey(addDays(today, 1))'),
    start: '19:00',
    end: '22:00'
  };
  app.run(`handleSmartManualEdit({
    currentTarget: document.getElementById('eventForm'),
    preventDefault() {},
    stopImmediatePropagation() {}
  })`);
  const edited = JSON.parse(storage.get('smart-calendar-v1')).extras.find(entry => entry.id === editedEntryId);
  assert.equal(edited.name, 'シフト変更');
});

test('AI schedule confirmation requires approval before adding a complete event', () => {
  assert.doesNotMatch(smartInputScript, /AIにおまかせ入力（おすすめ）/);
  assert.match(smartInputScript, /🦉 AIにおまかせ入力<\/button>/);
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });

  app.document.getElementById('modalBackdrop').classList.add('open');
  app.document.getElementById('smartInputText').value = '明日 18:00-22:00 バイト';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});

  assert.equal(app.run('data.extras.length'), 0);
  assert.equal(app.document.getElementById('smartInputReviewPrompt').textContent, '以下の内容で予定を追加していいですか？');
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /value="バイト"/);
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /value="18:00"/);
  app.document.getElementById('confirmSmartInput').dispatch('click', {});

  assert.equal(app.run('data.extras.length'), 1);
  assert.equal(app.run('data.extras[0].name'), 'バイト');
  assert.equal(app.document.getElementById('smartInputReview').hidden, true);
  assert.equal(app.document.getElementById('modalBackdrop').classList.added.includes('open'), false);
});

test('AI schedule review asks for required information before saving a blank entry', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
  const beforeReview = storage.get('smart-calendar-v1');
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});

  assert.equal(app.document.getElementById('smartInputEntry').hidden, true);
  assert.equal(app.document.getElementById('smartInputReview').hidden, false);
  assert.equal(app.document.getElementById('smartInputReviewPrompt').textContent, '情報が足りません。必要事項を記入してください。');
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /予定名、予定日、開始時刻、終了時刻/);
  assert.equal(app.run('confirmSmartInputReview()'), false);
  assert.equal(app.run('data.extras.length'), 0);
  assert.equal(storage.get('smart-calendar-v1'), beforeReview);
});

test('confirming an ambiguous task creates a plan and 45-to-60-minute study blocks', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
  app.document.getElementById('smartInputText').value = '明日までに 英語課題';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});
  const due = app.run('dateKey(addDays(today, 1))');
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).tasks.length, 0);
  const confirmed = app.run(`(() => {
    smartInputPending[0].name = '英語課題';
    smartInputPending[0].date = '${due}';
    smartInputPending[0].end = '23:59';
    smartInputPending[0].hours = 0.5;
    return confirmSmartInputReview();
  })()`);
  const saved = JSON.parse(storage.get('smart-calendar-v1'));

  assert.equal(confirmed[0].source, 'task');
  assert.equal(saved.tasks[0].due, due);
  assert.equal(saved.plans[0].name, '英語課題');
  assert.equal(saved.sessions.length, 1);
  assert.equal(saved.sessions[0].aiGenerated, true);
  assert.equal(saved.sessions[0].allocatedHours, 0.5);
  assert.equal((app.run(`clockMinutes('${saved.sessions[0].end}') - clockMinutes('${saved.sessions[0].start}')`)), 45);
  assert.ok(saved.sessions[0].day < due);
  assert.equal(app.run('smartInputPending.length'), 0);
});

test('AI smart input extracts core event words and supports detailed categories like club', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  const shift = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('明日はカフェでバイトがある'))`));
  assert.equal(shift.name, 'バイト');
  assert.equal(shift.type, 'work');

  const lesson = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('月曜2限 英語'))`));
  assert.equal(lesson.name, '英語');
  assert.equal(lesson.type, 'class');
  assert.equal(lesson.start, '10:40');
  assert.equal(lesson.end, '12:10');

  const club = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('金曜 17:00-19:00 サークルに参加'))`));
  assert.equal(club.name, 'サークル');
  assert.equal(club.type, 'club');

  const report = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('11/25までに英語レポート提出がある'))`));
  assert.equal(report.name, '英語レポート');
  assert.equal(report.kind, 'task');
});

test('AI review highlights invalid required fields and supports club category in review', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  app.document.getElementById('smartInputText').value = '金曜 17:00-19:00 サークル';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});

  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /value="サークル"/);
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /<option value="club" selected>サークル・部活<\/option>/);
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /<option value="work">アルバイト<\/option>/);

  app.document.getElementById('confirmSmartInput').dispatch('click', {});
  assert.equal(app.run('data.fixed.length'), 1);
  assert.equal(app.run('data.fixed[0].name'), 'サークル');
  assert.equal(app.run('data.fixed[0].type'), 'club');

  const missing = app.run(`JSON.stringify(getSmartInputMissingFields({ kind: 'event', name: '', date: '', start: '', end: '', type: 'club' }))`);
  assert.deepEqual(JSON.parse(missing), ['予定名', '予定日', '開始時刻', '終了時刻']);
});

test('updateSmartInputReviewPrompt adds is-invalid class to missing required inputs', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  const row = app.document.createElement();
  const nameInput = app.document.createElement();
  const dateInput = app.document.createElement();
  const startInput = app.document.createElement();
  const endInput = app.document.createElement();
  const requiredEl = app.document.createElement();
  row.querySelector = selector => {
    if (selector === '[data-smart-field="name"]') return nameInput;
    if (selector === '[data-smart-field="date"]') return dateInput;
    if (selector === '[data-smart-field="start"]') return startInput;
    if (selector === '[data-smart-field="end"]') return endInput;
    if (selector === '.smart-input-required') return requiredEl;
    return app.document.createElement();
  };
  app.document.getElementById('smartInputReviewList').querySelectorAll = () => [row];
  app.run(`updateSmartInputReviewPrompt([{
    kind: 'event',
    repeat: 'once',
    name: '',
    date: '',
    start: '',
    end: '',
    type: 'personal'
  }])`);

  assert.ok(nameInput.classList.added.includes('is-invalid'));
  assert.ok(dateInput.classList.added.includes('is-invalid'));
  assert.ok(startInput.classList.added.includes('is-invalid'));
  assert.ok(endInput.classList.added.includes('is-invalid'));
  assert.ok(requiredEl.classList.added.includes('has-missing'));
});

test('rest defers unfinished AI blocks while preserving manual and completed sessions', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    const tomorrow = dateKey(addDays(today, 1));
    const due = dateKey(addDays(today, 3));
    data.tasks = [{ id: 'rest-task', name: '休息後の課題', due, hours: 1, remaining: 1, done: false }];
    data.sessions = [
      { id: 'today-ai', taskId: 'rest-task', name: '今日のAI枠', day, start: '12:00', end: '13:00', type: 'study', done: false, aiGenerated: true },
      { id: 'done-ai', taskId: 'other-task', name: '完了済み', day, start: '13:00', end: '14:00', type: 'study', done: true, aiGenerated: true },
      { id: 'manual', taskId: 'other-task', name: '手動予定', day, start: '14:00', end: '15:00', type: 'study', done: false }
    ];
    const deferred = deferTodaysAiStudyBlocks();
    return JSON.stringify({
      deferred,
      sessions: data.sessions,
      restDays: data.restDays,
      tomorrow
    });
  })()`));
  const saved = JSON.parse(storage.get('smart-calendar-v1'));

  assert.equal(result.deferred, 1);
  assert.deepEqual(result.restDays, [app.run('dateKey(today)')]);
  assert.ok(result.sessions.some(session => session.id === 'done-ai' && session.done));
  assert.ok(result.sessions.some(session => session.id === 'manual'));
  assert.ok(result.sessions.some(session => session.aiGenerated && session.day === result.tomorrow));
  assert.ok(saved.sessions.every(session => session.id !== 'today-ai'));
});

test('today mission completion updates study progress and celebrates with TASKROU', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  const result = JSON.parse(app.run(`(() => {
    const task = { id: 'mission-task', name: '英語課題', due: dateKey(addDays(today, 3)), hours: 0.75, remaining: 0.75, done: false };
    const session = { id: 'mission-session', taskId: task.id, name: task.name, day: dateKey(today), start: '12:00', end: '12:45', type: 'study', done: false, aiGenerated: true, allocatedHours: 0.75 };
    data.tasks = [task];
    data.sessions = [session];
    renderCharacterStation();
    const missionMarkup = document.getElementById('todayMissionList').innerHTML;
    completeTodayMission('session', session.id, task.id);
    return JSON.stringify({
      missionMarkup,
      done: session.done,
      remaining: task.remaining,
      mood: document.getElementById('characterAvatar').getAttribute('aria-label'),
      message: document.getElementById('characterMessage').textContent
    });
  })()`));

  assert.match(result.missionMarkup, /英語課題/);
  assert.equal(result.done, true);
  assert.equal(result.remaining, 0);
  assert.equal(result.mood, 'TASKROU、お祝いの表情');
  assert.match(result.message, /今日のミッション達成/);
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
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
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
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
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

test('character station warns about overloaded days and lets the user inspect plans before resting', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  const result = JSON.parse(app.run(`(() => {
    const day = dateKey(today);
    data.fixed = [{ id: 'long-day', name: '予定', day: today.getDay(), start: '07:00', end: '21:00', type: 'class' }];
    data.tasks = [{ id: 'urgent', name: '明日期限', due: day, remaining: 5, done: false }];
    data.sessions = [];
    getTodayCapacity = () => ({ isOverloaded: true, availableMinutes: 0, demandMinutes: 300 });
    renderCharacterStation();
    const overloaded = {
      markup: document.getElementById('characterAvatar').innerHTML,
      label: document.getElementById('characterAvatar').getAttribute('aria-label'),
      message: document.getElementById('characterMessage').textContent,
      warningHidden: document.getElementById('capacityPanic').hidden
    };
    document.getElementById('characterChoiceOne').dispatch('click', {});
    document.getElementById('characterChoiceThree').dispatch('click', {});
    const resting = {
      markup: document.getElementById('characterAvatar').innerHTML,
      label: document.getElementById('characterAvatar').getAttribute('aria-label'),
      message: document.getElementById('characterMessage').textContent,
      restDays: data.restDays
    };
    return JSON.stringify({ overloaded, resting });
  })()`));

  assert.match(result.overloaded.markup, /data-mood="concerned"/);
  assert.equal(result.overloaded.label, 'TASKROU、心配の表情');
  assert.match(result.overloaded.message, /無理/);
  assert.equal(result.overloaded.warningHidden, false);
  assert.match(result.resting.markup, /data-mood="resting"/);
  assert.equal(result.resting.label, 'TASKROU、休息の表情');
  assert.match(result.resting.message, /休もう|休む|ゆっくり/);
  assert.deepEqual(result.resting.restDays, [app.run('dateKey(today)')]);
});

test('AI character is rendered as inline owl artwork with a mood-specific expression', () => {
  const app = createAppHarness();
  const rawResult = app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    data.tasks = [{ id: 'priority', name: '小テスト対策', due: dateKey(addDays(today, 3)), hours: 2, remaining: 2, done: false }];
    data.plans = [];
    getTodayCapacity = () => ({ isOverloaded: false, availableMinutes: 120, demandMinutes: 60 });
    renderCharacterStation();
    return JSON.stringify({
      markup: document.getElementById('characterAvatar').innerHTML,
      label: document.getElementById('characterAvatar').getAttribute('aria-label'),
      message: document.getElementById('characterMessage').textContent
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
  assert.match(result.message, /\d{2}:\d{2}〜\d{2}:\d{2}/);
  assert.match(dashboardEnhancementsScript, /TASKROU · AI STUDY COMPANION/);
  assert.match(dashboardEnhancementsScript, /\.character-bubble::before/);
  assert.doesNotMatch(dashboardEnhancementsScript, /登録済みの課題・予定をもとに/);
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
    getTodayCapacity = () => ({ isOverloaded: false, availableMinutes: 120, demandMinutes: 0 });
    celebrateTaskCompletion('finished');
    return document.getElementById('characterAvatar').innerHTML;
  })()`);

  assert.match(result, /data-mood="celebratory"/);
  assert.match(result, /class="owl-eye" d="M48 75/);
  assert.match(result, /owl-confetti/);
  assert.match(result, /owl-books/);
});

test('TASKROU presents schedule-focused three-choice conversations without a text chat', () => {
  const app = createAppHarness();
  app.run(`data.fixed = []; data.extras = []; data.sessions = []; data.plans = []; data.tasks = [
    { id: 'stats', name: '統計レポート', due: dateKey(addDays(today, 2)), hours: 2, remaining: 1, done: false },
    { id: 'english', name: '英語資料', due: dateKey(addDays(today, 4)), hours: 1, remaining: 1, done: false }
  ]; data.fixed = [{ id: 'class-today', name: 'ゼミ', day: today.getDay(), start: '13:00', end: '14:30', type: 'class' }]; getTodayCapacity = () => ({ isOverloaded: false, availableMinutes: 120, demandMinutes: 60 }); renderCharacterStation()`);

  const suggestedTaskName = app.run('characterSuggestedTaskName');
  const alternativeName = app.run(`getPriorityPlans().find(plan => plan.name !== characterSuggestedTaskName).name`);
  const nearestDeadlineName = app.run('getPriorityPlans()[0].name');
  assert.match(dashboardEnhancementsScript, /タスクロウへの返答/);
  assert.doesNotMatch(dashboardEnhancementsScript, /characterChatForm|characterChatInput|characterChatHistory/);
  assert.equal(app.document.getElementById('characterChoiceOne').textContent, 'この時間に進める');
  assert.equal(app.document.getElementById('characterChoiceTwo').textContent, '別の時間を探す');
  assert.equal(app.document.getElementById('characterChoiceThree').textContent, '今日の予定を見る');
  assert.match(app.document.getElementById('characterMessage').textContent, new RegExp(suggestedTaskName));

  const acceptanceVariants = [0, 0.34, 0.67].map(randomValue => {
    app.run(`Math.random = () => ${randomValue}; characterDialogue.step = 'suggestion'; renderCharacterStation()`);
    app.document.getElementById('characterChoiceOne').dispatch('click', {});
    return app.document.getElementById('characterMessage').textContent;
  });
  assert.equal(new Set(acceptanceVariants).size, 3);

  app.run("characterDialogue.step = 'suggestion'; renderCharacterStation()");
  app.document.getElementById('characterChoiceOne').dispatch('click', {});
  assert.equal(app.document.getElementById('characterAvatar').getAttribute('aria-label'), 'TASKROU、気合十分の表情');
  assert.match(app.document.getElementById('characterMessage').textContent, new RegExp(suggestedTaskName));
  assert.equal(app.document.getElementById('characterChoiceThree').textContent, '別の課題を見る');
  app.document.getElementById('characterChoiceThree').dispatch('click', {});
  assert.match(app.document.getElementById('characterMessage').textContent, new RegExp(alternativeName));

  app.run("characterDialogue.step = 'suggestion'; renderCharacterStation()");
  app.document.getElementById('characterChoiceThree').dispatch('click', {});
  assert.match(app.document.getElementById('characterMessage').textContent, /ゼミ/);
  assert.equal(app.document.getElementById('characterChoiceOne').textContent, '空き時間を探す');
  assert.equal(app.document.getElementById('characterChoiceTwo').textContent, '締切が近い課題を見る');
  assert.equal(app.document.getElementById('characterChoiceThree').textContent, '今日は休む');

  app.document.getElementById('characterChoiceTwo').dispatch('click', {});
  assert.match(app.document.getElementById('characterMessage').textContent, new RegExp(nearestDeadlineName));
  assert.match(app.document.getElementById('characterMessage').textContent, /締切/);
  assert.equal(app.document.getElementById('characterChoiceOne').textContent, 'この課題を進める');

  app.document.getElementById('characterChoiceTwo').dispatch('click', {});
  assert.match(app.document.getElementById('characterMessage').textContent, /空いて|空き時間/);
  assert.equal(app.document.getElementById('characterChoiceOne').textContent, 'この時間がよさそう');
  assert.equal(app.run('data.activeTimer'), null);
});

test('task modal keeps local image attachments available without a quick-input panel', async () => {
  const imageDatabase = createMemoryImageDatabase();
  const storage = new Map();
  const openedImageUrls = [];
  const imageApp = createAppHarness(storage, {
    indexedDB: imageDatabase.indexedDB,
    URL: { createObjectURL(blob) { const url = `blob:${blob.name}`; openedImageUrls.push(url); return url; }, revokeObjectURL() {} }
  });
  const file = { name: 'lecture-notes.png', type: 'image/png', size: 1024 };
  imageApp.run("openModal('task')");
  const fileInput = imageApp.document.getElementById('quickImageFile');
  imageApp.document.getElementById('quickImageInput').dispatch('click', {});
  assert.equal(fileInput.clicked, true);
  fileInput.files = [file];
  fileInput.dispatch('change', { currentTarget: fileInput });

  assert.equal(imageApp.document.getElementById('eventType').value, 'task');
  assert.equal(imageApp.document.getElementById('quickImageField').hidden, false);
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
  const midday = new Date();
  midday.setHours(12, 0, 0, 0);
  const fixedNow = midday.getTime();
  class MiddayDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return fixedNow; }
  }
  const app = createAppHarness(storage, { Date: MiddayDate });
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
  assert.match(app.document.getElementById('characterAvatar').innerHTML, /data-timer-active="true"/);
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).sessions[0].taskId, 'quick-task');
  const restoredApp = createAppHarness(storage, { Date: MiddayDate });
  assert.equal(restoredApp.run('data.activeTimer.sessionId'), result.session.id);

  app.run('data.activeTimer.endsAt = Date.now() - 1; updateStudyTimer()');
  assert.equal(app.run('data.activeTimer'), null);
  assert.equal(app.document.getElementById('studyTimerReadout').hidden, true);
  assert.equal(app.run('data.sessions[0].done'), false);
});

test('calendar styles AI study blocks, progress, and deadlines', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  const result = JSON.parse(app.run(`(() => {
    data.fixed = [];
    data.extras = [];
    data.sessions = [];
    const due = dateKey(addDays(today, 2));
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
    data.sessions.forEach(session => { session.day = due; });
    selectCalendarDate(due);
    renderCalendar();
    const calendar = document.getElementById('calendarGrid').innerHTML;
    data.sessions.filter(session => session.taskId.startsWith(plan.id)).map(session => session.id).forEach(toggleSession);
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
  assert.match(result.calendar, /0\/1完了（0%）/);
  assert.match(result.calendar, /class="day-head[^"]*has-deadline"/);
  assert.match(result.calendar, /締め切り/);
  assert.doesNotMatch(result.calendar, /🎯/);
  assert.match(result.completedCalendar, /1\/1完了（100%）/);
});

test('floating schedule button opens general event entry and keeps task selection available', () => {
  const app = createAppHarness();
  app.document.getElementById('taskFab').dispatch('click', {});

  assert.match(dashboardEnhancementsScript, /position: fixed; right: 24px; bottom: 24px; z-index: 9/);
  assert.match(dashboardEnhancementsScript, /aria-label="予定を追加">＋ <span>予定を追加<\/span>/);
  assert.match(html, /\.modal-backdrop\{[^}]*z-index:10/);
  assert.doesNotMatch(html, /id="addBtn"/);
  assert.doesNotMatch(html, /id="rerouteBtn"/);
  assert.doesNotMatch(html, /未完了の予定を再配置/);
  assert.ok(app.document.getElementById('modalBackdrop').classList.added.includes('open'));
  assert.equal(app.document.getElementById('eventType').value, 'class');
  app.document.getElementById('eventType').value = 'task';
  app.document.getElementById('eventType').dispatch('change', {
    target: app.document.getElementById('eventType'),
    currentTarget: app.document.getElementById('eventType')
  });
  assert.equal(app.document.getElementById('dueField').hidden, false);
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
  assert.match(app.document.getElementById('taskOverviewSummary').textContent, /全1件/);
  assert.equal(app.document.getElementById('modalBackdrop').classList.added.includes('open'), false);
  assert.ok(app.document.body.classList.added.includes('task-overview-active'));

  app.document.querySelector('.nav-item.active').dispatch('click', {});
  assert.equal(app.document.getElementById('taskOverview').hidden, true);
  assert.equal(app.document.body.classList.added.includes('task-overview-active'), false);
});

test('workspace fixed schedule navigation opens the recurring schedule list without opening the add form', () => {
  const app = createAppHarness();
  app.run(`data.fixed = [
    { id: 'later', name: 'ゼミ', day: 3, start: '13:00', end: '14:00', type: 'class' },
    { id: 'monday-late', name: '統計学', day: 1, start: '10:00', end: '11:00', type: 'class' },
    { id: 'monday-early', name: 'ミクロ経済学', day: 1, start: '09:00', end: '10:00', type: 'class' }
  ]`);

  app.document.getElementById('fixedNav').dispatch('click', {});

  const list = app.document.getElementById('fixedOverviewList').innerHTML;
  assert.equal(app.document.getElementById('fixedOverview').hidden, false);
  assert.match(app.document.getElementById('fixedOverviewSummary').textContent, /毎週の固定予定 3件/);
  assert.ok(list.indexOf('ミクロ経済学') < list.indexOf('統計学'));
  assert.ok(list.indexOf('統計学') < list.indexOf('ゼミ'));
  assert.match(list, /月曜日/);
  assert.match(list, /授業/);
  assert.equal(app.document.getElementById('modalBackdrop').classList.added.includes('open'), false);
  assert.ok(app.document.getElementById('fixedNav').classList.added.includes('active'));

  app.document.getElementById('tasksNav').dispatch('click', {});
  assert.equal(app.document.getElementById('fixedOverview').hidden, true);
  assert.ok(app.document.body.classList.added.includes('task-overview-active'));
  assert.equal(app.document.getElementById('fixedNav').classList.added.includes('active'), false);
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
  assert.doesNotMatch(result.expanded, /難易度|単位数|残り時間/);
  assert.match(result.expanded, /変更する（編集）/);
  assert.match(result.expanded, /教科書 p\.50〜100/);
  assert.match(result.expanded, /約0\.8時間/);
  assert.match(result.collapsed, /aria-expanded="false"/);
  assert.match(result.collapsed, /task-overview-details[^>]* hidden/);
});

test('planning duration and actual session deviation persist for the selected week', () => {
  const storage = new Map();
  const app = createAppHarness(storage);
  app.run(`data.sessions = [{ id: 'review-session', taskId: 'review-task', name: '復習', day: dateKey(today), start: '14:00', end: '15:00', type: 'study', done: false }]`);
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
  app.run(`data.sessions = [{ id: 'review-session', taskId: 'review-task', name: '復習', day: dateKey(today), start: '14:00', end: '15:00', type: 'study', done: false }]`);
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

test('AI smart input shows 予定を追加 title, centers review action buttons, and does not require study hours', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });

  app.run(`openModal('class')`);
  assert.equal(app.document.getElementById('modalTitle').textContent, '予定を追加');

  assert.match(smartInputScript, /\.smart-input-review-actions button[^{]*\{[^}]*justify-content:\s*center/);

  const missingWithoutEnd = JSON.parse(app.run(`JSON.stringify(getSmartInputMissingFields({ kind: 'task', name: '英語課題', date: dateKey(addDays(today, 2)), end: '', hours: 0 }))`));
  assert.deepEqual(missingWithoutEnd, ['締め切り時刻']);

  const missingWithEnd = JSON.parse(app.run(`JSON.stringify(getSmartInputMissingFields({ kind: 'task', name: '英語課題', date: dateKey(addDays(today, 2)), end: '23:59', hours: 0 }))`));
  assert.deepEqual(missingWithEnd, []);

  app.document.getElementById('smartInputText').value = '明日までに 英語課題';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});
  assert.equal(app.document.getElementById('smartInputReviewPrompt').textContent, '情報が足りません。必要事項を記入してください。');
  assert.equal(app.run('confirmSmartInputReview()'), false);

  app.document.getElementById('smartInputText').value = '明日 23:59までに 英語課題';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});
  assert.equal(app.document.getElementById('smartInputReviewPrompt').textContent, '以下の内容で予定を追加していいですか？');
  const confirmed = app.run('confirmSmartInputReview()');
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].source, 'task');
  assert.equal(JSON.parse(storage.get('smart-calendar-v1')).tasks[0].hours, 1.5);
  assert.equal(app.document.getElementById('taskCount').textContent, 1);
  assert.doesNotMatch(dashboardEnhancementsScript, /<span>今日のひとこと<\/span>/);
  assert.match(dashboardEnhancementsScript, /class="character-missions" hidden/);
});

test('custom calendar date picker and scrollable time picker render options and update target inputs', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  const dateInput = app.document.createElement();
  dateInput.tagName = 'INPUT';
  dateInput.type = 'date';
  dateInput.min = app.run('dateKey(today)');
  dateInput.value = '';

  app.run('openCustomPicker')(dateInput);
  const calendarHtml = app.run('customPickerState.popover.innerHTML');
  assert.match(calendarHtml, /sc-cal-grid/);
  assert.match(calendarHtml, /data-cal-date/);

  const tomorrowKey = app.run('dateKey(addDays(today, 1))');
  app.run('emitPickerValue')(dateInput, tomorrowKey);
  assert.equal(dateInput.value, tomorrowKey);

  const timeInput = app.document.createElement();
  timeInput.tagName = 'INPUT';
  timeInput.type = 'time';
  timeInput.value = '18:30';

  app.run('openCustomPicker')(timeInput);
  const timeHtml = app.run('customPickerState.popover.innerHTML');
  assert.match(timeHtml, /data-wheel="hour"/);
  assert.match(timeHtml, /data-wheel="minute"/);
  assert.match(timeHtml, /data-wheel-value="1"/);
  assert.match(timeHtml, /data-wheel-value="59"/);
  assert.match(timeHtml, /data-wheel-value="18"/);
  assert.match(timeHtml, /data-wheel-value="30"/);
  assert.equal(app.run('customPickerState.minuteStep'), 1);
  assert.equal(app.run('customPickerState.hour'), 18);
  assert.equal(app.run('customPickerState.minute'), 30);
  assert.doesNotMatch(smartInputScript, /data-smart-template/);
  assert.doesNotMatch(smartInputScript, /＋ バイト 4h/);

  app.run('emitPickerValue')(timeInput, '19:47');
  assert.equal(timeInput.value, '19:47');
});

test('AI smart input calculates end time from start + duration, extracts clean names, and reflects deadline-only tasks on the calendar', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });

  const shift1 = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('18時から4時間バイト'))`));
  assert.equal(shift1.start, '18:00');
  assert.equal(shift1.end, '22:00');
  assert.equal(shift1.name, 'バイト');

  const shift2 = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('19日14時から8時間バイト'))`));
  assert.equal(shift2.start, '14:00');
  assert.equal(shift2.end, '22:00');
  assert.equal(shift2.name, 'バイト');

  const shift3 = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('10時から12時間バイト'))`));
  assert.equal(shift3.start, '10:00');
  assert.equal(shift3.end, '22:00');
  assert.equal(shift3.name, 'バイト');

  app.document.getElementById('smartInputText').value = '明日 17:00まで 英語レポート';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});
  const confirmed = app.run('confirmSmartInputReview()');
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].source, 'task');

  const saved = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(saved.sessions.length, 2);
  assert.equal(saved.sessions[0].start, '16:00');
  assert.equal(saved.sessions[0].end, '17:00');
  assert.match(saved.sessions[1].name, /^【学習】英語レポート$/);
  assert.match(app.document.getElementById('calendarGrid').innerHTML, /英語レポート（締切）/);
});

test('AI smart input keeps explicit dates as one-off events and avoids matching 日 inside dates or words as Sunday', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });

  const day20 = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('20日からバイト'))`));
  assert.equal(day20.repeat, 'once');
  assert.equal(day20.date, app.run(`(() => { const d = new Date(today); d.setDate(20); if (dateKey(d) < dateKey(today)) d.setMonth(d.getMonth() + 1); return dateKey(d); })()`));

  const day20WithRange = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('20日から 18:00-22:00 バイト'))`));
  assert.equal(day20WithRange.repeat, 'once');
  assert.equal(day20WithRange.date, day20.date);
  assert.equal(day20WithRange.start, '18:00');
  assert.equal(day20WithRange.end, '22:00');

  const tomorrow = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('明日バイト'))`));
  assert.equal(tomorrow.repeat, 'once');
  assert.equal(tomorrow.date, app.run('dateKey(addDays(today, 1))'));

  const wordWithDay = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('明日 18:00-19:00 日本語学習'))`));
  assert.equal(wordWithDay.repeat, 'once');

  const isoDateOnly = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('2026-11-20 バイト'))`));
  assert.equal(isoDateOnly.repeat, 'once');
  assert.equal(isoDateOnly.date, '2026-11-20');
  assert.equal(isoDateOnly.start, '');
  assert.equal(isoDateOnly.end, '');
});

test('AI smart input includes Tesseract v5 CDN, image attachment UI, and combines image OCR with text', async () => {
  assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\/dist\/tesseract\.min\.js/);
  assert.match(smartInputScript, /id="smartImageBtn"[^>]*>📷 画像を添付</);
  assert.match(smartInputScript, /id="smartImagePreview"/);
  assert.match(smartInputScript, /id="smartImageRemove"[^>]*>×</);

  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  app.run(`
    Tesseract = {
      async recognize(dataUrl, lang) {
        globalThis.__ocrCall = { dataUrl, lang };
        return { data: { text: '明日 18:00-22:00 バイト' } };
      }
    };
    smartInputImage = { file: { name: 'shift.png' }, dataUrl: 'data:image/png;base64,AAA', name: 'shift.png' };
    smartImagePreviewWrap.hidden = false;
    smartInputText.value = 'これ追加して';
  `);

  await app.run('analyzeSmartInput()');
  const ocrCall = JSON.parse(app.run('JSON.stringify(globalThis.__ocrCall)'));
  assert.equal(ocrCall.lang, 'jpn+eng');
  assert.equal(ocrCall.dataUrl, 'data:image/png;base64,AAA');
  assert.equal(app.run('smartInputPending.length'), 1);
  assert.equal(app.run('smartInputPending[0].name'), 'バイト');
  assert.equal(app.run('smartInputPending[0].start'), '18:00');
  assert.equal(app.run('smartInputPending[0].end'), '22:00');

  app.run('clearSmartInputImage()');
  assert.equal(app.run('smartInputImage'), null);
  assert.equal(app.document.getElementById('smartImagePreviewWrap').hidden, true);
});

test('AI smart input filters timetable OCR with user instructions and highlights missing fields', async () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  let statusDuringOcr = '';
  app.run(`
    Tesseract = {
      async recognize() {
        return {
          data: {
            text: '時間割\\n月 火 水\\n月曜1限 経済学 | 火曜1限 英語\\n月曜 バイト\\n水曜3限 マーケティング'
          }
        };
      }
    };
    smartInputImage = { file: { name: 'timetable.png' }, dataUrl: 'data:image/png;base64,BBB', name: 'timetable.png' };
    smartInputText.value = '月曜の授業だけ追加';
  `);

  const promise = app.run('analyzeSmartInput()');
  statusDuringOcr = app.document.getElementById('smartInputStatus').textContent;
  await promise;

  assert.equal(statusDuringOcr, '画像を読み取り中...');
  assert.equal(app.run('smartInputPending.length'), 1);
  assert.equal(app.run('smartInputPending[0].name'), '経済学');
  assert.equal(app.run('smartInputPending[0].weekday'), 1);
  assert.equal(app.run('smartInputPending[0].start'), '09:00');
  assert.equal(app.run('smartInputPending[0].end'), '10:30');

  const incompleteOcr = JSON.parse(app.run(`JSON.stringify(parseSmartInputWithImage('', '金曜 サークル'))`));
  assert.equal(incompleteOcr.length, 1);
  assert.deepEqual(
    JSON.parse(app.run(`JSON.stringify(getSmartInputMissingFields(${JSON.stringify(incompleteOcr[0])}))`)),
    ['開始時刻', '終了時刻']
  );
});

test('AI smart input parses deadline expressions, excludes LMS noise, and merges a single task detail page', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });

  const deadlineLine = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('期限 月曜 (23:59までに)'))`));
  assert.equal(deadlineLine.kind, 'task');
  assert.equal(deadlineLine.end, '23:59');
  assert.equal(deadlineLine.start, '');
  assert.equal(new Date(`${deadlineLine.date}T00:00:00`).getDay(), 1);
  assert.ok(deadlineLine.date >= app.run('dateKey(today)'));

  const shortDeadline = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('締切 23:59 数学課題'))`));
  assert.equal(shortDeadline.kind, 'task');
  assert.equal(shortDeadline.end, '23:59');
  assert.equal(shortDeadline.start, '');

  const lmsOcrText = [
    'アカウント',
    'ダッシュボード',
    'コース',
    'カレンダー',
    'メッセージ',
    '履歴',
    'ヘルプ',
    'モジュール',
    'ディスカッション',
    '最終制作レポート',
    '期限 月曜 (23:59までに)',
    'ポイント 100',
    '提出方法 ファイルのアップロード',
    '2026年11月xx日',
    '※デモ動画は別課題から提出してください'
  ].join('\\n');

  const extracted = JSON.parse(app.run(`JSON.stringify(parseSmartInputWithImage('', '${lmsOcrText}'))`));
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].kind, 'task');
  assert.equal(extracted[0].name, '最終制作レポート');
  assert.equal(extracted[0].end, '23:59');
  assert.equal(new Date(`${extracted[0].date}T00:00:00`).getDay(), 1);
  assert.doesNotMatch(smartInputScript, /preprocessSmartInputImage/);
});

test('AI smart input uses date/time anchors to switch between single-event aggregation and multi-event extraction', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });

  const noiseOnly = JSON.parse(app.run(`JSON.stringify(parseOcrByDateTimeAnchors('メニュー\\n2026年11月xx日\\n※注意書き'))`));
  assert.equal(noiseOnly.length, 0);

  const lineChatOcr = [
    '大学祭ミーティング',
    '11/20 18:00-19:30',
    '場所は3号館201教室',
    '※持ち物なし'
  ].join('\\n');
  const singleEvent = JSON.parse(app.run(`JSON.stringify(parseOcrByDateTimeAnchors('${lineChatOcr}'))`));
  assert.equal(singleEvent.length, 1);
  assert.equal(singleEvent[0].kind, 'event');
  assert.equal(singleEvent[0].name, '大学祭ミーティング');
  assert.equal(singleEvent[0].start, '18:00');
  assert.equal(singleEvent[0].end, '19:30');

  const shiftTableOcr = [
    'シフト表',
    '11/18 18:00-22:00',
    'カフェバイト',
    '11/19 10:00-14:00 カフェバイト',
    '水曜6限 夜間ゼミ'
  ].join('\\n');
  const multiEvents = JSON.parse(app.run(`JSON.stringify(parseOcrByDateTimeAnchors('${shiftTableOcr}'))`));
  assert.equal(multiEvents.length, 3);
  assert.equal(multiEvents[0].name, 'カフェバイト');
  assert.equal(multiEvents[0].start, '18:00');
  assert.equal(multiEvents[0].end, '22:00');
  assert.equal(multiEvents[2].start, '18:10');
  assert.equal(multiEvents[2].end, '19:40');
});

test('AI smart input cleans OCR spacing, extracts largest bbox title, shows debug OCR text, and guarantees 1 fallback item', async () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });

  assert.equal(
    app.run(`cleanOcrText('最 終 制 作 レ ポ ー ト\\n月 曜 23 : 59 ま で に')`),
    '最終制作レポート\n月曜 23:59までに'
  );

  app.run(`
    Tesseract = {
      async recognize() {
        return {
          data: {
            text: 'https://lms.example.jp/course\\nコ ー ス\\n最 終 制 作 レ ポ ー ト\\n詳 細 を 確 認 し て く だ さ い',
            lines: [
              { text: 'https://lms.example.jp/course', bbox: { x0: 20, y0: 10, x1: 400, y1: 30 } },
              { text: 'コ ー ス', bbox: { x0: 10, y0: 200, x1: 90, y1: 230 } },
              { text: '最 終 制 作 レ ポ ー ト', bbox: { x0: 200, y0: 160, x1: 700, y1: 220 } },
              { text: '詳 細 を 確 認 し て く だ さ い', bbox: { x0: 200, y0: 260, x1: 600, y1: 280 } }
            ]
          }
        };
      }
    };
    smartInputImage = { file: { name: 'report.png' }, dataUrl: 'data:image/png;base64,CCC', name: 'report.png' };
    smartInputText.value = '';
  `);

  await app.run('analyzeSmartInput()');
  assert.equal(app.run('smartInputPending.length'), 1);
  assert.equal(app.run('smartInputPending[0].name'), '最終制作レポート');
  assert.equal(app.run('smartInputPending[0].date'), '');
  assert.equal(app.document.getElementById('smartOcrDebug').hidden, false);
  assert.match(app.document.getElementById('smartOcrDebugText').textContent, /最終制作レポート/);

  const mergedWithOverride = JSON.parse(app.run(`JSON.stringify(parseSmartInputWithImage('11/20 17:00までに 課題として登録して', 'データサイエンス概論\\n詳細を確認してください', { mainTitle: 'データサイエンス概論', guaranteeSingle: true }))`));
  assert.equal(mergedWithOverride.length, 1);
  assert.equal(mergedWithOverride[0].name, 'データサイエンス概論');
  assert.equal(mergedWithOverride[0].kind, 'task');
  assert.equal(mergedWithOverride[0].end, '17:00');

  const noisyHeadingOcr = [
    'コース > 第10回課題 > 提出',
    '以下の手順をよく読んで、期限までに必ず提出してください。',
    '最終制作レポート - モジュール',
    '期限 月曜 (23:59までに)',
    '提出後はお知らせを確認してください'
  ].join('\\n');
  const titleFromUpper = JSON.parse(app.run(`JSON.stringify(parseOcrByDateTimeAnchors('${noisyHeadingOcr}'))`));
  assert.equal(titleFromUpper.length, 1);
  assert.equal(titleFromUpper[0].name, '最終制作レポート');

  assert.equal(app.run(`extractShortTitlePhrase('これは20文字を超える長い説明文のテストです。')`), '');
  assert.equal(app.run(`extractShortTitlePhrase('短いですが、読点があります')`), '');
});

test('AI smart input supports image crop UI and renders up to 5 clickable title suggestion chips', async () => {
  assert.match(smartInputScript, /id="smartImageCropStage"/);
  assert.match(smartInputScript, /id="smartCropRect"/);
  assert.match(smartInputScript, /id="smartCropReset"/);

  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
  app.run(`
    Tesseract = {
      async recognize() {
        return {
          data: {
            text: '経営学レポート\\n中間発表\\nマーケティング\\nゼミ合宿\\n英語プレゼン\\n統計学課題\\n11/20 17:00まで'
          }
        };
      }
    };
    smartInputImage = {
      file: { name: 'flyer.png' },
      dataUrl: 'data:image/png;base64,DDD',
      name: 'flyer.png',
      crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 }
    };
    updateSmartCropRectUi(smartInputImage.crop);
  `);

  assert.equal(app.document.getElementById('smartCropRect').hidden, false);
  assert.equal(app.document.getElementById('smartCropRect').style.left, '10.00%');
  assert.equal(app.document.getElementById('smartCropReset').hidden, false);

  await app.run('analyzeSmartInput()');
  const chips = JSON.parse(app.run('JSON.stringify(smartOcrTitleSuggestions)'));
  assert.equal(chips.length, 5);
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /data-smart-title-chip="経営学レポート"/);
  assert.match(app.document.getElementById('smartInputReviewList').innerHTML, /data-smart-title-chip="英語プレゼン"/);
});

test('tasks added via AI smart input do not carry aiGenerated flags or AI badges', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });

  app.document.getElementById('smartInputText').value = '明日 17:00まで 英語レポート';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});
  app.run('confirmSmartInputReview()');

  const saved = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(saved.tasks[0].aiGenerated, undefined);
  assert.equal(saved.plans[0].aiGenerated, undefined);
  assert.equal(saved.sessions[0].aiGenerated, undefined);
  assert.doesNotMatch(app.document.getElementById('calendarGrid').innerHTML, /ai-study|ai-generated|ai-badge/);
  assert.doesNotMatch(dashboardEnhancementsScript, /\.event\.ai-study \.event-title::before/);
});

test('AI smart input defaults to once, switches to weekly class for timetable/fixed keywords, and parses X/Y timetable grids', () => {
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });

  const oneOff = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('明日 18:00-22:00 バイト'))`));
  assert.equal(oneOff.repeat, 'once');

  const fixedKeyword = JSON.parse(app.run(`JSON.stringify(parseSmartInputLine('固定 月曜 10:40-12:10 ゼミ'))`));
  assert.equal(fixedKeyword.repeat, 'weekly');
  assert.equal(fixedKeyword.type, 'class');
  assert.deepEqual(
    JSON.parse(app.run(`JSON.stringify(getSmartInputMissingFields({ kind: 'event', name: 'ゼミ', repeat: 'weekly', weekday: 1, date: '', start: '10:40', end: '12:10', type: 'class' }))`)),
    []
  );

  const words = [
    { text: '月', bbox: { x0: 120, y0: 20, x1: 150, y1: 44 } },
    { text: '火', bbox: { x0: 240, y0: 20, x1: 270, y1: 44 } },
    { text: '水', bbox: { x0: 360, y0: 20, x1: 390, y1: 44 } },
    { text: '1限', bbox: { x0: 20, y0: 90, x1: 60, y1: 115 } },
    { text: '2限', bbox: { x0: 20, y0: 180, x1: 60, y1: 205 } },
    { text: 'ミクロ', bbox: { x0: 110, y0: 85, x1: 165, y1: 105 } },
    { text: '経済学', bbox: { x0: 110, y0: 108, x1: 165, y1: 128 } },
    { text: 'A101', bbox: { x0: 115, y0: 130, x1: 155, y1: 145 } },
    { text: '統計学', bbox: { x0: 230, y0: 175, x1: 285, y1: 195 } },
    { text: '3-201', bbox: { x0: 235, y0: 198, x1: 280, y1: 215 } }
  ];
  const grid = JSON.parse(app.run(`JSON.stringify(extractTimetableGridFromOcr(${JSON.stringify(words)}, []))`));
  assert.equal(grid.length, 2);
  assert.equal(grid[0].name, 'ミクロ経済学');
  assert.equal(grid[0].weekday, 1);
  assert.equal(grid[0].repeat, 'weekly');
  assert.equal(grid[0].type, 'class');
  assert.equal(grid[0].start, '09:00');
  assert.equal(grid[0].end, '10:30');
  assert.ok(grid[0].date >= app.run('dateKey(today)'));
  assert.equal(grid[1].name, '統計学');
  assert.equal(grid[1].weekday, 2);
  assert.equal(grid[1].start, '10:40');
  assert.equal(grid[1].end, '12:10');
});

test('local settings persist nickname and custom category colors across reload', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });

  assert.match(dashboardEnhancementsScript, /id="settingsNav"[^>]*>.*設定/);
  assert.equal(app.document.querySelector('.sidebar-foot .user-name').textContent, 'マイカレンダー');
  assert.doesNotMatch(app.document.getElementById('characterMessage').textContent, /さん、/);

  app.run(`saveUserSettings({
    nickname: '田中',
    colors: {
      class: '#112233',
      work: '#223344',
      club: '#334455',
      study: '#445566',
      personal: '#556677'
    }
  })`);

  assert.equal(app.document.querySelector('.sidebar-foot .user-name').textContent, '田中さんのカレンダー');
  assert.match(app.document.getElementById('characterMessage').textContent, /^田中さん、/);

  const reloaded = createAppHarness(storage, { Date: createFixedDate(12) });
  assert.equal(reloaded.document.querySelector('.sidebar-foot .user-name').textContent, '田中さんのカレンダー');
  assert.match(reloaded.document.getElementById('characterMessage').textContent, /^田中さん、/);
  assert.equal(reloaded.run('data.settings.colors.class'), '#112233');
  assert.equal(reloaded.run('data.settings.colors.study'), '#445566');

  reloaded.run(`saveUserSettings({ nickname: '' })`);
  assert.equal(reloaded.document.querySelector('.sidebar-foot .user-name').textContent, 'マイカレンダー');
  assert.doesNotMatch(reloaded.document.getElementById('characterMessage').textContent, /^田中さん、/);
});

test('auto-scheduling places 60-to-90-min study blocks in free time and TASKROU recovers slipped sessions', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
  app.run(`saveUserSettings({ nickname: '田中' })`);

  app.document.getElementById('smartInputText').value = '明日 23:59までに 最終制作レポート';
  app.document.getElementById('analyzeSmartInput').dispatch('click', {});
  app.run('confirmSmartInputReview()');

  const afterAdd = JSON.parse(storage.get('smart-calendar-v1'));
  const studySession = afterAdd.sessions.find(s => /^【学習】最終制作レポート$/.test(s.name));
  assert.ok(studySession, 'auto-scheduled 【学習】 block must exist');
  const mins = app.run(`clockMinutes('${studySession.end}') - clockMinutes('${studySession.start}')`);
  assert.ok(mins >= 60 && mins <= 90, 'study block must be 60 to 90 minutes');
  assert.match(app.document.getElementById('characterMessage').textContent, /田中さん、『最終制作レポート』の締め切りに間に合うように空き時間へ学習計画を入れたよ！/);
  assert.notEqual(app.document.getElementById('plannedHours').textContent, '0時間');

  app.run(`
    characterAnnouncementUntil = 0;
    data.sessions = [{
      id: 'slipped-1',
      taskId: data.tasks[0].id,
      name: '【学習】最終制作レポート',
      day: dateKey(addDays(today, -1)),
      start: '10:00',
      end: '11:30',
      type: 'study',
      done: false,
      allocatedHours: 1.5
    }];
    characterDialogue.step = 'suggestion';
    renderCharacterStation();
  `);
  assert.match(app.document.getElementById('characterMessage').textContent, /田中さん、学習予定が少しズレちゃったみたいだね/);

  app.document.getElementById('recalculateStudyPlan').dispatch('click', {});
  const afterRecover = JSON.parse(storage.get('smart-calendar-v1'));
  assert.equal(afterRecover.sessions.some(s => s.id === 'slipped-1'), false);
  assert.ok(afterRecover.sessions.some(s => s.day >= app.run('dateKey(today)') && /^【学習】最終制作レポート$/.test(s.name)));
  assert.match(app.document.getElementById('characterMessage').textContent, /田中さん、新しい空き時間で計画を組み直したよ！/);
});

test('TASKROU 3-tab UI, dashed study-plan-block styling, defer/toggle, and hidden below-calendar panels', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });
  const todayKey = app.run('dateKey(today)');
  const futureDate = app.run('addDays(today, 3)');
  const futureKey = app.run(`dateKey(new Date(${futureDate.getFullYear()}, ${futureDate.getMonth()}, ${futureDate.getDate()}))`);

  const enhancementsSource = fs.readFileSync(path.join(__dirname, '..', 'dashboard-enhancements.js'), 'utf8');
  assert.match(enhancementsSource, /\.calendar-grid \.event\.study-plan-block[\s\S]*dashed/);
  assert.match(enhancementsSource, /\.calendar-grid \.event\.study-plan-block \.event-title::before\s*\{\s*content:\s*"📖 "/);
  assert.match(enhancementsSource, /body\.hide-study-blocks \.calendar-grid \.event\.study-plan-block\s*\{\s*display:\s*none/);

  // #priorityPanel and .below-calendar are hidden
  const priorityPanel = app.document.getElementById('priorityPanel');
  assert.equal(priorityPanel.hidden, true);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), /<section class="below-calendar" hidden>/);

  // Add a task and study session
  app.run(`
    data.tasks.push({
      id: 'task-tab-1',
      name: '統計学課題',
      kind: 'report',
      due: '${futureKey}',
      dueTime: '23:59',
      createdAt: new Date().toISOString(),
      done: false
    });
    data.sessions.push({
      id: 'study-tab-1',
      taskId: 'task-tab-1',
      name: '【学習】統計学課題',
      type: 'study',
      day: '${todayKey}',
      start: '19:00',
      end: '20:30',
      allocatedHours: 1.5,
      done: false
    });
    save();
    renderCalendar();
    renderTasks();
    renderCharacterStation();
  `);

  // Calendar renders study-plan-block
  const gridHtml = app.document.getElementById('calendarGrid').innerHTML;
  assert.match(gridHtml, /study-plan-block/);

  // 3-tab switching
  const tabChat = app.document.getElementById('characterTabChat');
  const tabPlan = app.document.getElementById('characterTabPlan');
  const tabDeadlines = app.document.getElementById('characterTabDeadlines');
  app.run("setCharacterTab('chat')");
  assert.equal(tabChat.hidden, false);
  assert.equal(tabPlan.hidden, true);
  assert.equal(tabDeadlines.hidden, true);

  app.run("setCharacterTab('plan')");
  assert.equal(Boolean(tabChat.hidden), true);
  assert.equal(Boolean(tabPlan.hidden), false);
  assert.equal(Boolean(tabDeadlines.hidden), true);
  assert.match(app.document.getElementById('characterPlanList').innerHTML, /統計学課題/);

  app.run("setCharacterTab('deadlines')");
  assert.equal(Boolean(tabChat.hidden), true);
  assert.equal(Boolean(tabPlan.hidden), true);
  assert.equal(Boolean(tabDeadlines.hidden), false);
  assert.match(app.document.getElementById('characterDeadlineList').innerHTML, /統計学課題/);

  // Defer study session to next free slot
  const moved = app.run("deferStudySessionToNextGap('study-tab-1')");
  assert.equal(moved, true);
  const afterDefer = JSON.parse(storage.get('smart-calendar-v1'));
  const deferredSession = afterDefer.sessions.find(s => s.id === 'study-tab-1');
  assert.ok(deferredSession);
  assert.ok(deferredSession.day !== todayKey || deferredSession.start !== '19:00');

  // Toggle calendar visibility OFF and verify persistence
  const toggle = app.document.getElementById('toggleStudyBlocksCalendar');
  toggle.checked = false;
  toggle.dispatch('change', {});
  assert.equal(app.document.body.classList.added.includes('hide-study-blocks'), true);
  const savedSettings = JSON.parse(storage.get('smart-calendar-v1')).settings;
  assert.equal(savedSettings.showStudyBlocksOnCalendar, false);
});

test('settings SVG icon, 20-color palette, custom categories, and AI smart input category detection', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });

  assert.doesNotMatch(dashboardEnhancementsScript, /⚙️/);
  assert.match(dashboardEnhancementsScript, /SETTINGS_GEAR_SVG/);
  assert.doesNotMatch(dashboardEnhancementsScript, /resetSettingsBtn/);
  assert.doesNotMatch(dashboardEnhancementsScript, /type="color"/);
  assert.equal(app.run('PRESET_EVENT_COLORS.length'), 20);

  // Save a custom category '就活'
  app.run(`saveUserSettings({
    customCategories: [{ id: 'custom_job', name: '就活', color: '#4a90e2' }]
  })`);

  const eventTypeHtml = app.document.getElementById('eventType').innerHTML;
  assert.match(eventTypeHtml, /value="custom_job"[^>]*>就活<\/option>/);
  assert.match(app.document.querySelector('.sidebar .legend').innerHTML, /就活/);

  // AI smart input auto-detects custom category name
  const parsed = app.run(`parseSmartInputLine('明日 14:00-15:30 就活 企業説明会')`);
  assert.equal(parsed.type, 'custom_job');

  // Verify persistence across reload
  const reloaded = createAppHarness(storage, { Date: createFixedDate(12) });
  assert.equal(reloaded.run('data.settings.customCategories.length'), 1);
  assert.equal(reloaded.run('data.settings.customCategories[0].name'), '就活');
  assert.match(reloaded.document.getElementById('eventType').innerHTML, /就活/);
});

test('sidebar schedule nav label is 予定 and overview supports repeat, category, and sort filters', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });

  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(indexHtml, /id="fixedNav"><span class="nav-icon">◷<\/span><span>予定<\/span><\/button>/);
  assert.match(dashboardEnhancementsScript, /id="fixedOverviewTitle">予定一覧<\/h1>/);

  const todayKey = app.run('dateKey(today)');
  const tomorrowKey = app.run('dateKey(addDays(today, 1))');
  app.run(`
    saveUserSettings({ customCategories: [{ id: 'custom_job', name: '就活', color: '#4a90e2' }] });
    data.fixed = [
      { id: 'f1000000000001', name: '線形代数', day: 2, start: '09:00', end: '10:30', type: 'class' }
    ];
    data.extras = [
      { id: 'e1000000000003', name: '企業説明会', day: '${tomorrowKey}', start: '14:00', end: '15:00', type: 'custom_job' },
      { id: 'e1000000000002', name: '歯医者', day: '${todayKey}', start: '17:00', end: '18:00', type: 'personal' }
    ];
    save();
  `);

  app.document.getElementById('fixedNav').dispatch('click', {});
  let listHtml = app.document.getElementById('fixedOverviewList').innerHTML;
  assert.match(listHtml, /線形代数/);
  assert.match(listHtml, /企業説明会/);
  assert.match(listHtml, /歯医者/);
  // nearest: today's 歯医者 appears before tomorrow's 企業説明会
  assert.ok(listHtml.indexOf('歯医者') < listHtml.indexOf('企業説明会'));

  // Filter: fixed only
  app.document.getElementById('scheduleRepeatFilter').value = 'fixed';
  app.document.getElementById('scheduleRepeatFilter').dispatch('change', {});
  listHtml = app.document.getElementById('fixedOverviewList').innerHTML;
  assert.match(listHtml, /線形代数/);
  assert.doesNotMatch(listHtml, /企業説明会/);

  // Filter: once only + custom category
  app.document.getElementById('scheduleRepeatFilter').value = 'once';
  app.document.getElementById('scheduleCategoryFilter').value = 'custom_job';
  app.document.getElementById('scheduleCategoryFilter').dispatch('change', {});
  listHtml = app.document.getElementById('fixedOverviewList').innerHTML;
  assert.match(listHtml, /企業説明会/);
  assert.doesNotMatch(listHtml, /歯医者/);
  assert.doesNotMatch(listHtml, /線形代数/);

  // Sort: newest first
  app.document.getElementById('scheduleRepeatFilter').value = 'all';
  app.document.getElementById('scheduleCategoryFilter').value = 'all';
  app.document.getElementById('scheduleSortOrder').value = 'newest';
  app.document.getElementById('scheduleSortOrder').dispatch('change', {});
  listHtml = app.document.getElementById('fixedOverviewList').innerHTML;
  assert.ok(listHtml.indexOf('企業説明会') < listHtml.indexOf('歯医者'));
  assert.ok(listHtml.indexOf('歯医者') < listHtml.indexOf('線形代数'));
});

test('TASKROU tab guides, 7-day scrollable deadlines, and 2-3 choice interactive conversations', () => {
  const storage = new Map();
  const app = createAppHarness(storage, { Date: createFixedDate(12) });

  assert.match(dashboardEnhancementsScript, /空き時間から最適な学習計画を提案するよ！/);
  assert.match(dashboardEnhancementsScript, /7日以内の締め切りが近い課題はこれだよ！/);
  assert.match(dashboardEnhancementsScript, /\.character-deadline-list\s*\{[^}]*max-height:\s*174px;\s*overflow-y:\s*auto/);

  // Empty tasks: interactive 3-choice -> 2-choice branching
  assert.equal(app.document.getElementById('characterChoiceOne').textContent, '課題を追加する');
  assert.equal(app.document.getElementById('characterChoiceTwo').textContent, '調子を話す');
  assert.equal(app.document.getElementById('characterChoiceThree').textContent, '今日の予定を見る');

  app.document.getElementById('characterChoiceTwo').dispatch('click', {});
  assert.equal(app.document.getElementById('characterChoiceThree').textContent, 'ちょっと疲れ気味…');
  app.document.getElementById('characterChoiceThree').dispatch('click', {});
  assert.match(app.document.getElementById('characterMessage').textContent, /無理せず今日は休む予定を入れようか/);
  assert.equal(app.document.getElementById('characterChoiceThree').textContent, '応援してほしい');
  app.document.getElementById('characterChoiceThree').dispatch('click', {});
  assert.equal(app.document.getElementById('characterChoiceThree').hidden, true);
  assert.equal(app.document.getElementById('characterChoiceOne').textContent, 'ありがとう！頑張る');

  // Add 5 tasks within 7 days and 1 task 10 days away
  app.run(`
    for (let i = 1; i <= 5; i++) {
      data.tasks.push({
        id: 'dl-' + i,
        name: '7日課題' + i,
        due: dateKey(addDays(today, i)),
        dueTime: '23:59',
        done: false
      });
    }
    data.tasks.push({
      id: 'dl-far',
      name: '10日後課題',
      due: dateKey(addDays(today, 10)),
      dueTime: '23:59',
      done: false
    });
    renderCharacterDeadlineTab();
  `);

  const deadlineHtml = app.document.getElementById('characterDeadlineList').innerHTML;
  assert.match(deadlineHtml, /7日課題5/);
  assert.doesNotMatch(deadlineHtml, /10日後課題/);
});
