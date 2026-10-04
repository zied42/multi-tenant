import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Coupon, CouponType, Role } from "../types";
import { formatCurrency, formatDate, hasRole } from "../utils/formatters";

interface Props {
  storeId: string;
  userRole: Role;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
}

export function CouponsTab({
  storeId,
  userRole,
  accessToken,
  onAccessToken,
  onSessionExpired,
}: Props) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENT");
  const [valueInput, setValueInput] = useState(""); // percentage (e.g. 15) or dollar amount (e.g. 5.00)
  const [maxUsesInput, setMaxUsesInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");

  const canManage = hasRole(userRole, "MANAGER");

  useEffect(() => {
    loadCoupons();
  }, [storeId]);

  async function loadCoupons() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ coupons: Coupon[] }>(`/stores/${storeId}/coupons`, {
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setCoupons(res.coupons);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCoupon(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const numVal = parseFloat(valueInput);
    if (isNaN(numVal) || numVal <= 0) {
      setError("Please enter a valid positive discount value");
      setBusy(false);
      return;
    }

    const value = type === "PERCENT" ? Math.round(numVal) : Math.round(numVal * 100);
    const maxUses = maxUsesInput ? parseInt(maxUsesInput, 10) : undefined;
    const expiresAt = expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined;

    try {
      await api(`/stores/${storeId}/coupons`, {
        method: "POST",
        accessToken,
        onAccessToken,
        onSessionExpired,
        body: {
          code: code.trim().toUpperCase(),
          type,
          value,
          maxUses,
          expiresAt,
        },
      });
      setCode("");
      setValueInput("");
      setMaxUsesInput("");
      setExpiresAtInput("");
      setNotice("Coupon created successfully.");
      await loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create coupon");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivateCoupon(couponId: string, couponCode: string) {
    if (!window.confirm(`Are you sure you want to deactivate coupon "${couponCode}"?`)) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/coupons/${couponId}`, {
        method: "DELETE",
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setNotice(`Coupon "${couponCode}" deactivated.`);
      await loadCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate coupon");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner spinner-dark" /> Loading store coupons...
      </div>
    );
  }

  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h3>Store Coupons & Discounts</h3>
          <p className="tab-subtitle">
            Create percentage or fixed-amount discount codes for store checkout.
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

      {canManage && (
        <div className="card-box">
          <h4>Create New Coupon</h4>
          <form onSubmit={handleCreateCoupon} className="form-stack">
            <div className="form-row">
              <label className="field-grow">
                <span className="field-label">Coupon Code</span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. SAVE20"
                  required
                  className="input-text uppercase-input"
                />
              </label>

              <label>
                <span className="field-label">Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CouponType)}
                  className="select-input"
                >
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount ($)</option>
                </select>
              </label>

              <label className="field-grow">
                <span className="field-label">
                  Value {type === "PERCENT" ? "(%)" : "($ USD)"}
                </span>
                <input
                  type="number"
                  step={type === "PERCENT" ? "1" : "0.01"}
                  min="1"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  placeholder={type === "PERCENT" ? "20" : "5.00"}
                  required
                  className="input-text"
                />
              </label>
            </div>

            <div className="form-row">
              <label className="field-grow">
                <span className="field-label">Max Uses (Optional)</span>
                <input
                  type="number"
                  min="1"
                  value={maxUsesInput}
                  onChange={(e) => setMaxUsesInput(e.target.value)}
                  placeholder="Unlimited"
                  className="input-text"
                />
              </label>

              <label className="field-grow">
                <span className="field-label">Expiration Date (Optional)</span>
                <input
                  type="datetime-local"
                  value={expiresAtInput}
                  onChange={(e) => setExpiresAtInput(e.target.value)}
                  className="input-text"
                />
              </label>
            </div>

            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? <span className="spinner" /> : null} Create Coupon ↗
            </button>
          </form>
        </div>
      )}

      <h4>Active & Inactive Coupons ({coupons.length})</h4>

      {coupons.length === 0 ? (
        <div className="empty-state">
          <p>No coupons found in this store.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Uses</th>
                <th>Expires</th>
                <th>Status</th>
                {canManage && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code className="coupon-code-tag">{c.code}</code>
                  </td>
                  <td>
                    {c.type === "PERCENT"
                      ? `${c.value}% OFF`
                      : `${formatCurrency(c.value)} OFF`}
                  </td>
                  <td>
                    {c.usedCount} / {c.maxUses !== null ? c.maxUses : "∞"}
                  </td>
                  <td>{c.expiresAt ? formatDate(c.expiresAt) : "Never"}</td>
                  <td>
                    <span className={`status-badge status-${c.active ? "active" : "draft"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      {c.active && (
                        <button
                          className="button-link danger-link"
                          onClick={() => handleDeactivateCoupon(c.id, c.code)}
                          disabled={busy}
                        >
                          Deactivate
                        </button>
                      )}
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
