import { TOWNS } from "./towns.js";

export const BASE = 25, STEP = 7, SLAB = 300, MAXGEN = 2000;
// Towns with one flat amount, whatever the weight.
export const FLAT_RATES = { Bombay: 150 };

const TOWNMAP = {};
TOWNS.forEach((t) => { TOWNMAP[t.toLowerCase()] = t; });

export function todayStr() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 11-digit POD = 10-digit running number + 1 digit that cycles 0..6.
export function parsePod(s) {
  const t = (s || "").trim();
  if (!/^\d{11}$/.test(t)) return { err: "POD number must be exactly 11 digits." };
  const d = Number(t[10]);
  if (d > 6) return { err: "Last digit of a POD number is 0 to 6." };
  return { n: Number(t.slice(0, 10)), d };
}

export const podAt = (n, d) => String(n).padStart(10, "0") + d;

// Each row adds 1 to the running number; the last digit rotates 0..6 from the starting digit.
export function seriesInfo(first, last) {
  const a = parsePod(first), b = parsePod(last);
  if (a.err) return { err: "Starting number: " + a.err };
  if (b.err) return { err: "Ending number: " + b.err };
  if (b.n < a.n) return { err: "Ending POD number is before the starting one." };
  const n = b.n - a.n + 1;
  if (n > MAXGEN) return { err: `That series has ${n} numbers. Keep it under ${MAXGEN} at a time.` };
  return { an: a.n, ad: a.d, n };
}

export const findTown = (s) => TOWNMAP[(s || "").trim().toLowerCase()] || null;

export function amountFor(dest, weight) {
  const w = Number(weight);
  if (!findTown(dest) || !(w > 0)) return null;
  const town = findTown(dest);
  if (FLAT_RATES[town] != null) return FLAT_RATES[town];
  return BASE + (Math.ceil(w / SLAB) - 1) * STEP;
}

export const fmtRs = (n) => "₹" + n.toLocaleString("en-IN");
export const digits = (s) => s.replace(/\D/g, "").slice(0, 11);
export const blockNonDigit = (e) => {
  if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
};

export function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}
