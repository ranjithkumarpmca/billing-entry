import { useEffect, useState } from "react";
import { createCustomer, deleteCustomer, updateCustomer } from "./api.js";
import { PencilIcon, TrashIcon } from "./icons.jsx";

const EMPTY = { name: "", place: "", gstin: "" };

export default function CustomersPage({ customers, state, onChanged }) {
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text }

  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const patch = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => { setForm(EMPTY); setEditId(null); };

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setMsg({ kind: "err", text: "Type the customer name." }); return; }
    setBusy(true); setMsg(null);
    try {
      const body = { name, place: form.place, gstin: form.gstin };
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
    setForm({ name: c.name, place: c.place || "", gstin: c.gstin || "" });
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
                <tr><th>S.No</th><th>Customer name</th><th></th></tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={c.id} className={editId === c.id ? "editing" : ""}>
                    <td className="sno ro">{i + 1}</td>
                    <td className="ro">{c.name}</td>
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
                          <button className="icon-btn del" title="Delete" aria-label={`Delete ${c.name}`} onClick={() => { setDelId(c.id); setEditId(null); setForm(EMPTY); }}><TrashIcon /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
