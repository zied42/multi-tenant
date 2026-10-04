import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, refreshAccessToken } from "./api";
import { broadcastLogout, subscribeToLogout } from "./auth-coordination";
import { DashboardView } from "./components/DashboardView";
import { StorefrontView } from "./components/StorefrontView";
import { StoreSelect } from "./components/StoreSelect";
import "./styles.css";
import type { Role, User } from "./types";

type Screen =
  | "login"
  | "register"
  | "verify"
  | "forgot"
  | "reset"
  | "stores"
  | "dashboard"
  | "account"
  | "storefront";

function publicRouteFromPath(pathname: string): { isStorefront: boolean; slug: string } {
  const match = pathname.match(/^\/s\/([^/]+)\/?$/);
  if (match) {
    try {
      return { isStorefront: true, slug: decodeURIComponent(match[1]) };
    } catch {
      return { isStorefront: true, slug: "" };
    }
  }
  return { isStorefront: pathname === "/storefront", slug: "" };
}

type Session = { accessToken: string };
type AuthResponse = {
  accessToken: string;
  expiresIn: number;
  user?: User;
};

interface ActiveStore {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export function Brand({ light = false }: { light?: boolean }) {
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
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>(() =>
    publicRouteFromPath(window.location.pathname).isStorefront ? "storefront" : "login",
  );
  const [user, setUser] = useState<User | null>(null);
  const [activeStore, setActiveStore] = useState<ActiveStore | null>(null);
  const [storefrontSlug, setStorefrontSlug] = useState<string>(
    () => publicRouteFromPath(window.location.pathname).slug,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return subscribeToLogout(() => {
      setSession(null);
      setUser(null);
      setActiveStore(null);
      setScreen("login");
      setNotice("You signed out in another tab.");
      setError("");
    });
  }, []);

  useEffect(() => {
    function handleHistoryNavigation() {
      const route = publicRouteFromPath(window.location.pathname);
      if (route.isStorefront) {
        setStorefrontSlug(route.slug);
        setScreen("storefront");
      } else {
        setScreen(session ? (activeStore ? "dashboard" : "stores") : "login");
      }
    }
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, [session, activeStore]);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        try {
          window.sessionStorage.removeItem("storeforge.auth.session");
        } catch {
          // Storage can be unavailable in restricted browser contexts.
        }
        const accessToken = await refreshAccessToken();
        const profile = await api<{ user: User }>("/auth/me", {
          accessToken,
          onAccessToken: (nextToken) => setSession({ accessToken: nextToken }),
          onSessionExpired: clearLocalSession,
        });
        if (active) {
          setSession({ accessToken });
          setUser(profile.user);
          if (!publicRouteFromPath(window.location.pathname).isStorefront) {
            setScreen("stores");
          }
        }
      } catch {
        if (active) {
          setSession(null);
          setUser(null);
          if (!publicRouteFromPath(window.location.pathname).isStorefront) {
            setScreen("login");
          }
        }
      } finally {
        if (active) setRestoring(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  function clearLocalSession() {
    setSession(null);
    setUser(null);
    setActiveStore(null);
    setScreen("login");
  }

  function clearMessages() {
    setNotice("");
    setError("");
  }

  function navigate(next: Screen) {
    clearMessages();
    setScreen(next);
  }

  async function run(
    event: FormEvent<HTMLFormElement>,
    action: () => Promise<void>,
  ) {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "EMAIL_NOT_VERIFIED") {
        setScreen("verify");
        setNotice(
          "Verify your email before signing in. You can request a fresh token below.",
        );
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      const result = await api<{ user: User; devToken?: string }>(
        "/auth/register",
        {
          method: "POST",
          body: { email, password },
        },
      );
      setEmail(result.user.email);
      setToken(result.devToken ?? "");
      setPassword("");
      setScreen("verify");
      setNotice(
        result.devToken
          ? "Account created! Your local verification token is filled in below."
          : "Account created. Please verify your email address.",
      );
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      const result = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const next = { accessToken: result.accessToken };
      setSession(next);
      setPassword("");
      const profile = result.user
        ? { user: result.user }
        : await api<{ user: User }>("/auth/me", {
            accessToken: next.accessToken,
            onAccessToken: (nextToken) => setSession({ accessToken: nextToken }),
            onSessionExpired: clearLocalSession,
          });
      setUser(profile.user);
      setScreen("stores");
      setNotice("Signed in successfully. Welcome to Storeforge.");
    });
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      await api("/auth/email-verification/complete", {
        method: "POST",
        body: { token },
      });
      setToken("");
      setScreen("login");
      setNotice("Email verified successfully! You can sign in now.");
    });
  }

  async function resendVerification() {
    clearMessages();
    setBusy(true);
    try {
      const result = await api<{ devToken?: string }>(
        "/auth/email-verification/request",
        {
          method: "POST",
          body: { email },
        },
      );
      if (result.devToken) setToken(result.devToken);
      setNotice(
        result.devToken
          ? "Local verification token generated below."
          : "Verification instructions have been prepared.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not request verification.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      const result = await api<{ devToken?: string }>(
        "/auth/password-reset/request",
        {
          method: "POST",
          body: { email },
        },
      );
      setToken(result.devToken ?? "");
      setScreen("reset");
      setNotice(
        result.devToken
          ? "Local reset token prepared below (valid for 30 minutes)."
          : "Reset instructions have been sent.",
      );
    });
  }

  async function completeReset(event: FormEvent<HTMLFormElement>) {
    await run(event, async () => {
      await api("/auth/password-reset/complete", {
        method: "POST",
        body: { token, newPassword },
      });
      setToken("");
      setNewPassword("");
      setScreen("login");
      setNotice("Password reset complete. You can now sign in.");
    });
  }

  async function refreshSession() {
    if (!session) return;
    clearMessages();
    setBusy(true);
    try {
      const accessToken = await refreshAccessToken();
      setSession({ accessToken });
      setNotice("Session refreshed successfully with new rotated token.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "REFRESH_RETRY") {
        setError("Another refresh is in progress. Please try again in a moment.");
        return;
      }
      clearLocalSession();
      broadcastLogout();
      setError(
        caught instanceof Error
          ? caught.message
          : "Session expired. Please sign in again.",
      );
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
        onAccessToken: (accessToken) => setSession({ accessToken }),
        onSessionExpired: clearLocalSession,
        body: { currentPassword, newPassword },
      });
      broadcastLogout();
      setSession(null);
      setUser(null);
      setActiveStore(null);
      setCurrentPassword("");
      setNewPassword("");
      setScreen("login");
      setNotice("Password updated. Please sign in with your new password.");
    });
  }

  async function logout() {
    clearMessages();
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Clean up browser state even if API fails
    } finally {
      broadcastLogout();
      setSession(null);
      setUser(null);
      setActiveStore(null);
      setScreen("login");
      setNotice("You have signed out.");
      setBusy(false);
    }
  }

  function handleSelectStore(
    id: string,
    role: Role,
    name: string,
    slug: string,
  ) {
    setActiveStore({ id, role, name, slug });
    setScreen("dashboard");
  }

  function handleOpenStorefront(slug: string) {
    setStorefrontSlug(slug);
    const path = slug ? `/s/${encodeURIComponent(slug)}` : "/storefront";
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setScreen("storefront");
  }

  function handleCloseStorefront() {
    window.history.pushState({}, "", "/");
    setScreen(session ? (activeStore ? "dashboard" : "stores") : "login");
  }

  if (restoring) {
    return (
      <div className="restore-screen">
        <div className="restore-card">
          <span className="spinner spinner-dark" /> Loading Storeforge...
        </div>
      </div>
    );
  }

  // Public Storefront View
  if (screen === "storefront") {
    return (
      <StorefrontView
        slug={storefrontSlug}
        onBackToDashboard={
          handleCloseStorefront
        }
      />
    );
  }

  const passwordType = showPassword ? "text" : "password";
  const visibilityToggle = (
    <button
      className="input-action"
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? "HIDE" : "SHOW"}
    </button>
  );

  // ----------------------------------------------------
  // LOGGED-IN VIEW: Full-width Professional SaaS Console
  // ----------------------------------------------------
  if (session && user) {
    return (
      <div className="portal-layout">
        <header className="portal-navbar">
          <div className="portal-navbar-inner">
            <div className="portal-nav-left">
              <button
                className="portal-brand-btn"
                onClick={() => setScreen("stores")}
                title="Go to Stores"
              >
                <Brand />
              </button>
              <span className="portal-badge">STAFF CONSOLE</span>

              {activeStore && (
                <div className="active-store-pill">
                  <span className="store-pill-name">{activeStore.name}</span>
                  <code className="store-pill-slug">/s/{activeStore.slug}</code>
                  <span className={`role-badge role-${activeStore.role.toLowerCase()}`}>
                    {activeStore.role}
                  </span>
                  <button
                    className="button-link store-pill-switch"
                    onClick={() => setScreen("stores")}
                  >
                    Switch
                  </button>
                </div>
              )}
            </div>

            <nav className="portal-nav-links">
              <button
                className={`portal-nav-btn ${screen === "stores" ? "is-active" : ""}`}
                onClick={() => setScreen("stores")}
              >
                🏬 Stores
              </button>
              {activeStore && (
                <button
                  className={`portal-nav-btn ${screen === "dashboard" ? "is-active" : ""}`}
                  onClick={() => setScreen("dashboard")}
                >
                  📊 Dashboard
                </button>
              )}
              {activeStore && (
                <button
                  className="portal-nav-btn"
                  onClick={() => handleOpenStorefront(activeStore.slug)}
                >
                  🌐 Storefront ↗
                </button>
              )}
              <button
                className={`portal-nav-btn ${screen === "account" ? "is-active" : ""}`}
                onClick={() => setScreen("account")}
              >
                ⚙️ Account
              </button>
            </nav>

            <div className="portal-nav-right">
              <div className="user-indicator" title={user.email}>
                <span className="user-avatar-sm">
                  {user.email.slice(0, 1).toUpperCase()}
                </span>
                <span className="user-email-text">{user.email}</span>
                {user.emailVerifiedAt ? (
                  <span className="verified-dot" title="Email verified" />
                ) : (
                  <span
                    className="unverified-pill"
                    onClick={() => setScreen("account")}
                    title="Email not verified - click to verify"
                  >
                    Unverified
                  </span>
                )}
              </div>
              <button
                className="button button-ghost button-sm"
                onClick={logout}
                disabled={busy}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {(notice || error) && (
          <div className="portal-alert-bar">
            {notice && (
              <div className="feedback success-feedback" role="status">
                <b>✓</b>
                <span>{notice}</span>
                <button className="dismiss-btn" onClick={() => setNotice("")}>
                  ×
                </button>
              </div>
            )}
            {error && (
              <div className="feedback error-feedback" role="alert">
                <b>!</b>
                <span>{error}</span>
                <button className="dismiss-btn" onClick={() => setError("")}>
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        <main className="portal-main">
          {screen === "stores" && (
            <StoreSelect
              user={user}
              accessToken={session.accessToken}
              onAccessToken={(nextToken) =>
                setSession({ accessToken: nextToken })
              }
              onSessionExpired={clearLocalSession}
              onSelectStore={handleSelectStore}
              onOpenStorefront={handleOpenStorefront}
            />
          )}

          {screen === "dashboard" && activeStore && (
            <DashboardView
              storeId={activeStore.id}
              storeName={activeStore.name}
              storeSlug={activeStore.slug}
              userRole={activeStore.role}
              user={user}
              accessToken={session.accessToken}
              onAccessToken={(nextToken) =>
                setSession({ accessToken: nextToken })
              }
              onSessionExpired={clearLocalSession}
              onSwitchStore={() => setScreen("stores")}
              onOpenStorefront={handleOpenStorefront}
            />
          )}

          {screen === "account" && (
            <div className="account-container">
              <div className="heading-block">
                <p className="eyebrow">
                  <i /> USER SETTINGS
                </p>
                <h2>Account &amp; Security</h2>
                <p className="subtitle">
                  Manage your credentials, verify your identity, and inspect active session tokens.
                </p>
              </div>

              <div className="account-cards-grid">
                <div className="card-box">
                  <h4>Profile Information</h4>
                  <div className="profile-card">
                    <div className="avatar">
                      {user.email.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="profile-info">
                      <strong>{user.email}</strong>
                      <span>User ID: {user.id}</span>
                      <span>
                        Joined:{" "}
                        {new Date(user.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <span
                      className={
                        "verified-badge" +
                        (user.emailVerifiedAt ? " is-verified" : "")
                      }
                    >
                      <i />
                      {user.emailVerifiedAt ? "VERIFIED" : "PENDING VERIFICATION"}
                    </span>
                  </div>

                  {!user.emailVerifiedAt && (
                    <div className="verify-callout">
                      <span className="callout-symbol">!</span>
                      <div>
                        <strong>Your email is not verified yet</strong>
                        <p>
                          Verify your email to ensure uninterrupted account access.
                        </p>
                      </div>
                      <button
                        className="button button-secondary button-sm"
                        onClick={() => {
                          setEmail(user.email);
                          navigate("verify");
                        }}
                      >
                        Verify Email Now ↗
                      </button>
                    </div>
                  )}

                  <div className="session-actions">
                    <button
                      className="button button-secondary button-sm"
                      onClick={refreshSession}
                      disabled={busy}
                    >
                      {busy ? (
                        <span className="spinner spinner-dark" />
                      ) : (
                        <RefreshIcon />
                      )}
                      Refresh Access Token (Rotate)
                    </button>
                    <button
                      className="button button-ghost button-sm"
                      onClick={logout}
                      disabled={busy}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>

                <div className="card-box">
                  <h4>Change Password</h4>
                  <p className="tab-subtitle">
                    Enter your current password and a new password (min. 10 characters).
                  </p>
                  <form
                    className="form-stack security-form"
                    onSubmit={changePassword}
                  >
                    <Field
                      label="Current Password"
                      type="password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      autoComplete="current-password"
                    />
                    <Field
                      label="New Password"
                      type="password"
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder="At least 10 characters"
                      autoComplete="new-password"
                      minLength={10}
                    />
                    <button
                      className="button button-primary button-sm"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? <span className="spinner" /> : null}
                      Update Password
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ----------------------------------------------------
  // LOGGED-OUT VIEW: Clean, Centered Professional Auth
  // ----------------------------------------------------
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Brand />
        <button
          className="button button-secondary button-sm"
          onClick={() => handleOpenStorefront("")}
        >
          Explore Public Storefront ↗
        </button>
      </header>

      <main className="auth-container">
        <div className="auth-card">
          <div className="auth-card-header">
            <h1 className="auth-title">
              {screen === "login" && "Sign In"}
              {screen === "register" && "Create an Account"}
              {screen === "verify" && "Verify Email"}
              {screen === "forgot" && "Reset Password"}
              {screen === "reset" && "Set New Password"}
            </h1>
            <p className="auth-subtitle">
              {screen === "login" &&
                "Access your store workspaces and manage orders, inventory, and staff."}
              {screen === "register" &&
                "Set up your merchant account to start creating store workspaces."}
              {screen === "verify" &&
                "Confirm your email address to activate your merchant account."}
              {screen === "forgot" &&
                "Enter your account email to receive a password reset token."}
              {screen === "reset" &&
                "Enter your reset token and pick a strong new password."}
            </p>
          </div>

          {screen === "verify" ? (
            <div className="auth-step-indicator" aria-label="Registration step 2 of 2">
              <span className="auth-step is-complete">1&nbsp; Account created</span>
              <span className="auth-step is-active">2&nbsp; Verify email</span>
            </div>
          ) : (
            <div className="auth-tabs">
              <button
                className={`auth-tab-btn ${screen === "login" ? "is-active" : ""}`}
                onClick={() => navigate("login")}
              >
                Sign In
              </button>
              <button
                className={`auth-tab-btn ${screen === "register" ? "is-active" : ""}`}
                onClick={() => navigate("register")}
              >
                Register
              </button>
            </div>
          )}

          {notice && (
            <div className="feedback success-feedback" role="status">
              <b>✓</b>
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="feedback error-feedback" role="alert">
              <b>!</b>
              <span>{error}</span>
            </div>
          )}

          {screen === "login" && (
            <form className="form-stack" onSubmit={login}>
              <Field
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="merchant@example.com"
                autoComplete="email"
              />
              <div className="password-label">
                <span className="field-label">Password</span>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => navigate("forgot")}
                >
                  Forgot password?
                </button>
              </div>
              <Field
                label="Password"
                type={passwordType}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                autoComplete="current-password"
                action={visibilityToggle}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? <span className="spinner" /> : null} Sign In to Storeforge
              </button>
            </form>
          )}

          {screen === "register" && (
            <form className="form-stack" onSubmit={register}>
              <Field
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="merchant@example.com"
                autoComplete="email"
              />
              <Field
                label="Create Password"
                type={passwordType}
                value={password}
                onChange={setPassword}
                placeholder="Minimum 10 characters"
                autoComplete="new-password"
                minLength={10}
                action={visibilityToggle}
              />
              <p className="field-note">
                Passwords must be at least 10 characters in length.
              </p>
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? <span className="spinner" /> : null} Create Merchant Account
              </button>
            </form>
          )}

          {screen === "verify" && (
            <form className="form-stack" onSubmit={verifyEmail}>
              <div className="verify-step-card" role="status">
                <strong>Step 2 of 2 · Verify your email</strong>
                <p>
                  Your account was created. Verify the address below before signing
                  in. Enter the token from your email, or generate a local token
                  during development.
                </p>
              </div>
              <Field
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="merchant@example.com"
                autoComplete="email"
              />
              <Field
                label="Verification Token"
                value={token}
                onChange={setToken}
                placeholder="Paste token or use auto-generated dev token"
                autoComplete="one-time-code"
                maxLength={128}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? <span className="spinner" /> : null} Confirm &amp; Verify Email
              </button>
              <button
                type="button"
                className="button button-ghost button-sm"
                onClick={resendVerification}
                disabled={busy}
              >
                Resend / Generate Dev Token ↻
              </button>
              <p className="switch-copy">
                Already verified?{" "}
                <button
                  className="link-button"
                  type="button"
                  onClick={() => navigate("login")}
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          )}

          {screen === "forgot" && (
            <form className="form-stack" onSubmit={requestReset}>
              <Field
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="merchant@example.com"
                autoComplete="email"
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? <span className="spinner" /> : null} Request Password Reset
              </button>
              <p className="switch-copy">
                Remember your password?{" "}
                <button
                  className="link-button"
                  type="button"
                  onClick={() => navigate("login")}
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          )}

          {screen === "reset" && (
            <form className="form-stack" onSubmit={completeReset}>
              <Field
                label="Reset Token"
                value={token}
                onChange={setToken}
                placeholder="Paste reset token"
                autoComplete="one-time-code"
                maxLength={128}
              />
              <Field
                label="New Password"
                type={passwordType}
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Minimum 10 characters"
                autoComplete="new-password"
                minLength={10}
                action={visibilityToggle}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? <span className="spinner" /> : null} Update Password &amp; Sign In
              </button>
              <p className="switch-copy">
                Need another token?{" "}
                <button
                  className="link-button"
                  type="button"
                  onClick={() => navigate("forgot")}
                >
                  Request Again
                </button>
              </p>
            </form>
          )}
        </div>

        <footer className="auth-footer">
          <span>STOREFORGE &copy; 2026</span>
          <span>MULTI-TENANT COMMERCE PLATFORM</span>
        </footer>
      </main>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      className="refresh-icon"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M16.6 8A6.9 6.9 0 0 0 4 7M3.4 12a6.9 6.9 0 0 0 12.6 1M3.5 3.7v3.7h3.7m9.3 9v-3.7h-3.7" />
    </svg>
  );
}

export default App;
