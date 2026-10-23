const STORAGE_KEY = "bravo-preview-bookings-v1";
const OPEN = 9 * 60;
const CLOSE = 19 * 60;
const INTERVAL = 30;
const MAX_DAYS = 60;
const ENDPOINTS = new Set([
  "/api/catalog",
  "/api/health",
  "/api/availability",
  "/api/bookings",
]);

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function localNow() {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
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

function timeMinute(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeString(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

/** Explicitly install the offline demo API. No network request is made for its endpoints. */
export function enablePreviewApi(catalog) {
  const browser = window;
  const originalFetch = browser.fetch;
  const { services, professionals } = catalog;
  let bookings = [];
  let storage = null;

  function sanitizeStored(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const service = services.find(({ id }) => id === item.serviceId);
      const start = timeMinute(item.time);
      if (
        typeof item.id !== "string" ||
        item.id.length > 100 ||
        !service ||
        !professionals.some(({ id }) => id === item.professionalId) ||
        !validDate(item.date) ||
        !isOpen(item.date) ||
        item.duration !== service.duration ||
        start === null ||
        start < OPEN ||
        start + item.duration > CLOSE ||
        (start - OPEN) % INTERVAL !== 0
      )
        return [];
      // Deliberately copy only schedule data, never customer details.
      return [
        {
          id: item.id,
          serviceId: item.serviceId,
          professionalId: item.professionalId,
          date: item.date,
          time: item.time,
          duration: item.duration,
        },
      ];
    });
  }

  function useMemory() {
    storage = null;
    browser.__BRAVO_PREVIEW_STORAGE__ = "memory";
  }

  try {
    storage = browser.localStorage;
    const saved = storage.getItem(STORAGE_KEY);
    if (saved !== null) {
      try {
        bookings = sanitizeStored(JSON.parse(saved));
      } catch {
        /* Ignore damaged demo data. */
      }
    }
    const probe = `${STORAGE_KEY}-probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    browser.__BRAVO_PREVIEW_STORAGE__ = "local";
  } catch {
    useMemory();
  }

  function readBookings() {
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw === null) bookings = [];
        else {
          // A damaged value should not disable the rest of the demo.
          try {
            bookings = sanitizeStored(JSON.parse(raw));
          } catch {
            /* Retain valid memory data. */
          }
        }
      } catch {
        useMemory();
      }
    }
    return bookings;
  }
  readBookings();

  function saveBookings(next) {
    bookings = next;
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        useMemory();
      }
    }
  }

  // This local-only demonstration never represents an authenticated owner API.
  function previewAgenda({ date, professionalId = "" } = {}) {
    const agendaBookings = readBookings()
      .filter(
        (item) =>
          item.date === date &&
          (!professionalId || item.professionalId === professionalId),
      )
      .map((item) => {
        const service = services.find(({ id }) => id === item.serviceId);
        const professional = professionals.find(
          ({ id }) => id === item.professionalId,
        );
        return {
          ...item,
          reference: `DEMO-${item.date.replaceAll("-", "").slice(2)}-${item.id.replaceAll("-", "").slice(-6).toUpperCase()}`,
          serviceName: service.name,
          professionalName: professional.name,
          price: service.price,
          customerName: "Reserva demonstrativa",
          customerPhone: null,
        };
      })
      .sort((first, second) => first.time.localeCompare(second.time));
    return {
      date,
      bookings: agendaBookings,
      summary: {
        count: agendaBookings.length,
        total: agendaBookings.reduce((total, item) => total + item.price, 0),
      },
    };
  }

  function selection(input) {
    const { date, serviceId, professionalId } = input;
    const service = services.find((item) => item.id === serviceId);
    const professional = professionals.find(
      (item) => item.id === professionalId,
    );
    if (!service) return { error: "Selecione um serviço válido." };
    if (!professional) return { error: "Selecione um profissional válido." };
    if (!validDate(date))
      return { error: "Informe uma data válida no formato AAAA-MM-DD." };
    const current = localNow();
    const daysAhead = dayNumber(date) - dayNumber(current.date);
    if (daysAhead < 0 || daysAhead > MAX_DAYS)
      return { error: "Escolha uma data entre hoje e os próximos 60 dias." };
    return { service, professional, date, current };
  }

  function conflicting(items, professionalId, date, start, duration) {
    return items.some((item) => {
      const reserved = timeMinute(item.time);
      return (
        item.professionalId === professionalId &&
        item.date === date &&
        start < reserved + item.duration &&
        start + duration > reserved
      );
    });
  }

  function availability(url) {
    const allowed = ["date", "serviceId", "professionalId"];
    if (
      [...url.searchParams.keys()].some(
        (key) =>
          !allowed.includes(key) || url.searchParams.getAll(key).length !== 1,
      )
    )
      return error("Parâmetros de disponibilidade inválidos.");
    const selected = selection(Object.fromEntries(url.searchParams));
    if (selected.error) return error(selected.error);
    const { service, professional, date, current } = selected;
    const reserved = readBookings();
    const slots = [];
    if (isOpen(date)) {
      for (
        let start = OPEN;
        start + service.duration <= CLOSE;
        start += INTERVAL
      ) {
        if (date === current.date && start <= current.minute) continue;
        if (
          !conflicting(reserved, professional.id, date, start, service.duration)
        )
          slots.push(timeString(start));
      }
    }
    return json({ date, slots });
  }

  function reserve(body) {
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
    )
      return error("Preencha corretamente todos os campos do agendamento.");
    const selected = selection(body);
    if (selected.error) return error(selected.error);
    const { service, professional, date, current } = selected;
    if (!isOpen(date)) return error("A barbearia funciona de terça a sábado.");
    const start = timeMinute(body.time);
    if (start === null) return error("Selecione um horário válido.");
    if (
      start < OPEN ||
      start + service.duration > CLOSE ||
      (start - OPEN) % INTERVAL !== 0
    )
      return error(
        "Este horário não está disponível para o serviço escolhido.",
      );
    if (date === current.date && start <= current.minute)
      return error("Este horário já passou. Escolha outro horário.");
    const name = body.name.trim().replace(/\s+/g, " ");
    if (
      name.length < 2 ||
      name.length > 80 ||
      !/^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]+$/u.test(name)
    )
      return error("Informe seu nome, com 2 a 80 caracteres.");
    const phone = body.phone.replace(/\D/g, "");
    const nationalPhone =
      phone.length >= 12 && phone.startsWith("55") ? phone.slice(2) : phone;
    if (
      !/^[\d\s()+.\-]{8,24}$/.test(body.phone) ||
      !/^[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(nationalPhone)
    )
      return error("Informe um telefone brasileiro válido com DDD.");

    const reserved = readBookings();
    if (conflicting(reserved, professional.id, date, start, service.duration))
      return error(
        "Este horário acabou de ser reservado. Escolha outro horário.",
        409,
      );
    const id =
      browser.crypto?.randomUUID?.() ||
      globalThis.crypto?.randomUUID?.() ||
      `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const booking = {
      id,
      serviceId: service.id,
      professionalId: professional.id,
      date,
      time: body.time,
      duration: service.duration,
    };
    saveBookings([
      ...reserved.filter((item) => item.date >= current.date),
      booking,
    ]);
    return json(
      {
        booking: {
          id,
          reference: `DEMO-${date.replaceAll("-", "").slice(2)}-${id.replaceAll("-", "").slice(-6).toUpperCase()}`,
          serviceName: service.name,
          professionalName: professional.name,
          date,
          time: body.time,
          duration: service.duration,
          price: service.price,
          customerName: name,
        },
      },
      201,
    );
  }

  function endpoint(input) {
    const raw = typeof input === "string" ? input : input?.url || String(input);
    try {
      const location = new URL(
        browser.location?.href || "https://bravo.preview/",
      );
      const base =
        location.origin === "null"
          ? "https://bravo.preview/"
          : `${location.origin}/`;
      const url = new URL(raw, base);
      // Absolute external URLs keep using the caller's original fetch.
      const absolute = /^[a-z][a-z\d+.-]*:|^\/\//i.test(raw);
      if (absolute && location.origin === "null") return null;
      if (url.origin !== new URL(base).origin || !ENDPOINTS.has(url.pathname))
        return null;
      return url;
    } catch {
      return null;
    }
  }

  async function previewFetch(input, options = {}) {
    const url = endpoint(input);
    if (!url) return originalFetch.call(browser, input, options);
    const signal = options.signal || input?.signal;
    if (signal?.aborted)
      throw (
        signal.reason ||
        new DOMException("The operation was aborted.", "AbortError")
      );
    const method = (options.method || input?.method || "GET").toUpperCase();
    if (method === "GET" && url.pathname === "/api/catalog")
      return json(catalog);
    if (method === "GET" && url.pathname === "/api/health")
      return json({ status: "ok" });
    if (method === "GET" && url.pathname === "/api/availability")
      return availability(url);
    if (method === "POST" && url.pathname === "/api/bookings") {
      let body;
      try {
        const raw =
          options.body !== undefined
            ? await new Response(options.body).text()
            : await input.clone().text();
        body = JSON.parse(raw);
      } catch {
        return error("O corpo da requisição deve conter JSON válido.");
      }
      if (signal?.aborted)
        throw (
          signal.reason ||
          new DOMException("The operation was aborted.", "AbortError")
        );
      if (storage && browser.navigator?.locks?.request) {
        try {
          return await browser.navigator.locks.request(STORAGE_KEY, () =>
            reserve(body),
          );
        } catch {
          /* Sandboxed previews may disallow Web Locks. */
        }
      }
      return reserve(body);
    }
    return error("Endpoint não encontrado.", 404);
  }

  browser.fetch = previewFetch;
  browser.__BRAVO_PREVIEW_AGENDA__ = previewAgenda;
  return () => {
    if (browser.fetch === previewFetch) browser.fetch = originalFetch;
    if (browser.__BRAVO_PREVIEW_AGENDA__ === previewAgenda)
      delete browser.__BRAVO_PREVIEW_AGENDA__;
  };
}
