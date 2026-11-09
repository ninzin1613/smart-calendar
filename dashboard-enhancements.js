data.restDays = Array.isArray(data.restDays) ? data.restDays : [];
data.recentlyScheduledSessionIds = [];

document.querySelector('.calendar-shell').insertAdjacentHTML('beforebegin', `
  <section class="character-station" id="characterStation" aria-labelledby="characterStationTitle">
    <div class="character-avatar" id="characterAvatar" aria-hidden="true">🙂</div>
    <div class="character-message">
      <div class="character-title" id="characterStationTitle">今日のひとこと</div>
      <div class="character-bubble" id="characterMessage"></div>
      <div class="character-actions">
        <button class="primary-btn character-start" type="button" id="startTwentyMinuteTask">▶ 今すぐ20分作業する</button>
        <button class="secondary-btn" type="button" id="takeRestDay">☕ 今日は休む</button>
      </div>
    </div>
    <div class="capacity-panic" id="capacityPanic" role="status" hidden></div>
  </section>
`);

document.body.insertAdjacentHTML('beforeend', `
  <button class="task-fab" type="button" id="taskFab" aria-label="課題・テストを追加">＋ <span>課題・テスト追加</span></button>
`);

const enhancementStyle = document.createElement('style');
enhancementStyle.textContent = `
.character-station { display: flex; align-items: center; gap: 14px; margin: 16px 0; padding: 14px 16px; border: 1px solid #e4ebf4; border-radius: 10px; background: #fffefa; box-shadow: var(--shadow); }
.character-avatar { display: grid; flex: 0 0 48px; width: 48px; height: 48px; place-items: center; border-radius: 16px; background: #fff2c8; font-size: 29px; }
.character-message { flex: 1; min-width: 0; }
.character-title { margin-bottom: 5px; color: #718563; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.character-bubble { width: fit-content; max-width: 100%; padding: 8px 11px; border-radius: 4px 11px 11px; background: #f2f5ed; font-size: 12px; line-height: 1.5; }
.character-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
.character-actions button { min-height: 31px; height: 31px; font-size: 10px; }
.character-actions .primary-btn { background: var(--green-dark); box-shadow: none; }
.capacity-panic { flex: 0 0 auto; max-width: 230px; padding: 8px 10px; border-radius: 7px; background: #fff1eb; color: #a64e3c; font-size: 10px; font-weight: 700; }
.capacity-panic[hidden] { display: none; }
.task-fab { position: fixed; right: 24px; bottom: 24px; z-index: 9; display: flex; align-items: center; gap: 7px; min-height: 48px; padding: 0 17px; border: 0; border-radius: 25px; background: var(--coral); color: white; box-shadow: 0 5px 16px rgba(80, 52, 40, .25); font-size: 15px; font-weight: 700; }
.task-fab:hover { background: #e85e52; transform: translateY(-1px); }
.task-fab span { font-size: 11px; }
.calendar-grid .event.ai-generated { border: 1px solid #d99054; border-left: 4px solid #d99054; background: #fff1d9; color: #765021; }
.calendar-grid .ai-badge { display: inline-block; margin-right: 4px; padding: 1px 3px; border-radius: 3px; background: #d99054; color: white; font-size: 8px; vertical-align: 1px; }
.calendar-grid .ai-progress { margin-top: 3px; font-size: 8px; }
.calendar-grid .ai-progress-track { height: 3px; margin-top: 2px; overflow: hidden; border-radius: 2px; background: rgba(118, 80, 33, .18); }
.calendar-grid .ai-progress-fill { height: 100%; background: #d99054; }
.calendar-grid .day-head.has-deadline strong { color: #b65040; }
.calendar-grid .deadline-mark { margin-left: 2px; color: #c45c45; font: 10px var(--sans); vertical-align: 2px; }
.calendar-grid .event.ai-new { animation: ai-session-arrive .45s ease-out both; }
@keyframes ai-session-arrive { from { opacity: 0; transform: translateY(-8px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .calendar-grid .event.ai-new { animation: none; } }
@media (max-width: 680px) { .character-station { align-items: flex-start; flex-wrap: wrap; } .character-avatar { flex-basis: 40px; width: 40px; height: 40px; font-size: 24px; } .character-message { flex-basis: calc(100% - 55px); } .capacity-panic { margin-left: 54px; } .task-fab { right: 14px; bottom: 14px; min-height: 44px; padding: 0 14px; } }
`;
document.head.appendChild(enhancementStyle);

function getTodayCapacity() {
  const gaps = getUpcomingStudyGaps(new Date(), 1);
  const availableMinutes = gaps.reduce((sum, gap) => sum + gap.minutes, 0);
  const demandMinutes = data.tasks
    .filter(task => !task.done && task.remaining > 0 && task.due <= dateKey(addDays(today, 1)))
    .reduce((sum, task) => sum + getTaskUnscheduledMinutes(task), 0);
  return {
    gaps,
    availableMinutes,
    demandMinutes,
    isOverloaded: availableMinutes < 90 || demandMinutes > availableMinutes
  };
}

function renderCharacterStation() {
  const message = document.getElementById('characterMessage');
  const avatar = document.getElementById('characterAvatar');
  const warning = document.getElementById('capacityPanic');
  const startButton = document.getElementById('startTwentyMinuteTask');
  const restButton = document.getElementById('takeRestDay');
  const isRestDay = data.restDays.includes(dateKey(today));
  const capacity = getTodayCapacity();
  const priority = typeof getPriorityPlans === 'function' ? getPriorityPlans()[0] : null;
  const overdue = data.tasks.some(task => !task.done && task.due < dateKey(today));

  if (capacity.isOverloaded && !isRestDay) {
    avatar.textContent = '🥺';
    message.textContent = '今日は予定が詰まり気味。できる分だけで大丈夫、無理はしないで！';
  } else if (isRestDay) {
    avatar.textContent = '☕';
    message.textContent = '今日は休息の日。しっかり休んで、また明日から少しずつ。';
  } else if (overdue) {
    avatar.textContent = '💪';
    message.textContent = '期限を過ぎた課題があります。まずは小さな一歩から始めましょう。';
  } else if (priority) {
    avatar.textContent = '✨';
    message.textContent = `次は「${priority.name}」がおすすめ。20分だけでも進めれば大丈夫！`;
  } else {
    avatar.textContent = '🙂';
    message.textContent = '今日もいいペースです。空き時間にできることから始めましょう。';
  }

  warning.hidden = !capacity.isOverloaded || isRestDay;
  warning.textContent = `⚠️ 今日は無理しないで！ 空き ${capacity.availableMinutes}分 · 期限が近い課題 ${capacity.demandMinutes}分`;
  startButton.disabled = isRestDay;
  startButton.textContent = isRestDay ? '今日は休息中' : '▶ 今すぐ20分作業する';
  restButton.textContent = isRestDay ? '↩ 休息を取り消す' : '☕ 今日は休む';
}

function startTwentyMinuteTask() {
  if (data.restDays.includes(dateKey(today))) {
    showToast('今日は休息日です。先に休息を取り消してください');
    return false;
  }
  const gap = getUpcomingStudyGaps(new Date(), 1).find(item => item.minutes >= 20);
  const suggestions = gap
    ? getSmartStudySuggestions(gap, data.context.location, data.context.fatigue, 20, data.context.mode)
    : [];
  if (!gap || !suggestions.length) {
    showToast(gap ? '今すぐ取り組める課題がありません' : '今すぐ20分以上の空き時間がありません');
    return false;
  }
  return addStudySuggestionSession(suggestions[0].task, gap, suggestions[0].minutes);
}

document.getElementById('startTwentyMinuteTask').addEventListener('click', startTwentyMinuteTask);
document.getElementById('takeRestDay').addEventListener('click', () => {
  const todayKey = dateKey(today);
  if (data.restDays.includes(todayKey)) {
    data.restDays = data.restDays.filter(day => day !== todayKey);
  } else {
    data.restDays.push(todayKey);
  }
  save();
  renderCharacterStation();
  renderSpareTimeSuggestions();
});
document.getElementById('taskFab').addEventListener('click', () => {
  openModal('task');
  syncStudyFields();
});

function getPlanProgress(planId) {
  const tasks = data.tasks.filter(task => task.planId === planId);
  const totalHours = tasks.reduce((sum, task) => sum + Number(task.hours || 0), 0);
  const completedHours = tasks.reduce((sum, task) => sum + Number(task.hours || 0) - Number(task.remaining || 0), 0);
  const completedTasks = tasks.filter(task => task.done || task.remaining <= 0).length;
  return {
    completedTasks,
    totalTasks: tasks.length,
    percent: totalHours ? Math.max(0, Math.min(100, Math.round(completedHours / totalHours * 100))) : 0
  };
}

function decorateCalendarForStudyPlans(markup) {
  const visibleDates = dayMode
    ? [selectedDate]
    : Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  let headerIndex = 0;
  const withDeadlines = markup.replace(/<div class="day-head([^"]*)"><span>([^<]*)<\/span><strong>(\d+)<\/strong><\/div>/g, (header, classes, weekday, dayNumber) => {
    const date = visibleDates[headerIndex++];
    if (!date) return header;
    const day = dateKey(date);
    const hasDeadline = data.tasks.some(task => !task.done && task.due === day);
    return hasDeadline
      ? `<div class="day-head${classes} has-deadline"><span>${weekday}</span><strong>${dayNumber}<span class="deadline-mark" aria-label="締め切り">🎯</span></strong></div>`
      : header;
  });
  return withDeadlines.replace(
    /<div class="event ([^"]*)"([^>]*)><div class="event-title">([^<]*)<\/div><div class="event-time">([^<]*)<\/div><\/div>/g,
    (event, classes, attributes, title, time) => {
      const sessionMatch = attributes.match(/data-session="([^"]+)"/);
      const session = sessionMatch && data.sessions.find(item => item.id === sessionMatch[1]);
      const task = session && data.tasks.find(item => item.id === session.taskId);
      if (!task?.planId) return event;
      const progress = getPlanProgress(task.planId);
      const animated = data.recentlyScheduledSessionIds.includes(session.id);
      return `<div class="event ${classes} ai-generated${animated ? ' ai-new' : ''}"${attributes}><div class="event-title"><span class="ai-badge">AI</span>${title}</div><div class="event-time">${time}</div><div class="ai-progress">${progress.completedTasks}/${progress.totalTasks}完了（${progress.percent}%）<div class="ai-progress-track"><div class="ai-progress-fill" style="width:${progress.percent}%"></div></div></div></div>`;
    }
  );
}

const renderCalendarWithEnhancements = renderCalendar;
renderCalendar = (...args) => {
  renderCalendarWithEnhancements(...args);
  grid.innerHTML = decorateCalendarForStudyPlans(grid.innerHTML);
  renderCharacterStation();
};

const createScheduleWithEnhancementAnimation = createSchedule;
createSchedule = (...args) => {
  const existingIds = new Set(data.sessions.map(session => session.id));
  createScheduleWithEnhancementAnimation(...args);
  data.recentlyScheduledSessionIds = data.sessions
    .filter(session => !existingIds.has(session.id) && !session.done)
    .map(session => session.id);
  renderCalendar();
  setTimeout(() => {
    data.recentlyScheduledSessionIds = [];
    renderCalendar();
  }, 900);
};

const addStudySuggestionSessionWithAnimation = addStudySuggestionSession;
addStudySuggestionSession = (...args) => {
  const existingIds = new Set(data.sessions.map(session => session.id));
  const added = addStudySuggestionSessionWithAnimation(...args);
  if (!added) return added;
  data.recentlyScheduledSessionIds = data.sessions
    .filter(session => !existingIds.has(session.id))
    .map(session => session.id);
  renderCalendar();
  return added;
};

const renderTasksWithCharacter = renderTasks;
renderTasks = (...args) => {
  renderTasksWithCharacter(...args);
  renderCharacterStation();
};

renderCalendar();
renderTasks();
