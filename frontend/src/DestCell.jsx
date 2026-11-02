import { useEffect, useMemo, useRef, useState } from "react";
import { TOWNS } from "./towns.js";
import { findTown } from "./logic.js";

// Town search box: type "ma" and Madurai shows up. Arrow keys + Enter also work.
export default function DestCell({ id, value, onChange, onPick, invalid }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState(null);
  const ref = useRef(null);

  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return TOWNS.slice(0, 8);
    const starts = [], inside = [];
    TOWNS.forEach((t) => {
      const i = t.toLowerCase().indexOf(q);
      if (i === 0) starts.push(t); else if (i > 0) inside.push(t);
    });
    return starts.concat(inside).slice(0, 8);
  }, [q]);

  // Keep the list under the input while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setBox({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 220) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);

  const pick = (t) => { onPick(t); setOpen(false); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === "Escape") setOpen(false);
  };
  const highlight = (t) => {
    const i = q ? t.toLowerCase().indexOf(q) : -1;
    if (i < 0) return t;
    return <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
  };

  const bad = invalid || (value.trim() && !findTown(value));
  return (
    <div>
      <input
        ref={ref} id={id} type="text" value={value} placeholder="Type town, e.g. Ma…" autoComplete="off"
        aria-label="Destination" className={bad ? "bad" : ""}
        onChange={(e) => { onChange(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      {open && box && (
        <div className="drop" style={{ top: box.top, left: box.left, width: box.width }}>
          {matches.length ? matches.map((t, i) => (
            <div key={t} className={i === active ? "on" : ""}
                 onMouseDown={(e) => { e.preventDefault(); pick(t); }} onMouseEnter={() => setActive(i)}>
              {highlight(t)}
            </div>
          )) : <div className="none">No town matches “{value}”</div>}
        </div>
      )}
    </div>
  );
}
