import { useEffect, useMemo, useState } from "react";

const rupees = new Intl.NumberFormat("en-IN");
const reduceMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
const shortMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short" });
};
const dayLabel = (iso) => {
  if (!iso || iso === "end") return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// Avatar colours, picked from the customer's name so each customer keeps the same colour.
const AVATAR = ["#0a1d36", "#0f5f63", "#6b4300", "#4e2a63", "#1f4d2b", "#7a2e1f"];
const avatarColor = (name) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
};

// Counts up to the value once when it changes (skipped when the PC asks for less motion).
function useCountUp(target, ms = 700) {
  const [shown, setShown] = useState(0); // starts at 0 so every mount counts up
  useEffect(() => {
    if (reduceMotion() || target === 0) { setShown(target); return undefined; }
    let raf;
    const start = performance.now();
    const from = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms);
      setShown(Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

function Count({ value }) {
  return <>{rupees.format(useCountUp(value))}</>;
}

const PAGE = 12; // customer cards shown at a time; "Show more" adds another page

const SORTS = [
  { id: "amount", label: "Highest Amount" },
  { id: "name", label: "By Name" },
  { id: "unbilled", label: "Not Billed" },
];

// Dashboard: summary strip, monthly bar chart, search and sort, one card per customer.
export default function DashboardPage({ active, refreshKey, onNewBill, onAddCustomer }) {
  const [cards, setCards] = useState([]);
  const [months, setMonths] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [monthly, setMonthly] = useState({ state: "idle", rows: [] }); // idle | loading | ready | error
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("amount");
  const [billedLimit, setBilledLimit] = useState(PAGE);
  const [unbilledLimit, setUnbilledLimit] = useState(PAGE);
  const [unbilledOpen, setUnbilledOpen] = useState(false);

  // A new search or sort starts again from the first page.
  useEffect(() => {
    setBilledLimit(PAGE);
    setUnbilledLimit(PAGE);
  }, [query, sort]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setState("loading");
    Promise.all([
      fetch("/api/dashboard/customers").then((res) => { if (!res.ok) throw new Error("bad"); return res.json(); }),
      fetch("/api/dashboard/monthly").then((res) => { if (!res.ok) throw new Error("bad"); return res.json(); }),
    ])
      .then(([data, byMonth]) => {
        if (cancelled) return;
        setCards(data);
        setMonths(byMonth);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => { cancelled = true; };
  }, [active, refreshKey, reloadKey]);

  useEffect(() => {
    if (openId == null) return undefined;
    let cancelled = false;
    setMonthly({ state: "loading", rows: [] });
    fetch(`/api/dashboard/customers/${openId}/monthly`)
      .then((res) => { if (!res.ok) throw new Error("bad"); return res.json(); })
      .then((rows) => { if (!cancelled) setMonthly({ state: "ready", rows }); })
      .catch(() => { if (!cancelled) setMonthly({ state: "error", rows: [] }); });
    return () => { cancelled = true; };
  }, [openId, refreshKey]);

  const billedCards = cards.filter((c) => c.billed);
  const totalBilled = billedCards.reduce((s, c) => s + c.amount, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = cards.filter((c) => !q || c.name.toLowerCase().includes(q));
    const byName = (a, b) => a.name.localeCompare(b.name);
    if (sort === "name") return [...list].sort(byName);
    if (sort === "unbilled") return [...list].sort((a, b) => (a.billed - b.billed) || byName(a, b));
    return [...list].sort((a, b) => (b.billed - a.billed) || (b.amount - a.amount) || byName(a, b));
  }, [cards, query, sort]);

  const opened = cards.find((c) => c.id === openId);
  const maxMonth = monthly.rows.reduce((m, r) => Math.max(m, r.amount), 0);
  const last6 = months.slice(-6);
  const maxBar = last6.reduce((m, r) => Math.max(m, r.amount), 0);


  // Esc closes the details popup.
  useEffect(() => {
    if (openId == null) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpenId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  return (
    <section className="panel dash" aria-labelledby="dash-title">
      <header className="dash-head">
        <p className="eyebrow" id="dash-title">Dashboard</p>
      </header>

      {state === "loading" && (
        <div className="dash-grid" aria-label="Loading">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="dash-card">
              <span className="skeleton dash-avatar-sk" />
              <div className="dash-lines">
                <span className="skeleton" style={{ width: "70%", height: 14 }} />
                <span className="skeleton" style={{ width: "45%", height: 22 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="empty-state">
          <p>Could not load the dashboard.</p>
          <button className="primary" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}

      {state === "ready" && cards.length === 0 && (
        <div className="empty-state">
          <p>No customers yet. Add your first customer.</p>
          {onAddCustomer && <button className="primary" onClick={onAddCustomer}>Add New Customer</button>}
        </div>
      )}

      {state === "ready" && cards.length > 0 && (
        <>
          <div className="dash-summary">
            <div className="dash-stat main">
              <span className="dash-stat-label">Total Billed</span>
              <span className="dash-stat-value">₹ <Count value={totalBilled} /></span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-label">Customers Billed</span>
              <span className="dash-stat-value"><Count value={billedCards.length} /></span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-label">Not Billed</span>
              <span className="dash-stat-value"><Count value={cards.length - billedCards.length} /></span>
            </div>
          </div>

          {last6.length > 0 && (
            <div className="dash-chart" role="img" aria-label="Total Billed Over the Last 6 Months">
              <p className="dash-chart-title">Last 6 Months (All Customers)</p>
              <div className="dash-bars">
                {last6.map((r) => (
                  <div key={r.month} className="dash-bar-col" title={`${monthLabel(r.month)}: ₹ ${rupees.format(r.amount)}`}>
                    <span className="dash-bar-amt">₹ {rupees.format(r.amount)}</span>
                    <span className="dash-bar-fill" style={{ height: `${maxBar ? Math.max(4, (r.amount / maxBar) * 100) : 0}%` }} />
                    <span className="dash-bar-label">{shortMonth(r.month)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dash-tools">
            <input
              type="search" className="dash-search" placeholder="Search Customer" aria-label="Search Customers"
              value={query} onChange={(e) => setQuery(e.target.value)}
            />
            <div className="dash-chips" role="group" aria-label="Sort">
              {SORTS.map((s) => (
                <button key={s.id} type="button" className={"dash-chip" + (sort === s.id ? " on" : "")} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 && <p className="note">No matching customer.</p>}

          {(() => {
            const billedAll = visible.filter((c) => c.billed);
            const unbilledAll = visible.filter((c) => !c.billed);
            const forcedOpen = query.trim() !== "" || sort === "unbilled";
            const groupOpen = forcedOpen || unbilledOpen;
            const card = (c) => (
              <article key={c.id} className={"dash-card" + (openId === c.id ? " open" : "") + (c.billed ? "" : " idle")}>
                <span className="dash-avatar" style={{ background: avatarColor(c.name) }} aria-hidden="true">{c.name.trim().charAt(0).toUpperCase()}</span>
                <div className="dash-lines">
                  <span className="dash-name" title={c.name}>{c.name}</span>
                  {c.billed ? (
                    <>
                      <span className="dash-amt">₹ <Count value={c.amount} /></span>
                      <span className="dash-sub">Last Entry: {dayLabel(c.billedTo) || "-"}</span>
                      <button type="button" className="dash-more" onClick={() => setOpenId(c.id)}>More Details</button>
                    </>
                  ) : (
                    <>
                      <span className="dash-amt none">Not Billed Yet</span>
                      {onNewBill && <button type="button" className="dash-more" onClick={() => onNewBill(c.id)}>Create Bill</button>}
                    </>
                  )}
                </div>
              </article>
            );
            return (
              <>
                <div className="dash-grid">{billedAll.slice(0, billedLimit).map(card)}</div>
                {billedAll.length > billedLimit && (
                  <div className="dash-more-row">
                    <button type="button" className="ghost" onClick={() => setBilledLimit((n) => n + PAGE)}>
                      Show more ({billedAll.length - billedLimit} left)
                    </button>
                  </div>
                )}
                {unbilledAll.length > 0 && (
                  <section className="dash-unbilled" aria-label="Not billed customers">
                    <button type="button" className="dash-group-toggle" aria-expanded={groupOpen} disabled={forcedOpen}
                      onClick={() => setUnbilledOpen((o) => !o)}>
                      Not Billed ({unbilledAll.length}) <span aria-hidden="true">{groupOpen ? "▴" : "▾"}</span>
                    </button>
                    {groupOpen && (
                      <>
                        <div className="dash-grid">{unbilledAll.slice(0, unbilledLimit).map(card)}</div>
                        {unbilledAll.length > unbilledLimit && (
                          <div className="dash-more-row">
                            <button type="button" className="ghost" onClick={() => setUnbilledLimit((n) => n + PAGE)}>
                              Show more ({unbilledAll.length - unbilledLimit} left)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
              </>
            );
          })()}
        </>
      )}

      {opened && (
        <div className="dash-modal-back" onClick={() => setOpenId(null)}>
          <div className="dash-modal" role="dialog" aria-modal="true" aria-labelledby="dash-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-head">
              <div>
                <p className="eyebrow">Month-Wise Billed Amount</p>
                <h3 id="dash-modal-title">{opened.name}</h3>
                <p className="dash-modal-total">Total billed: <b>₹ {rupees.format(opened.amount)}</b></p>
              </div>
              <button type="button" className="ghost" onClick={() => setOpenId(null)} aria-label="Close">×</button>
            </div>
            {monthly.state === "loading" && <p className="note">Loading…</p>}
            {monthly.state === "error" && <p className="note err">Could not load the month-wise details.</p>}
            {monthly.state === "ready" && monthly.rows.length === 0 && <p className="note">No bills for this customer yet.</p>}
            {monthly.state === "ready" && monthly.rows.length > 0 && (
              <ul className="dash-months">
                {monthly.rows.map((r) => (
                  <li key={r.month} className="dash-month">
                    <span className="dash-month-label">{monthLabel(r.month)}</span>
                    <span className="dash-bar" aria-hidden="true">
                      <span style={{ width: `${maxMonth ? (r.amount / maxMonth) * 100 : 0}%` }} />
                    </span>
                    <span className="dash-month-amt">₹ {rupees.format(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
