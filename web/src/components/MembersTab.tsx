import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Member, Role } from "../types";
import { formatDate, hasRole } from "../utils/formatters";

interface Props {
  storeId: string;
  userRole: Role;
  currentUserId: string;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
  onStoreUpdated: () => void;
}

export function MembersTab({
  storeId,
  userRole,
  currentUserId,
  accessToken,
  onAccessToken,
  onSessionExpired,
  onStoreUpdated,
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Ownership transfer state
  const [transferTargetId, setTransferTargetId] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Role change state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("VIEWER");

  const canManage = hasRole(userRole, "ADMIN");
  const isOwner = userRole === "OWNER";

  useEffect(() => {
    loadMembers();
  }, [storeId]);

  async function loadMembers() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ members: Member[] }>(
        `/stores/${storeId}/members`,
        { accessToken, onAccessToken, onSessionExpired },
      );
      setMembers(res.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(targetUserId: string, newRole: Role) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/members/${targetUserId}`, {
        method: "PATCH",
        accessToken,
        onAccessToken,
        onSessionExpired,
        body: { role: newRole },
      });
      setNotice("Member role updated successfully.");
      setEditingMemberId(null);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(targetUserId: string, email: string) {
    if (!window.confirm(`Are you sure you want to remove ${email} from this store?`)) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/members/${targetUserId}`, {
        method: "DELETE",
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setNotice(`Removed ${email} from the store.`);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveStore() {
    if (!window.confirm("Are you sure you want to leave this store?")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/stores/${storeId}/leave`, {
        method: "POST",
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      onStoreUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave store");
      setBusy(false);
    }
  }

  async function handleTransferOwnership(e: FormEvent) {
    e.preventDefault();
    if (!transferTargetId) return;
    if (
      !window.confirm(
        "Transferring ownership will make you an ADMIN and give full ownership to the selected member. Proceed?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/transfer-ownership`, {
        method: "POST",
        accessToken,
        onAccessToken,
        onSessionExpired,
        body: { userId: transferTargetId },
      });
      setShowTransferModal(false);
      setNotice("Store ownership transferred successfully.");
      onStoreUpdated();
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer ownership");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner spinner-dark" /> Loading store members...
      </div>
    );
  }

  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h3>Store Members</h3>
          <p className="tab-subtitle">
            Manage who has access to this store and control their permission levels.
          </p>
        </div>
        <div className="tab-actions">
          {isOwner && (
            <button
              className="button button-outline button-sm"
              onClick={() => setShowTransferModal(true)}
              disabled={busy || members.length <= 1}
            >
              Transfer Ownership ↗
            </button>
          )}
          {!isOwner && (
            <button
              className="button button-outline button-sm danger-button"
              onClick={handleLeaveStore}
              disabled={busy}
            >
              Leave Store
            </button>
          )}
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

      {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h4>Transfer Store Ownership</h4>
            <p className="modal-description">
              Select an existing member to become the new OWNER of this store. You will become an ADMIN.
            </p>
            <form onSubmit={handleTransferOwnership} className="form-stack">
              <label className="field">
                <span className="field-label">Select New Owner</span>
                <select
                  className="select-input"
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  required
                >
                  <option value="">-- Select a member --</option>
                  {members
                    .filter((m) => m.user.id !== currentUserId)
                    .map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.email} ({m.role})
                      </option>
                    ))}
                </select>
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowTransferModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy || !transferTargetId}
                >
                  {busy ? <span className="spinner" /> : null} Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.user.id === currentUserId;
              const isTargetOwner = m.role === "OWNER";
              const canEditThisMember =
                canManage &&
                !isSelf &&
                !isTargetOwner &&
                (isOwner || m.role !== "ADMIN");

              return (
                <tr key={m.user.id}>
                  <td>
                    <div className="user-cell">
                      <strong>{m.user.email}</strong>
                      {isSelf && <span className="self-badge">You</span>}
                    </div>
                  </td>
                  <td>
                    {editingMemberId === m.user.id ? (
                      <div className="inline-edit-role">
                        <select
                          className="select-input-sm"
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as Role)}
                        >
                          {isOwner && <option value="ADMIN">ADMIN</option>}
                          <option value="MANAGER">MANAGER</option>
                          <option value="SUPPORT">SUPPORT</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                        <button
                          className="button-icon success-icon"
                          title="Save"
                          disabled={busy}
                          onClick={() => handleRoleChange(m.user.id, selectedRole)}
                        >
                          ✓
                        </button>
                        <button
                          className="button-icon"
                          title="Cancel"
                          onClick={() => setEditingMemberId(null)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className={`role-badge role-${m.role.toLowerCase()}`}>
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(m.createdAt)}</td>
                  {canManage && (
                    <td>
                      <div className="action-buttons">
                        {canEditThisMember && editingMemberId !== m.user.id && (
                          <>
                            <button
                              className="button-link"
                              onClick={() => {
                                setEditingMemberId(m.user.id);
                                setSelectedRole(m.role);
                              }}
                            >
                              Change Role
                            </button>
                            <button
                              className="button-link danger-link"
                              onClick={() => handleRemoveMember(m.user.id, m.user.email)}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
