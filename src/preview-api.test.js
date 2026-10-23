import assert from "node:assert/strict";
import { test } from "node:test";
import { enablePreviewApi } from "./preview-api.js";

const STORAGE_KEY = "bravo-preview-bookings-v1";
const catalog = {
  services: [
    { id: "corte", name: "Corte masculino", duration: 40, price: 55 },
    { id: "barba", name: "Barba completa", duration: 30, price: 40 },
    { id: "combo", name: "Corte + barba", duration: 70, price: 85 },
  ],
  professionals: [
    { id: "rafael", name: "Rafael Costa" },
    { id: "lucas", name: "Lucas Alves" },
  ],
  business: { name: "BRAVO.", timeZone: "America/Fortaleza" },
};
const booking = {
  serviceId: "corte",
  professionalId: "rafael",
  date: "2026-10-24",
  time: "09:00",
  name: "João da Silva",
  phone: "(81) 99999-1234",
};

async function setup(t, { stored, blocked = false } = {}) {
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-10-23T15:15:00.000Z"),
  });
  const originalWindow = globalThis.window;
  const values = new Map(stored === undefined ? [] : [[STORAGE_KEY, stored]]);
  const storage = {
    blocked,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.blocked)
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  const network = [];
  globalThis.window = {
    location: {
      href: "https://preview.example/landing.html",
      origin: "https://preview.example",
      protocol: "https:",
    },
    localStorage: storage,
    crypto: globalThis.crypto,
    navigator: {},
    fetch: async (...args) => {
      network.push(args);
      return new Response("passthrough", { status: 202 });
    },
  };
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
  const dispose = enablePreviewApi(structuredClone(catalog));
  const request = async (url, options) => {
    const response = await window.fetch(url, options);
    return { status: response.status, body: await response.json() };
  };
  return {
    storage,
    network,
    values,
    request,
    dispose,
    book: (overrides = {}) =>
      request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...booking, ...overrides }),
      }),
    slots: (
      date = "2026-10-24",
      serviceId = "corte",
      professionalId = "rafael",
    ) =>
      request(
        `/api/availability?${new URLSearchParams({ date, serviceId, professionalId })}`,
      ),
  };
}

test("preview returns catalog and health locally and preserves other fetch calls", async (t) => {
  const api = await setup(t);
  assert.deepEqual(await api.request("/api/catalog"), {
    status: 200,
    body: catalog,
  });
  assert.deepEqual(await api.request("/api/health"), {
    status: 200,
    body: { status: "ok" },
  });
  assert.equal(api.network.length, 0);
  const external = await window.fetch("https://example.com/status", {
    method: "GET",
  });
  assert.equal(external.status, 202);
  assert.equal(await external.text(), "passthrough");
  assert.equal(api.network[0][0], "https://example.com/status");
});

test("preview schedules follow Fortaleza time, opening days and service durations", async (t) => {
  const api = await setup(t);
  const today = await api.slots("2026-10-23");
  assert.equal(today.status, 200);
  assert.equal(today.body.slots[0], "12:30");
  assert.equal(today.body.slots.at(-1), "18:00");
  assert.equal(
    (await api.slots("2026-10-24", "combo")).body.slots.at(-1),
    "17:30",
  );
  assert.deepEqual((await api.slots("2026-10-25")).body.slots, []);
  assert.deepEqual((await api.slots("2026-10-26")).body.slots, []);
  t.mock.timers.setTime(Date.parse("2026-10-24T01:00:00.000Z"));
  assert.equal((await api.slots("2026-10-23")).status, 200);
  assert.equal((await api.slots("2026-12-22")).status, 200);
  assert.equal((await api.slots("2026-12-23")).status, 400);
});

test("preview reserves demo appointments without persisting names or phones", async (t) => {
  const api = await setup(t);
  const result = await api.book();
  assert.equal(result.status, 201);
  assert.match(result.body.booking.reference, /^DEMO-/);
  assert.equal(result.body.booking.customerName, booking.name);
  assert.equal(result.body.booking.price, 55);
  assert.equal(result.body.booking.serviceName, "Corte masculino");
  assert.equal(window.__BRAVO_PREVIEW_STORAGE__, "local");
  const persisted = JSON.parse(api.values.get(STORAGE_KEY));
  assert.equal(persisted.length, 1);
  assert.deepEqual(
    Object.keys(persisted[0]).sort(),
    ["id", "serviceId", "professionalId", "date", "time", "duration"].sort(),
  );
  assert.equal(api.values.get(STORAGE_KEY).includes(booking.name), false);
  assert.equal(api.values.get(STORAGE_KEY).includes("99999"), false);
  assert.equal(api.network.length, 0);
  assert.equal(
    (await api.book({ serviceId: "barba", time: "09:30" })).status,
    409,
  );
  const remaining = (await api.slots("2026-10-24", "barba")).body.slots;
  assert.equal(remaining.includes("09:00"), false);
  assert.equal(remaining.includes("09:30"), false);
  assert.equal(remaining.includes("10:00"), true);
  assert.equal((await api.book({ professionalId: "lucas" })).status, 201);
  assert.equal(
    (await api.book({ serviceId: "barba", time: "10:00" })).status,
    201,
  );
});

test("preview rejects invalid dates, selections, fields and times", async (t) => {
  const api = await setup(t);
  for (const overrides of [
    { date: "2026-02-30" },
    { date: "2026-10-22" },
    { date: "2026-12-23" },
    { date: "2026-10-25" },
    { date: "2026-10-23", time: "12:00" },
    { time: "09:10" },
    { time: "25:00" },
    { serviceId: "combo", time: "18:00" },
    { serviceId: "unknown" },
    { professionalId: "" },
    { name: "A" },
    { phone: "letters99999999999" },
    { phone: "123" },
    { extra: true },
  ]) {
    const result = await api.book(overrides);
    assert.equal(result.status, 400, JSON.stringify(overrides));
    assert.equal(typeof result.body.error, "string");
  }
  const malformed = await api.request("/api/bookings", {
    method: "POST",
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await api.slots("2026-10-24", "corte", "")).status, 400);
});

test("preview keeps working in memory when persistent storage fills", async (t) => {
  const api = await setup(t);
  assert.equal(window.__BRAVO_PREVIEW_STORAGE__, "local");
  api.storage.blocked = true;
  assert.equal((await api.book()).status, 201);
  assert.equal(window.__BRAVO_PREVIEW_STORAGE__, "memory");
  assert.equal(
    (await api.book({ serviceId: "barba", time: "09:30" })).status,
    409,
  );
  assert.equal((await api.slots()).body.slots.includes("09:00"), false);
  assert.equal(api.network.length, 0);
});

test("preview starts in memory when browser storage is unavailable", async (t) => {
  const api = await setup(t, { blocked: true });
  assert.equal(window.__BRAVO_PREVIEW_STORAGE__, "memory");
  assert.equal((await api.book()).status, 201);
  assert.equal((await api.book()).status, 409);
  assert.equal(api.network.length, 0);
});

test("preview retains existing appointments in memory when initial storage writes fail", async (t) => {
  const api = await setup(t, {
    blocked: true,
    stored: JSON.stringify([
      {
        id: "saved-demo",
        serviceId: "corte",
        professionalId: "rafael",
        date: "2026-10-24",
        time: "09:00",
        duration: 40,
      },
    ]),
  });
  assert.equal(window.__BRAVO_PREVIEW_STORAGE__, "memory");
  assert.equal((await api.book()).status, 409);
  assert.equal((await api.slots()).body.slots.includes("09:00"), false);
});

test("preview ignores corrupted saved data rather than making network requests", async (t) => {
  const api = await setup(t, { stored: "{broken json" });
  assert.equal((await api.slots()).status, 200);
  assert.equal((await api.book()).status, 201);
  assert.equal(api.network.length, 0);
});

test("preview can restore the minimal local appointment records", async (t) => {
  const api = await setup(t, {
    stored: JSON.stringify([
      {
        id: "saved-demo",
        serviceId: "corte",
        professionalId: "rafael",
        date: "2026-10-24",
        time: "09:00",
        duration: 40,
      },
    ]),
  });
  assert.equal(
    (await api.book({ serviceId: "barba", time: "09:30" })).status,
    409,
  );
  assert.equal((await api.slots()).body.slots.includes("09:00"), false);
});

test("demo owner agenda restores minimal records, orders times and isolates professionals", async (t) => {
  const api = await setup(t);
  assert.equal((await api.book({ time: "11:00" })).status, 201);
  assert.equal(
    (await api.book({ professionalId: "lucas", serviceId: "barba" })).status,
    201,
  );
  assert.equal((await api.book({ date: "2026-10-27" })).status, 201);
  const saved = api.values.get(STORAGE_KEY);
  assert.equal(saved.includes(booking.name), false);
  assert.equal(saved.includes(booking.phone), false);
  api.dispose();
  const restore = enablePreviewApi(structuredClone(catalog));
  const agenda = window.__BRAVO_PREVIEW_AGENDA__({ date: "2026-10-24" });
  assert.deepEqual(agenda.summary, { count: 2, total: 95 });
  assert.deepEqual(
    agenda.bookings.map(({ time }) => time),
    ["09:00", "11:00"],
  );
  assert.equal(agenda.bookings[0].serviceName, "Barba completa");
  assert.equal(agenda.bookings[0].professionalName, "Lucas Alves");
  assert.equal(agenda.bookings[0].customerName, "Reserva demonstrativa");
  assert.equal(agenda.bookings[0].customerPhone, null);
  assert.match(agenda.bookings[0].reference, /^DEMO-/);
  assert.equal(JSON.stringify(agenda).includes(booking.name), false);
  const individual = window.__BRAVO_PREVIEW_AGENDA__({
    date: "2026-10-24",
    professionalId: "rafael",
  });
  assert.deepEqual(individual.summary, { count: 1, total: 55 });
  assert.equal(individual.bookings[0].professionalId, "rafael");
  assert.equal(api.values.get(STORAGE_KEY), saved);
  assert.equal(api.network.length, 0);
  restore();
  assert.equal(window.__BRAVO_PREVIEW_AGENDA__, undefined);
});

test("demo owner agenda reads memory bookings and only its own disposer removes the helper", async (t) => {
  const api = await setup(t, { blocked: true });
  assert.equal((await api.book()).status, 201);
  assert.equal(window.__BRAVO_PREVIEW_STORAGE__, "memory");
  const agenda = window.__BRAVO_PREVIEW_AGENDA__({
    date: booking.date,
    professionalId: booking.professionalId,
  });
  assert.deepEqual(agenda.summary, { count: 1, total: 55 });
  assert.equal(agenda.bookings[0].customerName, "Reserva demonstrativa");
  assert.equal(agenda.bookings[0].customerPhone, null);
  assert.equal(api.values.has(STORAGE_KEY), false);
  assert.deepEqual(
    window.__BRAVO_PREVIEW_AGENDA__({
      date: booking.date,
      professionalId: "lucas",
    }).bookings,
    [],
  );
  const replacement = () => "newer demo";
  window.__BRAVO_PREVIEW_AGENDA__ = replacement;
  api.dispose();
  assert.equal(window.__BRAVO_PREVIEW_AGENDA__, replacement);
  delete window.__BRAVO_PREVIEW_AGENDA__;
});
