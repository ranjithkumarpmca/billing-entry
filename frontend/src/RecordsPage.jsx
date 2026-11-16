import { useEffect, useMemo, useRef, useState } from "react";
import DestCell from "./DestCell.jsx";
import { flushSync } from "react-dom";
import { deleteEntry, deleteMatching, exportUrl, fetchEntries, getInvoiceNo, updateEntry } from "./api.js";
import InvoicePrint from "./InvoicePrint.jsx";
import { PencilIcon, TrashIcon } from "./icons.jsx";
import { periodOf } from "./invoice.js";
import { amountFor, blockNonDigit, digits, findTown, fmtDate, fmtRs, parsePod, todayStr } from "./logic.js";

const PAGE_SIZE = 10;
const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// The period shown on the page: a From and To date. Blank side = no limit.
const periodLabel = (from, to) => `${from ? fmtDate(from) : "start"} to ${to ? fmtDate(to) : "today"}`;

export default function RecordsPage({ active, refreshKey, customers = [] }) {
  const now = new Date();
  // Starts with the last 3 months (the 1st of two months back, up to today). Change the dates on the page as needed.
  const defFrom = isoOf(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  const defTo = todayStr();
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(defTo);
  const [search, setSearch] = useState("");
  const [custId, setCustId] = useState(""); // "" = all customers
  const [applied, setApplied] = useState({
    customerId: "",
    from: defFrom,
    to: defTo,
    search: "",
    label: periodLabel(defFrom, defTo),
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

  const load = async (f, silent) => {
    if (!silent) setState("loading");
    try {
      setRows(await fetchEntries(f.from, f.to, f.search, f.customerId));
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
    const p = periodOf(applied.from, applied.to, rows);
    return {
      customer: customer?.name || "", address1: customer?.address1 || "", address2: customer?.address2 || "",
      city: customer?.city || "", gstin: customer?.gstin || "", invoiceNo, from: p.from, to: p.to, billDate: p.to,
    };
  }, [customer, invoiceNo, applied.from, applied.to, rows]);
  const printBill = async () => {
    if (!customer) {
      setMsg({ kind: "err", text: "Pick one customer in the filter, press Search, then Print. A bill is made for one customer." });
      return;
    }
    setMsg(null); setBusy(true);
    try {
      // The server gives this customer + month their invoice number (the same one every time).
      const no = await getInvoiceNo(applied.from, applied.to, customer.id);
      flushSync(() => setInvoiceNo(String(no)));
      window.print();
    } catch (e) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const resetEditing = () => { setEditId(null); setDraft(null); setDelId(null); setConfirmAll(false); };

  // Filters apply by themselves: a date or customer change at once, typing in the POD / town box after a short pause.
  const filterKey = useRef(null);
  useEffect(() => {
    const key = `${from}|${to}|${custId}|${search}`;
    if (filterKey.current === null) { filterKey.current = key; return; } // first open: already loaded above
    if (filterKey.current === key) return;
    const t = setTimeout(() => { filterKey.current = key; runSearch(); }, 250);
    return () => clearTimeout(t);
  }, [from, to, custId, search]);

  const runSearch = () => {
    if (from && to && from > to) {
      setMsg({ kind: "err", text: "The From date is after the To date. Change the dates." });
      return;
    }
    const who = customers.find((c) => String(c.id) === custId)?.name;
    const f = { from, to, search, customerId: custId, label: periodLabel(from, to) + (who ? ` · ${who}` : "") };
    setApplied(f); setMsg(null); resetEditing(); setPage(1);
    load(f);
  };

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount); // stays valid after deletes
  const pageStart = (cur - 1) * PAGE_SIZE;
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
      ((draft.weight === "" || !(Number(draft.weight) >= 0)) && "Enter the weight in grams (0 for a cover).");
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
      const res = await deleteMatching(applied.from, applied.to, applied.search, applied.customerId);
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
            <label htmlFor="from-d">From</label>
            <input id="from-d" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="to-d">To</label>
            <input id="to-d" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cust-f">Customer</label>
            <select id="cust-f" value={custId} onChange={(e) => setCustId(e.target.value)}>
              <option value="">All customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="q">POD number or town</label>
            <input id="q" type="text" value={search} placeholder="e.g. Madurai" autoComplete="off" onChange={(e) => setSearch(e.target.value)} />
          </div>
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
              <a className="btn" id="xlsx-link" href={exportUrl(applied.from, applied.to, applied.search, applied.customerId)} download onClick={(e) => { if (!customer) { e.preventDefault(); setMsg({ kind: "err", text: "Pick one customer in the filter, press Search, then Download Excel. The invoice number is made for one customer." }); } }}>Download Excel</a>
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
                    // Same weight and town as when it was saved: the saved amount stays, even if the customer's rates changed since.
                    const unchanged = r.destination === findTown(draft.dest) && String(r.weightGrams) === String(Number(draft.weight));
                    const a = unchanged ? r.amount : amountFor(draft.dest, draft.weight, customers.find((c) => c.id === draft.customerId));
                    return (
                      <tr key={r.id} className={"editing" + (i >= pageStart && i < pageStart + PAGE_SIZE ? "" : " pg-hide")}>
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
                    <tr key={r.id} className={i >= pageStart && i < pageStart + PAGE_SIZE ? "" : "pg-hide"}>
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
            <span className="pg-info">Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, rows.length)} of {rows.length}</span>
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
