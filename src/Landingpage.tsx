import { useEffect, useRef } from "react";
import "./Landing.css";

interface LandingPageProps {
  onLaunch: () => void;
}

const details = [
  {
    number: "01",
    label: "Grounded",
    text: "Structured support surfaced clearly, without visual noise.",
  },
  {
    number: "02",
    label: "Immediate",
    text: "Designed for active use, not passive browsing.",
  },
  {
    number: "03",
    label: "Professional",
    text: "A restrained interface with deliberate hierarchy.",
  },
];

const scenarios = [
  {
    id: "01",
    risk: "high",
    chip: "High risk",
    situation:
      "Caller says they have not slept in two days, feels detached from reality, and avoids direct questions about immediate safety.",
    response:
      "I’m here with you. We can slow this down together. When you say things feel off, are you thinking about hurting yourself tonight?",
    meta1: "Direct safety check",
    meta2: "Grounding + escalation",
  },
  {
    id: "02",
    risk: "medium",
    chip: "Escalating",
    situation:
      "Caller is crying, breathing fast, and says they cannot calm down enough to explain what happened.",
    response:
      "You don’t need to explain everything yet. Stay with my voice for a second and let’s take one slow breath together.",
    meta1: "Co-regulation",
    meta2: "Panic de-escalation",
  },
  {
    id: "03",
    risk: "low",
    chip: "Low risk",
    situation:
      "Caller says they feel overwhelmed and alone but confirms they are safe for now and not in immediate danger.",
    response:
      "I’m really glad you reached out. Since you’re safe right now, can we talk about what usually makes nights like this harder?",
    meta1: "Validation",
    meta2: "Stability + exploration",
  },
];

export function LandingPage({ onLaunch }: LandingPageProps) {
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animatedItems =
      landingRef.current?.querySelectorAll<HTMLElement>("[data-scroll]") ?? [];

    if (!("IntersectionObserver" in window)) {
      animatedItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.18,
      },
    );

    animatedItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing" ref={landingRef}>
      <div className="landing__frame" />

      <header className="landing__nav landing__reveal landing__reveal--1">
        <div className="landing__brand">
          <div className="landing__brand-dot" />
          <div className="landing__brand-block">
            <span className="landing__brand-name">SAFE</span>
            <span className="landing__brand-sub">Clinical co-pilot</span>
          </div>
        </div>

        <button className="landing__nav-button" onClick={onLaunch}>
          Launch
        </button>
      </header>

      <main className="landing__main">
        <section className="hero">
          <div className="hero__rail landing__reveal landing__reveal--2">
            <span className="hero__rail-line" />
            <span className="hero__rail-text">Built for the counselor</span>
          </div>

          <div className="hero__grid">
            <div className="hero__headline-wrap landing__reveal landing__reveal--3">
              <h1 className="hero__title">
                Real-time guidance
                <br />
                for active calls.
              </h1>
            </div>

            <div className="hero__aside landing__reveal landing__reveal--4">
              <p className="hero__lede">
                Fast, grounded support for crisis counselors when the next response
                matters.
              </p>

              <div className="hero__actions">
                <button className="hero__primary" onClick={onLaunch}>
                  Open Safe
                </button>
                <span className="hero__meta">Live demo · No setup</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="preview-grid landing__scroll landing__scroll--lift"
          data-scroll
        >
          <div
            className="preview-grid__header landing__scroll landing__scroll--fade"
            data-scroll
          >
            <h2 className="preview-grid__title">Live scenarios</h2>
            <span className="preview-grid__meta">Representative cases</span>
          </div>

          <div className="preview-grid__cards">
            {scenarios.map((s, index) => (
              <article
                key={s.id}
                className="scenario-card landing__scroll landing__scroll--card"
                data-scroll
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <div className="scenario-card__topbar">
                  <div className="scenario-card__index">Case {s.id}</div>
                  <div className={`scenario-card__status ${s.risk}`}>
                    {s.chip}
                  </div>
                </div>

                <div className="scenario-card__grid">
                  <div className="scenario-card__panel">
                    <div className="scenario-card__label">Situation</div>
                    <p className="scenario-card__copy">{s.situation}</p>
                  </div>

                  <div className="scenario-card__panel">
                    <div className="scenario-card__label">
                      Suggested response
                    </div>
                    <blockquote className="scenario-card__quote">
                      “{s.response}”
                    </blockquote>

                    <div className="scenario-card__footer">
                      <span>{s.meta1}</span>
                      <span>{s.meta2}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="details">
          {details.map((item, index) => (
            <article
              key={item.number}
              className="detail-card landing__scroll landing__scroll--drift"
              data-scroll
              style={{ transitionDelay: `${index * 110}ms` }}
            >
              <div className="detail-card__top">
                <span className="detail-card__number">{item.number}</span>
                <span className="detail-card__rule" />
              </div>
              <h2 className="detail-card__label">{item.label}</h2>
              <p className="detail-card__text">{item.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
