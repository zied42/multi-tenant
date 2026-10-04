import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Product, ProductStatus, Role } from "../types";
import { formatCurrency, formatDate, hasRole } from "../utils/formatters";

interface Props {
  storeId: string;
  userRole: Role;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
}

export function ProductsTab({
  storeId,
  userRole,
  accessToken,
  onAccessToken,
  onSessionExpired,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceInput, setPriceInput] = useState(""); // dollars decimal e.g. "19.99"
  const [stockInput, setStockInput] = useState("0");
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");

  const canManage = hasRole(userRole, "MANAGER");

  useEffect(() => {
    loadProducts();
  }, [storeId]);

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ products: Product[] }>(`/stores/${storeId}/products`, {
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setProducts(res.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingProduct(null);
    setName("");
    setDescription("");
    setPriceInput("");
    setStockInput("0");
    setStatus("ACTIVE");
    setShowModal(true);
  }

  function openEditModal(prod: Product) {
    setEditingProduct(prod);
    setName(prod.name);
    setDescription(prod.description ?? "");
    setPriceInput((prod.price / 100).toFixed(2));
    setStockInput(String(prod.stock));
    setStatus(prod.status);
    setShowModal(true);
  }

  async function handleSaveProduct(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const parsedPrice = Math.round(parseFloat(priceInput) * 100);
    const parsedStock = parseInt(stockInput, 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Please enter a valid price (e.g. 19.99)");
      setBusy(false);
      return;
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      setError("Please enter a valid non-negative stock quantity");
      setBusy(false);
      return;
    }

    const payload = {
      name,
      description: description.trim() || undefined,
      price: parsedPrice,
      stock: parsedStock,
      status,
    };

    try {
      if (editingProduct) {
        await api(`/stores/${storeId}/products/${editingProduct.id}`, {
          method: "PATCH",
          accessToken,
          onAccessToken,
          onSessionExpired,
          body: payload,
        });
        setNotice(`Product "${name}" updated successfully.`);
      } else {
        await api(`/stores/${storeId}/products`, {
          method: "POST",
          accessToken,
          onAccessToken,
          onSessionExpired,
          body: payload,
        });
        setNotice(`Product "${name}" created successfully.`);
      }
      setShowModal(false);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveProduct(prod: Product) {
    if (!window.confirm(`Are you sure you want to archive "${prod.name}"?`)) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/stores/${storeId}/products/${prod.id}`, {
        method: "DELETE",
        accessToken,
        onAccessToken,
        onSessionExpired,
      });
      setNotice(`Product "${prod.name}" archived.`);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive product");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner spinner-dark" /> Loading product catalogue...
      </div>
    );
  }

  return (
    <div className="tab-container">
      <div className="tab-header">
        <div>
          <h3>Store Products</h3>
          <p className="tab-subtitle">
            Manage product catalogue, pricing (integer minor units), and inventory.
          </p>
        </div>
        {canManage && (
          <button className="button button-primary" onClick={openCreateModal}>
            + Add Product
          </button>
        )}
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h4>{editingProduct ? "Edit Product" : "Create Product"}</h4>
            <form onSubmit={handleSaveProduct} className="form-stack">
              <label className="field">
                <span className="field-label">Product Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Classic T-Shirt"
                  required
                  className="input-text"
                />
              </label>

              <label className="field">
                <span className="field-label">Description (Optional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your product..."
                  className="textarea-input"
                  rows={3}
                />
              </label>

              <div className="form-row">
                <label className="field-grow">
                  <span className="field-label">Price ($ USD)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="19.99"
                    required
                    className="input-text"
                  />
                  <span className="field-note">
                    Converted to integer minor units ({priceInput ? Math.round(parseFloat(priceInput || "0") * 100) : 0} cents)
                  </span>
                </label>

                <label className="field-grow">
                  <span className="field-label">Inventory Stock</span>
                  <input
                    type="number"
                    min="0"
                    value={stockInput}
                    onChange={(e) => setStockInput(e.target.value)}
                    required
                    className="input-text"
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProductStatus)}
                  className="select-input"
                >
                  <option value="ACTIVE">ACTIVE (Visible in Storefront)</option>
                  <option value="DRAFT">DRAFT (Hidden)</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                >
                  {busy ? <span className="spinner" /> : null} Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="empty-state">
          <p>No products found in this store.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Updated</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((prod) => (
                <tr key={prod.id}>
                  <td>
                    <div>
                      <strong>{prod.name}</strong>
                      {prod.description && (
                        <p className="table-description">{prod.description}</p>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong>{formatCurrency(prod.price)}</strong>
                    <span className="minor-units-tag">({prod.price}¢)</span>
                  </td>
                  <td>
                    <span className={prod.stock > 0 ? "stock-ok" : "stock-empty"}>
                      {prod.stock} units
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${prod.status.toLowerCase()}`}>
                      {prod.status}
                    </span>
                  </td>
                  <td>{formatDate(prod.updatedAt)}</td>
                  {canManage && (
                    <td>
                      <div className="action-buttons">
                        <button
                          className="button-link"
                          onClick={() => openEditModal(prod)}
                        >
                          Edit
                        </button>
                        {prod.status !== "ARCHIVED" && (
                          <button
                            className="button-link danger-link"
                            onClick={() => handleArchiveProduct(prod)}
                            disabled={busy}
                          >
                            Archive
                          </button>
                        )}
                      </div>
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
