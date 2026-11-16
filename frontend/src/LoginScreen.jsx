import { useEffect, useState } from "react";
import { authLogin } from "./api.js";
import { playLock, playUnlock } from "./sound.js";

// Two doors and a padlock, with one PIN box. Wrong PIN shakes the card.
// stage: "idle" (closed, waiting) | "unlocking" (doors slide open) | "locking" (doors slide shut)
export default function LoginScreen({ stage, notice, onSignedIn }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (stage === "unlocking") playUnlock();
    if (stage === "locking") playLock();
  }, [stage]);

  const submitLogin = async (e) => {
    e.preventDefault();
    if (busy || pin.length < 4) return;
    setBusy(true);
    setErr("");
    try {
      const r = await authLogin(pin);
      onSignedIn(r.role);
    } catch (ex) {
      setPin("");
      setErr(ex.message);
      setShake(true);
      setTimeout(() => setShake(false), 450);
    } finally {
      setBusy(false);
    }
  };

  const padlockOpen = stage === "unlocking";
  const cardHidden = stage !== "idle";

  return (
    <div className={"auth-scene " + stage} role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="auth-door left" aria-hidden="true"><span className="auth-grip" /></div>
      <div className="auth-door right" aria-hidden="true"><span className="auth-grip" /></div>

      <div className="auth-stack">
        <div className={"auth-brand" + (cardHidden ? " hide" : "")}>
          <img src="/logo.png" alt="" className="auth-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <svg className={"auth-padlock" + (padlockOpen ? " open" : "")} viewBox="0 0 64 80" aria-hidden="true">
          <path className="auth-shackle" d="M18 34 V22 a14 14 0 0 1 28 0 V34" fill="none" stroke="#f2a900" strokeWidth="6" strokeLinecap="round" />
          <rect x="8" y="34" width="48" height="40" rx="7" fill="#f2a900" />
          <circle cx="32" cy="50" r="5" fill="#0a1d36" />
          <rect x="30" y="52" width="4" height="11" rx="2" fill="#0a1d36" />
        </svg>

        <div className={"auth-card" + (shake ? " shake" : "") + (cardHidden ? " hide" : "")}>
          <form onSubmit={submitLogin} className="auth-form">
            <p className="auth-title">Enter Password</p>
            <input
              id="pin" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              autoFocus maxLength={8} value={pin} className="auth-pin" aria-label="Password"
              onChange={(e) => setPin(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
            />
            <button className="primary auth-go" type="submit" disabled={busy || pin.length < 4}>
              {busy ? "Checking…" : "Unlock"}
            </button>
            <p className={"auth-msg" + (err ? " err" : "")} role="status">{err || notice || " "}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
