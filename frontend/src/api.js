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

export function query(month, search) {
  const p = new URLSearchParams();
  if (month && month !== "all") p.set("month", month);
  if (search && search.trim()) p.set("search", search.trim());
  const s = p.toString();
  return s ? "?" + s : "";
}

export async function fetchEntries(month, search) {
  const res = await fetch("/api/entries" + query(month, search));
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(body.message || "Could not load records. Is the backend running?");
  }
  return res.json();
}

export const exportUrl = (month, search) => "/api/entries/export.xlsx" + query(month, search);

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

export async function deleteMatching(month, search) {
  const res = await fetch("/api/entries" + query(month, search), { method: "DELETE" });
  if (!res.ok) throw await failWith(res, "Could not delete these entries.");
  return res.json();
}
