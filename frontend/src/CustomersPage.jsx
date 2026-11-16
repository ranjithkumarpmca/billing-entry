import { useEffect, useMemo, useState } from "react";
import { createCustomer, deleteCustomer, updateCustomer } from "./api.js";
import { PencilIcon, TrashIcon } from "./icons.jsx";

const EMPTY = { name: "", gstin: "", address1: "", address2: "", city: "", coverRate: "", rate250: "", rate500: "", rate1000: "" };
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
    const cover = num(form.coverRate), r250 = num(form.rate250), r500 = num(form.rate500), r1000 = num(form.rate1000);
    if (![cover, r250, r500, r1000].every((v) => Number.isInteger(v) && v > 0)) {
      setMsg({ kind: "err", text: "Enter the cover, 250 g, 500 g and 1 kg rates (whole rupees)." }); return;
    }
    setBusy(true); setMsg(null);
    try {
      // place is not on this form: it is left as it is on an update.
      const body = { name, place: editPlace, gstin: form.gstin, address1: form.address1, address2: form.address2, city: form.city, coverRate: cover, rate250: r250, rate500: r500, rate1000: r1000 };
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
    setForm({ name: c.name, gstin: c.gstin || "", address1: c.address1 || "", address2: c.address2 || "", city: c.city || "", coverRate: String(c.coverRate), rate250: String(c.rate250), rate500: String(c.rate500), rate1000: String(c.rate1000) });
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
            <label htmlFor="c-addr1">Address 1</label>
            <input id="c-addr1" value={form.address1} maxLength={150} autoComplete="off" onChange={(e) => patch("address1", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-addr2">Address 2</label>
            <input id="c-addr2" value={form.address2} maxLength={150} autoComplete="off" onChange={(e) => patch("address2", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-city">Pincode</label>
            <input id="c-city" inputMode="numeric" value={form.city} autoComplete="off" placeholder="e.g. 638001" onChange={(e) => patch("city", e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="field">
            <label htmlFor="c-cover" title="Cover (under 250 g)">Cover ₹</label>
            <input id="c-cover" type="number" min="1" inputMode="numeric" value={form.coverRate} placeholder="e.g. 25" onChange={(e) => patch("coverRate", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-r250" title="Parcel up to 250 g">250 g ₹</label>
            <input id="c-r250" type="number" min="1" inputMode="numeric" value={form.rate250} onChange={(e) => patch("rate250", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-r500" title="Parcel 251 g to 500 g">500 g ₹</label>
            <input id="c-r500" type="number" min="1" inputMode="numeric" value={form.rate500} onChange={(e) => patch("rate500", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-r1000" title="Parcel 501 g to 1 kg">1 kg ₹</label>
            <input id="c-r1000" type="number" min="1" inputMode="numeric" value={form.rate1000} onChange={(e) => patch("rate1000", e.target.value)} />
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
                <tr><th>S.No</th><th>Customer name</th><th>GST number</th><th className="num">Cover ₹</th><th className="num">250 g ₹</th><th className="num">500 g ₹</th><th className="num">1 kg ₹</th><th></th></tr>
              </thead>
              <tbody>
                {visible.map((c, i) => (
                  <tr key={c.id} className={editId === c.id ? "editing" : ""}>
                    <td className="sno ro">{from + i + 1}</td>
                    <td className="ro">{c.name}</td>
                    <td className="ro mono">{c.gstin || "—"}</td>
                    <td className="ro num">{c.coverRate}</td>
                    <td className="ro num">{c.rate250}</td>
                    <td className="ro num">{c.rate500}</td>
                    <td className="ro num">{c.rate1000}</td>
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
