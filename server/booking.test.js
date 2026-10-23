import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./index.js";

const FIXED_NOW = new Date("2026-10-23T15:15:00.000Z"); // Friday, 12:15 in Fortaleza.
const defaultBooking = {
  serviceId: "corte",
  professionalId: "rafael",
  date: "2026-10-24",
  time: "09:00",
  name: "João da Silva",
  phone: "(85) 99999-1234",
};

async function withApi(t, { dbPath = ":memory:", now = () => FIXED_NOW } = {}) {
  const app = createApp({ dbPath, now });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    app.locals.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  return {
    get: async (url) => {
      const response = await fetch(root + url);
      return { status: response.status, body: await response.json() };
    },
    book: async (overrides = {}) => {
      const response = await fetch(`${root}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...defaultBooking, ...overrides }),
      });
      return {
        status: response.status,
        body: await response.json(),
        headers: response.headers,
      };
    },
    root,
  };
}

function availability(
  date = "2026-10-24",
  serviceId = "corte",
  professionalId = "rafael",
) {
  return `/api/availability?${new URLSearchParams({ date, serviceId, professionalId })}`;
}

test("catalog and health expose the working service contract", async (t) => {
  const api = await withApi(t);
  assert.deepEqual(await api.get("/api/health"), {
    status: 200,
    body: { status: "ok" },
  });
  const catalog = await api.get("/api/catalog");
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.services.length, 4);
  assert.equal(catalog.body.professionals.length, 3);
  assert.equal(catalog.body.business.timeZone, "America/Fortaleza");
  assert.equal(catalog.body.business.phone, "(85) 3333-2020");
  assert.equal(
    catalog.body.business.address,
    "Av. Dom Luís, 500 · Meireles, Fortaleza — CE",
  );
  assert.equal(
    catalog.body.services.find(({ id }) => id === "combo").duration,
    70,
  );
  assert.equal((await api.get("/api/bookings")).status, 404);
});

test("availability respects duration, opening days, and past times in Fortaleza", async (t) => {
  const api = await withApi(t);
  const today = await api.get(availability("2026-10-23"));
  assert.equal(today.status, 200);
  assert.equal(today.body.slots[0], "12:30");
  assert.equal(today.body.slots.at(-1), "18:00");
  const combo = await api.get(availability("2026-10-24", "combo"));
  assert.equal(combo.body.slots[0], "09:00");
  assert.equal(combo.body.slots.at(-1), "17:30");
  assert.deepEqual((await api.get(availability("2026-10-25"))).body.slots, []);
  assert.deepEqual((await api.get(availability("2026-10-26"))).body.slots, []);
});

test("booking persists and removes overlapping slots across different services", async (t) => {
  const api = await withApi(t);
  const result = await api.book();
  assert.equal(result.status, 201);
  assert.match(result.body.booking.id, /^[a-f0-9-]{36}$/);
  assert.match(result.body.booking.reference, /^BRV-261024-[A-F0-9]{6}$/);
  assert.equal(result.body.booking.customerName, "João da Silva");
  assert.equal(result.body.booking.price, 55);
  assert.equal(result.body.booking.duration, 40);
  assert.equal("phone" in result.body.booking, false);
  const slots = (await api.get(availability("2026-10-24", "barba"))).body.slots;
  assert.equal(slots.includes("09:00"), false);
  assert.equal(slots.includes("09:30"), false);
  assert.equal(slots.includes("10:00"), true);
  assert.equal(
    (await api.book({ serviceId: "barba", time: "09:30" })).status,
    409,
  );
  assert.equal((await api.book({ professionalId: "lucas" })).status, 201);
  assert.equal(
    (await api.book({ serviceId: "barba", time: "10:00" })).status,
    201,
  );
});

test("duration overlap is checked in both directions and adjacent appointments are accepted", async (t) => {
  const api = await withApi(t);
  assert.equal(
    (await api.book({ serviceId: "barba", time: "10:00" })).status,
    201,
  );
  assert.equal(
    (await api.book({ serviceId: "combo", time: "09:00" })).status,
    409,
  );
  assert.equal(
    (await api.book({ serviceId: "barba", time: "09:30" })).status,
    201,
  );
  assert.equal(
    (await api.book({ serviceId: "barba", time: "10:30" })).status,
    201,
  );
});

test("simultaneous requests cannot reserve overlapping appointments", async (t) => {
  const api = await withApi(t);
  const outcomes = await Promise.all([
    api.book(),
    api.book({ serviceId: "barba", time: "09:30" }),
  ]);
  assert.deepEqual(outcomes.map(({ status }) => status).sort(), [201, 409]);
});

test("invalid inputs and closed or past appointment times are rejected", async (t) => {
  const api = await withApi(t);
  const cases = [
    { date: "2026-02-30" },
    { date: "2026-10-22" },
    { date: "2026-12-23" },
    { date: "2026-10-25" },
    { date: "2026-10-23", time: "12:00" },
    { time: "25:00" },
    { time: "09:10" },
    { serviceId: "combo", time: "18:00" },
    { serviceId: "inventado" },
    { professionalId: "" },
    { name: "A" },
    { phone: "abc99999999999" },
    { phone: "123" },
    { injected: "unexpected" },
  ];
  for (const overrides of cases) {
    const result = await api.book(overrides);
    assert.equal(result.status, 400, JSON.stringify(overrides));
    assert.equal(typeof result.body.error, "string");
  }
});

test("availability validates date bounds and requires a known professional", async (t) => {
  const api = await withApi(t);
  for (const url of [
    availability("2026-02-30"),
    availability("2026-10-22"),
    availability("2026-12-23"),
    availability("2026-10-24", "corte", ""),
    "/api/availability?date=2026-10-24&serviceId=corte",
  ]) {
    assert.equal((await api.get(url)).status, 400, url);
  }
  assert.equal((await api.get(availability("2026-12-22"))).status, 200); // Inclusive 60-day limit.
});

test("the booking date boundary follows Fortaleza rather than UTC", async (t) => {
  const api = await withApi(t, {
    now: () => new Date("2026-10-24T01:00:00.000Z"),
  });
  const friday = await api.get(availability("2026-10-23"));
  assert.equal(friday.status, 200); // Still 22:00 Friday locally.
  assert.deepEqual(friday.body.slots, []);
  assert.equal((await api.get(availability("2026-12-22"))).status, 200);
  assert.equal((await api.get(availability("2026-12-23"))).status, 400);
});

test("bookings survive closing and reopening the SQLite database", async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bravo-booking-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, "bookings.sqlite");
  await t.test("write appointment", async (child) => {
    const api = await withApi(child, { dbPath });
    assert.equal((await api.book()).status, 201);
  });
  await t.test("reopen and preserve occupied time", async (child) => {
    const api = await withApi(child, { dbPath });
    assert.equal((await api.book()).status, 409);
  });
});

test("malformed JSON has a safe error and booking attempts are rate limited", async (t) => {
  const api = await withApi(t);
  const malformed = await fetch(`${api.root}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal(typeof (await malformed.json()).error, "string");
  for (let i = 0; i < 15; i++) await api.book({ phone: "" });
  const limited = await api.book();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
});
