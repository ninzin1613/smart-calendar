data.restDays = Array.isArray(data.restDays) ? data.restDays : [];
data.activeTimer = data.activeTimer && Number.isFinite(data.activeTimer.endsAt)
  && typeof data.activeTimer.sessionId === 'string'
  && typeof data.activeTimer.taskId === 'string'
  ? data.activeTimer
  : null;
data.recentlyScheduledSessionIds = [];

document.querySelector('.calendar-shell').insertAdjacentHTML('beforebegin', `
  <section class="character-station" id="characterStation" aria-labelledby="characterStationTitle">
    <div class="character-avatar" id="characterAvatar" role="img"></div>
    <div class="character-message">
      <div class="character-title" id="characterStationTitle"><span class="character-brand">TASKROU · AI STUDY COMPANION</span><span>今日のひとこと</span></div>
      <div class="character-bubble" id="characterMessage" role="status" aria-live="polite"></div>
      <div class="character-actions">
        <button class="primary-btn character-start" type="button" id="acceptSuggestion">実行する</button>
        <button class="secondary-btn" type="button" id="declineSuggestion">やめとく</button>
        <button class="secondary-btn" type="button" id="chooseOtherTask">他のこと</button>
      </div>
      <div class="character-timer" id="studyTimerReadout" role="timer" aria-live="polite" hidden></div>
    </div>
    <div class="capacity-panic" id="capacityPanic" role="status" hidden></div>
    <section class="character-chat" aria-label="タスクロウに相談">
      <div class="character-chat-history" id="characterChatHistory" role="log" aria-live="polite"></div>
      <form class="character-chat-form" id="characterChatForm">
        <input class="character-chat-input" id="characterChatInput" type="text" maxlength="240" aria-label="タスクロウへの相談内容" placeholder="例：今日、何から始めればいい？" autocomplete="off">
        <button class="character-chat-send" type="submit">相談する</button>
      </form>
    </section>
  </section>
`);

document.body.insertAdjacentHTML('beforeend', `
  <button class="task-fab" type="button" id="taskFab" aria-label="予定を追加">＋ <span>予定を追加</span></button>
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
  <section class="fixed-overview" id="fixedOverview" aria-labelledby="fixedOverviewTitle" hidden>
    <div class="task-overview-heading">
      <div>
        <div class="eyebrow">WEEKLY COMMITMENTS</div>
        <h1 id="fixedOverviewTitle">固定予定一覧</h1>
        <div class="task-overview-summary" id="fixedOverviewSummary"></div>
      </div>
    </div>
    <div class="fixed-overview-list" id="fixedOverviewList"></div>
  </section>
`);

const summaryMetrics = document.querySelector('.metrics');
if (typeof window !== 'undefined') {
  const placeSummaryMetrics = () => {
    const target = window.innerWidth > 850
      ? document.querySelector('.mini-calendar')
      : document.querySelector('.main');
    if (window.innerWidth > 850 && summaryMetrics.previousElementSibling !== target) {
      target.insertAdjacentElement('afterend', summaryMetrics);
    } else if (window.innerWidth <= 850 && summaryMetrics !== target.firstElementChild) {
      target.insertAdjacentElement('afterbegin', summaryMetrics);
    }
  };
  placeSummaryMetrics();
  window.addEventListener('resize', placeSummaryMetrics);
}

const enhancementStyle = document.createElement('style');
enhancementStyle.textContent = `
.sidebar .metrics { grid-template-columns: minmax(0, 1fr); gap: 8px; margin: 0; }
.sidebar .metric { position: relative; min-height: 58px; padding: 9px 11px; gap: 9px; justify-content: center; text-align: center; }
.sidebar .metric > div:last-child { display: flex; flex-direction: column; align-items: center; }
.sidebar .metric-label { order: -1; margin-top: 0; }
.sidebar .metric-value { font-size: 16px; }
.sidebar .metric-symbol { position: absolute; left: 11px; flex: 0 0 30px; width: 30px; height: 30px; }
.character-station { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 16px 0; padding: 12px 16px; border: 1px solid #e5dfcd; border-radius: 12px; background: linear-gradient(110deg, #fffdf6 0%, #fffefa 56%, #f0f7f5 100%); box-shadow: var(--shadow); }
.character-avatar { display: grid; flex: 0 0 132px; width: 132px; height: 144px; place-items: center; border: 1px solid #e8dfc7; border-radius: 22px; background: radial-gradient(circle at 50% 35%, #fff8df 0, #f8edc8 72%, #f0e5c4 100%); }
.owl-mascot { display: block; width: 122px; height: 140px; overflow: visible; filter: drop-shadow(0 3px 1px rgba(71, 58, 39, .12)); }
.owl-body { fill: #f2cf72; stroke: #59432c; stroke-width: 2.2; stroke-linejoin: round; }
.owl-tail { fill: #dfb45e; stroke: #705034; stroke-width: 1.8; stroke-linejoin: round; }
.owl-face { fill: #fff4d9; stroke: #755636; stroke-width: 1.8; stroke-linejoin: round; }
.owl-wing { fill: #e7b958; stroke: #765437; stroke-width: 1.8; stroke-linejoin: round; }
.owl-feather { fill: #fff4d9; stroke: #b48b4e; stroke-width: 1; stroke-linejoin: round; }
.owl-feather-line { fill: none; stroke: #bd985b; stroke-width: 1; stroke-linecap: round; }
.owl-glasses { fill: #d3e6dc; fill-opacity: .48; stroke: #705a3e; stroke-width: 2.4; }
.owl-glasses-shine { fill: none; stroke: #fffdf0; stroke-width: 1.5; stroke-linecap: round; }
.owl-eye { fill: #f8f8e9; stroke: #73583a; stroke-width: 1.1; }
.owl-pupil { fill: #516451; }
.owl-eye-glint { fill: #fff; }
.owl-beak, .owl-feet, .owl-clock { stroke: #62472e; stroke-linecap: round; stroke-linejoin: round; }
.owl-beak { fill: #bf8050; stroke-width: 1.5; }
.owl-feet { fill: none; stroke-width: 3; }
.owl-clock { fill: #fff6d8; stroke-width: 1.8; }
.owl-clock-hand { fill: none; stroke: #62472e; stroke-width: 1.4; stroke-linecap: round; }
.owl-brow, .owl-mouth { fill: none; stroke: #62472e; stroke-width: 1.8; stroke-linecap: round; }
.owl-sparkle { fill: #d49843; stroke: #a97936; stroke-width: .8; }
.owl-sweat { fill: #88b9c3; stroke: #547f89; stroke-width: 1; }
.owl-crown { fill: #d7dfb0; stroke: #7a8053; stroke-width: 1.6; stroke-linejoin: round; }
.owl-crown-leaf { fill: #a4b77c; stroke: #66794e; stroke-width: .8; }
.owl-leaf { fill: #91b56d; stroke: #5d7b48; stroke-width: 1; }
.owl-confetti { fill: #f0bf4e; stroke: #a97936; stroke-width: .7; }
.owl-book { fill: #a87956; stroke: #5e4637; stroke-width: 1.4; stroke-linejoin: round; }
.owl-book-page { fill: #e8d6b3; stroke: #6b5039; stroke-width: 1; }
.owl-quill-barrel { fill: #f2d18a; stroke: #62472e; stroke-width: 1.7; stroke-linejoin: round; }
.owl-quill-mark { fill: none; stroke: #85633c; stroke-width: 1; stroke-linecap: round; }
.owl-eyes { transform-box: fill-box; transform-origin: center; animation: owl-blink 3.4s ease-in-out infinite; }
.owl-mascot { transform-origin: 50% 80%; animation: owl-breathe 3s ease-in-out infinite; }
.character-avatar { transition: transform .18s ease, box-shadow .18s ease; }
.character-avatar:hover { transform: translateY(-4px) scale(1.05); box-shadow: 0 8px 18px rgba(89, 67, 44, .12); }
.character-avatar:active { transform: translateY(-1px) scale(1.02); }
.owl-mascot[data-mood="encouraging"] .owl-wing { transform-box: fill-box; transform-origin: center top; animation: owl-wing-flap 1.1s ease-in-out infinite; }
.owl-mascot[data-mood="focused"] .owl-wing { transform-box: fill-box; transform-origin: center top; animation: owl-wing-flap .55s ease-in-out infinite; }
.owl-mascot[data-mood="focused"] .owl-sparkle { animation: owl-sparkle .5s ease-in-out infinite alternate; }
.owl-mascot[data-mood="concerned"] { animation: owl-shiver .45s ease-in-out infinite; }
.owl-mascot[data-mood="celebratory"] .owl-sparkle { animation: owl-sparkle 1s ease-in-out infinite alternate; }
.owl-mascot[data-timer-active="true"] .owl-clock { animation: owl-clock-glow 1.8s ease-in-out infinite; }
.owl-mascot[data-timer-active="true"] .owl-clock-hand { transform-box: fill-box; transform-origin: center; animation: owl-clock-tick 60s steps(60, end) infinite; }
.character-bubble.is-updating { animation: owl-type-in .65s steps(24, end); }
.character-timer { margin-top: 7px; color: #557442; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
@keyframes owl-breathe { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.015); } }
@keyframes owl-blink { 0%, 43%, 46%, 100% { transform: scaleY(1); } 44%, 45% { transform: scaleY(.08); } }
@keyframes owl-wing-flap { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-7deg); } }
@keyframes owl-shiver { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-1px); } 75% { transform: translateX(1px); } }
@keyframes owl-sparkle { from { opacity: .55; transform: scale(.8); } to { opacity: 1; transform: scale(1.15); } }
@keyframes owl-clock-glow { 50% { filter: drop-shadow(0 0 4px #f4cf4f); } }
@keyframes owl-clock-tick { to { transform: rotate(360deg); } }
@keyframes owl-type-in { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
.owl-mascot[data-mood="concerned"] .owl-body { fill: #e9c678; }
.owl-mascot[data-mood="resting"] .owl-eye-glint { display: none; }
.owl-mascot[data-mood="celebratory"] .owl-sparkle { fill: #e7a74f; }
.character-title { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 9px; margin-bottom: 5px; color: #718563; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.character-brand { color: #9c8050; font-size: 8px; letter-spacing: .11em; }
.character-message { flex: 1; min-width: 0; }
.character-bubble { position: relative; width: fit-content; max-width: 100%; padding: 8px 11px; border-radius: 4px 11px 11px; background: #f2f5ed; font-size: 12px; line-height: 1.5; }
.character-bubble::before { position: absolute; top: 10px; left: -6px; border-width: 6px 6px 6px 0; border-style: solid; border-color: transparent #f2f5ed transparent transparent; content: ""; }
.character-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
.character-actions button { min-height: 31px; height: 31px; font-size: 10px; }
.character-actions .primary-btn { background: var(--green-dark); box-shadow: none; }
.capacity-panic { flex: 0 0 auto; max-width: 230px; padding: 8px 10px; border-radius: 7px; background: #fff1eb; color: #a64e3c; font-size: 10px; font-weight: 700; }
.capacity-panic[hidden] { display: none; }
.character-chat { flex: 0 0 100%; min-width: 0; }
.character-chat-history { display: grid; gap: 6px; max-height: 150px; margin-top: 10px; overflow-y: auto; }
.character-chat-history:empty { display: none; }
.character-chat-entry { max-width: min(680px, 100%); padding: 8px 10px; border-radius: 8px; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.character-chat-entry.user { justify-self: end; background: #fff2c8; }
.character-chat-entry.assistant { justify-self: start; background: #f2f5ed; }
.character-chat-speaker { display: block; margin-bottom: 2px; color: #718563; font-size: 9px; font-weight: 700; }
.character-chat-form { display: flex; gap: 7px; margin-top: 10px; }
.character-chat-input { flex: 1; min-width: 0; height: 38px; padding: 0 10px; border: 1px solid #d8e3ef; border-radius: 8px; background: white; }
.character-chat-input:focus { outline: 3px solid rgba(139, 207, 120, .2); border-color: var(--green-dark); }
.character-chat-send { min-width: 78px; padding: 0 12px; border: 0; border-radius: 8px; background: var(--green-dark); color: white; font-size: 10px; font-weight: 700; }
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
body.fixed-overview-active .main > :not(.topbar):not(#fixedOverview) { display: none; }
body.fixed-overview-active #fixedOverview { display: block; }
.fixed-overview { min-height: 60vh; padding: 18px 0; }
.fixed-overview[hidden] { display: none; }
.fixed-overview-list { display: grid; gap: 9px; max-width: 860px; }
.fixed-overview-item { display: flex; align-items: center; gap: 13px; min-height: 64px; padding: 11px 14px; border: 1px solid #e4ebf4; border-radius: 8px; background: var(--white); }
.fixed-overview-day { flex: 0 0 76px; color: var(--green-dark); font-size: 11px; font-weight: 700; }
.fixed-overview-info { display: grid; gap: 4px; min-width: 0; }
.fixed-overview-name { overflow-wrap: anywhere; font-size: 12px; font-weight: 700; }
.fixed-overview-meta { color: #828b81; font-size: 10px; }
@media (prefers-reduced-motion: reduce) {
  .calendar-grid .event.ai-new, .owl-mascot, .owl-eyes, .owl-wing, .owl-sparkle,
  .owl-mascot[data-timer-active="true"] .owl-clock, .owl-mascot[data-timer-active="true"] .owl-clock-hand,
  .character-bubble.is-updating { animation: none; }
  .character-avatar { transition: none; }
}
@media (max-width: 680px) { .character-station { align-items: flex-start; flex-wrap: wrap; } .character-avatar { flex-basis: 90px; width: 90px; height: 100px; } .owl-mascot { width: 84px; height: 96px; } .character-message { flex-basis: calc(100% - 106px); } .capacity-panic { margin-left: 104px; } .task-fab { right: 14px; bottom: 14px; min-height: 44px; padding: 0 14px; } .fixed-overview-item { align-items: flex-start; flex-direction: column; gap: 4px; } .fixed-overview-day { flex-basis: auto; } }
`;
document.head.appendChild(enhancementStyle);

let characterCelebrationUntil = 0;
let characterSuggestedTaskName = null;

function getStudyTimerRemaining(timer, now = Date.now()) {
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

function formatStudyTimer(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateStudyTimer() {
  const readout = document.getElementById('studyTimerReadout');
  const timer = data.activeTimer;
  if (!timer) {
    readout.hidden = true;
    readout.textContent = '';
    return;
  }

  const remaining = getStudyTimerRemaining(timer);
  if (!remaining) {
    data.activeTimer = null;
    save();
    readout.hidden = true;
    readout.textContent = '';
    renderCharacterStation();
    showToast('集中タイマーが終了しました。おつかれさま！');
    return;
  }

  readout.hidden = false;
  readout.textContent = `作業中 ${formatStudyTimer(remaining)}`;
}

function stopStudyTimerForTask(taskId) {
  if (data.activeTimer?.taskId !== taskId) return;
  data.activeTimer = null;
  save();
  updateStudyTimer();
  renderCharacterStation();
}

function celebrateTaskCompletion(taskId) {
  stopStudyTimerForTask(taskId);
  characterCelebrationUntil = Date.now() + 2600;
  renderCharacterStation();
  setTimeout(() => {
    characterCelebrationUntil = 0;
    renderCharacterStation();
  }, 2600);
}

function setCharacterMessage(text) {
  const message = document.getElementById('characterMessage');
  if (message.textContent === text) return;
  message.textContent = text;
  message.classList.remove('is-updating');
  void message.offsetWidth;
  message.classList.add('is-updating');
}

function getOwlMarkup(mood) {
  const eyes = mood === 'resting' || mood === 'celebratory'
    ? '<path class="owl-eye" d="M48 75q20 13 40 0m8 0q20 13 40 0"/>'
    : '<ellipse class="owl-eye" cx="69" cy="73" rx="13" ry="16"/><ellipse class="owl-eye" cx="111" cy="73" rx="13" ry="16"/><circle class="owl-pupil" cx="70" cy="75" r="7"/><circle class="owl-pupil" cx="110" cy="75" r="7"/><circle class="owl-eye-glint" cx="73" cy="69" r="2.8"/><circle class="owl-eye-glint" cx="113" cy="69" r="2.8"/>'
  const brows = mood === 'focused'
    ? '<path class="owl-brow" d="m52 56 18-5m58 5-18-5"/>'
    : mood === 'concerned'
    ? '<path class="owl-brow" d="m52 51 18 7m58-7-18 7"/>'
    : mood === 'encouraging' || mood === 'celebratory'
        ? '<path class="owl-brow" d="m52 52 18-3m58 3-18-3"/>'
      : '<path class="owl-brow" d="M56 48q13-9 28 0 7 4 14 0 15-9 28 0"/>';
  const mouth = mood === 'celebratory'
    ? '<path class="owl-mouth" d="M81 105q9 13 18 0"/>'
    : '<path class="owl-mouth" d="m84 102 6 8 6-8"/>'
  const crown = mood === 'encouraging'
    ? '<path class="owl-crown" d="M48 57q21-8 42-5 21-4 42 2l-1 6q-21-5-41 0-20-4-40 3z"/><path class="owl-crown-leaf" d="m62 51 4-8 5 8zm25-1 5-8 4 8zm25 1 4-7 5 8z"/>'
    : '';
  const extras = mood === 'focused'
    ? '<path class="owl-sparkle" d="m153 37 3 6 6 2-6 3-3 6-2-6-6-3 6-2z"/><path class="owl-sparkle" d="m27 67 2 4 4 1-4 2-2 4-1-4-4-2 4-1z"/>'
    : mood === 'concerned'
    ? '<path class="owl-sweat" d="M151 62q-9 13 0 18 9-5 0-18z"/>'
    : mood === 'encouraging'
        ? '<path class="owl-sparkle" d="m153 37 3 6 6 2-6 3-3 6-2-6-6-3 6-2z"/>'
      : mood === 'celebratory'
          ? '<path class="owl-sparkle" d="m21 57 3 6 6 2-6 3-3 6-2-6-6-3 6-2z"/><path class="owl-sparkle" d="m157 90 3 5 5 2-5 2-3 5-2-5-5-2 5-2z"/><path class="owl-confetti" d="m37 37 5-8 4 8-5 7zm90-11 7-5 1 9-7 5z"/>'
        : mood === 'resting'
          ? '<path class="owl-sparkle" d="m150 45 2 4 4 1-4 2-2 4-1-4-4-2 4-1z"/>'
        : '';
  const timerActive = data.activeTimer && getStudyTimerRemaining(data.activeTimer) > 0;
  return `<svg class="owl-mascot" data-mood="${mood}" data-timer-active="${Boolean(timerActive)}" viewBox="0 0 180 205" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="92" cy="194" rx="70" ry="5" fill="#8fc8cf" opacity=".3"/>
    <path class="owl-tail" d="M128 127q26 2 39 24l-21-1 17 20-27-5-18-17z"/>
    <path class="owl-body" d="M49 53Q66 34 91 35q27-1 45 19 22 20 23 53 2 39-23 60-25 20-51 13-33-4-51-29-18-24-11-58 5-24 26-40z"/>
    <path class="owl-feather" d="M48 108q19 15 44 16 26 0 47-15 1 32-18 49-27 21-53 2-17-13-20-52z"/>
    <path class="owl-feather-line" d="M58 130q4 19 17 28m1-30q5 21 15 32m2-32q0 17 6 31m7-33q-1 17-1 29m11-35q-5 17-9 24"/>
    <path class="owl-wing" d="M49 78Q25 75 21 102q-4 29 17 45 14 8 24-9 8-17 1-40z"/>
    <path class="owl-feather" d="M30 117q9 10 25 17l-7 10q-14-7-20-19zm-1-17q10 12 25 18l-4 9q-15-7-23-18z"/>
    <path class="owl-wing" d="M130 72q29-8 42 20 13 29-3 58-10 17-26 7-20-12-22-39-2-29 9-46z"/>
    <path class="owl-feather" d="M165 119q-10 13-25 19l9 12q15-8 22-23zm2-18q-11 13-27 19l6 10q16-8 24-19z"/>
    <path class="owl-face" d="M38 68q8-22 29-24 15-1 24 11 11-12 26-11 22 2 28 26-6 27-24 42-14 11-29 13-17-2-30-13Q42 98 38 68z"/>
    <path class="owl-feather" d="M52 51Q36 34 39 16q17 13 31 31m40 0q18-20 34-24-1 19-17 33" />
    <path class="owl-feather-line" d="M46 36q8 9 16 15m59-1q8-8 14-14"/>
    ${brows}
    <g class="owl-eyes">${eyes}</g>
    <circle class="owl-glasses" cx="69" cy="73" r="24"/><circle class="owl-glasses" cx="111" cy="73" r="24"/>
    <path d="M92 70q-2-4-4 0m4 0q2-4 4 0" fill="none" stroke="#705a3e" stroke-width="3.2" stroke-linecap="round"/>
    <path class="owl-glasses-shine" d="M52 59q5-7 12-7m34 7q5-7 12-7"/>
    ${crown}
    <path class="owl-beak" d="m82 91 8-10 8 10-8 13z"/>${mouth}
    <path class="owl-feather" d="M64 113q13 9 26 10 14-1 27-10"/>
    <circle class="owl-clock" cx="66" cy="133" r="20"/><circle cx="66" cy="133" r="16" fill="none" stroke="#b48b4e" stroke-width="1"/>
    <path d="M66 116v3m0 28v3m-17-17h3m28 0h3m-29-12 2 2m20 20 2 2m0-24-2 2m-20 20-2 2" stroke="#b48b4e" stroke-width="1"/>
    <path class="owl-clock-hand" d="M66 122v11l8 5"/><circle cx="66" cy="133" r="2" fill="#62472e"/>
    <g class="owl-quill">
      <path class="owl-quill-barrel" d="m24 151 126 39-3 9-127-39z"/>
      <path d="m20 160-9 1 9-10z" fill="#c7c5bc" stroke="#62472e" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="m143 188 7 2-3 9-7-2z" fill="#b9b9b4" stroke="#62472e" stroke-width="1.2"/>
      <path class="owl-quill-mark" d="m37 155-3 9m11-6-3 9"/>
    </g>
    <path class="owl-feet" d="m78 163-2 12 7 5 7-6m1-9 1 11 8 5 7-5m-28-1 7 1m13 1 7 2"/>
    <path class="owl-quill-mark" d="m77 177q7-6 13 0m5 1q8-6 14 0"/>
    ${mood === 'celebratory' ? '<g class="owl-books"><path class="owl-book" d="m14 151 20 4-2 12-20-4zm3-7 20 4-3 10-20-4z"/><path class="owl-book-page" d="m18 147 15 3m-17 5 14 3"/></g>' : ''}
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
    const imageMarkup = plan?.imageAttachmentName
      ? `<div class="task-overview-detail task-overview-detail-wide"><div class="task-overview-detail-label">添付画像</div><button class="task-overview-image" type="button" data-task-image="${escapeHTML(plan.id)}">画像を開く：${escapeHTML(plan.imageAttachmentName)}</button></div>`
      : '';

    return `<div class="task-overview-card"><article class="task-overview-row${completed ? ' is-done' : ''}"><input class="check" type="checkbox" aria-label="${escapeHTML(task.name)}を完了" data-overview-task="${escapeHTML(task.id)}"${completed ? ' checked' : ''}><div class="task-info"><button class="task-overview-trigger" type="button" data-task-detail="${escapeHTML(task.id)}" aria-expanded="${expanded}" aria-controls="${escapeHTML(detailId)}"><span class="task-overview-name">${name}</span><span class="task-overview-kind">${kind}</span></button><div class="task-meta">残り約${Number(task.remaining || 0).toFixed(Number(task.remaining || 0) % 1 ? 1 : 0)}時間 · ${fmtDate(new Date(`${task.due}T00:00:00`))}締め切り${scope}</div></div><div class="task-overview-status">${completed ? '完了' : dueText}<span class="task-overview-details-link">${expanded ? '詳細を閉じる' : '詳細を見る'}</span></div></article><section class="task-overview-details" id="${escapeHTML(detailId)}" aria-label="${escapeHTML(task.name)}の詳細"${expanded ? '' : ' hidden'}>${detailMarkup}${imageMarkup}</section></div>`;
  }).join('');

  list.querySelectorAll('[data-task-detail]').forEach(element => element.addEventListener('click', () => {
    toggleTaskDetail(element.dataset.taskDetail);
  }));
  list.querySelectorAll('[data-task-image]').forEach(element => element.addEventListener('click', () => {
    openTaskImage(element.dataset.taskImage);
  }));
  list.querySelectorAll('[data-overview-task]').forEach(element => element.addEventListener('change', () => {
    const task = data.tasks.find(item => item.id === element.dataset.overviewTask);
    if (!task) return;
    task.done = element.checked;
    task.remaining = element.checked ? 0 : task.hours;
    data.sessions = data.sessions.filter(session => session.taskId !== task.id);
    save();
    if (element.checked) celebrateTaskCompletion(task.id);
    renderTasks();
    renderCalendar();
    showToast(element.checked ? '課題を完了にしました' : '課題を未完了に戻しました');
  }));
}

function renderFixedScheduleOverview() {
  const list = document.getElementById('fixedOverviewList');
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const typeNames = { class: '授業', work: 'アルバイト', personal: '個人予定' };
  const schedules = [...data.fixed].sort((left, right) =>
    Number(left.day) - Number(right.day)
      || String(left.start).localeCompare(String(right.start))
      || String(left.name).localeCompare(String(right.name))
  );
  document.getElementById('fixedOverviewSummary').textContent = `毎週の固定予定 ${schedules.length}件`;

  if (!schedules.length) {
    list.innerHTML = '<div class="empty-state">固定予定はまだありません。</div>';
    return;
  }

  list.innerHTML = schedules.map(item => {
    const day = Number(item.day);
    const dayName = Number.isInteger(day) && dayNames[day] ? dayNames[day] : '曜日未設定';
    const typeName = typeNames[item.type] || '固定予定';
    return `<article class="fixed-overview-item"><div class="fixed-overview-day">${dayName}</div><div class="fixed-overview-info"><div class="fixed-overview-name">${escapeHTML(item.name)}</div><div class="fixed-overview-meta">${escapeHTML(item.start)}〜${escapeHTML(item.end)} · ${typeName}</div></div></article>`;
  }).join('');
}

let activeTaskDetailId = null;

function toggleTaskDetail(taskId) {
  activeTaskDetailId = activeTaskDetailId === taskId ? null : taskId;
  renderTaskOverview();
}

const calendarNav = document.querySelector('.nav-item.active');

function showTaskOverview() {
  document.body.classList.remove('fixed-overview-active');
  document.getElementById('fixedOverview').hidden = true;
  document.body.classList.add('task-overview-active');
  document.getElementById('taskOverview').hidden = false;
  calendarNav.classList.remove('active');
  document.getElementById('fixedNav').classList.remove('active');
  document.getElementById('tasksNav').classList.add('active');
  renderTaskOverview();
}

function showFixedScheduleOverview() {
  document.body.classList.remove('task-overview-active');
  document.getElementById('taskOverview').hidden = true;
  document.body.classList.add('fixed-overview-active');
  document.getElementById('fixedOverview').hidden = false;
  calendarNav.classList.remove('active');
  document.getElementById('tasksNav').classList.remove('active');
  document.getElementById('fixedNav').classList.add('active');
  renderFixedScheduleOverview();
}

function showCalendarOverview() {
  document.body.classList.remove('task-overview-active');
  document.body.classList.remove('fixed-overview-active');
  document.getElementById('taskOverview').hidden = true;
  document.getElementById('fixedOverview').hidden = true;
  document.getElementById('tasksNav').classList.remove('active');
  document.getElementById('fixedNav').classList.remove('active');
  calendarNav.classList.add('active');
}

document.getElementById('tasksNav').addEventListener('click', showTaskOverview);
document.getElementById('allTasks').addEventListener('click', showTaskOverview);
document.getElementById('fixedNav').addEventListener('click', showFixedScheduleOverview);
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
  const avatar = document.getElementById('characterAvatar');
  const warning = document.getElementById('capacityPanic');
  const isRestDay = data.restDays.includes(dateKey(today));
  const capacity = getTodayCapacity();
  const priority = typeof getPriorityPlans === 'function' ? getPriorityPlans()[0] : null;
  const nextFreeGap = getUpcomingStudyGaps().find(gap => gap.minutes >= data.context.duration);
  const gapSuggestions = nextFreeGap
    ? getSmartStudySuggestions(nextFreeGap, data.context.location, data.context.fatigue, 20, data.context.mode)
    : [];
  const overdue = data.tasks.some(task => !task.done && task.due < dateKey(today));
  let mood = 'standard';
  characterSuggestedTaskName = null;

  let messageText;
  if (capacity.isOverloaded && !isRestDay) {
    mood = 'concerned';
    messageText = '今日は予定が詰まり気味。できる分だけで大丈夫、無理はしないで！';
  } else if (isRestDay) {
    mood = 'resting';
    messageText = '今日は休息の日。しっかり休んで、また明日から少しずつ。';
  } else if (overdue) {
    mood = 'concerned';
    messageText = '期限を過ぎた課題があります。まずは小さな一歩から始めましょう。';
  } else if (Date.now() < characterCelebrationUntil) {
    mood = 'celebratory';
    messageText = '課題を完了！よく頑張りました。少し休憩しましょう。';
  } else if (priority) {
    mood = 'encouraging';
    const suggestedTask = gapSuggestions[0]?.task || priority;
    characterSuggestedTaskName = suggestedTask.name;
    const time = nextFreeGap
      ? `${fmtDate(new Date(`${nextFreeGap.day}T00:00:00`))} ${formatGapTime(nextFreeGap.start)}〜${formatGapTime(nextFreeGap.end)}`
      : '次の空き時間に';
    messageText = `${time}、「${suggestedTask.name}」を進めませんか？`;
  } else {
    messageText = '今日もいいペースです。空き時間にできることから始めましょう。';
  }

  setCharacterMessage(messageText);
  setCharacterMood(mood);
  warning.hidden = !capacity.isOverloaded || isRestDay;
  warning.textContent = `⚠️ 今日は無理しないで！ 空き ${capacity.availableMinutes}分 · 期限が近い課題 ${capacity.demandMinutes}分`;
  updateStudyTimer();
}

function setCharacterMood(mood) {
  const avatar = document.getElementById('characterAvatar');
  avatar.innerHTML = getOwlMarkup(mood);
  avatar.setAttribute('aria-label', `TASKROU、${{
    standard: '通常',
    encouraging: '応援',
    focused: '気合十分',
    concerned: '心配',
    resting: '休息',
    celebratory: 'お祝い'
  }[mood]}の表情`);
}

function respondToSuggestion(choice) {
  if (choice === 'accept') {
    setCharacterMood('focused');
    setCharacterMessage(characterSuggestedTaskName
      ? `いいね！「${characterSuggestedTaskName}」に取り組もう。気合十分、できるところから始めよう！`
      : 'いいね！やる気が出たね。取り組みたい課題を選んで始めよう！');
    return;
  }

  if (choice === 'decline') {
    setCharacterMood('resting');
    setCharacterMessage('わかった！今は無理せずひと休みしよう。課題はそのまま残しておくね。');
    return;
  }

  const alternative = getPriorityPlans().find(plan => plan.name !== characterSuggestedTaskName);
  setCharacterMood('encouraging');
  if (!alternative) {
    setCharacterMessage('今は他におすすめできる課題がないみたい。別の課題を登録したら一緒に考えるね。');
    return;
  }

  characterSuggestedTaskName = alternative.name;
  setCharacterMessage(`もちろん！では「${alternative.name}」を進めてみるのはどう？`);
}

document.getElementById('acceptSuggestion').addEventListener('click', () => respondToSuggestion('accept'));
document.getElementById('declineSuggestion').addEventListener('click', () => respondToSuggestion('decline'));
document.getElementById('chooseOtherTask').addEventListener('click', () => respondToSuggestion('other'));

function getCharacterConsultationReply(question) {
  if (/疲れ|しんど|眠い|休みたい/.test(question)) {
    return '疲れているなら、まず短く休憩して大丈夫です。無理のないペースで進めましょう。';
  }

  const plans = getPriorityPlans();
  const normalizedQuestion = question.toLocaleLowerCase();
  const plan = plans.find(item => normalizedQuestion.includes(item.name.toLocaleLowerCase())) || plans[0];
  if (!plan) return '未完了の課題はありません。次の予定を確認して、必要なら新しい課題を登録しましょう。';

  const tasks = data.tasks.filter(task =>
    plan.legacyTaskId ? task.id === plan.legacyTaskId : task.planId === plan.id
  );
  const remaining = tasks.reduce((sum, task) => sum + Number(task.remaining || 0), 0);
  const due = fmtDate(new Date(`${plan.due}T00:00:00`));
  const nextGap = getUpcomingStudyGaps(new Date(), 1).find(gap => gap.minutes >= 20);
  const freeTime = nextGap
    ? `今日の${formatGapTime(nextGap.start)}〜${formatGapTime(nextGap.end)}`
    : '次の空き時間';
  const hasSpecificPlan = normalizedQuestion.includes(plan.name.toLocaleLowerCase());
  const lead = hasSpecificPlan ? `「${plan.name}」ですね。` : `課題と締切から見ると「${plan.name}」がおすすめです。`;

  return `${lead}締切は${due}、残りは約${remaining.toFixed(remaining % 1 ? 1 : 0)}時間です。${freeTime}に、まず20分だけ最初の作業を進めてみましょう。`;
}

document.getElementById('characterChatForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('characterChatInput');
  const question = input.value.trim();
  if (!question) {
    input.focus();
    return;
  }

  const history = document.getElementById('characterChatHistory');
  const reply = getCharacterConsultationReply(question);
  history.innerHTML += `<div class="character-chat-entry user"><span class="character-chat-speaker">あなた</span>${escapeHTML(question)}</div><div class="character-chat-entry assistant"><span class="character-chat-speaker">TASKROU</span>${escapeHTML(reply)}</div>`;
  history.scrollTop = history.scrollHeight;
  input.value = '';
  input.focus();
});

function startTwentyMinuteTask() {
  if (data.restDays.includes(dateKey(today))) {
    showToast('今日は休息日です。先に休息を取り消してください');
    return false;
  }
  if (data.activeTimer && getStudyTimerRemaining(data.activeTimer) > 0) {
    showToast('現在の集中タイマーが終わってから始めてください');
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
  const added = addStudySuggestionSession(suggestions[0].task, gap, suggestions[0].minutes);
  if (!added) return false;
  const session = data.sessions.at(-1);
  const startedAt = Date.now();
  data.activeTimer = {
    sessionId: session.id,
    taskId: session.taskId,
    startedAt,
    endsAt: startedAt + durationHours(session.start, session.end) * 60 * 60 * 1000
  };
  save();
  renderCharacterStation();
  updateStudyTimer();
  showToast('集中タイマーを開始しました');
  return true;
}

document.getElementById('taskFab').addEventListener('click', () => {
  openModal();
  syncEventScheduleFields();
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

const toggleSessionWithTimer = toggleSession;
toggleSession = id => {
  const session = data.sessions.find(item => item.id === id);
  const wasDone = session?.done;
  toggleSessionWithTimer(id);
  const task = session && data.tasks.find(item => item.id === session.taskId);
  if (session?.done && !wasDone && task && (task.done || task.remaining <= 0)) celebrateTaskCompletion(task.id);
  else if (!session?.done && data.activeTimer?.sessionId === id) {
    data.activeTimer = null;
    save();
    updateStudyTimer();
    renderCharacterStation();
  }
};

setInterval(updateStudyTimer, 1000);
updateStudyTimer();
renderCalendar();
renderTasks();
