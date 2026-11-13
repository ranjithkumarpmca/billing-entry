import { useEffect, useMemo, useState } from "react";
import { createCustomer, deleteCustomer, updateCustomer } from "./api.js";
import { PencilIcon, TrashIcon } from "./icons.jsx";

const EMPTY = { name: "", gstin: "", coverRate: "", parcelRate: "", parcelExtra: "", slabGrams: "300" };
const PAGE_SIZE = 10;

export default function CustomersPage({ customers, state, onChanged }) {
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [editPlace, setEditPlace] = useState("");
  const [delId, setDelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text }
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount); // stays valid after deletes
  const from = (cur - 1) * PAGE_SIZE;
  const visible = customers.slice(from, from + PAGE_SIZE);
  const pages = useMemo(() => {
    const out = [], want = new Set([1, pageCount, cur - 1, cur, cur + 1]);
    for (let p = 1; p <= pageCount; p++) {
      if (want.has(p)) out.push(p); else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  }, [cur, pageCount]);

  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => { setForm(EMPTY); setEditId(null); setEditPlace(""); };

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setMsg({ kind: "err", text: "Type the customer name." }); return; }
    const num = (v) => (String(v).trim() === "" ? NaN : Number(v));
    const cover = num(form.coverRate), parcel = num(form.parcelRate), extra = num(form.parcelExtra), slab = num(form.slabGrams);
    if (!(cover > 0) || !(parcel > 0)) { setMsg({ kind: "err", text: "Enter the cover rate and the parcel rate (rupees)." }); return; }
    if (!(extra >= 0)) { setMsg({ kind: "err", text: "Enter the extra rate for each further slab (0 if there is none)." }); return; }
    if (!(slab > 0)) { setMsg({ kind: "err", text: "Enter the slab size in grams, e.g. 300." }); return; }
    if (![cover, parcel, extra, slab].every(Number.isInteger)) { setMsg({ kind: "err", text: "Rates and slab size must be whole numbers." }); return; }
    setBusy(true); setMsg(null);
    try {
      // place is not on this form: it is left as it is on an update.
      const body = { name, place: editPlace, gstin: form.gstin, coverRate: cover, parcelRate: parcel, parcelExtra: extra, slabGrams: slab };
      if (editId) await updateCustomer(editId, body); else await createCustomer(body);
      await onChanged();
      setMsg({ kind: "ok", text: editId ? "Customer updated." : "Customer added." });
      reset();
    } catch (err) {
      setMsg({ kind: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c) => {
    setMsg(null); setDelId(null); setEditId(c.id);
    setEditPlace(c.place || "");
    setForm({ name: c.name, gstin: c.gstin || "", coverRate: String(c.coverRate), parcelRate: String(c.parcelRate), parcelExtra: String(c.parcelExtra), slabGrams: String(c.slabGrams) });
  };

  const remove = async (id) => {
    setBusy(true); setMsg(null);
    try {
      await deleteCustomer(id);
      await onChanged();
      setDelId(null);
      if (editId === id) reset();
      setMsg({ kind: "ok", text: "Customer deleted." });
    } catch (err) {
      setMsg({ kind: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel" aria-label="Add customer">
        <form className="gen cust-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="c-name">Customer name</label>
            <input id="c-name" value={form.name} maxLength={150} autoComplete="off" placeholder="e.g. SBI AMCC" onChange={(e) => patch("name", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-gstin">GST number</label>
            <input id="c-gstin" className="mono" value={form.gstin} maxLength={15} autoComplete="off" placeholder="15 characters" onChange={(e) => patch("gstin", e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))} />
          </div>
          <div className="field">
            <label htmlFor="c-cover" title="Flat rate for a cover (under 250 g)">Cover ₹</label>
            <input id="c-cover" type="number" min="1" inputMode="numeric" value={form.coverRate} placeholder="e.g. 25" onChange={(e) => patch("coverRate", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-parcel" title="Parcel (250 g and above): price of the first slab">Parcel ₹</label>
            <input id="c-parcel" type="number" min="1" inputMode="numeric" value={form.parcelRate} placeholder="e.g. 40" onChange={(e) => patch("parcelRate", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-extra" title="Parcel: price for each further slab">Extra ₹/slab</label>
            <input id="c-extra" type="number" min="0" inputMode="numeric" value={form.parcelExtra} placeholder="e.g. 7" onChange={(e) => patch("parcelExtra", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-slab" title="Slab size in grams">Slab (g)</label>
            <input id="c-slab" type="number" min="1" inputMode="numeric" value={form.slabGrams} onChange={(e) => patch("slabGrams", e.target.value)} />
          </div>
          <div className="field cust-actions">
            <button className="primary" id="cust-save" type="submit" disabled={busy}>
              {busy ? "Saving…" : editId ? "Update customer" : "Add customer"}
            </button>
            {editId && <button type="button" className="ghost" disabled={busy} onClick={() => { reset(); setMsg(null); }}>Cancel</button>}
          </div>
        </form>
      </section>

      {msg && <div className={"banner " + msg.kind} role="status"><span>{msg.text}</span></div>}

      <section className="panel fill" aria-label="Customers">
        <div className="toolbar">
          <div className="grp"><p className="eyebrow" style={{ margin: 0 }}>Customers · {customers.length}</p></div>
        </div>
        {state === "error" && <p className="note err">Could not load customers. Is the backend running?</p>}
        {state !== "error" && customers.length === 0 && (
          <div className="empty-state"><b>No customers yet</b><span>Add your first customer above.</span></div>
        )}
        {customers.length > 0 && (
          <div className="tablewrap scroll">
            <table>
              <thead>
                <tr><th>S.No</th><th>Customer name</th><th>GST number</th><th className="num">Cover ₹</th><th className="num">Parcel ₹</th><th className="num">Extra ₹</th><th className="num">Slab g</th><th></th></tr>
              </thead>
              <tbody>
                {visible.map((c, i) => (
                  <tr key={c.id} className={editId === c.id ? "editing" : ""}>
                    <td className="sno ro">{from + i + 1}</td>
                    <td className="ro">{c.name}</td>
                    <td className="ro mono">{c.gstin || "—"}</td>
                    <td className="ro num">{c.coverRate}</td>
                    <td className="ro num">{c.parcelRate}</td>
                    <td className="ro num">{c.parcelExtra}</td>
                    <td className="ro num">{c.slabGrams}</td>
                    <td className="actions">
                      {delId === c.id ? (
                        <>
                          <span className="ask">Delete?</span>
                          <button className="danger" disabled={busy} onClick={() => remove(c.id)}>Yes</button>
                          <button className="ghost" disabled={busy} onClick={() => setDelId(null)}>No</button>
                        </>
                      ) : (
                        <>
                          <button className="icon-btn edit" title="Edit" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)}><PencilIcon /></button>
                          <button className="icon-btn del" title="Delete" aria-label={`Delete ${c.name}`} onClick={() => { setDelId(c.id); setEditId(null); setEditPlace(""); setForm(EMPTY); }}><TrashIcon /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {customers.length > PAGE_SIZE && (
          <nav className="pager noprint" aria-label="Pages">
            <span className="pg-info">Showing {from + 1}–{Math.min(from + PAGE_SIZE, customers.length)} of {customers.length}</span>
            <div className="pg-btns">
              <button disabled={cur === 1} onClick={() => { setPage(cur - 1); setDelId(null); }}>‹ Prev</button>
              {pages.map((p, i) => p === "…"
                ? <span key={"g" + i} className="pg-gap">…</span>
                : <button key={p} className={p === cur ? "on" : ""} aria-current={p === cur ? "page" : undefined}
                    onClick={() => { setPage(p); setDelId(null); }}>{p}</button>)}
              <button disabled={cur === pageCount} onClick={() => { setPage(cur + 1); setDelId(null); }}>Next ›</button>
            </div>
          </nav>
        )}
      </section>
    </>
  );
}
