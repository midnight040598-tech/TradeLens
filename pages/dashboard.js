import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { supabase } from "../lib/supabaseClient";

function fileToBase64(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      resolve(btoa(binary));
    } catch (e) {
      reject(e);
    }
  });
}

function computeMetrics(t) {
  let pips = null;
  let rr = null;
  if (typeof t.entry === "number" && typeof t.exit === "number") {
    pips = t.direction === "short" || t.direction === "sell" ? t.entry - t.exit : t.exit - t.entry;
  }
  if (typeof t.entry === "number" && typeof t.stop_loss === "number" && typeof t.take_profit === "number") {
    const risk = Math.abs(t.entry - t.stop_loss);
    const reward = Math.abs(t.take_profit - t.entry);
    if (risk > 0) rr = reward / risk;
  }
  return { pips, rr };
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function DetailRow({ label, value, na }) {
  return (
    <div className="detail-row">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={na ? "na" : "detail-value"}>{na ? "AI could not detect" : value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    signal: { label: "AI SIGNAL", bg: "rgba(232,163,61,0.15)", color: "var(--amber)" },
    pending: { label: "PENDING EXECUTION", bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
    executed: { label: "EXECUTED", bg: "rgba(74,222,128,0.15)", color: "var(--green)" },
    failed: { label: "FAILED", bg: "rgba(248,113,113,0.15)", color: "var(--red)" },
  };
  const s = map[status] || map.signal;
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        padding: "3px 8px",
        borderRadius: 2,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [trades, setTrades] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
    })();
  }, [router]);

  const loadTrades = useCallback(async () => {
    const { data, error } = await supabase.from("trades").select("*").order("created_at", { ascending: false });
    if (!error) setTrades(data || []);
  }, []);

  useEffect(() => {
    if (session) loadTrades();
  }, [session, loadTrades]);

  // Poll every 5s so executed/failed status from the EA shows up without a manual refresh
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(loadTrades, 5000);
    return () => clearInterval(interval);
  }, [session, loadTrades]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        setError("Please upload an image file (PNG, JPG, or WebP).");
        return;
      }
      setError(null);
      setAnalyzing(true);
      try {
        const base64 = await fileToBase64(file);
        const mediaType = file.type;

        const res = await fetch("/api/analyze-chart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mediaType }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Analysis failed");

        const { pips, rr } = computeMetrics(result);
        const { data: userData } = await supabase.auth.getUser();

        const row = {
          user_id: userData.user.id,
          instrument: result.instrument ?? null,
          direction: result.direction ?? null,
          entry: typeof result.entry === "number" ? result.entry : null,
          exit_price: typeof result.exit === "number" ? result.exit : null,
          stop_loss: typeof result.stop_loss === "number" ? result.stop_loss : null,
          take_profit: typeof result.take_profit === "number" ? result.take_profit : null,
          support: typeof result.support === "number" ? result.support : null,
          resistance: typeof result.resistance === "number" ? result.resistance : null,
          trend: result.trend ?? null,
          bias: result.bias ?? null,
          pips,
          rr,
          thumb: "data:" + mediaType + ";base64," + base64,
          status: "signal",
        };

        const { error: insertError } = await supabase.from("trades").insert(row);
        if (insertError) throw insertError;

        await loadTrades();
      } catch (e) {
        setError(e.message || "Chart analysis failed. Try a clearer screenshot.");
      } finally {
        setAnalyzing(false);
      }
    },
    [loadTrades]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const deleteTrade = async (id) => {
    await supabase.from("trades").delete().eq("id", id);
    setSelected(null);
    loadTrades();
  };

  const confirmExecute = async (id) => {
    setConfirming(true);
    try {
      const { error } = await supabase.from("trades").update({ status: "pending" }).eq("id", id);
      if (error) throw error;
      await loadTrades();
      const updated = trades.find((t) => t.id === id);
      if (updated) setSelected({ ...updated, status: "pending" });
    } catch (e) {
      setError(e.message || "Could not confirm trade");
    } finally {
      setConfirming(false);
    }
  };

  if (session === undefined) return null;

  const closed = trades.filter((t) => t.pips !== null);
  const wins = closed.filter((t) => t.pips > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : null;
  const rrTrades = trades.filter((t) => t.rr !== null);
  const avgRR = rrTrades.length ? rrTrades.reduce((s, t) => s + t.rr, 0) / rrTrades.length : null;
  const netPips = closed.length ? closed.reduce((s, t) => s + t.pips, 0) : null;

  const equityData = (() => {
    const sorted = [...closed].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let cum = 0;
    return sorted.map((t, i) => {
      cum += t.pips;
      return { i: i + 1, cum: Number(cum.toFixed(2)) };
    });
  })();

  return (
    <div className="page">
      <div className="header">
        <div className="logo">
          <span className="dot" />
          TRADELENS
        </div>
        <button className="btn-secondary" style={{ borderRadius: 3, padding: "6px 10px", fontSize: 11, cursor: "pointer" }} onClick={signOut}>
          Sign out
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <label
        htmlFor="file-input"
        className={"card upload" + (dragOver ? " drag" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="upload-icon">{analyzing ? "⟳" : "＋"}</div>
        <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>{analyzing ? "Reading your chart…" : "Upload a chart screenshot"}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-muted)" }}>
          {analyzing ? "Analyzing and building a trade recommendation." : "Drag & drop, paste, or tap to choose a file. Get an instant buy/sell call."}
        </p>
        {!analyzing && <span className="btn">Choose screenshot</span>}
        <input
          id="file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>

      <div className="stats">
        <div className="card stat">
          <div className="stat-label">Win Rate</div>
          <div className="stat-value">{winRate === null ? "—" : fmt(winRate, 0) + "%"}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Avg R:R</div>
          <div className="stat-value">{avgRR === null ? "—" : fmt(avgRR, 2) + "R"}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{trades.length}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Net Points</div>
          <div className="stat-value" style={{ color: netPips === null ? undefined : netPips >= 0 ? "var(--green)" : "var(--red)" }}>
            {netPips === null ? "—" : (netPips >= 0 ? "+" : "") + fmt(netPips, 1)}
          </div>
        </div>
      </div>

      {equityData.length > 1 && (
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>
            EQUITY CURVE
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={equityData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
              <ReferenceLine y={0} stroke="#2a2d33" />
              <XAxis dataKey="i" hide />
              <YAxis tick={{ fontSize: 10, fill: "#82868f" }} width={40} />
              <Tooltip contentStyle={{ background: "#1c1f24", border: "1px solid #2a2d33", fontSize: 12 }} labelFormatter={() => ""} formatter={(v) => [v, "cum. pts"]} />
              <Line type="monotone" dataKey="cum" stroke="#e8a33d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="section-title">Journal</div>
      {trades.length === 0 ? (
        <div className="card empty">No trades yet. Upload a chart above to get your first AI recommendation.</div>
      ) : (
        trades.map((t) => (
          <div key={t.id} className="card trade-row" onClick={() => setSelected(t)} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span
                  className={
                    "dir-badge " +
                    (t.direction === "long" || t.direction === "buy" ? "dir-long" : t.direction === "short" || t.direction === "sell" ? "dir-short" : "dir-na")
                  }
                >
                  {t.direction || "—"}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 14 }}>{t.instrument || "Unknown"}</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 600, color: t.pips === null ? "var(--text-muted)" : t.pips >= 0 ? "var(--green)" : "var(--red)" }}>
                {t.pips === null ? "—" : (t.pips >= 0 ? "+" : "") + fmt(t.pips, 1)}
              </div>
            </div>
            <div>
              <StatusBadge status={t.status || "signal"} />
            </div>
          </div>
        ))
      )}

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="logo" style={{ fontSize: 15 }}>
                {selected.instrument || "Unknown instrument"}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>
                ✕
              </button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <StatusBadge status={selected.status || "signal"} />
            </div>
            {selected.thumb && <img src={selected.thumb} alt="chart" className="modal-img" />}
            <DetailRow label="Direction" value={selected.direction} na={!selected.direction} />
            <DetailRow label="Entry" value={fmt(selected.entry)} na={selected.entry === null} />
            <DetailRow label="Exit" value={fmt(selected.exit_price)} na={selected.exit_price === null} />
            <DetailRow label="Stop Loss" value={fmt(selected.stop_loss)} na={selected.stop_loss === null} />
            <DetailRow label="Take Profit" value={fmt(selected.take_profit)} na={selected.take_profit === null} />
            <DetailRow label="Risk : Reward" value={selected.rr === null ? null : fmt(selected.rr, 2) + "R"} na={selected.rr === null} />
            <DetailRow label="Result (pts)" value={selected.pips === null ? null : (selected.pips >= 0 ? "+" : "") + fmt(selected.pips, 1)} na={selected.pips === null} />
            <DetailRow label="Support" value={fmt(selected.support)} na={selected.support === null} />
            <DetailRow label="Resistance" value={fmt(selected.resistance)} na={selected.resistance === null} />
            <DetailRow label="Trend" value={selected.trend} na={!selected.trend} />
            <DetailRow label="Bias" value={selected.bias} na={!selected.bias} />
            {selected.status === "executed" && (
              <>
                <DetailRow label="Filled Price" value={fmt(selected.filled_price)} na={selected.filled_price === null || selected.filled_price === undefined} />
                <DetailRow label="Broker Ticket" value={selected.broker_ticket} na={!selected.broker_ticket} />
              </>
            )}

            {selected.status === "signal" && (
              <button
                onClick={() => confirmExecute(selected.id)}
                disabled={confirming}
                className="btn"
                style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
              >
                {confirming ? "Confirming…" : "Confirm & Execute"}
              </button>
            )}
            {selected.status === "pending" && (
              <div className="error-box" style={{ color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)", marginTop: 16, marginBottom: 0 }}>
                Waiting for your MT5 terminal to pick this up and place the order.
              </div>
            )}
            {selected.status === "failed" && (
              <div className="error-box" style={{ marginTop: 16, marginBottom: 0 }}>
                The EA could not place this order. Check your MT5 terminal is running and connected.
              </div>
            )}

            <button
              onClick={() => deleteTrade(selected.id)}
              style={{
                marginTop: 12,
                width: "100%",
                background: "rgba(248,113,113,0.1)",
                color: "var(--red)",
                border: "1px solid rgba(248,113,113,0.3)",
                padding: 10,
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Delete trade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
