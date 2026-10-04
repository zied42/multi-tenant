export type Role = "OWNER" | "ADMIN" | "MANAGER" | "SUPPORT" | "VIEWER";

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type CouponType = "PERCENT" | "FIXED";

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export interface User {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface MembershipStore {
  role: Role;
  createdAt: string;
  store: Store;
}

export interface Member {
  role: Role;
  createdAt: string;
  user: {
    id: string;
    email: string;
    emailVerifiedAt?: string | null;
  };
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  price: number; // integer minor units
  stock: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  storeId: string;
  code: string;
  type: CouponType;
  value: number; // percent or minor units
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderNote {
  id: string;
  orderId: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    email: string;
  };
}

export interface OrderSummary {
  id: string;
  customerName?: string;
  customerEmail?: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  notes: OrderNote[];
}

export interface AuditLog {
  id: string;
  storeId: string;
  actorId?: string | null;
  action: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
