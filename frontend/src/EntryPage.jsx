import { useEffect, useMemo, useRef, useState } from "react";
import DestCell from "./DestCell.jsx";
import { saveEntries } from "./api.js";
import {
  BASE, FLAT_RATES, SLAB, STEP, amountFor, blockNonDigit, digits, findTown, fmtRs, parsePod, podAt, seriesInfo, todayStr,
} from "./logic.js";

let nextId = 1;
const mkRow = (pod, date) => ({ id: nextId++, pod, date, dest: "", weight: "" });

export default function EntryPage({ customers = [], onSaved, onOpenRecords, onOpenCustomers, onHasRows }) {
  const [rows, setRows] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
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

  // One customer only: pick it for you. A deleted customer is dropped from the box.
  useEffect(() => {
    if (customerId && !customers.some((c) => String(c.id) === customerId)) setCustomerId("");
    else if (!customerId && customers.length === 1) setCustomerId(String(customers[0].id));
  }, [customers]);

  // Success messages go away on their own.
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const info = first.length === 11 && last.length === 11 ? seriesInfo(first, last) : { idle: true };

  const patch = (id, key, val) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  const pickDest = (id, town) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, dest: town, weight: r.weight === "" ? String(SLAB) : r.weight } : r)));
  const delRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));

  const generate = () => {
    if (!info.n) return;
    const d = todayStr(), add = [];
    for (let i = 0; i < info.n; i++) add.push(mkRow(podAt(info.an + i, (info.ad + i) % 7), d));
    setRows(add);
    setAttempted(false); setMsg(null); setConfirmClear(false);
  };
  const clearAll = () => { setRows([]); setFirst(""); setLast(""); setAttempted(false); setMsg(null); setConfirmClear(false); };

  const totals = useMemo(() => {
    let w = 0, a = 0;
    rows.forEach((r) => { w += Number(r.weight) || 0; a += amountFor(r.dest, r.weight) || 0; });
    return { w, a };
  }, [rows]);

  const rowProblems = (r) => ({
    pod: !!parsePod(r.pod).err,
    date: !r.date,
    dest: !findTown(r.dest),
    weight: !(Number(r.weight) > 0),
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
        <div className="gen">
          <div className="field">
            <label htmlFor="cust">Customer</label>
            <select id="cust" className={attempted && !customerId ? "bad" : ""} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.place ? ` · ${c.place}` : ""}</option>)}
            </select>
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
        {customers.length === 0 && (
          <p className="note err">No customers yet. <button type="button" className="ghost" onClick={onOpenCustomers}>Add a customer first</button></p>
        )}
      </section>

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
              <span className="rule">₹{BASE} up to {SLAB} g, +₹{STEP} for each extra {SLAB} g · Bombay ₹{FLAT_RATES.Bombay} flat</span>
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
                  const a = amountFor(r.dest, r.weight);
                  const p = attempted ? rowProblems(r) : {};
                  return (
                    <tr key={r.id}>
                      <td className="sno">{i + 1}</td>
                      <td><input id={`date-${r.id}`} type="date" value={r.date} className={p.date ? "bad" : ""}
                        onChange={(e) => patch(r.id, "date", e.target.value)} aria-label="Date" /></td>
                      <td><input id={`pod-${r.id}`} className={"pod" + (p.pod ? " bad" : "")} type="text" inputMode="numeric"
                        pattern="[0-9]*" maxLength={11} value={r.pod} onKeyDown={blockNonDigit}
                        onChange={(e) => patch(r.id, "pod", digits(e.target.value))} aria-label="POD number" /></td>
                      <td><DestCell id={`dest-${r.id}`} value={r.dest} invalid={p.dest}
                        onChange={(v) => patch(r.id, "dest", v)} onPick={(t) => pickDest(r.id, t)} /></td>
                      <td className="num"><input id={`w-${r.id}`} type="number" min="0" inputMode="numeric" style={{ textAlign: "right" }}
                        className={p.weight ? "bad" : ""} value={r.weight}
                        onChange={(e) => patch(r.id, "weight", e.target.value)} aria-label="Weight in grams" /></td>
                      <td className={"amt" + (a == null ? " empty" : "")}>{a == null ? "—" : fmtRs(a)}</td>
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
