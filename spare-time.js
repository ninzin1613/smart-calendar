data.context = data.context || { location: 'library', fatigue: 3 };
if (!['library', 'cafe', 'home'].includes(data.context.location)) data.context.location = 'library';
data.context.fatigue = Math.max(1, Math.min(5, Number(data.context.fatigue) || 3));
data.context.duration = [15, 30, 60].includes(Number(data.context.duration)) ? Number(data.context.duration) : 30;
data.context.mode = ['focus', 'easy'].includes(data.context.mode) ? data.context.mode : 'focus';

document.getElementById('priorityPanel').insertAdjacentHTML('beforebegin', `
  <section class="spare-time-panel" id="spareTimePanel" aria-labelledby="spareTimeTitle">
    <div class="spare-time-heading">
      <div>
        <div class="panel-title" id="spareTimeTitle">スキマ時間を活用</div>
        <div class="spare-time-note">授業・予定の空き時間を見つけ、今できる課題を提案します。</div>
      </div>
    </div>
    <div class="spare-time-context">
      <label class="spare-time-field" for="studyLocation">今いる場所
        <select id="studyLocation">
          <option value="library">図書館</option>
          <option value="cafe">カフェ</option>
          <option value="home">自宅</option>
        </select>
      </label>
      <label class="spare-time-field spare-time-fatigue" for="studyFatigue">疲労度
        <input id="studyFatigue" type="range" min="1" max="5" step="1" value="${data.context.fatigue}">
        <span id="studyFatigueLabel"></span>
      </label>
    </div>
    <div class="spare-time-filters" aria-label="提案の条件">
      <div class="spare-time-filter-group" role="group" aria-label="使える時間">
        <button class="spare-time-filter" type="button" data-duration="15" aria-pressed="false">15分</button>
        <button class="spare-time-filter" type="button" data-duration="30" aria-pressed="false">30分</button>
        <button class="spare-time-filter" type="button" data-duration="60" aria-pressed="false">60分</button>
      </div>
      <div class="spare-time-filter-group" role="group" aria-label="作業モード">
        <button class="spare-time-filter" type="button" data-mode="focus" aria-pressed="false">ガッツリ集中</button>
        <button class="spare-time-filter" type="button" data-mode="easy" aria-pressed="false">ゆるめ作業</button>
      </div>
    </div>
    <div class="spare-time-status" id="spareTimeStatus" role="status" aria-live="polite"></div>
    <ol class="spare-time-suggestions" id="spareTimeSuggestions"></ol>
    <div class="spare-time-privacy">場所は手動で選択します。位置情報は取得せず、設定はこの端末に保存されます。</div>
  </section>
`);

const spareTimeStyle = document.createElement('style');
spareTimeStyle.textContent = `
.spare-time-panel { margin: 0 0 16px; padding: 14px 16px; border: 1px solid #dfe8df; border-radius: 9px; background: #fffefa; box-shadow: var(--shadow); }
.spare-time-heading { display: flex; justify-content: space-between; align-items: center; }
.spare-time-note, .spare-time-privacy { margin-top: 4px; color: #828b81; font-size: 10px; }
.spare-time-context { display: flex; align-items: end; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.spare-time-field { display: grid; gap: 5px; color: #687268; font-size: 10px; font-weight: 600; }
.spare-time-field select { min-width: 150px; height: 34px; padding: 0 9px; border: 1px solid var(--line); border-radius: 6px; background: var(--white); }
.spare-time-fatigue { min-width: 180px; }
.spare-time-fatigue input { width: 180px; accent-color: var(--green-dark); }
.spare-time-fatigue span { color: #718563; font-size: 10px; }
.spare-time-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
.spare-time-filter-group { display: inline-flex; gap: 3px; padding: 3px; border-radius: 7px; background: #f1f2eb; }
.spare-time-filter { min-height: 28px; padding: 0 9px; border: 0; border-radius: 5px; background: transparent; color: #778075; font-size: 10px; }
.spare-time-filter[aria-pressed="true"] { background: #fffefa; color: #202923; box-shadow: 0 1px 3px #dfe1d8; font-weight: 700; }
.spare-time-status { margin-top: 12px; color: #557442; font-size: 11px; font-weight: 700; }
.spare-time-status:empty { display: none; }
.spare-time-suggestions { display: grid; gap: 7px; margin: 9px 0 0; padding: 0; list-style: none; }
.spare-time-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid #e8e9e0; border-radius: 7px; background: #f8f9f4; }
.spare-time-item-info { flex: 1; min-width: 0; }
.spare-time-item-title { font-size: 11px; font-weight: 700; }
.spare-time-item-meta { margin-top: 3px; color: #828b81; font-size: 9px; }
.spare-time-item .secondary-btn { flex: 0 0 auto; height: 30px; padding: 0 9px; font-size: 10px; }
.spare-time-privacy { margin-top: 9px; }
@media (max-width: 680px) { .spare-time-context { align-items: stretch; } .spare-time-field, .spare-time-field select { width: 100%; } .spare-time-fatigue input { width: 100%; } .spare-time-item { align-items: flex-start; flex-wrap: wrap; } .spare-time-item .secondary-btn { margin-left: auto; } }
`;
document.head.appendChild(spareTimeStyle);

const studyLocation = document.getElementById('studyLocation');
const studyFatigue = document.getElementById('studyFatigue');
const fatigueLabels = { 1: 'かなり疲れている', 2: '少し疲れている', 3: 'ふつう', 4: '元気', 5: 'とても元気' };

function getDayStudyGaps(date, fromMinute) {
  const day = dateKey(date);
  const commitments = [
    ...data.fixed.filter(item => item.day === date.getDay()),
    ...data.extras.filter(item => item.day === day),
    ...data.sessions.filter(item => item.day === day && !item.done)
  ].map(item => ({
    start: clockMinutes(item.start),
    end: clockMinutes(item.end),
    type: item.type
  })).sort((left, right) => left.start - right.start || left.end - right.end);

  const gaps = [];
  let cursor = Math.max(7 * 60, fromMinute);
  let previous = null;
  for (const commitment of commitments) {
    const start = Math.max(7 * 60, commitment.start);
    const end = Math.min(22 * 60, commitment.end);
    if (start - cursor >= 15) {
      gaps.push({
        day,
        start: cursor,
        end: start,
        minutes: start - cursor,
        classGap: previous?.type === 'class' && commitment.type === 'class'
      });
    }
    if (end > cursor) {
      cursor = end;
      previous = commitment;
    }
  }
  if (22 * 60 - cursor >= 15) {
    gaps.push({ day, start: cursor, end: 22 * 60, minutes: 22 * 60 - cursor, classGap: false });
  }
  return gaps;
}

function getUpcomingStudyGaps(now = new Date(), horizonDays = 7) {
  const gaps = [];
  for (let offset = 0; offset < horizonDays; offset++) {
    const date = addDays(today, offset);
    const fromMinute = offset === 0 ? now.getHours() * 60 + now.getMinutes() : 7 * 60;
    gaps.push(...getDayStudyGaps(date, fromMinute));
  }
  return gaps.sort((left, right) => left.day.localeCompare(right.day) || left.start - right.start);
}

function getStudyActivity(task) {
  const plan = task.planId && data.plans.find(item => item.id === task.planId);
  const text = `${plan?.kind || ''} ${task.phase || ''} ${task.name}`.toLowerCase();
  if (/reading|読書|読解|暗記|復習|総復習|範囲整理|単語|基礎確認|要点整理/.test(text)) return 'light';
  if (/report|執筆|推敲|調査|構成|演習|問題|計算|論文/.test(text)) return 'deep';
  return plan?.kind === 'exam' ? 'light' : 'general';
}

function getTaskUnscheduledMinutes(task) {
  const scheduled = data.sessions
    .filter(session => session.taskId === task.id && !session.done && session.day >= dateKey(today))
    .reduce((sum, session) => sum + durationHours(session.start, session.end) * 60, 0);
  return Math.max(0, Math.ceil((Number(task.remaining) || 0) * 60 - scheduled));
}

function getSmartStudySuggestions(gap, location = data.context.location, fatigue = data.context.fatigue, maxMinutes = 25, mode = null) {
  if (!gap || gap.minutes < 15) return [];
  const availableMinutes = Math.floor(gap.minutes / 5) * 5;
  const selectedMode = mode || data.context.mode;
  return data.tasks
    .filter(task => !task.done && task.remaining > 0 && task.due >= dateKey(today))
    .map(task => {
      const taskMinutes = getTaskUnscheduledMinutes(task);
      const minutes = Math.min(maxMinutes, availableMinutes, taskMinutes);
      if (minutes < 15) return null;
      const activity = getStudyActivity(task);
      if (selectedMode === 'focus' && activity === 'light') return null;
      if (selectedMode === 'easy' && activity === 'deep') return null;
      const locationScore = {
        library: { light: 2, deep: 2, general: 1 },
        cafe: { light: 2, deep: -1, general: 1 },
        home: { light: 1, deep: 2, general: 1 }
      }[location]?.[activity] || 0;
      const fatigueScore = fatigue <= 2
        ? (activity === 'light' ? 3 : activity === 'deep' ? -2 : 1)
        : fatigue >= 4
          ? (activity === 'deep' ? 2 : 0)
          : 1;
      const modeScore = selectedMode === 'focus'
        ? (activity === 'deep' ? 3 : activity === 'general' ? 1 : -2)
        : (activity === 'light' ? 3 : activity === 'general' ? 1 : -2);
      const plan = task.planId && data.plans.find(item => item.id === task.planId);
      const priorityScore = plan && typeof getPlanPriority === 'function' ? getPlanPriority(plan) : 0;
      return { task, minutes, activity, score: locationScore + fatigueScore + modeScore + Math.log1p(priorityScore) };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.task.due.localeCompare(right.task.due))
    .slice(0, 2);
}

function formatGapTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function renderSpareTimeSuggestions() {
  const fatigue = Number(studyFatigue.value);
  document.getElementById('studyFatigueLabel').textContent = fatigueLabels[fatigue];
  const status = document.getElementById('spareTimeStatus');
  const list = document.getElementById('spareTimeSuggestions');
  if (data.restDays?.includes(dateKey(today))) {
    status.textContent = '今日は休息日に設定されています。ゆっくり休みましょう。';
    list.innerHTML = '';
    return;
  }
  const selectedMinutes = data.context.duration;
  const gaps = getUpcomingStudyGaps();
  const gap = gaps.find(item => item.minutes >= selectedMinutes);
  for (const button of document.querySelectorAll('#spareTimePanel [data-duration]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.duration) === selectedMinutes));
  }
  for (const button of document.querySelectorAll('#spareTimePanel [data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === data.context.mode));
  }

  if (!gap) {
    status.textContent = `今後7日間に${selectedMinutes}分以上の空き時間は見つかりませんでした。`;
    list.innerHTML = '';
    return;
  }
  const locationName = { library: '図書館', cafe: 'カフェ', home: '自宅' }[data.context.location];
  const gapName = gap.classGap && gap.minutes >= 60 ? '授業の空きコマ' : '次の空き時間';
  status.textContent = `${gap.day} ${formatGapTime(gap.start)}〜${formatGapTime(gap.end)}（${gap.minutes}分）${gapName} · ${locationName}`;
  const suggestions = getSmartStudySuggestions(gap, data.context.location, fatigue, selectedMinutes);
  if (!suggestions.length) {
    list.innerHTML = '<li class="spare-time-note">この空き時間に無理なく終えられる未配置の課題はありません。</li>';
    return;
  }
  list.innerHTML = suggestions.map(({ task, minutes }) => {
    const activityName = { light: '軽めの復習', deep: '集中して進める', general: '少しずつ進める' }[getStudyActivity(task)];
    const title = task.phase ? `${task.name}・${task.phase}` : task.name;
    return `<li class="spare-time-item">
      <div class="spare-time-item-info">
        <div class="spare-time-item-title">${escapeHTML(title)}</div>
        <div class="spare-time-item-meta">${minutes}分 · ${activityName} · ${fmtDate(new Date(`${task.due}T00:00:00`))}締切</div>
      </div>
      <button class="secondary-btn" type="button" data-spare-task="${escapeHTML(task.id)}">この時間に予定</button>
    </li>`;
  }).join('');
  list.querySelectorAll('[data-spare-task]').forEach(button => {
    button.addEventListener('click', () => scheduleSpareTimeTask(button.dataset.spareTask));
  });
}

function scheduleSpareTimeTask(taskId) {
  const task = data.tasks.find(item => item.id === taskId && !item.done);
  const gap = getUpcomingStudyGaps().find(item => item.minutes >= data.context.duration);
  const suggestion = task && getSmartStudySuggestions(gap, data.context.location, data.context.fatigue, data.context.duration)
    .find(item => item.task.id === taskId);
  if (!task || !gap || !suggestion) {
    showToast('空き時間または課題の状態が変わりました。提案を更新しました');
    renderSpareTimeSuggestions();
    return false;
  }
  return addStudySuggestionSession(task, gap, suggestion.minutes);
}

function addStudySuggestionSession(task, gap, minutes) {
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > gap.minutes || gap.start + minutes > 22 * 60) {
    showToast('空き時間に収まる学習時間を選んでください');
    return false;
  }
  const endMinute = gap.start + minutes;
  data.sessions.push({
    id: `sp${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
    taskId: task.id,
    name: task.phase ? `${task.name}・${task.phase}` : task.name,
    day: gap.day,
    start: formatGapTime(gap.start),
    end: formatGapTime(endMinute),
    type: 'study',
    done: false
  });
  data.recentlyScheduledSessionIds = [data.sessions.at(-1).id];
  save();
  renderCalendar();
  renderTasks();
  setTimeout(() => {
    data.recentlyScheduledSessionIds = [];
    renderCalendar();
  }, 900);
  showToast(`${minutes}分の学習予定を空き時間に追加しました`);
  return true;
}

function saveStudyContext() {
  data.context = {
    ...data.context,
    location: studyLocation.value,
    fatigue: Number(studyFatigue.value)
  };
  save();
  renderSpareTimeSuggestions();
}

function setSpareTimeDuration(minutes) {
  if (![15, 30, 60].includes(Number(minutes))) return false;
  data.context.duration = Number(minutes);
  saveStudyContext();
  return true;
}

function setSpareTimeMode(mode) {
  if (!['focus', 'easy'].includes(mode)) return false;
  data.context.mode = mode;
  saveStudyContext();
  return true;
}

studyLocation.value = data.context.location;
studyFatigue.value = data.context.fatigue;
studyLocation.addEventListener('change', saveStudyContext);
studyFatigue.addEventListener('input', saveStudyContext);
document.querySelectorAll('#spareTimePanel [data-duration]').forEach(button => {
  button.addEventListener('click', () => setSpareTimeDuration(button.dataset.duration));
});
document.querySelectorAll('#spareTimePanel [data-mode]').forEach(button => {
  button.addEventListener('click', () => setSpareTimeMode(button.dataset.mode));
});

const renderTasksWithSpareTime = renderTasks;
renderTasks = (...args) => {
  renderTasksWithSpareTime(...args);
  renderSpareTimeSuggestions();
};

const renderCalendarWithSpareTime = renderCalendar;
renderCalendar = (...args) => {
  renderCalendarWithSpareTime(...args);
  renderSpareTimeSuggestions();
};

setInterval(renderSpareTimeSuggestions, 60000);
renderSpareTimeSuggestions();
