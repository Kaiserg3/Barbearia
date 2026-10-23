import express from "express";
import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TIME_ZONE = "America/Fortaleza";
const OPEN = 9 * 60;
const CLOSE = 19 * 60;
const SLOT_INTERVAL = 30;
const MAX_DAYS = 60;
const ADMIN_COOKIE = "bravo_admin_session";
const ADMIN_SESSION_MS = 8 * 60 * 60_000;
const LOGIN_WINDOW_MS = 15 * 60_000;

const services = [
  {
    id: "corte",
    name: "Corte masculino",
    description:
      "Na tesoura, na máquina ou no degradê. Um corte pensado para você.",
    price: 55,
    duration: 40,
    category: "Cabelo",
  },
  {
    id: "barba",
    name: "Barba completa",
    description:
      "Desenho, toalha quente e finalização para uma barba no ponto.",
    price: 40,
    duration: 30,
    category: "Barba",
  },
  {
    id: "combo",
    name: "Corte + barba",
    description: "O cuidado completo, do corte ao último detalhe da barba.",
    price: 85,
    duration: 70,
    category: "Combo",
  },
  {
    id: "acabamento",
    name: "Acabamento",
    description: "Pezinho e contornos alinhados para renovar o visual.",
    price: 20,
    duration: 20,
    category: "Detalhes",
  },
];

const professionals = [
  {
    id: "rafael",
    name: "Rafael Costa",
    role: "Cortes clássicos & degradê",
    initials: "RC",
  },
  { id: "lucas", name: "Lucas Alves", role: "Barba & estilo", initials: "LA" },
  {
    id: "andre",
    name: "André Santos",
    role: "Tesoura & acabamento",
    initials: "AS",
  },
];

const business = {
  name: "BRAVO.",
  timeZone: TIME_ZONE,
  phone: "(85) 3333-2020",
  address: "Av. Dom Luís, 500 · Meireles, Fortaleza — CE",
  hours: "Terça a sábado, das 9h às 19h",
};

const localFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function localNow(now) {
  const values = Object.fromEntries(
    localFormatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minute: Number(values.hour) * 60 + Number(values.minute),
  };
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function dayNumber(date) {
  return Date.parse(`${date}T12:00:00.000Z`) / 86_400_000;
}

function isOpen(date) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day >= 2 && day <= 6;
}

function timeString(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function overlaps(start, duration, booking) {
  return (
    start < booking.start_minute + booking.duration &&
    start + duration > booking.start_minute
  );
}

function selection(input, now) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { error: "Informe os dados do agendamento." };
  const { date, serviceId, professionalId } = input;
  const service = services.find((item) => item.id === serviceId);
  const professional = professionals.find((item) => item.id === professionalId);
  if (!service) return { error: "Selecione um serviço válido." };
  if (!professional) return { error: "Selecione um profissional válido." };
  if (!validDate(date))
    return { error: "Informe uma data válida no formato AAAA-MM-DD." };
  const current = localNow(now);
  const daysAhead = dayNumber(date) - dayNumber(current.date);
  if (daysAhead < 0 || daysAhead > MAX_DAYS)
    return { error: "Escolha uma data entre hoje e os próximos 60 dias." };
  return { service, professional, date, current };
}

function bookingView(row, service, professional) {
  return {
    id: row.id,
    reference: row.reference,
    serviceName: service.name,
    professionalName: professional.name,
    date: row.date,
    time: row.time,
    duration: service.duration,
    price: service.price,
    customerName: row.customer_name,
  };
}

/** Create an isolated API. `now` can be injected for deterministic date tests. */
export function createApp({
  dbPath = process.env.DB_PATH || path.join(ROOT, "data/bookings.sqlite"),
  now = () => new Date(),
  adminPassword = process.env.BRAVO_ADMIN_PASSWORD || "",
  secureCookies = process.env.NODE_ENV === "production",
} = {}) {
  if (dbPath !== ":memory:")
    mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      service_id TEXT NOT NULL,
      professional_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      start_minute INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      price INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bookings_schedule ON bookings(professional_id, date);
  `);
  const appointments = db.prepare(
    "SELECT start_minute, duration FROM bookings WHERE professional_id = ? AND date = ?",
  );
  const insert = db.prepare(`INSERT INTO bookings
    (id, reference, service_id, professional_id, date, time, start_minute, duration, price, customer_name, customer_phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const adminBookings = db.prepare(`SELECT * FROM bookings
    WHERE date = ? AND (? IS NULL OR professional_id = ?)
    ORDER BY start_minute, professional_id, id`);
  const adminConfigured =
    typeof adminPassword === "string" &&
    adminPassword.length >= 12 &&
    adminPassword.length <= 1024;
  const adminDigest = adminConfigured
    ? createHash("sha256").update(adminPassword).digest()
    : null;
  const sessions = new Map();
  const loginAttempts = new Map();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: Boolean(secureCookies),
    path: "/api/admin",
  };

  function sessionToken(req) {
    const matches = (req.get("cookie") || "")
      .split(";")
      .map((item) => item.trim())
      .filter((item) => item.startsWith(`${ADMIN_COOKIE}=`));
    if (matches.length !== 1) return null;
    const token = matches[0].slice(ADMIN_COOKIE.length + 1);
    return /^[a-f0-9]{64}$/.test(token) ? token : null;
  }

  function authenticated(req) {
    const timestamp = now().valueOf();
    for (const [token, expiresAt] of sessions) {
      if (expiresAt <= timestamp) sessions.delete(token);
    }
    const token = sessionToken(req);
    return token !== null && sessions.has(token);
  }

  const app = express();
  app.disable("x-powered-by");
  app.locals.close = () => {
    sessions.clear();
    db.close();
  };
  app.use("/api", (_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    next();
  });
  app.use(express.json({ limit: "8kb" }));
  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });
  app.get("/api/catalog", (_req, res) =>
    res.json({ services, professionals, business }),
  );

  // Keep proxy trust disabled. The development proxy must preserve the original
  // Host with changeOrigin:false; forwarded headers never authorize a request.
  app.use("/api/admin", (req, res, next) => {
    if (req.method !== "POST") return next();
    if (
      (req.get("content-type") || "").split(";")[0].trim().toLowerCase() !==
      "application/json"
    ) {
      return res
        .status(415)
        .json({ error: "Envie a solicitação como application/json." });
    }
    try {
      const supplied = req.get("origin");
      const origin = new URL(supplied);
      if (
        !["http:", "https:"].includes(origin.protocol) ||
        supplied !== origin.origin ||
        origin.host.toLowerCase() !== (req.get("host") || "").toLowerCase()
      ) {
        return res
          .status(403)
          .json({ error: "Origem da solicitação não permitida." });
      }
    } catch {
      return res
        .status(403)
        .json({ error: "Origem da solicitação não permitida." });
    }
    return next();
  });

  app.get("/api/admin/session", (req, res) => {
    res.json({
      authenticated: authenticated(req),
      configured: adminConfigured,
    });
  });

  app.post("/api/admin/login", (req, res) => {
    if (!adminConfigured) {
      return res
        .status(503)
        .json({ error: "O acesso do proprietário ainda não foi configurado." });
    }
    const timestamp = now().valueOf();
    for (const [key, bucket] of loginAttempts) {
      if (bucket.resetAt <= timestamp) loginAttempts.delete(key);
    }
    const key = req.ip || "unknown";
    const bucket = loginAttempts.get(key) || {
      count: 0,
      resetAt: timestamp + LOGIN_WINDOW_MS,
    };
    bucket.count += 1;
    loginAttempts.set(key, bucket);
    if (bucket.count > 5) {
      res.set(
        "Retry-After",
        String(Math.ceil((bucket.resetAt - timestamp) / 1000)),
      );
      return res
        .status(429)
        .json({
          error:
            "Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.",
        });
    }
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.password !== "string" ||
      body.password.length > 1024
    ) {
      return res
        .status(400)
        .json({ error: "Informe a senha do proprietário." });
    }
    const suppliedDigest = createHash("sha256").update(body.password).digest();
    if (!timingSafeEqual(suppliedDigest, adminDigest)) {
      return res.status(401).json({ error: "Senha incorreta." });
    }
    // Rotate an existing session rather than retaining a caller-supplied token.
    const previous = sessionToken(req);
    if (previous) sessions.delete(previous);
    authenticated(req); // Expire stale sessions before issuing another one.
    const token = randomBytes(32).toString("hex");
    sessions.set(token, timestamp + ADMIN_SESSION_MS);
    res.cookie(ADMIN_COOKIE, token, {
      ...cookieOptions,
      maxAge: ADMIN_SESSION_MS,
    });
    return res.json({ authenticated: true, configured: true });
  });

  app.post("/api/admin/logout", (req, res) => {
    const token = sessionToken(req);
    if (token) sessions.delete(token);
    res.clearCookie(ADMIN_COOKIE, cookieOptions);
    return res.json({ authenticated: false, configured: adminConfigured });
  });

  app.get("/api/admin/bookings", (req, res) => {
    if (!authenticated(req)) {
      return res
        .status(401)
        .json({
          error: "Entre como proprietário para consultar os agendamentos.",
        });
    }
    const { date, professionalId } = req.query;
    if (
      Object.keys(req.query).some(
        (key) => !["date", "professionalId"].includes(key),
      ) ||
      !validDate(date) ||
      (professionalId !== undefined &&
        !professionals.some(({ id }) => id === professionalId))
    ) {
      return res
        .status(400)
        .json({
          error: "Informe uma data e um profissional válidos para a consulta.",
        });
    }
    const bookings = adminBookings
      .all(date, professionalId ?? null, professionalId ?? null)
      .map((row) => ({
        id: row.id,
        reference: row.reference,
        serviceId: row.service_id,
        serviceName:
          services.find(({ id }) => id === row.service_id)?.name ||
          row.service_id,
        professionalId: row.professional_id,
        professionalName:
          professionals.find(({ id }) => id === row.professional_id)?.name ||
          row.professional_id,
        date: row.date,
        time: row.time,
        duration: row.duration,
        price: row.price,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        createdAt: row.created_at,
      }));
    return res.json({
      date,
      bookings,
      summary: {
        count: bookings.length,
        total: bookings.reduce((total, booking) => total + booking.price, 0),
      },
    });
  });

  app.get("/api/availability", (req, res) => {
    if (
      Object.keys(req.query).some(
        (key) => !["date", "serviceId", "professionalId"].includes(key),
      )
    ) {
      return res
        .status(400)
        .json({ error: "Parâmetros de disponibilidade inválidos." });
    }
    const selected = selection(req.query, now());
    if (selected.error) return res.status(400).json({ error: selected.error });
    const { service, professional, date, current } = selected;
    const reserved = appointments.all(professional.id, date);
    const slots = [];
    if (isOpen(date)) {
      for (
        let start = OPEN;
        start + service.duration <= CLOSE;
        start += SLOT_INTERVAL
      ) {
        if (date === current.date && start <= current.minute) continue;
        if (
          !reserved.some((booking) =>
            overlaps(start, service.duration, booking),
          )
        )
          slots.push(timeString(start));
      }
    }
    return res.json({ date, slots });
  });

  // Per-process protection for the public booking endpoint; never retain customer data here.
  const attempts = new Map();
  app.post("/api/bookings", (req, res) => {
    const timestamp = Date.now();
    for (const [key, value] of attempts)
      if (value.resetAt <= timestamp) attempts.delete(key);
    const key = req.ip || "unknown";
    const bucket = attempts.get(key) || {
      count: 0,
      resetAt: timestamp + 15 * 60_000,
    };
    bucket.count += 1;
    attempts.set(key, bucket);
    if (bucket.count > 15) {
      res.set(
        "Retry-After",
        String(Math.ceil((bucket.resetAt - timestamp) / 1000)),
      );
      return res.status(429).json({
        error:
          "Muitas tentativas. Aguarde alguns minutos para tentar novamente.",
      });
    }

    const body = req.body;
    const fields = [
      "serviceId",
      "professionalId",
      "date",
      "time",
      "name",
      "phone",
    ];
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((field) => !fields.includes(field)) ||
      fields.some((field) => typeof body[field] !== "string")
    ) {
      return res.status(400).json({
        error: "Preencha corretamente todos os campos do agendamento.",
      });
    }
    const instant = now();
    const selected = selection(body, instant);
    if (selected.error) return res.status(400).json({ error: selected.error });
    const { service, professional, date, current } = selected;
    if (!isOpen(date))
      return res
        .status(400)
        .json({ error: "A barbearia funciona de terça a sábado." });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))
      return res.status(400).json({ error: "Selecione um horário válido." });
    const [hours, minutes] = body.time.split(":").map(Number);
    const start = hours * 60 + minutes;
    if (
      start < OPEN ||
      start + service.duration > CLOSE ||
      (start - OPEN) % SLOT_INTERVAL !== 0
    ) {
      return res.status(400).json({
        error: "Este horário não está disponível para o serviço escolhido.",
      });
    }
    if (date === current.date && start <= current.minute)
      return res
        .status(400)
        .json({ error: "Este horário já passou. Escolha outro horário." });
    const name = body.name.trim().replace(/\s+/g, " ");
    if (
      name.length < 2 ||
      name.length > 80 ||
      !/^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]+$/u.test(name)
    ) {
      return res
        .status(400)
        .json({ error: "Informe seu nome, com 2 a 80 caracteres." });
    }
    const phone = body.phone.replace(/\D/g, "");
    const nationalPhone =
      phone.length >= 12 && phone.startsWith("55") ? phone.slice(2) : phone;
    if (
      !/^[\d\s()+.\-]{8,24}$/.test(body.phone) ||
      !/^[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(nationalPhone)
    ) {
      return res
        .status(400)
        .json({ error: "Informe um telefone brasileiro válido com DDD." });
    }

    const row = {
      id: randomUUID(),
      reference: `BRV-${date.replaceAll("-", "").slice(2)}-${randomBytes(3).toString("hex").toUpperCase()}`,
      date,
      time: body.time,
      customer_name: name,
    };
    // The write lock covers both the conflict check and insert, including other server processes.
    db.exec("BEGIN IMMEDIATE");
    try {
      if (
        appointments
          .all(professional.id, date)
          .some((booking) => overlaps(start, service.duration, booking))
      ) {
        db.exec("ROLLBACK");
        return res.status(409).json({
          error: "Este horário acabou de ser reservado. Escolha outro horário.",
        });
      }
      insert.run(
        row.id,
        row.reference,
        service.id,
        professional.id,
        date,
        body.time,
        start,
        service.duration,
        service.price,
        name,
        nationalPhone,
        instant.toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return res
      .status(201)
      .json({ booking: bookingView(row, service, professional) });
  });

  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint não encontrado." }),
  );
  if (process.env.NODE_ENV === "production") {
    const dist = path.join(ROOT, "dist");
    if (existsSync(path.join(dist, "index.html"))) {
      app.use(express.static(dist));
      app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
    }
  }
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed")
      return res
        .status(400)
        .json({ error: "O corpo da requisição deve conter JSON válido." });
    if (error.type === "entity.too.large")
      return res
        .status(413)
        .json({ error: "A requisição excedeu o tamanho permitido." });
    // Do not log request payloads, names or phone numbers.
    return res.status(500).json({
      error: "Não foi possível concluir a solicitação. Tente novamente.",
    });
  });
  return app;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const app = createApp();
  const port = Number(process.env.PORT || 3001);
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(`BRAVO. API pronta na porta ${port}.`),
  );
  const shutdown = () =>
    server.close(() => {
      app.locals.close();
      process.exit(0);
    });
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
