const reviewContainer = document.querySelector('.below-calendar');
reviewContainer.insertAdjacentHTML('afterend', `
  <section class="weekly-review panel" id="weeklyReview" aria-labelledby="reviewTitle">
    <div class="panel-head">
      <div>
        <div class="panel-title" id="reviewTitle">今週の計画を振り返る</div>
        <div class="review-note">計画にかかった時間と、学習予定の実績を記録します。記録はこの端末に保存されます。</div>
      </div>
    </div>
    <form class="planning-time-form" id="planningTimeForm">
      <label class="review-field" for="planningMinutes">計画作成にかかった時間（分）
        <input id="planningMinutes" name="minutes" type="number" min="1" step="1" required>
      </label>
      <button class="secondary-btn" type="submit">時間を記録</button>
      <span class="review-note" id="planningTimeSummary"></span>
    </form>
    <div class="review-note">学習予定ごとに実際の開始・終了時刻を記録すると、予定との差が表示されます。</div>
    <div class="review-list" id="reviewSessionList"></div>
  </section>
`);

data.reviews = data.reviews || {};

function recordPlanningTime(minutes) {
  const value = Number(minutes);
  if (!Number.isInteger(value) || value < 1) {
    showToast('計画作成時間は1分以上で入力してください');
    return false;
  }
  const weekKey = dateKey(weekStart);
  data.reviews[weekKey] = { ...data.reviews[weekKey], planningMinutes: value };
  save();
  renderWeeklyReview();
  showToast('計画作成時間を記録しました');
  return true;
}

function recordSessionActual(id, actualStart, actualEnd) {
  const session = data.sessions.find(item => item.id === id);
  if (!session) {
    showToast('対象の学習予定が見つかりません');
    return false;
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(actualStart) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(actualEnd) || clockMinutes(actualEnd) <= clockMinutes(actualStart)) {
    showToast('実績の終了時刻は開始時刻より後にしてください');
    return false;
  }
  session.actualStart = actualStart;
  session.actualEnd = actualEnd;
  save();
  renderWeeklyReview();
  showToast('実際の時刻を記録しました');
  return true;
}

function formatDeviation(minutes) {
  return `${minutes > 0 ? '+' : ''}${minutes}分`;
}

function renderWeeklyReview() {
  const weekEnd = dateKey(addDays(weekStart, 6));
  const weekKey = dateKey(weekStart);
  const review = data.reviews[weekKey] || {};
  const planningMinutes = document.getElementById('planningMinutes');
  planningMinutes.value = review.planningMinutes || '';
  document.getElementById('planningTimeSummary').textContent = review.planningMinutes
    ? `記録済み：${review.planningMinutes}分`
    : 'まだ記録されていません';

  const sessions = data.sessions.filter(session => session.day >= weekKey && session.day <= weekEnd);
  const list = document.getElementById('reviewSessionList');
  if (!sessions.length) {
    list.innerHTML = '<div class="review-empty">この週に記録できる学習予定はありません。</div>';
    return;
  }
  list.innerHTML = sessions.map(session => {
    const deviation = session.actualStart && session.actualEnd
      ? `開始 ${formatDeviation(clockMinutes(session.actualStart) - clockMinutes(session.start))} ／ 終了 ${formatDeviation(clockMinutes(session.actualEnd) - clockMinutes(session.end))}`
      : '実績未記録';
    return `<div class="review-session">
      <div>
        <div class="review-session-name">${escapeHTML(session.name)}</div>
        <div class="review-session-plan">${session.day}　予定 ${session.start}–${session.end}</div>
      </div>
      <form class="review-session-form" data-review-session="${escapeHTML(session.id)}">
        <label class="review-field">実際の開始
          <input name="actualStart" type="time" value="${escapeHTML(session.actualStart || session.start)}" required>
        </label>
        <label class="review-field">実際の終了
          <input name="actualEnd" type="time" value="${escapeHTML(session.actualEnd || session.end)}" required>
        </label>
        <button class="secondary-btn" type="submit">実績を記録</button>
        <div class="review-delta">${deviation}</div>
      </form>
    </div>`;
  }).join('');
}

const renderCalendarWithReview = renderCalendar;
renderCalendar = (...args) => {
  renderCalendarWithReview(...args);
  renderWeeklyReview();
};

document.getElementById('planningTimeForm').addEventListener('submit', event => {
  event.preventDefault();
  const minutes = new FormData(event.currentTarget).get('minutes');
  recordPlanningTime(minutes);
});

document.getElementById('weeklyReview').addEventListener('submit', event => {
  const form = event.target;
  if (!form.matches('.review-session-form')) return;
  event.preventDefault();
  const values = new FormData(form);
  recordSessionActual(form.dataset.reviewSession, values.get('actualStart'), values.get('actualEnd'));
});

renderWeeklyReview();
