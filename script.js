// script.js - enhanced validation, local storage, CSV export, UI updates and debugging helpers

// Reusable data model for a delivery record
class DeliveryRecord {
  constructor({ dateTime, deliveryBoy, bagNumber, ordersCount, gelPadsCount }) {
    this.dateTime = dateTime || new Date().toISOString();
    this.deliveryBoy = String(deliveryBoy || '').trim();
    this.bagNumber = String(bagNumber || '').trim();
    this.ordersCount = Number.isFinite(Number(ordersCount)) ? Number(ordersCount) : 0;
    this.gelPadsCount = Number.isFinite(Number(gelPadsCount)) ? Number(gelPadsCount) : 0;
  }

  static fromFormValues({ deliveryBoy, bagNumber, ordersCount, gelPadsCount }) {
    return new DeliveryRecord({
      dateTime: new Date().toISOString(),
      deliveryBoy: String(deliveryBoy || '').trim(),
      bagNumber: String(bagNumber || '').trim(),
      ordersCount: Number(ordersCount),
      gelPadsCount: Number(gelPadsCount)
    });
  }

  static fromObject(obj) {
    if (!obj) return null;
    return new DeliveryRecord({
      dateTime: obj.dateTime || obj.createdAt || new Date().toISOString(),
      deliveryBoy: obj.deliveryBoy,
      bagNumber: obj.bagNumber,
      ordersCount: obj.ordersCount,
      gelPadsCount: obj.gelPadsCount
    });
  }

  static csvHeader() {
    return ['DateTime', 'DeliveryBoy', 'BagNumber', 'OrdersCount', 'GelPadsCount'].join(',');
  }

  static csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    const escaped = s.replace(/"/g, '""');
    if (/[",\n\r]/.test(s)) return `"${escaped}"`;
    return escaped;
  }

  toCSVRow() {
    return [
      DeliveryRecord.csvEscape(this.dateTime),
      DeliveryRecord.csvEscape(this.deliveryBoy),
      DeliveryRecord.csvEscape(this.bagNumber),
      DeliveryRecord.csvEscape(this.ordersCount),
      DeliveryRecord.csvEscape(this.gelPadsCount)
    ].join(',');
  }

  toObject() {
    return {
      dateTime: this.dateTime,
      deliveryBoy: this.deliveryBoy,
      bagNumber: this.bagNumber,
      ordersCount: this.ordersCount,
      gelPadsCount: this.gelPadsCount
    };
  }

  static listToCSV(list) {
    const rows = [DeliveryRecord.csvHeader()];
    for (const item of list) {
      const rec = (item instanceof DeliveryRecord) ? item : DeliveryRecord.fromObject(item);
      rows.push(rec.toCSVRow());
    }
    return rows.join('\n');
  }
}

// App logic with improved debugging and error handling
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('deliveryForm');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  const recordsList = document.getElementById('recordsList');
  const emptyState = document.getElementById('emptyState');

  const dumpBtn = document.getElementById('dumpBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const toggleDebugBtn = document.getElementById('toggleDebugBtn');
  const debugPanel = document.getElementById('debugPanel');
  const debugOutput = document.getElementById('debugOutput');

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

  // keys
  const STORAGE_JSON_KEY = 'delivery_submissions_v1';
  const STORAGE_CSV_KEY = 'delivery_submissions_csv_v1';
  const DEBUG_ENABLED_KEY = 'delivery_debug_enabled_v1';

  // debug mode: enabled via url param ?debug=1 or toggled in UI
  const urlParams = new URLSearchParams(window.location.search);
  let debug = urlParams.get('debug') === '1' || localStorage.getItem(DEBUG_ENABLED_KEY) === 'true';
  setDebugUI(debug);

  function log(...args) {
    if (debug) console.debug('[DeliveryApp]', ...args);
  }

  function info(...args) { console.info('[DeliveryApp]', ...args); }
  function warn(...args) { console.warn('[DeliveryApp]', ...args); }
  function error(...args) { console.error('[DeliveryApp]', ...args); }

  // load existing submissions
  let submissions = loadSubmissions();
  renderList();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();

    const formValues = {
      deliveryBoy: fields.deliveryBoy.value.trim(),
      bagNumber: fields.bagNumber.value.trim(),
      ordersCount: fields.ordersCount.value.trim(),
      gelPadsCount: fields.gelPadsCount.value.trim()
    };

    const isValid = validate(formValues);
    if (!isValid) return;

    const record = DeliveryRecord.fromFormValues({
      deliveryBoy: formValues.deliveryBoy,
      bagNumber: formValues.bagNumber,
      ordersCount: Number(formValues.ordersCount),
      gelPadsCount: Number(formValues.gelPadsCount)
    });

    try {
      submissions.unshift(record.toObject());
      saveSubmissions(submissions);
      saveCSV(submissions);
      renderList();
      showToast('Submission saved — entry added (CSV stored)');
      log('Saved record', record.toObject());
      form.reset();
      fields.deliveryBoy.focus();
    } catch (err) {
      error('Failed to save submission', err);
      showToast('Error saving submission', 3500);
      appendDebug(`Save error: ${err?.message || err}`);
    }
  });

  clearBtn.addEventListener('click', () => {
    form.reset();
    clearErrors();
    fields.deliveryBoy.focus();
  });

  exportBtn.addEventListener('click', async () => {
    try {
      const csv = DeliveryRecord.listToCSV(submissions);
      await downloadCSV(csv);
      showToast('CSV downloaded');
      log('Exported CSV, rows:', submissions.length);
    } catch (err) {
      error('Export failed', err);
      showToast('Export failed', 3000);
      appendDebug(`Export error: ${err?.message || err}`);
    }
  });

  dumpBtn.addEventListener('click', () => dumpStorage());
  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Clear all submissions from local storage? This cannot be undone.')) return;
    clearAllSubmissions();
  });
  toggleDebugBtn.addEventListener('click', () => toggleDebug());

  function validate(values) {
    let ok = true;
    if (!values.deliveryBoy) {
      errors.deliveryBoy.textContent = 'Please enter the delivery boy name';
      ok = false;
    }
    if (!values.bagNumber) {
      errors.bagNumber.textContent = 'Please enter the bag number';
      ok = false;
    }
    const ordersNum = Number(values.ordersCount);
    if (!values.ordersCount || !Number.isFinite(ordersNum) || ordersNum < 1) {
      errors.ordersCount.textContent = 'Orders count must be 1 or more';
      ok = false;
    }
    const gelNum = Number(values.gelPadsCount);
    if (values.gelPadsCount === '' || !Number.isFinite(gelNum) || gelNum < 0) {
      errors.gelPadsCount.textContent = 'Gel pads count must be 0 or more';
      ok = false;
    }
    return ok;
  }

  function clearErrors() { Object.values(errors).forEach(el => el.textContent = ''); }

  function showToast(message, ms = 2500) {
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), ms);
  }

  function loadSubmissions() {
    try {
      const raw = localStorage.getItem(STORAGE_JSON_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      log('Loaded submissions from storage:', parsed.length);
      return parsed.map(p => DeliveryRecord.fromObject(p).toObject());
    } catch (err) {
      warn('Failed to load submissions', err);
      appendDebug(`Load error: ${err?.message || err}`);
      return [];
    }
  }

  function saveSubmissions(list) {
    try {
      localStorage.setItem(STORAGE_JSON_KEY, JSON.stringify(list));
      log('Saved JSON submissions', list.length);
    } catch (err) {
      warn('Failed to save submissions', err);
      appendDebug(`Save submissions error: ${err?.message || err}`);
      throw err;
    }
  }

  function saveCSV(list) {
    try {
      const csv = DeliveryRecord.listToCSV(list);
      localStorage.setItem(STORAGE_CSV_KEY, csv);
      log('Saved CSV to storage, size:', csv.length);
    } catch (err) {
      warn('Failed to save CSV', err);
      appendDebug(`Save CSV error: ${err?.message || err}`);
      throw err;
    }
  }

  function deleteSubmission(index) {
    try {
      const deleted = submissions[index];
      submissions.splice(index, 1);
      saveSubmissions(submissions);
      saveCSV(submissions);
      renderList();
      showToast('Entry deleted');
      log('Deleted record at index:', index, deleted);
    } catch (err) {
      error('Failed to delete submission', err);
      showToast('Error deleting entry', 3000);
      appendDebug(`Delete error: ${err?.message || err}`);
    }
  }

  function renderList() {
    recordsList.innerHTML = '';
    if (!submissions || submissions.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    submissions.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'record';
      const dateTime = item.dateTime ? new Date(item.dateTime) : null;
      const timeStr = dateTime ? dateTime.toLocaleString() : '';

      li.innerHTML = `
        <div class="record-header">
          <h3>${escapeHtml(item.deliveryBoy)}</h3>
          <button class="btn-delete" title="Delete this entry" data-index="${index}">×</button>
        </div>
        <div class="meta">
          <span><strong>Bag:</strong> ${escapeHtml(item.bagNumber)}</span>
          <span>•</span>
          <span><strong>Orders:</strong> ${escapeHtml(item.ordersCount)}</span>
          <span>•</span>
          <span><strong>Gel Pads:</strong> ${escapeHtml(item.gelPadsCount)}</span>
        </div>
        <div class="meta" style="margin-top:8px;color:var(--muted);font-size:0.85rem;">
          ${escapeHtml(timeStr)}
        </div>
      `;
      
      // Add delete button event listener
      const deleteBtn = li.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete entry for ${escapeHtml(item.deliveryBoy)} - ${escapeHtml(item.bagNumber)}?`)) {
          deleteSubmission(index);
        }
      });
      
      recordsList.appendChild(li);
    });
  }

  // CSV download helper (returns a Promise)
  async function downloadCSV(csvString) {
    return new Promise((resolve, reject) => {
      try {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const ts = now.toISOString().replace(/[:.]/g, '-');
        a.download = `delivery_records_${ts}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Debug helpers
  function appendDebug(text) {
    try {
      if (!debugOutput) return;
      const ts = new Date().toISOString();
      debugOutput.textContent = `${ts} - ${text}\n` + debugOutput.textContent;
    } catch (e) { console.warn('appendDebug failed', e); }
  }

  function dumpStorage() {
    try {
      const json = localStorage.getItem(STORAGE_JSON_KEY) || '[]';
      const csv = localStorage.getItem(STORAGE_CSV_KEY) || '';
      const out = {
        jsonCount: JSON.parse(json).length,
        jsonSample: JSON.parse(json).slice(0,5),
        csvLength: csv.length
      };
      debugOutput.textContent = JSON.stringify(out, null, 2);
      log('Storage dump', out);
      showToast('Storage dumped to debug panel');
    } catch (err) {
      appendDebug(`Dump failed: ${err?.message || err}`);
      showToast('Dump failed', 3000);
    }
  }

  function clearAllSubmissions() {
    try {
      localStorage.removeItem(STORAGE_JSON_KEY);
      localStorage.removeItem(STORAGE_CSV_KEY);
      submissions = [];
      renderList();
      debugOutput.textContent = 'Cleared all submissions';
      showToast('All submissions cleared');
      log('Cleared storage');
    } catch (err) {
      appendDebug(`ClearAll failed: ${err?.message || err}`);
      showToast('Clear failed', 3000);
    }
  }

  function setDebugUI(enabled) {
    debug = Boolean(enabled);
    localStorage.setItem(DEBUG_ENABLED_KEY, debug ? 'true' : 'false');
    debugPanel.style.display = debug ? 'block' : 'none';
    log('Debug mode', debug);
  }

  function toggleDebug() { setDebugUI(!debug); }

  // Expose helpers for debugging / automation
  window.__deliveryRecords = {
    getAllJSON: () => JSON.parse(localStorage.getItem(STORAGE_JSON_KEY) || '[]'),
    getCSV: () => localStorage.getItem(STORAGE_CSV_KEY) || DeliveryRecord.listToCSV([]),
    clearAll: clearAllSubmissions,
    downloadCSV: async () => { const csv = window.__deliveryRecords.getCSV(); await downloadCSV(csv); },
    deleteByIndex: deleteSubmission
  };

  // show debug panel automatically if debug param is provided
  if (debug) dumpStorage();

});
