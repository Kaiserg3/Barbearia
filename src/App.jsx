import { useEffect, useRef, useState } from "react";
import BookingCalendar from "./BookingCalendar.jsx";
import OwnerPanel from "./OwnerPanel.jsx";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  LoaderCircle,
  MapPin,
  Menu,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

const asset = (path) =>
  (typeof window !== "undefined" && window.__BRAVO_PREVIEW_ASSETS__?.[path]) ||
  path;

const SERVICES = [
  {
    id: "corte",
    name: "Corte masculino",
    description:
      "Do clássico ao contemporâneo. Um corte que combina com você, com acabamento impecável.",
    price: 55,
    duration: 40,
    image: "service-haircut.jpg",
    tag: "Seu estilo, do seu jeito",
  },
  {
    id: "barba",
    name: "Barba completa",
    description:
      "Desenho, alinhamento e toalha quente. O ritual de cuidado que a sua barba merece.",
    price: 40,
    duration: 30,
    image: "service-beard.jpg",
    tag: "Um momento só seu",
  },
  {
    id: "combo",
    name: "Corte + barba",
    description:
      "O cuidado completo, do cabelo à barba. Mais estilo e uma experiência para renovar.",
    price: 85,
    duration: 70,
    image: "service-combo.jpg",
    tag: "A experiência completa",
    featured: true,
  },
  {
    id: "acabamento",
    name: "Acabamento",
    description: "Os pequenos detalhes que mantêm o visual em dia.",
    price: 20,
    duration: 20,
  },
];
const money = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
const dateLabel = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function dateAfter(days) {
  const date = new Date(`${localToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function Logo({ light = false, onClick }) {
  return (
    <a
      href="#inicio"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="BRAVO. Barbearia, início"
      onClick={onClick}
    >
      <span className="brand-symbol">
        <Scissors size={22} strokeWidth={1.5} />
      </span>
      <span>
        <span className="brand-name">
          BRAVO<span>.</span>
        </span>
        <span className="brand-caption">BARBEARIA</span>
      </span>
    </a>
  );
}

export default function App() {
  const [ownerOpen, setOwnerOpen] = useState(
    () =>
      typeof window !== "undefined" && window.location.pathname === "/admin",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [booking, setBooking] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError(false);
    fetch("/api/catalog", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("catalog");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => {
        if (e.name !== "AbortError") setCatalogError(true);
      });
    return () => controller.abort();
  }, [retry]);
  const openBooking = (serviceId = "") => {
    setMenuOpen(false);
    setBooking({ serviceId });
  };
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="container nav-wrap">
          <Logo onClick={closeMenu} />
          <nav
            aria-label="Navegação principal"
            className={menuOpen ? "nav-links open" : "nav-links"}
          >
            <a href="#servicos" onClick={closeMenu}>
              Serviços
            </a>
            <a href="#sobre" onClick={closeMenu}>
              A barbearia
            </a>
            <a href="#equipe" onClick={closeMenu}>
              Nossa equipe
            </a>
            <a href="#contato" onClick={closeMenu}>
              Onde estamos
            </a>
            <button
              className="button button-dark nav-book"
              onClick={() => openBooking()}
            >
              Agendar horário <ArrowUpRight size={16} />
            </button>
          </nav>
          <button
            className="menu-toggle"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="conteudo">
        <section className="hero container" id="inicio">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="tiny-square" /> MAIS ESTILO. MAIS VOCÊ.
            </span>
            <h1>
              Seu estilo.
              <br />
              Sua <em>assinatura.</em>
            </h1>
            <p>
              Um bom corte muda o visual. O cuidado certo muda o seu dia.
              Encontre os dois aqui na BRAVO.
            </p>
            <div className="hero-actions">
              <button
                className="button button-dark"
                onClick={() => openBooking()}
              >
                Agendar meu horário <ArrowUpRight size={19} />
              </button>
              <a className="text-link" href="#sobre">
                Conheça a barbearia <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-note">
              <span className="note-icon">
                <Scissors size={20} strokeWidth={1.5} />
              </span>
              <div>
                <strong>O detalhe faz toda a diferença.</strong>
                <span>E a gente cuida de cada um.</span>
              </div>
            </div>
            <a className="hero-scroll" href="#servicos">
              <span>DESCUBRA A EXPERIÊNCIA</span>
              <ArrowDown size={15} />
            </a>
          </div>
          <div className="hero-visual">
            <img
              src={asset("/images/hero.jpg")}
              alt="Barbeiro realizando um corte com atenção aos detalhes"
              fetchPriority="high"
            />
            <div className="hero-image-shade" />
            <div className="hero-stamp">
              <Scissors size={22} strokeWidth={1.3} />
              <span>
                FEITO COM
                <br />
                PERSONALIDADE
              </span>
            </div>
            <div className="hero-image-caption">
              <span>MAIS QUE UMA BARBEARIA</span>
              <p>
                Um tempo para você.
                <br />
                Um visual para o mundo.
              </p>
            </div>
            <span className="photo-index">01 — BRAVO.</span>
          </div>
        </section>

        <div className="benefits container" aria-label="Nossa experiência">
          {[
            [Scissors, "Cortes com personalidade"],
            [ShieldCheck, "Cuidado em cada detalhe"],
            [Coffee, "Um momento de pausa"],
            [CalendarDays, "Seu horário, sem complicação"],
          ].map(([Icon, text]) => (
            <div key={text}>
              <Icon size={21} strokeWidth={1.4} />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <section
          className="services-section section-space container"
          id="servicos"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">NOSSOS SERVIÇOS</span>
              <h2>
                Cuidado que combina
                <br />
                com o seu estilo<span className="gold">.</span>
              </h2>
            </div>
            <div className="heading-aside">
              <p>
                Técnica nas mãos. Atenção nos detalhes.
                <br />
                Escolha o seu próximo cuidado.
              </p>
              <button className="text-link" onClick={() => openBooking()}>
                Ver todos os serviços <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
          <div className="service-grid">
            {SERVICES.slice(0, 3).map((service, index) => (
              <article className="service-card" key={service.id}>
                <button
                  className="service-photo"
                  onClick={() => openBooking(service.id)}
                  aria-label={`Agendar ${service.name}`}
                >
                  <img
                    src={asset(`/images/${service.image}`)}
                    alt={
                      service.id === "barba"
                        ? "Cuidado profissional com barba e acabamento"
                        : service.id === "combo"
                          ? "Corte e barba com acabamento personalizado"
                          : "Corte masculino feito com precisão"
                    }
                    loading="lazy"
                  />
                  {service.featured && (
                    <span className="service-badge">
                      <Sparkles size={13} /> NOSSO COMBO
                    </span>
                  )}
                  <span className="service-photo-arrow">
                    <ArrowUpRight size={21} />
                  </span>
                </button>
                <div className="service-info">
                  <span className="service-number">
                    0{index + 1} / {service.tag}
                  </span>
                  <div className="service-title">
                    <h3>{service.name}</h3>
                    <span>
                      <Clock3 size={13} /> {service.duration} min
                    </span>
                  </div>
                  <p>{service.description}</p>
                  <div className="service-bottom">
                    <span className="service-price">
                      {money(service.price)}
                      <small>/ sessão</small>
                    </span>
                    <button
                      className="text-link"
                      onClick={() => openBooking(service.id)}
                    >
                      Agendar <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="services-footnote">
            Preços de demonstração. A escolha do seu próximo visual pode começar
            por aqui.
          </p>
        </section>

        <section className="about-section" id="sobre">
          <div className="container about-grid">
            <div className="about-visual">
              <img
                src={asset("/images/about.jpg")}
                alt="Atendimento cuidadoso em uma barbearia de atmosfera acolhedora"
                loading="lazy"
              />
              <span className="about-photo-tag">
                <Coffee size={18} /> PODE CHEGAR. A CASA É SUA.
              </span>
              <div className="about-monogram">
                B<span>.</span>
              </div>
            </div>
            <div className="about-content">
              <span className="eyebrow">A ESSÊNCIA DA BRAVO.</span>
              <h2>
                Aqui, o cuidado
                <br />
                vai além do corte<span>.</span>
              </h2>
              <p>
                Acreditamos que a barbearia é mais que uma parada na rotina. É
                um lugar para desacelerar, trocar uma ideia e sair se sentindo
                bem.
              </p>
              <p>
                Combinamos a tradição da boa barbearia com um olhar atual para o
                seu estilo. Sem pressa, sem fórmula pronta. Com atenção ao que
                faz você ser você.
              </p>
              <div className="about-values">
                <span>
                  <Check size={16} /> Atendimento com atenção
                </span>
                <span>
                  <Check size={16} /> Técnica e personalidade
                </span>
                <span>
                  <Check size={16} /> Ambiente acolhedor
                </span>
                <span>
                  <Check size={16} /> Higiene em cada etapa
                </span>
              </div>
              <button
                className="button button-cream"
                onClick={() => openBooking()}
              >
                Viva essa experiência <ArrowUpRight size={19} />
              </button>
            </div>
          </div>
        </section>

        <section className="team-section section-space container" id="equipe">
          <div className="section-heading">
            <div>
              <span className="eyebrow">QUEM CUIDA DE VOCÊ</span>
              <h2>
                Boas mãos.
                <br />
                Muito estilo<span className="gold">.</span>
              </h2>
            </div>
            <p className="team-intro">
              Gente que gosta do que faz.
              <br />E que vai gostar de cuidar de você.
            </p>
          </div>
          <div className="team-grid">
            {(
              catalog?.professionals || [
                {
                  id: "rafael",
                  name: "Rafael",
                  role: "Cortes clássicos & modernos",
                  initials: "RA",
                },
                {
                  id: "lucas",
                  name: "Lucas",
                  role: "Degradê & estilo",
                  initials: "LU",
                },
                {
                  id: "andre",
                  name: "André",
                  role: "Barba & acabamento",
                  initials: "AN",
                },
              ]
            ).map((person, i) => (
              <article className="team-card" key={person.id}>
                <div className={`team-photo team-photo-${i}`}>
                  <span className="team-card-index">
                    0{i + 1} / BRAVO. TEAM
                  </span>
                  <span className="team-initials" aria-hidden="true">
                    {person.initials || person.name.slice(0, 2)}
                  </span>
                  <Scissors
                    className="team-scissors"
                    size={27}
                    strokeWidth={1}
                  />
                  <span className="team-card-motto">
                    TÉCNICA. CUIDADO. PERSONALIDADE.
                  </span>
                </div>
                <div className="team-info">
                  <div>
                    <h3>{person.name}</h3>
                    <p>{person.role}</p>
                  </div>
                  <button
                    aria-label={`Agendar com ${person.name}`}
                    onClick={() => {
                      setMenuOpen(false);
                      setBooking({ serviceId: "", professionalId: person.id });
                    }}
                  >
                    <ArrowUpRight size={23} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className="services-footnote">
            Profissionais fictícios para esta demonstração.
          </p>
        </section>

        <section className="booking-banner">
          <div className="container booking-banner-inner">
            <div>
              <span className="eyebrow">SEU PRÓXIMO BOM DIA COMEÇA AQUI</span>
              <h2>
                Um novo visual.
                <br />A mesma <em>essência.</em>
              </h2>
              <p>Escolha seu serviço e encontre um horário para você.</p>
              <button
                className="button button-dark"
                onClick={() => openBooking()}
              >
                Reservar meu horário <ArrowUpRight size={19} />
              </button>
            </div>
            <div className="banner-art" aria-hidden="true">
              <span className="banner-ring" />
              <Scissors size={125} strokeWidth={0.8} />
              <span className="banner-art-caption">
                CUIDADO QUE
                <br />
                DEIXA MARCA.
              </span>
            </div>
          </div>
        </section>

        <section
          className="contact-section section-space container"
          id="contato"
        >
          <div>
            <span className="eyebrow">A GENTE SE VÊ AQUI</span>
            <h2>
              Seu lugar de
              <br />
              ficar bem<span className="gold">.</span>
            </h2>
            <p>Entre, puxe uma cadeira e sinta-se em casa.</p>
            <span className="demo-label">ENDEREÇO E HORÁRIOS DE EXEMPLO</span>
          </div>
          <div className="contact-details">
            <div className="contact-row">
              <MapPin size={21} strokeWidth={1.5} />
              <div>
                <h3>Onde estamos</h3>
                <p>
                  {catalog?.business?.address ||
                    "Av. Dom Luís, 500 — Meireles, Fortaleza – CE"}
                </p>
              </div>
            </div>
            <div className="contact-row">
              <Clock3 size={21} strokeWidth={1.5} />
              <div>
                <h3>Quando pode chegar</h3>
                <p>
                  Terça a sábado <strong>09h às 19h</strong>
                  <br />
                  Domingo e segunda <span>Fechado</span>
                </p>
              </div>
            </div>
            <div className="contact-row">
              <CalendarDays size={21} strokeWidth={1.5} />
              <div>
                <h3>Seu horário reservado</h3>
                <p>Escolha o melhor dia e horário na nossa agenda.</p>
                <button className="text-link" onClick={() => openBooking()}>
                  Consultar horários <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-top">
          <Logo light />
          <p>
            Estilo é sobre ser você.
            <br />O resto, a gente cuida.
          </p>
          <a href="#inicio" className="back-top">
            Voltar ao topo <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} BRAVO. Barbearia.</span>
          <button
            className="owner-entry text-link"
            onClick={() => setOwnerOpen(true)}
          >
            Área do proprietário <ArrowUpRight size={13} />
          </button>
          <span className="footer-demo">Site demonstrativo</span>
        </div>
      </footer>

      {booking && (
        <BookingModal
          catalog={catalog}
          catalogError={catalogError}
          retryCatalog={() => setRetry((v) => v + 1)}
          initial={booking}
          onClose={() => setBooking(null)}
        />
      )}
      {ownerOpen && (
        <OwnerPanel
          catalog={catalog}
          onClose={() => {
            setOwnerOpen(false);
            if (window.location.pathname === "/admin") {
              window.history.replaceState(null, "", "/");
            }
          }}
          onBookDemo={() => {
            setOwnerOpen(false);
            openBooking();
          }}
        />
      )}
    </>
  );
}

function BookingModal({
  catalog,
  catalogError,
  retryCatalog,
  initial,
  onClose,
}) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(initial.serviceId || "");
  const [professionalId, setProfessionalId] = useState(
    initial.professionalId || "",
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [refreshSlots, setRefreshSlots] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const headerRef = useRef(null);
  const service = catalog?.services.find((s) => s.id === serviceId);
  const professional = catalog?.professionals.find(
    (p) => p.id === professionalId,
  );

  useEffect(() => {
    const previous = document.activeElement;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    function keyboard(event) {
      if (event.key === "Escape" && !submitting) onClose();
      if (event.key === "Tab") {
        const elements = [
          ...dialogRef.current.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialogRef.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
      previous?.focus({ preventScroll: true });
      window.scrollTo(0, scrollY);
    };
  }, [onClose, submitting]);
  useEffect(() => {
    headerRef.current?.focus();
  }, [step]);
  useEffect(() => {
    setTime("");
    setSlots([]);
    setSlotsError("");
    if (!date || !serviceId || !professionalId) {
      setLoadingSlots(false);
      return;
    }
    const controller = new AbortController();
    setLoadingSlots(true);
    const query = new URLSearchParams({ date, serviceId, professionalId });
    fetch(`/api/availability?${query}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok)
          throw new Error(
            data.error || "Não foi possível consultar os horários.",
          );
        return data;
      })
      .then((data) => {
        setSlots(data.slots);
        setLoadingSlots(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setSlotsError(e.message || "Não foi possível consultar os horários.");
          setLoadingSlots(false);
        }
      });
    return () => controller.abort();
  }, [date, serviceId, professionalId, refreshSlots]);

  async function submit(event) {
    event?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          professionalId,
          date,
          time,
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setStep(2);
          setRefreshSlots((v) => v + 1);
        }
        throw new Error(
          data.error || "Não foi possível salvar. Tente novamente.",
        );
      }
      setResult(data.booking);
      setStep(4);
    } catch (e) {
      setError(
        e.message === "Failed to fetch"
          ? "Não foi possível conectar. Verifique sua conexão e tente novamente."
          : e.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function downloadCalendar() {
    const start = new Date(`${result.date}T${result.time}:00-03:00`);
    const end = new Date(start.getTime() + result.duration * 60_000);
    const stamp = (d) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const escape = (v) =>
      String(v)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const contents = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BRAVO//Agendamento//PT",
      "BEGIN:VEVENT",
      `UID:${result.id}@bravo.local`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(`${result.serviceName} — BRAVO. Barbearia`)}`,
      `DESCRIPTION:${escape(`Demonstração. Profissional: ${result.professionalName}. Reserva ${result.reference}.`)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([contents], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "bravo-agendamento.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="modal-top">
          <span className="modal-brand">
            BRAVO<span>.</span> <small>SEU MOMENTO</small>
          </span>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar agendamento"
          >
            <X size={21} />
          </button>
        </div>
        {step < 4 && (
          <div className="booking-steps" aria-label={`Etapa ${step} de 3`}>
            {["Seu cuidado", "Dia e horário", "Seus dados"].map((label, i) => (
              <div
                className={
                  step === i + 1 ? "active" : step > i + 1 ? "complete" : ""
                }
                key={label}
              >
                <span>{step > i + 1 ? <Check size={12} /> : i + 1}</span>
                {label}
              </div>
            ))}
          </div>
        )}
        <div className="modal-body">
          <h2 id="booking-title" tabIndex={-1} ref={headerRef}>
            {step === 1
              ? "Como vamos cuidar de você?"
              : step === 2
                ? "Reserve um tempo para você."
                : step === 3
                  ? "Falta pouco para o seu momento."
                  : "Seu horário está reservado."}
          </h2>
          <p className="modal-subtitle">
            {step === 1
              ? "Escolha o serviço que combina com o seu dia."
              : step === 2
                ? "Escolha o profissional, o dia e o melhor horário."
                : step === 3
                  ? "Confira os detalhes e informe seus dados."
                  : "Tudo certo. Agora é só se preparar para renovar o visual."}
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {!catalog && (
            <div className="loading-catalog" role="status">
              {catalogError ? (
                <>
                  <p>Não conseguimos carregar a agenda.</p>
                  <button className="button button-dark" onClick={retryCatalog}>
                    Tentar novamente
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle className="spin" size={24} /> Carregando
                  serviços…
                </>
              )}
            </div>
          )}
          {catalog && step === 1 && (
            <div className="service-choices">
              {catalog.services.map((s) => (
                <button
                  key={s.id}
                  className={`service-choice ${serviceId === s.id ? "selected" : ""}`}
                  onClick={() => setServiceId(s.id)}
                  aria-pressed={serviceId === s.id}
                >
                  <span className="radio-mark">
                    {serviceId === s.id && <span />}
                  </span>
                  <span className="service-choice-text">
                    <strong>{s.name}</strong>
                    <span>{s.description}</span>
                    <small>
                      <Clock3 size={12} /> {s.duration} minutos
                    </small>
                  </span>
                  <strong className="choice-price">{money(s.price)}</strong>
                </button>
              ))}
            </div>
          )}
          {catalog && step === 2 && (
            <div className="schedule-form">
              <fieldset>
                <legend>Com quem?</legend>
                <div className="professional-choices">
                  {catalog.professionals.map((p, i) => (
                    <button
                      key={p.id}
                      className={
                        professionalId === p.id
                          ? "professional-choice selected"
                          : "professional-choice"
                      }
                      onClick={() => setProfessionalId(p.id)}
                      aria-pressed={professionalId === p.id}
                    >
                      <span className="professional-avatar">
                        {p.initials || p.name.slice(0, 2)}
                      </span>
                      <span>{p.name}</span>
                      {professionalId === p.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="field-label" id="booking-date-label">
                Qual dia?
              </p>
              <BookingCalendar
                value={date}
                minDate={localToday()}
                maxDate={dateAfter(60)}
                onChange={setDate}
              />
              <p className="field-hint" id="date-hint">
                Terça a sábado, das 9h às 19h · Horário de Fortaleza (UTC−3)
              </p>
              <fieldset className="time-field">
                <legend>
                  {date ? `Horários para ${dateLabel(date)}` : "Qual horário?"}
                </legend>
                {!professionalId || !date ? (
                  <p className="slots-empty">
                    Escolha um profissional e uma data para ver os horários.
                  </p>
                ) : loadingSlots ? (
                  <div className="slots-empty" role="status">
                    <LoaderCircle size={19} className="spin" /> Consultando
                    agenda…
                  </div>
                ) : slotsError ? (
                  <div className="form-error" role="alert">
                    {slotsError}
                    <button
                      className="text-link"
                      onClick={() => setRefreshSlots((v) => v + 1)}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : slots.length === 0 ? (
                  <p className="slots-empty">
                    Não há horários disponíveis neste dia. Tente outra data ou
                    outro profissional.
                  </p>
                ) : (
                  <div className="time-grid">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        className={
                          time === slot ? "time-choice selected" : "time-choice"
                        }
                        onClick={() => setTime(slot)}
                        aria-pressed={time === slot}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>
            </div>
          )}
          {catalog && step === 3 && (
            <form
              id="booking-form"
              ref={formRef}
              onSubmit={submit}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (formRef.current?.reportValidity()) submit();
                }
              }}
            >
              <div className="booking-summary">
                <div>
                  <Scissors size={18} />
                  <strong>{service?.name}</strong>
                  <span>{money(service?.price)}</span>
                </div>
                <p>
                  <CalendarDays size={15} /> {dateLabel(date)} às {time}
                </p>
                <p>
                  <Clock3 size={15} /> {service?.duration} min · com{" "}
                  {professional?.name}
                </p>
              </div>
              <label className="field-label" htmlFor="customer-name">
                Seu nome
              </label>
              <input
                autoComplete="name"
                id="customer-name"
                placeholder="Como podemos chamar você?"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label className="field-label" htmlFor="customer-phone">
                Celular com DDD
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                id="customer-phone"
                placeholder="(85) 99999-9999"
                required
                minLength={10}
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-describedby="phone-hint"
              />
              <p className="field-hint" id="phone-hint">
                Use 10 ou 11 dígitos, incluindo o DDD.
              </p>
              <p className="privacy-note">
                <ShieldCheck size={16} /> Seus dados serão usados apenas para
                este agendamento.
              </p>
            </form>
          )}
          {step === 4 && result && (
            <div className="booking-success">
              <div className="success-icon">
                <Check size={33} strokeWidth={1.5} />
              </div>
              <span className="success-reference">
                RESERVA {result.reference}
              </span>
              <div className="confirmation-card">
                <h3>{result.serviceName}</h3>
                <p>{dateLabel(result.date)}</p>
                <strong>
                  {result.time} <span>· {result.duration} min</span>
                </strong>
                <p>com {result.professionalName}</p>
                <div>
                  <span>{result.customerName}</span>
                  <strong>{money(result.price)}</strong>
                </div>
              </div>
              <button
                className="button button-outline"
                onClick={downloadCalendar}
              >
                <CalendarDays size={17} /> Adicionar ao calendário
              </button>
              <p className="field-hint">
                Guarde o código da reserva e os detalhes do seu horário.
              </p>
            </div>
          )}
          <p className="booking-demo">
            <span />
            {window.__BRAVO_STANDALONE__
              ? window.__BRAVO_PREVIEW_STORAGE__ === "local"
                ? "Prévia demonstrativa: reservas salvas apenas neste navegador, sem comunicação com uma barbearia. Use dados fictícios."
                : "Prévia demonstrativa: reservas mantidas apenas enquanto esta página estiver aberta, sem comunicação com uma barbearia. Use dados fictícios."
              : "Agenda demonstrativa: as reservas são salvas neste site, sem vínculo com uma barbearia real. Nenhuma mensagem é enviada."}
          </p>
        </div>
        <div className="modal-footer">
          {step > 1 && step < 4 ? (
            <button
              className="text-link"
              disabled={submitting}
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          ) : (
            <span className="footer-security">
              <ShieldCheck size={14} /> Sem pagamento online
            </span>
          )}
          {step === 1 ? (
            <button
              className="button button-dark"
              disabled={!serviceId || !catalog}
              onClick={() => setStep(2)}
            >
              Escolher horário <ArrowRight size={17} />
            </button>
          ) : step === 2 ? (
            <button
              className="button button-dark"
              disabled={!time || loadingSlots}
              onClick={() => {
                setError("");
                setStep(3);
              }}
            >
              Continuar <ArrowRight size={17} />
            </button>
          ) : step === 3 ? (
            <button
              className="button button-dark"
              type="button"
              form="booking-form"
              onClick={() => {
                if (formRef.current?.reportValidity()) submit();
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle size={17} className="spin" /> Reservando…
                </>
              ) : (
                <>
                  Confirmar agendamento <Check size={17} />
                </>
              )}
            </button>
          ) : (
            <button className="button button-dark" onClick={onClose}>
              Tudo certo <Check size={17} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
