import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "./api";
import "./styles.css";

type Screen = "login" | "register" | "verify" | "forgot" | "reset" | "account";
type User = { id: string; email: string; emailVerifiedAt: string | null; createdAt: string };
type Session = { accessToken: string; refreshToken: string; expiresAt: number };
type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user?: User;
};

const SESSION_KEY = "storeforge.auth.session";

function readSession(): Session | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(tokens: TokenPair): Session {
  const value = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value;
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={"brand" + (light ? " brand-light" : "")}>
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="M6.5 10.2 16 4.8l9.5 5.4v11.6L16 27.2l-9.5-5.4V10.2Z" />
          <path d="m7 10.7 9 5.1 9-5.1M16 16v10.5m-4.5-18 9 5.2" />
        </svg>
      </span>
      <span>storeforge</span>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  action?: React.ReactNode;
}) {
  const id = props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{props.label}</span>
      <span className="input-shell">
        <input
          id={id}
          type={props.type ?? "text"}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          required
          minLength={props.minLength}
          maxLength={props.maxLength}
        />
        {props.action}
      </span>
    </label>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [screen, setScreen] = useState<Screen>(() => readSession() ? "account" : "login");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(() => Boolean(readSession()));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = readSession();
    if (!saved) return;
    const existing: Session = saved;
    let active = true;
    async function restore() {
      try {
        const profile = await api<{ user: User }>("/auth/me", { accessToken: existing.accessToken });
        if (active) setUser(profile.user);
      } catch {
        try {
          const rotated = await api<TokenPair>("/auth/refresh", {
            method: "POST",
            body: { refreshToken: existing.refreshToken },
          });
          const next = saveSession(rotated);
          const profile = await api<{ user: User }>("/auth/me", { accessToken: next.accessToken });
          if (active) {
            setSession(next);
            setUser(profile.user);
          }
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
          if (active) {
            setSession(null);
            setUser(null);
            setScreen("login");
          }
        }
      } finally {
        if (active) setRestoring(false);
      }
    }
    void restore();
    return () => { active = false; };
  }, []);

  function clearMessages() {
    setNotice("");
    setError("");
  }

  function navigate(next: Screen) {
    clearMessages();
    setScreen(next);
  }

  async function run(event: FormEvent<HTMLFormElement>, action: () => Promise<void>) {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "EMAIL_NOT_VERIFIED") {
        setScreen("verify");
        setNotice("Verify your email before signing in. You can request a fresh link below.");
      } else {
        setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      const result = await api<{ user: User; devToken?: string }>("/auth/register", {
        method: "POST", body: { email, password },
      });
      setEmail(result.user.email);
      setToken(result.devToken ?? "");
      setPassword("");
      setScreen("verify");
      setNotice(result.devToken
        ? "Account created. Your local verification token is ready below."
        : "Account created. Check your email for a verification link.");
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      const result = await api<TokenPair>("/auth/login", {
        method: "POST", body: { email, password },
      });
      const next = saveSession(result);
      setSession(next);
      setPassword("");
      const profile = result.user
        ? { user: result.user }
        : await api<{ user: User }>("/auth/me", { accessToken: next.accessToken });
      setUser(profile.user);
      setScreen("account");
      setNotice("You’re signed in. Your workspace is ready.");
    });
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      await api("/auth/email-verification/complete", { method: "POST", body: { token } });
      setToken("");
      setScreen("login");
      setNotice("Email verified. You can sign in now.");
    });
  }

  async function resendVerification() {
    clearMessages();
    setBusy(true);
    try {
      const result = await api<{ devToken?: string }>("/auth/email-verification/request", {
        method: "POST", body: { email },
      });
      if (result.devToken) setToken(result.devToken);
      setNotice(result.devToken
        ? "Local verification token refreshed below."
        : "If the account needs verification, instructions have been sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request verification.");
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      const result = await api<{ devToken?: string }>("/auth/password-reset/request", {
        method: "POST", body: { email },
      });
      setToken(result.devToken ?? "");
      setScreen("reset");
      setNotice(result.devToken
        ? "Local reset token ready. It expires after 30 minutes."
        : "If the account exists, reset instructions have been sent.");
    });
  }

  async function completeReset(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      await api("/auth/password-reset/complete", {
        method: "POST", body: { token, newPassword },
      });
      setToken("");
      setNewPassword("");
      setScreen("login");
      setNotice("Password reset complete. Sign in with your new password.");
    });
  }

  async function refreshSession() {
    if (!session) return;
    clearMessages();
    setBusy(true);
    try {
      const result = await api<TokenPair>("/auth/refresh", {
        method: "POST", body: { refreshToken: session.refreshToken },
      });
      setSession(saveSession(result));
      setNotice("Session refreshed. The previous refresh token has been retired.");
    } catch (caught) {
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      setUser(null);
      setScreen("login");
      setError(caught instanceof Error ? caught.message : "Session expired. Please sign in again.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      if (!session) throw new Error("Your session expired. Please sign in again.");
      await api("/auth/password", {
        method: "PATCH",
        accessToken: session.accessToken,
        body: { currentPassword, newPassword },
      });
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      setUser(null);
      setCurrentPassword("");
      setNewPassword("");
      setScreen("login");
      setNotice("Password updated. Sign in again with your new password.");
    });
  }

  async function logout() {
    clearMessages();
    setBusy(true);
    try {
      if (session) {
        await api("/auth/logout", {
          method: "POST", body: { refreshToken: session.refreshToken },
        });
      }
    } catch {
      // Always remove this browser's saved credentials, even if the API is unavailable.
    } finally {
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      setUser(null);
      setScreen("login");
      setNotice("You’ve signed out.");
      setBusy(false);
    }
  }

  if (restoring) {
    return <main className="restore-screen"><div className="restore-card"><span className="spinner spinner-dark" /> Restoring your session…</div></main>;
  }

  const passwordType = showPassword ? "text" : "password";
  const visibilityToggle = (
    <button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
      {showPassword ? "HIDE" : "SHOW"}
    </button>
  );

  return (
    <main className={"app-shell" + (screen === "account" ? " account-shell" : "")}>
      <section className="story-panel">
        <div className="story-glow story-glow-a" />
        <div className="story-glow story-glow-b" />
        <header className="story-header">
          <Brand light />
          <span className="story-caption">YOUR COMMERCE WORKSPACE</span>
        </header>
        <div className="story-body">
          <p className="eyebrow eyebrow-inverse"><i /> A BETTER WAY TO BUILD</p>
          <h1>Make room<br />for <em>what’s next.</em></h1>
          <p className="story-description">One thoughtful workspace for every store you’re growing. Your team, your products, your next big idea—all in one place.</p>
          <div className="story-points">
            <span><b>01</b> Every store, one account</span>
            <span><b>02</b> Your team, your way</span>
            <span><b>03</b> Built to keep moving</span>
          </div>
        </div>
        <div className="mini-dashboard" aria-hidden="true">
          <div className="mini-top"><span>YOUR STORES</span><span className="mini-menu">•••</span></div>
          <strong>A little momentum</strong>
          <div className="mini-stats"><b>03</b><span>workspaces<br />and counting</span><i>↗</i></div>
          <div className="chart-bars">{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ height: (15 + ((index * 17) % 47)) + "px" }} />)}</div>
          <div className="mini-bottom"><span><i /> YOUR SPACE IS READY</span><span>JUST GETTING STARTED</span></div>\n+        </div>
        <footer className="story-footer"><span>MADE FOR THE INDEPENDENT</span><span>EST. FOR WHAT’S NEXT&nbsp; ↗</span></footer>
      </section>
\n+      <section className="auth-panel">
        <header className="panel-header"><Brand /><span className="private-label"><i /> PRIVATE WORKSPACE</span></header>
        {screen === "account" && user ? (
          <div className="panel-content account-content">
            <div className="heading-block"><p className="eyebrow"><i /> YOUR ACCOUNT</p><h2>Good to have<br />you back.</h2><p className="subtitle">You’re signed in and ready to keep building.</p></div>
            <div className="profile-card">
              <div className="avatar">{user.email.slice(0, 1).toUpperCase()}</div>
              <div className="profile-info"><strong>{user.email}</strong><span>{user.emailVerifiedAt ? "Verified account" : "Email not verified"}</span></div>
              <span className={"verified-badge" + (user.emailVerifiedAt ? " is-verified" : "")}><i />{user.emailVerifiedAt ? "VERIFIED" : "PENDING"}</span>
            </div>
            {!user.emailVerifiedAt && <div className="verify-callout"><span className="callout-symbol">!</span><div><strong>Verify your email</strong><p>Confirm your address to finish setting up your account.</p></div><button className="link-button" onClick={() => { setEmail(user.email); navigate("verify"); }}>Continue ↗</button></div>}
            <div className="session-actions">
              <button className="button button-secondary" onClick={refreshSession} disabled={busy}>{busy ? <span className="spinner spinner-dark" /> : <RefreshIcon />} Refresh session</button>
              <button className="button button-ghost" onClick={logout} disabled={busy}>Sign out <span>↗</span></button>
            </div>
            <div className="section-rule"><span /> ACCOUNT SECURITY <span /></div>
            <form className="form-stack security-form" onSubmit={changePassword}>
              <Field label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
              <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="At least 10 characters" autoComplete="new-password" minLength={10} />
              <button className="button button-outline" type="submit" disabled={busy}>{busy ? <span className="spinner spinner-dark" /> : null} Update password <span>↗</span></button>
            </form>
            <p className="account-created">Account created {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })}</p>
          </div>
        ) : (
          <div className="panel-content">
            {screen === "login" && <>
              <div className="heading-block"><p className="eyebrow"><i /> WELCOME BACK</p><h2>Sign in to<br />your workspace.</h2><p className="subtitle">Pick up where you left off. Your stores are waiting.</p></div>
              <form className="form-stack" onSubmit={login}>
                <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
                <div className="password-label"><span className="field-label">Password</span><button className="link-button" type="button" onClick={() => navigate("forgot")}>Forgot password?</button></div>
                <Field label="Password" type={passwordType} value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" action={visibilityToggle} />
                <button className="button button-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} Sign in <span>↗</span></button>
              </form>
              <p className="switch-copy">New to Storeforge? <button className="link-button" onClick={() => navigate("register")}>Create an account ↗</button></p>
            </>}

            {screen === "register" && <>
              <div className="heading-block"><p className="eyebrow"><i /> GET STARTED</p><h2>Your next chapter<br />starts here.</h2><p className="subtitle">Create one account for all the stores you’ll build.</p></div>
              <form className="form-stack" onSubmit={register}>
                <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
                <Field label="Create password" type={passwordType} value={password} onChange={setPassword} placeholder="At least 10 characters" autoComplete="new-password" minLength={10} action={visibilityToggle} />
                <p className="field-note">Use 10 or more characters to keep your account protected.</p>
                <button className="button button-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} Create account <span>↗</span></button>
              </form>
              <p className="switch-copy">Already have an account? <button className="link-button" onClick={() => navigate("login")}>Sign in ↗</button></p>
            </>}

            {screen === "verify" && <>
              <div className="heading-block"><p className="eyebrow"><i /> ONE LAST THING</p><h2>Check your<br />inbox.</h2><p className="subtitle">Verify your email address to unlock your Storeforge account.</p></div>
              <form className="form-stack" onSubmit={verifyEmail}>
                <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
                <Field label="Verification token" value={token} onChange={setToken} placeholder="Paste your verification token" autoComplete="one-time-code" maxLength={128} />
                <button className="button button-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} Verify email <span>↗</span></button>
              </form>
              <button className="link-button resend-link" onClick={resendVerification} disabled={busy}>Didn’t get a link? Resend it ↗</button>
              <p className="switch-copy">Ready to sign in? <button className="link-button" onClick={() => navigate("login")}>Back to sign in</button></p>
            </>}

            {screen === "forgot" && <>
              <div className="heading-block"><p className="eyebrow"><i /> ACCOUNT RECOVERY</p><h2>Let’s get you<br />back in.</h2><p className="subtitle">Enter your email and we’ll prepare a secure password reset.</p></div>
              <form className="form-stack" onSubmit={requestReset}>
                <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
                <button className="button button-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} Send reset link <span>↗</span></button>
              </form>
              <p className="switch-copy">Remember your password? <button className="link-button" onClick={() => navigate("login")}>Back to sign in</button></p>
            </>}

            {screen === "reset" && <>
              <div className="heading-block"><p className="eyebrow"><i /> CREATE A NEW PASSWORD</p><h2>A fresh start<br />for your account.</h2><p className="subtitle">Choose a new password you haven’t used before.</p></div>
              <form className="form-stack" onSubmit={completeReset}>
                <Field label="Reset token" value={token} onChange={setToken} placeholder="Paste your reset token" autoComplete="one-time-code" maxLength={128} />
                <Field label="New password" type={passwordType} value={newPassword} onChange={setNewPassword} placeholder="At least 10 characters" autoComplete="new-password" minLength={10} action={visibilityToggle} />
                <button className="button button-primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : null} Reset password <span>↗</span></button>
              </form>
              <p className="switch-copy">Need another link? <button className="link-button" onClick={() => navigate("forgot")}>Request a new reset</button></p>
            </>}

            {notice && <div className="feedback success-feedback" role="status"><b>✓</b><span>{notice}</span></div>}
            {error && <div className="feedback error-feedback" role="alert"><b>!</b><span>{error}</span></div>}
          </div>
        )}

        {screen === "account" && (notice || error) && <div className="account-feedback">
          {notice && <div className="feedback success-feedback" role="status"><b>✓</b><span>{notice}</span></div>}
          {error && <div className="feedback error-feedback" role="alert"><b>!</b><span>{error}</span></div>}
        </div>}
        <footer className="panel-footer"><span>© 2026 STOREFORGE</span><span>MADE FOR WHAT’S NEXT</span></footer>
      </section>
    </main>
  );
}

function RefreshIcon() {
  return <svg className="refresh-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.6 8A6.9 6.9 0 0 0 4 7M3.4 12a6.9 6.9 0 0 0 12.6 1M3.5 3.7v3.7h3.7m9.3 9v-3.7h-3.7" /></svg>;
}

export default App;
