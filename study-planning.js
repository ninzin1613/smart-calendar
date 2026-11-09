data.plans = data.plans || [];

document.getElementById('durationField').insertAdjacentHTML('afterend', `
  <div class="field full study-field" id="studyTypeField" hidden>
    <label for="studyType">課題の種類</label>
    <select id="studyType" name="studyType">
      <option value="report">レポート</option>
      <option value="reading">教科書・読書</option>
      <option value="exam">テスト対策</option>
    </select>
  </div>
  <div class="field study-field" id="studyWorkloadField" hidden>
    <label for="studyWorkload" id="studyWorkloadLabel">課題量</label>
    <input id="studyWorkload" name="studyWorkload" type="number" min="1" step="1" value="3000">
  </div>
  <div class="field study-field" id="studyDifficultyField" hidden>
    <label for="studyDifficulty">難易度</label>
    <select id="studyDifficulty" name="studyDifficulty">
      <option value="1">1・やさしい</option>
      <option value="2">2</option>
      <option value="3" selected>3・ふつう</option>
      <option value="4">4</option>
      <option value="5">5・難しい</option>
    </select>
  </div>
  <div class="field full study-field" id="studyScopeField" hidden>
    <label for="studyScope">テスト範囲</label>
    <input id="studyScope" name="studyScope" maxlength="120" placeholder="例：教科書 p.50〜100、講義 第1〜5回">
  </div>
  <div class="field study-field" id="courseCreditsField" hidden>
    <label for="courseCredits">単位数（重み）</label>
    <input id="courseCredits" name="courseCredits" type="number" min="0.5" max="30" step="0.5" value="1">
  </div>
  <div class="field study-field" id="studyProgressField" hidden>
    <label for="studyProgress">進捗率（%）</label>
    <input id="studyProgress" name="studyProgress" type="number" min="0" max="100" step="5" value="0">
  </div>
  <div class="field full study-field" id="studyEstimateNote" hidden aria-live="polite"></div>
`);

const studyType = document.getElementById('studyType');
const studyWorkload = document.getElementById('studyWorkload');
const studyDifficulty = document.getElementById('studyDifficulty');
const studyScopeField = document.getElementById('studyScopeField');
const studyScope = document.getElementById('studyScope');
const studyEstimateNote = document.getElementById('studyEstimateNote');

document.querySelector('.below-calendar').insertAdjacentHTML('beforebegin', `
  <section class="priority-panel" id="priorityPanel" aria-labelledby="priorityTitle">
    <div class="priority-heading">
      <div>
        <div class="panel-title" id="priorityTitle">今、優先する課題</div>
        <div class="priority-note">単位数・締め切り・残りの進捗から算出</div>
      </div>
    </div>
    <ol class="priority-list" id="priorityList"></ol>
  </section>
`);

const studyStyle = document.createElement('style');
studyStyle.textContent = `
.study-field[hidden], .priority-panel[hidden] { display: none; }
.study-field input, .study-field select { width: 100%; }
.priority-panel { margin: 0 0 16px; padding: 14px 16px; border: 1px solid #e4ebf4; border-radius: 9px; background: #fffefa; }
.priority-heading { display: flex; justify-content: space-between; align-items: center; }
.priority-note { margin-top: 4px; color: #828b81; font-size: 10px; }
.priority-list { display: grid; gap: 7px; margin: 11px 0 0; padding: 0; list-style: none; }
.priority-item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 7px; background: #f5f7f1; }
.priority-rank { display: grid; flex: 0 0 22px; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: #e8eddf; color: #557442; font-size: 10px; font-weight: 700; }
.priority-item:first-child .priority-rank { background: #f8eee8; color: #bf684f; }
.priority-name { flex: 1; min-width: 0; font-size: 11px; font-weight: 700; }
.priority-meta { color: #828b81; font-size: 9px; white-space: nowrap; }
.task-phase { color: #718563; font-weight: 500; }
`;
document.head.appendChild(studyStyle);

function estimateStudyHours(kind, workload, difficulty) {
  const amount = Number(workload);
  const level = Number(difficulty);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(level) || level < 1 || level > 5) return 0;
  const difficultyMultiplier = [0.7, 0.85, 1, 1.2, 1.5][level - 1];
  const hoursPerUnit = { report: 0.0008, reading: 0.08, exam: 0.06 }[kind];
  return hoursPerUnit ? Math.ceil(amount * hoursPerUnit * difficultyMultiplier * 4) / 4 : 0;
}

function getReviewDates(dueKey) {
  const due = new Date(`${dueKey}T00:00:00`);
  const daysUntilDue = Math.max(0, Math.round((due - today) / 86400000));
  const offsets = daysUntilDue >= 7
    ? [7, 3, 1]
    : daysUntilDue >= 3
      ? [3, 1]
      : Array.from({ length: daysUntilDue }, (_, index) => daysUntilDue - index);
  const dates = offsets
    .map(offset => dateKey(addDays(due, -offset)))
    .filter(day => day >= dateKey(today) && day <= dueKey);
  if (!dates.length) dates.push(dueKey);
  return [...new Set(dates)].sort();
}

function updateStudyEstimate() {
  const kind = studyType.value;
  const workload = Number(studyWorkload.value);
  const difficulty = Number(studyDifficulty.value);
  const units = kind === 'report' ? '文字' : 'ページ';
  document.getElementById('studyWorkloadLabel').textContent = `課題量（${units}）`;
  studyWorkload.value = kind === 'report' ? (studyWorkload.value || 3000) : (studyWorkload.value || 50);
  const hours = estimateStudyHours(kind, workload || Number(studyWorkload.value), difficulty);
  if (hours) document.getElementById('eventDuration').value = hours;
  studyEstimateNote.textContent = hours
    ? `目安：約${hours}時間（レポートは1000文字あたり約0.8時間、読書は1ページあたり約0.08時間、テストは1ページあたり約0.06時間。難易度で補正します）`
    : '課題量と難易度を入力すると学習時間を見積もります。';
}

function syncStudyFields() {
  const isTask = eventTypeSelect.value === 'task';
  const kind = studyType.value;
  for (const id of ['studyTypeField', 'studyWorkloadField', 'studyDifficultyField', 'courseCreditsField', 'studyProgressField', 'studyEstimateNote']) {
    document.getElementById(id).hidden = !isTask;
  }
  studyScopeField.hidden = !isTask || kind !== 'exam';
  studyScope.required = isTask && kind === 'exam';
  studyWorkload.required = isTask;
  updateStudyEstimate();
}

function getPlanPriority(plan) {
  const tasks = data.tasks.filter(task => plan.legacyTaskId ? task.id === plan.legacyTaskId : task.planId === plan.id);
  const total = tasks.reduce((sum, task) => sum + Number(task.hours || 0), 0);
  const remaining = tasks.reduce((sum, task) => sum + Number(task.remaining || 0), 0);
  const daysToDue = Math.max(0, Math.ceil((new Date(`${plan.due}T00:00:00`) - today) / 86400000));
  const completionRatio = total ? Math.max(0, Math.min(1, 1 - remaining / total)) : 1;
  return Number(plan.credits || 1) * (1 + 7 / (daysToDue + 1)) * (1 - completionRatio);
}

function getPriorityPlans() {
  const plans = [...data.plans];
  for (const task of data.tasks.filter(item => !item.planId)) {
    plans.push({
      id: task.id,
      name: task.name,
      due: task.due,
      credits: 1,
      legacyTaskId: task.id
    });
  }
  return plans
    .filter(plan => data.tasks.some(task => (plan.legacyTaskId ? task.id === plan.legacyTaskId : task.planId === plan.id && !task.done && task.remaining > 0)))
    .map(plan => ({ ...plan, score: getPlanPriority(plan) }))
    .sort((left, right) => right.score - left.score || left.due.localeCompare(right.due));
}

function renderPriority() {
  const panel = document.getElementById('priorityPanel');
  const list = document.getElementById('priorityList');
  const plans = getPriorityPlans();
  panel.hidden = plans.length === 0;
  list.innerHTML = plans.map((plan, index) => {
    const remaining = data.tasks
      .filter(task => plan.legacyTaskId ? task.id === plan.legacyTaskId : task.planId === plan.id)
      .reduce((sum, task) => sum + Number(task.remaining || 0), 0);
    return `<li class="priority-item"><span class="priority-rank">${index + 1}</span><span class="priority-name">${escapeHTML(plan.name)}</span><span class="priority-meta">${remaining.toFixed(remaining % 1 ? 1 : 0)}時間 · ${fmtDate(new Date(`${plan.due}T00:00:00`))}締切</span></li>`;
  }).join('');
}

function renderPlannedTasks() {
  const list = document.getElementById('taskList');
  const plans = getPriorityPlans();
  const tasks = plans.flatMap(plan => data.tasks
    .filter(task => plan.legacyTaskId ? task.id === plan.legacyTaskId : task.planId === plan.id)
    .filter(task => !task.done && task.remaining > 0)
    .map(task => ({ ...task, parentName: plan.name, score: plan.score })))
    .sort((left, right) => right.score - left.score || left.order - right.order);
  document.getElementById('taskCount').textContent = tasks.length;
  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state">課題はすべて完了。いい調子です。</div>';
  } else {
    list.innerHTML = tasks.slice(0, 8).map(task => {
      const daysLeft = Math.ceil((new Date(`${task.due}T00:00:00`) - today) / 86400000);
      const dueText = daysLeft < 0 ? `${Math.abs(daysLeft)}日超過` : `${daysLeft}日後`;
      const title = task.phase ? `${task.parentName} <span class="task-phase">· ${escapeHTML(task.phase)}</span>` : escapeHTML(task.name);
      const scope = task.scope ? ` · 範囲 ${escapeHTML(task.scope)}` : '';
      return `<div class="task-row"><input class="check" type="checkbox" aria-label="${escapeHTML(task.name)}を完了" data-task="${escapeHTML(task.id)}"><div class="task-info"><div class="task-title">${title}</div><div class="task-meta">残り約${Number(task.remaining).toFixed(task.remaining % 1 ? 1 : 0)}時間 · ${fmtDate(new Date(`${task.due}T00:00:00`))}締め切り${scope}</div></div><div class="due">${dueText}</div></div>`;
    }).join('');
  }
  list.querySelectorAll('[data-task]').forEach(element => element.addEventListener('change', () => {
    const task = data.tasks.find(item => item.id === element.dataset.task);
    if (!task) return;
    task.done = element.checked;
    task.remaining = element.checked ? 0 : task.hours;
    data.sessions = data.sessions.filter(session => session.taskId !== task.id);
    save();
    renderTasks();
    renderCalendar();
    showToast('課題を完了にしました');
  }));
  renderPriority();
  if (typeof renderCapacityWarning === 'function') renderCapacityWarning();
}

function createStudyPlan({ name, kind, due, workload, difficulty, hours, credits, progress, scope }) {
  const totalHours = Number(hours);
  if (!name || !['report', 'reading', 'exam'].includes(kind) || !due || due < dateKey(today)
      || !Number.isFinite(totalHours) || totalHours <= 0 || totalHours > 200
      || Math.abs(totalHours * 60 - Math.round(totalHours * 60)) > 0.00001
      || !Number.isFinite(Number(credits)) || Number(credits) <= 0
      || !Number.isFinite(Number(progress)) || Number(progress) < 0 || Number(progress) > 100
      || (kind === 'exam' && !String(scope || '').trim())) {
    showToast('課題の種類、期限、学習時間、単位数、進捗を確認してください');
    return null;
  }

  const planId = `p${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
  const phases = kind === 'report'
    ? [{ name: '調査・構成', share: 0.25 }, { name: '執筆', share: 0.55 }, { name: '推敲', share: 0.2 }]
    : kind === 'reading'
      ? [{ name: '読解', share: 0.7 }, { name: '要点整理・確認', share: 0.3 }]
      : getReviewDates(due).map((day, index, dates) => ({
        name: dates.length === 3 ? ['範囲整理・基礎確認', '問題演習', '総復習'][index]
          : dates.length === 2 ? ['範囲確認・復習', '演習・最終確認'][index]
            : '範囲確認・復習',
        share: 1 / dates.length,
        scheduleOnDate: day
      }));
  const plan = {
    id: planId,
    name,
    kind,
    due,
    credits: Number(credits),
    progressPercent: Number(progress),
    estimatedHours: totalHours,
    workload: Number(workload),
    difficulty: Number(difficulty),
    scope: String(scope || '').trim()
  };
  data.plans.push(plan);

  const totalMinutes = Math.round(totalHours * 60);
  const phaseMinutes = phases.map(phase => Math.floor(totalMinutes * phase.share));
  let unassignedMinutes = totalMinutes - phaseMinutes.reduce((sum, minutes) => sum + minutes, 0);
  const fractionalMinutes = phases
    .map((phase, index) => ({ index, fraction: totalMinutes * phase.share - phaseMinutes[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < unassignedMinutes; index++) phaseMinutes[fractionalMinutes[index].index]++;

  let completedMinutes = Math.round(totalMinutes * Number(progress) / 100);
  phases.forEach((phase, index) => {
    const allocatedMinutes = phaseMinutes[index];
    const completed = Math.min(allocatedMinutes, completedMinutes);
    completedMinutes -= completed;
    const remaining = (allocatedMinutes - completed) / 60;
    data.tasks.push({
      id: `${planId}-${index + 1}`,
      planId,
      name,
      phase: phase.name,
      order: index,
      due,
      scheduleOnDate: phase.scheduleOnDate,
      scope: plan.scope,
      hours: allocatedMinutes / 60,
      remaining,
      done: remaining === 0
    });
  });
  createSchedule();
  return plan;
}

function createStudySchedule({ reroute = false } = {}) {
  if (reroute) data.sessions = data.sessions.filter(session => session.done || session.day < dateKey(today));
  const pending = data.tasks
    .filter(task => !task.done && task.remaining > 0)
    .sort((left, right) => {
      const leftPlan = left.planId && data.plans.find(plan => plan.id === left.planId);
      const rightPlan = right.planId && data.plans.find(plan => plan.id === right.planId);
      const priorityDifference = (rightPlan ? getPlanPriority(rightPlan) : 0) - (leftPlan ? getPlanPriority(leftPlan) : 0);
      return priorityDifference || left.due.localeCompare(right.due) || (left.order || 0) - (right.order || 0);
    });
  let placed = 0;
  let missed = 0;

  for (const task of pending) {
    const scheduled = data.sessions
      .filter(session => session.taskId === task.id && !session.done && session.day >= dateKey(today))
      .reduce((sum, session) => sum + durationHours(session.start, session.end), 0);
    let remaining = Math.max(0, task.remaining - scheduled);
    const deadline = new Date(`${task.due}T00:00:00`);
    for (let date = new Date(today); date <= deadline && remaining > 0; date = addDays(date, 1)) {
      const day = dateKey(date);
      if (task.scheduleOnDate && task.scheduleOnDate !== day) continue;
      const blocks = getBlocks(date)
        .map(item => ({ start: clockMinutes(item.start), end: clockMinutes(item.end) }))
        .sort((left, right) => left.start - right.start);
      let cursor = 540;
      const available = [];
      for (const block of blocks) {
        if (block.start - cursor >= 60) available.push([cursor, block.start]);
        cursor = Math.max(cursor, block.end);
      }
      if (1320 - cursor >= 60) available.push([cursor, 1320]);
      for (const [start, end] of available) {
        let slotStart = start;
        while (end - slotStart >= 15 && remaining * 60 >= 15) {
          const length = Math.floor(Math.min(60, remaining * 60, end - slotStart));
          if (length < 15) break;
          const startText = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
          const endMinute = slotStart + length;
          const endText = `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;
          data.sessions.push({
            id: `s${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
            taskId: task.id,
            name: task.phase ? `${task.name}・${task.phase}` : task.name,
            day,
            start: startText,
            end: endText,
            type: 'study',
            done: false
          });
          remaining -= length / 60;
          placed++;
          slotStart += length;
        }
      }
    }
    if (remaining > 0) missed++;
  }

  data.capacityShortages = data.tasks.filter(task => !task.done && task.remaining > 0).map(task => task.id);
  save();
  renderCalendar();
  renderTasks();
  showToast(missed
    ? `${placed}コマを配置。${missed}件は空き時間が足りません`
    : `${placed}コマを空き時間に配置しました`);
}

eventTypeSelect.addEventListener('change', syncStudyFields);
let previousStudyType = studyType.value;
studyType.addEventListener('change', () => {
  if (studyType.value !== previousStudyType) studyWorkload.value = studyType.value === 'report' ? 3000 : 50;
  previousStudyType = studyType.value;
  syncStudyFields();
});
for (const element of [studyWorkload, studyDifficulty]) element.addEventListener('input', updateStudyEstimate);
for (const id of ['addBtn', 'tasksNav', 'allTasks']) document.getElementById(id).addEventListener('click', syncStudyFields);

document.getElementById('eventForm').addEventListener('submit', event => {
  if (eventTypeSelect.value !== 'task') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const form = new FormData(event.currentTarget);
  const name = String(form.get('name') || '').trim();
  const due = String(form.get('due') || '');
  const kind = String(form.get('studyType') || 'report');
  const workload = Number(form.get('studyWorkload'));
  const difficulty = Number(form.get('studyDifficulty'));
  const hours = Number(form.get('duration'));
  const credits = Number(form.get('courseCredits'));
  const progress = Number(form.get('studyProgress'));
  const scope = String(form.get('studyScope') || '').trim();
  if (!name || !due || due < dateKey(today) || !Number.isFinite(workload) || workload < 1
      || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5
      || !Number.isFinite(hours) || hours <= 0 || hours > 200
      || !Number.isFinite(credits) || credits <= 0
      || !Number.isFinite(progress) || progress < 0 || progress > 100
      || (kind === 'exam' && !scope)) {
    showToast('課題量、難易度、期限、学習時間、単位数、進捗を確認してください');
    return;
  }
  createStudyPlan({ name, kind, due, workload, difficulty, hours, credits, progress, scope });
  closeModal();
  event.currentTarget.reset();
  eventTypeSelect.value = 'class';
  syncEventScheduleFields();
  document.getElementById('modalTitle').textContent = '予定を追加';
  syncStudyFields();
}, true);

const originalTaskCompletionToggle = toggleSession;
toggleSession = (...args) => {
  originalTaskCompletionToggle(...args);
  for (const plan of data.plans) {
    const planTasks = data.tasks.filter(task => task.planId === plan.id);
    const completedHours = planTasks.reduce((sum, task) => sum + task.hours - task.remaining, 0);
    plan.progressPercent = plan.estimatedHours
      ? Math.round(completedHours / plan.estimatedHours * 100)
      : 100;
  }
  save();
  renderTasks();
};

renderTasks = renderPlannedTasks;
createSchedule = createStudySchedule;
syncStudyFields();
renderTasks();
