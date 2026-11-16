// Any 401 from a data call means the login ended (15 minutes idle, or the program restarted).
// The app listens for "pod-locked" and shows the door screen again.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const res = await nativeFetch(input, init);
  const url = typeof input === "string" ? input : input.url;
  if (res.status === 401 && url.startsWith("/api/") && !url.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event("pod-locked"));
  }
  return res;
};

async function authCall(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

export async function authStatus() {
  const res = await fetch("/api/auth/status");
  if (!res.ok) throw new Error("Could not reach the program.");
  return readJson(res);
}
export const authLogin = (pin) => authCall("/api/auth/login", { pin });
export const authLogout = () => authCall("/api/auth/logout");

async function readJson(res) {
  try { return await res.json(); } catch { return {}; }
}

export async function saveEntries(entries) {
  const res = await fetch("/api/entries/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    const err = new Error(body.message || "Could not save. Is the backend running?");
    err.duplicates = body.duplicates || [];
    throw err;
  }
  return body;
}

export function query(from, to, search, customerId) {
  const p = new URLSearchParams();
  if (customerId) p.set("customerId", customerId);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (search && search.trim()) p.set("search", search.trim());
  const s = p.toString();
  return s ? "?" + s : "";
}

export async function fetchEntries(from, to, search, customerId) {
  const res = await fetch("/api/entries" + query(from, to, search, customerId));
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(body.message || "Could not load records. Is the backend running?");
  }
  return res.json();
}

// The server hands out invoice numbers (1, 2, 3 ...). The same customer + month always gets the same number back.
export async function getInvoiceNo(from, to, customerId) {
  const p = new URLSearchParams({ customerId });
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const res = await fetch("/api/invoices/number?" + p.toString(), { method: "POST" });
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(body.message || "Could not get the invoice number. Is the backend running?");
  }
  return (await res.json()).invoiceNo;
}

export const exportUrl = (from, to, search, customerId) => "/api/entries/export.xlsx" + query(from, to, search, customerId);

async function failWith(res, fallback) {
  const body = await readJson(res);
  const err = new Error(body.message || fallback);
  err.duplicates = body.duplicates || [];
  return err;
}

export async function updateEntry(id, entry) {
  const res = await fetch("/api/entries/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw await failWith(res, "Could not update this entry.");
  return res.json();
}

export async function deleteEntry(id) {
  const res = await fetch("/api/entries/" + id, { method: "DELETE" });
  if (!res.ok) throw await failWith(res, "Could not delete this entry.");
}

export async function deleteMatching(from, to, search, customerId) {
  const res = await fetch("/api/entries" + query(from, to, search, customerId), { method: "DELETE" });
  if (!res.ok) throw await failWith(res, "Could not delete these entries.");
  return res.json();
}

// ---------- customers ----------
export async function fetchCustomers() {
  const res = await fetch("/api/customers");
  if (!res.ok) throw await failWith(res, "Could not load customers. Is the backend running?");
  return res.json();
}

export async function createCustomer(c) {
  const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
  if (!res.ok) throw await failWith(res, "Could not add this customer.");
  return res.json();
}

export async function updateCustomer(id, c) {
  const res = await fetch("/api/customers/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
  if (!res.ok) throw await failWith(res, "Could not update this customer.");
  return res.json();
}

export async function deleteCustomer(id) {
  const res = await fetch("/api/customers/" + id, { method: "DELETE" });
  if (!res.ok) throw await failWith(res, "Could not delete this customer.");
}
