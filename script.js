// script.js - handles validation, local storage, CSV export, and UI updates

// Reusable data model for a delivery record
class DeliveryRecord {
  constructor({ dateTime, deliveryBoy, bagNumber, ordersCount, gelPadsCount }) {
    // dateTime should be an ISO string
    this.dateTime = dateTime || new Date().toISOString();
    this.deliveryBoy = String(deliveryBoy || '').trim();
    this.bagNumber = String(bagNumber || '').trim();
    this.ordersCount = Number.isFinite(Number(ordersCount)) ? Number(ordersCount) : 0;
    this.gelPadsCount = Number.isFinite(Number(gelPadsCount)) ? Number(gelPadsCount) : 0;
  }

  // Create a record from the form fields (DOM elements values)
  static fromFormValues({ deliveryBoy, bagNumber, ordersCount, gelPadsCount }) {
    return new DeliveryRecord({
      dateTime: new Date().toISOString(),
      deliveryBoy: deliveryBoy.trim(),
      bagNumber: bagNumber.trim(),
      ordersCount: Number(ordersCount),
      gelPadsCount: Number(gelPadsCount)
    });
  }

  // Create from a plain object (e.g., loaded from storage)
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

  // CSV header
  static csvHeader() {
    return ['DateTime', 'DeliveryBoy', 'BagNumber', 'OrdersCount', 'GelPadsCount'].join(',');
  }

  // Escape and quote a CSV value
  static csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    // escape double quotes by doubling them
    const escaped = s.replace(/"/g, '""');
    // wrap in quotes if it contains comma, quote or newline
    if (/[",\n\r]/.test(s)) return `"${escaped}"`;
    return escaped;
  }

  // Return a single CSV row (no header)
  toCSVRow() {
    return [
      DeliveryRecord.csvEscape(this.dateTime),
      DeliveryRecord.csvEscape(this.deliveryBoy),
      DeliveryRecord.csvEscape(this.bagNumber),
      DeliveryRecord.csvEscape(this.ordersCount),
      DeliveryRecord.csvEscape(this.gelPadsCount)
    ].join(',');
  }

  // Convert to plain object for storage
  toObject() {
    return {
      dateTime: this.dateTime,
      deliveryBoy: this.deliveryBoy,
      bagNumber: this.bagNumber,
      ordersCount: this.ordersCount,
      gelPadsCount: this.gelPadsCount
    };
  }

  // Convert a list of plain objects or DeliveryRecord instances to a CSV string (with header)
  static listToCSV(list) {
    const rows = [DeliveryRecord.csvHeader()];
    for (const item of list) {
      const rec = (item instanceof DeliveryRecord) ? item : DeliveryRecord.fromObject(item);
      rows.push(rec.toCSVRow());
    }
    return rows.join('\n');
  }
}

// DOM logic
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

  // storage keys
  const STORAGE_JSON_KEY = 'delivery_submissions_v1';
  const STORAGE_CSV_KEY = 'delivery_submissions_csv_v1';

  // load existing submissions (array of plain objects)
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

    // Build a DeliveryRecord (captures current date/time)
    const record = DeliveryRecord.fromFormValues({
      deliveryBoy: formValues.deliveryBoy,
      bagNumber: formValues.bagNumber,
      ordersCount: Number(formValues.ordersCount),
      gelPadsCount: Number(formValues.gelPadsCount)
    });

    // store record as plain object in submissions
    submissions.unshift(record.toObject());

    // persist both JSON and CSV representations
    saveSubmissions(submissions);
    saveCSV(submissions);

    renderList();

    showToast('Submission saved — entry added (CSV stored)');

    form.reset();
    fields.deliveryBoy.focus();
  });

  clearBtn.addEventListener('click', () => {
    form.reset();
    clearErrors();
    fields.deliveryBoy.focus();
  });

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

  function clearErrors() {
    Object.values(errors).forEach(el => el.textContent = '');
  }

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
      // ensure every item has consistent fields (migrate older createdAt -> dateTime)
      return parsed.map(p => DeliveryRecord.fromObject(p).toObject());
    } catch (err) {
      console.warn('Failed to load submissions', err);
      return [];
    }
  }

  function saveSubmissions(list) {
    try {
      localStorage.setItem(STORAGE_JSON_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to save submissions', err);
    }
  }

  function saveCSV(list) {
    try {
      const csv = DeliveryRecord.listToCSV(list);
      localStorage.setItem(STORAGE_CSV_KEY, csv);
    } catch (err) {
      console.warn('Failed to save CSV', err);
    }
  }

  function renderList() {
    recordsList.innerHTML = '';
    if (!submissions || submissions.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    submissions.forEach(item => {
      const li = document.createElement('li');
      li.className = 'record';
      const dateTime = item.dateTime ? new Date(item.dateTime) : null;
      const timeStr = dateTime ? dateTime.toLocaleString() : '';

      li.innerHTML = `
        <h3>${escapeHtml(item.deliveryBoy)}</h3>
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
      recordsList.appendChild(li);
    });
  }

  // small helper to avoid XSS in inserted strings
  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Expose a developer helper on window to retrieve the stored CSV (useful for debugging/export)
  window.__deliveryRecords = {
    getAllJSON: () => JSON.parse(localStorage.getItem(STORAGE_JSON_KEY) || '[]'),
    getCSV: () => localStorage.getItem(STORAGE_CSV_KEY) || DeliveryRecord.listToCSV([])
  };
});
