import { useState } from "react";
import type { Role, User } from "../types";
import { hasRole } from "../utils/formatters";
import { AuditTab } from "./AuditTab";
import { CouponsTab } from "./CouponsTab";
import { InvitesTab } from "./InvitesTab";
import { MembersTab } from "./MembersTab";
import { OrdersTab } from "./OrdersTab";
import { ProductsTab } from "./ProductsTab";

interface Props {
  storeId: string;
  storeName: string;
  storeSlug: string;
  userRole: Role;
  user: User;
  accessToken: string;
  onAccessToken: (token: string) => void;
  onSessionExpired: () => void;
  onSwitchStore: () => void;
  onOpenStorefront: (slug: string) => void;
}

type Tab = "members" | "invites" | "products" | "coupons" | "orders" | "audit";

export function DashboardView({
  storeId,
  storeName,
  storeSlug,
  userRole,
  user,
  accessToken,
  onAccessToken,
  onSessionExpired,
  onSwitchStore,
  onOpenStorefront,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const canManageCatalog = hasRole(userRole, "MANAGER");
  const canManageStaff = hasRole(userRole, "ADMIN");

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-title-area">
          <button className="button button-ghost button-sm" onClick={onSwitchStore}>
            ← Switch Store
          </button>
          <h2>{storeName}</h2>
          <code className="slug-tag">/s/{storeSlug}</code>
          <span className={`role-badge role-${userRole.toLowerCase()}`}>
            Your Role: {userRole}
          </span>
        </div>

        <div className="dashboard-actions">
          <button
            className="button button-secondary button-sm"
            onClick={() => onOpenStorefront(storeSlug)}
          >
            View Public Storefront ↗
          </button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button
          className={`nav-tab ${activeTab === "products" ? "is-active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          📦 Products
        </button>
        <button
          className={`nav-tab ${activeTab === "orders" ? "is-active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          🛒 Orders
        </button>
        {canManageCatalog && <button
          className={`nav-tab ${activeTab === "coupons" ? "is-active" : ""}`}
          onClick={() => setActiveTab("coupons")}
        >
          🏷️ Coupons
        </button>}
        <button
          className={`nav-tab ${activeTab === "members" ? "is-active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          👥 Members
        </button>
        {canManageStaff && <button
          className={`nav-tab ${activeTab === "invites" ? "is-active" : ""}`}
          onClick={() => setActiveTab("invites")}
        >
          ✉️ Invites
        </button>}
        {canManageStaff && <button
          className={`nav-tab ${activeTab === "audit" ? "is-active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          📜 Audit Log
        </button>}
      </nav>

      <main className="dashboard-body">
        {activeTab === "products" && (
          <ProductsTab
            storeId={storeId}
            userRole={userRole}
            accessToken={accessToken}
            onAccessToken={onAccessToken}
            onSessionExpired={onSessionExpired}
          />
        )}

        {activeTab === "orders" && (
          <OrdersTab
            storeId={storeId}
            userRole={userRole}
            accessToken={accessToken}
            onAccessToken={onAccessToken}
            onSessionExpired={onSessionExpired}
          />
        )}

        {activeTab === "coupons" && canManageCatalog && (
          <CouponsTab
            storeId={storeId}
            userRole={userRole}
            accessToken={accessToken}
            onAccessToken={onAccessToken}
            onSessionExpired={onSessionExpired}
          />
        )}

        {activeTab === "members" && (
          <MembersTab
            storeId={storeId}
            userRole={userRole}
            currentUserId={user.id}
            accessToken={accessToken}
            onAccessToken={onAccessToken}
            onSessionExpired={onSessionExpired}
            onStoreUpdated={onSwitchStore}
          />
        )}

        {activeTab === "invites" && canManageStaff && (
          <InvitesTab
            storeId={storeId}
            userRole={userRole}
            accessToken={accessToken}
            onAccessToken={onAccessToken}
            onSessionExpired={onSessionExpired}
          />
        )}

        {activeTab === "audit" && canManageStaff && (
          <AuditTab
            storeId={storeId}
            userRole={userRole}
            accessToken={accessToken}
            onAccessToken={onAccessToken}
            onSessionExpired={onSessionExpired}
          />
        )}
      </main>
    </div>
  );
}
