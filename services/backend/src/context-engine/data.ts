import { Product, InventoryItem, Customer, Promotion, ShippingOption } from '@policyshield/shared';

// Minimal mock data that satisfies the DEMO scenarios (laptop buyer).

export const PRODUCTS: Product[] = [
  { product_id: 'prod_laptop_1', name: 'MacBook Pro M3', category: 'electronics', base_price: 150000, currency: 'INR', tags: ['premium'] },
  { product_id: 'prod_laptop_2', name: 'Dell XPS 15', category: 'electronics', base_price: 69999, currency: 'INR', tags: ['premium', 'clearance'] },
  { product_id: 'prod_laptop_3', name: 'Asus ZenBook', category: 'electronics', base_price: 68500, currency: 'INR', tags: [] },
];

export const INVENTORY: InventoryItem[] = [
  { product_id: 'prod_laptop_1', available_quantity: 10, warehouse_id: 'wh_main', express_eligible: true, last_updated: new Date().toISOString() },
  { product_id: 'prod_laptop_2', available_quantity: 2, warehouse_id: 'wh_main', express_eligible: true, last_updated: new Date().toISOString() },
  { product_id: 'prod_laptop_3', available_quantity: 7, warehouse_id: 'wh_main', express_eligible: true, last_updated: new Date().toISOString() },
];

export const CUSTOMERS: Customer[] = [
  { customer_id: 'cust_vip', name: 'Alice (VIP)', segment: 'vip', order_history_count: 50, total_spend: 500000 },
  { customer_id: 'cust_reg', name: 'Bob (Regular)', segment: 'regular', order_history_count: 2, total_spend: 15000 },
];

export const PROMOTIONS: Promotion[] = [
  { promotion_id: 'promo_15', name: 'Clearance 15%', discount_percent: 15, applicable_product_ids: ['prod_laptop_2', 'prod_airpods'], eligible_segments: [], active: true, valid_from: '2023-01-01', valid_until: '2029-12-31' },
  { promotion_id: 'promo_5', name: 'Standard 5%', discount_percent: 5, applicable_product_ids: [], eligible_segments: [], active: true, valid_from: '2023-01-01', valid_until: '2029-12-31' },
];

export const SHIPPING: ShippingOption[] = [
  { option_id: 'ship_std', name: 'Standard Delivery', type: 'standard', estimated_days: 5, cost: 0, eligible_warehouse_ids: ['wh_main'] },
  { option_id: 'ship_exp', name: 'Express Delivery', type: 'express', estimated_days: 1, cost: 500, eligible_warehouse_ids: ['wh_main'] },
];
