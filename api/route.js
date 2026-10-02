// Прокси к OpenRouteService — дорожные расстояния для ГРУЗОВИКОВ (профиль driving-hgv).
// Ключ берётся ТОЛЬКО из переменной окружения Vercel ORS_KEY (в коде не храним — репозиторий публичный).
//
// Вызов из приложения (POST, JSON):
//   /api/route   body: { sources: [[lat,lon], ...], target: [lat,lon] }
//   -> { ok:true, km: [..], min: [..] }   (для каждой source: км и минуты по дорогам до target)
//
// Проверка из браузера:
//   /api/route?test=1   -> Минск → Москва по дорогам для фуры

const ORS_URL = "https://api.openrouteservice.org/v2/matrix/driving-hgv";
const ORS_KEY = process.env.ORS_KEY || "";
const BATCH = 40;                 // источников за один запрос (с запасом под лимиты бесплатного тарифа)
const CACHE_MS = 10 * 60 * 1000;  // кэш 10 минут — экономим квоту
const cache = {};                 // живёт пока жив экземпляр функции

function valid(p) {
  return Array.isArray(p) && p.length === 2 &&
    isFinite(p[0]) && isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
}
// округляем для кэша (~100 м), чтобы мелкий дрейф GPS не сбивал кэш
function key(p) { return Number(p[0]).toFixed(3) + "," + Number(p[1]).toFixed(3); }

async function orsBatch(sources, target) {
  // ORS ждёт [ДОЛГОТА, ШИРОТА] — переворачиваем здесь, в одном месте
  const locations = sources.map(function (p) { return [Number(p[1]), Number(p[0])]; });
  locations.push([Number(target[1]), Number(target[0])]);
  const dest = locations.length - 1;
  const body = {
    locations: locations,
    sources: sources.map(function (_, i) { return i; }),
    destinations: [dest],
    metrics: ["distance", "duration"],
    units: "km"
  };
  const r = await fetch(ORS_URL, {
    method: "POST",
    headers: { "Authorization": ORS_KEY, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  if (!r.ok) {
    const msg = (json && json.error && (json.error.message || json.error)) || text.slice(0, 300);
    throw new Error("ORS " + r.status + ": " + msg);
  }
  const km = (json.distances || []).map(function (row) { return row && row[0] != null ? Math.round(row[0]) : null; });
  const min = (json.durations || []).map(function (row) { return row && row[0] != null ? Math.round(row[0] / 60) : null; });
  return { km: km, min: min };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  if (!ORS_KEY) {
    res.status(500).json({ ok: false, error: "no_key",
      message: "Не задан ключ OpenRouteService. Vercel → egida-trans → Settings → Environment Variables → ORS_KEY, затем Redeploy." });
    return;
  }

  let sources, target;
  const q = req.query || {};
  if (q.test === "1") {
    sources = [[53.9006, 27.5590]];      // Минск
    target = [55.7558, 37.6173];         // Москва
  } else {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
    sources = b && b.sources; target = b && b.target;
  }

  if (!Array.isArray(sources) || !sources.length || !valid(target) || !sources.every(valid)) {
    res.status(400).json({ ok: false, error: "bad_input", message: "Нужно: sources [[lat,lon],...] и target [lat,lon]" });
    return;
  }
  if (sources.length > 200) {
    res.status(400).json({ ok: false, error: "too_many", message: "Не больше 200 машин за запрос" });
    return;
  }

  const now = Date.now();
  const tk = key(target);
  const km = new Array(sources.length).fill(null);
  const min = new Array(sources.length).fill(null);

  // что уже есть в кэше — берём оттуда, остальное спрашиваем у ORS
  const need = [];
  sources.forEach(function (p, i) {
    const c = cache[key(p) + ">" + tk];
    if (c && now - c.t < CACHE_MS) { km[i] = c.km; min[i] = c.min; }
    else need.push(i);
  });

  try {
    for (let s = 0; s < need.length; s += BATCH) {
      const idx = need.slice(s, s + BATCH);
      const out = await orsBatch(idx.map(function (i) { return sources[i]; }), target);
      idx.forEach(function (i, j) {
        km[i] = out.km[j]; min[i] = out.min[j];
        cache[key(sources[i]) + ">" + tk] = { km: out.km[j], min: out.min[j], t: now };
      });
    }
  } catch (e) {
    res.status(502).json({ ok: false, error: "ors_failed", message: String((e && e.message) || e) });
    return;
  }

  if (q.test === "1") {
    res.status(200).json({ ok: true, test: "Минск → Москва (фура)", km: km[0], hours: min[0] != null ? +(min[0] / 60).toFixed(1) : null });
    return;
  }
  res.status(200).json({ ok: true, km: km, min: min });
};
