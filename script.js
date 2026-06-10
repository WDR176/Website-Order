// script.js - handles validation, local storage, and UI updates
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('deliveryForm');
  const clearBtn = document.getElementById('clearBtn');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  const recordsList = document.getElementById('recordsList');
  const emptyState = document.getElementById('emptyState');

  const fields = {
    deliveryBoy: document.getElementById('deliveryBoy'),
    bagNumber: document.getElementById('bagNumber'),
    ordersCount: document.getElementById('ordersCount'),
    gelPadsCount: document.getElementById('gelPadsCount')
  };

  const errors = {
    deliveryBoy: document.getElementById('err-deliveryBoy'),
    bagNumber: document.getElementById('err-bagNumber'),
    ordersCount: document.getElementById('err-ordersCount'),
    gelPadsCount: document.getElementById('err-gelPadsCount')
  };

  // load existing submissions
  const STORAGE_KEY = 'delivery_submissions_v1';
  let submissions = loadSubmissions();
  renderList();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();

    const data = {
      deliveryBoy: fields.deliveryBoy.value.trim(),
      bagNumber: fields.bagNumber.value.trim(),
      ordersCount: fields.ordersCount.value.trim(),
      gelPadsCount: fields.gelPadsCount.value.trim(),
      createdAt: new Date().toISOString()
    };

    const isValid = validate(data);
    if (!isValid) return;

    // normalize numbers
    data.ordersCount = Number(data.ordersCount);
    data.gelPadsCount = Number(data.gelPadsCount);

    submissions.unshift(data);
    saveSubmissions(submissions);
    renderList();

    showToast('Submission saved — entry added');

    form.reset();
    fields.deliveryBoy.focus();
  });

  clearBtn.addEventListener('click', () => {
    form.reset();
    clearErrors();
    fields.deliveryBoy.focus();
  });

  function validate(d){
    let ok = true;
    if (!d.deliveryBoy) {
      errors.deliveryBoy.textContent = 'Please enter the delivery boy name';
      ok = false;
    }
    if (!d.bagNumber) {
      errors.bagNumber.textContent = 'Please enter the bag number';
      ok = false;
    }
    const ordersNum = Number(d.ordersCount);
    if (!d.ordersCount || !Number.isFinite(ordersNum) || ordersNum < 1) {
      errors.ordersCount.textContent = 'Orders count must be 1 or more';
      ok = false;
    }
    const gelNum = Number(d.gelPadsCount);
    if (d.gelPadsCount === '' || !Number.isFinite(gelNum) || gelNum < 0) {
      errors.gelPadsCount.textContent = 'Gel pads count must be 0 or more';
      ok = false;
    }
    return ok;
  }

  function clearErrors(){
    Object.values(errors).forEach(el => el.textContent = '');
  }

  function showToast(message, ms = 2500){
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), ms);
  }

  function loadSubmissions(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('Failed to load submissions', err);
      return [];
    }
  }

  function saveSubmissions(list){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to save submissions', err);
    }
  }

  function renderList(){
    recordsList.innerHTML = '';
    if (!submissions || submissions.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';
    submissions.forEach(item => {
      const li = document.createElement('li');
      li.className = 'record';
      li.innerHTML = `
        <h3>${escapeHtml(item.deliveryBoy)}</h3>
        <div class="meta">
          <span><strong>Bag:</strong> ${escapeHtml(item.bagNumber)}</span>
          <span>•</span>
          <span><strong>Orders:</strong> ${item.ordersCount}</span>
          <span>•</span>
          <span><strong>Gel Pads:</strong> ${item.gelPadsCount}</span>
        </div>
        <div class="meta" style="margin-top:8px;color:var(--muted);font-size:0.85rem;">
          ${new Date(item.createdAt).toLocaleString()}
        </div>
      `;
      recordsList.appendChild(li);
    });
  }

  // small helper to avoid XSS in inserted strings
  function escapeHtml(s){
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
});
