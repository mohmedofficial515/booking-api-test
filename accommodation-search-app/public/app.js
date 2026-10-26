const form = document.getElementById('searchForm');
const locationType = document.getElementById('locationType');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const submitBtn = form.querySelector('button[type="submit"]');

// إظهار/إخفاء حقول الموقع حسب النوع المختار
locationType.addEventListener('change', () => {
  document.querySelectorAll('[data-loc]').forEach((el) => {
    el.hidden = el.dataset.loc !== locationType.value;
  });
});

function pickTranslated(translatedObj, fallback) {
  if (!translatedObj || typeof translatedObj !== 'object') return fallback;
  return translatedObj['en-us'] || translatedObj['en'] || Object.values(translatedObj)[0] || fallback;
}

function formatMoney(amount, currency) {
  if (amount === undefined || amount === null) return null;
  return `${Number(amount).toFixed(2)} ${currency || ''}`.trim();
}

function starsToText(stars) {
  if (!stars) return '';
  const full = Math.round(stars);
  return '★'.repeat(full);
}

function renderCard(item) {
  const name = pickTranslated(item.name, `مكان إقامة #${item.id}`);
  const address = pickTranslated(item.address, '');

  const priceObj = item.price || {};
  const priceBlock = priceObj.display || priceObj.total || priceObj.base || {};
  const currency = item.currency || {};
  const priceMain = formatMoney(priceBlock.accommodation_currency, currency.accommodation);
  const priceBooker =
    currency.booker && currency.booker !== currency.accommodation
      ? formatMoney(priceBlock.booker_currency, currency.booker)
      : null;

  const card = document.createElement('div');
  card.className = 'card';

  card.innerHTML = `
    ${
      item.photo_url
        ? `<img class="card__photo" src="${item.photo_url}" alt="${name}" loading="lazy" />`
        : `<div class="card__photo card__photo--placeholder">🏨</div>`
    }
    <div class="card__body">
      <div class="card__name">${name}</div>
      ${address ? `<div class="card__address">📍 ${address}</div>` : ''}
      <div class="card__rating">
        ${item.stars ? `<span class="card__stars">${starsToText(item.stars)}</span>` : ''}
        ${item.review_score ? `<span class="card__score">${item.review_score}</span>` : ''}
        ${item.number_of_reviews ? `<span>(${item.number_of_reviews} تقييم)</span>` : ''}
      </div>
      <div class="card__price">
        <div>
          <div class="card__price-value">${priceMain || 'السعر غير متاح'}</div>
          ${priceBooker ? `<div class="card__price-note">≈ ${priceBooker} لعملة الحاجز</div>` : ''}
        </div>
      </div>
    </div>
    <div class="card__links">
      ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener" class="primary">عرض على Booking.com</a>` : ''}
      ${item.deep_link_url ? `<a href="${item.deep_link_url}" target="_blank" rel="noopener">فتح بالتطبيق</a>` : ''}
    </div>
  `;
  return card;
}

function readForm() {
  const childrenAgesRaw = document.getElementById('childrenAges').value.trim();
  const childrenAges = childrenAgesRaw
    ? childrenAgesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    locationType: locationType.value,
    country: document.getElementById('country').value.trim().toLowerCase(),
    cityId: document.getElementById('cityId').value,
    regionId: document.getElementById('regionId').value,
    latitude: document.getElementById('latitude').value,
    longitude: document.getElementById('longitude').value,
    radius: document.getElementById('radius').value,
    checkin: document.getElementById('checkin').value,
    checkout: document.getElementById('checkout').value,
    adults: document.getElementById('adults').value,
    rooms: document.getElementById('rooms').value,
    childrenAges,
    currency: document.getElementById('currency').value.trim(),
    bookerCountry: document.getElementById('bookerCountry').value.trim().toLowerCase(),
    bookerPlatform: document.getElementById('bookerPlatform').value,
    rows: document.getElementById('rows').value,
    language: 'en-us',
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultsEl.innerHTML = '';
  statusEl.className = 'status';
  statusEl.textContent = 'جارِ البحث...';
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readForm()),
    });
    const json = await res.json();

    if (!res.ok) {
      const messages = (json.errors || []).map((er) => `${er.id}: ${er.message}`).join(' | ');
      throw new Error(messages || `خطأ من الخادم (HTTP ${res.status})`);
    }

    statusEl.textContent = `تم العثور على ${json.count} نتيجة${json.request_id ? ` — Request ID: ${json.request_id}` : ''}`;

    if (!json.data.length) {
      resultsEl.innerHTML = `<div class="empty-state">لا توجد نتائج مطابقة لمعايير البحث.</div>`;
      return;
    }

    json.data.forEach((item) => resultsEl.appendChild(renderCard(item)));
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = `❌ ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});
