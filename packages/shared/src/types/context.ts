// ─── Commerce Context Types ─────────────────────────────────────

export interface Product {
  product_id: string;
  name: string;
  category: string;
  base_price: number;
  currency: string;
  /** Tags for policy matching (e.g. 'premium', 'clearance') */
  tags: string[];
}

export interface InventoryItem {
  product_id: string;
  available_quantity: number;
  warehouse_id: string;
  /** Whether this warehouse supports express shipping */
  express_eligible: boolean;
  last_updated: string;
}

export interface Customer {
  customer_id: string;
  name: string;
  segment: 'regular' | 'vip' | 'new';
  order_history_count: number;
  total_spend: number;
}

export interface Promotion {
  promotion_id: string;
  name: string;
  discount_percent: number;
  /** Product IDs this promotion applies to (empty = all) */
  applicable_product_ids: string[];
  /** Customer segments eligible */
  eligible_segments: string[];
  active: boolean;
  valid_from: string;
  valid_until: string;
}

export interface ShippingOption {
  option_id: string;
  name: string;
  type: 'standard' | 'express' | 'same_day';
  estimated_days: number;
  cost: number;
  /** Warehouse IDs that can fulfill this option */
  eligible_warehouse_ids: string[];
}

export interface BuyerMemory {
  customer_id: string;
  preferences: Record<string, any>;
  negotiation_history: any[];
  last_updated: string;
  memory_version: number;
}

/** The full authoritative context assembled by the Context Engine */
export interface CommerceContext {
  /** Explicit buyer memory / historical preferences */
  buyer_memory?: BuyerMemory;
  /** Products matching the buyer's query */
  products: Product[];
  /** Current inventory for matched products */
  inventory: Record<string, number>;
  /** Prices for matched products */
  prices: Record<string, number>;
  /** Customer profile */
  customer: Customer | null;
  /** Active promotions */
  promotions: Promotion[];
  /** Available shipping options */
  shipping: ShippingOption[];
  /** Context freshness metadata */
  fetched_at: string;
  /** Context version for staleness checks */
  context_version: string;
}
