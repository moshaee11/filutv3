
export enum PricingMode {
  WEIGHT = 'WEIGHT',
  PIECE = 'PIECE'
}

export enum PaymentMethod {
  WECHAT = 'WECHAT',
  ALIPAY = 'ALIPAY',
  CASH = 'CASH',
  OTHER = 'OTHER'
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
  payee: string;
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

export interface AppData {
  products: Product[];
  batches: Batch[];
  orders: Order[];
  repayments: Repayment[];
  customers: Customer[];
  payees: string[];
  expenses: Expense[];
}
