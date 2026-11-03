// Your agency details as they print at the top and bottom of the bill. Change them here if they ever change.
export const SELLER = {
  name: "G.P.AGENCY",
  address: "NO.205 N.M.S COMPOUND.ERODE.1",
  gstin: "33BAGPP6715GIZQ",
  signFor: "G.P Agency",
  signTitle: "Proprietor",
};
export const GST_RATE = 9; // percent, charged twice: CGST and SGST

// Everything is worked out in paise so nothing drifts.
// total x 9%  =  total x 9 paise.  Grand total = (total + CGST + SGST) rounded to a whole rupee.
export function invoiceTotals(total) {
  const taxPaise = total * GST_RATE;
  const grossPaise = total * 100 + 2 * taxPaise;
  const grand = Math.round(grossPaise / 100);
  return { total, cgst: taxPaise / 100, sgst: taxPaise / 100, roundOff: (grand * 100 - grossPaise) / 100, grand };
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below1000(n) {
  const out = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)] + " hundred"); n %= 100; }
  if (n >= 20) out.push(TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
  else if (n > 0) out.push(ONES[n]);
  return out.join(" ");
}

// 2359 -> "Two thousand three hundred fifty nine only."  (Indian grouping: crore, lakh, thousand)
export function rupeesInWords(n) {
  if (!n) return "Zero only.";
  const parts = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor(n / 1e5) % 100, thou = Math.floor(n / 1e3) % 100, rest = n % 1000;
  if (crore) parts.push(below1000(crore) + " crore");
  if (lakh) parts.push(below1000(lakh) + " lakh");
  if (thou) parts.push(below1000(thou) + " thousand");
  if (rest) parts.push(below1000(rest));
  const s = parts.join(" ") + " only.";
  return s[0].toUpperCase() + s.slice(1);
}

// 2026-04-02 -> 02.04.2026
export function dotDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Bill period: the whole month on screen, or from the 1st of the first month to the last day of the last month when "All months".
const pad = (n) => String(n).padStart(2, "0");
const lastDay = (ym) => { const [y, m] = ym.split("-").map(Number); return `${ym}-${pad(new Date(y, m, 0).getDate())}`; };
export function periodOf(month, rows) {
  if (month && month !== "all") return { from: `${month}-01`, to: lastDay(month) };
  const ds = rows.map((r) => r.entryDate).sort();
  if (!ds.length) return { from: "", to: "" };
  return { from: ds[0].slice(0, 7) + "-01", to: lastDay(ds[ds.length - 1].slice(0, 7)) };
}
