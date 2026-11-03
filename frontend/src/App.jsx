import { useEffect, useState } from "react";
import EntryPage from "./EntryPage.jsx";
import RecordsPage from "./RecordsPage.jsx";
import CustomersPage from "./CustomersPage.jsx";
import { fetchCustomers } from "./api.js";
import Hero, { Backdrop, Foot } from "./Hero.jsx";

export default function App() {
  const [tab, setTab] = useState("entry");
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasRows, setHasRows] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [custState, setCustState] = useState("loading"); // loading | ready | error

  const loadCustomers = async () => {
    try {
      setCustomers(await fetchCustomers());
      setCustState("ready");
    } catch {
      setCustState("error");
    }
  };
  useEffect(() => { loadCustomers(); }, []);

  return (
    <>
      <Backdrop dim={hasRows || tab !== "entry"} />
      <div className="app">
        <Hero>
          <nav className="tabs noprint" aria-label="Pages">
            <button className={tab === "entry" ? "on" : ""} onClick={() => setTab("entry")}>New entry</button>
            <button className={tab === "records" ? "on" : ""} onClick={() => setTab("records")}>Records</button>
            <button className={tab === "customers" ? "on" : ""} onClick={() => setTab("customers")}>Add new customer</button>
          </nav>
        </Hero>

        <div hidden={tab !== "entry"} className="stack">
          <EntryPage customers={customers} onHasRows={setHasRows} onSaved={() => setRefreshKey((k) => k + 1)}
            onOpenRecords={() => setTab("records")} onOpenCustomers={() => setTab("customers")} />
        </div>
        <div hidden={tab !== "records"} className="stack">
          <RecordsPage active={tab === "records"} refreshKey={refreshKey} customers={customers} />
        </div>
        <div hidden={tab !== "customers"} className="stack">
          <CustomersPage customers={customers} state={custState} onChanged={loadCustomers} />
        </div>
        <Foot />
      </div>
    </>
  );
}
