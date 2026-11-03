import { useEffect, useMemo, useState } from "react";
import DestCell from "./DestCell.jsx";
import { flushSync } from "react-dom";
import { deleteEntry, deleteMatching, exportUrl, fetchEntries, getInvoiceNo, updateEntry } from "./api.js";
import InvoicePrint from "./InvoicePrint.jsx";
import { PencilIcon, TrashIcon } from "./icons.jsx";
import { periodOf } from "./invoice.js";
import { amountFor, blockNonDigit, digits, findTown, fmtDate, fmtRs, parsePod } from "./logic.js";

const PAGE_SIZE = 10;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function RecordsPage({ active, refreshKey, customers = [] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mon, setMon] = useState(String(now.getMonth() + 1).padStart(2, "0")); // "01".."12" or "all"
  const [search, setSearch] = useState("");
  const [custId, setCustId] = useState(""); // "" = all customers
  const [applied, setApplied] = useState({
    customerId: "",
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    search: "",
    label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
  });
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");

  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [delId, setDelId] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text }
  const [invoiceNo, setInvoiceNo] = useState(""); // given by the server when you press Print

  const years = useMemo(() => {
    const y = now.getFullYear(), out = [];
    for (let i = y + 1; i >= y - 5; i--) out.push(i);
    return out;
  }, []);

  const load = async (f, silent) => {
    if (!silent) setState("loading");
    try {
      setRows(await fetchEntries(f.month, f.search, f.customerId));
      setState("ready");
    } catch (e) {
      setError(e.message); setState("error");
    }
  };

  // Load when the tab opens, and after a save on the New entry page.
  useEffect(() => { if (active) load(applied); }, [active, refreshKey]);

  // Success messages go away on their own.
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  // Escape closes the delete-all dialog.
  useEffect(() => {
    if (!confirmAll) return;
    const onKey = (e) => { if (e.key === "Escape" && !busy) setConfirmAll(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmAll, busy]);

  const custName = useMemo(() => {
    const m = new Map();
    customers.forEach((c) => m.set(c.id, c.name));
    return (id) => (id == null ? "—" : m.get(id) || "—");
  }, [customers]);

  // The bill is made for the customer picked in the filter (after pressing Search).
  const customer = useMemo(() => customers.find((c) => String(c.id) === String(applied.customerId)) || null, [customers, applied.customerId]);
  const inv = useMemo(() => {
    const p = periodOf(applied.month, rows);
    return { customer: customer?.name || "", place: customer?.place || "", gstin: customer?.gstin || "", invoiceNo, from: p.from, to: p.to, billDate: p.to };
  }, [customer, invoiceNo, applied.month, rows]);
  const printBill = async () => {
    if (!customer) {
      setMsg({ kind: "err", text: "Pick one customer in the filter, press Search, then Print. A bill is made for one customer." });
      return;
    }
    setMsg(null); setBusy(true);
    try {
      // The server gives this customer + month their invoice number (the same one every time).
      const no = await getInvoiceNo(applied.month, customer.id);
      flushSync(() => setInvoiceNo(String(no)));
      window.print();
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const resetEditing = () => { setEditId(null); setDraft(null); setDelId(null); setConfirmAll(false); };

  const runSearch = () => {
    const who = customers.find((c) => String(c.id) === custId)?.name;
    const base = mon === "all"
      ? { month: "all", search, label: "All months" }
      : { month: `${year}-${mon}`, search, label: `${MONTHS[Number(mon) - 1]} ${year}` };
    const f = { ...base, customerId: custId, label: base.label + (who ? ` · ${who}` : "") };
    setApplied(f); setMsg(null); resetEditing(); setPage(1);
    load(f);
  };

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount); // stays valid after deletes
  const from = (cur - 1) * PAGE_SIZE;
  const pages = useMemo(() => {
    const out = [], want = new Set([1, pageCount, cur - 1, cur, cur + 1]);
    for (let p = 1; p <= pageCount; p++) {
      if (want.has(p)) out.push(p); else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  }, [cur, pageCount]);

  const totals = useMemo(() => rows.reduce((t, r) => ({ w: t.w + r.weightGrams, a: t.a + r.amount }), { w: 0, a: 0 }), [rows]);

  const startEdit = (r) => {
    setMsg(null); setDelId(null); setConfirmAll(false);
    setEditId(r.id);
    setDraft({ date: r.entryDate, pod: r.podNumber, dest: r.destination, weight: String(r.weightGrams), customerId: r.customerId ?? null });
  };
  const patchDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const saveEdit = async () => {
    const podErr = parsePod(draft.pod).err;
    const town = findTown(draft.dest);
    const problem = podErr || (!draft.date && "Date is missing.") || (!town && "Pick a destination from the list.") ||
      (!(Number(draft.weight) > 0) && "Enter the weight in grams.");
    if (problem) { setMsg({ kind: "err", text: problem }); return; }
    setBusy(true); setMsg(null);
    try {
      await updateEntry(editId, { podNumber: draft.pod, entryDate: draft.date, destination: town, weightGrams: Number(draft.weight), customerId: draft.customerId });
      resetEditing();
      setMsg({ kind: "ok", text: "Entry updated." });
      await load(applied, true);
    } catch (e) {
      setMsg({ kind: "err", text: e.duplicates?.length ? `POD number ${e.duplicates[0]} is already saved.` : e.message });
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (id) => {
    setBusy(true); setMsg(null);
    try {
      await deleteEntry(id);
      resetEditing();
      setMsg({ kind: "ok", text: "Entry deleted." });
      await load(applied, true);
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await deleteMatching(applied.month, applied.search, applied.customerId);
      resetEditing();
      setMsg({ kind: "ok", text: `${res.deleted} entries deleted.` });
      await load(applied, true);
    } catch (e) {
      setConfirmAll(false);
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel noprint" aria-label="Filter">
        <form className="gen filter-row" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
          <div className="field">
            <label htmlFor="mon">Month</label>
            <select id="mon" value={mon} onChange={(e) => setMon(e.target.value)}>
              <option value="all">All months</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="year">Year</label>
            <select id="year" value={year} disabled={mon === "all"} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cust-f">Customer</label>
            <select id="cust-f" value={custId} onChange={(e) => setCustId(e.target.value)}>
              <option value="">All customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="q">POD number or town (optional)</label>
            <input id="q" type="text" value={search} placeholder="e.g. Madurai" autoComplete="off" onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="field"><button className="primary" id="search-btn" type="submit">Search</button></div>
        </form>
      </section>

      {msg && <div className={"banner noprint " + msg.kind} role="status"><span>{msg.text}</span></div>}

      <section className="panel fill noprint" aria-label="Records">
        <div className="toolbar noprint">
          <div className="grp">
            <p className="eyebrow" style={{ margin: 0 }}>{applied.label} · {rows.length} entries</p>
          </div>
          {rows.length > 0 && (
            <div className="grp">
              <a className="btn" id="xlsx-link" href={exportUrl(applied.month, applied.search, applied.customerId)} download>Download Excel</a>
              <button id="print-btn" disabled={busy} onClick={printBill}>Print</button>
              <button className="danger" id="delete-all" disabled={busy} onClick={() => { setConfirmAll(true); setEditId(null); setDelId(null); }}>Delete all</button>
            </div>
          )}
        </div>

        <h2 className="print-title">Franch Express Courier · POD Records · {applied.label}</h2>

        {state === "error" && <p className="note err">{error}</p>}
        {state === "loading" && <p className="note">Loading…</p>}

        {state === "ready" && rows.length === 0 && (
          <div className="empty-state">
            <b>No data available</b>
            <span>{applied.label}{applied.search ? ` · “${applied.search}”` : ""}</span>
          </div>
        )}

        {state === "ready" && rows.length > 0 && (
          <div className="tablewrap scroll">
            <table>
              <thead>
                <tr>
                  <th>S.No</th><th>Date</th><th>Customer</th><th>POD number</th><th>Destination</th>
                  <th className="num">Weight (g)</th><th className="num">Amount</th><th className="noprint"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  if (editId === r.id && draft) {
                    const a = amountFor(draft.dest, draft.weight);
                    return (
                      <tr key={r.id} className={"editing" + (i >= from && i < from + PAGE_SIZE ? "" : " pg-hide")}>
                        <td className="sno ro">{i + 1}</td>
                        <td><input id="edit-date" type="date" value={draft.date} onChange={(e) => patchDraft("date", e.target.value)} aria-label="Date" /></td>
                        <td className="ro">{custName(draft.customerId)}</td>
                        <td><input id="edit-pod" className={"pod" + (parsePod(draft.pod).err ? " bad" : "")} type="text" inputMode="numeric" pattern="[0-9]*"
                          maxLength={11} value={draft.pod} onKeyDown={blockNonDigit} onChange={(e) => patchDraft("pod", digits(e.target.value))} aria-label="POD number" /></td>
                        <td><DestCell id="edit-dest" value={draft.dest} onChange={(v) => patchDraft("dest", v)} onPick={(t) => patchDraft("dest", t)} /></td>
                        <td className="num"><input id="edit-weight" type="number" min="0" inputMode="numeric" style={{ textAlign: "right" }}
                          value={draft.weight} onChange={(e) => patchDraft("weight", e.target.value)} aria-label="Weight in grams" /></td>
                        <td className={"amt" + (a == null ? " empty" : "")}>{a == null ? "—" : fmtRs(a)}</td>
                        <td className="actions noprint">
                          <button className="primary" id="edit-save" disabled={busy} onClick={saveEdit}>{busy ? "Saving…" : "Save"}</button>
                          <button className="ghost" disabled={busy} onClick={() => { resetEditing(); setMsg(null); }}>Cancel</button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={r.id} className={i >= from && i < from + PAGE_SIZE ? "" : "pg-hide"}>
                      <td className="sno ro">{i + 1}</td>
                      <td className="ro">{fmtDate(r.entryDate)}</td>
                      <td className="ro">{custName(r.customerId)}</td>
                      <td className="ro mono">{r.podNumber}</td>
                      <td className="ro">{r.destination}</td>
                      <td className="ro num">{r.weightGrams}</td>
                      <td className="amt">{fmtRs(r.amount)}</td>
                      <td className="actions noprint">
                        {delId === r.id ? (
                          <>
                            <span className="ask">Delete?</span>
                            <button className="danger" disabled={busy} onClick={() => removeOne(r.id)}>Yes</button>
                            <button className="ghost" disabled={busy} onClick={() => setDelId(null)}>No</button>
                          </>
                        ) : (
                          <>
                            <button className="icon-btn edit row-edit" title="Edit" aria-label={`Edit row ${i + 1}`} onClick={() => startEdit(r)}><PencilIcon /></button>
                            <button className="icon-btn del row-del" title="Delete" aria-label={`Delete row ${i + 1}`} onClick={() => { setDelId(r.id); setEditId(null); setConfirmAll(false); }}><TrashIcon /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total</td>
                  <td></td>
                  <td className="amt">{fmtRs(totals.a)}</td>
                  <td className="noprint"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {state === "ready" && rows.length > PAGE_SIZE && (
          <nav className="pager noprint" aria-label="Pages">
            <span className="pg-info">Showing {from + 1}–{Math.min(from + PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div className="pg-btns">
              <button disabled={cur === 1} onClick={() => { setPage(cur - 1); resetEditing(); }}>‹ Prev</button>
              {pages.map((p, i) => p === "…"
                ? <span key={"g" + i} className="pg-gap">…</span>
                : <button key={p} className={p === cur ? "on" : ""} aria-current={p === cur ? "page" : undefined}
                    onClick={() => { setPage(p); resetEditing(); }}>{p}</button>)}
              <button disabled={cur === pageCount} onClick={() => { setPage(cur + 1); resetEditing(); }}>Next ›</button>
            </div>
          </nav>
        )}
      </section>

      {state === "ready" && rows.length > 0 && <InvoicePrint rows={rows} inv={inv} />}

      {confirmAll && (
        <div className="overlay noprint" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setConfirmAll(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text">
            <div className="modal-icon" aria-hidden="true">!</div>
            <h2 id="dlg-title">Delete all entries?</h2>
            <p id="dlg-text">
              <b>{rows.length}</b> {rows.length === 1 ? "entry" : "entries"} for <b>{applied.label}</b>
              {applied.search ? <> matching <b>“{applied.search}”</b></> : null} will be deleted from the database.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button id="dlg-cancel" autoFocus disabled={busy} onClick={() => setConfirmAll(false)}>Cancel</button>
              <button className="danger-solid" id="delete-all-yes" disabled={busy} onClick={removeAll}>
                {busy ? "Deleting…" : "Yes, delete all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
