const smartInputForm = document.getElementById('eventForm');
const smartInputPending = [];
let smartInputEditTarget = null;
let smartInputLastEntries = [];

smartInputForm.querySelector('.modal-head').insertAdjacentHTML('afterend', `
  <div class="entry-mode-tabs" role="tablist" aria-label="予定の入力方法">
    <button class="entry-mode-tab" type="button" id="smartInputTab" role="tab" aria-selected="true">🦉 AIにおまかせ入力</button>
    <button class="entry-mode-tab" type="button" id="manualInputTab" role="tab" aria-selected="false">✏️ 自分で細かく設定</button>
  </div>
  <section class="smart-input-panel" id="smartInputPanel" aria-labelledby="smartInputTitle">
    <div class="smart-input-entry" id="smartInputEntry">
      <h3 id="smartInputTitle">文章から予定を作成</h3>
      <p>予定や締め切りを1行ずつ入力してください。解析はこのブラウザー内で行います。</p>
      <textarea id="smartInputText" rows="4" placeholder="例：明日 18:00-22:00 バイト&#10;11/25までに英語レポート（重め）"></textarea>
      <div class="smart-image-row">
        <button class="secondary-btn smart-image-btn" type="button" id="smartImageBtn">📷 画像を添付</button>
        <input id="smartImageFile" type="file" accept="image/*" hidden aria-label="読み取る画像を選択">
        <div class="smart-image-preview-wrap" id="smartImagePreviewWrap" hidden>
          <div class="smart-image-preview-head">
            <span class="smart-image-name" id="smartImageName"></span>
            <span class="smart-crop-hint" id="smartCropHint">ドラッグで範囲指定（未指定なら全体）</span>
            <button class="smart-crop-reset" type="button" id="smartCropReset" hidden>選択解除</button>
            <button class="smart-image-remove" type="button" id="smartImageRemove" aria-label="添付画像を削除">×</button>
          </div>
          <div class="smart-image-crop-stage" id="smartImageCropStage">
            <img class="smart-image-preview" id="smartImagePreview" alt="添付画像のプレビュー" draggable="false">
            <div class="smart-crop-rect" id="smartCropRect" hidden></div>
          </div>
        </div>
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
      <details class="smart-ocr-debug" id="smartOcrDebug" hidden>
        <summary>画像から読み取ったテキスト</summary>
        <pre id="smartOcrDebugText"></pre>
      </details>
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
.smart-image-row { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 8px 0 4px; }
.smart-image-btn { height: 32px; padding: 0 11px; font-size: 11px; }
.smart-image-preview-wrap { width: 100%; padding: 8px; border: 1px solid #dfe4da; border-radius: 8px; background: #f8faf6; display: grid; gap: 7px; }
.smart-image-preview-wrap[hidden] { display: none !important; }
.smart-image-preview-head { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.smart-image-name { font-size: 10px; font-weight: 700; color: #526647; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.smart-crop-hint { font-size: 9px; color: #798577; margin-right: auto; }
.smart-crop-reset { border: 1px solid #d5ded0; border-radius: 5px; background: #fff; color: #526647; font-size: 9px; padding: 2px 6px; }
.smart-crop-reset[hidden] { display: none; }
.smart-image-remove { width: 20px; height: 20px; border: 0; border-radius: 50%; background: #d9584d; color: #fff; font-size: 12px; line-height: 1; display: grid; place-items: center; padding: 0; flex: 0 0 auto; }
.smart-image-crop-stage { position: relative; display: inline-block; max-width: 100%; margin: 0 auto; cursor: crosshair; touch-action: none; user-select: none; }
.smart-image-preview { display: block; max-width: 100%; max-height: 220px; border-radius: 5px; user-select: none; -webkit-user-drag: none; }
.smart-crop-rect { position: absolute; border: 2px solid var(--coral, #f56f61); background: rgba(245, 111, 97, 0.16); pointer-events: none; box-sizing: border-box; }
.smart-crop-rect[hidden] { display: none; }
.smart-title-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.smart-title-chip { border: 1px solid #d8e2d2; border-radius: 999px; background: #f3f7ef; color: #405b36; font-size: 9px; font-weight: 700; padding: 3px 8px; }
.smart-title-chip:hover { border-color: var(--coral, #f56f61); background: #fff0ed; color: #c94e42; }
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
.smart-ocr-debug { margin: 8px 0 4px; padding: 6px 8px; border: 1px dashed #d6ddd1; border-radius: 6px; background: #f8faf6; font-size: 10px; color: #687268; }
.smart-ocr-debug[hidden] { display: none !important; }
.smart-ocr-debug summary { cursor: pointer; font-weight: 700; }
.smart-ocr-debug pre { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 10px; color: #525d52; max-height: 120px; overflow-y: auto; }
.smart-input-submit, .smart-input-review-actions button, .modal-actions button, .primary-btn { justify-content: center; text-align: center; }
.modal:not(.ai-entry-mode) .smart-input-panel { display: none; }
input[type="date"], input[type="time"] {
  cursor: pointer;
  padding-right: 26px;
  background-color: #fff;
  background-repeat: no-repeat;
  background-position: right 7px center;
  background-size: 14px 14px;
}
input[type="date"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23697586' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
}
input[type="time"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23697586' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpolyline points='12 7 12 12 15 14'/%3E%3C/svg%3E");
}
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator { display: none; }
.sc-picker-popover {
  position: fixed;
  z-index: 40;
  width: 262px;
  max-width: calc(100vw - 16px);
  background: var(--white, #fff);
  border: 1px solid #d8e3ef;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(31, 46, 66, 0.22);
  padding: 12px;
  color: var(--ink, #29333f);
}
.sc-picker-popover[hidden] { display: none !important; }
.sc-picker-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.sc-picker-title { font-size: 13px; font-weight: 800; color: var(--ink, #29333f); }
.sc-cal-nav { width: 28px; height: 28px; border: 1px solid #e0e7f0; border-radius: 7px; background: #f8fbff; font-size: 15px; display: grid; place-items: center; }
.sc-cal-nav:hover { background: #eaf3ff; }
.sc-cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 10px; font-weight: 700; color: #798594; margin-bottom: 4px; }
.sc-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.sc-cal-day { height: 31px; border: 0; border-radius: 7px; background: transparent; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
.sc-cal-day:hover:not(:disabled) { background: #eaf3ff; }
.sc-cal-day.is-today:not(.is-selected) { color: #d9584d; background: #fff0ed; font-weight: 800; }
.sc-cal-day.is-selected { background: var(--coral, #f56f61); color: #fff; font-weight: 800; }
.sc-cal-day:disabled { color: #c4ccd6; cursor: not-allowed; }
.sc-time-preview { margin-left: auto; font-size: 14px; font-weight: 800; color: var(--coral, #f56f61); font-variant-numeric: tabular-nums; }
.sc-step-toggle { border: 1px solid #dce5ef; border-radius: 999px; background: #f6f9fd; color: #526275; font-size: 10px; font-weight: 700; padding: 3px 8px; }
.sc-step-toggle.is-active { border-color: var(--coral, #f56f61); background: #fff0ed; color: #c94e42; }
.sc-time-wheels { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 180px; border: 1px solid #e6edf5; border-radius: 10px; background: #fbfdff; overflow: hidden; }
.sc-wheel-highlight { position: absolute; left: 8px; right: 8px; top: 72px; height: 36px; border-radius: 8px; background: rgba(245, 111, 97, 0.12); border: 1px solid rgba(245, 111, 97, 0.35); pointer-events: none; z-index: 1; }
.sc-wheel-colon { position: relative; z-index: 2; font-size: 16px; font-weight: 800; color: var(--ink, #29333f); padding: 0 2px; }
.sc-wheel { position: relative; z-index: 2; height: 180px; overflow-y: auto; scroll-snap-type: y mandatory; overscroll-behavior: contain; scrollbar-width: thin; }
.sc-wheel::-webkit-scrollbar { width: 4px; }
.sc-wheel::-webkit-scrollbar-thumb { background: #cfd8e3; border-radius: 999px; }
.sc-wheel-pad { height: 72px; }
.sc-wheel-item { width: 100%; height: 36px; border: 0; background: transparent; scroll-snap-align: center; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: #7c8796; font-variant-numeric: tabular-nums; }
.sc-wheel-item:hover { color: var(--ink, #29333f); }
.sc-wheel-item.is-active { color: var(--ink, #29333f); font-size: 16px; font-weight: 800; }
.sc-picker-foot { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
.sc-picker-btn { height: 32px; padding: 0 12px; font-size: 11px; justify-content: center; }
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
let smartInputImage = null;
let smartOcrTitleSuggestions = [];
const smartImageBtn = document.getElementById('smartImageBtn');
const smartImageFile = document.getElementById('smartImageFile');
const smartImagePreviewWrap = document.getElementById('smartImagePreviewWrap');
const smartImagePreview = document.getElementById('smartImagePreview');
const smartImageName = document.getElementById('smartImageName');
const smartImageRemove = document.getElementById('smartImageRemove');
const smartImageCropStage = document.getElementById('smartImageCropStage');
const smartCropRect = document.getElementById('smartCropRect');
const smartCropReset = document.getElementById('smartCropReset');
const smartCropHint = document.getElementById('smartCropHint');

function updateSmartCropRectUi(crop) {
  if (!smartCropRect || !smartCropReset || !smartCropHint) return;
  if (!crop) {
    smartCropRect.hidden = true;
    smartCropReset.hidden = true;
    smartCropHint.textContent = 'ドラッグで範囲指定（未指定なら全体）';
    return;
  }
  smartCropRect.hidden = false;
  smartCropRect.style.left = `${(crop.x * 100).toFixed(2)}%`;
  smartCropRect.style.top = `${(crop.y * 100).toFixed(2)}%`;
  smartCropRect.style.width = `${(crop.w * 100).toFixed(2)}%`;
  smartCropRect.style.height = `${(crop.h * 100).toFixed(2)}%`;
  smartCropReset.hidden = false;
  smartCropHint.textContent = '選択範囲を読み取ります';
}

function clearSmartImageCrop() {
  if (smartInputImage) smartInputImage.crop = null;
  updateSmartCropRectUi(null);
}

function clearSmartInputImage() {
  smartInputImage = null;
  smartImageFile.value = '';
  smartImagePreview.src = '';
  smartImageName.textContent = '';
  smartImagePreviewWrap.hidden = true;
  updateSmartCropRectUi(null);
}

if (smartCropReset) smartCropReset.addEventListener('click', clearSmartImageCrop);

if (smartImageCropStage && typeof smartImageCropStage.addEventListener === 'function') {
  let dragStart = null;
  const getRelPoint = clientX_Y => {
    const rect = typeof smartImagePreview.getBoundingClientRect === 'function'
      ? smartImagePreview.getBoundingClientRect()
      : null;
    if (!rect || !rect.width || !rect.height) return null;
    const x = Math.min(1, Math.max(0, (clientX_Y.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientX_Y.clientY - rect.top) / rect.height));
    return { x, y };
  };
  const onMove = event => {
    if (!dragStart) return;
    const pt = getRelPoint(event);
    if (!pt) return;
    const crop = {
      x: Math.min(dragStart.x, pt.x),
      y: Math.min(dragStart.y, pt.y),
      w: Math.abs(pt.x - dragStart.x),
      h: Math.abs(pt.y - dragStart.y)
    };
    if (smartInputImage) smartInputImage.crop = crop;
    updateSmartCropRectUi(crop);
  };
  const onUp = () => {
    if (!dragStart) return;
    dragStart = null;
    if (smartInputImage && smartInputImage.crop && (smartInputImage.crop.w < 0.02 || smartInputImage.crop.h < 0.02)) {
      clearSmartImageCrop();
    }
  };
  smartImageCropStage.addEventListener('mousedown', event => {
    if (!smartInputImage) return;
    const pt = getRelPoint(event);
    if (!pt) return;
    event.preventDefault();
    dragStart = pt;
    smartInputImage.crop = { x: pt.x, y: pt.y, w: 0, h: 0 };
    updateSmartCropRectUi(smartInputImage.crop);
  });
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
}

smartImageBtn.addEventListener('click', () => {
  if (typeof smartImageFile.click === 'function') smartImageFile.click();
});
smartImageRemove.addEventListener('click', clearSmartInputImage);
smartImageFile.addEventListener('change', () => {
  const file = smartImageFile.files && smartImageFile.files[0];
  if (!file) return;
  if (typeof FileReader !== 'function') {
    smartInputImage = { file, dataUrl: '', name: file.name || 'image', crop: null };
    smartImageName.textContent = smartInputImage.name;
    smartImagePreviewWrap.hidden = false;
    updateSmartCropRectUi(null);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    smartInputImage = { file, dataUrl: String(reader.result || ''), name: file.name || 'image', crop: null };
    smartImagePreview.src = smartInputImage.dataUrl;
    smartImageName.textContent = smartInputImage.name;
    smartImagePreviewWrap.hidden = false;
    updateSmartCropRectUi(null);
  };
  reader.readAsDataURL(file);
});

document.getElementById('eventDuration').min = '0';
document.getElementById('smartAutoSchedule').checked = true;

function setSmartInputMode(mode) {
  const isAi = mode === 'ai';
  if (isAi) smartInputForm.classList.add('ai-entry-mode');
  else smartInputForm.classList.remove('ai-entry-mode');
  smartInputTab.setAttribute('aria-selected', String(isAi));
  manualInputTab.setAttribute('aria-selected', String(!isAi));
  if (isAi && !smartInputEditTarget) {
    document.getElementById('modalTitle').textContent = '予定を追加';
  }
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
  5: { start: '16:30', end: '18:00' },
  6: { start: '18:10', end: '19:40' }
};

function getNearestDateForWeekday(weekday) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return '';
  const diff = (weekday - today.getDay() + 7) % 7;
  return dateKey(addDays(today, diff));
}

function getSmartInputWeekday(source, { allowToday = false } = {}) {
  if (/今日|きょう|明日|あした|明後日|あさって|\d{1,2}\s*日後/.test(source)) return null;
  const match = source.match(/(?:毎週|来週|今週|次の)\s*(日|月|火|水|木|金|土)(?:曜(?:日)?)?|(日|月|火|水|木|金|土)曜(?:日)?|(?:^|\s)(日|月|火|水|木|金|土)(?=\s|$|[1-6]\s*限)/);
  if (!match) return null;
  const weekdayChar = match[1] || match[2] || match[3];
  if (!weekdayChar) return null;
  const weekday = ['日', '月', '火', '水', '木', '金', '土'].indexOf(weekdayChar);
  const rawDiff = (weekday - today.getDay() + 7) % 7;
  const difference = allowToday ? rawDiff : (rawDiff || 7);
  return { weekday, date: dateKey(addDays(today, difference + (/^来週/.test(match[0]) ? 7 : 0))) };
}

function getSmartInputDate(source, { allowToday = false } = {}) {
  const normalized = normalizeSmartInput(source);
  if (/明後日|あさって/.test(normalized)) return dateKey(addDays(today, 2));
  if (/明日|あした/.test(normalized)) return dateKey(addDays(today, 1));
  if (/今日|きょう/.test(normalized)) return dateKey(today);
  const daysAfter = normalized.match(/(\d{1,2})\s*日後/);
  if (daysAfter) return dateKey(addDays(today, Number(daysAfter[1])));

  const dateSource = normalized.replace(/\d{1,2}:\d{2}(?:\s*[-〜～–—]\s*\d{1,2}:\d{2})?/g, ' ');
  const fullDate = dateSource.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (fullDate) {
    const date = new Date(Number(fullDate[1]), Number(fullDate[2]) - 1, Number(fullDate[3]));
    return date.getFullYear() === Number(fullDate[1]) && date.getMonth() === Number(fullDate[2]) - 1
      && date.getDate() === Number(fullDate[3]) ? dateKey(date) : null;
  }
  const monthDate = dateSource.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/)
    || dateSource.match(/(?<![:\d])(\d{1,2})\s*\/\s*(\d{1,2})(?![:\d])/);
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
  const dayOnly = dateSource.match(/(\d{1,2})\s*日/);
  if (dayOnly) {
    let date = new Date(today.getFullYear(), today.getMonth(), Number(dayOnly[1]));
    if (date.getDate() !== Number(dayOnly[1])) return null;
    if (dateKey(date) < dateKey(today)) date = new Date(today.getFullYear(), today.getMonth() + 1, Number(dayOnly[1]));
    return dateKey(date);
  }
  const weekday = getSmartInputWeekday(normalized, { allowToday });
  return weekday?.date || null;
}

function parseSmartInputTime(source, { isTask = false } = {}) {
  const normalized = normalizeSmartInput(source);
  const periodMatch = normalized.match(/([1-6])\s*限(?:目)?/);
  if (periodMatch) {
    const period = Number(periodMatch[1]);
    if (SMART_PERIOD_TIMES[period]) return { ...SMART_PERIOD_TIMES[period] };
  }

  const withHalf = normalized
    .replace(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/g, ' ')
    .replace(/\d{1,2}\s*月\s*\d{1,2}\s*日?/g, ' ')
    .replace(/\d{1,2}\s*\/\s*\d{1,2}/g, ' ')
    .replace(/\d{1,2}\s*日/g, ' ')
    .replace(/(\d{1,2})時半/g, '$1:30')
    .replace(/(\d{1,2})時(\d{1,2})分/g, '$1:$2')
    .replace(/(\d{1,2})時(?!間)/g, '$1:00');

  const durationMatch = withHalf.match(/(\d{1,2}):(\d{2})\s*(?:から|より|〜|~|-|\s)*(\d+(?:\.\d+)?)\s*(時間半|時間|分|h|m)(?:\s*(\d{1,2})\s*分)?/);
  if (durationMatch) {
    const startHour = Number(durationMatch[1]);
    const startMinute = Number(durationMatch[2]);
    let durationMins = Number(durationMatch[3]) * (/分|m/.test(durationMatch[4]) ? 1 : 60);
    if (durationMatch[4] === '時間半') durationMins += 30;
    if (durationMatch[5]) durationMins += Number(durationMatch[5]);
    if (startHour <= 23 && startMinute <= 59 && durationMins > 0) {
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = startMinutes + durationMins;
      if (endMinutes <= 24 * 60) {
        const start = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
        const clampedEnd = Math.min(23 * 60 + 59, endMinutes);
        const endHourCalc = Math.floor(clampedEnd / 60);
        const endMinCalc = Math.round(clampedEnd % 60);
        const end = `${String(endHourCalc).padStart(2, '0')}:${String(endMinCalc).padStart(2, '0')}`;
        return { start, end };
      }
    }
  }

  const rangeMatch = withHalf.match(/(\d{1,2})(?::(\d{2}))?\s*(?:[-〜～–—]|から)\s*(\d{1,2})(?::(\d{2}))?(?!\s*(?:時間|分|h|m|日|月|年))(?:まで)?/);
  if (rangeMatch) {
    const startHour = Number(rangeMatch[1]);
    const startMinute = Number(rangeMatch[2] || 0);
    const endHour = Number(rangeMatch[3]);
    const endMinute = Number(rangeMatch[4] || 0);
    if (startHour <= 23 && endHour <= 23 && startMinute <= 59 && endMinute <= 59) {
      const start = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
      const end = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      if (clockMinutes(end) > clockMinutes(start)) return { start, end };
    }
  }

  const startOnlyMatch = withHalf.match(/(\d{1,2})(?::(\d{2}))?\s*(?:から|より|〜|~|-|スタート|開始)/);
  if (startOnlyMatch) {
    const hour = Number(startOnlyMatch[1]);
    const minute = Number(startOnlyMatch[2] || 0);
    if (hour <= 23 && minute <= 59) {
      return { start: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, end: '' };
    }
  }

  const endOnlyMatch = withHalf.match(/(?:〜|~|-)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:まで|終了)/);
  if (endOnlyMatch) {
    const hour = Number(endOnlyMatch[1]);
    const minute = Number(endOnlyMatch[2] || 0);
    if (hour <= 23 && minute <= 59) {
      return { start: '', end: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
    }
  }

  const plainTimeMatch = withHalf.match(/(?:^|\s|[（(])(\d{1,2}):(\d{2})(?=$|\s|[）)])/);
  if (plainTimeMatch) {
    const hour = Number(plainTimeMatch[1]);
    const minute = Number(plainTimeMatch[2]);
    if (hour <= 23 && minute <= 59) {
      const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return isTask ? { start: '', end: formatted } : { start: formatted, end: '' };
    }
  }

  return null;
}

function extractSmartEventName(source, isTask, detectedType) {
  const normalized = normalizeSmartInput(source);
  let cleaned = normalized
    .replace(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*日?|\d{1,2}\s*[/.]\s*\d{1,2}|\d{1,2}\s*日/g, ' ')
    .replace(/明後日|あさって|明日|あした|今日|きょう|来週|毎週|今週|次の/g, ' ')
    .replace(/(?:日|月|火|水|木|金|土)曜(?:日)?|(?:^|\s)(?:日|月|火|水|木|金|土)(?=\s|$)/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:時間半|時間|分|h|m)(?:\s*\d{1,2}\s*分)?/g, ' ')
    .replace(/\d{1,2}(?::\d{2}|時(?!間)(?:(?:\d{1,2})分?|半)?)\s*[-〜～–—]\s*\d{1,2}(?::\d{2}|時(?!間)(?:(?:\d{1,2})分?|半)?)/g, ' ')
    .replace(/\d{1,2}(?::\d{2}|時(?!間)(?:(?:\d{1,2})分?|半)?)(?:から|より|〜|~|-|まで)?/g, ' ')
    .replace(/[1-6]\s*限(?:目)?/g, ' ')
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
  const isTask = /課題|レポート|テスト|試験|宿題|提出|締切|〆切|期限|までに/.test(line);
  const date = getSmartInputDate(line, { allowToday: isTask });
  const weekday = getSmartInputWeekday(line, { allowToday: isTask });
  const time = parseSmartInputTime(line, { isTask });
  const hasExplicitDate = /(今日|きょう|明日|あした|明後日|あさって|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s*月\s*\d{1,2}|\d{1,2}\s*\/\s*\d{1,2}|\d{1,2}\s*日(?:後)?|来週|今週|次の)/.test(line);
  const isWeeklyKeyword = /(?:時間割|毎週|固定|学期)/.test(line);
  const isWeekly = !isTask && (isWeeklyKeyword || Boolean(weekday && !hasExplicitDate));

  let detectedType = 'personal';
  if (/バイト|アルバイト|シフト|塾講師|カフェ|居酒屋|コンビニ/.test(line)) {
    detectedType = 'work';
  } else if (/授業|講義|ゼミ|演習|実験|[1-6]限|時間割|学期/.test(line)) {
    detectedType = 'class';
  } else if (/サークル|部活|部活動|練習|ミーティング|合宿|バンド/.test(line)) {
    detectedType = 'club';
  } else {
    detectedType = 'personal';
  }

  const resolvedWeekday = weekday?.weekday ?? (date ? new Date(`${date}T00:00:00`).getDay() : null);
  const resolvedDate = date || (isWeekly && Number.isInteger(resolvedWeekday) ? getNearestDateForWeekday(resolvedWeekday) : null);

  const name = extractSmartEventName(line, isTask, detectedType);
  const effort = line.match(/(\d+(?:\.\d+)?)\s*(時間|分|h|m)/);
  const estimatedHours = effort
    ? Number(effort[1]) * (/分|m/.test(effort[2]) ? 1 / 60 : 1)
    : /重め/.test(line) ? 3 : /軽め/.test(line) ? 0.5 : /普通/.test(line) ? 1 : 0;
  const candidate = {
    original: line,
    kind: isTask ? 'task' : 'event',
    name,
    date: resolvedDate,
    weekday: resolvedWeekday,
    repeat: isWeekly ? 'weekly' : 'once',
    type: detectedType,
    start: time?.start || '',
    end: time?.end || '',
    hours: estimatedHours,
    reason: ''
  };
  if (!candidate.name) candidate.reason = '名前を確認してください';
  else if (!date) candidate.reason = isWeekly && weekday ? '' : '日付または曜日を確認してください';
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
    const hours = Number(candidate.hours) > 0 ? Number(candidate.hours) : 0;
    const plan = {
      id: planId,
      name: candidate.name,
      kind,
      due: candidate.date,
      credits: 1,
      estimatedHours: hours,
      workload: 1,
      difficulty: /重め/.test(candidate.original) ? 5 : 3,
      scope: kind === 'exam' ? candidate.name : '',
      workloadKnown: false,
      legacyTaskId: id
    };
    data.plans.push(plan);
    data.tasks.push({
      id,
      planId,
      name: candidate.name,
      due: candidate.date,
      hours,
      remaining: hours,
      done: false
    });
    if (hours === 0) {
      let end = candidate.end || '';
      let start = candidate.start || '';
      if (!start && !end) {
        start = '09:00';
        end = '10:00';
      } else if (!start && end) {
        const endMins = clockMinutes(end);
        const startMins = Math.max(0, endMins - 60);
        start = `${String(Math.floor(startMins / 60)).padStart(2, '0')}:${String(startMins % 60).padStart(2, '0')}`;
        if (endMins === 0) end = '01:00';
      } else if (start && !end) {
        const startMins = clockMinutes(start);
        const endMins = Math.min(23 * 60 + 59, startMins + 60);
        end = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
      }
      data.sessions.push({
        id: makeSmartEntryId('session'),
        taskId: id,
        name: `${candidate.name}（締切）`,
        day: candidate.date,
        start,
        end,
        type: 'study',
        done: false,
        allocatedHours: 0
      });
    }
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

    if (isTask && candidate.hours !== '' && candidate.hours !== 0 && candidate.hours != null) {
      const hoursInvalid = !Number.isFinite(Number(candidate.hours)) || Number(candidate.hours) < 0 || Number(candidate.hours) > 200;
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
        <label>名前<input data-smart-field="name" maxlength="40" value="${escapeHTML(candidate.name)}">${smartOcrTitleSuggestions.length ? `<div class="smart-title-chips" aria-label="タイトル候補">${smartOcrTitleSuggestions.map(title => `<button type="button" class="smart-title-chip" data-smart-title-chip="${escapeHTML(title)}">${escapeHTML(title)}</button>`).join('')}</div>` : ''}</label>
      </div>
      <label style="display:none"><select data-smart-field="kind"><option value="event"${isTask ? '' : ' selected'}>予定</option><option value="task"${isTask ? ' selected' : ''}>課題・テスト</option></select></label>
      <div class="smart-pending-row">
        <label data-smart-date-field><span data-smart-date-label>${dateLabel}</span><input data-smart-field="date" type="date" min="${dateKey(today)}" value="${escapeHTML(candidate.date || '')}"></label>
        <label data-smart-event-field>繰り返し<select data-smart-field="repeat"><option value="once"${repeat === 'once' ? ' selected' : ''}>1回のみ</option><option value="weekly"${repeat === 'weekly' ? ' selected' : ''}>毎週</option></select></label>
      </div>
      <label data-smart-weekday-field>曜日<select data-smart-field="weekday"><option value=""${candidate.weekday == null ? ' selected' : ''}>曜日を選択</option>${['日','月','火','水','木','金','土'].map((day, weekday) => `<option value="${weekday}"${Number(candidate.weekday) === weekday ? ' selected' : ''}>${day}曜日</option>`).join('')}</select></label>
      <div class="smart-pending-row">
        <label>開始<input data-smart-field="start" type="time" value="${escapeHTML(candidate.start || '')}"></label>
        <label>終了<input data-smart-field="end" type="time" value="${escapeHTML(candidate.end || '')}"></label>
      </div>
      <div class="smart-pending-row" data-smart-event-field style="display:none">
        <label>種類詳細<select data-smart-field="type"><option value="class"${candidate.type === 'class' ? ' selected' : ''}>授業</option><option value="work"${candidate.type === 'work' ? ' selected' : ''}>アルバイト</option><option value="club"${candidate.type === 'club' ? ' selected' : ''}>サークル・部活</option><option value="personal"${candidate.type === 'personal' ? ' selected' : ''}>個人予定</option></select></label>
      </div>
      <label data-smart-task-field>学習時間（時間）<input data-smart-field="hours" type="number" min="0" max="200" step="0.5" value="${candidate.hours || ''}"></label>
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
      if (!isTask && repeat.value === 'weekly') {
        const weekdaySelect = row.querySelector('[data-smart-field="weekday"]');
        const dateInput = row.querySelector('[data-smart-field="date"]');
        if (weekdaySelect && dateInput && weekdaySelect.value !== '' && !dateInput.value) {
          dateInput.value = getNearestDateForWeekday(Number(weekdaySelect.value));
        }
      }
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
    row.querySelectorAll('[data-smart-title-chip]').forEach(chip => {
      chip.addEventListener('click', () => {
        const nameInput = row.querySelector('[data-smart-field="name"]');
        if (nameInput) {
          nameInput.value = chip.dataset.smartTitleChip || '';
          updateSmartInputReviewPrompt();
        }
      });
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
  clearSmartInputImage();
  finishSmartInputEntries(entries, document.getElementById('smartAutoSchedule').checked);
  smartInputStatus.textContent = `${entries.length}件を追加しました。`;
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast(`${entries.length}件の予定を追加しました`);
  return entries;
}

function stageSmartInputCandidates(sourceTextOrCandidates) {
  const candidates = Array.isArray(sourceTextOrCandidates)
    ? sourceTextOrCandidates
    : parseSmartInput(sourceTextOrCandidates);
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

function isMaskedOrNoiseLine(line) {
  const normalized = normalizeSmartInput(line);
  if (!normalized) return true;
  if (/x{2,}|X{2,}|〇{2,}|○{2,}|※{2,}/.test(normalized)) return true;
  if (/^[※＊*]/.test(normalized)) return true;
  if (/^[（(][^）)]*(?:※|別課題|補足|注意|例)[^）)]*[）)]$/.test(normalized)) return true;
  if (/^(?:時間割|スケジュール|予定表|前期|後期|\d{4}年度?)$/.test(normalized)) return true;
  if (/^(?:(?:日|月|火|水|木|金|土)(?:曜(?:日)?)?[\s,/・]*){2,}$/.test(normalized)) return true;
  if (/^[0-9\s.:/-]+$/.test(normalized) && !/\d{1,2}:\d{2}/.test(normalized)) return true;
  if (!/[ぁ-んァ-ヶ一-龠a-zA-Z0-9]/.test(normalized)) return true;
  return false;
}

function hasValidDateTimeAnchor(line) {
  if (isMaskedOrNoiseLine(line)) return false;
  const normalized = normalizeSmartInput(line);
  if (getSmartInputDate(normalized, { allowToday: true })) return true;
  if (getSmartInputWeekday(normalized, { allowToday: true })) return true;
  if (parseSmartInputTime(normalized, { isTask: true })) return true;
  return false;
}

function stripDateTimeAnchors(line) {
  return normalizeSmartInput(line)
    .replace(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*日?|\d{1,2}\s*\/\s*\d{1,2}|\d{1,2}\s*日(?:後)?/g, ' ')
    .replace(/明後日|あさって|明日|あした|今日|きょう|来週|毎週|今週|次の/g, ' ')
    .replace(/(?:日|月|火|水|木|金|土)曜(?:日)?|(?:^|\s)(?:日|月|火|水|木|金|土)(?=\s|$|[1-6]\s*限)/g, ' ')
    .replace(/[1-6]\s*限(?:目)?/g, ' ')
    .replace(/\d{1,2}(?::\d{2}|時(?!間)(?:(?:\d{1,2})分?|半)?)(?:\s*[-〜～–—からより]+\s*\d{1,2}(?::\d{2}|時(?!間)(?:(?:\d{1,2})分?|半)?))?(?:まで(?:に)?|終了)?/g, ' ')
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .replace(/[・,，:：!！?？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanOcrText(text) {
  let result = normalizeSmartInput(text);
  let prev;
  do {
    prev = result;
    result = result.replace(/([ぁ-んァ-ヶ一-龠々ー])[ \t]+(?=[ぁ-んァ-ヶ一-龠々ー])/g, '$1');
  } while (result !== prev);
  return result
    .replace(/(\d)[ \t]*([:/\-])[ \t]*(\d)/g, '$1$2$3')
    .replace(/(\d)[ \t]+(?=(?:時|分|日|月|限|曜|までに|まで))/g, '$1')
    .replace(/([ぁ-んァ-ヶ一-龠々ー])[ \t]+(?=(?:までに|まで|から|より))/g, '$1')
    .replace(/[ \t]+(?=[）)])/g, '')
    .replace(/(?<=[（(])[ \t]+/g, '')
    .trim();
}

function splitSmartInputOcrLines(ocrText) {
  const rawLines = String(ocrText || '')
    .split(/\r?\n/)
    .map(line => cleanOcrText(line).replace(/[|｜\t]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const result = [];
  for (const line of rawLines) {
    if (isMaskedOrNoiseLine(line)) continue;

    const splitByEntries = line
      .replace(/\s+(?=(?:毎週|来週)?(?:日|月|火|水|木|金|土)曜?(?:日)?\s*(?:[1-6]\s*限|\d{1,2}[:時]))/g, '\n')
      .replace(/\s+(?=\d{1,2}\/\d{1,2}(?:\s|$))/g, '\n');

    for (const part of splitByEntries.split('\n')) {
      const trimmed = part.trim();
      if (trimmed && !isMaskedOrNoiseLine(trimmed)) result.push(trimmed);
    }
  }
  return result;
}

const SMART_UI_MENU_PATTERN = /^(?:アカウント|ダッシュボード|コース|カレンダー|メッセージ|履歴|ヘルプ|モジュール|ディスカッション|提出方法|ポイント|シラバス|成績|ホーム|お知らせ|ファイル|ユーザー|設定|メニュー)(?:[:：\s].*)?$/;

function extractShortTitlePhrase(rawLine) {
  const raw = cleanOcrText(rawLine || '');
  if (!raw || raw.length > 20) return '';
  if (/[。、]/.test(raw)) return '';
  if (/https?:\/\/|localhost|\.com|\.jp|\.edu|\.org/i.test(raw)) return '';
  if (/[>›»]/.test(raw)) return '';
  if (isMaskedOrNoiseLine(raw) || SMART_UI_MENU_PATTERN.test(raw)) return '';
  if (/^\d+(?:\.\d+)?\s*(?:点|ポイント|pt)?$/.test(raw)) return '';
  if (/^(?:期限|締切|〆切|日時|時間|開催|場所|詳細|概要)[:：\s]*$/.test(raw)) return '';
  if (/^[（(][^）)]*[）)]$/.test(raw)) return '';
  if (!stripDateTimeAnchors(raw)) return '';

  const cleaned = raw
    .replace(/^(?:課題名|タイトル|件名)[:：\s]*/, '')
    .replace(/\s*[（(][^）)]*[）)]\s*$/, '')
    .trim();
  const segments = cleaned.split(/\s*(?:[-–—|｜/]+|\s+)\s*/).filter(Boolean);
  for (const seg of segments) {
    if (SMART_UI_MENU_PATTERN.test(seg)) continue;
    if (seg.length >= 2 && seg.length <= 15) return seg;
  }
  return cleaned.length >= 2 && cleaned.length <= 15 ? cleaned : '';
}

function pickHeadingFromLines(cleanedLines, anchorIndices = []) {
  const firstDateTimeIdx = cleanedLines.findIndex((line, idx) =>
    anchorIndices.includes(idx) || /(?:期限|締切|〆切|日時|開催|まで)/.test(line)
  );
  const upperEnd = firstDateTimeIdx >= 0 ? firstDateTimeIdx : cleanedLines.length;
  const upperCandidates = [];
  for (let i = 0; i < upperEnd; i++) {
    if (anchorIndices.includes(i)) continue;
    const phrase = extractShortTitlePhrase(cleanedLines[i]);
    if (phrase) upperCandidates.push(phrase);
  }
  const preferredUpper = upperCandidates.find(p =>
    /(?:レポート|課題|制作|テスト|試験|発表|演習|ミーティング|説明会|練習|ライブ|ゼミ)/.test(p)
  ) || upperCandidates[0];
  if (preferredUpper) return preferredUpper;

  for (let i = upperEnd; i < cleanedLines.length; i++) {
    if (anchorIndices.includes(i)) continue;
    const phrase = extractShortTitlePhrase(cleanedLines[i]);
    if (phrase) return phrase;
  }
  return '';
}

function extractMainTitleFromOcrLines(lines, imgWidth = 0, imgHeight = 0) {
  if (!Array.isArray(lines) || !lines.length) return '';
  const maxX = imgWidth || Math.max(...lines.map(l => l?.bbox?.x1 || 0), 0);
  const maxY = imgHeight || Math.max(...lines.map(l => l?.bbox?.y1 || 0), 0);

  let bestTitle = '';
  let bestHeight = 0;

  for (const item of lines) {
    const phrase = extractShortTitlePhrase(item?.text || '');
    if (!phrase) continue;

    const bbox = item?.bbox;
    if (bbox && maxY > 0 && bbox.y0 < maxY * 0.08) continue;
    if (bbox && maxX > 0 && bbox.x0 < maxX * 0.15) continue;

    const height = bbox ? Math.max(0, (bbox.y1 || 0) - (bbox.y0 || 0)) : 1;
    if (height > bestHeight) {
      bestHeight = height;
      bestTitle = phrase;
    }
  }
  return bestTitle;
}

function extractSingleAnchorCandidate(cleanedLines, anchorIndices, mainTitle = '') {
  const joined = cleanedLines.join('\n');
  const isTask = /課題|レポート|テスト|試験|宿題|提出|締切|〆切|期限|までに/.test(joined);

  let date = null;
  let weekday = null;
  let start = '';
  let end = '';
  let repeat = 'once';
  let type = 'personal';

  const anchorLines = anchorIndices.map(i => cleanedLines[i]);
  for (const line of anchorLines) {
    if (!date) date = getSmartInputDate(line, { allowToday: isTask });
    if (!weekday) weekday = getSmartInputWeekday(line, { allowToday: isTask });
    const t = parseSmartInputTime(line, { isTask });
    if (t) {
      if (t.start && !start) start = t.start;
      if (t.end && !end) end = t.end;
    }
    if (/毎週/.test(line)) repeat = 'weekly';
    const parsed = parseSmartInputLine(line);
    if (parsed && parsed.type !== 'personal') type = parsed.type;
  }

  const headingCandidate = pickHeadingFromLines(cleanedLines, anchorIndices);
  const fallbackName = extractSmartEventName(
    cleanedLines.filter(line => !/[。、]/.test(line) && line.length <= 20).join(' '),
    isTask,
    type
  );
  const title = mainTitle || headingCandidate || fallbackName;

  if (type === 'personal') {
    if (/バイト|アルバイト|シフト/.test(joined)) type = 'work';
    else if (/授業|講義|ゼミ|演習/.test(joined)) type = 'class';
    else if (/サークル|部活/.test(joined)) type = 'club';
  }

  const resolvedWeekday = weekday?.weekday ?? (date ? new Date(`${date}T00:00:00`).getDay() : null);
  const candidate = {
    original: cleanedLines.join(' '),
    kind: isTask ? 'task' : 'event',
    name: title || (isTask ? '課題' : '予定'),
    date: date || '',
    weekday: resolvedWeekday,
    repeat: isTask ? 'once' : repeat,
    type,
    start: isTask ? '' : start,
    end,
    hours: 0,
    reason: ''
  };
  if (!candidate.date) candidate.reason = isTask ? '締め切り日を確認してください' : '日付または曜日を確認してください';
  else if (!isTask && (!candidate.start || !candidate.end)) candidate.reason = '開始・終了時刻を確認してください';
  candidate.ready = !candidate.reason;
  return candidate;
}

function parseOcrByDateTimeAnchors(ocrText, { mainTitle = '', guaranteeSingle = false } = {}) {
  const cleanedLines = splitSmartInputOcrLines(ocrText);
  const anchorIndices = [];
  cleanedLines.forEach((line, idx) => {
    if (hasValidDateTimeAnchor(line)) anchorIndices.push(idx);
  });

  if (anchorIndices.length === 0) {
    if (!guaranteeSingle) return [];
    const fallbackTitle = mainTitle || pickHeadingFromLines(cleanedLines, []) || '予定';
    const joined = cleanedLines.join('\n');
    const isTask = /課題|レポート|テスト|試験|宿題|提出|締切|〆切|期限|までに/.test(joined);
    return [{
      original: cleanedLines.join(' '),
      kind: isTask ? 'task' : 'event',
      name: fallbackTitle,
      date: '',
      weekday: null,
      repeat: 'once',
      type: 'personal',
      start: '',
      end: '',
      hours: 0,
      reason: '日付または時刻を入力してください',
      ready: false
    }];
  }

  if (anchorIndices.length <= 2) {
    return [extractSingleAnchorCandidate(cleanedLines, anchorIndices, mainTitle)];
  }

  const usedTextIndices = new Set();
  const candidates = [];
  for (const idx of anchorIndices) {
    const line = cleanedLines[idx];
    const leftover = stripDateTimeAnchors(line);
    let source = line;
    if (!leftover || leftover.length < 2) {
      const nextIdx = idx + 1;
      const prevIdx = idx - 1;
      if (nextIdx < cleanedLines.length && !anchorIndices.includes(nextIdx) && !usedTextIndices.has(nextIdx)) {
        source = `${line} ${cleanedLines[nextIdx]}`;
        usedTextIndices.add(nextIdx);
      } else if (prevIdx >= 0 && !anchorIndices.includes(prevIdx) && !usedTextIndices.has(prevIdx)) {
        source = `${line} ${cleanedLines[prevIdx]}`;
        usedTextIndices.add(prevIdx);
      }
    }
    const candidate = parseSmartInputLine(source);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function extractSmartInputInstructions(userText) {
  const regularLines = [];
  const includeWeekdays = new Set();
  const excludeWeekdays = new Set();
  const includeTypes = new Set();
  let includeTasksOnly = false;
  const weekdayMap = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };

  for (const raw of String(userText || '').split(/\r?\n/)) {
    const line = normalizeSmartInput(raw);
    if (!line) continue;
    const isFilterInstruction = /(?:だけ|のみ|以外|除く|限定)/.test(line)
      && !/\d{1,2}[:時]\d{0,2}\s*[-〜～–—から]/.test(line)
      && !/\d{1,2}\/\d{1,2}/.test(line);
    if (!isFilterInstruction) {
      regularLines.push(line);
      continue;
    }

    const isExclude = /以外|除く/.test(line);
    const dayMatches = line.match(/(日|月|火|水|木|金|土)(?=曜|[\s、,・と]|だけ|のみ|以外|除く|の)/g) || [];
    for (const ch of dayMatches) {
      const wd = weekdayMap[ch];
      if (wd === undefined) continue;
      if (isExclude) excludeWeekdays.add(wd);
      else includeWeekdays.add(wd);
    }
    if (/授業|講義|ゼミ/.test(line)) includeTypes.add('class');
    if (/バイト|アルバイト|シフト/.test(line)) includeTypes.add('work');
    if (/サークル|部活/.test(line)) includeTypes.add('club');
    if (/課題|レポート|テスト|試験/.test(line)) includeTasksOnly = true;
  }

  return {
    regularLines,
    filters: {
      includeWeekdays,
      excludeWeekdays,
      includeTypes,
      includeTasksOnly
    }
  };
}

function applySmartInputFilters(candidates, filters) {
  if (!filters) return candidates;
  const { includeWeekdays, excludeWeekdays, includeTypes, includeTasksOnly } = filters;
  return candidates.filter(candidate => {
    const wd = Number.isInteger(candidate.weekday)
      ? candidate.weekday
      : (candidate.date ? new Date(`${candidate.date}T00:00:00`).getDay() : null);
    if (includeWeekdays.size && (wd === null || !includeWeekdays.has(wd))) return false;
    if (excludeWeekdays.size && wd !== null && excludeWeekdays.has(wd)) return false;
    if (includeTasksOnly && candidate.kind !== 'task') return false;
    if (includeTypes.size && (candidate.kind === 'task' || !includeTypes.has(candidate.type))) return false;
    return true;
  });
}

function extractUserImageOverrides(userText) {
  const { filters } = extractSmartInputInstructions(userText);
  const cleaned = normalizeSmartInput(userText);
  const overrides = {
    filters,
    date: '',
    weekday: null,
    start: '',
    end: '',
    kind: '',
    type: '',
    title: ''
  };
  if (!cleaned) return overrides;

  const isFilterOnly = /(?:だけ|のみ|以外|除く|限定)/.test(cleaned)
    && !/\d{1,2}[:時]\d{0,2}/.test(cleaned)
    && !/\d{1,2}\/\d{1,2}/.test(cleaned);

  if (/課題|レポート|テスト|試験|宿題|提出|締切|〆切|期限/.test(cleaned)) overrides.kind = 'task';
  if (/バイト|アルバイト|シフト/.test(cleaned)) overrides.type = 'work';
  else if (/授業|講義|ゼミ/.test(cleaned)) overrides.type = 'class';
  else if (/サークル|部活/.test(cleaned)) overrides.type = 'club';

  if (!isFilterOnly) {
    const isTask = overrides.kind === 'task' || /までに/.test(cleaned);
    const d = getSmartInputDate(cleaned, { allowToday: isTask });
    const wd = getSmartInputWeekday(cleaned, { allowToday: isTask });
    const t = parseSmartInputTime(cleaned, { isTask });
    if (d) overrides.date = d;
    if (wd) overrides.weekday = wd.weekday;
    if (t) {
      if (t.start) overrides.start = t.start;
      if (t.end) overrides.end = t.end;
    }
  }

  const strippedTitle = stripDateTimeAnchors(cleaned)
    .replace(/(?:追加して|登録して|入れて|反映して|読み取って|確認して|追加|登録|お願い|してください|して|する|これ|この画像|画像|予定|課題|授業|講義|ゼミ|バイト|アルバイト|シフト|サークル|部活|だけ|のみ|以外|除く|限定|として|から|まで|より|を|に|の|で|へ|と|は|が)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (strippedTitle.length >= 2) overrides.title = strippedTitle;

  return overrides;
}

function extractTimetableGridFromOcr(ocrWords = [], ocrLines = []) {
  const tokens = [];
  if (Array.isArray(ocrWords) && ocrWords.length) {
    for (const w of ocrWords) {
      const text = cleanOcrText(w?.text || '');
      if (!text || !w?.bbox) continue;
      tokens.push({ text, bbox: w.bbox });
    }
  } else if (Array.isArray(ocrLines) && ocrLines.length) {
    for (const line of ocrLines) {
      if (Array.isArray(line?.words) && line.words.length) {
        for (const w of line.words) {
          const text = cleanOcrText(w?.text || '');
          if (text && w?.bbox) tokens.push({ text, bbox: w.bbox });
        }
      } else if (line?.text && line?.bbox) {
        const text = cleanOcrText(line.text);
        if (text) tokens.push({ text, bbox: line.bbox });
      }
    }
  }
  if (!tokens.length) return [];

  const weekdayIndexMap = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
  const headerCandidates = tokens
    .map(t => {
      const m = t.text.match(/^(日|月|火|水|木|金|土)(?:曜(?:日)?)?$/);
      if (!m) return null;
      return {
        weekday: weekdayIndexMap[m[1]],
        cx: (t.bbox.x0 + t.bbox.x1) / 2,
        cy: (t.bbox.y0 + t.bbox.y1) / 2,
        y0: t.bbox.y0,
        y1: t.bbox.y1,
        x0: t.bbox.x0,
        x1: t.bbox.x1
      };
    })
    .filter(Boolean);

  if (headerCandidates.length < 2) return [];

  // Group weekday tokens by horizontal row (similar cy) and pick the row with most distinct weekdays
  let bestRow = [];
  for (const anchor of headerCandidates) {
    const tol = Math.max(24, (anchor.y1 - anchor.y0) * 1.6);
    const sameRow = headerCandidates.filter(c => Math.abs(c.cy - anchor.cy) <= tol);
    const distinct = new Map();
    for (const c of sameRow) {
      if (!distinct.has(c.weekday)) distinct.set(c.weekday, c);
    }
    if (distinct.size > bestRow.length) bestRow = Array.from(distinct.values());
  }
  if (bestRow.length < 2) return [];

  bestRow.sort((a, b) => a.cx - b.cx);
  const headerMaxY = Math.max(...bestRow.map(c => c.y1));
  const avgColGap = bestRow.length > 1
    ? (bestRow[bestRow.length - 1].cx - bestRow[0].cx) / (bestRow.length - 1)
    : 120;

  const columns = bestRow.map((col, idx) => {
    const minX = idx === 0 ? col.cx - avgColGap * 0.55 : (bestRow[idx - 1].cx + col.cx) / 2;
    const maxX = idx === bestRow.length - 1 ? col.cx + avgColGap * 0.55 : (col.cx + bestRow[idx + 1].cx) / 2;
    return { weekday: col.weekday, cx: col.cx, minX, maxX };
  });

  // Detect period/time row anchors on the left side of the first column
  const leftBoundary = columns[0].minX + 12;
  const rowTokens = tokens.filter(t => {
    const cy = (t.bbox.y0 + t.bbox.y1) / 2;
    const cx = (t.bbox.x0 + t.bbox.x1) / 2;
    return cy > headerMaxY && cx <= leftBoundary;
  });

  const rawRows = [];
  for (const t of rowTokens) {
    const periodMatch = t.text.match(/^([1-6])\s*(?:限(?:目)?)?$/);
    const timeParsed = parseSmartInputTime(t.text);
    const cy = (t.bbox.y0 + t.bbox.y1) / 2;
    if (periodMatch) {
      const p = Number(periodMatch[1]);
      rawRows.push({ cy, period: p, start: SMART_PERIOD_TIMES[p].start, end: SMART_PERIOD_TIMES[p].end });
    } else if (timeParsed && timeParsed.start && timeParsed.end) {
      rawRows.push({ cy, period: null, start: timeParsed.start, end: timeParsed.end });
    }
  }

  // Merge row anchors that are at virtually the same Y (e.g. "1限" + "09:00-10:30" stacked)
  rawRows.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const r of rawRows) {
    const prev = rows[rows.length - 1];
    if (prev && Math.abs(prev.cy - r.cy) <= 28) {
      if (!prev.start && r.start) { prev.start = r.start; prev.end = r.end; }
    } else {
      rows.push({ ...r });
    }
  }
  if (!rows.length) return [];

  const avgRowGap = rows.length > 1
    ? (rows[rows.length - 1].cy - rows[0].cy) / (rows.length - 1)
    : 80;
  const rowBands = rows.map((r, idx) => ({
    ...r,
    minY: idx === 0 ? Math.max(headerMaxY, r.cy - avgRowGap * 0.55) : (rows[idx - 1].cy + r.cy) / 2,
    maxY: idx === rows.length - 1 ? r.cy + avgRowGap * 0.55 : (r.cy + rows[idx + 1].cy) / 2
  }));

  const cellBuckets = new Map();
  for (const t of tokens) {
    const cx = (t.bbox.x0 + t.bbox.x1) / 2;
    const cy = (t.bbox.y0 + t.bbox.y1) / 2;
    if (cy <= headerMaxY || cx < columns[0].minX) continue;
    const col = columns.find(c => cx >= c.minX && cx < c.maxX);
    const row = rowBands.find(r => cy >= r.minY && cy < r.maxY);
    if (!col || !row) continue;
    const key = `${col.weekday}:${row.start}:${row.end}`;
    if (!cellBuckets.has(key)) cellBuckets.set(key, { col, row, items: [] });
    cellBuckets.get(key).items.push(t);
  }

  const candidates = [];
  for (const { col, row, items } of cellBuckets.values()) {
    items.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));
    const filteredTokens = items
      .map(i => i.text)
      .filter(txt =>
        !/^[A-Za-z]{1,3}[-‐]?\d{2,4}[A-Za-z]?$/.test(txt)
        && !/^\d{1,3}-\d{2,4}$/.test(txt)
        && !/^(?:\d+号館)?\d+教室$/.test(txt)
        && !/^[（(][A-Za-z0-9\-教室]+[）)]$/.test(txt)
      );
    const rawSubject = cleanOcrText((filteredTokens.length ? filteredTokens : items.map(i => i.text)).join(''))
      .replace(/(?:[A-Za-z]{1,3}[-‐]?\d{2,4}[A-Za-z]?|(?:\d+号館)?\d+教室|[（(][A-Za-z0-9\-教室]+[）)])$/g, '')
      .trim();
    if (!rawSubject || rawSubject.length < 2 || isMaskedOrNoiseLine(rawSubject)) continue;

    candidates.push({
      original: `${weekNames[col.weekday]}曜 ${row.start}-${row.end} ${rawSubject}`,
      kind: 'event',
      name: rawSubject,
      date: getNearestDateForWeekday(col.weekday),
      weekday: col.weekday,
      repeat: 'weekly',
      type: 'class',
      start: row.start,
      end: row.end,
      hours: 0,
      reason: '',
      ready: true
    });
  }
  return candidates;
}

function mergeUserOverridesIntoCandidates(candidates, overrides, guaranteeSingle = false, forceWeeklyClass = false) {
  let result = applySmartInputFilters(candidates, overrides.filters);
  if (forceWeeklyClass) {
    result = result.map(item => {
      if (item.kind === 'task') return item;
      const updated = {
        ...item,
        repeat: 'weekly',
        type: overrides.type || (item.type === 'personal' ? 'class' : item.type)
      };
      if (!updated.date && Number.isInteger(updated.weekday)) {
        updated.date = getNearestDateForWeekday(updated.weekday);
      }
      updated.reason = '';
      if (!updated.name) updated.reason = '名前を確認してください';
      else if (!Number.isInteger(updated.weekday)) updated.reason = '曜日を確認してください';
      else if (!updated.start || !updated.end) updated.reason = '開始・終了時刻を確認してください';
      updated.ready = !updated.reason;
      return updated;
    });
  }
  if (result.length === 1) {
    const item = { ...result[0] };
    if (overrides.kind) {
      item.kind = overrides.kind;
      if (item.kind === 'task') item.start = '';
    }
    if (overrides.type) item.type = overrides.type;
    if (overrides.date) {
      item.date = overrides.date;
      item.weekday = new Date(`${overrides.date}T00:00:00`).getDay();
    } else if (Number.isInteger(overrides.weekday)) {
      item.weekday = overrides.weekday;
    }
    if (overrides.start && item.kind !== 'task') item.start = overrides.start;
    if (overrides.end) item.end = overrides.end;
    if (overrides.title) item.name = overrides.title;

    item.reason = '';
    if (!item.name) item.reason = '名前を確認してください';
    else if (!item.date && !(item.kind === 'event' && item.repeat === 'weekly' && Number.isInteger(item.weekday))) {
      item.reason = item.kind === 'task' ? '締め切り日を確認してください' : '日付または曜日を確認してください';
    } else if (item.kind !== 'task' && (!item.start || !item.end)) {
      item.reason = '開始・終了時刻を確認してください';
    }
    item.ready = !item.reason;
    return [item];
  }
  if (!result.length && guaranteeSingle) {
    return [{
      original: '',
      kind: overrides.kind || 'event',
      name: overrides.title || '予定',
      date: overrides.date || '',
      weekday: overrides.weekday,
      repeat: forceWeeklyClass ? 'weekly' : 'once',
      type: overrides.type || (forceWeeklyClass ? 'class' : 'personal'),
      start: overrides.kind === 'task' ? '' : (overrides.start || ''),
      end: overrides.end || '',
      hours: 0,
      reason: '日付または時刻を入力してください',
      ready: false
    }];
  }
  return result;
}

function parseSmartInputWithImage(userText, ocrText, ocrMeta = {}) {
  const overrides = extractUserImageOverrides(userText);
  const gridCandidates = Array.isArray(ocrMeta.gridCandidates) && ocrMeta.gridCandidates.length
    ? ocrMeta.gridCandidates
    : extractTimetableGridFromOcr(ocrMeta.words || [], ocrMeta.lines || []);
  const hasWeeklyKeyword = /(?:時間割|毎週|固定|学期)/.test(`${userText || ''}\n${ocrText || ''}`);
  const parsedOcr = gridCandidates.length
    ? gridCandidates
    : parseOcrByDateTimeAnchors(ocrText, {
      mainTitle: ocrMeta.mainTitle || '',
      guaranteeSingle: Boolean(ocrMeta.guaranteeSingle)
    });
  return mergeUserOverridesIntoCandidates(
    parsedOcr,
    overrides,
    Boolean(ocrMeta.guaranteeSingle),
    hasWeeklyKeyword || gridCandidates.length > 0
  );
}

function extractTitleSuggestionsFromOcr(ocrText) {
  const seen = new Set();
  const suggestions = [];
  for (const rawLine of String(ocrText || '').split(/\r?\n/)) {
    const cleaned = cleanOcrText(rawLine);
    const phrase = extractShortTitlePhrase(cleaned);
    if (phrase && !seen.has(phrase)) {
      seen.add(phrase);
      suggestions.push(phrase);
      if (suggestions.length >= 5) break;
    }
    if (suggestions.length < 5) {
      const stripped = stripDateTimeAnchors(cleaned);
      for (const seg of stripped.split(/\s*(?:[-–—|｜/]+|\s+)\s*/)) {
        const s = seg.trim();
        if (s.length >= 2 && s.length <= 15 && !/[。、]/.test(s) && !SMART_UI_MENU_PATTERN.test(s) && !seen.has(s)) {
          seen.add(s);
          suggestions.push(s);
          if (suggestions.length >= 5) break;
        }
      }
    }
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

function cropSmartInputImage(dataUrl, crop) {
  if (!crop || crop.w <= 0 || crop.h <= 0
      || typeof Image !== 'function' || typeof document.createElement !== 'function') {
    return Promise.resolve(dataUrl);
  }
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const natW = img.naturalWidth || img.width;
        const natH = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (!ctx || !natW || !natH) {
          resolve(dataUrl);
          return;
        }
        const sx = Math.max(0, Math.round(crop.x * natW));
        const sy = Math.max(0, Math.round(crop.y * natH));
        const sw = Math.max(1, Math.min(natW - sx, Math.round(crop.w * natW)));
        const sh = Math.max(1, Math.min(natH - sy, Math.round(crop.h * natH)));
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function recognizeSmartInputImage(dataUrl, crop = null) {
  if (typeof Tesseract === 'undefined' || typeof Tesseract.recognize !== 'function') {
    throw new Error('OCRライブラリがまだ読み込まれていません');
  }
  const targetUrl = await cropSmartInputImage(dataUrl, crop);
  const result = await Tesseract.recognize(targetUrl, 'jpn+eng', {
    logger: info => {
      if (info && info.status === 'recognizing text' && typeof info.progress === 'number') {
        smartInputStatus.textContent = `画像を読み取り中... ${Math.round(info.progress * 100)}%`;
      }
    }
  });
  const text = cleanOcrText(result?.data?.text || '');
  const lines = Array.isArray(result?.data?.lines) ? result.data.lines : [];
  const words = Array.isArray(result?.data?.words) ? result.data.words : [];
  const gridCandidates = extractTimetableGridFromOcr(words, lines);
  const mainTitle = extractMainTitleFromOcrLines(lines);
  return { text, lines, words, gridCandidates, mainTitle };
}

function setSmartOcrDebugText(text) {
  const debugBox = document.getElementById('smartOcrDebug');
  const debugPre = document.getElementById('smartOcrDebugText');
  if (!debugBox || !debugPre) return;
  const cleaned = String(text || '').trim();
  debugPre.textContent = cleaned;
  debugBox.hidden = !cleaned;
}

function analyzeSmartInput() {
  const rawText = smartInputText.value.trim();
  if (!smartInputImage) {
    smartOcrTitleSuggestions = [];
    setSmartOcrDebugText('');
    stageSmartInputCandidates(rawText);
    return;
  }

  const analyzeBtn = document.getElementById('analyzeSmartInput');
  const originalBtnText = analyzeBtn.textContent;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '画像を読み取り中...';
  smartInputStatus.textContent = '画像を読み取り中...';
  return recognizeSmartInputImage(smartInputImage.dataUrl, smartInputImage.crop || null)
    .then(ocrResult => {
      const ocrText = typeof ocrResult === 'string' ? cleanOcrText(ocrResult) : (ocrResult?.text || '');
      const mainTitle = typeof ocrResult === 'string' ? '' : (ocrResult?.mainTitle || '');
      const words = typeof ocrResult === 'string' ? [] : (ocrResult?.words || []);
      const lines = typeof ocrResult === 'string' ? [] : (ocrResult?.lines || []);
      const gridCandidates = typeof ocrResult === 'string' ? [] : (ocrResult?.gridCandidates || []);
      smartOcrTitleSuggestions = extractTitleSuggestionsFromOcr(ocrText);
      setSmartOcrDebugText(ocrText || '（文字が検出されませんでした）');
      const candidates = parseSmartInputWithImage(rawText, ocrText, {
        mainTitle,
        words,
        lines,
        gridCandidates,
        guaranteeSingle: true
      });
      smartInputStatus.textContent = '';
      stageSmartInputCandidates(candidates);
    })
    .catch(() => {
      smartInputStatus.textContent = '画像の文字読み取りに失敗しました。';
      smartOcrTitleSuggestions = [];
      setSmartOcrDebugText('');
      if (rawText) stageSmartInputCandidates(rawText);
      else {
        stageSmartInputCandidates([{
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
          reason: '画像の読み取りに失敗しました。内容を入力してください',
          ready: false
        }]);
      }
    })
    .finally(() => {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = originalBtnText;
    });
}

document.getElementById('analyzeSmartInput').addEventListener('click', analyzeSmartInput);
document.getElementById('confirmSmartInput').addEventListener('click', () => confirmSmartInputReview());
document.getElementById('editSmartInput').addEventListener('click', () => {
  smartInputReviewActive = false;
  smartInputReview.hidden = true;
  smartInputEntry.hidden = false;
  smartInputText.focus();
});

function openSmartEntryEditor(target) {
  smartInputEditTarget = target;
  setSmartInputMode('manual');
  const item = target.source === 'task'
    ? data.tasks.find(task => task.id === target.id)
    : data[target.source].find(entry => entry.id === target.id);
  if (!item) return;
  document.getElementById('eventName').value = item.name;
  document.getElementById('eventType').value = target.source === 'task'
    ? 'task'
    : (item.type === 'study' ? 'personal' : item.type);
  if (target.source === 'task') {
    const plan = data.plans.find(entry => entry.id === item.planId);
    document.getElementById('eventDue').value = item.due;
    document.getElementById('eventDuration').value = item.hours || '';
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
    syncEventScheduleFields();
    syncStudyFields();
  } else {
    const isWeekly = target.source === 'fixed';
    repeatSelect.value = isWeekly ? 'weekly' : 'once';
    document.getElementById('eventDay').value = isWeekly ? String(item.day) : String(new Date(`${item.day}T00:00:00`).getDay());
    document.getElementById('oneOffDate').value = isWeekly ? dateKey(selectedDate || today) : item.day;
    document.getElementById('eventStart').value = item.start;
    document.getElementById('eventEnd').value = item.end;
    document.getElementById('modalTitle').textContent = '予定を編集';
    document.getElementById('dueField').hidden = true;
    document.getElementById('durationField').hidden = true;
    syncEventScheduleFields();
    syncStudyFields();
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
    const rawDuration = form.get('duration');
    const hours = rawDuration === '' || rawDuration === null ? 0 : Number(rawDuration);
    const workload = Number(form.get('studyWorkload'));
    const difficulty = Number(form.get('studyDifficulty'));
    const credits = Number(form.get('courseCredits'));
    if (!task || !plan || eventTypeSelect.value !== 'task' || !due || due < dateKey(today)
        || !Number.isFinite(hours) || hours < 0 || hours > 200
        || !Number.isFinite(workload) || workload < 1
        || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5
        || !Number.isFinite(credits) || credits <= 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('課題名、締め切りを確認してください');
      return true;
    }
    const completedHours = Math.max(0, task.hours - task.remaining);
    task.name = name;
    task.due = due;
    task.hours = hours;
    task.remaining = Math.max(0, hours - completedHours);
    task.done = hours > 0 ? task.remaining === 0 : task.done;
    plan.name = name;
    plan.due = due;
    plan.estimatedHours = hours;
    plan.kind = String(form.get('studyType') || plan.kind);
    plan.workload = workload;
    plan.workloadKnown = true;
    plan.credits = credits;
    plan.difficulty = difficulty;
    plan.scope = String(form.get('studyScope') || '');
    if (hours > 0 && document.getElementById('studyAutoSchedule').checked) createSchedule({ reroute: true });
    else {
      data.sessions = data.sessions.filter(session => session.taskId !== task.id || !session.aiGenerated);
      save();
      renderCalendar();
      renderTasks();
    }
  } else {
    const repeat = String(form.get('repeat') || 'once');
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
    if (target.source === 'sessions' && repeat === 'once') {
      const existingSession = data.sessions.find(entry => entry.id === target.id);
      if (existingSession) {
        existingSession.name = name;
        existingSession.day = day;
        existingSession.start = start;
        existingSession.end = end;
      }
      weekStart = startOfWeek(new Date(`${day}T00:00:00`));
      dayMode = false;
      document.getElementById('weekViewBtn').classList.add('active');
      document.getElementById('dayViewBtn').classList.remove('active');
      save();
      renderCalendar();
      renderTasks();
    } else {
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
      if (typeof renderFixedScheduleOverview === 'function') renderFixedScheduleOverview();
    }
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  smartInputEditTarget = null;
  smartInputForm.reset();
  closeModal();
  eventTypeSelect.value = 'class';
  repeatSelect.value = 'once';
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
  clearSmartInputImage();
  smartOcrTitleSuggestions = [];
  setSmartOcrDebugText('');
  smartInputStatus.textContent = '';
  smartInputResults.innerHTML = '';
}

const openModalWithSmartInput = openModal;
openModal = (...args) => {
  closeCustomPicker();
  smartInputEditTarget = null;
  resetSmartInputReview();
  setSmartInputMode('ai');
  repeatSelect.value = 'once';
  openModalWithSmartInput(...args);
  syncEventScheduleFields();
};

const customPickerState = {
  popover: null,
  target: null,
  mode: null,
  viewMonth: null,
  hour: 9,
  minute: 0,
  minuteStep: 1,
  suppressScrollSync: false
};

function ensureCustomPickerPopover() {
  if (customPickerState.popover) return customPickerState.popover;
  const el = document.createElement('div');
  el.id = 'customPickerPopover';
  el.className = 'sc-picker-popover';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.hidden = true;
  document.body.appendChild(el);
  customPickerState.popover = el;
  return el;
}

function closeCustomPicker() {
  if (!customPickerState.popover) return;
  customPickerState.popover.hidden = true;
  customPickerState.target = null;
  customPickerState.mode = null;
}

function positionCustomPicker() {
  const { popover, target } = customPickerState;
  if (!popover || popover.hidden || !target || typeof target.getBoundingClientRect !== 'function') return;
  const rect = target.getBoundingClientRect();
  const width = popover.offsetWidth || 262;
  const height = popover.offsetHeight || 280;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - width - 8));
  const top = rect.bottom + 6 + height <= vh - 8
    ? rect.bottom + 6
    : Math.max(8, rect.top - height - 6);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function emitPickerValue(input, value) {
  if (!input) return;
  input.value = value;
  if (typeof Event === 'function' && typeof input.dispatchEvent === 'function') {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function renderCustomDatePicker() {
  const popover = ensureCustomPickerPopover();
  const target = customPickerState.target;
  if (!target) return;
  const viewMonth = customPickerState.viewMonth || new Date(today.getFullYear(), today.getMonth(), 1);
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(today);
  const minKey = target.min || '';
  const selectedKey = target.value || '';

  const cells = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push('<span></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(new Date(year, month, day));
    const disabled = Boolean(minKey && key < minKey);
    const classes = ['sc-cal-day'];
    if (key === todayKey) classes.push('is-today');
    if (key === selectedKey) classes.push('is-selected');
    cells.push(`<button type="button" class="${classes.join(' ')}" data-cal-date="${key}"${disabled ? ' disabled' : ''}>${day}</button>`);
  }

  popover.innerHTML = `
    <div class="sc-picker-head">
      <button type="button" class="sc-cal-nav" data-cal-shift="-1" aria-label="前の月">‹</button>
      <span class="sc-picker-title">${year}年 ${month + 1}月</span>
      <button type="button" class="sc-cal-nav" data-cal-shift="1" aria-label="次の月">›</button>
    </div>
    <div class="sc-cal-weekdays">${weekNames.map(w => `<span>${w}</span>`).join('')}</div>
    <div class="sc-cal-grid">${cells.join('')}</div>
    <div class="sc-picker-foot">
      <button type="button" class="secondary-btn sc-picker-btn" data-cal-today>今日</button>
      <button type="button" class="secondary-btn sc-picker-btn" data-picker-close>閉じる</button>
    </div>
  `;

  popover.querySelectorAll('[data-cal-shift]').forEach(btn => {
    btn.addEventListener('click', () => {
      customPickerState.viewMonth = new Date(year, month + Number(btn.dataset.calShift), 1);
      renderCustomDatePicker();
      positionCustomPicker();
    });
  });
  popover.querySelectorAll('[data-cal-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      emitPickerValue(target, btn.dataset.calDate);
      closeCustomPicker();
    });
  });
  const todayBtnEl = popover.querySelector('[data-cal-today]');
  if (todayBtnEl) {
    todayBtnEl.addEventListener('click', () => {
      const pickKey = minKey && todayKey < minKey ? minKey : todayKey;
      emitPickerValue(target, pickKey);
      closeCustomPicker();
    });
  }
  const closeBtnEl = popover.querySelector('[data-picker-close]');
  if (closeBtnEl) closeBtnEl.addEventListener('click', closeCustomPicker);
}

function getTimePickerMinutesList(step) {
  const list = [];
  for (let m = 0; m < 60; m += step) list.push(m);
  return list;
}

function formatTimeValue(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function renderCustomTimePicker({ applyInitial = false } = {}) {
  const popover = ensureCustomPickerPopover();
  const target = customPickerState.target;
  if (!target) return;

  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  const minutesList = getTimePickerMinutesList(1);

  popover.innerHTML = `
    <div class="sc-picker-head">
      <span class="sc-picker-title">時間を選択（1分単位）</span>
      <span class="sc-time-preview" data-time-preview>${formatTimeValue(customPickerState.hour, customPickerState.minute)}</span>
    </div>
    <div class="sc-time-wheels">
      <div class="sc-wheel-highlight" aria-hidden="true"></div>
      <div class="sc-wheel" data-wheel="hour" aria-label="時">
        <div class="sc-wheel-pad"></div>
        ${hoursList.map(h => `<button type="button" class="sc-wheel-item${h === customPickerState.hour ? ' is-active' : ''}" data-wheel-value="${h}">${String(h).padStart(2, '0')}</button>`).join('')}
        <div class="sc-wheel-pad"></div>
      </div>
      <div class="sc-wheel-colon" aria-hidden="true">:</div>
      <div class="sc-wheel" data-wheel="minute" aria-label="分">
        <div class="sc-wheel-pad"></div>
        ${minutesList.map(m => `<button type="button" class="sc-wheel-item${m === customPickerState.minute ? ' is-active' : ''}" data-wheel-value="${m}">${String(m).padStart(2, '0')}</button>`).join('')}
        <div class="sc-wheel-pad"></div>
      </div>
    </div>
    <div class="sc-picker-foot">
      <button type="button" class="secondary-btn sc-picker-btn" data-picker-close>キャンセル</button>
      <button type="button" class="primary-btn sc-picker-btn" data-picker-apply>決定</button>
    </div>
  `;

  const hourWheel = popover.querySelector('[data-wheel="hour"]');
  const minuteWheel = popover.querySelector('[data-wheel="minute"]');
  const previewEl = popover.querySelector('[data-time-preview]');

  const updateActiveClasses = () => {
    if (previewEl) previewEl.textContent = formatTimeValue(customPickerState.hour, customPickerState.minute);
    hourWheel?.querySelectorAll('.sc-wheel-item').forEach(btn => {
      if (Number(btn.dataset.wheelValue) === customPickerState.hour) btn.classList.add('is-active');
      else btn.classList.remove('is-active');
    });
    minuteWheel?.querySelectorAll('.sc-wheel-item').forEach(btn => {
      if (Number(btn.dataset.wheelValue) === customPickerState.minute) btn.classList.add('is-active');
      else btn.classList.remove('is-active');
    });
  };

  const syncWheelScrollPosition = (wheel, items, value, smooth = false) => {
    if (!wheel) return;
    const index = Math.max(0, items.indexOf(value));
    const top = index * 36;
    if (smooth && typeof wheel.scrollTo === 'function') {
      wheel.scrollTo({ top, behavior: 'smooth' });
    } else {
      wheel.scrollTop = top;
    }
  };

  customPickerState.suppressScrollSync = true;
  syncWheelScrollPosition(hourWheel, hoursList, customPickerState.hour, false);
  syncWheelScrollPosition(minuteWheel, minutesList, customPickerState.minute, false);
  setTimeout(() => { customPickerState.suppressScrollSync = false; }, 60);

  if (applyInitial) {
    emitPickerValue(target, formatTimeValue(customPickerState.hour, customPickerState.minute));
  }

  let scrollTimer = null;
  const attachWheel = (wheel, items, key) => {
    if (!wheel) return;
    wheel.addEventListener('scroll', () => {
      if (customPickerState.suppressScrollSync) return;
      const index = Math.min(items.length - 1, Math.max(0, Math.round(wheel.scrollTop / 36)));
      const nextVal = items[index];
      if (customPickerState[key] !== nextVal) {
        customPickerState[key] = nextVal;
        updateActiveClasses();
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          emitPickerValue(target, formatTimeValue(customPickerState.hour, customPickerState.minute));
        }, 40);
      }
    });
    wheel.querySelectorAll('.sc-wheel-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextVal = Number(btn.dataset.wheelValue);
        customPickerState[key] = nextVal;
        updateActiveClasses();
        customPickerState.suppressScrollSync = true;
        syncWheelScrollPosition(wheel, items, nextVal, true);
        setTimeout(() => { customPickerState.suppressScrollSync = false; }, 220);
        emitPickerValue(target, formatTimeValue(customPickerState.hour, customPickerState.minute));
      });
    });
  };

  attachWheel(hourWheel, hoursList, 'hour');
  attachWheel(minuteWheel, minutesList, 'minute');

  const applyBtn = popover.querySelector('[data-picker-apply]');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      emitPickerValue(target, formatTimeValue(customPickerState.hour, customPickerState.minute));
      closeCustomPicker();
    });
  }
  const closeBtn = popover.querySelector('[data-picker-close]');
  if (closeBtn) closeBtn.addEventListener('click', closeCustomPicker);
}

function getDefaultTimeForInput(input) {
  if (/^\d{2}:\d{2}$/.test(input.value || '')) {
    const [h, m] = input.value.split(':').map(Number);
    return { hour: h, minute: m };
  }
  const isEnd = input.id === 'eventEnd' || input.dataset?.smartField === 'end' || input.name === 'actualEnd';
  if (isEnd) {
    const container = typeof input.closest === 'function' ? input.closest('.smart-input-pending, form') : null;
    const siblingStart = container
      ? container.querySelector('[data-smart-field="start"], #eventStart, [name="actualStart"]')
      : document.getElementById('eventStart');
    if (siblingStart && /^\d{2}:\d{2}$/.test(siblingStart.value || '')) {
      const total = Math.min(23 * 60 + 59, clockMinutes(siblingStart.value) + 60);
      return { hour: Math.floor(total / 60), minute: total % 60 };
    }
    return { hour: 14, minute: 0 };
  }
  return { hour: 9, minute: 0 };
}

function openCustomPicker(input) {
  if (!input || (input.type !== 'date' && input.type !== 'time')) return;
  const popover = ensureCustomPickerPopover();
  customPickerState.target = input;
  customPickerState.mode = input.type;
  popover.hidden = false;

  if (input.type === 'date') {
    const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(input.value || '')
      ? new Date(`${input.value}T00:00:00`)
      : today;
    customPickerState.viewMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    renderCustomDatePicker();
  } else {
    const initial = getDefaultTimeForInput(input);
    customPickerState.hour = initial.hour;
    customPickerState.minute = initial.minute;
    customPickerState.minuteStep = 1;
    renderCustomTimePicker();
  }
  positionCustomPicker();
}

function handlePickerTriggerMouseDown(event) {
  const target = event.target;
  if (target && target.tagName === 'INPUT' && (target.type === 'date' || target.type === 'time')) {
    event.preventDefault();
  }
}

function handlePickerTriggerClick(event) {
  const target = event.target;
  if (target && target.tagName === 'INPUT' && (target.type === 'date' || target.type === 'time')) {
    event.preventDefault();
    if (typeof target.focus === 'function') target.focus({ preventScroll: true });
    openCustomPicker(target);
  }
}

function handlePickerTriggerKeyDown(event) {
  const target = event.target;
  if (target && target.tagName === 'INPUT' && (target.type === 'date' || target.type === 'time')
      && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
    event.preventDefault();
    openCustomPicker(target);
  }
}

const pickerRoot = typeof document.addEventListener === 'function' ? document : smartInputForm;
pickerRoot.addEventListener('mousedown', handlePickerTriggerMouseDown);
pickerRoot.addEventListener('click', handlePickerTriggerClick);
pickerRoot.addEventListener('keydown', handlePickerTriggerKeyDown);
smartInputForm.addEventListener('scroll', () => {
  if (customPickerState.popover && !customPickerState.popover.hidden) positionCustomPicker();
});

if (typeof document.addEventListener === 'function') {
  document.addEventListener('mousedown', event => {
    const { popover, target } = customPickerState;
    if (!popover || popover.hidden) return;
    if (typeof popover.contains === 'function' && (popover.contains(event.target) || event.target === target)) return;
    closeCustomPicker();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && customPickerState.popover && !customPickerState.popover.hidden) {
      closeCustomPicker();
    }
  });
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('resize', positionCustomPicker);
}
if (typeof closeModal === 'function') {
  const closeModalBeforePicker = closeModal;
  closeModal = (...args) => {
    closeCustomPicker();
    return closeModalBeforePicker(...args);
  };
}
document.getElementById('analyzeSmartInput').addEventListener('click', closeCustomPicker);
document.getElementById('editSmartInput').addEventListener('click', closeCustomPicker);
smartInputTab.addEventListener('click', closeCustomPicker);
manualInputTab.addEventListener('click', closeCustomPicker);
