import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { MembershipStore, Role, User } from "../types";
import { formatDate } from "../utils/formatters";

interface Props {
  user?: User;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
  onSelectStore: (storeId: string, role: Role, name: string, slug: string) => void;
  onOpenStorefront: (slug: string) => void;
}

export function StoreSelect({
  accessToken,
  onAccessToken,
  onSessionExpired,
  onSelectStore,
  onOpenStorefront,
}: Props) {
  const [memberships, setMemberships] = useState<MembershipStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  // New Store Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");

  useEffect(() => {
    loadStores();
  }, []);

  async function loadStores() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ stores: MembershipStore[] }>("/stores", {
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setMemberships(res.stores);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stores");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStore(e: FormEvent) {
    e.preventDefault();
    if (!newStoreName.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api<{ store: { id: string; name: string; slug: string; createdAt: string } }>(
        "/stores",
        {
          method: "POST",
          accessToken,
          onAccessToken,
          onSessionExpired,
          body: { name: newStoreName.trim() },
        },
      );
      setNewStoreName("");
      setShowCreateModal(false);
      setNotice(`Store "${res.store.name}" created successfully as OWNER.`);
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create store");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = inviteToken.trim();
    if (!token) return;

    setInviteBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/invites/accept", {
        method: "POST",
        accessToken,
        onAccessToken,
        onSessionExpired,
        body: { token },
      });
      setInviteToken("");
      setNotice("Invitation accepted. Your new store membership is ready.");
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept this invitation.");
    } finally {
      setInviteBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner spinner-dark" /> Loading your store workspaces...
      </div>
    );
  }

  return (
    <div className="store-select-panel">
      <div className="heading-block">
        <p className="eyebrow"><i /> STORE WORKSPACES</p>
        <h2>Your Stores</h2>
        <p className="subtitle">
          Select a store to open its staff dashboard, or create a new store workspace.
        </p>
      </div>

      {notice && (
        <div className="feedback success-feedback">
          <b>✓</b>
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="feedback error-feedback">
          <b>!</b>
          <span>{error}</span>
        </div>
      )}

      <div className="store-select-header">
        <button
          className="button button-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create New Store
        </button>
      </div>

      <section className="card-box accept-box" aria-labelledby="accept-invite-heading">
        <h4 id="accept-invite-heading">Join a store with an invitation</h4>
        <p className="field-note">
          Sign in with the email address the invitation was sent to, then paste its token here.
        </p>
        <form onSubmit={handleAcceptInvite} className="form-inline">
          <label className="field-grow">
            <span className="sr-only">Invitation token</span>
            <input
              type="text"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              placeholder="Paste invitation token"
              autoComplete="off"
              required
              maxLength={128}
              className="input-text"
            />
          </label>
          <button type="submit" className="button button-secondary" disabled={inviteBusy}>
            {inviteBusy ? <span className="spinner spinner-dark" /> : null} Accept Invitation
          </button>
        </form>
      </section>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h4>Create a New Store</h4>
            <p className="modal-description">
              You will automatically become the OWNER of this store. A unique slug will be generated.
            </p>
            <form onSubmit={handleCreateStore} className="form-stack">
              <label className="field">
                <span className="field-label">Store Name</span>
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="e.g. Acme Outfitters"
                  required
                  maxLength={120}
                  className="input-text"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? <span className="spinner" /> : null} Create Store ↗
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {memberships.length === 0 ? (
        <div className="empty-state">
          <h3>No Stores Found</h3>
          <p>You aren't a member of any stores yet. Create your first store to get started!</p>
        </div>
      ) : (
        <div className="store-grid">
          {memberships.map((m) => (
            <div key={m.store.id} className="store-card">
              <div className="store-card-header">
                <span className={`role-badge role-${m.role.toLowerCase()}`}>
                  {m.role}
                </span>
                <span className="store-date">{formatDate(m.createdAt)}</span>
              </div>

              <h3>{m.store.name}</h3>
              <code className="store-slug-tag">/s/{m.store.slug}</code>

              <div className="store-card-actions">
                <button
                  className="button button-secondary button-sm"
                  onClick={() => onOpenStorefront(m.store.slug)}
                >
                  Public Storefront ↗
                </button>
                <button
                  className="button button-primary button-sm"
                  onClick={() =>
                    onSelectStore(m.store.id, m.role, m.store.name, m.store.slug)
                  }
                >
                  Dashboard ↗
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
