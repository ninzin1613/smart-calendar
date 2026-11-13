document.querySelector('.form-grid').insertAdjacentHTML('beforeend', `
  <div class="field full quick-image-field" id="quickImageField" hidden>
    <label>参考画像（任意）</label>
    <div class="quick-image-actions">
      <button class="quick-image-add" type="button" id="quickImageInput">画像を添付</button>
      <span class="quick-image-note" id="quickInputStatus" role="status" aria-live="polite"></span>
    </div>
    <input id="quickImageFile" type="file" accept="image/*" hidden aria-label="添付する画像を選択">
  </div>
  <div class="field full quick-image-pending" id="quickImagePending" hidden>
    <span>添付画像：<strong id="quickImageName"></strong></span>
    <button class="quick-image-remove" id="removeQuickImage" type="button">画像を外す</button>
  </div>
`);

const quickInputStyle = document.createElement('style');
quickInputStyle.textContent = `
.quick-image-field[hidden], .quick-image-pending[hidden] { display: none; }
.quick-image-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.quick-image-add { height: 32px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--white); font-size: 10px; font-weight: 700; }
.quick-image-note { color: #828b81; font-size: 9px; }
.quick-image-pending { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.quick-image-pending strong { overflow-wrap: anywhere; }
.quick-image-remove { width: fit-content; padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--white); font-size: 10px; }
.task-overview-image { width: fit-content; padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--white); font-size: 10px; }
`;
document.head.appendChild(quickInputStyle);

let pendingTaskImage = null;
const quickInputStatus = document.getElementById('quickInputStatus');
const quickImageField = document.getElementById('quickImageField');
const quickImageFile = document.getElementById('quickImageFile');
const quickImagePending = document.getElementById('quickImagePending');
const taskImageEventType = document.getElementById('eventType');

function syncQuickImageField() {
  const isTask = taskImageEventType.value === 'task';
  quickImageField.hidden = !isTask;
  if (!isTask) clearPendingTaskImage();
}

function clearPendingTaskImage() {
  pendingTaskImage = null;
  quickImageFile.value = '';
  quickImagePending.hidden = true;
  document.getElementById('quickImageName').textContent = '';
  quickInputStatus.textContent = '';
}

const openModalWithImageField = openModal;
openModal = (type = 'class') => {
  openModalWithImageField(type);
  syncQuickImageField();
};

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
  quickInputStatus.textContent = '課題の登録時にこの端末へ保存します。';
});
document.getElementById('removeQuickImage').addEventListener('click', clearPendingTaskImage);
for (const id of ['closeModal', 'cancelModal']) {
  document.getElementById(id).addEventListener('click', clearPendingTaskImage);
}
document.getElementById('modalBackdrop').addEventListener('click', event => {
  if (event.target.id === 'modalBackdrop') clearPendingTaskImage();
});
taskImageEventType.addEventListener('change', syncQuickImageField);
syncQuickImageField();
