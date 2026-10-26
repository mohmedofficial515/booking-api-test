require('dotenv').config();
const path = require('path');
const express = require('express');

const {
  BOOKING_API_BASE = 'https://demandapi-sandbox.booking.com/3.2',
  BOOKING_AFFILIATE_ID,
  BOOKING_BEARER_TOKEN,
  PORT = 4000,
} = process.env;

const credentialsConfigured = Boolean(BOOKING_AFFILIATE_ID && BOOKING_BEARER_TOKEN);

if (!credentialsConfigured) {
  console.warn(
    '\n[تحذير] لم يتم ضبط BOOKING_AFFILIATE_ID / BOOKING_BEARER_TOKEN في ملف .env\n' +
    'انسخ .env.example إلى .env واملأ بيانات حسابك من Booking.com Partner Hub قبل تشغيل أي بحث حقيقي.\n'
  );
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// نداء عام لأي endpoint من Demand API باستخدام مفاتيحنا السرية من الخادم فقط
async function callBookingApi(endpointPath, requestBody) {
  const response = await fetch(`${BOOKING_API_BASE}${endpointPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BOOKING_BEARER_TOKEN}`,
      'X-Affiliate-Id': String(BOOKING_AFFILIATE_ID),
    },
    body: JSON.stringify(requestBody),
  });

  const rawText = await response.text();
  let json;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    json = { raw: rawText };
  }

  if (!response.ok) {
    const err = new Error(`Booking API error on ${endpointPath}: ${response.status}`);
    err.status = response.status;
    err.body = json;
    throw err;
  }

  return json;
}

// يبني جسم طلب /accommodations/search من مدخلات الفورم في الواجهة
function buildSearchInput(form) {
  const body = {
    booker: {
      country: form.bookerCountry,
      platform: form.bookerPlatform || 'desktop',
    },
    checkin: form.checkin,
    checkout: form.checkout,
    guests: {
      number_of_adults: Number(form.adults) || 1,
      number_of_rooms: Number(form.rooms) || 1,
    },
    rows: Number(form.rows) || 20,
    extras: ['products'],
  };

  if (Array.isArray(form.childrenAges) && form.childrenAges.length) {
    body.guests.children = form.childrenAges.map(Number);
  }

  if (form.currency) body.currency = form.currency.toUpperCase();

  switch (form.locationType) {
    case 'country':
      body.country = form.country;
      break;
    case 'city':
      body.city = Number(form.cityId);
      break;
    case 'region':
      body.region = Number(form.regionId);
      break;
    case 'coordinates':
      body.coordinates = {
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius: Number(form.radius) || 10,
      };
      break;
    default:
      throw Object.assign(new Error('locationType غير صالح'), { status: 400 });
  }

  return body;
}

app.post('/api/search', async (req, res) => {
  if (!credentialsConfigured) {
    return res.status(500).json({
      errors: [{ id: 'missing_credentials', message: 'لم يتم ضبط مفاتيح Booking.com API في ملف .env على الخادم.' }],
    });
  }

  let searchInput;
  try {
    searchInput = buildSearchInput(req.body || {});
  } catch (e) {
    return res.status(e.status || 400).json({ errors: [{ id: 'invalid_input', message: e.message }] });
  }

  try {
    const searchResult = await callBookingApi('/accommodations/search', searchInput);
    const items = searchResult.data || [];

    let detailsById = {};
    if (items.length) {
      const ids = items.map((item) => item.id).slice(0, 100);
      const detailsResult = await callBookingApi('/accommodations/details', {
        accommodations: ids,
        extras: ['photos'],
        languages: [req.body.language || 'en-us'],
      });
      detailsById = Object.fromEntries((detailsResult.data || []).map((d) => [d.id, d]));
    }

    const merged = items.map((item) => {
      const detail = detailsById[item.id] || {};
      const mainPhoto = (detail.photos || []).find((p) => p.main_photo) || (detail.photos || [])[0];
      return {
        id: item.id,
        name: detail.name || {},
        address: detail.location?.address || {},
        city: detail.location?.city,
        country: detail.location?.country,
        stars: detail.rating?.stars ?? null,
        review_score: detail.rating?.review_score ?? null,
        number_of_reviews: detail.rating?.number_of_reviews ?? null,
        photo_url: mainPhoto?.url || null,
        price: item.price,
        currency: item.currency,
        commission: item.commission,
        url: item.url,
        deep_link_url: item.deep_link_url,
      };
    });

    res.json({
      request_id: searchResult.request_id,
      count: merged.length,
      next_page: searchResult.metadata?.next_page || null,
      data: merged,
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 502).json(
      e.body || { errors: [{ id: 'upstream_error', message: e.message }] }
    );
  }
});

app.listen(PORT, () => {
  console.log(`\n✔ السيرفر يعمل على: http://localhost:${PORT}`);
  console.log(`  البيئة المستهدفة: ${BOOKING_API_BASE}`);
  console.log(`  بيانات الاعتماد مضبوطة: ${credentialsConfigured ? 'نعم' : 'لا — عدّل ملف .env'}\n`);
});
