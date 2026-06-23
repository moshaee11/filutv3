
export enum PricingMode {
  WEIGHT = 'WEIGHT',
  PIECE = 'PIECE'
}

export enum PaymentMethod {
  WECHAT = 'WECHAT',
  ALIPAY = 'ALIPAY',
  CASH = 'CASH',
  OTHER = 'OTHER',
  MIXED = 'MIXED'
}

export enum OrderStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED'
}

export interface ExtraFeeItem {
  id: string;
  name: string;
  amount: number;
}

// 新增：商品模板接口
export interface ProductTemplate {
  id: string;
  name: string;
  category: string;
  pricingMode: PricingMode;
  defaultTare: number;
  defaultPrice: number;
  lowStockThreshold: number;
  unitWeight?: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  pricingMode: PricingMode;
  defaultTare: number;
  stockQty: number;
  stockWeight: number;
  initialStockQty: number; // 新增：初始入库数量
  initialStockWeight: number; // 新增：初始入库重量
  batchId?: string;
  costPrice?: number;
  sellingPrice?: number;
  lowStockThreshold?: number;
  unitWeight?: number; // 新增：单件标准重量 (用于按件计价时的成本分摊)
}

export interface Batch {
  id: string;
  plateNumber: string;
  inboundDate: string;
  cost: number;
  extraFees: ExtraFeeItem[];
  totalWeight: number;
  isClosed: boolean;
  batchNo: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  qty: number;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number; 
  receivedAmount: number;
  discount: number;
  extraFee: number; 
  paymentMethod: PaymentMethod;
  mixedPayments?: { method: PaymentMethod, amount: number }[];
  payee: string;
  createdAt: string;
  status: OrderStatus;
  note?: string;
}

export interface Repayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  payee: string;
  paymentMethod?: PaymentMethod;
  mixedPayments?: { method: PaymentMethod, amount: number }[];
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  wechat?: string;
  address?: string;
  note?: string;
  totalDebt: number;
  isGuest: boolean;
  createdAt?: string;
}

export interface Expense {
  id: string;
  amount: number;
  type: string;
  date: string;
  note: string;
  batchId?: string;
}

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  type: 'INBOUND' | 'OUTBOUND' | 'RETURN' | 'ADJUST' | 'CANCEL_RETURN';
  qtyChange: number;
  weightChange: number;
  qtyAfter: number;
  weightAfter: number;
  reason?: string;
  relatedOrderId?: string;
  relatedBatchId?: string;
  operator?: string;
  createdAt: string;
}

export interface OpLog {
  id: string;
  type: 'ORDER_DELETE' | 'ORDER_CANCEL' | 'ORDER_EDIT' | 'STOCK_ADJUST' | 'PRICE_CHANGE' | 'DEBT_CHANGE' | 'REPAYMENT_DELETE' | 'REPAYMENT_EDIT' | 'CUSTOMER_EDIT' | 'PRODUCT_EDIT';
  description: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  operator?: string;
  createdAt: string;
}

export interface PendingOrder {
  id: string;
  items: OrderItem[];
  customerId: string;
  createdAt: string;
  note?: string;
}

export interface AppData {
  products: Product[];
  batches: Batch[];
  orders: Order[];
  repayments: Repayment[];
  customers: Customer[];
  payees: string[];
  expenses: Expense[];
  templates: ProductTemplate[];
  pendingOrders: PendingOrder[];
  stockLogs: StockLog[];
  opLogs: OpLog[];
}
