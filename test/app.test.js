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
assert.match(html, /<script src="\.\/smart-input\.js\?v=20261115-smart-input-refinements"><\/script>/, 'index.html must load local smart input');
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
  assert.equal(app.run('data.tasks.length'), 1, 'deleting a study session must not delete its task');
  assert.equal(app.run('data.tasks[0].remaining'), 1);
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
  const app = createAppHarness(new Map(), { Date: createFixedDate(12) });
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
  assert.match(result.expanded, /4\/5/);
  assert.match(result.expanded, /3単位/);
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
