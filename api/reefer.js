// Слежение за работой рефов 24/7.
//
// Что делает один вызов /api/reefer:
//   1) спрашивает у CAP текущее состояние рефов (через наш же прокси /api/cap — ключ остаётся в CAP_KEY);
//   2) сравнивает с тем, что записано в базе (/reefer);
//   3) если реф включился или выключился — записывает новое состояние и ВРЕМЯ, когда это заметили;
//   4) отдаёт список: какой реф заведён и с какого времени.
//
// Чтобы слежение шло круглосуточно (и когда программа ни у кого не открыта),
// этот адрес надо вызывать по расписанию — раз в 5 минут (cron-job.org).
// Открытая программа тоже вызывает его сама раз в 5 минут.
//
// Ключей здесь нет. Адрес базы не секрет — он и так есть в приложении.

const DB = (process.env.FIREBASE_URL || "https://egida-transapp-default-rtdb.europe-west1.firebasedatabase.app").replace(/\/+$/, "");

// не дёргаем CAP чаще раза в минуту, даже если адрес вызывают часто
let LAST = { at: 0, body: null };

// из строки CAP достаём состояние рефа и температуру (sensors бывает объектом или массивом)
function pick(row) {
  let state = null, temp = null, at = null;
  const s = row && row.sensors;
  const take = function (x) {
    if (!x) return;
    if (state == null && x.reefer_state != null) state = x.reefer_state;
    if (temp == null && x.value_c != null) { temp = Number(x.value_c); at = x.measured_at || at; }
  };
  if (Array.isArray(s)) s.forEach(take); else take(s);
  take(row);
  state = (state === "on" || state === "off") ? state : null;
  return { state: state, temp: temp, at: at || null };
}

// ключ записи в базе: vehicle_id, а если его нет — имя без запрещённых символов
function keyOf(row) {
  if (row && row.vehicle_id != null && String(row.vehicle_id).trim() !== "") return "v" + String(row.vehicle_id).trim();
  const n = String((row && row.name) || "").replace(/[.$#\[\]\/\s]+/g, "_");
  return n ? "n_" + n : "";
}

// Чистая функция: текущее из CAP + сохранённое -> что записать в базу.
// База — единственный источник: все компьютеры читают одно и то же оттуда.
function diff(data, stored, nowISO) {
  const list = [], patch = {};
  let changed = 0;
  (data || []).forEach(function (row) {
    const k = keyOf(row); if (!k) return;
    const cur = pick(row);
    const prev = (stored && stored[k]) || null;
    const hadState = !!(prev && (prev.state === "on" || prev.state === "off"));
    const name = String(row.name || "");

    if (cur.state == null && !hadState) {
      // у этой техники рефа нет (тягач) — не храним и не показываем
      if (prev) patch["reefer/" + k] = null;
      return;
    }
    let rec;
    if (cur.state == null) {
      // датчик сейчас молчит: время не сбрасываем, помечаем, что данных нет
      rec = { id: k, name: name, state: prev.state, since: prev.since || null, temp: cur.temp, at: cur.at, live: false };
      if (prev.prev) rec.prev = prev.prev;
    } else if (!hadState || prev.state !== cur.state) {
      // реф включился / выключился (или видим его впервые) — отсчёт с этой минуты
      rec = { id: k, name: name, state: cur.state, since: nowISO, temp: cur.temp, at: cur.at, live: true };
      if (hadState) rec.prev = { state: prev.state, since: prev.since || null };   // что было до этого
      changed++;
    } else {
      rec = { id: k, name: name, state: prev.state, since: prev.since || nowISO, temp: cur.temp, at: cur.at, live: true };
      if (prev.prev) rec.prev = prev.prev;
    }
    patch["reefer/" + k] = rec;
    list.push(rec);
  });
  return { list: list, patch: patch, changed: changed };
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const now = Date.now();
  if (LAST.body && now - LAST.at < 60 * 1000) {
    res.status(200).json(Object.assign({ cached: true }, LAST.body, { now: new Date(now).toISOString() }));
    return;
  }

  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();

    // 1) CAP — через наш прокси (там ключ и подбор способа авторизации)
    const cr = await fetch(proto + "://" + host + "/api/cap?path=temperature/current", { headers: { "Accept": "application/json" } });
    const cj = await cr.json().catch(function () { return null; });
    if (!cr.ok || !cj) {
      res.status(502).json({ ok: false, error: "cap", message: "CAP не ответил", detail: cj });
      return;
    }
    const data = Array.isArray(cj) ? cj : (Array.isArray(cj.data) ? cj.data : null);
    if (!data) {
      res.status(502).json({ ok: false, error: "cap_format", message: "CAP вернул не список" });
      return;
    }

    // 2) что записано в базе
    const sr = await fetch(DB + "/reefer.json");
    if (!sr.ok) {
      res.status(502).json({ ok: false, error: "db_read", message: "База не ответила: HTTP " + sr.status });
      return;
    }
    const stored = (await sr.json().catch(function () { return null; })) || {};

    // 3) сравниваем и записываем изменения + отметку «последняя проверка»
    const nowISO = new Date(now).toISOString();
    const out = diff(data, stored, nowISO);
    const patch = Object.assign({}, out.patch);
    patch["reefer_meta/tickAt"] = nowISO;
    const wr = await fetch(DB + "/.json", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });

    const body = { ok: true, tickAt: nowISO, saved: wr.ok, changed: out.changed, list: out.list };
    if (wr.ok) LAST = { at: now, body: body };
    // now — точное время сервера: по нему программа сверяет часы компьютера
    res.status(200).json(Object.assign({}, body, { now: new Date().toISOString() }));
  } catch (e) {
    res.status(500).json({ ok: false, error: "exception", message: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.diff = diff;   // для проверки логики
module.exports.pick = pick;
