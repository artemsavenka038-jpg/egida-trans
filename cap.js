// Прокси к CAP API (CapNavi) для Fletera.
// Зачем: ключ хранится на сервере Vercel (не в браузере), и запрос идёт
// с сервера за границей — в обход блокировки CAP у белорусских провайдеров.
//
// Ключ берётся из переменной окружения CAP_KEY (задаётся в настройках Vercel),
// а если её нет — из значения по умолчанию ниже (временно, на период отладки).
//
// Вызов из приложения:
//   /api/cap?path=vehicles
//   /api/cap?path=odometer
//   /api/cap?path=temperature/current
//   /api/cap?path=temperature/history&vehicle_id=1065436&from=...&to=...
//   /api/cap?path=vehicles&debug=1   -> покажет, какой способ авторизации сработал

const CAP_BASE = "https://api.svc.cap.by/api/v6";
const CAP_KEY = process.env.CAP_KEY || "019e87e9-de99-7c4e-8007-9e8d8b103c59";

// Разрешённые пути — чтобы через прокси нельзя было дёргать что попало
const ALLOWED = ["vehicles", "odometer", "temperature/current", "temperature/history"];

// Способы передать ключ — перебираем по очереди, пока какой-то не вернёт 200.
// Первый успешный запоминаем и дальше используем только его (см. кэш ниже).
function authVariants(key) {
  return [
    { name: "Bearer",            headers: { "Authorization": "Bearer " + key } },
    { name: "Authorization-raw", headers: { "Authorization": key } },
    { name: "X-API-Key",         headers: { "X-API-Key": key } },
    { name: "X-Api-Key",         headers: { "X-Api-Key": key } },
    { name: "X-Session",         headers: { "X-Session": key } },
    { name: "session-header",    headers: { "session": key } },
    { name: "api-key-header",    headers: { "api-key": key } },
    { name: "token-header",      headers: { "token": key } },
    { name: "query-session",     query: { session: key } },
    { name: "query-token",       query: { token: key } },
    { name: "query-api_key",     query: { api_key: key } },
    { name: "query-key",         query: { key: key } },
  ];
}

// Запоминаем сработавший способ между вызовами (в пределах жизни функции)
let CACHED_VARIANT = null;

function buildUrl(path, params, extraQuery) {
  const u = new URL(CAP_BASE + "/" + path);
  // прокидываем разрешённые параметры запроса (vehicle_id, from, to)
  ["vehicle_id", "from", "to"].forEach(function (k) {
    if (params[k] != null && params[k] !== "") u.searchParams.set(k, params[k]);
  });
  if (extraQuery) Object.keys(extraQuery).forEach(function (k) { u.searchParams.set(k, extraQuery[k]); });
  return u.toString();
}

async function tryFetch(path, params, variant) {
  const url = buildUrl(path, params, variant.query);
  const headers = Object.assign({ "Accept": "application/json" }, variant.headers || {});
  const r = await fetch(url, { method: "GET", headers });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* оставим как текст */ }
  return { status: r.status, ok: r.ok, json, text };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const q = req.query || {};
  const path = String(q.path || "").replace(/^\/+|\/+$/g, "");
  const debug = q.debug === "1";

  if (!ALLOWED.includes(path)) {
    res.status(400).json({ error: "bad_path", message: "path должен быть одним из: " + ALLOWED.join(", ") });
    return;
  }
  if (!CAP_KEY) {
    res.status(500).json({ error: "no_key", message: "Не задан CAP_KEY (переменная окружения на Vercel)." });
    return;
  }

  const variants = authVariants(CAP_KEY);
  // если уже знаем рабочий способ — пробуем сначала его
  const order = CACHED_VARIANT
    ? [variants.find(function (v) { return v.name === CACHED_VARIANT; })].concat(variants.filter(function (v) { return v.name !== CACHED_VARIANT; }))
    : variants;

  const attempts = [];
  for (const variant of order) {
    if (!variant) continue;
    let out;
    try {
      out = await tryFetch(path, q, variant);
    } catch (e) {
      attempts.push({ variant: variant.name, error: String((e && e.message) || e) });
      continue;
    }
    attempts.push({ variant: variant.name, status: out.status });

    if (out.ok) {
      CACHED_VARIANT = variant.name;
      if (debug) {
        res.status(200).json({ _proxy: { ok: true, auth: variant.name, path: path }, data: out.json != null ? out.json : out.text });
      } else {
        res.status(200).json(out.json != null ? out.json : { raw: out.text });
      }
      return;
    }
    // 401/403 — просто пробуем следующий способ; другие коды тоже переберём
  }

  // ничего не сработало — отдаём диагностику, чтобы понять, что хочет CAP
  res.status(502).json({
    error: "cap_unauthorized_or_unreachable",
    message: "Ни один способ авторизации не подошёл. Нужен точный формат от CAP (заголовок и тип ключа).",
    tried: attempts,
  });
};
