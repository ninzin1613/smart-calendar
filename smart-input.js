const smartInputForm = document.getElementById('eventForm');
const smartInputPending = [];
let smartInputEditTarget = null;
let smartInputLastEntries = [];

smartInputForm.querySelector('.modal-head').insertAdjacentHTML('afterend', `
  <div class="entry-mode-tabs" role="tablist" aria-label="予定の入力方法">
    <button class="entry-mode-tab" type="button" id="smartInputTab" role="tab" aria-selected="true">🦉 AIにおまかせ入力（おすすめ）</button>
    <button class="entry-mode-tab" type="button" id="manualInputTab" role="tab" aria-selected="false">✏️ 自分で細かく設定</button>
  </div>
  <section class="smart-input-panel" id="smartInputPanel" aria-labelledby="smartInputTitle">
    <div class="smart-input-entry" id="smartInputEntry">
      <h3 id="smartInputTitle">文章から予定を作成</h3>
      <p>予定や締め切りを1行ずつ入力してください。解析はこのブラウザー内で行います。</p>
      <textarea id="smartInputText" rows="4" placeholder="例：明日 18:00-22:00 バイト&#10;11/25までに英語レポート（重め）"></textarea>
      <div class="smart-input-chips" aria-label="入力テンプレート">
        <button type="button" data-smart-template="shift">＋ バイト 4h</button>
        <button type="button" data-smart-template="class">＋ 授業 90m</button>
        <button type="button" data-smart-template="club">＋ サークル 2h</button>
        <button type="button" data-smart-template="task">＋ 課題 60m</button>
      </div>
      <label class="smart-auto-schedule-label"><input id="smartAutoSchedule" type="checkbox" checked> 課題を登録したら学習計画も自動配置する</label>
      <button class="primary-btn smart-input-submit" type="button" id="analyzeSmartInput">AIで解析して確認</button>
      <div class="smart-input-status" id="smartInputStatus" role="status" aria-live="polite"></div>
      <div class="smart-input-results" id="smartInputResults"></div>
    </div>
    <section class="smart-input-review" id="smartInputReview" aria-labelledby="smartInputReviewTitle" hidden>
      <h3 id="smartInputReviewTitle">AIが作成した内容の確認</h3>
      <p id="smartInputReviewPrompt" role="status" aria-live="polite"></p>
      <div id="smartInputReviewList"></div>
      <div class="smart-input-review-actions">
        <button class="secondary-btn" type="button" id="editSmartInput">文章を修正</button>
        <button class="primary-btn" type="button" id="confirmSmartInput">この内容で追加</button>
      </div>
    </section>
  </section>
`);
smartInputForm.classList.add('ai-entry-mode');

const smartInputStyle = document.createElement('style');
smartInputStyle.textContent = `
.entry-mode-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 0 0 12px; }
.entry-mode-tab { min-height: 38px; padding: 7px 8px; border: 1px solid #e3e7dd; border-radius: 7px; background: #f7f8f3; color: #64705e; font-size: 10px; font-weight: 700; }
.entry-mode-tab[aria-selected="true"] { border-color: #9bab89; background: #edf2e7; color: #405b36; }
.modal.ai-entry-mode .form-grid, .modal.ai-entry-mode .modal-actions { display: none !important; }
.smart-input-panel { display: none; }
.modal.ai-entry-mode .smart-input-panel { display: block; }
.smart-input-panel h3 { margin: 2px 0 5px; font-size: 13px; }
.smart-input-entry[hidden], .smart-input-review[hidden] { display: none; }
.smart-input-entry > p, .smart-input-review > p { margin: 0 0 9px; color: #828b81; font-size: 10px; line-height: 1.5; }
.smart-input-panel textarea { width: 100%; min-height: 90px; padding: 10px; resize: vertical; border: 1px solid #dfe4da; border-radius: 7px; font: inherit; font-size: 11px; }
.smart-input-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.smart-input-chips button { padding: 5px 8px; border: 1px solid #e2e8dd; border-radius: 14px; background: #f4f7f0; color: #526647; font-size: 9px; }
.smart-auto-schedule-label { display: flex; align-items: center; gap: 7px; margin: 7px 0; color: #626d5b; font-size: 10px; }
.smart-auto-schedule-label input { accent-color: #718563; }
.smart-input-submit { width: 100%; min-height: 38px; margin-top: 3px; }
.smart-input-status { min-height: 15px; margin-top: 8px; color: #64705e; font-size: 10px; }
.smart-input-results { display: grid; gap: 5px; margin-top: 5px; }
.smart-input-result { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 6px; background: #f4f7f0; font-size: 10px; }
.smart-input-result button { flex: 0 0 auto; padding: 4px 6px; border: 0; background: transparent; color: #557442; font-size: 9px; text-decoration: underline; }
.smart-input-review { margin-top: 3px; }
.smart-input-pending { margin: 8px 0; padding: 10px; border: 1px solid #e5e8df; border-radius: 8px; background: #fffefa; }
.smart-input-pending-source { margin-bottom: 8px; color: #828b81; font-size: 9px; overflow-wrap: anywhere; }
.smart-input-required { margin-bottom: 8px; color: #8a5a32; font-size: 9px; }
.smart-input-required.has-missing { color: #c94e42 !important; font-weight: 700 !important; }
.smart-input-pending label { display: block; margin: 5px 0; color: #626d5b; font-size: 9px; }
.smart-input-pending input, .smart-input-pending select { width: 100%; min-height: 30px; margin-top: 3px; padding: 4px 6px; border: 1px solid #dfe4da; border-radius: 5px; font: inherit; font-size: 10px; }
.smart-input-pending input.is-invalid, .smart-input-pending select.is-invalid { border-color: #e47c61 !important; outline: 2px solid rgba(228, 124, 97, .4) !important; background-color: #fff9f8 !important; }
.smart-input-pending .smart-pending-row { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.smart-input-review-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.modal:not(.ai-entry-mode) .smart-input-panel { display: none; }
@media (max-width: 560px) { .entry-mode-tab { font-size: 9px; } .smart-input-pending .smart-pending-row { grid-template-columns: 1fr; } }
`;
document.head.appendChild(smartInputStyle);

const smartInputTab = document.getElementById('smartInputTab');
const manualInputTab = document.getElementById('manualInputTab');
const smartInputPanel = document.getElementById('smartInputPanel');
const smartInputEntry = document.getElementById('smartInputEntry');
const smartInputText = document.getElementById('smartInputText');
const smartInputStatus = document.getElementById('smartInputStatus');
const smartInputResults = document.getElementById('smartInputResults');
const smartInputReview = document.getElementById('smartInputReview');
const smartInputReviewPrompt = document.getElementById('smartInputReviewPrompt');
const smartInputReviewList = document.getElementById('smartInputReviewList');
let smartInputReviewActive = false;
document.getElementById('eventDuration').min = '0.25';
document.getElementById('smartAutoSchedule').checked = true;

function setSmartInputMode(mode) {
  const isAi = mode === 'ai';
  if (isAi) smartInputForm.classList.add('ai-entry-mode');
  else smartInputForm.classList.remove('ai-entry-mode');
  smartInputTab.setAttribute('aria-selected', String(isAi));
  manualInputTab.setAttribute('aria-selected', String(!isAi));
  smartInputEntry.hidden = smartInputReviewActive;
  smartInputReview.hidden = !smartInputReviewActive;
}

smartInputTab.addEventListener('click', () => setSmartInputMode('ai'));
manualInputTab.addEventListener('click', () => setSmartInputMode('manual'));

function normalizeSmartInput(value) {
  return String(value || '')
    .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[〜～−–—]/g, '-')
    .replace(/[　]/g, ' ')
    .trim();
}

const SMART_PERIOD_TIMES = {
  1: { start: '09:00', end: '10:30' },
  2: { start: '10:40', end: '12:10' },
  3: { start: '13:00', end: '14:30' },
  4: { start: '14:45', end: '16:15' },
  5: { start: '16:30', end: '18:00' }
};

function getSmartInputWeekday(source) {
  if (/今日|きょう|明日|あした|明後日|あさって/.test(source)) return null;
  const match = source.match(/(?:来週|毎週|今週|次の)?\s*(日|月|火|水|木|金|土)(?:曜(?:日)?)?|(?:^|\s)(日|月|火|水|木|金|土)曜(?:日)?(?:\s|$)/);
  if (!match) return null;
  const weekdayChar = match[1] || match[2];
  if (!weekdayChar) return null;
  const weekday = ['日', '月', '火', '水', '木', '金', '土'].indexOf(weekdayChar);
  const difference = (weekday - today.getDay() + 7) % 7 || 7;
  return { weekday, date: dateKey(addDays(today, difference + (/^来週/.test(match[0]) ? 7 : 0))) };
}

function getSmartInputDate(source) {
  const normalized = normalizeSmartInput(source);
  if (/明後日|あさって/.test(normalized)) return dateKey(addDays(today, 2));
  if (/明日|あした/.test(normalized)) return dateKey(addDays(today, 1));
  if (/今日|きょう/.test(normalized)) return dateKey(today);
  const daysAfter = normalized.match(/(\d{1,2})\s*日後/);
  if (daysAfter) return dateKey(addDays(today, Number(daysAfter[1])));

  const fullDate = normalized.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (fullDate) {
    const date = new Date(Number(fullDate[1]), Number(fullDate[2]) - 1, Number(fullDate[3]));
    return date.getFullYear() === Number(fullDate[1]) && date.getMonth() === Number(fullDate[2]) - 1
      && date.getDate() === Number(fullDate[3]) ? dateKey(date) : null;
  }
  const monthDate = normalized.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/)
    || normalized.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
  if (monthDate) {
    let year = today.getFullYear();
    let date = new Date(year, Number(monthDate[1]) - 1, Number(monthDate[2]));
    if (date.getMonth() !== Number(monthDate[1]) - 1 || date.getDate() !== Number(monthDate[2])) return null;
    if (dateKey(date) < dateKey(today)) {
      year++;
      date = new Date(year, Number(monthDate[1]) - 1, Number(monthDate[2]));
    }
    return dateKey(date);
  }
  const dayOnly = normalized.match(/(\d{1,2})\s*日/);
  if (dayOnly) {
    let date = new Date(today.getFullYear(), today.getMonth(), Number(dayOnly[1]));
    if (date.getDate() !== Number(dayOnly[1])) return null;
    if (dateKey(date) < dateKey(today)) date = new Date(today.getFullYear(), today.getMonth() + 1, Number(dayOnly[1]));
    return dateKey(date);
  }
  const weekday = getSmartInputWeekday(normalized);
  return weekday?.date || null;
}

function parseSmartInputTime(source) {
  const normalized = normalizeSmartInput(source);
  const periodMatch = normalized.match(/([1-5])\s*限(?:目)?/);
  if (periodMatch) {
    const period = Number(periodMatch[1]);
    if (SMART_PERIOD_TIMES[period]) return { ...SMART_PERIOD_TIMES[period] };
  }

  const withHalf = normalized
    .replace(/(\d{1,2})時半/g, '$1:30')
    .replace(/(\d{1,2})時(\d{1,2})分/g, '$1:$2')
    .replace(/(\d{1,2})時/g, '$1:00');

  const match = withHalf.match(/(\d{1,2})(?::(\d{2}))?\s*(?:[-〜～–—]|から)\s*(\d{1,2})(?::(\d{2}))?(?:まで)?/);
  if (!match) return null;
  const startHour = Number(match[1]);
  const startMinute = Number(match[2] || 0);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4] || 0);
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
  const start = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
  const end = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  return clockMinutes(end) > clockMinutes(start) ? { start, end } : null;
}

function extractSmartEventName(source, isTask, detectedType) {
  const normalized = normalizeSmartInput(source);
  let cleaned = normalized
    .replace(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*日?|\d{1,2}\s*[/.]\s*\d{1,2}|\d{1,2}\s*日/g, ' ')
    .replace(/明後日|あさって|明日|あした|今日|きょう|来週|毎週|今週|次の/g, ' ')
    .replace(/(?:日|月|火|水|木|金|土)(?:曜(?:日)?)?/g, ' ')
    .replace(/\d{1,2}(?::\d{2}|時(?:(?:\d{1,2})分?)?)?\s*[-〜～–—]\s*\d{1,2}(?::\d{2}|時(?:(?:\d{1,2})分?)?)?/g, ' ')
    .replace(/\d{1,2}(?::\d{2}|時(?:(?:\d{1,2})分?)?)(?:から|より|〜|~|-)?/g, ' ')
    .replace(/[1-5]\s*限(?:目)?/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:時間|分|h|m)/g, ' ')
    .replace(/(?:までに|まで|締切|〆切|提出|締め切り)/g, ' ')
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .replace(/[【\[].*?[】\]]/g, ' ')
    .replace(/[・,，:：!！?？]/g, ' ')
    .trim();

  if (/アルバイト/.test(cleaned)) {
    const m = cleaned.match(/([^\s]+?アルバイト)/);
    return m && !/の|で|から|と|に|へ/.test(m[1]) ? m[1] : 'アルバイト';
  }
  if (/バイト/.test(cleaned)) {
    const m = cleaned.match(/([^\s]+?バイト)/);
    return m && !/の|で|から|と|に|へ/.test(m[1]) ? m[1] : 'バイト';
  }
  if (/シフト/.test(cleaned) && !/変更/.test(cleaned)) {
    return 'バイト';
  }

  if (/サークル/.test(cleaned)) {
    const m = cleaned.match(/([^\s]+?サークル)/);
    return m && !/の|で|から|と|に|へ/.test(m[1]) ? m[1] : 'サークル';
  }
  if (/部活(?:動)?/.test(cleaned)) {
    return '部活';
  }

  if (/ゼミ/.test(cleaned)) return 'ゼミ';
  if (/講義/.test(cleaned)) {
    const m = cleaned.match(/([^\s]+?)(?:の)?講義/);
    if (m && m[1]) {
      const subject = m[1].replace(/^(?:までに|まで|から|より|に|で|の|今日|明日|明後日|予定|午後|午前|来週|毎週)+/g, '').trim();
      if (subject) return `${subject}講義`;
    }
    return '講義';
  }
  if (/授業/.test(cleaned)) {
    const m = cleaned.match(/([^\s]+?)(?:の)?授業/);
    if (m && m[1]) {
      const subject = m[1].replace(/^(?:までに|まで|から|より|に|で|の|今日|明日|明後日|予定|午後|午前|来週|毎週)+/g, '').trim();
      if (subject) return `${subject}授業`;
    }
    return '授業';
  }

  if (isTask || /レポート|課題|テスト|試験|小テスト|宿題/.test(cleaned)) {
    const m = cleaned.match(/([^\s]+?)(?:の)?(レポート|小テスト|テスト|試験|課題|宿題)/);
    if (m && m[1]) {
      const subject = m[1].replace(/^(?:までに|まで|から|より|に|で|の|重め|軽め|普通)+/g, '').trim();
      if (subject && !/今日|明日|明後日|来週|予定/.test(subject)) {
        return `${subject}${m[2]}`;
      }
    }
    if (/レポート/.test(cleaned)) return 'レポート';
    if (/小テスト/.test(cleaned)) return '小テスト';
    if (/テスト|試験/.test(cleaned)) return 'テスト';
    if (/課題|宿題/.test(cleaned)) return '課題';
  }

  const lifestyleWords = [
    'ランチ', '飲み会', 'ご飯', '食事', '映画', '買い物', '病院',
    '歯医者', '美容院', '面接', '面談', 'ガイダンス', '健康診断',
    'ミーティング', '合宿', '旅行', '説明会', '散髪'
  ];
  for (const word of lifestyleWords) {
    if (cleaned.includes(word)) return word;
  }

  let result = cleaned
    .replace(/(?:軽め|普通|重め|までに|まで|締切|〆切|提出|課題|予定|がある|があるよ|が入った|が入る|に入る|に行く|に行くよ|する|がある予定|のシフト|の予定|にある|へ行く|を見る|をやる|を行う)/g, ' ')
    .replace(/^(?:で|に|の|を|と|へ|から|より)\s*/, '')
    .replace(/\s*(?:で|に|の|を|と|へ|から|より)$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (result) return result;
  if (isTask) return '課題';
  if (detectedType === 'work') return 'バイト';
  if (detectedType === 'class') return '授業';
  if (detectedType === 'club') return 'サークル';
  return '予定';
}

function parseSmartInputLine(input) {
  const line = normalizeSmartInput(input);
  if (!line) return null;
  const date = getSmartInputDate(line);
  const weekday = getSmartInputWeekday(line);
  const time = parseSmartInputTime(line);
  const isTask = /課題|レポート|テスト|試験|宿題|提出|締切|〆切/.test(line);
  const isWeekly = /毎週/.test(line) || Boolean(weekday && !/(今日|きょう|明日|あした|明後日|あさって|\d{1,2}\s*月|\d{1,2}\s*\/|\d{1,2}\s*日後)/.test(line));

  let detectedType = 'personal';
  if (/バイト|アルバイト|シフト|塾講師|カフェ|居酒屋|コンビニ/.test(line)) {
    detectedType = 'work';
  } else if (/授業|講義|ゼミ|演習|実験|[1-5]限/.test(line)) {
    detectedType = 'class';
  } else if (/サークル|部活|部活動|練習|ミーティング|合宿|バンド/.test(line)) {
    detectedType = 'club';
  } else {
    detectedType = 'personal';
  }

  const name = extractSmartEventName(line, isTask, detectedType);
  const effort = line.match(/(\d+(?:\.\d+)?)\s*(時間|分|h|m)/);
  const estimatedHours = effort
    ? Number(effort[1]) * (/分|m/.test(effort[2]) ? 1 / 60 : 1)
    : /重め/.test(line) ? 3 : /軽め/.test(line) ? 0.5 : /普通/.test(line) ? 1 : 0;
  const candidate = {
    original: line,
    kind: isTask ? 'task' : 'event',
    name,
    date,
    weekday: weekday?.weekday ?? (date ? new Date(`${date}T00:00:00`).getDay() : null),
    repeat: isWeekly ? 'weekly' : 'once',
    type: detectedType,
    start: time?.start || '',
    end: time?.end || '',
    hours: estimatedHours,
    reason: ''
  };
  if (!candidate.name) candidate.reason = '名前を確認してください';
  else if (!date) candidate.reason = isWeekly && weekday ? '' : '日付または曜日を確認してください';
  else if (isTask && !estimatedHours) candidate.reason = '必要な学習時間を確認してください';
  else if (!isTask && (!time || (isWeekly && !weekday))) candidate.reason = '曜日と開始・終了時刻を確認してください';
  else if (isTask && date < dateKey(today)) candidate.reason = '締め切りが過去の日付です';
  else if (!isTask && !isWeekly && date < dateKey(today)) candidate.reason = '予定日が過去の日付です';
  candidate.ready = !candidate.reason;
  return candidate;
}

function parseSmartInput(text) {
  return String(text || '').split(/\r?\n/).map(parseSmartInputLine).filter(Boolean);
}

function makeSmartEntryId(prefix) {
  return `${prefix}${Date.now()}${Math.random().toString(16).slice(2, 7)}`;
}

function commitSmartInputEntry(candidate) {
  if (candidate.kind === 'task') {
    const id = makeSmartEntryId('task');
    const planId = makeSmartEntryId('plan');
    const kind = /テスト|試験/.test(candidate.original) ? 'exam' : /読書|教科書/.test(candidate.original) ? 'reading' : 'report';
    const plan = {
      id: planId,
      name: candidate.name,
      kind,
      due: candidate.date,
      credits: 1,
      estimatedHours: candidate.hours,
      workload: 1,
      difficulty: /重め/.test(candidate.original) ? 5 : 3,
      scope: kind === 'exam' ? candidate.name : '',
      workloadKnown: false,
      aiGenerated: true,
      legacyTaskId: id
    };
    data.plans.push(plan);
    data.tasks.push({
      id,
      planId,
      name: candidate.name,
      due: candidate.date,
      hours: candidate.hours,
      remaining: candidate.hours,
      done: false,
      aiGenerated: true
    });
    return { source: 'task', id, name: candidate.name };
  }

  const item = {
    id: makeSmartEntryId('event'),
    name: candidate.name,
    start: candidate.start,
    end: candidate.end,
    type: candidate.type,
    day: candidate.repeat === 'weekly' ? candidate.weekday : candidate.date
  };
  const source = candidate.repeat === 'weekly' ? 'fixed' : 'extras';
  data[source].push(item);
  if (source === 'extras') {
    weekStart = startOfWeek(new Date(`${candidate.date}T00:00:00`));
    dayMode = false;
    document.getElementById('weekViewBtn').classList.add('active');
    document.getElementById('dayViewBtn').classList.remove('active');
  }
  return { source, id: item.id, name: item.name };
}

function finishSmartInputEntries(entries, shouldSchedule) {
  const containsTasks = entries.some(entry => entry.source === 'task');
  if (containsTasks && shouldSchedule) createSchedule();
  else {
    save();
    renderCalendar();
    renderTasks();
  }
  smartInputLastEntries = entries;
  renderSmartInputResults(entries);
}

function renderSmartInputResults(entries) {
  smartInputResults.innerHTML = entries.map((entry, index) =>
    `<div class="smart-input-result"><span>追加しました：${escapeHTML(entry.name)}</span><button type="button" data-smart-edit-index="${index}">内容を手動で微調整</button></div>`
  ).join('');
  smartInputResults.querySelectorAll('[data-smart-edit-index]').forEach(button => button.addEventListener('click', () => {
    const target = smartInputLastEntries[Number(button.dataset.smartEditIndex)];
    if (target) openSmartEntryEditor(target);
  }));
}

function getSmartInputMissingFields(candidate) {
  const missing = [];
  if (!String(candidate.name || '').trim()) missing.push('予定名');
  if (candidate.kind === 'task') {
    if (!candidate.date || candidate.date < dateKey(today)) missing.push('締め切り日');
    if (!Number.isFinite(Number(candidate.hours)) || Number(candidate.hours) <= 0 || Number(candidate.hours) > 200) {
      missing.push('必要な学習時間');
    }
    return missing;
  }

  if (candidate.repeat === 'weekly') {
    if (!Number.isInteger(candidate.weekday) || candidate.weekday < 0 || candidate.weekday > 6) missing.push('曜日');
  } else if (!candidate.date || candidate.date < dateKey(today)) {
    missing.push('予定日');
  }
  if (!candidate.start) missing.push('開始時刻');
  if (!candidate.end) missing.push('終了時刻');
  if (candidate.start && candidate.end) {
    const start = clockMinutes(candidate.start);
    const end = clockMinutes(candidate.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) missing.push('終了時刻（開始より後）');
  }
  return missing;
}

function readSmartInputReviewCandidates() {
  const rows = smartInputReviewList.querySelectorAll('.smart-input-pending');
  if (!rows.length) return smartInputPending;
  return Array.from(rows, (row, index) => {
    const value = field => row.querySelector(`[data-smart-field="${field}"]`).value;
    const weekday = value('weekday');
    const hours = value('hours');
    return {
      ...smartInputPending[index],
      kind: value('kind'),
      name: value('name').trim(),
      date: value('date'),
      weekday: weekday === '' ? null : Number(weekday),
      repeat: value('repeat'),
      start: value('start'),
      end: value('end'),
      type: value('type'),
      hours: hours === '' ? 0 : Number(hours)
    };
  });
}

function updateSmartInputReviewPrompt(candidates = readSmartInputReviewCandidates()) {
  const rows = smartInputReviewList.querySelectorAll('.smart-input-pending');
  const incomplete = candidates.some(candidate => getSmartInputMissingFields(candidate).length);
  rows.forEach((row, index) => {
    const candidate = candidates[index] || {};
    const missing = getSmartInputMissingFields(candidate);
    const requiredEl = row.querySelector('.smart-input-required');
    if (requiredEl) {
      requiredEl.textContent = missing.length
        ? `必要事項：${missing.join('、')}`
        : '内容を確認してください。';
      if (missing.length) requiredEl.classList.add('has-missing');
      else requiredEl.classList.remove('has-missing');
    }

    const isTask = candidate.kind === 'task';
    const repeat = candidate.repeat || 'once';

    const setValidity = (selector, isInvalid) => {
      const el = row.querySelector(selector);
      if (el) {
        if (isInvalid) el.classList.add('is-invalid');
        else el.classList.remove('is-invalid');
      }
    };

    setValidity('[data-smart-field="name"]', !String(candidate.name || '').trim());

    if (isTask || repeat === 'once') {
      const dateInvalid = !candidate.date || candidate.date < dateKey(today);
      setValidity('[data-smart-field="date"]', dateInvalid);
    } else {
      setValidity('[data-smart-field="date"]', false);
    }

    if (!isTask && repeat === 'weekly') {
      const weekdayInvalid = !Number.isInteger(candidate.weekday) || candidate.weekday < 0 || candidate.weekday > 6;
      setValidity('[data-smart-field="weekday"]', weekdayInvalid);
    } else {
      setValidity('[data-smart-field="weekday"]', false);
    }

    if (!isTask) {
      const startMissing = !candidate.start;
      const endMissing = !candidate.end;
      const timeOrderInvalid = candidate.start && candidate.end && clockMinutes(candidate.end) <= clockMinutes(candidate.start);
      setValidity('[data-smart-field="start"]', startMissing || timeOrderInvalid);
      setValidity('[data-smart-field="end"]', endMissing || timeOrderInvalid);
    } else {
      setValidity('[data-smart-field="start"]', false);
      setValidity('[data-smart-field="end"]', false);
    }

    if (isTask) {
      const hoursInvalid = !Number.isFinite(Number(candidate.hours)) || Number(candidate.hours) <= 0 || Number(candidate.hours) > 200;
      setValidity('[data-smart-field="hours"]', hoursInvalid);
    } else {
      setValidity('[data-smart-field="hours"]', false);
    }
  });

  smartInputReviewPrompt.textContent = incomplete
    ? '情報が足りません。必要事項を記入してください。'
    : '以下の内容で予定を追加していいですか？';
}

function renderSmartInputPending() {
  smartInputReviewList.innerHTML = smartInputPending.map((candidate, index) => {
    const isTask = candidate.kind === 'task';
    const repeat = candidate.repeat || 'once';
    const dateLabel = isTask ? '締め切り日' : '予定日';
    const missing = getSmartInputMissingFields(candidate);
    const selectedCategory = isTask
      ? (candidate.original && /テスト|試験/.test(candidate.original) ? 'task_exam' : 'task_report')
      : (candidate.type || 'personal');

    return `<article class="smart-input-pending" data-smart-pending="${index}">
      <div class="smart-input-pending-source">入力：${escapeHTML(candidate.original)}${candidate.reason ? ` · ${escapeHTML(candidate.reason)}` : ''}</div>
      <div class="smart-input-required${missing.length ? ' has-missing' : ''}">${missing.length ? `必要事項：${escapeHTML(missing.join('、'))}` : '内容を確認してください。'}</div>
      <div class="smart-pending-row">
        <label>種類（分野）
          <select data-smart-field="category">
            <option value="class"${selectedCategory === 'class' ? ' selected' : ''}>授業（講義・ゼミ）</option>
            <option value="work"${selectedCategory === 'work' ? ' selected' : ''}>アルバイト</option>
            <option value="club"${selectedCategory === 'club' ? ' selected' : ''}>サークル・部活</option>
            <option value="task_report"${selectedCategory === 'task_report' ? ' selected' : ''}>課題・レポート</option>
            <option value="task_exam"${selectedCategory === 'task_exam' ? ' selected' : ''}>テスト・試験対策</option>
            <option value="personal"${selectedCategory === 'personal' ? ' selected' : ''}>個人予定（プライベート）</option>
          </select>
        </label>
        <label>名前<input data-smart-field="name" maxlength="40" value="${escapeHTML(candidate.name)}"></label>
      </div>
      <label style="display:none"><select data-smart-field="kind"><option value="event"${isTask ? '' : ' selected'}>予定</option><option value="task"${isTask ? ' selected' : ''}>課題・テスト</option></select></label>
      <div class="smart-pending-row">
        <label data-smart-date-field><span data-smart-date-label>${dateLabel}</span><input data-smart-field="date" type="date" min="${dateKey(today)}" value="${escapeHTML(candidate.date || '')}"></label>
        <label data-smart-event-field>繰り返し<select data-smart-field="repeat"><option value="once"${repeat === 'once' ? ' selected' : ''}>1回のみ</option><option value="weekly"${repeat === 'weekly' ? ' selected' : ''}>毎週</option></select></label>
      </div>
      <label data-smart-weekday-field>曜日<select data-smart-field="weekday"><option value=""${candidate.weekday == null ? ' selected' : ''}>曜日を選択</option>${['日','月','火','水','木','金','土'].map((day, weekday) => `<option value="${weekday}"${Number(candidate.weekday) === weekday ? ' selected' : ''}>${day}曜日</option>`).join('')}</select></label>
      <div class="smart-pending-row" data-smart-event-field>
        <label>開始<input data-smart-field="start" type="time" value="${escapeHTML(candidate.start || '')}"></label>
        <label>終了<input data-smart-field="end" type="time" value="${escapeHTML(candidate.end || '')}"></label>
      </div>
      <div class="smart-pending-row" data-smart-event-field style="display:none">
        <label>種類詳細<select data-smart-field="type"><option value="class"${candidate.type === 'class' ? ' selected' : ''}>授業</option><option value="work"${candidate.type === 'work' ? ' selected' : ''}>アルバイト</option><option value="club"${candidate.type === 'club' ? ' selected' : ''}>サークル・部活</option><option value="personal"${candidate.type === 'personal' ? ' selected' : ''}>個人予定</option></select></label>
      </div>
      <label data-smart-task-field>学習時間（時間）<input data-smart-field="hours" type="number" min="0.5" max="200" step="0.5" value="${candidate.hours || ''}"></label>
    </article>`;
  }).join('');

  smartInputReviewList.querySelectorAll('.smart-input-pending').forEach(row => {
    const kind = row.querySelector('[data-smart-field="kind"]');
    const category = row.querySelector('[data-smart-field="category"]');
    const type = row.querySelector('[data-smart-field="type"]');
    const repeat = row.querySelector('[data-smart-field="repeat"]');

    const syncCategory = () => {
      const cat = category.value;
      if (cat === 'task_report' || cat === 'task_exam') {
        kind.value = 'task';
        type.value = 'personal';
      } else {
        kind.value = 'event';
        type.value = cat;
      }
      sync();
    };

    const syncFromKindType = () => {
      if (kind.value === 'task') {
        if (category.value !== 'task_report' && category.value !== 'task_exam') {
          category.value = 'task_report';
        }
      } else {
        category.value = type.value || 'personal';
      }
      sync();
    };

    const sync = () => {
      const isTask = kind.value === 'task';
      row.querySelectorAll('[data-smart-event-field]').forEach(field => { field.hidden = isTask; });
      row.querySelectorAll('[data-smart-task-field]').forEach(field => { field.hidden = !isTask; });
      row.querySelector('[data-smart-date-label]').textContent = isTask ? '締め切り日' : '予定日';
      row.querySelector('[data-smart-weekday-field]').hidden = isTask || repeat.value !== 'weekly';
      row.querySelector('[data-smart-date-field]').hidden = !isTask && repeat.value === 'weekly';
    };

    if (category) category.addEventListener('change', syncCategory);
    kind.addEventListener('change', syncFromKindType);
    if (type) type.addEventListener('change', syncFromKindType);
    repeat.addEventListener('change', sync);
    sync();

    row.querySelectorAll('[data-smart-field]').forEach(field => {
      field.addEventListener('input', () => updateSmartInputReviewPrompt());
      field.addEventListener('change', () => updateSmartInputReviewPrompt());
    });
  });
  updateSmartInputReviewPrompt(smartInputPending);
}

function confirmSmartInputReview(candidates = readSmartInputReviewCandidates()) {
  if (!candidates.length) return false;
  const missing = candidates.some(candidate => getSmartInputMissingFields(candidate).length);
  smartInputPending.splice(0, smartInputPending.length, ...candidates);
  if (missing) {
    renderSmartInputPending();
    return false;
  }

  const entries = candidates.map(candidate => {
    if (candidate.kind === 'event' && candidate.repeat === 'weekly') candidate.date = '';
    return commitSmartInputEntry(candidate);
  });
  smartInputPending.length = 0;
  smartInputReviewActive = false;
  smartInputReview.hidden = true;
  smartInputEntry.hidden = false;
  smartInputText.value = '';
  finishSmartInputEntries(entries, document.getElementById('smartAutoSchedule').checked);
  smartInputStatus.textContent = `${entries.length}件を追加しました。`;
  return entries;
}

function analyzeSmartInput() {
  const candidates = parseSmartInput(smartInputText.value);
  if (!candidates.length) {
    candidates.push({
      original: '',
      kind: 'event',
      name: '',
      date: '',
      weekday: null,
      repeat: 'once',
      type: 'personal',
      start: '',
      end: '',
      hours: 0,
      reason: '予定の内容を入力してください'
    });
  }
  smartInputPending.splice(0, smartInputPending.length, ...candidates);
  smartInputReviewActive = true;
  smartInputEntry.hidden = true;
  smartInputReview.hidden = false;
  renderSmartInputPending();
}

document.getElementById('analyzeSmartInput').addEventListener('click', analyzeSmartInput);
document.getElementById('confirmSmartInput').addEventListener('click', () => confirmSmartInputReview());
document.getElementById('editSmartInput').addEventListener('click', () => {
  smartInputReviewActive = false;
  smartInputReview.hidden = true;
  smartInputEntry.hidden = false;
  smartInputText.focus();
});
const smartInputTemplates = {
  shift: () => `明日 18:00-22:00 バイト`,
  class: () => `毎週月曜 09:00-10:30 授業`,
  club: () => `毎週金曜 17:00-19:00 サークル`,
  task: () => {
    const date = addDays(today, 7);
    return `${date.getMonth() + 1}/${date.getDate()}までに 課題 60分`;
  }
};
document.querySelectorAll('[data-smart-template]').forEach(button => button.addEventListener('click', () => {
  const template = smartInputTemplates[button.dataset.smartTemplate]();
  smartInputText.value = `${smartInputText.value.trim()}${smartInputText.value.trim() ? '\n' : ''}${template}`;
  smartInputText.focus();
}));

function openSmartEntryEditor(target) {
  smartInputEditTarget = target;
  setSmartInputMode('manual');
  const item = target.source === 'task'
    ? data.tasks.find(task => task.id === target.id)
    : data[target.source].find(entry => entry.id === target.id);
  if (!item) return;
  document.getElementById('eventName').value = item.name;
  document.getElementById('eventType').value = target.source === 'task' ? 'task' : item.type;
  if (target.source === 'task') {
    const plan = data.plans.find(entry => entry.id === item.planId);
    document.getElementById('eventDue').value = item.due;
    document.getElementById('eventDuration').value = item.hours;
    document.getElementById('studyType').value = plan?.kind || 'report';
    document.getElementById('studyWorkload').value = plan?.workloadKnown === false
      ? plan.kind === 'report' ? 3000 : 50
      : plan?.workload || 50;
    document.getElementById('studyDifficulty').value = plan?.difficulty || 3;
    document.getElementById('courseCredits').value = plan?.credits || 1;
    document.getElementById('studyProgress').value = 0;
    document.getElementById('studyScope').value = plan?.scope || '';
    document.getElementById('studyAutoSchedule').checked = true;
    document.getElementById('modalTitle').textContent = '課題・テストを編集';
    document.getElementById('dueField').hidden = false;
    document.getElementById('durationField').hidden = false;
    syncStudyFields();
  } else {
    const isWeekly = target.source === 'fixed';
    repeatSelect.value = isWeekly ? 'weekly' : 'once';
    document.getElementById('eventDay').value = String(item.day);
    document.getElementById('oneOffDate').value = isWeekly ? '' : item.day;
    document.getElementById('eventStart').value = item.start;
    document.getElementById('eventEnd').value = item.end;
    document.getElementById('modalTitle').textContent = '予定を編集';
    syncEventScheduleFields();
  }
}

function handleSmartManualEdit(event) {
  if (!smartInputEditTarget) return false;
  const target = smartInputEditTarget;
  const form = new FormData(event.currentTarget);
  const name = String(form.get('name') || '').trim();
  const chosenType = String(form.get('type') || '');
  if (!name) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast('名前を入力してください');
    return true;
  }
  if (target.source === 'task') {
    const task = data.tasks.find(item => item.id === target.id);
    const plan = task && data.plans.find(item => item.id === task.planId);
    const due = String(form.get('due') || '');
    const hours = Number(form.get('duration'));
    const workload = Number(form.get('studyWorkload'));
    const difficulty = Number(form.get('studyDifficulty'));
    const credits = Number(form.get('courseCredits'));
    if (!task || !plan || eventTypeSelect.value !== 'task' || !due || due < dateKey(today)
        || !Number.isFinite(hours) || hours <= 0 || hours > 200
        || !Number.isFinite(workload) || workload < 1
        || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5
        || !Number.isFinite(credits) || credits <= 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('課題名、締め切り、学習時間を確認してください');
      return true;
    }
    const completedHours = Math.max(0, task.hours - task.remaining);
    task.name = name;
    task.due = due;
    task.hours = hours;
    task.remaining = Math.max(0, hours - completedHours);
    task.done = task.remaining === 0;
    plan.name = name;
    plan.due = due;
    plan.estimatedHours = hours;
    plan.kind = String(form.get('studyType') || plan.kind);
    plan.workload = workload;
    plan.workloadKnown = true;
    plan.credits = credits;
    plan.difficulty = difficulty;
    plan.scope = String(form.get('studyScope') || '');
    if (document.getElementById('studyAutoSchedule').checked) createSchedule({ reroute: true });
    else {
      data.sessions = data.sessions.filter(session => session.taskId !== task.id || !session.aiGenerated);
      save();
      renderCalendar();
      renderTasks();
    }
  } else {
    const repeat = String(form.get('repeat') || 'weekly');
    if (eventTypeSelect.value === 'task') {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('この画面では予定から課題への変更はできません');
      return true;
    }
    const start = String(form.get('start') || '');
    const end = String(form.get('end') || '');
    const day = repeat === 'once' ? String(form.get('oneOffDate') || '') : Number(form.get('day'));
    if (!start || !end || clockMinutes(end) <= clockMinutes(start)
        || (repeat === 'once' && (!day || day < dateKey(today)))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('予定日と開始・終了時刻を確認してください');
      return true;
    }
    const item = {
      id: target.id,
      name,
      type: chosenType,
      start,
      end,
      day
    };
    data[target.source] = data[target.source].filter(entry => entry.id !== target.id);
    const source = repeat === 'once' ? 'extras' : 'fixed';
    data[source].push(item);
    if (source === 'extras') {
      weekStart = startOfWeek(new Date(`${day}T00:00:00`));
      dayMode = false;
      document.getElementById('weekViewBtn').classList.add('active');
      document.getElementById('dayViewBtn').classList.remove('active');
    }
    save();
    renderCalendar();
    renderTasks();
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  smartInputEditTarget = null;
  smartInputForm.reset();
  closeModal();
  eventTypeSelect.value = 'class';
  repeatSelect.value = 'weekly';
  syncEventScheduleFields();
  syncStudyFields();
  showToast('内容を更新しました');
  return true;
}

document.getElementById('closeModal').addEventListener('click', () => { smartInputEditTarget = null; });
document.getElementById('cancelModal').addEventListener('click', () => { smartInputEditTarget = null; });
function resetSmartInputReview() {
  smartInputPending.length = 0;
  smartInputReviewActive = false;
  smartInputEntry.hidden = false;
  smartInputReview.hidden = true;
  smartInputText.value = '';
  smartInputStatus.textContent = '';
  smartInputResults.innerHTML = '';
}

const openModalWithSmartInput = openModal;
openModal = (...args) => {
  resetSmartInputReview();
  setSmartInputMode('ai');
  openModalWithSmartInput(...args);
};
