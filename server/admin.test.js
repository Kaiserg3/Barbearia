import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./index.js";

// This password belongs only to these isolated in-memory tests.
const TEST_PASSWORD = "senha-ficticia-testes-123";
const FIXED_NOW = new Date("2026-10-23T15:15:00.000Z");
const COOKIE_NAME = "bravo_admin_session";
const defaultBooking = {
  serviceId: "corte",
  professionalId: "rafael",
  date: "2026-10-24",
  time: "10:00",
  name: "João da Silva",
  phone: "+55 (81) 99999-1234",
};

async function withApi(t, options = {}) {
  const app = createApp({
    dbPath: ":memory:",
    now: () => FIXED_NOW,
    adminPassword: TEST_PASSWORD,
    secureCookies: false,
    ...options,
  });
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
  const request = async (
    route,
    { method = "GET", json, body, cookie, origin = "same", headers = {} } = {},
  ) => {
    const requestHeaders = new Headers(headers);
    if (json !== undefined) {
      requestHeaders.set("Content-Type", "application/json");
      body = JSON.stringify(json);
    }
    if (cookie) requestHeaders.set("Cookie", cookie);
    if (
      method !== "GET" &&
      route.startsWith("/api/admin") &&
      origin !== undefined &&
      origin !== false
    ) {
      requestHeaders.set("Origin", origin === "same" ? root : origin);
    }
    const response = await fetch(root + route, {
      method,
      headers: requestHeaders,
      body,
    });
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
      setCookie: response.headers.getSetCookie()[0] || "",
    };
  };
  return {
    request,
    login: (options = {}) =>
      request("/api/admin/login", {
        method: "POST",
        json: { password: TEST_PASSWORD },
        ...options,
      }),
    book: (overrides = {}) =>
      request("/api/bookings", {
        method: "POST",
        json: { ...defaultBooking, ...overrides },
      }),
  };
}

function sessionCookie(login) {
  assert.match(login.setCookie, new RegExp(`^${COOKIE_NAME}=[^;]+`));
  return login.setCookie.split(";", 1)[0];
}

test("admin login issues a protected cookie and authenticates the session", async (t) => {
  const api = await withApi(t);
  assert.deepEqual((await api.request("/api/admin/session")).body, {
    authenticated: false,
    configured: true,
  });
  assert.equal(
    (await api.request("/api/admin/bookings?date=2026-10-24")).status,
    401,
  );
  const login = await api.login();
  assert.equal(login.status, 200);
  assert.deepEqual(login.body, { authenticated: true, configured: true });
  assert.match(login.setCookie, /;\s*Path=\/api\/admin(?:;|$)/i);
  assert.match(login.setCookie, /;\s*HttpOnly(?:;|$)/i);
  assert.match(login.setCookie, /;\s*SameSite=Strict(?:;|$)/i);
  assert.match(login.setCookie, /;\s*Max-Age=28800(?:;|$)/i);
  assert.doesNotMatch(login.setCookie, /;\s*Secure(?:;|$)/i);
  assert.equal(login.setCookie.includes(TEST_PASSWORD), false);
  const cookie = sessionCookie(login);
  assert.deepEqual((await api.request("/api/admin/session", { cookie })).body, {
    authenticated: true,
    configured: true,
  });
  const invalid = await api.request("/api/admin/bookings?date=2026-10-24", {
    cookie: `${COOKIE_NAME}=invented-token`,
  });
  assert.equal(invalid.status, 401);
  assert.equal(typeof invalid.body.error, "string");
});

test("admin stays unconfigured when its password is absent or too short", async (t) => {
  for (const adminPassword of ["", "short-test"]) {
    await t.test(
      adminPassword ? "short password" : "absent password",
      async (child) => {
        const api = await withApi(child, { adminPassword });
        assert.deepEqual((await api.request("/api/admin/session")).body, {
          authenticated: false,
          configured: false,
        });
        const login = await api.login();
        assert.equal(login.status, 503);
        assert.equal(typeof login.body.error, "string");
        assert.equal(login.setCookie, "");
        assert.equal(
          (await api.request("/api/admin/bookings?date=2026-10-24")).status,
          401,
        );
      },
    );
  }
});

test("admin mutations require JSON and a same-host Origin", async (t) => {
  const api = await withApi(t);
  for (const origin of [
    false,
    "null",
    "https://outside.example",
    "https://127.0.0.1.attacker.example",
  ]) {
    const result = await api.login({ origin });
    assert.equal(result.status, 403, String(origin));
    assert.equal(typeof result.body.error, "string");
    assert.equal(result.setCookie, "");
  }
  const forwardedHost = await api.login({
    origin: "https://outside.example",
    headers: { "X-Forwarded-Host": "outside.example" },
  });
  assert.equal(forwardedHost.status, 403);
  const wrongType = await api.request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ password: TEST_PASSWORD }),
  });
  assert.equal(wrongType.status, 415);
  const login = await api.login();
  assert.equal(login.status, 200);
  const cookie = sessionCookie(login);
  const blockedLogout = await api.request("/api/admin/logout", {
    method: "POST",
    json: {},
    cookie,
    origin: "null",
  });
  assert.equal(blockedLogout.status, 403);
  assert.equal(
    (await api.request("/api/admin/session", { cookie })).body.authenticated,
    true,
  );
});

test("admin login rejects wrong passwords and throttles repeated attempts", async (t) => {
  let instant = FIXED_NOW;
  const api = await withApi(t, { now: () => instant });
  for (let attempt = 0; attempt < 5; attempt++) {
    const login = await api.login({
      json: { password: "fictitious-but-incorrect-password" },
    });
    assert.equal(login.status, 401);
    assert.equal(login.setCookie, "");
  }
  const limited = await api.login();
  assert.equal(limited.status, 429);
  assert.equal(typeof limited.body.error, "string");
  assert.equal(limited.setCookie, "");
  assert.equal(
    (await api.login({ headers: { "X-Forwarded-For": "203.0.113.4" } })).status,
    429,
  );
  instant = new Date(FIXED_NOW.valueOf() + 15 * 60_000);
  assert.equal((await api.login()).status, 200);
  const separateApp = await withApi(t);
  assert.equal((await separateApp.login()).status, 200);
});

test("admin sessions expire at eight hours and remain isolated between app instances", async (t) => {
  let instant = FIXED_NOW;
  const api = await withApi(t, { now: () => instant });
  const cookie = sessionCookie(await api.login());
  const isolated = await withApi(t);
  assert.equal(
    (await isolated.request("/api/admin/session", { cookie })).body
      .authenticated,
    false,
  );
  assert.equal(
    (await isolated.request("/api/admin/bookings?date=2026-10-24", { cookie }))
      .status,
    401,
  );
  instant = new Date(FIXED_NOW.valueOf() + 8 * 60 * 60_000 - 1);
  assert.equal(
    (await api.request("/api/admin/session", { cookie })).body.authenticated,
    true,
  );
  instant = new Date(FIXED_NOW.valueOf() + 8 * 60 * 60_000);
  assert.equal(
    (await api.request("/api/admin/session", { cookie })).body.authenticated,
    false,
  );
  assert.equal(
    (await api.request("/api/admin/bookings?date=2026-10-24", { cookie }))
      .status,
    401,
  );
});

test("logout clears the cookie and revokes the server-side session", async (t) => {
  const api = await withApi(t);
  const cookie = sessionCookie(await api.login());
  const logout = await api.request("/api/admin/logout", {
    method: "POST",
    json: {},
    cookie,
  });
  assert.equal(logout.status, 200);
  assert.match(logout.setCookie, new RegExp(`^${COOKIE_NAME}=`));
  const expires = /;\s*Expires=([^;]+)/i.exec(logout.setCookie);
  assert.ok(
    /;\s*Max-Age=0(?:;|$)/i.test(logout.setCookie) ||
      (expires && Date.parse(expires[1]) < FIXED_NOW.valueOf()),
  );
  assert.match(logout.setCookie, /;\s*Path=\/api\/admin(?:;|$)/i);
  assert.equal(
    (await api.request("/api/admin/session", { cookie })).body.authenticated,
    false,
  );
  assert.equal(
    (await api.request("/api/admin/bookings?date=2026-10-24", { cookie }))
      .status,
    401,
  );
});

test("secure cookies follow explicit configuration and the production default", async (t) => {
  const explicit = await withApi(t, { secureCookies: true });
  assert.match((await explicit.login()).setCookie, /;\s*Secure(?:;|$)/i);
  const plain = await withApi(t, { secureCookies: false });
  const spoofed = await plain.login({
    headers: { "X-Forwarded-Proto": "https" },
  });
  assert.equal(spoofed.status, 200);
  assert.doesNotMatch(spoofed.setCookie, /;\s*Secure(?:;|$)/i);
  const previousMode = process.env.NODE_ENV;
  t.after(() => {
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  });
  process.env.NODE_ENV = "production";
  const production = await withApi(t, { secureCookies: undefined });
  assert.match((await production.login()).setCookie, /;\s*Secure(?:;|$)/i);
});

test("admin reporting returns sorted booking details, totals, filters and historical dates", async (t) => {
  let instant = FIXED_NOW;
  const api = await withApi(t, { now: () => instant });
  const bookings = [];
  for (const overrides of [
    {},
    {
      serviceId: "barba",
      professionalId: "lucas",
      time: "09:00",
      name: "Maria Souza",
      phone: "(81) 98888-7777",
    },
    {
      serviceId: "combo",
      time: "14:00",
      name: "Ana Lima",
      phone: "(81) 97777-6666",
    },
  ]) {
    const created = await api.book(overrides);
    assert.equal(created.status, 201);
    assert.equal("customerPhone" in created.body.booking, false);
    assert.equal("phone" in created.body.booking, false);
    bookings.push(created.body.booking);
  }
  const cookie = sessionCookie(await api.login());
  const report = await api.request("/api/admin/bookings?date=2026-10-24", {
    cookie,
  });
  assert.equal(report.status, 200);
  assert.equal(report.body.date, "2026-10-24");
  assert.deepEqual(report.body.summary, { count: 3, total: 180 });
  assert.deepEqual(
    report.body.bookings.map(({ time }) => time),
    ["09:00", "10:00", "14:00"],
  );
  const cut = report.body.bookings.find(({ id }) => id === bookings[0].id);
  assert.deepEqual(cut, {
    id: bookings[0].id,
    reference: bookings[0].reference,
    serviceId: "corte",
    serviceName: "Corte masculino",
    professionalId: "rafael",
    professionalName: "Rafael Costa",
    date: "2026-10-24",
    time: "10:00",
    duration: 40,
    price: 55,
    customerName: "João da Silva",
    customerPhone: "81999991234",
    createdAt: FIXED_NOW.toISOString(),
  });
  const filtered = await api.request(
    "/api/admin/bookings?date=2026-10-24&professionalId=rafael",
    { cookie },
  );
  assert.equal(filtered.status, 200);
  assert.deepEqual(filtered.body.summary, { count: 2, total: 140 });
  assert.ok(
    filtered.body.bookings.every(
      ({ professionalId }) => professionalId === "rafael",
    ),
  );
  const empty = await api.request("/api/admin/bookings?date=2026-10-23", {
    cookie,
  });
  assert.deepEqual(empty.body.bookings, []);
  assert.deepEqual(empty.body.summary, { count: 0, total: 0 });
  instant = new Date("2026-10-28T12:00:00.000Z");
  const newCookie = sessionCookie(await api.login());
  const historical = await api.request("/api/admin/bookings?date=2026-10-24", {
    cookie: newCookie,
  });
  assert.equal(historical.status, 200);
  assert.deepEqual(historical.body.summary, { count: 3, total: 180 });
  assert.match(report.headers.get("Cache-Control"), /no-store/);
});

test("admin query validation and public endpoints do not reveal the customer registry", async (t) => {
  const api = await withApi(t);
  assert.equal((await api.book()).status, 201);
  const cookie = sessionCookie(await api.login());
  for (const route of [
    "/api/admin/bookings",
    "/api/admin/bookings?date=2026-02-30",
    "/api/admin/bookings?date=not-a-date",
    "/api/admin/bookings?date=2026-10-24&professionalId=unknown",
  ]) {
    const result = await api.request(route, { cookie });
    assert.equal(result.status, 400, route);
    assert.equal(typeof result.body.error, "string");
  }
  assert.equal((await api.request("/api/bookings")).status, 404);
  assert.equal(
    (await api.request("/api/admin/bookings?date=2026-10-24")).status,
    401,
  );
  const availability = await api.request(
    "/api/availability?date=2026-10-24&serviceId=corte&professionalId=rafael",
  );
  assert.equal(availability.status, 200);
  const publicData = JSON.stringify(availability.body);
  assert.equal(publicData.includes(defaultBooking.name), false);
  assert.equal(publicData.includes("81999991234"), false);
  assert.deepEqual(Object.keys(availability.body).sort(), ["date", "slots"]);
});
