import { useState, useRef, useCallback } from "react";
import "./safe-copilot.css";

const SAFE_API_BASE_URL =
  import.meta.env.VITE_SAFE_API_URL ?? "http://localhost:8000";

type GuidanceData = {
  technique: string;
  phrase: string;
  risk: string;
  reason: string;
  nextSteps: string[];
  questions: string[];
} | null;

const THEMES = [
  { name: "default", dot: "#a855f7" },
  { name: "ocean", dot: "#22d3ee" },
  { name: "slate", dot: "#94a3b8" },
  { name: "void", dot: "#18181b" },
];

const THEME_VARS: Record<string, Record<string, string>> = {
  default: {
    "--bg": "#1a1040",
    "--bg2": "#120b30",
    "--card": "rgba(255,255,255,0.06)",
    "--card-border": "rgba(255,255,255,0.1)",
    "--accent": "#7c3aed",
    "--accent2": "#a855f7",
    "--text": "#e2d9ff",
    "--muted": "#9580c8",
    "--hint": "#5e4d8a",
    "--input-bg": "rgba(255,255,255,0.07)",
    "--chip-bg": "rgba(167,139,250,0.12)",
    "--chip-border": "rgba(167,139,250,0.25)",
    "--chip-text": "#c4b5fd",
    "--chip-hover": "rgba(167,139,250,0.22)",
  },
  ocean: {
    "--bg": "#0c1a2e",
    "--bg2": "#071120",
    "--card": "rgba(255,255,255,0.06)",
    "--card-border": "rgba(34,211,238,0.15)",
    "--accent": "#0ea5e9",
    "--accent2": "#22d3ee",
    "--text": "#e0f2fe",
    "--muted": "#7ab8d4",
    "--hint": "#3a7d99",
    "--input-bg": "rgba(14,165,233,0.08)",
    "--chip-bg": "rgba(34,211,238,0.1)",
    "--chip-border": "rgba(34,211,238,0.2)",
    "--chip-text": "#7dd3fc",
    "--chip-hover": "rgba(34,211,238,0.2)",
  },
  slate: {
    "--bg": "#0f172a",
    "--bg2": "#080e1e",
    "--card": "rgba(255,255,255,0.05)",
    "--card-border": "rgba(148,163,184,0.15)",
    "--accent": "#64748b",
    "--accent2": "#94a3b8",
    "--text": "#e2e8f0",
    "--muted": "#94a3b8",
    "--hint": "#475569",
    "--input-bg": "rgba(148,163,184,0.08)",
    "--chip-bg": "rgba(148,163,184,0.1)",
    "--chip-border": "rgba(148,163,184,0.2)",
    "--chip-text": "#cbd5e1",
    "--chip-hover": "rgba(148,163,184,0.2)",
  },
  void: {
    "--bg": "#09090b",
    "--bg2": "#000000",
    "--card": "rgba(255,255,255,0.04)",
    "--card-border": "rgba(255,255,255,0.08)",
    "--accent": "#a855f7",
    "--accent2": "#c084fc",
    "--text": "#fafafa",
    "--muted": "#a1a1aa",
    "--hint": "#52525b",
    "--input-bg": "rgba(255,255,255,0.06)",
    "--chip-bg": "rgba(168,85,247,0.1)",
    "--chip-border": "rgba(168,85,247,0.2)",
    "--chip-text": "#d8b4fe",
    "--chip-hover": "rgba(168,85,247,0.2)",
  },
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window &
  Partial<Record<"SpeechRecognition" | "webkitSpeechRecognition", SpeechRecognitionConstructor>>;

function getRiskConfig(risk: string) {
  const normalizedRisk = risk.toLowerCase();
  if (normalizedRisk.includes("high")) return { cls: "risk-high", icon: "🚨", label: "HIGH RISK — Escalate immediately" };
  if (normalizedRisk.includes("medium")) return { cls: "risk-medium", icon: "⚠️", label: "MEDIUM RISK — Monitor closely" };
  return { cls: "risk-low", icon: "✓", label: "LOW RISK" };
}

async function readApiError(res: Response) {
  try {
    const data = await res.json();
    return data.detail ?? `Safe API returned ${res.status}.`;
  } catch {
    return `Safe API returned ${res.status}.`;
  }
}

function normalizeApiError(error: unknown) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return `Safe API is not reachable at ${SAFE_API_BASE_URL}. Start the backend with: cd backend; python -m uvicorn api:app --reload --host 0.0.0.0 --port 8000`;
  }

  return error instanceof Error ? error.message : "Error connecting to Safe API.";
}

export function SafeCopilot() {
  const [situation, setSituation] = useState("");
  const [guidance, setGuidance] = useState<GuidanceData>(null);
  const [loading, setLoading] = useState(false);
  const [followupQ, setFollowupQ] = useState("");
  const [followupA, setFollowupA] = useState("");
  const [sessionSummary, setSessionSummary] = useState("");
  const [apiError, setApiError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeTheme, setActiveTheme] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  
  const [listening, setListening] = useState(false);
const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

const startListening = useCallback(() => {
  const speechWindow = window as SpeechRecognitionWindow;
  const SpeechRecognition =
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser. Use Chrome!");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    setSituation(transcript);
  };

  recognition.onend = () => setListening(false);
  recognitionRef.current = recognition;
  recognition.start();
  setListening(true);
}, []);

const stopListening = useCallback(() => {
  recognitionRef.current?.stop();
  setListening(false);
}, []);
  
  const speakPhrase = useCallback(async (text: string) => {
    setApiError("");
    try {
      const res = await fetch(`${SAFE_API_BASE_URL}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      setApiError(normalizeApiError(e));
    }
  }, []);

  const applyTheme = useCallback((idx: number) => {
    setActiveTheme(idx);
    const vars = THEME_VARS[THEMES[idx].name];
    const shell = shellRef.current;
    Object.entries(vars).forEach(([k, v]) => shell?.style.setProperty(k, v));
  }, []);

  const handleGetGuidance = useCallback(async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setApiError("");
    setGuidance(null);
    setFollowupA("");
    setSessionSummary("");
    try {
      const res = await fetch(`${SAFE_API_BASE_URL}/guidance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation })
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const data = await res.json();
      setGuidance(data);
    } catch (e) {
      console.error(e);
      setApiError(normalizeApiError(e));
    }
    setLoading(false);
  }, [situation]);

  const handleClickSuggestion = useCallback((text: string) => {
    setFollowupQ(text);
    setHintVisible(true);
    setTimeout(() => setHintVisible(false), 2500);
    questionRef.current?.focus();
  }, []);
  
  const handleAsk = useCallback(async () => {
    if (!followupQ.trim()) return;
    setApiError("");
    setFollowupA("Thinking...");
    try {
      const res = await fetch(`${SAFE_API_BASE_URL}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: followupQ,
          situation,
          previous_guidance: guidance?.phrase ?? ""
        })
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const data = await res.json();
      setFollowupA(data.answer);
    } catch (e) {
      setApiError(normalizeApiError(e));
      setFollowupA("");
    }
  }, [followupQ, situation, guidance]);
  
  const handleSummary = useCallback(async () => {
    if (!guidance) return;
    setSummaryLoading(true);
    setApiError("");
    try {
      const res = await fetch(`${SAFE_API_BASE_URL}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation,
          guidance: guidance?.phrase ?? "",
          followups: followupA
        })
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const data = await res.json();
      setSessionSummary(data.summary);
    } catch (e) {
      setApiError(normalizeApiError(e));
      setSessionSummary("");
    }
    setSummaryLoading(false);
  }, [guidance, situation, followupA]);

  const riskConfig = guidance ? getRiskConfig(guidance.risk) : null;

  return (
    <div className="safe-shell" ref={shellRef}>
      <div style={{
  background: 'rgba(239,68,68,0.15)',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: '12px',
  padding: '10px 20px',
  margin: '0 0 12px 0',
  display: 'flex',
  gap: '24px',
  alignItems: 'center',
  flexWrap: 'wrap',
}}>
  <span style={{fontSize:'0.7rem',fontWeight:800,letterSpacing:'2px',color:'#f87171'}}>
    🆘 EMERGENCY LINES
  </span>
  <span style={{fontSize:'0.85rem',fontWeight:700,color:'#fca5a5'}}>
    📞 988 — Suicide & Crisis Lifeline
  </span>
  <span style={{fontSize:'0.85rem',fontWeight:700,color:'#fca5a5'}}>
    🚨 911 — Emergency Services
  </span>
  <span style={{fontSize:'0.85rem',fontWeight:700,color:'#fca5a5'}}>
    💬 741741 — Crisis Text Line
  </span>
  <span style={{fontSize:'0.85rem',fontWeight:700,color:'#fca5a5'}}>
    ☎️ 1-800-273-8255 — National Hotline
  </span>
</div>
      {/* HEADER */}
      <header className="safe-header">
        <div className="header-left">
          <span className="hack-badge">HACK BROOKLYN 2026</span>
          <h1 className="safe-wordmark">SAFE</h1>
          <p className="safe-tagline">Real-time clinical guidance — built for the counselor, not the patient.</p>
        </div>
        <div className="header-right">
          <span className="theme-label">THEME</span>
          <div className="theme-dots">
            {THEMES.map((t, i) => (
              <div
                key={t.name}
                className={`theme-dot${activeTheme === i ? " active" : ""}`}
                style={{ background: t.dot }}
                onClick={() => applyTheme(i)}
                title={t.name}
              />
            ))}
          </div>
        </div>
        <div className="header-logo">✳</div>
      </header>

      {/* 3-COLUMN GRID */}
      <div className="three-col">

        {/* ── COL 1: Input ── */}
        <div className="col col-input">
          <div className="card">
            <div className="card-label">CALLER SITUATION</div>
            <textarea
              className="safe-textarea"
              placeholder="Describe what is happening on this call..."
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              rows={7}
            />
            <button
              className="btn-main"
              onClick={handleGetGuidance}
              disabled={loading || !situation.trim()}
            >
              {loading ? <><span className="spinner" /> Analyzing…</> : "Get Guidance →"}
            </button>
             <button
  onClick={listening ? stopListening : startListening}
  style={{
    width: '100%',
    marginTop: '8px',
    padding: '10px',
    borderRadius: '10px',
    border: listening ? '2px solid #ef4444' : '2px solid rgba(167,139,250,0.4)',
    background: listening ? 'rgba(239,68,68,0.15)' : 'rgba(167,139,250,0.1)',
    color: listening ? '#f87171' : '#c4b5fd',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }}
>
  {listening ? '⏹ Stop Listening' : '🎙️ Start Listening — Auto-fill from call'}
</button>
          </div>

          <div className="card">
            <div className="card-label">YOUR QUESTION</div>
            <textarea
              ref={questionRef}
              className={`safe-textarea${hintVisible ? " highlight-input" : ""}`}
              placeholder="Ask Safe anything — or tap a suggestion"
              value={followupQ}
              onChange={(e) => setFollowupQ(e.target.value)}
              rows={3}
            />
            {hintVisible && <div className="hint-pill">✦ Added from suggestion</div>}
            <div className="q-placeholder-text">e.g. What if the caller refuses to engage?</div>
          </div>

          {followupQ.trim() && (
            <button className="btn-ask" onClick={handleAsk}>
              Ask Safe →
            </button>
          )}

          {/* Affirmation */}
          <div className="affirmation">
            <span className="affirmation-icon">💜</span>
            <div>
              <p className="affirmation-title">Helping someone could change a life.</p>
              <p className="affirmation-sub">Take a deep breath — you're making a difference.</p>
            </div>
          </div>
        </div>

        {/* ── COL 2: Guidance ── */}
        <div className="col col-guidance">
          {apiError && (
            <div className="risk-banner risk-high">
              {apiError}
            </div>
          )}

          {riskConfig && (
            <div className={`risk-banner ${riskConfig.cls}`}>
              {riskConfig.icon} {riskConfig.label}
            </div>
          )}

          <div className="card phrase-card-wrap">
            <div className="phrase-label">● RECOMMENDED RESPONSE</div>
            {guidance ? (
              <blockquote className="phrase-quote">
                "{guidance.phrase}"
                <button
                  onClick={() => speakPhrase(guidance.phrase)}
                  style={{
                    marginLeft: '10px',
                    background: 'rgba(167,139,250,0.2)',
                    border: '1px solid rgba(167,139,250,0.4)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    verticalAlign: 'middle',
                  }}
                  title="Read aloud"
                >
                  🔊
                </button>
              </blockquote>
            ) : (
              <p className="placeholder-text">
                Enter a caller situation and get guidance to generate a response.
              </p>
            )}
            {guidance && (
              <>
                <div className="meta-line">
                  <span className="meta-key">Technique:</span> {guidance.technique}
                </div>
                <div className="meta-line">
                  <span className="meta-key">Why:</span> {guidance.reason}
                </div>
              </>
            )}
          </div>

          {guidance && (
            <div className="card">
              <div className="card-label">NEXT STEPS — TAP TO ASK SAFE</div>
              <div className="bubble-row">
                {guidance.nextSteps.map((step) => (
                  <button
                    key={step}
                    className="step-bubble"
                    onClick={() => handleClickSuggestion(step)}
                  >
                    {step}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── COL 3: Questions + Answer + Notes ── */}
        <div className="col col-right">
          {guidance && (
            <div className="card">
              <div className="card-label">QUICK ACTIONS</div>
              <p className="tap-hint">Tap a question — Safe answers instantly</p>
              <div className="q-chip-list">
                {guidance.questions.map((q) => (
                  <button
                    key={q}
                    className="q-chip"
                    onClick={() => handleClickSuggestion(q)}
                  >
                    <span className="q-dot">●</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card answer-card">
            <div className="card-label">SAFE'S ANSWER</div>
            {followupA ? (
              <p className="answer-text">{followupA}</p>
            ) : (
              <p className="placeholder-text">Answers will appear here when you tap a question or ask your own.</p>
            )}
          </div>

        </div>

      </div>

      {/* ── Full-width Session Notes ── */}
      <div className="card notes-card-full">
        <div className="notes-full-header">
          <div className="card-label">END OF CALL — SESSION NOTES</div>
          <button
            className="btn-notes"
            onClick={handleSummary}
            disabled={summaryLoading || !guidance}
          >
            {summaryLoading ? <><span className="spinner spinner-sm" /> Generating…</> : "Generate Note"}
          </button>
        </div>
        {sessionSummary ? (
          <pre className="notes-text">{sessionSummary}</pre>
        ) : (
          <p className="placeholder-text">Session notes will appear here after guidance is generated.</p>
        )}
      </div>
    </div>
  );
}
