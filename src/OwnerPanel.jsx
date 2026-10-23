import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Phone,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import "./owner-panel.css";

const money = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const formattedDate = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
const shiftDate = (value, days) => {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error || "Não foi possível concluir. Tente novamente.",
    );
    error.status = response.status;
    throw error;
  }
  return result;
}

export default function OwnerPanel({ catalog, onClose, onBookDemo }) {
  const demo = Boolean(window.__BRAVO_STANDALONE__);
  const [session, setSession] = useState(null);
  const [demoEntered, setDemoEntered] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState(today);
  const [professionalId, setProfessionalId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [sessionRetry, setSessionRetry] = useState(0);
  const panelRef = useRef(null);
  const formRef = useRef(null);
  const access = demo ? demoEntered : session?.authenticated;

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function keyboard(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const elements = [
        ...panelRef.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
      const first = elements[0],
        last = elements.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyboard);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    setError("");
    request("/api/admin/session", { signal: controller.signal })
      .then(setSession)
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "Não foi possível conectar à área do proprietário. Tente novamente.",
          );
      });
    return () => controller.abort();
  }, [demo, sessionRetry]);

  useEffect(() => {
    if (!access || !date) return;
    setLoading(true);
    setError("");
    setData(null);
    if (demo) {
      try {
        setData(window.__BRAVO_PREVIEW_AGENDA__({ date, professionalId }));
      } catch {
        setError("Não foi possível carregar a agenda de demonstração.");
      }
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    request(
      `/api/admin/bookings?${new URLSearchParams({ date, ...(professionalId ? { professionalId } : {}) })}`,
      { signal: controller.signal },
    )
      .then(setData)
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (e.status === 401)
          setSession({ configured: true, authenticated: false });
        setError(
          e.status === 401
            ? "Sua sessão expirou. Entre novamente para consultar a agenda."
            : e.message,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [access, demo, date, professionalId, refresh]);

  useEffect(() => {
    if (!access || demo) return;
    const interval = window.setInterval(() => setRefresh((v) => v + 1), 30_000);
    return () => window.clearInterval(interval);
  }, [access, demo]);

  async function login(event) {
    event?.preventDefault();
    if (busy || !formRef.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setSession(result);
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (demo) {
      setDemoEntered(false);
      setData(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setSession({ configured: true, authenticated: false });
      setData(null);
    } catch {
      setError("Não conseguimos encerrar a sessão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return (
    <div
      className="modal-backdrop owner-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={`owner-panel ${access ? "owner-panel-agenda" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-title"
        tabIndex={-1}
      >
        <div className="owner-top">
          <span className="modal-brand">
            BRAVO<span>.</span>
            <small>ÁREA DO PROPRIETÁRIO</small>
          </span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar área do proprietário"
          >
            <X size={21} />
          </button>
        </div>
        {!access ? (
          <div className="owner-login">
            <span className="owner-lock">
              <LockKeyhole size={25} strokeWidth={1.4} />
            </span>
            <span className="eyebrow">TUDO PRONTO PARA RECEBER BEM</span>
            <h2 id="owner-title">
              Sua agenda.
              <br />
              Tudo em um só lugar.
            </h2>
            <p>
              Consulte os agendamentos do dia e prepare cada atendimento com
              calma.
            </p>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {demo ? (
              <>
                <div className="owner-demo-notice">
                  <Scissors size={17} />
                  <p>
                    Esta é uma demonstração da área do proprietário. Você verá
                    apenas as reservas criadas neste navegador. Os dados
                    pessoais dos clientes não são guardados nesta prévia.
                  </p>
                </div>
                <button
                  className="button button-dark owner-login-button"
                  onClick={() => setDemoEntered(true)}
                >
                  Ver agenda de demonstração <ArrowRight size={17} />
                </button>
                <p className="owner-help">
                  No site completo, esta área exige a senha do proprietário.
                </p>
              </>
            ) : !session ? (
              <div className="owner-checking" role="status">
                {error ? (
                  <button
                    className="button button-outline"
                    onClick={() => setSessionRetry((v) => v + 1)}
                  >
                    Tentar novamente
                  </button>
                ) : (
                  <>
                    <LoaderCircle size={20} className="spin" /> Verificando
                    acesso…
                  </>
                )}
              </div>
            ) : !session.configured ? (
              <div className="owner-setup-notice">
                <ShieldCheck size={21} />
                <h3>Acesso aguardando ativação</h3>
                <p>
                  A agenda está protegida. O responsável pelo site precisa
                  configurar a senha do proprietário para liberar as consultas.
                </p>
              </div>
            ) : (
              <form
                ref={formRef}
                onSubmit={login}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    login();
                  }
                }}
              >
                <label className="field-label" htmlFor="owner-password">
                  Senha do proprietário
                </label>
                <div className="owner-password-field">
                  <input
                    id="owner-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    maxLength={256}
                    placeholder="Digite sua senha de acesso"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="button button-dark owner-login-button"
                  disabled={busy}
                  onClick={login}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> Entrando…
                    </>
                  ) : (
                    <>
                      Acessar minha agenda <ArrowRight size={17} />
                    </>
                  )}
                </button>
                <p className="owner-help">
                  <ShieldCheck size={13} /> Acesso restrito. Seus clientes não
                  veem esta agenda.
                </p>
              </form>
            )}
          </div>
        ) : (
          <div className="owner-agenda-content">
            <div className="owner-agenda-heading">
              <div>
                <span className="eyebrow">
                  {demo ? "DEMONSTRAÇÃO LOCAL" : "ÁREA RESTRITA"}
                </span>
                <h2 id="owner-title">
                  Bom trabalho.
                  <br />
                  Sua agenda está aqui.
                </h2>
              </div>
              <button className="text-link" onClick={logout} disabled={busy}>
                <LogOut size={15} /> {demo ? "Voltar" : "Sair"}
              </button>
            </div>
            {demo && (
              <div className="owner-demo-notice">
                <ShieldCheck size={17} />
                <p>
                  Reservas deste navegador, para demonstração. A agenda
                  compartilhada dos clientes e o acesso por senha funcionam na
                  versão com servidor.
                </p>
              </div>
            )}
            <div className="owner-stats">
              <div>
                <CalendarDays size={20} />
                <span>
                  Agendamentos
                  <strong>{loading || !data ? "—" : data.summary.count}</strong>
                </span>
              </div>
              <div>
                <Scissors size={20} />
                <span>
                  Valor dos serviços
                  <strong>
                    {loading || !data ? "—" : money(data.summary.total)}
                  </strong>
                </span>
              </div>
            </div>
            <div className="owner-filters">
              <div>
                <label htmlFor="owner-date">Dia da agenda</label>
                <div className="owner-date-controls">
                  <button
                    className="icon-button"
                    aria-label="Dia anterior"
                    onClick={() => validDate && setDate(shiftDate(date, -1))}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <input
                    id="owner-date"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                    }}
                  />
                  <button
                    className="icon-button"
                    aria-label="Próximo dia"
                    onClick={() => validDate && setDate(shiftDate(date, 1))}
                  >
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="owner-professional">Profissional</label>
                <select
                  id="owner-professional"
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                >
                  <option value="">Todos os profissionais</option>
                  {catalog?.professionals.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="owner-list-heading">
              <p>{validDate ? formattedDate(date) : "Selecione uma data"}</p>
              <button
                className="text-link"
                onClick={() => setRefresh((v) => v + 1)}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? "spin" : ""} />{" "}
                Atualizar
              </button>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div
              className="owner-bookings"
              aria-live="polite"
              aria-busy={loading}
            >
              {loading ? (
                <div className="owner-empty" role="status">
                  <LoaderCircle size={25} className="spin" />
                  <p>Consultando agendamentos…</p>
                </div>
              ) : data && data.bookings.length === 0 ? (
                <div className="owner-empty">
                  <CalendarDays size={32} strokeWidth={1.2} />
                  <h3>Nenhum agendamento neste dia.</h3>
                  <p>
                    {demo
                      ? "Faça uma reserva de exemplo no site e consulte a data escolhida aqui."
                      : "As reservas feitas pelos clientes aparecerão aqui."}
                  </p>
                  {demo && (
                    <button
                      className="button button-outline"
                      onClick={onBookDemo}
                    >
                      Testar um agendamento <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              ) : (
                data?.bookings.map((b) => (
                  <article className="owner-booking" key={b.id}>
                    <div className="owner-booking-time">
                      <strong>{b.time}</strong>
                      <span>
                        <Clock3 size={11} /> {b.duration} min
                      </span>
                    </div>
                    <div className="owner-booking-details">
                      <h3>{b.customerName}</h3>
                      <p>
                        {b.serviceName} <span>·</span> {b.professionalName}
                      </p>
                      {b.customerPhone ? (
                        <a
                          href={`tel:+55${b.customerPhone.replace(/\D/g, "")}`}
                        >
                          <Phone size={12} />{" "}
                          {b.customerPhone.replace(
                            /^(\d{2})(\d{4,5})(\d{4})$/,
                            "($1) $2-$3",
                          )}
                        </a>
                      ) : (
                        <small>
                          Dados pessoais não são salvos nesta prévia.
                        </small>
                      )}
                      <span className="owner-reference">{b.reference}</span>
                    </div>
                    <div className="owner-booking-price">
                      <strong>{money(b.price)}</strong>
                      <span>
                        <Check size={11} /> Agendado
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
            <p className="owner-update-note">
              {demo
                ? "Sem envio de mensagens ou sincronização entre dispositivos."
                : "Atualiza a cada 30 segundos · Horários de Fortaleza (UTC−3)."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
