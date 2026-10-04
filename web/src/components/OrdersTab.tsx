import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { OrderDetail, OrderStatus, OrderSummary, Role } from "../types";
import { formatCurrency, formatDate, hasRole } from "../utils/formatters";

interface Props {
  storeId: string;
  userRole: Role;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function OrdersTab({
  storeId,
  userRole,
  accessToken,
  onAccessToken,
  onSessionExpired,
}: Props) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Selected Order Detail Modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Staff Note Form
  const [noteBody, setNoteBody] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const canChangeStatus = hasRole(userRole, "MANAGER");
  const canRefund = hasRole(userRole, "ADMIN");
  const canAddNote = hasRole(userRole, "SUPPORT");

  useEffect(() => {
    loadOrders();
  }, [storeId]);

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ orders: OrderSummary[] }>(`/stores/${storeId}/orders`, {
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setOrders(res.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function openOrderDetail(orderId: string) {
    setSelectedOrderId(orderId);
    setDetailLoading(true);
    setDetailError("");
    setOrderDetail(null);
    try {
      const res = await api<{ order: OrderDetail }>(
        `/stores/${storeId}/orders/${orderId}`,
        { accessToken, onAccessToken, onSessionExpired },
      );
      setOrderDetail(res.order);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to load order details",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/orders/${orderId}/status`, {
        method: "PATCH",
        accessToken,
        onAccessToken,
        onSessionExpired,
        body: { status: newStatus },
      });
      setNotice(`Order status updated to ${newStatus}.`);
      await loadOrders();
      if (selectedOrderId === orderId) {
        await openOrderDetail(orderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order status");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefund(orderId: string) {
    if (
      !window.confirm(
        "Issue mock refund for this order? This will restore inventory and set order status to REFUNDED.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/orders/${orderId}/refund`, {
        method: "POST",
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setNotice("Order refunded successfully. Inventory restored.");
      await loadOrders();
      if (selectedOrderId === orderId) {
        await openOrderDetail(orderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refund order");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || !noteBody.trim()) return;
    setNoteBusy(true);
    setDetailError("");
    try {
      await api(`/stores/${storeId}/orders/${selectedOrderId}/notes`, {
        method: "POST",
        accessToken,
        onAccessToken,
        onSessionExpired,
        body: { body: noteBody.trim() },
      });
      setNoteBody("");
      await openOrderDetail(selectedOrderId);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setNoteBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner spinner-dark" /> Loading store orders...
      </div>
    );
  }

  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h3>Store Orders</h3>
          <p className="tab-subtitle">
            View customer orders, update fulfillment statuses, add notes, and process refunds.
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

      {selectedOrderId && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header-row">
              <h4>Order Details: #{selectedOrderId.slice(-8)}</h4>
              <button
                className="button-icon"
                onClick={() => setSelectedOrderId(null)}
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="tab-loading">
                <span className="spinner spinner-dark" /> Loading order details...
              </div>
            ) : detailError ? (
              <div className="feedback error-feedback">
                <b>!</b>
                <span>{detailError}</span>
              </div>
            ) : orderDetail ? (
              <div className="order-detail-content">
                <div className="order-summary-header">
                  <div>
                    <span className="field-label">Customer</span>
                    <p>
                      <strong>{orderDetail.customerName}</strong> ({orderDetail.customerEmail})
                    </p>
                  </div>
                  <div>
                    <span className="field-label">Date</span>
                    <p>{formatDate(orderDetail.createdAt)}</p>
                  </div>
                  <div>
                    <span className="field-label">Status</span>
                    <p>
                      <span className={`status-badge status-${orderDetail.status.toLowerCase()}`}>
                        {orderDetail.status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="order-items-box">
                  <h5>Order Items</h5>
                  <table className="data-table data-table-compact">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderDetail.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td>{formatCurrency(item.unitPrice * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="order-totals-summary">
                    <div>
                      <span>Subtotal:</span>
                      <strong>{formatCurrency(orderDetail.subtotal)}</strong>
                    </div>
                    {orderDetail.discount > 0 && (
                      <div className="discount-row">
                        <span>Discount:</span>
                        <strong>-{formatCurrency(orderDetail.discount)}</strong>
                      </div>
                    )}
                    <div className="grand-total-row">
                      <span>Total:</span>
                      <strong>{formatCurrency(orderDetail.total)}</strong>
                    </div>
                  </div>
                </div>

                <div className="order-actions-bar">
                  {canChangeStatus && (
                    <div className="status-transition-box">
                      <span className="field-label">Update Status:</span>
                      {TRANSITIONS[orderDetail.status].length === 0 ? (
                        <span className="field-note">No status transitions available.</span>
                      ) : (
                        <div className="button-group">
                          {TRANSITIONS[orderDetail.status].map((nextStatus) => (
                            <button
                              key={nextStatus}
                              className={`button button-sm ${nextStatus === "CANCELLED" ? "button-outline danger-button" : "button-secondary"}`}
                              onClick={() => handleStatusChange(orderDetail.id, nextStatus)}
                              disabled={busy}
                            >
                              Move to {nextStatus}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {canRefund &&
                    ["PAID", "PROCESSING", "SHIPPED"].includes(orderDetail.status) && (
                      <button
                        className="button button-outline button-sm danger-button"
                        onClick={() => handleRefund(orderDetail.id)}
                        disabled={busy}
                      >
                        Issue Mock Refund ↗
                      </button>
                    )}
                </div>

                <div className="order-notes-section">
                  <h5>Staff Notes</h5>
                  {orderDetail.notes.length === 0 ? (
                    <p className="field-note">No staff notes yet.</p>
                  ) : (
                    <div className="notes-list">
                      {orderDetail.notes.map((note) => (
                        <div key={note.id} className="note-card">
                          <div className="note-meta">
                            <strong>{note.author.email}</strong>
                            <span>{formatDate(note.createdAt)}</span>
                          </div>
                          <p className="note-body">{note.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {canAddNote && (
                    <form onSubmit={handleAddNote} className="form-stack note-form">
                      <textarea
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        placeholder="Add an internal staff note..."
                        required
                        className="textarea-input"
                        rows={2}
                      />
                      <button
                        type="submit"
                        className="button button-secondary button-sm"
                        disabled={noteBusy || !noteBody.trim()}
                      >
                        {noteBusy ? <span className="spinner spinner-dark" /> : null} Add Note
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders found for this store.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord) => (
                <tr key={ord.id}>
                  <td>
                    <code className="order-id-tag">#{ord.id.slice(-8)}</code>
                  </td>
                  <td>
                    <strong>{ord.customerName}</strong>
                    <div className="table-description">{ord.customerEmail}</div>
                  </td>
                  <td>
                    <span className={`status-badge status-${ord.status.toLowerCase()}`}>
                      {ord.status}
                    </span>
                  </td>
                  <td>
                    <strong>{formatCurrency(ord.total)}</strong>
                  </td>
                  <td>{formatDate(ord.createdAt)}</td>
                  <td>
                    <button
                      className="button-link"
                      onClick={() => openOrderDetail(ord.id)}
                    >
                      View Details ↗
                    </button>
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
