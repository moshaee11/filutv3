
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
  createdAt: string;          // 实际交易时间，用户可改
  updatedAt?: string;         // 系统维护：最后修改时间，存在=已编辑
  source?: 'BILLING' | 'QUICK' | 'MANUAL' | 'IMPORT';  // 数据来源
  status: OrderStatus;
  note?: string;
}

export interface Repayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;               // 实际收款时间，用户可改
  createdAt?: string;         // 系统维护：录入时间，不可改
  updatedAt?: string;         // 系统维护：最后修改时间
  source?: 'BILLING' | 'QUICK' | 'MANUAL' | 'IMPORT';
  payee: string;              // 收款人
  paymentMethod?: PaymentMethod;
  mixedPayments?: { method: PaymentMethod, amount: number }[];
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  isGuest: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  type: string;
  date: string;
  note: string;
  batchId?: string;
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
  templates: ProductTemplate[]; // 新增：模板列表
  pendingOrders: PendingOrder[];
}
