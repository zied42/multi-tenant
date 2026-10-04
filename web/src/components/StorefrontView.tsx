import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { CartItem, OrderSummary, Product, Store } from "../types";
import { formatCurrency } from "../utils/formatters";

interface Props {
  slug: string;
  onBackToDashboard?: () => void;
}

export function StorefrontView({ slug: initialSlug, onBackToDashboard }: Props) {
  const [slug, setSlug] = useState(initialSlug || "");
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Product detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Cart State (In React Memory only)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);

  // Checkout State
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // Order Confirmation & Guest Payment (In React Memory only!)
  const [activeGuestOrder, setActiveGuestOrder] = useState<OrderSummary | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [copiedPublicToken, setCopiedPublicToken] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payNotice, setPayNotice] = useState("");
  const [payError, setPayError] = useState("");

  // Order Lookup by ID + Token
  const [lookupOrderId, setLookupOrderId] = useState("");
  const [lookupToken, setLookupToken] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  useEffect(() => {
    if (initialSlug) {
      loadStorefront(initialSlug);
    }
  }, [initialSlug]);

  async function loadStorefront(targetSlug: string) {
    if (!targetSlug.trim()) return;
    setLoading(true);
    setError("");
    setStore(null);
    setProducts([]);
    try {
      const [storeRes, prodRes] = await Promise.all([
        api<{ store: Store }>(`/s/${targetSlug}`),
        api<{ products: Product[] }>(`/s/${targetSlug}/products`),
      ]);
      setStore(storeRes.store);
      setProducts(prodRes.products);
      setSlug(targetSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Storefront not found");
    } finally {
      setLoading(false);
    }
  }

  function handleSlugSubmit(e: FormEvent) {
    e.preventDefault();
    loadStorefront(slug.trim());
  }

  function addToCart(product: Product, quantity = 1) {
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.product.id === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(newQty, product.stock),
        };
        return updated;
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
    });
  }

  function updateCartQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const cartEstimatedSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (cart.length === 0) return;
    setCheckoutBusy(true);
    setCheckoutError("");
    setPayNotice("");
    setPayError("");

    const itemsPayload = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    try {
      const res = await api<{ order: OrderSummary; publicToken: string }>(
        `/s/${slug}/orders`,
        {
          method: "POST",
          body: {
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim().toLowerCase(),
            items: itemsPayload,
            couponCode: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
          },
        },
      );

      // Save returned order & publicToken in React memory ONLY
      setActiveGuestOrder(res.order);
      setPublicToken(res.publicToken);
      setCart([]);
      setShowCartModal(false);
      setCouponCode("");
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Checkout failed. Please try again.",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function handleMockPay() {
    if (!activeGuestOrder || !publicToken) return;
    setPayBusy(true);
    setPayNotice("");
    setPayError("");
    try {
      const res = await api<{ order: OrderSummary }>(
        `/s/${slug}/orders/${activeGuestOrder.id}/pay`,
        {
          method: "POST",
          headers: {
            "X-Order-Token": publicToken,
          },
        },
      );
      setActiveGuestOrder(res.order);
      setPayNotice("Mock Payment successful! Order status is now PAID.");
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : "Mock payment failed. Order must be PENDING.",
      );
    } finally {
      setPayBusy(false);
    }
  }

  async function handleLookupOrder(e: FormEvent) {
    e.preventDefault();
    if (!lookupOrderId.trim() || !lookupToken.trim()) return;
    setLookupBusy(true);
    setPayNotice("");
    setPayError("");
    try {
      const res = await api<{ order: OrderSummary }>(
        `/s/${slug}/orders/${lookupOrderId.trim()}`,
        {
          headers: {
            "X-Order-Token": lookupToken.trim(),
          },
        },
      );
      setActiveGuestOrder(res.order);
      setPublicToken(lookupToken.trim());
      setPayNotice("Order found!");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Order lookup failed. Check Order ID and Token.");
    } finally {
      setLookupBusy(false);
    }
  }

  function copyPublicToken() {
    if (!publicToken) return;
    navigator.clipboard.writeText(publicToken);
    setCopiedPublicToken(true);
    setTimeout(() => setCopiedPublicToken(false), 2000);
  }

  return (
    <div className="storefront-shell">
      <header className="storefront-header">
        <div className="storefront-brand">
          {onBackToDashboard && (
            <button className="button button-ghost button-sm" onClick={onBackToDashboard}>
              ← Back to Dashboard
            </button>
          )}
          <h2>{store ? store.name : "Public Storefront"}</h2>
          {store && <span className="storefront-slug">/s/{store.slug}</span>}
        </div>

        <div className="storefront-nav-actions">
          <form onSubmit={handleSlugSubmit} className="slug-search-form">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Enter store slug (e.g. acme)"
              className="input-text input-sm"
              required
            />
            <button type="submit" className="button button-secondary button-sm">
              Visit Store
            </button>
          </form>

          {store && (
            <button
              className="button button-primary button-sm cart-btn"
              onClick={() => setShowCartModal(true)}
            >
              🛒 Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)})
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="feedback error-feedback storefront-feedback">
          <b>!</b>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="tab-loading">
          <span className="spinner spinner-dark" /> Loading storefront...
        </div>
      ) : !store ? (
        <div className="empty-state">
          <h3>Browse a Storefront</h3>
          <p>Enter a store slug in the search bar above to browse active products and test guest checkout.</p>
        </div>
      ) : (
        <main className="storefront-main">
          {/* Active Guest Order Confirmation Banner / View */}
          {activeGuestOrder && publicToken && (
            <div className="guest-order-card">
              <div className="card-header-row">
                <h4>Order #{activeGuestOrder.id.slice(-8)} Confirmation</h4>
                <button
                  className="button-icon"
                  onClick={() => {
                    setActiveGuestOrder(null);
                    setPublicToken(null);
                  }}
                >
                  ✕
                </button>
              </div>

              {payNotice && (
                <div className="feedback success-feedback">
                  <b>✓</b>
                  <span>{payNotice}</span>
                </div>
              )}
              {payError && (
                <div className="feedback error-feedback">
                  <b>!</b>
                  <span>{payError}</span>
                </div>
              )}

              <div className="guest-token-callout">
                <div className="token-header">
                  <strong>🔑 One-Time Guest Order Token (React Memory Only)</strong>
                </div>
                <p className="token-help">
                  You need this token to view order status or process a mock payment. Keep it safe—it is not saved in persistent browser storage!
                </p>
                <div className="token-code-row">
                  <code className="token-code">{publicToken}</code>
                  <button
                    className="button button-secondary button-sm"
                    onClick={copyPublicToken}
                  >
                    {copiedPublicToken ? "Copied! ✓" : "Copy Token"}
                  </button>
                </div>
              </div>

              <div className="order-totals-summary">
                <div>
                  <span>Status:</span>
                  <span className={`status-badge status-${activeGuestOrder.status.toLowerCase()}`}>
                    {activeGuestOrder.status}
                  </span>
                </div>
                <div>
                  <span>Subtotal:</span>
                  <strong>{formatCurrency(activeGuestOrder.subtotal)}</strong>
                </div>
                {activeGuestOrder.discount > 0 && (
                  <div className="discount-row">
                    <span>Discount:</span>
                    <strong>-{formatCurrency(activeGuestOrder.discount)}</strong>
                  </div>
                )}
                <div className="grand-total-row">
                  <span>Authoritative Total (from API):</span>
                  <strong>{formatCurrency(activeGuestOrder.total)}</strong>
                </div>
              </div>

              {activeGuestOrder.status === "PENDING" && (
                <div className="mock-pay-actions">
                  <button
                    className="button button-primary"
                    onClick={handleMockPay}
                    disabled={payBusy}
                  >
                    {payBusy ? <span className="spinner" /> : null} Complete Mock Payment ↗
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Catalog Grid */}
          <section className="catalog-section">
            <h3 className="section-title">Available Products ({products.length})</h3>
            {products.length === 0 ? (
              <div className="empty-state">
                <p>This store has no active products available for purchase right now.</p>
              </div>
            ) : (
              <div className="product-grid">
                {products.map((prod) => (
                  <div key={prod.id} className="product-card">
                    <div className="product-card-body">
                      <h4>{prod.name}</h4>
                      {prod.description && <p>{prod.description}</p>}
                      <div className="product-price-tag">
                        {formatCurrency(prod.price)}
                      </div>
                      <span className={prod.stock > 0 ? "stock-tag" : "stock-out-tag"}>
                        {prod.stock > 0 ? `${prod.stock} in stock` : "Out of stock"}
                      </span>
                    </div>
                    <div className="product-card-actions">
                      <button
                        className="button button-secondary button-sm"
                        onClick={() => setSelectedProduct(prod)}
                      >
                        Details
                      </button>
                      <button
                        className="button button-primary button-sm"
                        onClick={() => addToCart(prod)}
                        disabled={prod.stock <= 0}
                      >
                        + Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Product Detail Modal */}
          {selectedProduct && (
            <div className="modal-overlay">
              <div className="modal-card">
                <h4>{selectedProduct.name}</h4>
                <div className="product-detail-box">
                  <p>{selectedProduct.description || "No description provided."}</p>
                  <div className="price-large">
                    {formatCurrency(selectedProduct.price)}
                  </div>
                  <p className="field-note">Stock: {selectedProduct.stock} units available</p>
                </div>
                <div className="modal-actions">
                  <button
                    className="button button-ghost"
                    onClick={() => setSelectedProduct(null)}
                  >
                    Close
                  </button>
                  <button
                    className="button button-primary"
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    disabled={selectedProduct.stock <= 0}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cart & Checkout Modal */}
          {showCartModal && (
            <div className="modal-overlay">
              <div className="modal-card modal-lg">
                <div className="modal-header-row">
                  <h4>Your Shopping Cart</h4>
                  <button
                    className="button-icon"
                    onClick={() => setShowCartModal(false)}
                  >
                    ✕
                  </button>
                </div>

                {checkoutError && (
                  <div className="feedback error-feedback">
                    <b>!</b>
                    <span>{checkoutError}</span>
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="empty-state">
                    <p>Your cart is empty. Add products to get started!</p>
                  </div>
                ) : (
                  <div className="cart-content">
                    <table className="data-table data-table-compact">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Subtotal</th>
                          <th>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item) => (
                          <tr key={item.product.id}>
                            <td>
                              <strong>{item.product.name}</strong>
                            </td>
                            <td>
                              <div className="qty-controls">
                                <button
                                  className="button-qty"
                                  onClick={() => updateCartQty(item.product.id, -1)}
                                >
                                  -
                                </button>
                                <span>{item.quantity}</span>
                                <button
                                  className="button-qty"
                                  onClick={() => updateCartQty(item.product.id, 1)}
                                  disabled={item.quantity >= item.product.stock}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td>{formatCurrency(item.product.price)}</td>
                            <td>{formatCurrency(item.product.price * item.quantity)}</td>
                            <td>
                              <button
                                className="button-link danger-link"
                                onClick={() => removeFromCart(item.product.id)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="cart-summary-line">
                      <span>Estimated Subtotal (Subject to backend calculation):</span>
                      <strong>{formatCurrency(cartEstimatedSubtotal)}</strong>
                    </div>

                    <form onSubmit={handleCheckout} className="form-stack checkout-form">
                      <h5>Guest Checkout Details</h5>
                      <div className="form-row">
                        <label className="field-grow">
                          <span className="field-label">Customer Name</span>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Jane Doe"
                            required
                            className="input-text"
                          />
                        </label>
                        <label className="field-grow">
                          <span className="field-label">Customer Email</span>
                          <input
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            placeholder="jane@example.com"
                            required
                            className="input-text"
                          />
                        </label>
                      </div>

                      <label className="field">
                        <span className="field-label">Coupon Code (Optional)</span>
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="e.g. SAVE20"
                          className="input-text uppercase-input"
                        />
                      </label>

                      <button
                        type="submit"
                        className="button button-primary"
                        disabled={checkoutBusy}
                      >
                        {checkoutBusy ? <span className="spinner" /> : null} Place Order ↗
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Guest Order Lookup Tool */}
          <section className="order-lookup-section card-box">
            <h4>Check Existing Guest Order Status</h4>
            <p className="field-note">
              Enter an Order ID and its one-time order token to check status or pay via header authorization.
            </p>
            <form onSubmit={handleLookupOrder} className="form-inline">
              <label className="field-grow">
                <input
                  type="text"
                  value={lookupOrderId}
                  onChange={(e) => setLookupOrderId(e.target.value)}
                  placeholder="Order ID"
                  required
                  className="input-text"
                />
              </label>
              <label className="field-grow">
                <input
                  type="text"
                  value={lookupToken}
                  onChange={(e) => setLookupToken(e.target.value)}
                  placeholder="X-Order-Token secret"
                  required
                  className="input-text"
                />
              </label>
              <button
                type="submit"
                className="button button-secondary"
                disabled={lookupBusy}
              >
                {lookupBusy ? <span className="spinner spinner-dark" /> : null} Lookup Order
              </button>
            </form>
          </section>
        </main>
      )}
    </div>
  );
}
