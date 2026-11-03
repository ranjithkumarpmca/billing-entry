import { GST_RATE, SELLER, dotDate, invoiceTotals, rupeesInWords } from "./invoice.js";

// The printed bill. It is hidden on screen and only shows when you press Print.
export default function InvoicePrint({ rows, inv }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const t = invoiceTotals(total);
  const cols = (
    <colgroup>
      <col style={{ width: "8%" }} /><col style={{ width: "14%" }} /><col style={{ width: "19%" }} />
      <col style={{ width: "27%" }} /><col style={{ width: "17%" }} /><col style={{ width: "15%" }} />
    </colgroup>
  );

  return (
    <div className="invoice print-only">
      <table className="inv">
        {cols}
        <tbody>
          <tr><td colSpan={6} className="inv-name">{SELLER.name}</td></tr>
          <tr><td colSpan={6}>{SELLER.address}</td></tr>
          <tr><td colSpan={6}>GSTIN:{SELLER.gstin}</td></tr>
          <tr><td colSpan={3}>CUSTOMER NAME : {inv.customer}</td><td colSpan={3}>INVOICE NO:{inv.invoiceNo}</td></tr>
          <tr><td colSpan={3}>{inv.place}</td><td colSpan={3}>PERIOD FROM:{dotDate(inv.from)} to {dotDate(inv.to)}</td></tr>
          <tr><td colSpan={3}>{inv.gstin ? `GSTIN:${inv.gstin}` : ""}</td><td colSpan={3}>Billing date: {dotDate(inv.billDate)}</td></tr>
        </tbody>
      </table>

      <table className="inv items">
        {cols}
        <thead>
          <tr><th>SL.NO</th><th>DATE</th><th>CON NO</th><th>DESTINATION</th><th>WEIGHT(GMS)</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td><td>{dotDate(r.entryDate)}</td><td>{r.podNumber}</td>
              <td>{r.destination}</td><td>{r.weightGrams}</td><td>{r.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-end">
        <table className="inv items">
          {cols}
          <tbody>
            <tr>
              <td colSpan={4} rowSpan={5} className="words">{rupeesInWords(t.grand)}</td>
              <td className="lbl">Total</td><td>{t.total}</td>
            </tr>
            <tr><td className="lbl">CGST {GST_RATE}%</td><td>{t.cgst.toFixed(2)}</td></tr>
            <tr><td className="lbl">SGST {GST_RATE}%</td><td>{t.sgst.toFixed(2)}</td></tr>
            <tr><td className="lbl">Round off</td><td>{t.roundOff.toFixed(2)}</td></tr>
            <tr className="grand"><td className="lbl">Grand total</td><td>{t.grand}</td></tr>
            <tr>
              <td colSpan={6} className="sign">
                <div>For {SELLER.signFor}</div>
                <div className="sig-space" />
                <div>{SELLER.signTitle}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
