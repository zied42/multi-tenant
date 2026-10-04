import { useEffect, useState } from "react";
import { api } from "../api";
import type { AuditLog, Role } from "../types";
import { formatDate } from "../utils/formatters";

interface Props {
  storeId: string;
  userRole?: Role;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
}

export function AuditTab({
  storeId,
  accessToken,
  onAccessToken,
  onSessionExpired,
}: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAuditLogs();
  }, [storeId]);

  async function loadAuditLogs() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ events: AuditLog[] }>(
        `/stores/${storeId}/audit-log?limit=50`,
        { accessToken, onAccessToken, onSessionExpired },
      );
      setLogs(res.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner spinner-dark" /> Loading audit history...
      </div>
    );
  }

  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h3>Store Audit Log</h3>
          <p className="tab-subtitle">
            Append-only record of sensitive store operations, role updates, and transactions.
          </p>
        </div>
        <button className="button button-ghost button-sm" onClick={loadAuditLogs}>
          Refresh Log
        </button>
      </div>

      {error && (
        <div className="feedback error-feedback">
          <b>!</b>
          <span>{error}</span>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="empty-state">
          <p>No audit log events found for this store.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target ID</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>
                    <span className="action-tag">{log.action}</span>
                  </td>
                  <td>
                    {log.targetId ? (
                      <code className="target-id-code">{log.targetId}</code>
                    ) : (
                      <span className="field-note">—</span>
                    )}
                  </td>
                  <td>
                    {log.metadata ? (
                      <pre className="metadata-pre">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : (
                      <span className="field-note">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
