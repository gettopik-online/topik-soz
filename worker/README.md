# 쓰기 backend (Cloudflare Worker)

Talaba 쓰기 (51/52/53/54) mashqini tugatgach PDF shu Worker'ga yuboriladi,
ustoz `?ustoz=1` panelidagi "쓰기 — talabalar PDF'lari" bo'limidan
ko'rib/yuklab oladi.

## Deploy qilish (bir martalik, faqat siz bajarishingiz mumkin)

```bash
npm install -g wrangler
wrangler login
```

Brauzerda Cloudflare hisobingizga kirish so'raladi.

KV (saqlash joyi) yarating:

```bash
cd worker
wrangler kv namespace create SUBMISSIONS
```

Chiqqan `id` qiymatini `wrangler.toml`dagi `REPLACE_WITH_KV_NAMESPACE_ID`
o'rniga yozing.

Ustoz paroli (saytdagi bilan bir xil bo'lishi kerak — `ustoz2026`):

```bash
wrangler secret put TEACHER_PASS
```
(so'ralganda `ustoz2026` deb kiriting)

Deploy qiling:

```bash
wrangler deploy
```

Konsolda chiqqan manzilni (masalan
`https://topik-yozish-api.<sizning-subdomen>.workers.dev`) nusxalab oling.

## Saytga ulash

`../index.html` faylida:

```js
const SS_API='https://REPLACE-ME.workers.dev';
```

qatorini yuqoridagi haqiqiy Worker manziliga almashtiring, so'ng commit va
push qiling. Shundan keyin talaba PDF'lari avtomatik ustoz paneliga tushadi.
