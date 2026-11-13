document.querySelector('.calendar-shell').insertAdjacentHTML('beforebegin', `
  <section class="quick-input-panel" aria-labelledby="quickInputTitle">
    <div class="quick-input-heading">
      <div>
        <div class="panel-title" id="quickInputTitle">クイック入力</div>
        <div class="quick-input-note">課題をテキストで登録するか、画像を端末内に添付できます。</div>
      </div>
      <div class="quick-input-actions">
        <button class="quick-input-button" type="button" id="quickTextInput"><span aria-hidden="true">T</span>テキスト</button>
        <button class="quick-input-button" type="button" id="quickImageInput"><span aria-hidden="true">▧</span>画像</button>
      </div>
    </div>
    <div class="quick-input-note" id="quickInputStatus" role="status" aria-live="polite"></div>
    <input id="quickImageFile" type="file" accept="image/*" hidden aria-label="添付する画像を選択">
  </section>
`);

document.querySelector('.form-grid').insertAdjacentHTML('beforeend', `
  <div class="field full quick-image-pending" id="quickImagePending" hidden>
    <span>添付画像：<strong id="quickImageName"></strong></span>
    <button class="quick-image-remove" id="removeQuickImage" type="button">画像を外す</button>
  </div>
`);

const quickInputStyle = document.createElement('style');
quickInputStyle.textContent = `
.quick-input-panel { margin: 0 0 16px; padding: 12px 16px; border: 1px solid #e4ebf4; border-radius: 9px; background: #fffdf8; box-shadow: var(--shadow); }
.quick-input-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.quick-input-note { margin-top: 4px; color: #828b81; font-size: 10px; }
#quickInputStatus:empty { display: none; }
.quick-input-actions { display: flex; gap: 7px; }
.quick-input-button { display: grid; min-width: 72px; min-height: 54px; place-items: center; gap: 2px; padding: 5px 9px; border: 1px solid #eadca9; border-radius: 8px; background: #fff3c9; color: #695425; font-size: 10px; font-weight: 700; transition: transform .18s ease, box-shadow .18s ease; }
.quick-input-button span { display: grid; width: 25px; height: 25px; place-items: center; border: 1px solid currentColor; border-radius: 6px; font-size: 15px; }
.quick-input-button:hover, .quick-input-button:focus-visible { transform: scale(1.05); box-shadow: 0 0 0 5px rgba(242, 200, 75, .2); outline: none; }
.quick-image-pending { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.quick-image-pending[hidden] { display: none; }
.quick-image-pending strong { overflow-wrap: anywhere; }
.quick-image-remove { width: fit-content; padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--white); font-size: 10px; }
.task-overview-image { width: fit-content; padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--white); font-size: 10px; }
@media (prefers-reduced-motion: reduce) { .quick-input-button { transition: none; } }
@media (max-width: 600px) { .quick-input-heading { align-items: flex-start; flex-direction: column; } .quick-input-actions { width: 100%; } .quick-input-button { flex: 1; } }
`;
document.head.appendChild(quickInputStyle);

let pendingTaskImage = null;
const quickInputStatus = document.getElementById('quickInputStatus');
const quickImageFile = document.getElementById('quickImageFile');
const quickImagePending = document.getElementById('quickImagePending');

function openQuickTaskForm() {
  openModal('task');
  syncStudyFields();
  document.getElementById('eventName').focus();
}

function clearPendingTaskImage() {
  pendingTaskImage = null;
  quickImageFile.value = '';
  quickImagePending.hidden = true;
  document.getElementById('quickImageName').textContent = '';
  quickInputStatus.textContent = '';
}

function openTaskImageDatabase() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open('smart-calendar-task-images', 1);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('taskImages')) database.createObjectStore('taskImages');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('画像保存用データベースを開けませんでした'));
  });
}

function storeTaskImage(planId, file) {
  return openTaskImageDatabase().then(database => new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction('taskImages', 'readwrite');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('画像を保存できませんでした'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error('画像の保存が中断されました'));
      };
      transaction.objectStore('taskImages').put({
        blob: file,
        name: file.name,
        type: file.type
      }, planId);
    } catch (error) {
      database.close();
      reject(error);
    }
  }));
}

function openTaskImage(planId) {
  openTaskImageDatabase().then(database => new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction('taskImages', 'readonly');
      const request = transaction.objectStore('taskImages').get(planId);
      request.onsuccess = () => {
        database.close();
        resolve(request.result);
      };
      request.onerror = () => {
        database.close();
        reject(request.error || new Error('添付画像を読み込めませんでした'));
      };
    } catch (error) {
      database.close();
      reject(error);
    }
  })).then(record => {
    if (!record?.blob) {
      showToast('添付画像が見つかりません');
      return;
    }
    const url = URL.createObjectURL(record.blob);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }).catch(error => {
    showToast(`画像を開けませんでした: ${error.message || '保存領域を確認してください'}`);
  });
}

const createStudyPlanWithQuickImage = createStudyPlan;
createStudyPlan = options => {
  const plan = createStudyPlanWithQuickImage(options);
  if (!plan || !pendingTaskImage) return plan;

  const image = pendingTaskImage;
  clearPendingTaskImage();
  plan.imageAttachmentName = image.name;
  save();
  storeTaskImage(plan.id, image).then(() => {
    showToast('課題と画像をこの端末に保存しました');
  }).catch(error => {
    delete plan.imageAttachmentName;
    save();
    showToast(`課題は保存しましたが画像を保存できませんでした: ${error.message || '保存領域を確認してください'}`);
  });
  return plan;
};

document.getElementById('quickTextInput').addEventListener('click', () => {
  clearPendingTaskImage();
  openQuickTaskForm();
});
document.getElementById('quickImageInput').addEventListener('click', () => quickImageFile.click());
quickImageFile.addEventListener('change', event => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    clearPendingTaskImage();
    showToast('画像ファイルを選択してください');
    return;
  }
  pendingTaskImage = file;
  quickImagePending.hidden = false;
  document.getElementById('quickImageName').textContent = file.name;
  quickInputStatus.textContent = '課題の登録時に画像をこの端末へ保存します。課題名や締切を入力してください。';
  openQuickTaskForm();
});
document.getElementById('removeQuickImage').addEventListener('click', clearPendingTaskImage);
for (const id of ['closeModal', 'cancelModal']) {
  document.getElementById(id).addEventListener('click', clearPendingTaskImage);
}
document.getElementById('modalBackdrop').addEventListener('click', event => {
  if (event.target.id === 'modalBackdrop') clearPendingTaskImage();
});
document.getElementById('eventType').addEventListener('change', event => {
  if (event.currentTarget.value !== 'task') clearPendingTaskImage();
});
