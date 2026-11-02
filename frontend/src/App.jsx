import { useState } from "react";
import EntryPage from "./EntryPage.jsx";
import RecordsPage from "./RecordsPage.jsx";
import Hero, { Backdrop, Foot } from "./Hero.jsx";

export default function App() {
  const [tab, setTab] = useState("entry");
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasRows, setHasRows] = useState(false);

  return (
    <>
      <Backdrop dim={hasRows || tab === "records"} />
      <div className="app">
        <Hero>
          <nav className="tabs noprint" aria-label="Pages">
            <button className={tab === "entry" ? "on" : ""} onClick={() => setTab("entry")}>New entry</button>
            <button className={tab === "records" ? "on" : ""} onClick={() => setTab("records")}>Records</button>
          </nav>
        </Hero>

        <div hidden={tab !== "entry"} className="stack">
          <EntryPage onHasRows={setHasRows} onSaved={() => setRefreshKey((k) => k + 1)} onOpenRecords={() => setTab("records")} />
        </div>
        <div hidden={tab !== "records"} className="stack">
          <RecordsPage active={tab === "records"} refreshKey={refreshKey} />
        </div>
        <Foot />
      </div>
    </>
  );
}
