# صفحة بحث أماكن الإقامة — Booking.com Demand API

تطبيق محلي حقيقي (Node.js + Express) يقوم بالبحث الفعلي عن أماكن الإقامة عبر:
- `POST /accommodations/search` — للحصول على النتائج والأسعار.
- `POST /accommodations/details` — لإثراء النتائج بالاسم، العنوان، الصور، والتقييم (لأن `/accommodations/search` وحدها لا تُرجع هذه البيانات).

## لماذا يوجد خادم Node بينهما؟

نقطة `/accommodations/search` هي **Server-to-Server API**:
- تتطلب `Bearer Token` سري + `X-Affiliate-Id` — لا يجوز وضعهما في كود يعمل داخل المتصفح.
- لا تدعم CORS، فأي طلب مباشر من متصفح إلى `demandapi.booking.com` سيُرفَض.

لذلك يقوم خادم Express المحلي بدور **وسيط (Proxy)**: الواجهة (المتصفح) تتحدث فقط مع `localhost`، والخادم هو من يحمل المفاتيح السرية ويتحدث فعليًا مع Booking.com.

```
المتصفح (index.html) → localhost:4000/api/search → Booking.com Demand API
```

## خطوات التشغيل

### 1. المتطلبات
- Node.js نسخة 18 أو أحدث (يستخدم `fetch` المدمج).
- حساب Affiliate Partner لدى Booking.com مع بيانات اعتماد Demand API (Affiliate ID + Bearer Token). تُطلب من Partner Hub الخاص بك.

### 2. التثبيت
```bash
cd accommodation-search-app
npm install
```

### 3. ضبط بيانات الاعتماد
```bash
copy .env.example .env
```
ثم افتح `.env` واملأ:
```
BOOKING_API_BASE=https://demandapi-sandbox.booking.com/3.2
BOOKING_AFFILIATE_ID=رقم_الشريك_الخاص_بك
BOOKING_BEARER_TOKEN=التوكن_السري_الخاص_بك
```
> ابدأ ببيئة **Sandbox** دائمًا. لا تستخدم Production إلا بعد التأكد من عمل كل شيء بشكل صحيح.

### 4. التشغيل
```bash
npm start
```
ثم افتح المتصفح على: **http://localhost:4000**

## كيف يعمل التدفّق داخل الخادم (`server.js`)

1. الواجهة ترسل بيانات الفورم (موقع، تواريخ، عدد ضيوف، عملة...) إلى `POST /api/search` على الخادم المحلي.
2. الخادم يبني جسم الطلب المطابق لـ schema الرسمي (`AccommodationsSearchInput`) ويستدعي `/accommodations/search` على Booking.com مع الهيدرز السرية.
3. من نتائج البحث، يأخذ الخادم قائمة `id` الخاصة بأماكن الإقامة (حتى 100)، ويستدعي `/accommodations/details` مع `extras: ["photos"]` لجلب الاسم والعنوان والصورة والتقييم لنفس الأماكن.
4. يدمج الخادم النتيجتين معًا (سعر من `/search` + بيانات وصفية من `/details`) ويرسلهما كـ JSON واحد للواجهة.
5. الواجهة (`app.js`) تعرض كل مكان إقامة كبطاقة: صورة، اسم، عنوان، تقييم، سعر، ورابطين (عرض على Booking.com / فتح بالتطبيق).

## ملاحظات مهمة

- **الأخطاء**: أي خطأ يُرجعه Booking.com (بيانات اعتماد خاطئة، حقول ناقصة...) يأتي دائمًا بنفس الشكل الموحّد (`error_response`: `request_id` + `errors[]`)، ويظهر مباشرة في صندوق الحالة أعلى النتائج.
- **العملة**: إذا لم تحدد عملة، سيعرض Booking.com الأسعار بعملة كل مكان إقامة الأساسية (قد تختلف من نتيجة لأخرى).
- **الموقع**: يجب اختيار طريقة واحدة فقط لتحديد الموقع (دولة/مدينة/منطقة/إحداثيات) — الفورم يوضّح هذا تلقائيًا.
- هذا مشروع تجريبي/تعليمي بسيط، وليس جاهزًا للإنتاج (بدون تخزين مؤقت، بدون معالجة Rate Limits، بدون قاعدة بيانات).
