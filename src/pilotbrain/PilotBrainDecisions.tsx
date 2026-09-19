import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  createDecision,
  fetchDecision,
  fetchDecisions,
  type DecisionDetail,
  type DecisionDraftInput,
  type DecisionSummary,
  type JournalStats,
} from "@/lib/decisionsApi";
import { decisionState, type Decision } from "@/lib/decisionTypes";
import DecisionDetailView from "./decisions/DecisionDetailView";
import DecisionForm from "./decisions/DecisionForm";
import DecisionList from "./decisions/DecisionList";
import StatsStrip from "./decisions/StatsStrip";
import { Card, ErrorText, NotAllowed } from "./decisions/decisionUi";
import { canUseDecisions } from "./decisions/decisionFormat";
import "@/staff/StaffDashboard.css";
import "./decisions/decisions.css";

// The Decision Journal (Pilot Brain V8): write a big call down, see what Pilot
// thinks (its view, a challenge, a simulation), decide, and later record what
// actually happened so the two can be compared. BOSS DECIDES: Pilot recommends,
// challenges and simulates, and nothing here changes a car, a lead, a price or
// the books. Owners and managers only; everyone else is told so plainly.

type Journal =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error"; error: string }
  | { status: "ready"; decisions: DecisionSummary[]; stats: JournalStats; refreshError: string | null };

type Detail =
  | { status: "none" }
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "missing" }
  | { status: "error"; error: string }
  | { status: "ready"; detail: DecisionDetail };

export default function PilotBrainDecisions() {
  const { user } = useAuth();
  const allowed = canUseDecisions(user);
  const [params, setParams] = useSearchParams();
  const openId = params.get("d");

  const [journal, setJournal] = useState<Journal>({ status: "loading" });
  const [detail, setDetail] = useState<Detail>({ status: "none" });
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const detailRequest = useRef(0);

  const loadJournal = useCallback(async () => {
    const res = await fetchDecisions();
    setNowMs(Date.now());
    if (res.ok) {
      setJournal({ status: "ready", decisions: res.decisions, stats: res.stats, refreshError: null });
    } else if (res.status === 403) {
      setJournal({ status: "forbidden" });
    } else {
      // A failed refresh keeps what was already on screen and says so; a failed
      // first load shows the error, never an empty journal.
      setJournal(prev => (prev.status === "ready" ? { ...prev, refreshError: res.error } : { status: "error", error: res.error }));
    }
  }, []);

  const loadDetail = useCallback(async (id: string, showLoading: boolean) => {
    const mine = ++detailRequest.current;
    if (showLoading) setDetail({ status: "loading" });
    const res = await fetchDecision(id);
    if (mine !== detailRequest.current) return; // a newer request has taken over
    setNowMs(Date.now());
    if (res.ok) {
      setDetail({
        status: "ready",
        detail: { decision: res.decision, state: res.state, comparison: res.comparison, closeWithinPercent: res.closeWithinPercent },
      });
    } else if (res.status === 403) setDetail({ status: "forbidden" });
    else if (res.status === 404) setDetail({ status: "missing" });
    else setDetail({ status: "error", error: res.error });
  }, []);

  useEffect(() => {
    if (allowed) void loadJournal();
  }, [allowed, loadJournal]);

  useEffect(() => {
    if (!allowed) return;
    if (openId) void loadDetail(openId, true);
    else {
      detailRequest.current += 1;
      setDetail({ status: "none" });
    }
  }, [allowed, openId, loadDetail]);

  const open = (id: string) => setParams({ d: id });
  const back = () => setParams({});

  async function handleCreate(draft: DecisionDraftInput) {
    setCreateBusy(true);
    setCreateError(null);
    const res = await createDecision(draft);
    setCreateBusy(false);
    if (!res.ok) {
      setCreateError(res.error);
      return;
    }
    setCreating(false);
    void loadJournal();
    open(res.decision.id);
  }

  // The server returned the decision as it is now (after a save).
  const applyDetail = (next: DecisionDetail) => {
    setNowMs(Date.now());
    setDetail({ status: "ready", detail: next });
    void loadJournal();
  };

  // Pilot's view, a challenge or a simulation was added by one of the panels.
  const applyPanelChange = (next: Decision) => {
    setDetail(prev =>
      prev.status === "ready" ? { status: "ready", detail: { ...prev.detail, decision: next, state: decisionState(next, Date.now()) } } : prev
    );
    void loadJournal();
  };

  function body() {
    if (!allowed || journal.status === "forbidden") return <NotAllowed />;
    if (journal.status === "loading") return <p className="sn-empty">Loading…</p>;
    if (journal.status === "error") {
      return (
        <Card>
          <h2 className="dj-h2">Couldn't load your decisions</h2>
          <ErrorText text={journal.error} />
          <button type="button" className="sn-btn sn-btn--gold dj-btn" onClick={() => void loadJournal()}>
            Try again
          </button>
        </Card>
      );
    }

    if (openId) {
      if (detail.status === "loading" || detail.status === "none") return <p className="sn-empty">Loading…</p>;
      if (detail.status === "forbidden") return <NotAllowed />;
      if (detail.status === "missing" || detail.status === "error") {
        return (
          <Card>
            <h2 className="dj-h2">{detail.status === "missing" ? "That decision wasn't found" : "Couldn't load that decision"}</h2>
            {detail.status === "error" ? <ErrorText text={detail.error} /> : null}
            <div className="dj-actions">
              {detail.status === "error" ? (
                <button type="button" className="sn-btn sn-btn--gold dj-btn" onClick={() => void loadDetail(openId, true)}>
                  Try again
                </button>
              ) : null}
              <button type="button" className="sn-btn sn-btn--ghost dj-btn" onClick={back}>
                Back to all decisions
              </button>
            </div>
          </Card>
        );
      }
      return (
        <DecisionDetailView
          key={detail.detail.decision.id}
          detail={detail.detail}
          nowMs={nowMs}
          onDetail={applyDetail}
          onPanelChange={applyPanelChange}
          onRefresh={() => void loadDetail(openId, false)}
          onBack={back}
        />
      );
    }

    return (
      <>
        <StatsStrip stats={journal.stats} />
        <ErrorText text={journal.refreshError} />
        {creating ? (
          <DecisionForm
            heading="New decision"
            submitLabel="Write it down"
            busy={createBusy}
            error={createError}
            onSubmit={draft => void handleCreate(draft)}
            onCancel={() => {
              setCreating(false);
              setCreateError(null);
            }}
          />
        ) : (
          <button type="button" className="sn-btn sn-btn--gold dj-btn" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
            New decision
          </button>
        )}
        <h2 className="dj-h2">Your decisions</h2>
        <DecisionList decisions={journal.decisions} nowMs={nowMs} onOpen={open} />
      </>
    );
  }

  return (
    <div className="sn-dashboard sn-dashboard--cosmic" style={{ minHeight: "100vh" }}>
      <header className="sn-hero">
        <div className="sn-hero__glow" />
        <div className="sn-hero__content">
          <h1 className="sn-hero__title">Pilot Brain — Decisions</h1>
          <p className="sn-hero__subtitle">
            Write down a big call, see what Pilot thinks, decide, and check later how it went. You decide: Pilot only advises.
          </p>
          <p style={{ margin: "10px 0 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="dj-chip dj-chip--plain">Owners and managers only</span>
            <Link to="/pilot-brain" className="dj-small" style={{ color: "#c7d0ff" }}>
              Back to Pilot Brain
            </Link>
          </p>
        </div>
      </header>
      <div className="dj-page">{body()}</div>
    </div>
  );
}
