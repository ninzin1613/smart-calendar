data.restDays = Array.isArray(data.restDays) ? data.restDays : [];
data.recentlyScheduledSessionIds = [];

document.querySelector('.calendar-shell').insertAdjacentHTML('beforebegin', `
  <section class="character-station" id="characterStation" aria-labelledby="characterStationTitle">
    <div class="character-avatar" id="characterAvatar" role="img"></div>
    <div class="character-message">
      <div class="character-title" id="characterStationTitle"><span class="character-brand">TASKROU · AI STUDY COMPANION</span><span>今日のひとこと</span></div>
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

document.querySelector('.main').insertAdjacentHTML('beforeend', `
  <section class="task-overview" id="taskOverview" aria-labelledby="taskOverviewTitle" hidden>
    <div class="task-overview-heading">
      <div>
        <div class="eyebrow">MY STUDY PLAN</div>
        <h1 id="taskOverviewTitle">課題・テスト一覧</h1>
        <div class="task-overview-summary" id="taskOverviewSummary"></div>
      </div>
    </div>
    <div class="task-overview-list" id="taskOverviewList"></div>
  </section>
`);

const enhancementStyle = document.createElement('style');
enhancementStyle.textContent = `
.character-station { display: flex; align-items: center; gap: 14px; margin: 16px 0; padding: 12px 16px; border: 1px solid #e5dfcd; border-radius: 12px; background: linear-gradient(110deg, #fffdf6 0%, #fffefa 56%, #f0f7f5 100%); box-shadow: var(--shadow); }
.character-avatar { display: grid; flex: 0 0 112px; width: 112px; height: 112px; place-items: center; border: 1px solid #e8dfc7; border-radius: 22px; background: radial-gradient(circle at 50% 35%, #fff8df 0, #f8edc8 72%, #f0e5c4 100%); }
.owl-mascot { display: block; width: 100px; height: 106px; overflow: visible; filter: drop-shadow(0 3px 1px rgba(71, 58, 39, .12)); }
.owl-body { fill: #f2cf72; stroke: #59432c; stroke-width: 2.4; stroke-linejoin: round; }
.owl-face { fill: #fff4d9; stroke: #755636; stroke-width: 1.8; }
.owl-wing { fill: #e7b958; stroke: #765437; stroke-width: 1.8; stroke-linejoin: round; }
.owl-feather { fill: #fff4d9; stroke: #b48b4e; stroke-width: 1; }
.owl-glasses { fill: #dcebe2; fill-opacity: .3; stroke: #705a3e; stroke-width: 2.4; }
.owl-glasses-shine { fill: none; stroke: #fffdf0; stroke-width: 1.5; stroke-linecap: round; }
.owl-eye { fill: #fffdf3; stroke: #73583a; stroke-width: 1.1; }
.owl-pupil { fill: #51402f; }
.owl-eye-glint { fill: #fff; }
.owl-beak, .owl-feet, .owl-clock { stroke: #62472e; stroke-linecap: round; stroke-linejoin: round; }
.owl-beak { fill: #bf8050; stroke-width: 1.5; }
.owl-feet { fill: none; stroke-width: 2.8; }
.owl-clock { fill: #fff2ce; stroke-width: 1.7; }
.owl-clock-hand { fill: none; stroke: #62472e; stroke-width: 1.4; stroke-linecap: round; }
.owl-brow, .owl-mouth { fill: none; stroke: #62472e; stroke-width: 1.8; stroke-linecap: round; }
.owl-sparkle { fill: #d49843; stroke: #a97936; stroke-width: .8; }
.owl-sweat { fill: #88b9c3; stroke: #547f89; stroke-width: 1; }
.owl-mascot[data-mood="concerned"] .owl-body { fill: #e9c678; }
.owl-mascot[data-mood="resting"] .owl-eye-glint { display: none; }
.owl-mascot[data-mood="celebratory"] .owl-sparkle { fill: #e7a74f; }
.character-title { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 9px; margin-bottom: 5px; color: #718563; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.character-brand { color: #9c8050; font-size: 8px; letter-spacing: .11em; }
.character-message { flex: 1; min-width: 0; }
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
.task-overview { min-height: 60vh; padding: 18px 0; }
.task-overview[hidden] { display: none; }
.task-overview-heading { margin-bottom: 20px; }
.task-overview-heading .eyebrow { margin-bottom: 5px; }
.task-overview-heading h1 { font-size: 24px; }
.task-overview-summary { margin-top: 7px; color: #828b81; font-size: 11px; }
.task-overview-list { display: grid; gap: 9px; max-width: 860px; }
.task-overview-card { border: 1px solid #e8e9e0; border-radius: 8px; background: var(--white); overflow: hidden; }
.task-overview-row { min-height: 66px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
.task-overview-row .task-info { flex: 1; }
.task-overview-row .task-title { white-space: normal; }
.task-overview-trigger { display: inline-flex; align-items: center; flex-wrap: wrap; padding: 0; border: 0; background: transparent; text-align: left; font-size: 11px; font-weight: 700; }
.task-overview-trigger:hover .task-overview-name { color: var(--green-dark); text-decoration: underline; }
.task-overview-kind { display: inline-block; margin-left: 7px; padding: 2px 6px; border-radius: 10px; background: #edf2e4; color: #557442; font-size: 9px; vertical-align: 1px; }
.task-overview-status { display: grid; justify-items: end; gap: 4px; color: #828b81; font-size: 10px; white-space: nowrap; }
.task-overview-details-link { color: #718563; font-size: 9px; }
.task-overview-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; padding: 12px 16px 15px 42px; border-top: 1px solid #eff0e9; background: #fcfcf8; }
.task-overview-details[hidden] { display: none; }
.task-overview-detail { min-width: 0; }
.task-overview-detail-label { color: #828b81; font-size: 9px; }
.task-overview-detail-value { margin-top: 3px; font-size: 11px; overflow-wrap: anywhere; }
.task-overview-detail-wide { grid-column: 1 / -1; }
.task-overview-row.is-done { opacity: .65; }
.task-overview-row.is-done .task-title { text-decoration: line-through; }
body.task-overview-active .main > :not(.topbar):not(#taskOverview) { display: none; }
body.task-overview-active #taskOverview { display: block; }
@media (prefers-reduced-motion: reduce) { .calendar-grid .event.ai-new { animation: none; } }
@media (max-width: 680px) { .character-station { align-items: flex-start; flex-wrap: wrap; } .character-avatar { flex-basis: 76px; width: 76px; height: 80px; } .owl-mascot { width: 72px; height: 77px; } .character-message { flex-basis: calc(100% - 92px); } .capacity-panic { margin-left: 90px; } .task-fab { right: 14px; bottom: 14px; min-height: 44px; padding: 0 14px; } }
`;
document.head.appendChild(enhancementStyle);

let characterCelebrationUntil = 0;

function getOwlMarkup(mood) {
  const eyes = mood === 'resting'
    ? '<path class="owl-eye" d="M25 57q11 9 22 0m16 0q11 9 22 0"/>'
    : '<ellipse class="owl-eye" cx="42" cy="55" rx="10.5" ry="12.5"/><ellipse class="owl-eye" cx="78" cy="55" rx="10.5" ry="12.5"/><circle class="owl-pupil" cx="43" cy="56" r="6"/><circle class="owl-pupil" cx="77" cy="56" r="6"/><circle class="owl-eye-glint" cx="45" cy="53" r="2"/><circle class="owl-eye-glint" cx="79" cy="53" r="2"/>';
  const brows = mood === 'concerned'
    ? '<path class="owl-brow" d="m30 38 15 5m45-5-15 5"/>'
    : mood === 'encouraging' || mood === 'celebratory'
        ? '<path class="owl-brow" d="m30 40 15-3m45 3-15-3"/>'
      : '';
  const mouth = mood === 'celebratory'
    ? '<path class="owl-mouth" d="M53 76q7 9 14 0"/>'
    : '<path class="owl-mouth" d="m55 75 5 5 5-5"/>';
  const extras = mood === 'concerned'
    ? '<path class="owl-sweat" d="M99 48q-6 8 0 11 6-3 0-11z"/>'
    : mood === 'encouraging'
        ? '<path class="owl-sparkle" d="m103 35 2 4 4 1-4 2-2 4-1-4-4-2 4-1z"/>'
      : mood === 'celebratory'
          ? '<path class="owl-sparkle" d="m16 41 2 4 4 1-4 2-2 4-1-4-4-2 4-1z"/><path class="owl-sparkle" d="m103 59 2 3 3 1-3 2-2 3-1-3-3-2 3-1z"/>'
        : '';
  return `<svg class="owl-mascot" data-mood="${mood}" viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path class="owl-body" d="M28 43Q17 35 17 20q14 3 25 16 18-10 36 0 11-13 25-16-1 15-12 24 15 12 14 37-1 27-25 36-20 9-40 0-24-9-25-36-1-25 13-38z"/>
    <path class="owl-face" d="M21 53q7-21 25-21 8 0 14 6 7-6 15-6 19 0 25 22-5 21-20 31-10 7-20 7-11 0-21-7Q25 75 21 53z"/>
    <path class="owl-wing" d="M23 58Q9 64 13 83q2 15 17 21 9 2 14-13z"/><path class="owl-wing" d="M97 58q14 6 10 25-2 15-17 21-9 2-14-13z"/>
    <path class="owl-feather" d="m23 77 17 18m-19-9 12 13m64-22L80 95m19-9-12 13"/>
    <path class="owl-feather" d="M42 83q7 12 18 13l-6 10q-11-5-16-15zm18 13q12-1 19-13l6 8q-7 13-19 16z"/>
    ${brows}${eyes}
    <circle class="owl-glasses" cx="42" cy="55" r="16"/><circle class="owl-glasses" cx="78" cy="55" r="16"/><path d="M59 53q1-3 2 0m-2 1q-2-3-1-4" fill="none" stroke="#705a3e" stroke-width="2.5" stroke-linecap="round"/><path class="owl-glasses-shine" d="M30 46q4-5 9-5m31 5q4-5 9-5"/>
    <path class="owl-beak" d="m55 68 5-6 5 6-5 9z"/>${mouth}
    <circle class="owl-clock" cx="60" cy="99" r="11"/><circle cx="60" cy="99" r="8" fill="none" stroke="#b48b4e" stroke-width=".8"/><path class="owl-clock-hand" d="M60 92v7l5 3"/><circle cx="60" cy="99" r="1.4" fill="#62472e"/>
    <path class="owl-feet" d="m46 115-2 8-7 2m8-4 5 5m24-11 2 8 7 2m-9-4-5 5"/>
    ${extras}
  </svg>`;
}

function renderTaskOverview() {
  const list = document.getElementById('taskOverviewList');
  const tasks = [...data.tasks].sort((left, right) =>
    Number(Boolean(left.done)) - Number(Boolean(right.done))
      || left.due.localeCompare(right.due)
      || (left.order || 0) - (right.order || 0)
  );
  const openCount = tasks.filter(task => !task.done && task.remaining > 0).length;
  document.getElementById('taskOverviewSummary').textContent =
    `${openCount}件が未完了 · 全${tasks.length}件`;

  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state">課題・テストはまだありません。</div>';
    return;
  }

  list.innerHTML = tasks.map(task => {
    const plan = task.planId && data.plans.find(item => item.id === task.planId);
    const completed = Boolean(task.done || task.remaining <= 0);
    const daysLeft = Math.ceil((new Date(`${task.due}T00:00:00`) - today) / 86400000);
    const dueText = daysLeft < 0 ? `${Math.abs(daysLeft)}日超過` : daysLeft === 0 ? '今日が締切' : `${daysLeft}日後`;
    const name = task.phase ? `${escapeHTML(task.name)} · ${escapeHTML(task.phase)}` : escapeHTML(task.name);
    const kind = plan?.kind === 'exam' || /テスト|試験/.test(task.name)
      ? 'テスト'
      : plan?.kind === 'report'
        ? 'レポート'
        : plan?.kind === 'reading'
          ? '読書'
          : '課題';
    const scope = task.scope ? ` · 範囲 ${escapeHTML(task.scope)}` : '';
    const detailId = `task-details-${task.id}`;
    const expanded = activeTaskDetailId === task.id;
    const workloadUnit = plan?.kind === 'report' ? '文字' : 'ページ';
    const planProgress = plan
      ? getPlanProgress(plan.id).percent
      : task.hours > 0
        ? Math.round((1 - Number(task.remaining || 0) / task.hours) * 100)
        : 0;
    const details = [
      ['種類', kind],
      ['締切', `${fmtDate(new Date(`${task.due}T00:00:00`))}（${dueText}）`],
      ['必要な学習時間', plan ? `${Number(plan.estimatedHours)}時間` : `${Number(task.hours || 0)}時間`],
      ['現在の進捗', `${Math.max(0, Math.min(100, planProgress))}%`]
    ];
    if (plan) {
      details.push(
        ['課題量', `${Number(plan.workload)}${workloadUnit}`],
        ['難易度', `${Number(plan.difficulty)}/5`],
        ['単位数', `${Number(plan.credits)}単位`]
      );
    }
    if (plan?.kind === 'exam' || task.scope) details.push(['テスト範囲', task.scope || plan.scope || '未設定']);
    if (task.phase) {
      const phaseHours = Number(task.hours || 0);
      details.push(['この小タスク', `${task.phase} · 約${phaseHours.toFixed(phaseHours % 1 ? 1 : 0)}時間`]);
    }
    details.push(['残り時間', `${Number(task.remaining || 0).toFixed(Number(task.remaining || 0) % 1 ? 1 : 0)}時間`]);
    const detailMarkup = details.map(([label, value]) =>
      `<div class="task-overview-detail${label === 'テスト範囲' || label === 'この小タスク' ? ' task-overview-detail-wide' : ''}"><div class="task-overview-detail-label">${label}</div><div class="task-overview-detail-value">${escapeHTML(String(value))}</div></div>`
    ).join('');

    return `<div class="task-overview-card"><article class="task-overview-row${completed ? ' is-done' : ''}"><input class="check" type="checkbox" aria-label="${escapeHTML(task.name)}を完了" data-overview-task="${escapeHTML(task.id)}"${completed ? ' checked' : ''}><div class="task-info"><button class="task-overview-trigger" type="button" data-task-detail="${escapeHTML(task.id)}" aria-expanded="${expanded}" aria-controls="${escapeHTML(detailId)}"><span class="task-overview-name">${name}</span><span class="task-overview-kind">${kind}</span></button><div class="task-meta">残り約${Number(task.remaining || 0).toFixed(Number(task.remaining || 0) % 1 ? 1 : 0)}時間 · ${fmtDate(new Date(`${task.due}T00:00:00`))}締め切り${scope}</div></div><div class="task-overview-status">${completed ? '完了' : dueText}<span class="task-overview-details-link">${expanded ? '詳細を閉じる' : '詳細を見る'}</span></div></article><section class="task-overview-details" id="${escapeHTML(detailId)}" aria-label="${escapeHTML(task.name)}の詳細"${expanded ? '' : ' hidden'}>${detailMarkup}</section></div>`;
  }).join('');

  list.querySelectorAll('[data-task-detail]').forEach(element => element.addEventListener('click', () => {
    toggleTaskDetail(element.dataset.taskDetail);
  }));
  list.querySelectorAll('[data-overview-task]').forEach(element => element.addEventListener('change', () => {
    const task = data.tasks.find(item => item.id === element.dataset.overviewTask);
    if (!task) return;
    task.done = element.checked;
    task.remaining = element.checked ? 0 : task.hours;
    data.sessions = data.sessions.filter(session => session.taskId !== task.id);
    save();
    if (element.checked) characterCelebrationUntil = Date.now() + 2600;
    renderTasks();
    renderCalendar();
    if (element.checked) {
      setTimeout(() => {
        characterCelebrationUntil = 0;
        renderCharacterStation();
      }, 2600);
    }
    showToast(element.checked ? '課題を完了にしました' : '課題を未完了に戻しました');
  }));
}

let activeTaskDetailId = null;

function toggleTaskDetail(taskId) {
  activeTaskDetailId = activeTaskDetailId === taskId ? null : taskId;
  renderTaskOverview();
}

const calendarNav = document.querySelector('.nav-item.active');

function showTaskOverview() {
  document.body.classList.add('task-overview-active');
  document.getElementById('taskOverview').hidden = false;
  calendarNav.classList.remove('active');
  document.getElementById('tasksNav').classList.add('active');
  renderTaskOverview();
}

function showCalendarOverview() {
  document.body.classList.remove('task-overview-active');
  document.getElementById('taskOverview').hidden = true;
  document.getElementById('tasksNav').classList.remove('active');
  calendarNav.classList.add('active');
}

document.getElementById('tasksNav').addEventListener('click', showTaskOverview);
document.getElementById('allTasks').addEventListener('click', showTaskOverview);
calendarNav.addEventListener('click', showCalendarOverview);

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
  let mood = 'standard';

  if (capacity.isOverloaded && !isRestDay) {
    mood = 'concerned';
    message.textContent = '今日は予定が詰まり気味。できる分だけで大丈夫、無理はしないで！';
  } else if (isRestDay) {
    mood = 'resting';
    message.textContent = '今日は休息の日。しっかり休んで、また明日から少しずつ。';
  } else if (overdue) {
    mood = 'concerned';
    message.textContent = '期限を過ぎた課題があります。まずは小さな一歩から始めましょう。';
  } else if (Date.now() < characterCelebrationUntil) {
    mood = 'celebratory';
    message.textContent = '課題を完了！よく頑張りました。少し休憩しましょう。';
  } else if (priority) {
    mood = 'encouraging';
    message.textContent = `次は「${priority.name}」がおすすめ。20分だけでも進めれば大丈夫！`;
  } else {
    message.textContent = '今日もいいペースです。空き時間にできることから始めましょう。';
  }

  avatar.innerHTML = getOwlMarkup(mood);
  avatar.setAttribute('aria-label', `TASKROU、${{
    standard: '通常',
    encouraging: '応援',
    concerned: '心配',
    resting: '休息',
    celebratory: 'お祝い'
  }[mood]}の表情`);
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
  renderTaskOverview();
  renderCharacterStation();
};

renderCalendar();
renderTasks();
