import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./booking-calendar.css";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FULL_WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const fullDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function todayInFortaleza() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function asDate(iso) {
  return new Date(`${iso}T12:00:00Z`);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso, count) {
  const next = asDate(iso);
  next.setUTCDate(next.getUTCDate() + count);
  return isoDate(next);
}

function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(iso, count) {
  const next = asDate(iso);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + count);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return isoDate(next);
}

function validIso(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(asDate(value).valueOf()) &&
    isoDate(asDate(value)) === value
  );
}

function closed(iso) {
  return asDate(iso).getUTCDay() < 2;
}

function available(iso, min, max) {
  return iso >= min && iso <= max && !closed(iso);
}

function nearestAvailable(target, direction, min, max) {
  let day = target < min ? min : target > max ? max : target;
  while (day >= min && day <= max) {
    if (available(day, min, max)) return day;
    day = addDays(day, direction);
  }
  return "";
}

function availableInMonth(target, direction, min, max) {
  const first = monthStart(target);
  const last = addDays(shiftMonth(first, 1), -1);
  const lower = first < min ? min : first;
  const upper = last > max ? max : last;
  if (lower > upper) return "";
  return (
    nearestAvailable(target, direction, lower, upper) ||
    nearestAvailable(target, -direction, lower, upper)
  );
}

/** A date selection grid. Actual free appointment times are loaded by its parent. */
export default function BookingCalendar({ value, onChange, minDate, maxDate }) {
  const today = todayInFortaleza();
  const min = validIso(minDate) ? minDate : today;
  const max = validIso(maxDate) && maxDate >= min ? maxDate : addDays(min, 60);
  const initial =
    validIso(value) && available(value, min, max)
      ? value
      : nearestAvailable(min, 1, min, max);
  const [month, setMonth] = useState(() => monthStart(initial || min));
  const [focusedDate, setFocusedDate] = useState(initial);
  const pendingFocus = useRef("");
  const buttons = useRef(new Map());
  const headingId = useId();
  const hintId = useId();

  useEffect(() => {
    const next =
      validIso(value) && available(value, min, max)
        ? value
        : nearestAvailable(min, 1, min, max);
    setFocusedDate(next);
    setMonth(monthStart(next || min));
  }, [value, min, max]);

  useEffect(() => {
    if (pendingFocus.current) {
      buttons.current.get(pendingFocus.current)?.focus({ preventScroll: true });
      pendingFocus.current = "";
    }
  }, [focusedDate, month]);

  const start = asDate(month);
  const visibleMonth = monthLabel
    .formatToParts(start)
    .filter(({ type }) => type === "month" || type === "year")
    .map(({ value: part }) => part)
    .join(" ");
  const firstWeekday = start.getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth
      ? `${month.slice(0, 8)}${String(day).padStart(2, "0")}`
      : "";
  });
  const rows = Array.from({ length: cellCount / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const canPrevious = previousMonth >= monthStart(min);
  const canNext = nextMonth <= monthStart(max);

  function navigateMonth(direction) {
    if ((direction < 0 && !canPrevious) || (direction > 0 && !canNext)) return;
    const next = shiftMonth(month, direction);
    const first = nearestAvailable(next, 1, min, max);
    setMonth(next);
    setFocusedDate(first?.slice(0, 7) === next.slice(0, 7) ? first : "");
  }

  function keyboard(event, date) {
    let target;
    let direction;
    let movingMonth = false;
    const weekday = asDate(date).getUTCDay();
    switch (event.key) {
      case "ArrowLeft":
        target = addDays(date, -1);
        direction = -1;
        break;
      case "ArrowRight":
        target = addDays(date, 1);
        direction = 1;
        break;
      case "ArrowUp":
        target = addDays(date, -7);
        direction = -1;
        break;
      case "ArrowDown":
        target = addDays(date, 7);
        direction = 1;
        break;
      case "Home":
        target = addDays(date, -weekday);
        direction = 1;
        break;
      case "End":
        target = addDays(date, 6 - weekday);
        direction = -1;
        break;
      case "PageUp":
        target = shiftMonth(date, -1);
        direction = -1;
        movingMonth = true;
        break;
      case "PageDown":
        target = shiftMonth(date, 1);
        direction = 1;
        movingMonth = true;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = movingMonth
      ? availableInMonth(target, direction, min, max)
      : nearestAvailable(target, direction, min, max);
    if (!next || next === focusedDate) return;
    pendingFocus.current = next;
    setFocusedDate(next);
    setMonth(monthStart(next));
  }

  return (
    <div className="booking-calendar">
      <div className="booking-calendar-header">
        <div>
          <span className="booking-calendar-caption">ESCOLHA SEU DIA</span>
          <h3 id={headingId} aria-live="polite">
            {visibleMonth}
          </h3>
        </div>
        <div className="booking-calendar-navigation">
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            disabled={!canPrevious}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            disabled={!canNext}
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        className="booking-calendar-grid"
        role="grid"
        aria-labelledby={headingId}
        aria-describedby={hintId}
      >
        <div className="booking-calendar-weekdays" role="row">
          {WEEKDAYS.map((day, index) => (
            <span
              role="columnheader"
              aria-label={FULL_WEEKDAYS[index]}
              key={day}
            >
              {day}
            </span>
          ))}
        </div>
        {rows.map((week, index) => (
          <div
            role="row"
            className="booking-calendar-week"
            key={`${month}-${index}`}
          >
            {week.map((date, column) => {
              if (!date)
                return (
                  <div
                    role="gridcell"
                    aria-hidden="true"
                    className="booking-calendar-empty"
                    key={`empty-${column}`}
                  />
                );
              const enabled = available(date, min, max);
              const selected = date === value;
              const isToday = date === today;
              const description = !enabled
                ? closed(date)
                  ? ", fechado"
                  : ", fora do período de agendamento"
                : "";
              return (
                <div role="gridcell" aria-selected={selected} key={date}>
                  <button
                    type="button"
                    className={`booking-calendar-day${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}${closed(date) ? " is-closed" : ""}`}
                    disabled={!enabled}
                    tabIndex={date === focusedDate ? 0 : -1}
                    aria-label={`${fullDate.format(asDate(date))}${description}`}
                    aria-pressed={selected}
                    aria-current={isToday ? "date" : undefined}
                    ref={(element) => {
                      if (element) buttons.current.set(date, element);
                      else buttons.current.delete(date);
                    }}
                    onFocus={() => setFocusedDate(date)}
                    onKeyDown={(event) => keyboard(event, date)}
                    onClick={() => {
                      setFocusedDate(date);
                      onChange(date);
                    }}
                  >
                    {Number(date.slice(-2))}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div
        className="booking-calendar-legend"
        aria-label="Legenda do calendário"
      >
        <span>
          <i className="booking-calendar-dot available" />
          Disponível
        </span>
        <span>
          <i className="booking-calendar-dot selected" />
          Selecionado
        </span>
        <span>
          <i className="booking-calendar-dot closed" />
          Fechado
        </span>
      </div>
      <p id={hintId} className="booking-calendar-hint">
        Toque em um dia para consultar os horários livres.
      </p>
    </div>
  );
}
