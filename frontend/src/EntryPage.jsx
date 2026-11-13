import { useEffect, useMemo, useRef, useState } from "react";
import DestCell from "./DestCell.jsx";
import { saveEntries } from "./api.js";
import {
  FLAT_RATES, PARCEL_FROM, amountFor, blockNonDigit, digits, findTown, fmtDate, fmtRs, isParcel, parsePod, podAt, seriesInfo, todayStr,
} from "./logic.js";

// Unsaved work is kept in this browser so a crash or an accidental close does not lose it.
const DRAFT_KEY = "pod-entry-draft-v1";
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (d && Array.isArray(d.rows) && d.rows.length > 0) return d;
  } catch { /* storage blocked or corrupt draft: start empty */ }
  return null;
}
function saveDraft(d) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage full or blocked: ignore */ }
}
function dropDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

let nextId = 1;
const mkRow = (pod, date, batch) => ({ id: nextId++, pod, date, batch, dest: "", weight: "" });
// Customer whose name starts with SBI ("SBI", "S B I", "S.B.I", "SBI-RBO") starts every new row at 300 g; others start at 0.
const isSbi = (name) => String(name || "").toLowerCase().replace(/[\s.\-_]/g, "").startsWith("sbi");
const MAX_SAVE = 5000; // the server accepts at most this many entries in one save

export default function EntryPage({ customers = [], onSaved, onOpenRecords, onOpenCustomers, onHasRows }) {
  const [draft] = useState(loadDraft); // read once, when the page opens
  const [restored, setRestored] = useState(draft ? draft.rows.length : 0);
  const [rows, setRows] = useState(() => {
    if (!draft) return [];
    nextId = Math.max(nextId, ...draft.rows.map((r) => Number(r.id) || 0)) + 1;
    return draft.rows;
  });
  const [customerId, setCustomerId] = useState(draft?.customerId || "");
  const [first, setFirst] = useState(draft?.first || "");
  const [last, setLast] = useState(draft?.last || "");
  const [date, setDate] = useState(draft?.date || todayStr()); // date for the rows of the last batch added
  const [batch, setBatch] = useState(draft?.batch || 0); // id of the last batch added: changing the date changes only these rows
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text, duplicates? }
  const [confirmClear, setConfirmClear] = useState(false);
  const lastRef = useRef(null);
  const [jumped, setJumped] = useState(false);

  // As soon as the 11th digit of the starting POD is in, move the cursor to the ending POD box (it blinks there).
  const onFirstChange = (e) => {
    const v = digits(e.target.value);
    const reached = v.length === 11 && first.length < 11;
    setFirst(v);
    if (reached) {
      setJumped(true);
      lastRef.current?.focus();
      lastRef.current?.setSelectionRange(last.length, last.length);
    }
  };

  useEffect(() => { onHasRows?.(rows.length > 0); }, [rows.length]);

  // Unsaved rows: ask the browser to confirm before the tab / window is closed or the page is reloaded.
  useEffect(() => {
    if (rows.length === 0) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [rows.length]);

  // One customer only: pick it for you. A deleted customer is dropped from the box.
  useEffect(() => {
    if (customers.length === 0) return; // list not loaded yet (or none exist): keep what was restored
    if (customerId && !customers.some((c) => String(c.id) === customerId)) setCustomerId("");
    else if (!customerId && customers.length === 1) setCustomerId(String(customers[0].id));
  }, [customers]);

  // Keep the draft up to date after every change; nothing to keep means no draft.
  useEffect(() => {
    if (rows.length === 0) { dropDraft(); return; }
    saveDraft({ rows, customerId, date, batch, first, last });
  }, [rows, customerId, date, batch, first, last]);

  // Success messages go away on their own.
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const info = first.length === 11 && last.length === 11 ? seriesInfo(first, last) : { idle: true };

  const patch = (id, key, val) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const pickDest = (id, town) => {
    const chosen = customers.find((c) => String(c.id) === customerId);
    const start = isSbi(chosen?.name) ? "300" : "0";
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, dest: town, weight: r.weight === "" ? start : r.weight } : r)));
  };
  // The customer chosen above decides every rate on this page.
  const customer = customers.find((c) => String(c.id) === customerId) || null;
  const delRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));

  // Adds a batch on top of the rows already there, so many dates can be entered before one final Save.
  const generate = () => {
    if (!info.n) return;
    if (!date) { setMsg({ kind: "err", text: "Choose the date for these rows first." }); return; }
    if (rows.length + info.n > MAX_SAVE) {
      setMsg({ kind: "err", text: `Only ${MAX_SAVE} entries can be saved at a time. You have ${rows.length}; save these first.` });
      return;
    }
    const have = new Set(rows.map((r) => r.pod));
    const add = [], dup = [];
    const b = Date.now(); // new batch id
    for (let i = 0; i < info.n; i++) {
      const pod = podAt(info.an + i, (info.ad + i) % 7);
      if (have.has(pod)) dup.push(pod); else add.push(mkRow(pod, date, b));
    }
    if (dup.length > 0) {
      setMsg({ kind: "err", text: `${dup.length} POD number(s) are already in the list below. Nothing was added.`, duplicates: dup });
      return;
    }
    setRows((rs) => add.concat(rs)); // newest batch on top; older rows stay below
    setBatch(b);
    setFirst(""); setLast(""); setJumped(false); // ready for the next series
    setAttempted(false); setMsg(null); setConfirmClear(false);
  };
  const clearAll = () => { dropDraft(); setRestored(0); setRows([]); setFirst(""); setLast(""); setAttempted(false); setMsg(null); setConfirmClear(false); };

  const totals = useMemo(() => {
    let w = 0, a = 0;
    rows.forEach((r) => { w += Number(r.weight) || 0; a += amountFor(r.dest, r.weight, customer) || 0; });
    return { w, a };
  }, [rows, customer]);

  const rowProblems = (r) => ({
    pod: !!parsePod(r.pod).err,
    date: !r.date,
    dest: !findTown(r.dest),
    weight: r.weight === "" || !(Number(r.weight) >= 0),
  });
  const incomplete = rows.filter((r) => Object.values(rowProblems(r)).some(Boolean)).length;

  const save = async () => {
    setAttempted(true); setMsg(null);
    if (!customerId) {
      setMsg({ kind: "err", text: "Choose the customer for these entries first." });
      return;
    }
    if (incomplete > 0) {
      setMsg({ kind: "err", text: `${incomplete} row(s) still need a destination or weight. They are marked in orange.` });
      return;
    }
    setSaving(true);
    try {
      const body = rows.map((r) => ({
        podNumber: r.pod, entryDate: r.date, destination: findTown(r.dest), weightGrams: Number(r.weight),
        customerId: Number(customerId),
      }));
      const res = await saveEntries(body);
      dropDraft(); setRestored(0);
      setRows([]); setFirst(""); setLast(""); setAttempted(false);
      const who = customers.find((c) => String(c.id) === customerId)?.name;
      setMsg({ kind: "ok", text: `${res.saved} entries saved${who ? " for " + who : ""}.` });
      onSaved?.();
    } catch (e) {
      setMsg({ kind: "err", text: e.message, duplicates: e.duplicates });
    } finally {
      setSaving(false);
    }
  };

  const mono = { fontFamily: "var(--font-mono)" };
  let preview;
  if (info.idle) preview = <p className="note">Type the 11-digit starting and ending POD numbers. Digits only.</p>;
  else if (info.err) preview = <p className="note err">{info.err}</p>;
  else preview = (
    <p className="note"><b>{info.n}</b> POD numbers, from <b style={mono}>{first}</b> to <b style={mono}>{podAt(info.an + info.n - 1, (info.ad + info.n - 1) % 7)}</b>.</p>
  );
  const bad = !!info.err;

  return (
    <>
      <section className="panel" aria-label="POD series">
        <div className="gen entry-row">
          <div className="field">
            <label htmlFor="cust">Customer</label>
            <select id="cust" className={attempted && !customerId ? "bad" : ""} value={customerId} disabled={rows.length > 0 && !!customerId}
              title={rows.length > 0 ? "Save or clear the entries below to change the customer" : undefined}
              onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.place ? ` · ${c.place}` : ""}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bdate">Date for these rows</label>
            <input id="bdate" type="date" value={date} onChange={(e) => {
              const v = e.target.value;
              setDate(v);
              setRows((rs) => rs.map((r) => (r.batch === batch ? { ...r, date: v } : r))); // the last batch follows the date
            }} />
          </div>
          <div className="field">
            <label htmlFor="first">Starting POD number</label>
            <input id="first" className={"mono" + (bad ? " bad" : "")} type="text" inputMode="numeric" pattern="[0-9]*"
              maxLength={11} autoComplete="off" placeholder="11 digits" value={first}
              onKeyDown={blockNonDigit} onChange={onFirstChange} />
          </div>
          <div className="field">
            <label htmlFor="last">Ending POD number</label>
            <input id="last" ref={lastRef} className={"mono" + (bad ? " bad" : "") + (jumped ? " jumped" : "")} type="text" inputMode="numeric" pattern="[0-9]*"
              maxLength={11} autoComplete="off" placeholder="11 digits" value={last}
              onKeyDown={blockNonDigit} onBlur={() => setJumped(false)} onChange={(e) => setLast(digits(e.target.value))} />
          </div>
          <div className="field">
            <button className="primary" id="gen-btn" disabled={!info.n} onClick={generate}>
              {info.n ? `Add ${info.n} rows` : "Add rows"}
            </button>
          </div>
        </div>
        {preview}
        {rows.length > 0 && customerId && (
          <p className="note">Entering for <b>{customers.find((c) => String(c.id) === customerId)?.name}</b>. Customer is locked until you save or clear.</p>
        )}
        {customers.length === 0 && (
          <p className="note err">No customers yet. <button type="button" className="ghost" onClick={onOpenCustomers}>Add a customer first</button></p>
        )}
      </section>

      {restored > 0 && rows.length > 0 && (
        <div className="banner ok" role="status">
          <span>Restored {restored} unsaved entries from your last session. Check them, then press Save.</span>
          <button onClick={() => setRestored(0)}>OK</button>
        </div>
      )}

      {msg && (
        <div className={"banner " + msg.kind} role="status">
          <span>{msg.text}</span>
          {msg.kind === "ok" && <button onClick={onOpenRecords}>View records</button>}
          {msg.duplicates?.length > 0 && (
            <span className="dups" style={mono}>{msg.duplicates.slice(0, 12).join(", ")}{msg.duplicates.length > 12 ? " …" : ""}</span>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <section className="panel fill" aria-label="Entries">
          <div className="toolbar">
            <div className="grp">
              <p className="eyebrow" style={{ margin: 0 }}>Entries · {rows.length}</p>
              <span className="rule">
                {customer
                  ? <>Cover (under {PARCEL_FROM} g) ₹{customer.coverRate} · Parcel ({PARCEL_FROM} g+) ₹{customer.parcelRate} for {customer.slabGrams} g, +₹{customer.parcelExtra} per extra {customer.slabGrams} g · Bombay ₹{FLAT_RATES.Bombay} flat</>
                  : "Choose a customer to see the rates."}
              </span>
            </div>
            <div className="grp">
              {confirmClear ? (
                <>
                  <button className="danger" onClick={clearAll}>Yes, clear all</button>
                  <button className="ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
                </>
              ) : (
                <button className="ghost" onClick={() => setConfirmClear(true)}>Clear all</button>
              )}
            </div>
          </div>

          <div className="tablewrap scroll">
            <table>
              <thead>
                <tr>
                  <th>S.No</th><th className="c-date">Date</th><th className="c-pod">POD number</th><th>Destination</th>
                  <th className="num c-w">Weight (g)</th><th className="num c-a">Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const a = amountFor(r.dest, r.weight, customer);
                  const p = attempted ? rowProblems(r) : {};
                  return (
                    <tr key={r.id}>
                      <td className="sno">{i + 1}</td>
                      <td className="ro">{r.date ? fmtDate(r.date) : "—"}</td>
                      <td><input id={`pod-${r.id}`} className={"pod" + (p.pod ? " bad" : "")} type="text" inputMode="numeric"
                        pattern="[0-9]*" maxLength={11} value={r.pod} onKeyDown={blockNonDigit}
                        onChange={(e) => patch(r.id, "pod", digits(e.target.value))} aria-label="POD number" /></td>
                      <td><DestCell id={`dest-${r.id}`} value={r.dest} invalid={p.dest}
                        onChange={(v) => patch(r.id, "dest", v)} onPick={(t) => pickDest(r.id, t)} /></td>
                      <td className="num"><input id={`w-${r.id}`} type="number" min="0" inputMode="numeric" style={{ textAlign: "right" }}
                        className={p.weight ? "bad" : ""} value={r.weight}
                        onChange={(e) => patch(r.id, "weight", e.target.value)} aria-label="Weight in grams" /></td>
                      <td className={"amt" + (a == null ? " empty" : "")}>
                        {a == null ? "—" : fmtRs(a)}
                        {a != null && <small className={"kind " + (isParcel(r.weight) ? "parcel" : "cover")}>{isParcel(r.weight) ? "Parcel" : "Cover"}</small>}
                      </td>
                      <td className="del"><button className="ghost" aria-label={`Delete row ${i + 1}`} onClick={() => delRow(r.id)}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td></td>
                  <td className="amt">{fmtRs(totals.a)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="savebar">
            <span className="note" style={{ margin: 0 }}>
              {incomplete > 0 ? `${incomplete} of ${rows.length} rows need a destination and weight.` : "All rows are ready to save."}
            </span>
            <button className="primary" id="save-btn" disabled={saving} onClick={save}>
              {saving ? "Saving…" : `Save ${rows.length} entries`}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
