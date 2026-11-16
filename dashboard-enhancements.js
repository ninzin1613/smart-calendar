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
      <div class="character-title" id="characterStationTitle"><span class="character-brand">TASKROU · AI STUDY COMPANION</span></div>
      <div class="character-tabs" role="tablist" aria-label="タスクロウ表示切り替え">
        <button class="character-tab active" type="button" role="tab" aria-selected="true" data-character-tab="chat">💬 会話<span class="character-tab-dot" id="characterChatDot" hidden></span></button>
        <button class="character-tab" type="button" role="tab" aria-selected="false" data-character-tab="plan">📖 学習プラン</button>
        <button class="character-tab" type="button" role="tab" aria-selected="false" data-character-tab="deadlines">⏰ 締め切り</button>
      </div>
      <div class="character-tab-panel" id="characterTabChat">
        <div class="character-bubble" id="characterMessage" role="status" aria-live="polite"></div>
        <div class="character-actions character-plan-actions" role="group" aria-label="学習計画">
          <button class="primary-btn" type="button" id="recalculateStudyPlan">計画を再計算（予定がずれた）</button>
          <button class="secondary-btn" type="button" id="restToday">今日は休む</button>
        </div>
        <div class="character-actions" id="characterChoices" role="group" aria-label="タスクロウへの返答" aria-live="polite">
          <button class="primary-btn" type="button" id="characterChoiceOne"></button>
          <button class="secondary-btn" type="button" id="characterChoiceTwo"></button>
          <button class="secondary-btn" type="button" id="characterChoiceThree"></button>
        </div>
        <div class="character-timer" id="studyTimerReadout" role="timer" aria-live="polite" hidden></div>
      </div>
      <div class="character-tab-panel" id="characterTabPlan" hidden>
        <p class="character-tab-guide">空き時間から最適な学習計画を提案するよ！</p>
        <div class="character-plan-bar">
          <label class="character-plan-toggle"><input type="checkbox" id="toggleStudyBlocksCalendar" checked> カレンダー表示 ON/OFF</label>
        </div>
        <div class="character-plan-list" id="characterPlanList"></div>
      </div>
      <div class="character-tab-panel" id="characterTabDeadlines" hidden>
        <p class="character-tab-guide">7日以内の締め切りが近い課題はこれだよ！</p>
        <div class="character-deadline-list" id="characterDeadlineList"></div>
      </div>
    </div>
    <div class="character-missions" hidden>
      <div class="character-missions-title">今日のミッション <span>最大3件</span></div>
      <ol class="character-mission-list" id="todayMissionList"></ol>
    </div>
    <div class="capacity-panic" id="capacityPanic" role="status" hidden></div>
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
        <div class="eyebrow">SCHEDULES</div>
        <h1 id="fixedOverviewTitle">予定一覧</h1>
        <div class="task-overview-summary" id="fixedOverviewSummary"></div>
      </div>
    </div>
    <div class="schedule-filter-bar" id="scheduleFilterBar">
      <label class="schedule-filter-field">
        <span>種別</span>
        <select id="scheduleRepeatFilter" aria-label="予定の繰り返しで絞り込み">
          <option value="all">すべて</option>
          <option value="fixed">毎週固定のみ</option>
          <option value="once">単発の予定のみ</option>
        </select>
      </label>
      <label class="schedule-filter-field">
        <span>種類</span>
        <select id="scheduleCategoryFilter" aria-label="予定の種類で絞り込み">
          <option value="all">すべての種類</option>
        </select>
      </label>
      <label class="schedule-filter-field">
        <span>並び替え</span>
        <select id="scheduleSortOrder" aria-label="予定の並び替え">
          <option value="nearest">日付・曜日が近い順</option>
          <option value="newest">登録が新しい順</option>
        </select>
      </label>
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
.character-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 9px; }
.character-tab { position: relative; display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 11px; border: 1px solid #dce5d7; border-radius: 999px; background: #f6f8f3; color: #5b6855; font-size: 10px; font-weight: 700; }
.character-tab.active { border-color: var(--green-dark); background: var(--green-dark); color: #fff; }
.character-tab-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--coral); display: inline-block; }
.character-tab-dot[hidden] { display: none; }
.character-tab-panel[hidden] { display: none; }
.character-tab-guide { margin: 0 0 8px; padding: 6px 10px; border-radius: 8px; background: #f2f5ed; color: #465742; font-size: 11px; font-weight: 700; }
.character-plan-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.character-plan-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #4e5e49; cursor: pointer; }
.character-plan-toggle input { accent-color: var(--green-dark); }
.character-plan-list, .character-deadline-list { display: grid; gap: 6px; }
.character-deadline-list { max-height: 174px; overflow-y: auto; padding-right: 4px; }
.character-plan-item, .character-deadline-item { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 8px 10px; border: 1px solid #e4ebe0; border-radius: 8px; background: #fff; }
.character-plan-info, .character-deadline-info { min-width: 0; flex: 1; }
.character-plan-name, .character-deadline-name { font-size: 11px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.character-plan-meta, .character-deadline-meta { font-size: 9px; color: #798577; margin-top: 2px; }
.character-plan-btns { display: flex; gap: 5px; flex: 0 0 auto; }
.character-plan-btns button { height: 26px; padding: 0 8px; font-size: 10px; }
.character-deadline-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: #eef3ea; color: #4d6b3c; white-space: nowrap; }
.character-deadline-item.is-urgent { border-color: #f0bfb4; background: #fff7f5; }
.character-deadline-item.is-urgent .character-deadline-badge { background: #fde6e1; color: #c44434; }
.character-empty-tab { font-size: 10px; color: #798577; padding: 6px 2px; }
.calendar-grid .event.study-plan-block { background: rgba(139, 207, 120, 0.14) !important; border: 1.5px dashed #7aa866 !important; border-left: 3px dashed #557442 !important; color: #3d5a32 !important; }
.calendar-grid .event.study-plan-block .event-title::before { content: "📖 "; }
body.hide-study-blocks .calendar-grid .event.study-plan-block { display: none !important; }
.character-message { flex: 1; min-width: 0; }
.character-bubble { position: relative; width: fit-content; max-width: 100%; padding: 8px 11px; border-radius: 4px 11px 11px; background: #f2f5ed; font-size: 12px; line-height: 1.5; }
.character-bubble::before { position: absolute; top: 10px; left: -6px; border-width: 6px 6px 6px 0; border-style: solid; border-color: transparent #f2f5ed transparent transparent; content: ""; }
.character-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
.character-actions[hidden] { display: none; }
.character-actions button { min-height: 31px; height: auto; padding: 6px 10px; font-size: 10px; }
.character-actions .primary-btn { background: var(--green-dark); box-shadow: none; }
.character-plan-actions button { min-height: 36px; }
.character-missions { flex: 1 1 230px; min-width: 210px; padding: 10px 12px; border: 1px solid #e6e8dd; border-radius: 9px; background: rgba(255,255,255,.72); }
.character-missions[hidden] { display: none !important; }
.character-missions-title { display: flex; justify-content: space-between; gap: 8px; color: #536447; font-size: 11px; font-weight: 700; }
.character-missions-title span { color: #92978d; font-size: 9px; font-weight: 500; }
.character-mission-list { display: grid; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.character-mission-item { display: flex; align-items: flex-start; gap: 7px; font-size: 10px; line-height: 1.45; }
.character-mission-item input { flex: 0 0 auto; margin: 2px 0 0; accent-color: #70885d; }
.character-mission-meta { display: block; color: #898f84; font-size: 9px; }
.character-missions-empty { margin: 8px 0 0; color: #828b81; font-size: 10px; }
.capacity-panic { flex: 0 0 auto; max-width: 230px; padding: 8px 10px; border-radius: 7px; background: #fff1eb; color: #a64e3c; font-size: 10px; font-weight: 700; }
.capacity-panic[hidden] { display: none; }
.task-fab { position: fixed; right: 24px; bottom: 24px; z-index: 9; display: flex; align-items: center; gap: 7px; min-height: 48px; padding: 0 17px; border: 0; border-radius: 25px; background: var(--coral); color: white; box-shadow: 0 5px 16px rgba(80, 52, 40, .25); font-size: 15px; font-weight: 700; }
.task-fab:hover { background: #e85e52; transform: translateY(-1px); }
.task-fab span { font-size: 11px; }
.calendar-grid .event.ai-study, .calendar-grid .event.ai-generated { border: 1px dashed #d99054; border-left: 4px solid #d99054; background: #fff7e8; color: #765021; }
.calendar-grid .ai-badge { display: inline-block; margin-right: 4px; padding: 1px 3px; border-radius: 3px; background: #d99054; color: white; font-size: 8px; vertical-align: 1px; }
.calendar-grid .ai-progress { margin-top: 3px; font-size: 8px; }
.calendar-grid .ai-progress-track { height: 3px; margin-top: 2px; overflow: hidden; border-radius: 2px; background: rgba(118, 80, 33, .18); }
.calendar-grid .ai-progress-fill { height: 100%; background: #d99054; }
.calendar-grid .day-head.has-deadline strong { color: #b65040; }
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
.schedule-filter-bar { display: flex; flex-wrap: wrap; gap: 10px; max-width: 860px; margin-bottom: 12px; padding: 10px 12px; border: 1px solid #e4ebf4; border-radius: 10px; background: #fbfdff; }
.schedule-filter-field { display: grid; gap: 4px; flex: 1 1 160px; min-width: 140px; }
.schedule-filter-field span { font-size: 10px; font-weight: 700; color: #6c7a89; }
.schedule-filter-field select { height: 34px; border: 1px solid #d8e3ef; border-radius: 7px; padding: 0 8px; background: #fff; color: var(--ink); font-size: 12px; font-weight: 600; }
.fixed-overview-list { display: grid; gap: 9px; max-width: 860px; }
.fixed-overview-item { display: flex; align-items: center; gap: 13px; min-height: 64px; padding: 11px 14px; border: 1px solid #e4ebf4; border-radius: 8px; background: var(--white); cursor: pointer; transition: background .15s ease, border-color .15s ease; }
.fixed-overview-item:hover { background: #f6f9fe; border-color: #c7d7eb; }
.fixed-overview-item:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.fixed-overview-day { flex: 0 0 92px; color: var(--green-dark); font-size: 11px; font-weight: 700; }
.fixed-overview-info { display: grid; gap: 4px; min-width: 0; flex: 1; }
.fixed-overview-name { overflow-wrap: anywhere; font-size: 12px; font-weight: 700; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.fixed-overview-badge { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 999px; background: #eef3f8; color: #54667a; }
.fixed-overview-badge.is-once { background: #fff3e6; color: #a65c1b; }
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
let characterCelebrationMessage = '';
let characterSuggestedTaskName = null;
let characterDialogue = { step: 'suggestion', taskName: null, gap: null };

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
  characterCelebrationMessage = '課題を完了！よく頑張りました。次の予定を一緒に確認しようか？';
  renderCharacterStation();
  setTimeout(() => {
    characterCelebrationUntil = 0;
    characterCelebrationMessage = '';
    renderCharacterStation();
  }, 2600);
}

function setCharacterMessage(text) {
  const message = document.getElementById('characterMessage');
  if (!message) return;
  const nickname = String(data.settings?.nickname || '').trim();
  const formatted = nickname && text && !text.startsWith(`${nickname}さん`)
    ? `${nickname}さん、${text}`
    : text;
  if (message.textContent === formatted) return;
  message.textContent = formatted;
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
  const openCount = tasks.filter(task => !task.done && (Number(task.hours || 0) === 0 || task.remaining > 0)).length;
  document.getElementById('taskOverviewSummary').textContent =
    `${openCount}件が未完了 · 全${tasks.length}件`;

  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state">課題・テストはまだありません。</div>';
    return;
  }

  list.innerHTML = tasks.map(task => {
    const plan = task.planId && data.plans.find(item => item.id === task.planId);
    const completed = Boolean(task.done || (Number(task.hours || 0) > 0 && task.remaining <= 0));
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
      if (plan.workloadKnown !== false) details.push(['課題量', `${Number(plan.workload)}${workloadUnit}`]);
    }
    if (plan?.kind === 'exam' || task.scope) details.push(['テスト範囲', task.scope || plan.scope || '未設定']);
    if (task.phase) {
      const phaseHours = Number(task.hours || 0);
      details.push(['この小タスク', `${task.phase} · 約${phaseHours.toFixed(phaseHours % 1 ? 1 : 0)}時間`]);
    }
    const detailMarkup = details.map(([label, value]) =>
      `<div class="task-overview-detail${label === 'テスト範囲' || label === 'この小タスク' ? ' task-overview-detail-wide' : ''}"><div class="task-overview-detail-label">${label}</div><div class="task-overview-detail-value">${escapeHTML(String(value))}</div></div>`
    ).join('');
    const editMarkup = `<div class="task-overview-detail task-overview-detail-wide"><button class="secondary-btn task-overview-edit" type="button" data-task-edit="${escapeHTML(task.id)}">変更する（編集）</button> <button class="secondary-btn task-overview-autoplan" type="button" data-task-autoplan="${escapeHTML(task.id)}">AI学習計画を作成</button></div>`;
    const imageMarkup = plan?.imageAttachmentName
      ? `<div class="task-overview-detail task-overview-detail-wide"><div class="task-overview-detail-label">添付画像</div><button class="task-overview-image" type="button" data-task-image="${escapeHTML(plan.id)}">画像を開く：${escapeHTML(plan.imageAttachmentName)}</button></div>`
      : '';

    return `<div class="task-overview-card"><article class="task-overview-row${completed ? ' is-done' : ''}"><input class="check" type="checkbox" aria-label="${escapeHTML(task.name)}を完了" data-overview-task="${escapeHTML(task.id)}"${completed ? ' checked' : ''}><div class="task-info"><button class="task-overview-trigger" type="button" data-task-detail="${escapeHTML(task.id)}" aria-expanded="${expanded}" aria-controls="${escapeHTML(detailId)}"><span class="task-overview-name">${name}</span><span class="task-overview-kind">${kind}</span></button><div class="task-meta">残り約${Number(task.remaining || 0).toFixed(Number(task.remaining || 0) % 1 ? 1 : 0)}時間 · ${fmtDate(new Date(`${task.due}T00:00:00`))}締め切り${scope}</div></div><div class="task-overview-status">${completed ? '完了' : dueText}<span class="task-overview-details-link">${expanded ? '詳細を閉じる' : '詳細を見る'}</span></div></article><section class="task-overview-details" id="${escapeHTML(detailId)}" aria-label="${escapeHTML(task.name)}の詳細"${expanded ? '' : ' hidden'}>${detailMarkup}${imageMarkup}${editMarkup}</section></div>`;
  }).join('');

  list.querySelectorAll('[data-task-detail]').forEach(element => element.addEventListener('click', () => {
    toggleTaskDetail(element.dataset.taskDetail);
  }));
  list.querySelectorAll('[data-task-edit]').forEach(element => element.addEventListener('click', () => {
    if (typeof openSmartEntryEditor === 'function') {
      openSmartEntryEditor({ source: 'task', id: element.dataset.taskEdit });
      document.getElementById('modalBackdrop').classList.add('open');
    }
  }));
  list.querySelectorAll('[data-task-autoplan]').forEach(element => element.addEventListener('click', () => {
    if (typeof autoScheduleTaskInFreeTime === 'function') {
      const placed = autoScheduleTaskInFreeTime(element.dataset.taskAutoplan, { announce: true });
      renderTaskOverview();
      showToast(placed ? `${placed}コマの学習計画を配置しました` : '配置できる空き時間が見つかりませんでした');
    }
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

function syncScheduleCategoryFilterOptions() {
  const select = document.getElementById('scheduleCategoryFilter');
  if (!select) return;
  const current = select.value || 'all';
  const customCats = Array.isArray(data?.settings?.customCategories) ? data.settings.customCategories : [];
  const options = [
    { value: 'all', label: 'すべての種類' },
    { value: 'class', label: '授業' },
    { value: 'work', label: 'アルバイト' },
    { value: 'club', label: 'サークル・部活' },
    { value: 'personal', label: '個人予定' },
    ...customCats.map(cat => ({ value: cat.id, label: cat.name }))
  ];
  select.innerHTML = options.map(opt => `<option value="${escapeHTML(opt.value)}">${escapeHTML(opt.label)}</option>`).join('');
  select.value = options.some(opt => opt.value === current) ? current : 'all';
}

function getScheduleCreatedOrder(item, fallbackIndex) {
  if (item.createdAt) {
    const t = new Date(item.createdAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  const match = String(item.id || '').match(/(\d{10,})/);
  if (match) return Number(match[1]);
  return fallbackIndex;
}

function renderFixedScheduleOverview() {
  const list = document.getElementById('fixedOverviewList');
  if (!list) return;
  syncScheduleCategoryFilterOptions();

  const repeatFilter = document.getElementById('scheduleRepeatFilter')?.value || 'all';
  const categoryFilter = document.getElementById('scheduleCategoryFilter')?.value || 'all';
  const sortOrder = document.getElementById('scheduleSortOrder')?.value || 'nearest';

  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const todayKey = dateKey(today);
  const todayDow = today.getDay();

  const fixedEntries = (Array.isArray(data.fixed) ? data.fixed : []).map((item, idx) => {
    const day = Number(item.day);
    const offset = Number.isInteger(day) ? (day - todayDow + 7) % 7 : 99;
    const nextKey = Number.isInteger(day) ? dateKey(addDays(today, offset)) : '9999-99-99';
    return {
      item,
      kind: 'fixed',
      dayLabel: Number.isInteger(day) && dayNames[day] ? `毎週 ${dayNames[day]}` : '曜日未設定',
      badgeLabel: '毎週固定',
      sortDate: nextKey,
      isPast: false,
      createdOrder: getScheduleCreatedOrder(item, idx)
    };
  });

  const extraEntries = (Array.isArray(data.extras) ? data.extras : []).map((item, idx) => {
    const d = new Date(`${item.day}T00:00:00`);
    const validDate = !Number.isNaN(d.getTime());
    const dateLabel = validDate ? `${fmtDate(d)}（${weekNames[d.getDay()]}）` : escapeHTML(item.day || '');
    return {
      item,
      kind: 'once',
      dayLabel: dateLabel,
      badgeLabel: '単発',
      sortDate: item.day || '9999-99-99',
      isPast: Boolean(item.day && item.day < todayKey),
      createdOrder: getScheduleCreatedOrder(item, fixedEntries.length + idx)
    };
  });

  const allEntries = [...fixedEntries, ...extraEntries];
  const filtered = allEntries.filter(entry => {
    if (repeatFilter !== 'all' && entry.kind !== repeatFilter) return false;
    if (categoryFilter !== 'all' && (entry.item.type || 'personal') !== categoryFilter) return false;
    return true;
  });

  filtered.sort((left, right) => {
    if (sortOrder === 'newest') {
      return right.createdOrder - left.createdOrder
        || String(left.item.name).localeCompare(String(right.item.name));
    }
    return Number(left.isPast) - Number(right.isPast)
      || String(left.sortDate).localeCompare(String(right.sortDate))
      || String(left.item.start).localeCompare(String(right.item.start))
      || String(left.item.name).localeCompare(String(right.item.name));
  });

  document.getElementById('fixedOverviewSummary').textContent =
    `毎週の固定予定 ${fixedEntries.length}件 · 単発の予定 ${extraEntries.length}件（表示 ${filtered.length}件）`;

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">条件に一致する予定はありません。</div>';
    return;
  }

  list.innerHTML = filtered.map(entry => {
    const { item, kind, dayLabel, badgeLabel } = entry;
    const source = kind === 'fixed' ? 'fixed' : 'extras';
    const typeName = typeof getCategoryLabelByKey === 'function'
      ? getCategoryLabelByKey(item.type)
      : ({ class: '授業', work: 'アルバイト', club: 'サークル・部活', personal: '個人予定' }[item.type] || '予定');
    return `<article class="fixed-overview-item" role="button" tabindex="0" data-schedule-source="${source}" data-schedule-id="${escapeHTML(item.id)}" aria-label="${escapeHTML(item.name)}の詳細を表示">
      <div class="fixed-overview-day">${escapeHTML(dayLabel)}</div>
      <div class="fixed-overview-info">
        <div class="fixed-overview-name"><span>${escapeHTML(item.name)}</span><span class="fixed-overview-badge${kind === 'once' ? ' is-once' : ''}">${badgeLabel}</span></div>
        <div class="fixed-overview-meta">${escapeHTML(item.start)}〜${escapeHTML(item.end)} · ${escapeHTML(typeName)}</div>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-schedule-id]').forEach(card => {
    const open = () => {
      if (typeof openEventDetails === 'function') {
        openEventDetails(card.dataset.scheduleSource, card.dataset.scheduleId);
      }
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
  });
}

['scheduleRepeatFilter', 'scheduleCategoryFilter', 'scheduleSortOrder'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', renderFixedScheduleOverview);
});

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

let characterAnnouncementText = '';
let characterAnnouncementUntil = 0;

function announceTaskrouStudyPlan(text) {
  characterAnnouncementText = text;
  characterAnnouncementUntil = Date.now() + 8000;
  characterDialogue.step = 'announcement';
  characterDialogue.mood = 'encouraging';
  setCharacterMood('encouraging');
  setCharacterMessage(text);
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
  const slipped = typeof getSlippedStudySessions === 'function' ? getSlippedStudySessions(new Date()) : [];
  let mood = 'standard';
  characterSuggestedTaskName = null;

  let messageText;
  const initialSteps = ['suggestion', 'overloaded', 'rest-day', 'overdue', 'slipped', 'announcement', 'celebration', 'no-tasks'];
  const plans = typeof getPriorityPlans === 'function' ? getPriorityPlans() : [];
  const currentDialogueTaskExists = !characterDialogue.taskName
    || plans.some(plan => plan.name === characterDialogue.taskName);
  if (initialSteps.includes(characterDialogue.step) || !currentDialogueTaskExists) {
    const suggestedTask = priority && (gapSuggestions[0]?.task || priority);
    characterDialogue = { step: 'suggestion', taskName: suggestedTask?.name || null, gap: nextFreeGap || null };
    characterSuggestedTaskName = suggestedTask?.name || null;

    if (Date.now() < characterAnnouncementUntil && characterAnnouncementText) {
      characterDialogue.step = 'announcement';
      mood = 'encouraging';
      messageText = characterAnnouncementText;
    } else if (capacity.isOverloaded && !isRestDay) {
      characterDialogue.step = 'overloaded';
      mood = 'concerned';
      messageText = '今日は予定が詰まり気味。空き時間を確認して、無理のない計画にしよう！';
    } else if (isRestDay) {
      characterDialogue.step = 'rest-day';
      mood = 'resting';
      messageText = '今日は休息の日。明日の予定を先に確認しておく？';
    } else if (slipped.length && !isRestDay) {
      characterDialogue.step = 'slipped';
      mood = 'concerned';
      messageText = '学習予定が少しズレちゃったみたいだね。締め切りに間に合うように、これからの空き時間で計画を組み直そうか？';
    } else if (overdue) {
      characterDialogue.step = 'overdue';
      mood = 'concerned';
      messageText = '期限を過ぎた課題があるね。今日の予定を見て、進められる時間を探そう。';
    } else if (Date.now() < characterCelebrationUntil) {
      characterDialogue.step = 'celebration';
      mood = 'celebratory';
      messageText = characterCelebrationMessage || '課題を完了！よく頑張りました。次の予定を一緒に確認しようか？';
    } else if (suggestedTask) {
      mood = 'encouraging';
      messageText = getInitialScheduleMessage(suggestedTask, nextFreeGap);
    } else {
      characterDialogue.step = 'no-tasks';
      messageText = pickCharacterPhrase([
        'まだ課題が入っていないみたい！まずは課題を追加してみようか？',
        '今週は空き時間がたっぷりあるね！調子はどう？',
        '何か手伝うことはある？予定の確認や学習の相談、なんでも聞くよ！'
      ]);
    }
  } else {
    characterSuggestedTaskName = characterDialogue.taskName;
    mood = characterDialogue.mood || 'standard';
    messageText = document.getElementById('characterMessage').textContent;
  }

  setCharacterMessage(messageText);
  setCharacterMood(mood);
  renderCharacterChoices();
  renderTodayMissions();
  warning.hidden = !capacity.isOverloaded || isRestDay;
  warning.textContent = `⚠️ 今日は無理しないで！ 空き ${capacity.availableMinutes}分 · 期限が近い課題 ${capacity.demandMinutes}分`;
  const planActionsEl = document.querySelector('.character-plan-actions');
  if (planActionsEl) planActionsEl.hidden = slipped.length === 0;
  const chatDot = document.getElementById('characterChatDot');
  if (chatDot) {
    chatDot.hidden = !(slipped.length > 0 || Date.now() < characterAnnouncementUntil);
  }
  renderCharacterPlanTab();
  renderCharacterDeadlineTab();
  updateStudyTimer();
}

let activeCharacterTab = 'chat';

function setCharacterTab(tabName) {
  activeCharacterTab = ['chat', 'plan', 'deadlines'].includes(tabName) ? tabName : 'chat';
  document.querySelectorAll('[data-character-tab]').forEach(btn => {
    const active = btn.dataset.characterTab === activeCharacterTab;
    if (active) btn.classList.add('active');
    else btn.classList.remove('active');
    btn.setAttribute('aria-selected', String(active));
  });
  const chatPanel = document.getElementById('characterTabChat');
  const planPanel = document.getElementById('characterTabPlan');
  const deadlinePanel = document.getElementById('characterTabDeadlines');
  if (chatPanel) chatPanel.hidden = activeCharacterTab !== 'chat';
  if (planPanel) planPanel.hidden = activeCharacterTab !== 'plan';
  if (deadlinePanel) deadlinePanel.hidden = activeCharacterTab !== 'deadlines';
}

function renderCharacterPlanTab() {
  const list = document.getElementById('characterPlanList');
  const toggle = document.getElementById('toggleStudyBlocksCalendar');
  const showBlocks = data.settings?.showStudyBlocksOnCalendar !== false;
  if (toggle) toggle.checked = showBlocks;
  if (!list) return;

  const todayKey = dateKey(today);
  const upcoming = data.sessions
    .filter(s => !s.done && s.type === 'study' && (/^【学習】/.test(s.name) || Number(s.allocatedHours || 0) > 0) && s.day >= todayKey)
    .sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start))
    .slice(0, 4);

  if (!upcoming.length) {
    list.innerHTML = '<div class="character-empty-tab">予定されている学習プランはありません。</div>';
    return;
  }

  list.innerHTML = upcoming.map(session => {
    const d = new Date(`${session.day}T00:00:00`);
    return `<div class="character-plan-item">
      <div class="character-plan-info">
        <div class="character-plan-name">${escapeHTML(session.name)}</div>
        <div class="character-plan-meta">${fmtDate(d)}（${weekNames[d.getDay()]}） ${escapeHTML(session.start)}〜${escapeHTML(session.end)}</div>
      </div>
      <div class="character-plan-btns">
        <button class="secondary-btn" type="button" data-plan-complete="${escapeHTML(session.id)}">✓ 完了</button>
        <button class="secondary-btn" type="button" data-plan-defer="${escapeHTML(session.id)}">↻ 別の日に回す</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-plan-complete]').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleSession(btn.dataset.planComplete);
      renderCharacterStation();
    });
  });
  list.querySelectorAll('[data-plan-defer]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof deferStudySessionToNextGap === 'function') {
        const moved = deferStudySessionToNextGap(btn.dataset.planDefer, new Date());
        renderCharacterStation();
        showToast(moved ? '次の空き時間へ移動しました' : '移動できる空き時間が見つかりませんでした');
      }
    });
  });
}

function formatDeadlineRemaining(due, dueTime, now = new Date()) {
  const timeStr = /^\d{2}:\d{2}$/.test(dueTime || '') ? dueTime : '23:59';
  const target = new Date(`${due}T${timeStr}:00`);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return { text: '期限超過', urgent: true };
  const totalHours = Math.floor(diffMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const text = days > 0 ? `あと${days}日${hours}時間` : `あと${Math.max(1, hours)}時間`;
  return { text, urgent: diffMs <= 24 * 60 * 60 * 1000 };
}

function renderCharacterDeadlineTab() {
  const list = document.getElementById('characterDeadlineList');
  if (!list) return;
  const horizonKey = dateKey(addDays(today, 7));
  const openTasks = data.tasks
    .filter(task => !task.done && task.due <= horizonKey)
    .sort((a, b) => a.due.localeCompare(b.due) || String(a.dueTime || '').localeCompare(String(b.dueTime || '')));

  if (!openTasks.length) {
    list.innerHTML = '<div class="character-empty-tab">7日以内の未完了の課題・テストはありません。</div>';
    return;
  }

  const now = new Date();
  list.innerHTML = openTasks.map(task => {
    const rem = formatDeadlineRemaining(task.due, task.dueTime, now);
    const d = new Date(`${task.due}T00:00:00`);
    const timeText = task.dueTime ? ` ${escapeHTML(task.dueTime)}` : '';
    return `<div class="character-deadline-item${rem.urgent ? ' is-urgent' : ''}">
      <div class="character-deadline-info">
        <div class="character-deadline-name">${escapeHTML(task.name)}</div>
        <div class="character-deadline-meta">${fmtDate(d)}（${weekNames[d.getDay()]}）${timeText}</div>
      </div>
      <span class="character-deadline-badge">${rem.text}</span>
    </div>`;
  }).join('');
}

document.querySelectorAll('[data-character-tab]').forEach(btn => {
  btn.addEventListener('click', () => setCharacterTab(btn.dataset.characterTab));
});

const toggleStudyBlocksEl = document.getElementById('toggleStudyBlocksCalendar');
if (toggleStudyBlocksEl) {
  toggleStudyBlocksEl.addEventListener('change', () => {
    const settings = ensureUserSettings();
    settings.showStudyBlocksOnCalendar = toggleStudyBlocksEl.checked;
    save();
    applyUserSettings();
  });
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

function pickCharacterPhrase(phrases) {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

function getInitialScheduleMessage(task, gap) {
  const time = gap
    ? `${fmtDate(new Date(`${gap.day}T00:00:00`))} ${formatGapTime(gap.start)}〜${formatGapTime(gap.end)}`
    : '次の空き時間';
  return pickCharacterPhrase([
    `${time}は空いているよ。「${task.name}」を進めてみる？`,
    `${time}に「${task.name}」を進めるのはどうかな？`,
    `次に空いている${time}を使って「${task.name}」を進めてみようか？`
  ]);
}

function getCharacterDialogueOptions() {
  const options = {
    suggestion: [
      { label: 'この時間に進める', action: 'accept' },
      { label: '別の時間を探す', action: 'other-time' },
      { label: '今日の予定を見る', action: 'today' }
    ],
    accepted: [
      { label: '今日の予定を確認', action: 'today' },
      { label: '別の時間を探す', action: 'other-time' },
      { label: '別の課題を見る', action: 'other-task' }
    ],
    'other-time': [
      { label: 'この時間がよさそう', action: 'accept' },
      { label: 'もう一つ探す', action: 'other-time' },
      { label: '今日の予定を見る', action: 'today' }
    ],
    'other-task': [
      { label: 'この課題にする', action: 'accept' },
      { label: '別の課題を見る', action: 'other-task' },
      { label: '今日の予定を見る', action: 'today' }
    ],
    today: [
      { label: '空き時間を探す', action: 'other-time' },
      { label: '締切が近い課題を見る', action: 'deadline' },
      { label: '今日は休む', action: 'rest' }
    ],
    deadline: [
      { label: 'この課題を進める', action: 'accept' },
      { label: '別の時間を探す', action: 'other-time' },
      { label: '今日の予定を見る', action: 'today' }
    ],
    rest: [
      { label: '明日の予定を見る', action: 'tomorrow' },
      { label: '空き時間を探す', action: 'other-time' },
      { label: '最初の提案に戻る', action: 'restart' }
    ],
    'no-tasks': [
      { label: '課題を追加する', action: 'open-smart-input' },
      { label: '調子を話す', action: 'check-mood' },
      { label: '今日の予定を見る', action: 'today' }
    ],
    'check-mood': [
      { label: '最高！やる気ある', action: 'mood-great' },
      { label: 'まあまあかな', action: 'mood-ok' },
      { label: 'ちょっと疲れ気味…', action: 'mood-tired' }
    ],
    'mood-great': [
      { label: '課題を追加する', action: 'open-smart-input' },
      { label: '学習プランを見る', action: 'open-plan-tab' },
      { label: '集中のコツを聞く', action: 'study-tip' }
    ],
    'mood-ok': [
      { label: '20分だけ集中する', action: 'start-focus-timer' },
      { label: '雑談する', action: 'small-talk' },
      { label: '今日の予定を見る', action: 'today' }
    ],
    'mood-tired': [
      { label: '今日は休む', action: 'rest' },
      { label: '明日の予定を見る', action: 'tomorrow' },
      { label: '応援してほしい', action: 'encourage' }
    ],
    encourage: [
      { label: 'ありがとう！頑張る', action: 'free-time-chat' },
      { label: '学習プランを見る', action: 'open-plan-tab' }
    ],
    'free-time-chat': [
      { label: '20分だけ進める', action: 'start-focus-timer' },
      { label: '課題を追加する', action: 'open-smart-input' },
      { label: 'のんびり休憩する', action: 'rest' }
    ],
    'study-tip': [
      { label: '20分集中を始める', action: 'start-focus-timer' },
      { label: '他のコツも聞く', action: 'study-tip-2' },
      { label: '最初の画面に戻る', action: 'restart' }
    ],
    'study-tip-2': [
      { label: '課題を追加する', action: 'open-smart-input' },
      { label: '今日の調子を話す', action: 'check-mood' }
    ],
    'small-talk': [
      { label: '調子を話したい', action: 'check-mood' },
      { label: '集中のコツを聞く', action: 'study-tip' },
      { label: '課題を追加する', action: 'open-smart-input' }
    ],
    overloaded: [
      { label: '今日の予定を見る', action: 'today' },
      { label: '別の日を探す', action: 'other-time' },
      { label: '今日は休む', action: 'rest' }
    ],
    'rest-day': [
      { label: '明日の予定を見る', action: 'tomorrow' },
      { label: '空き時間を探す', action: 'other-time' },
      { label: '課題の締切を見る', action: 'deadline' }
    ],
    overdue: [
      { label: '締切が近い課題を見る', action: 'deadline' },
      { label: '今日の予定を見る', action: 'today' },
      { label: '別の時間を探す', action: 'other-time' }
    ],
    celebration: [
      { label: '今日の予定を見る', action: 'today' },
      { label: '次の課題を見る', action: 'deadline' },
      { label: '空き時間を探す', action: 'other-time' }
    ]
  };
  return options[characterDialogue.step] || options.suggestion;
}

function renderCharacterChoices() {
  const options = getCharacterDialogueOptions();
  ['characterChoiceOne', 'characterChoiceTwo', 'characterChoiceThree'].forEach((id, index) => {
    const button = document.getElementById(id);
    if (!button) return;
    const opt = options[index];
    if (!opt) {
      button.hidden = true;
      button.textContent = '';
    } else {
      button.hidden = false;
      button.textContent = opt.label;
    }
  });
}

function getTodayMissionItems() {
  const todayKey = dateKey(today);
  const deadlineHorizon = dateKey(addDays(today, 7));
  const sessions = data.sessions
    .filter(session => session.aiGenerated && !session.done && session.day === todayKey)
    .sort((left, right) => left.start.localeCompare(right.start))
    .map(session => ({ kind: 'session', id: session.id, taskId: session.taskId, name: session.name, meta: `${session.start}〜${session.end}` }));
  const scheduledTaskIds = new Set(sessions.map(session => session.taskId));
  const urgentTasks = getPriorityPlans()
    .filter(plan => plan.due <= deadlineHorizon)
    .map(plan => {
      const task = data.tasks.find(item => !item.done && item.remaining > 0
        && (plan.legacyTaskId ? item.id === plan.legacyTaskId : item.planId === plan.id)
        && !scheduledTaskIds.has(item.id));
      return task ? { kind: 'task', id: task.id, name: plan.name, meta: `締め切り ${fmtDate(new Date(`${plan.due}T00:00:00`))}` } : null;
    })
    .filter(Boolean)
    .slice(0, 3);
  return [...sessions, ...urgentTasks].slice(0, 3);
}

function renderTodayMissions() {
  const list = document.getElementById('todayMissionList');
  const missions = getTodayMissionItems();
  list.innerHTML = missions.length
    ? missions.map(mission => `<li><label class="character-mission-item"><input type="checkbox" data-mission-kind="${mission.kind}" data-mission-id="${escapeHTML(mission.id)}" data-mission-task="${escapeHTML(mission.taskId || '')}"><span>${escapeHTML(mission.name)}<span class="character-mission-meta">${escapeHTML(mission.meta)}</span></span></label></li>`).join('')
    : '<li class="character-missions-empty">今日の学習ミッションはありません。予定を確認して、無理なく過ごそう。</li>';
  list.querySelectorAll('[data-mission-kind]').forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    completeTodayMission(input.dataset.missionKind, input.dataset.missionId, input.dataset.missionTask);
  }));
}

function completeTodayMission(kind, id, taskId) {
  if (kind === 'session') {
    toggleSession(id);
    const task = data.tasks.find(item => item.id === taskId);
    celebrateMissionCompletion(task?.id);
    return true;
  }
  const task = data.tasks.find(item => item.id === id);
  if (!task || task.done) return false;
  task.done = true;
  task.remaining = 0;
  data.sessions = data.sessions.filter(session => session.taskId !== task.id);
  save();
  renderTasks();
  renderCalendar();
  celebrateMissionCompletion(task.id);
  return true;
}

function celebrateMissionCompletion(taskId) {
  stopStudyTimerForTask(taskId);
  characterCelebrationUntil = Date.now() + 2600;
  characterCelebrationMessage = '今日のミッション達成！よく頑張ったね。少し休憩しよう。';
  renderCharacterStation();
  setTimeout(() => {
    characterCelebrationUntil = 0;
    characterCelebrationMessage = '';
    renderCharacterStation();
  }, 2600);
}

function getScheduleSummary(day) {
  const dayKey = dateKey(day);
  const items = [
    ...data.fixed.filter(item => item.day === day.getDay()),
    ...data.extras.filter(item => item.day === dayKey),
    ...data.sessions.filter(item => item.day === dayKey && !item.done)
  ].sort((left, right) => left.start.localeCompare(right.start));
  if (!items.length) return '登録済みの予定はないよ。空き時間を使って、ゆっくり過ごせそうだね。';
  const details = items.slice(0, 3).map(item =>
    `${item.start}〜${item.end} ${item.name}`
  ).join('、');
  const more = items.length > 3 ? `、ほか${items.length - 3}件` : '';
  return `${day.getDate()}日の予定は${details}${more}だよ。空き時間を見ながら無理なく進めよう！`;
}

function getNextCharacterGap() {
  const gaps = getUpcomingStudyGaps(new Date(), 7).filter(gap => gap.minutes >= 20);
  const nextGap = gaps.find(gap =>
    !characterDialogue.gap
    || gap.day !== characterDialogue.gap.day
    || gap.start !== characterDialogue.gap.start
  );
  return nextGap || null;
}

function chooseCharacterDialogue(action) {
  const taskName = characterDialogue.taskName || characterSuggestedTaskName;
  if (action === 'accept') {
    characterDialogue.step = 'accepted';
    characterDialogue.mood = 'focused';
    setCharacterMood('focused');
    setCharacterMessage(pickCharacterPhrase([
      `いいね！${taskName ? `「${taskName}」` : 'この課題'}を${characterDialogue.gap ? `${formatGapTime(characterDialogue.gap.start)}から` : '次の空き時間に'}進めよう。予定に合わせて無理なくいこう！`,
      `了解！${taskName ? `「${taskName}」` : 'この課題'}を候補にしよう。${characterDialogue.gap ? `${formatGapTime(characterDialogue.gap.start)}から` : '次の空き時間に'}始めるのがよさそうだね。`,
      `よし、${taskName ? `「${taskName}」` : 'この課題'}にしよう！空いている時間を使って少しずつ進めよう。`
    ]));
  } else if (action === 'other-time') {
    const gap = getNextCharacterGap();
    characterDialogue.step = 'other-time';
    characterDialogue.gap = gap;
    characterDialogue.mood = 'encouraging';
    setCharacterMood('encouraging');
    setCharacterMessage(gap
      ? pickCharacterPhrase([
          `別の時間なら${fmtDate(new Date(`${gap.day}T00:00:00`))} ${formatGapTime(gap.start)}〜${formatGapTime(gap.end)}が空いているよ。${taskName ? `「${taskName}」` : '課題'}はどうかな？`,
          `${fmtDate(new Date(`${gap.day}T00:00:00`))}の${formatGapTime(gap.start)}〜${formatGapTime(gap.end)}も空いているね。この時間に${taskName ? `「${taskName}」` : '課題'}を進める？`,
          `予定を見たら${fmtDate(new Date(`${gap.day}T00:00:00`))} ${formatGapTime(gap.start)}〜${formatGapTime(gap.end)}が空いていたよ。ここなら取り組めそうかな？`
        ])
      : 'ほかに20分以上空いている時間は見つからなかったよ。今日の予定を確認してみようか？');
  } else if (action === 'other-task') {
    const alternative = getPriorityPlans().find(plan => plan.name !== taskName);
    characterDialogue.step = 'other-task';
    if (alternative) {
      characterDialogue.taskName = alternative.name;
      characterDialogue.mood = 'encouraging';
      setCharacterMood('encouraging');
      setCharacterMessage(pickCharacterPhrase([
        `別の候補なら「${alternative.name}」があるよ。締切や予定を見ながら、こちらにする？`,
        `「${alternative.name}」も進められそうだよ。空いている時間に少し取り組むのはどう？`,
        `次の候補は「${alternative.name}」だよ。こっちの予定を考えてみようか？`
      ]));
    } else {
      characterDialogue.step = 'today';
      characterDialogue.mood = 'standard';
      setCharacterMood('standard');
      setCharacterMessage('ほかに未完了の課題はないみたい。今日の予定と空き時間を確認してみよう！');
    }
  } else if (action === 'today') {
    characterDialogue.step = 'today';
    characterDialogue.mood = 'standard';
    setCharacterMood('standard');
    setCharacterMessage(getScheduleSummary(today));
  } else if (action === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    characterDialogue.step = 'today';
    characterDialogue.mood = 'standard';
    setCharacterMood('standard');
    setCharacterMessage(getScheduleSummary(tomorrow));
  } else if (action === 'deadline') {
    const plan = getPriorityPlans()[0];
    characterDialogue.step = plan ? 'deadline' : 'no-tasks';
    if (plan) {
      characterDialogue.taskName = plan.name;
      characterDialogue.mood = 'encouraging';
      setCharacterMood('encouraging');
      setCharacterMessage(pickCharacterPhrase([
        `締切が近いのは「${plan.name}」だよ。${fmtDate(new Date(`${plan.due}T00:00:00`))}までだから、空き時間に少しずつ進めよう！`,
        `「${plan.name}」の締切は${fmtDate(new Date(`${plan.due}T00:00:00`))}。予定に組み込むなら、早めに少し始めるのがおすすめだよ。`,
        `予定を立てるなら「${plan.name}」を先に進めておくと安心だね。締切は${fmtDate(new Date(`${plan.due}T00:00:00`))}だよ。`
      ]));
    } else {
      characterDialogue.mood = 'standard';
      setCharacterMood('standard');
      setCharacterMessage('今は締切が近い未完了課題はないみたい。予定を確認して過ごし方を考えよう！');
    }
  } else if (action === 'rest') {
    if (typeof deferTodaysAiStudyBlocks === 'function') deferTodaysAiStudyBlocks();
    characterDialogue.step = 'rest';
    characterDialogue.mood = 'resting';
    setCharacterMood('resting');
    setCharacterMessage(pickCharacterPhrase([
      '今日はゆっくり過ごそう。明日の予定を先に確認しておく？',
      '了解！今日は無理せず休もうね。明日の予定も一緒に見てみる？',
      '休むのも大切だよ。明日の予定を確認して、安心して休もう！'
    ]));
  } else if (action === 'open-smart-input') {
    if (typeof openModal === 'function') openModal('task');
    document.getElementById('smartInputTab')?.click();
    document.getElementById('smartInputText')?.focus();
    return;
  } else if (action === 'open-plan-tab') {
    setCharacterTab('plan');
    return;
  } else if (action === 'start-focus-timer') {
    if (typeof startTwentyMinuteTask === 'function') startTwentyMinuteTask();
    return;
  } else if (action === 'check-mood') {
    characterDialogue.step = 'check-mood';
    characterDialogue.mood = 'encouraging';
    setCharacterMood('encouraging');
    setCharacterMessage(pickCharacterPhrase([
      '調子はどう？無理せずペースを整えよう！',
      '今週の調子はどんな感じかな？遠慮なく教えてね！'
    ]));
  } else if (action === 'mood-great') {
    characterDialogue.step = 'mood-great';
    characterDialogue.mood = 'celebratory';
    setCharacterMood('celebratory');
    setCharacterMessage('その調子！今のうちに得意な課題や重いレポートを少し進めちゃう？');
  } else if (action === 'mood-ok') {
    characterDialogue.step = 'mood-ok';
    characterDialogue.mood = 'standard';
    setCharacterMood('standard');
    setCharacterMessage('無理のないペースが一番だね。まずは20分だけ軽めに集中してみる？');
  } else if (action === 'mood-tired') {
    characterDialogue.step = 'mood-tired';
    characterDialogue.mood = 'concerned';
    setCharacterMood('concerned');
    setCharacterMessage('お疲れさま！無理せず今日は休む予定を入れようか？');
  } else if (action === 'encourage') {
    characterDialogue.step = 'encourage';
    characterDialogue.mood = 'encouraging';
    setCharacterMood('encouraging');
    setCharacterMessage('ここまで毎日コツコツ頑張ってるの、ちゃんと見てるよ！深呼吸して自分のペースでいこう！');
  } else if (action === 'free-time-chat') {
    characterDialogue.step = 'free-time-chat';
    characterDialogue.mood = 'encouraging';
    setCharacterMood('encouraging');
    setCharacterMessage('空き時間をどう過ごすのが気分に合いそう？');
  } else if (action === 'study-tip') {
    characterDialogue.step = 'study-tip';
    characterDialogue.mood = 'focused';
    setCharacterMood('focused');
    setCharacterMessage('集中したいときは『25分集中＋5分休憩』のポモドーロもおすすめだよ。試してみる？');
  } else if (action === 'study-tip-2') {
    characterDialogue.step = 'study-tip-2';
    characterDialogue.mood = 'encouraging';
    setCharacterMood('encouraging');
    setCharacterMessage('最初に5分だけ手を動かすと『作業興奮』で自然と続けやすくなるよ！');
  } else if (action === 'small-talk') {
    characterDialogue.step = 'small-talk';
    characterDialogue.mood = 'standard';
    setCharacterMood('standard');
    setCharacterMessage('何か手伝うことはある？予定の整理でも、ちょっとした息抜きでも話してね！');
  } else if (action === 'restart') {
    characterDialogue.step = 'suggestion';
    renderCharacterStation();
    return;
  }
  renderCharacterChoices();
}

['characterChoiceOne', 'characterChoiceTwo', 'characterChoiceThree'].forEach((id, index) => {
  document.getElementById(id).addEventListener('click', event => {
    chooseCharacterDialogue(getCharacterDialogueOptions()[index].action);
  });
});

document.getElementById('recalculateStudyPlan').addEventListener('click', () => {
  if (typeof recoverSlippedStudySchedule === 'function') {
    recoverSlippedStudySchedule(new Date());
  } else {
    createSchedule({ reroute: true });
  }
  announceTaskrouStudyPlan('新しい空き時間で計画を組み直したよ！');
  renderCharacterChoices();
});
document.getElementById('restToday').addEventListener('click', () => chooseCharacterDialogue('rest'));

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
      ? `<div class="day-head${classes} has-deadline" aria-label="締め切り"><span>${weekday}</span><strong>${dayNumber}</strong></div>`
      : header;
  });
  return withDeadlines.replace(
    /<div class="event ([^"]*)"([^>]*)><div class="event-title">([^<]*)<\/div><div class="event-time">([^<]*)<\/div><\/div>/g,
    (event, classes, attributes, title, time) => {
      const sessionMatch = attributes.match(/data-session="([^"]+)"/);
      const session = sessionMatch && data.sessions.find(item => item.id === sessionMatch[1]);
      const task = session && data.tasks.find(item => item.id === session.taskId);
      const isStudyPlanBlock = session && session.type === 'study' && (/^【学習】/.test(session.name) || Number(session.allocatedHours || 0) > 0);
      if (isStudyPlanBlock && !session.aiGenerated) {
        return `<div class="event ${classes} study-plan-block"${attributes}><div class="event-title">${title}</div><div class="event-time">${time}</div></div>`;
      }
      if (!task?.planId || !session?.aiGenerated) return event;
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

const DEFAULT_EVENT_COLORS = {
  class: '#63bfd4',
  work: '#f2c84b',
  club: '#f56f61',
  study: '#8bcf78',
  personal: '#a995dc'
};

const PRESET_EVENT_COLORS = [
  '#e5534b', '#f56f61', '#ef476f', '#ff7aa2', '#f4845f',
  '#f4a261', '#f6bd60', '#f2c84b', '#cde058', '#a7c957',
  '#8bcf78', '#52b788', '#38a3a5', '#63bfd4', '#4a90e2',
  '#5b7cfa', '#8b7ae8', '#a995dc', '#90a4ae', '#607d8b'
];

const FIXED_CATEGORY_DEFS = [
  { key: 'class', label: '授業' },
  { key: 'work', label: 'アルバイト' },
  { key: 'club', label: 'サークル・部活' },
  { key: 'study', label: '課題・テスト' },
  { key: 'personal', label: '予定（個人予定）' }
];

function normalizeHexColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim())
    ? String(value).trim().toLowerCase()
    : fallback;
}

function ensureUserSettings() {
  data.settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
  data.settings.nickname = typeof data.settings.nickname === 'string' ? data.settings.nickname.trim() : '';
  if (typeof data.settings.showStudyBlocksOnCalendar !== 'boolean') {
    data.settings.showStudyBlocksOnCalendar = true;
  }
  const savedColors = data.settings.colors && typeof data.settings.colors === 'object' ? data.settings.colors : {};
  data.settings.colors = {
    class: normalizeHexColor(savedColors.class, DEFAULT_EVENT_COLORS.class),
    work: normalizeHexColor(savedColors.work, DEFAULT_EVENT_COLORS.work),
    club: normalizeHexColor(savedColors.club, DEFAULT_EVENT_COLORS.club),
    study: normalizeHexColor(savedColors.study, DEFAULT_EVENT_COLORS.study),
    personal: normalizeHexColor(savedColors.personal, DEFAULT_EVENT_COLORS.personal)
  };
  const rawCustom = Array.isArray(data.settings.customCategories) ? data.settings.customCategories : [];
  data.settings.customCategories = rawCustom
    .filter(cat => cat && typeof cat.id === 'string' && typeof cat.name === 'string' && cat.name.trim())
    .map(cat => ({
      id: cat.id.replace(/[^a-zA-Z0-9_-]/g, '') || `custom_${Date.now()}`,
      name: cat.name.trim().slice(0, 20),
      color: normalizeHexColor(cat.color, PRESET_EVENT_COLORS[0])
    }));
  return data.settings;
}

function getAllEventCategories() {
  const settings = ensureUserSettings();
  return [
    ...FIXED_CATEGORY_DEFS.map(def => ({ ...def, fixed: true, color: settings.colors[def.key] })),
    ...settings.customCategories.map(cat => ({ key: cat.id, label: cat.name, fixed: false, color: cat.color }))
  ];
}

function getCategoryLabelByKey(key) {
  const fixedMap = { class: '授業', work: 'アルバイト', club: 'サークル・部活', personal: '個人予定', study: '学習・課題' };
  if (fixedMap[key]) return fixedMap[key];
  const custom = ensureUserSettings().customCategories.find(cat => cat.id === key);
  return custom ? custom.name : '予定';
}

function hexToRgbTuple(hex) {
  const clean = normalizeHexColor(hex, '#63bfd4').slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

function getEventColorCssRule(selector, hex) {
  const [r, g, b] = hexToRgbTuple(hex);
  const darkR = Math.round(r * 0.45);
  const darkG = Math.round(g * 0.45);
  const darkB = Math.round(b * 0.45);
  return `${selector} { border-color: ${hex}; background: rgba(${r}, ${g}, ${b}, 0.16); color: rgb(${darkR}, ${darkG}, ${darkB}); }`;
}

const SETTINGS_GEAR_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>';

const fixedNavButton = document.getElementById('fixedNav');
if (fixedNavButton && typeof fixedNavButton.insertAdjacentHTML === 'function') {
  fixedNavButton.insertAdjacentHTML('afterend', `
    <button class="nav-item" id="settingsNav" type="button"><span class="nav-icon">${SETTINGS_GEAR_SVG}</span><span>設定</span></button>
  `);
}

document.body.insertAdjacentHTML('beforeend', `
  <div class="modal-backdrop" id="settingsBackdrop" role="dialog" aria-modal="true" aria-labelledby="settingsModalTitle">
    <form class="modal settings-modal" id="settingsForm">
      <div class="modal-head">
        <h2 id="settingsModalTitle">設定</h2>
        <button class="close-btn" type="button" id="closeSettingsModal" aria-label="閉じる">×</button>
      </div>
      <div class="settings-section">
        <label class="settings-label" for="settingsNickname">ニックネーム（呼び名）</label>
        <input id="settingsNickname" name="nickname" maxlength="20" placeholder="例：田中（未入力ならマイカレンダー）">
      </div>
      <div class="settings-section">
        <div class="settings-label">基本の予定の種類とカラー</div>
        <div class="settings-color-grid" id="settingsFixedCategories"></div>
      </div>
      <div class="settings-section">
        <div class="settings-label">カスタム種類の追加・管理</div>
        <div class="settings-custom-add">
          <span class="settings-color-dot settings-new-color-dot" id="newCategoryColorPreview" style="background:${PRESET_EVENT_COLORS[0]}"></span>
          <input id="newCategoryName" type="text" maxlength="20" placeholder="例：ゼミ、就活、病院">
          <button class="settings-color-toggle-btn" type="button" id="toggleNewCategoryPaletteBtn" aria-expanded="false">色を変更</button>
          <button class="secondary-btn" type="button" id="addCustomCategoryBtn">＋ 追加</button>
        </div>
        <div class="color-palette-grid is-accordion" id="newCategoryPalette" aria-label="新しい種類のカラー" hidden></div>
        <div class="settings-color-grid" id="settingsCustomCategories"></div>
      </div>
      <div class="modal-actions settings-actions">
        <button class="secondary-btn" type="button" id="cancelSettingsModal">キャンセル</button>
        <button class="primary-btn" type="submit">保存する</button>
      </div>
    </form>
  </div>
`);

const settingsStyle = document.createElement('style');
settingsStyle.textContent = `
.nav-item .nav-icon svg { display: block; margin: 0 auto; }
.settings-modal { max-height: 88vh; overflow-y: auto; }
.settings-section { display: grid; gap: 8px; margin-bottom: 16px; }
.settings-label { font-size: 11px; font-weight: 700; color: var(--ink); }
.settings-modal input[type="text"], #settingsNickname { width: 100%; height: 38px; border: 1px solid #d8e3ef; border-radius: 8px; padding: 0 10px; background: #fff; color: var(--ink); }
.settings-color-grid { display: grid; gap: 7px; }
.settings-color-row { display: grid; gap: 8px; padding: 8px 10px; border: 1px solid #e4ebf4; border-radius: 8px; background: #fbfdff; font-size: 12px; font-weight: 600; }
.settings-color-row-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.settings-color-row-title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.settings-row-actions { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.settings-color-dot { width: 14px; height: 14px; border-radius: 50%; flex: 0 0 14px; border: 1px solid rgba(0,0,0,.14); }
.settings-fixed-badge { font-size: 9px; font-weight: 700; color: #7b8898; background: #eef3f8; padding: 2px 6px; border-radius: 999px; }
.settings-color-toggle-btn { height: 26px; padding: 0 9px; border: 1px solid #d8e3ef; border-radius: 6px; background: #fff; color: var(--ink); font-size: 10px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.settings-color-toggle-btn:hover { background: #f2f6fb; }
.settings-delete-cat-btn { height: 26px; padding: 0 8px; border: 1px solid #efc6c1; border-radius: 6px; background: #fff5f4; color: #b94437; font-size: 10px; font-weight: 700; cursor: pointer; }
.color-palette-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
.color-palette-grid.is-accordion { padding: 8px; border: 1px solid #e4ebf4; border-radius: 8px; background: #fff; }
.color-palette-grid[hidden] { display: none; }
.color-swatch-btn { width: 100%; aspect-ratio: 1; max-width: 22px; min-height: 18px; padding: 0; border: 2px solid transparent; border-radius: 50%; cursor: pointer; transition: transform .12s ease, box-shadow .12s ease; }
.color-swatch-btn:hover { transform: scale(1.12); }
.color-swatch-btn.is-selected { border-color: var(--ink); box-shadow: 0 0 0 2px #fff inset; transform: scale(1.1); }
.settings-custom-add { display: flex; align-items: center; gap: 6px; }
.settings-custom-add input { flex: 1; min-width: 0; }
.settings-actions { flex-wrap: wrap; justify-content: flex-end; }
`;
document.head.appendChild(settingsStyle);

const customEventColorStyle = document.createElement('style');
customEventColorStyle.id = 'customEventColorStyle';
document.head.appendChild(customEventColorStyle);

function syncEventTypeDropdowns() {
  const settings = ensureUserSettings();
  const select = document.getElementById('eventType');
  if (!select) return;
  const currentVal = select.value || 'class';
  const fixedOptions = [
    { value: 'class', label: '授業' },
    { value: 'work', label: 'アルバイト' },
    { value: 'club', label: 'サークル・部活' },
    { value: 'personal', label: '個人予定' },
    { value: 'task', label: '課題・テスト' }
  ];
  const allOptions = [
    ...fixedOptions,
    ...settings.customCategories.map(cat => ({ value: cat.id, label: cat.name }))
  ];
  select.innerHTML = allOptions.map(opt => `<option value="${escapeHTML(opt.value)}">${escapeHTML(opt.label)}</option>`).join('');
  if (allOptions.some(opt => opt.value === currentVal)) {
    select.value = currentVal;
  }
}

function syncSidebarLegend() {
  const legend = document.querySelector('.sidebar .legend');
  if (!legend) return;
  const settings = ensureUserSettings();
  const fixedRows = [
    '<div class="legend-row"><i class="dot"></i>授業</div>',
    '<div class="legend-row"><i class="dot work"></i>アルバイト</div>',
    '<div class="legend-row"><i class="dot club"></i>サークル・部活</div>',
    '<div class="legend-row"><i class="dot personal"></i>個人予定</div>',
    '<div class="legend-row"><i class="dot study"></i>学習・課題</div>'
  ];
  const customRows = settings.customCategories.map(cat =>
    `<div class="legend-row"><i class="dot" style="background:${escapeHTML(cat.color)}"></i>${escapeHTML(cat.name)}</div>`
  );
  legend.innerHTML = [...fixedRows, ...customRows].join('');
}

function applyUserSettings() {
  const settings = ensureUserSettings();
  const nickname = settings.nickname;
  const userNameEl = document.querySelector('.sidebar-foot .user-name');
  const avatarEl = document.querySelector('.sidebar-foot .avatar');
  if (userNameEl) userNameEl.textContent = nickname ? `${nickname}さんのカレンダー` : 'マイカレンダー';
  if (avatarEl) avatarEl.textContent = nickname ? nickname.slice(0, 1) : '私';

  const { colors, customCategories } = settings;
  customEventColorStyle.textContent = [
    `.legend .dot:not(.work):not(.club):not(.personal):not(.study):not([style]) { background: ${colors.class}; }`,
    `.legend .dot.work { background: ${colors.work}; }`,
    `.legend .dot.club { background: ${colors.club}; }`,
    `.legend .dot.study { background: ${colors.study}; }`,
    `.legend .dot.personal { background: ${colors.personal}; }`,
    getEventColorCssRule('.calendar-grid .event.class', colors.class),
    getEventColorCssRule('.calendar-grid .event.work', colors.work),
    getEventColorCssRule('.calendar-grid .event.club', colors.club),
    getEventColorCssRule('.calendar-grid .event.study', colors.study),
    getEventColorCssRule('.calendar-grid .event.personal', colors.personal),
    ...customCategories.map(cat => getEventColorCssRule(`.calendar-grid .event.${cat.id}`, cat.color))
  ].join('\n');

  syncSidebarLegend();
  syncEventTypeDropdowns();

  if (settings.showStudyBlocksOnCalendar === false) document.body.classList.add('hide-study-blocks');
  else document.body.classList.remove('hide-study-blocks');

  if (typeof renderCharacterStation === 'function') renderCharacterStation();
}

let settingsDraftColors = { ...DEFAULT_EVENT_COLORS };
let settingsDraftCustom = [];
let newCategoryDraftColor = PRESET_EVENT_COLORS[0];
let openColorPaletteTarget = null;

function buildColorPaletteHtml(targetAttr, selectedColor) {
  const normalized = normalizeHexColor(selectedColor, PRESET_EVENT_COLORS[0]);
  return PRESET_EVENT_COLORS.map(hex =>
    `<button type="button" class="color-swatch-btn${hex === normalized ? ' is-selected' : ''}" ${targetAttr}="${hex}" style="background:${hex}" aria-label="カラー ${hex}" aria-pressed="${hex === normalized}"></button>`
  ).join('');
}

function renderSettingsCategoriesInModal() {
  const fixedEl = document.getElementById('settingsFixedCategories');
  const customEl = document.getElementById('settingsCustomCategories');
  const newPaletteEl = document.getElementById('newCategoryPalette');
  const newColorPreview = document.getElementById('newCategoryColorPreview');
  const newToggleBtn = document.getElementById('toggleNewCategoryPaletteBtn');

  if (fixedEl) {
    fixedEl.innerHTML = FIXED_CATEGORY_DEFS.map(def => {
      const color = normalizeHexColor(settingsDraftColors[def.key], DEFAULT_EVENT_COLORS[def.key]);
      const paletteId = `fixed:${def.key}`;
      const isOpen = openColorPaletteTarget === paletteId;
      return `<div class="settings-color-row">
        <div class="settings-color-row-head">
          <span class="settings-color-row-title"><span class="settings-color-dot" style="background:${color}"></span>${escapeHTML(def.label)}<span class="settings-fixed-badge">固定</span></span>
          <div class="settings-row-actions">
            <button type="button" class="settings-color-toggle-btn" data-toggle-palette="${paletteId}" aria-expanded="${isOpen}">色を変更</button>
          </div>
        </div>
        ${isOpen ? `<div class="color-palette-grid is-accordion">${buildColorPaletteHtml(`data-fixed-color-key="${def.key}" data-color`, color)}</div>` : ''}
      </div>`;
    }).join('');
    fixedEl.querySelectorAll('[data-toggle-palette]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.togglePalette;
        openColorPaletteTarget = openColorPaletteTarget === target ? null : target;
        renderSettingsCategoriesInModal();
      });
    });
    fixedEl.querySelectorAll('[data-fixed-color-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        settingsDraftColors[btn.dataset.fixedColorKey] = btn.dataset.color;
        openColorPaletteTarget = null;
        renderSettingsCategoriesInModal();
      });
    });
  }

  if (newColorPreview) newColorPreview.style.background = newCategoryDraftColor;
  if (newToggleBtn) newToggleBtn.setAttribute('aria-expanded', String(openColorPaletteTarget === 'new'));
  if (newPaletteEl) {
    const isNewOpen = openColorPaletteTarget === 'new';
    newPaletteEl.hidden = !isNewOpen;
    newPaletteEl.innerHTML = isNewOpen ? buildColorPaletteHtml('data-new-cat-color', newCategoryDraftColor) : '';
    newPaletteEl.querySelectorAll('[data-new-cat-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        newCategoryDraftColor = btn.dataset.newCatColor;
        openColorPaletteTarget = null;
        renderSettingsCategoriesInModal();
      });
    });
  }

  if (customEl) {
    customEl.innerHTML = settingsDraftCustom.map(cat => {
      const paletteId = `custom:${cat.id}`;
      const isOpen = openColorPaletteTarget === paletteId;
      return `<div class="settings-color-row">
        <div class="settings-color-row-head">
          <span class="settings-color-row-title"><span class="settings-color-dot" style="background:${escapeHTML(cat.color)}"></span>${escapeHTML(cat.name)}</span>
          <div class="settings-row-actions">
            <button type="button" class="settings-color-toggle-btn" data-toggle-palette="${escapeHTML(paletteId)}" aria-expanded="${isOpen}">色を変更</button>
            <button type="button" class="settings-delete-cat-btn" data-delete-custom-cat="${escapeHTML(cat.id)}">削除</button>
          </div>
        </div>
        ${isOpen ? `<div class="color-palette-grid is-accordion">${buildColorPaletteHtml(`data-custom-color-id="${escapeHTML(cat.id)}" data-color`, cat.color)}</div>` : ''}
      </div>`;
    }).join('');
    customEl.querySelectorAll('[data-toggle-palette]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.togglePalette;
        openColorPaletteTarget = openColorPaletteTarget === target ? null : target;
        renderSettingsCategoriesInModal();
      });
    });
    customEl.querySelectorAll('[data-custom-color-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = settingsDraftCustom.find(c => c.id === btn.dataset.customColorId);
        if (target) target.color = btn.dataset.color;
        openColorPaletteTarget = null;
        renderSettingsCategoriesInModal();
      });
    });
    customEl.querySelectorAll('[data-delete-custom-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (openColorPaletteTarget === `custom:${btn.dataset.deleteCustomCat}`) openColorPaletteTarget = null;
        settingsDraftCustom = settingsDraftCustom.filter(c => c.id !== btn.dataset.deleteCustomCat);
        renderSettingsCategoriesInModal();
      });
    });
  }
}

const toggleNewPaletteBtn = document.getElementById('toggleNewCategoryPaletteBtn');
if (toggleNewPaletteBtn) {
  toggleNewPaletteBtn.addEventListener('click', () => {
    openColorPaletteTarget = openColorPaletteTarget === 'new' ? null : 'new';
    renderSettingsCategoriesInModal();
  });
}

function openSettingsModal() {
  const settings = ensureUserSettings();
  document.getElementById('settingsNickname').value = settings.nickname;
  settingsDraftColors = { ...settings.colors };
  settingsDraftCustom = settings.customCategories.map(cat => ({ ...cat }));
  newCategoryDraftColor = PRESET_EVENT_COLORS[0];
  openColorPaletteTarget = null;
  const newNameInput = document.getElementById('newCategoryName');
  if (newNameInput) newNameInput.value = '';
  renderSettingsCategoriesInModal();
  document.getElementById('settingsBackdrop').classList.add('open');
  document.getElementById('settingsNickname').focus();
}

function closeSettingsModal() {
  document.getElementById('settingsBackdrop').classList.remove('open');
}

function saveUserSettings({ nickname, colors, customCategories }) {
  const settings = ensureUserSettings();
  if (nickname !== undefined) settings.nickname = String(nickname || '').trim();
  if (colors) {
    settings.colors = {
      class: normalizeHexColor(colors.class, DEFAULT_EVENT_COLORS.class),
      work: normalizeHexColor(colors.work, DEFAULT_EVENT_COLORS.work),
      club: normalizeHexColor(colors.club, DEFAULT_EVENT_COLORS.club),
      study: normalizeHexColor(colors.study, DEFAULT_EVENT_COLORS.study),
      personal: normalizeHexColor(colors.personal, DEFAULT_EVENT_COLORS.personal)
    };
  }
  if (Array.isArray(customCategories)) {
    settings.customCategories = customCategories
      .filter(cat => cat && typeof cat.id === 'string' && typeof cat.name === 'string' && cat.name.trim())
      .map(cat => ({
        id: cat.id.replace(/[^a-zA-Z0-9_-]/g, '') || `custom_${Date.now()}`,
        name: cat.name.trim().slice(0, 20),
        color: normalizeHexColor(cat.color, PRESET_EVENT_COLORS[0])
      }));
  }
  save();
  applyUserSettings();
  renderCalendar();
}

document.getElementById('settingsNav').addEventListener('click', openSettingsModal);
document.getElementById('closeSettingsModal').addEventListener('click', closeSettingsModal);
document.getElementById('cancelSettingsModal').addEventListener('click', closeSettingsModal);
document.getElementById('settingsBackdrop').addEventListener('click', event => {
  if (event.target.id === 'settingsBackdrop') closeSettingsModal();
});
document.getElementById('addCustomCategoryBtn').addEventListener('click', () => {
  const input = document.getElementById('newCategoryName');
  const name = String(input?.value || '').trim();
  if (!name) {
    showToast('種類名を入力してください');
    return;
  }
  const fixedNames = ['授業', 'アルバイト', 'サークル・部活', '課題・テスト', '予定', '個人予定'];
  if (fixedNames.includes(name) || settingsDraftCustom.some(cat => cat.name === name)) {
    showToast('同じ名前の種類がすでにあります');
    return;
  }
  settingsDraftCustom.push({
    id: `custom_${Date.now().toString(36)}`,
    name: name.slice(0, 20),
    color: newCategoryDraftColor
  });
  if (input) input.value = '';
  renderSettingsCategoriesInModal();
});
document.getElementById('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  saveUserSettings({
    nickname: document.getElementById('settingsNickname').value,
    colors: { ...settingsDraftColors },
    customCategories: settingsDraftCustom
  });
  closeSettingsModal();
  showToast('設定を保存しました');
});

applyUserSettings();
renderCalendar();
renderTasks();
