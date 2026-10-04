import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Invite, Role } from "../types";
import { formatDate, hasRole } from "../utils/formatters";

interface Props {
  storeId: string;
  userRole: Role;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
}

export function InvitesTab({
  storeId,
  userRole,
  accessToken,
  onAccessToken,
  onSessionExpired,
}: Props) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // New Invite Form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");

  // Local Dev Token Callout
  const [latestDevToken, setLatestDevToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const canManage = hasRole(userRole, "ADMIN");
  const isOwner = userRole === "OWNER";

  useEffect(() => {
    loadInvites();
  }, [storeId]);

  async function loadInvites() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ invites: Invite[] }>(`/stores/${storeId}/invites`, {
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setInvites(res.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setLatestDevToken(null);
    setCopiedToken(false);

    try {
      const res = await api<{ invite: Invite; devToken?: string }>(
        `/stores/${storeId}/invites`,
        {
          method: "POST",
          accessToken,
          onAccessToken,
          onSessionExpired,
          body: { email, role },
        },
      );
      setEmail("");
      setNotice(`Invitation sent to ${res.invite.email}.`);
      if (res.devToken) {
        setLatestDevToken(res.devToken);
      }
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeInvite(inviteId: string, inviteEmail: string) {
    if (!window.confirm(`Are you sure you want to revoke the invite for ${inviteEmail}?`)) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/invites/${inviteId}`, {
        method: "DELETE",
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setNotice(`Invitation for ${inviteEmail} revoked.`);
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation");
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner spinner-dark" /> Loading store invitations...
      </div>
    );
  }

  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h3>Store Invitations</h3>
          <p className="tab-subtitle">
            Invite new team members to collaborate on this store.
          </p>
        </div>
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

      {latestDevToken && (
        <div className="token-callout">
          <div className="token-header">
            <strong>Development Invite Token</strong>
            <span className="dev-tag">LOCAL DEV</span>
          </div>
          <p className="token-help">
            No email server is connected in development mode. Share or copy this token to test accepting an invitation:
          </p>
          <div className="token-code-row">
            <code className="token-code">{latestDevToken}</code>
            <button
              className="button button-secondary button-sm"
              onClick={() => copyToClipboard(latestDevToken)}
            >
              {copiedToken ? "Copied! ✓" : "Copy Token"}
            </button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="card-box">
          <h4>Create New Invitation</h4>
          <form onSubmit={handleCreateInvite} className="form-inline">
            <label className="field-grow">
              <span className="field-label">Email Address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="input-text"
              />
            </label>

            <label>
              <span className="field-label">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="select-input"
              >
                {isOwner && <option value="ADMIN">ADMIN</option>}
                <option value="MANAGER">MANAGER</option>
                <option value="SUPPORT">SUPPORT</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </label>

            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? <span className="spinner" /> : null} Send Invite ↗
            </button>
          </form>
        </div>
      )}

      <h4>Pending Invitations ({invites.length})</h4>

      {invites.length === 0 ? (
        <div className="empty-state">
          <p>No pending invitations found for this store.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Expires</th>
                <th>Created</th>
                {canManage && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.email}</strong>
                  </td>
                  <td>
                    <span className={`role-badge role-${inv.role.toLowerCase()}`}>
                      {inv.role}
                    </span>
                  </td>
                  <td>{formatDate(inv.expiresAt)}</td>
                  <td>{formatDate(inv.createdAt)}</td>
                  {canManage && (
                    <td>
                      <button
                        className="button-link danger-link"
                        onClick={() => handleRevokeInvite(inv.id, inv.email)}
                        disabled={busy}
                      >
                        Revoke
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
