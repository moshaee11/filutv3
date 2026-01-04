
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Product, Order, Customer, Batch, PricingMode, PaymentMethod, ExtraFeeItem, Repayment, Expense, OrderStatus } from './types';

interface AppContextType {
  data: AppData;
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, newQty: number, newWeight: number) => void;
  addOrder: (o: Order) => void;
  cancelOrder: (id: string) => void;
  deleteOrder: (id: string) => void;
  addRepayment: (r: Repayment) => void;
  addExpense: (e: Expense) => void;
  addBatch: (b: Batch) => void;
  updateBatch: (b: Batch) => void;
  closeBatch: (id: string) => void;
  deleteBatch: (id: string) => void;
  addExtraFee: (batchId: string, fee: ExtraFeeItem) => void;
  removeExtraFee: (batchId: string, feeId: string) => void;
  addPayee: (name: string) => void;
  updatePayee: (oldName: string, newName: string) => void;
  deletePayee: (name: string) => void;
  addCustomer: (c: Customer) => void;
  importData: (jsonStr: string) => void;
  exportData: () => string;
}

const STORAGE_KEY = 'FRUIT_PRO_DATA_V3';
const CORRUPT_BACKUP_KEY = 'FRUIT_PRO_CORRUPT_BACKUP';

const initialData: AppData = {
  products: [],
  batches: [],
  orders: [],
  repayments: [],
  customers: [
    { id: 'guest', name: '散客', phone: '', totalDebt: 0, isGuest: true }
  ],
  payees: ['豆建国', '王妮', '关灵恩', '楠楠嫂'],
  expenses: []
};

// 辅助函数：深度清洗数据，确保数组内不含 null/undefined，且关键字段存在
// 关键修复：强制补充缺失的数组字段 (如 extraFees)，防止 UI 读取 length 时崩溃
const sanitizeData = (incoming: any): AppData => {
  const safeArray = <T,>(arr: any, validator: (item: any) => boolean): T[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => item && typeof item === 'object' && validator(item));
  };

  return {
    // 确保有 id 和 name 才算有效商品
    products: safeArray<Product>(incoming.products, (p) => !!p.id && !!p.name).map((p: any) => ({
        ...p,
        stockQty: Number(p.stockQty) || 0,
        stockWeight: Number(p.stockWeight) || 0,
        sellingPrice: Number(p.sellingPrice) || 0,
    })),
    // 确保有 id 和 plateNumber 才算有效车次
    batches: safeArray<Batch>(incoming.batches, (b) => !!b.id && !!b.plateNumber).map((b: any) => ({
        ...b,
        // 核心防崩修复：如果 extraFees 丢失，强制补为空数组
        extraFees: Array.isArray(b.extraFees) ? b.extraFees : [], 
        cost: Number(b.cost) || 0,
        totalWeight: Number(b.totalWeight) || 0,
    })),
    // 确保有 id 才算有效订单
    orders: safeArray<Order>(incoming.orders, (o) => !!o.id).map((o: any) => ({
        ...o,
        // 核心防崩修复：如果 items 丢失，强制补为空数组
        items: Array.isArray(o.items) ? o.items : [],
        totalAmount: Number(o.totalAmount) || 0,
        receivedAmount: Number(o.receivedAmount) || 0,
    })),
    repayments: safeArray<Repayment>(incoming.repayments, (r) => !!r.id),
    customers: safeArray<Customer>(incoming.customers, (c) => !!c.id && !!c.name).map((c: any) => ({
        ...c,
        totalDebt: Number(c.totalDebt) || 0
    })),
    // 字符串数组过滤空串
    payees: Array.isArray(incoming.payees) ? incoming.payees.filter((p: any) => typeof p === 'string' && p.trim() !== '') : initialData.payees,
    expenses: safeArray<Expense>(incoming.expenses, (e) => !!e.id),
  };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return initialData;
      
      const parsed = JSON.parse(saved);
      
      // 第一道防线：如果顶层结构不是对象
      if (!parsed || typeof parsed !== 'object') {
          return initialData;
      }

      // 第二道防线：强力清洗
      // 哪怕数据损坏，sanitizeData 也会返回一个结构完整的空对象或部分对象，防止白屏
      const cleanData = sanitizeData(parsed);

      // 如果发现清洗后的数据和原始数据差别巨大（例如丢失了所有订单），可能需要备份一下坏数据
      if (Array.isArray(parsed.orders) && parsed.orders.length > 0 && cleanData.orders.length === 0) {
          console.warn("Data sanitization removed all orders. Backing up corrupted data.");
          localStorage.setItem(CORRUPT_BACKUP_KEY, saved);
      }
      
      return { ...initialData, ...cleanData };
    } catch (e) {
      console.error("Failed to parse local storage", e);
      return initialData;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const addProduct = (p: Product) => setData(prev => ({ ...prev, products: [...prev.products, p] }));
  const updateProduct = (p: Product) => setData(prev => ({ ...prev, products: prev.products.map(old => old.id === p.id ? p : old) }));
  const deleteProduct = (id: string) => setData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
  
  const adjustStock = (productId: string, newQty: number, newWeight: number) => {
    setData(prev => ({
      ...prev,
      products: prev.products.map(p => 
        p.id === productId ? { ...p, stockQty: newQty, stockWeight: newWeight } : p
      )
    }));
  };

  const addBatch = (b: Batch) => setData(prev => ({ ...prev, batches: [b, ...prev.batches] }));
  const updateBatch = (b: Batch) => setData(prev => ({ ...prev, batches: prev.batches.map(old => old.id === b.id ? b : old) }));
  
  const closeBatch = (id: string) => {
    setData(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.id === id ? { ...b, isClosed: true } : b)
    }));
  };

  const deleteBatch = (id: string) => setData(prev => ({ ...prev, batches: prev.batches.filter(b => b.id !== id), products: prev.products.filter(p => p.batchId !== id) }));

  const addExtraFee = (batchId: string, fee: ExtraFeeItem) => {
    setData(prev => ({ ...prev, batches: prev.batches.map(b => b.id === batchId ? { ...b, extraFees: [...b.extraFees, fee] } : b) }));
  };

  const removeExtraFee = (batchId: string, feeId: string) => {
    setData(prev => ({ ...prev, batches: prev.batches.map(b => b.id === batchId ? { ...b, extraFees: b.extraFees.filter(f => f.id !== feeId) } : b) }));
  };

  const addPayee = (name: string) => { if (!name || data.payees.includes(name)) return; setData(prev => ({ ...prev, payees: [...prev.payees, name] })); };
  const updatePayee = (oldName: string, newName: string) => setData(prev => ({ ...prev, payees: prev.payees.map(p => p === oldName ? newName : p), orders: prev.orders.map(o => o.payee === oldName ? { ...o, payee: newName } : o) }));
  const deletePayee = (name: string) => setData(prev => ({ ...prev, payees: prev.payees.filter(p => p !== name) }));
  const addCustomer = (c: Customer) => setData(prev => ({ ...prev, customers: [...prev.customers, c] }));

  const addOrder = (order: Order) => {
    setData(prev => {
      const updatedProducts = prev.products.map(p => {
        const item = order.items.find(i => i.productId === p.id);
        if (item) return { ...p, stockQty: p.stockQty - item.qty, stockWeight: p.stockWeight - item.netWeight };
        return p;
      });
      const debt = Math.max(0, order.totalAmount - order.discount - order.receivedAmount);
      const updatedCustomers = prev.customers.map(c => c.id === order.customerId ? { ...c, totalDebt: c.totalDebt + debt } : c);
      return { ...prev, products: updatedProducts, orders: [order, ...prev.orders], customers: updatedCustomers };
    });
  };

  const cancelOrder = (orderId: string) => {
    setData(prev => {
      const order = prev.orders.find(o => o.id === orderId);
      if (!order || order.status === OrderStatus.CANCELLED) return prev;

      const updatedProducts = prev.products.map(p => {
        const item = order.items.find(i => i.productId === p.id);
        if (item) return { ...p, stockQty: p.stockQty + item.qty, stockWeight: p.stockWeight + item.netWeight };
        return p;
      });

      const debt = Math.max(0, order.totalAmount - order.discount - order.receivedAmount);
      const updatedCustomers = prev.customers.map(c => c.id === order.customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - debt) } : c);
      const updatedOrders = prev.orders.map(o => o.id === orderId ? { ...o, status: OrderStatus.CANCELLED } : o);

      return { ...prev, products: updatedProducts, orders: updatedOrders, customers: updatedCustomers };
    });
  };

  const deleteOrder = (orderId: string) => {
    setData(prev => {
      const order = prev.orders.find(o => o.id === orderId);
      if (!order) return prev;

      let updatedProducts = prev.products;
      let updatedCustomers = prev.customers;

      if (order.status === OrderStatus.ACTIVE) {
         updatedProducts = prev.products.map(p => {
            const item = order.items.find(i => i.productId === p.id);
            if (item) return { ...p, stockQty: p.stockQty + item.qty, stockWeight: p.stockWeight + item.netWeight };
            return p;
         });
         const addedDebt = Math.max(0, order.totalAmount - order.discount - order.receivedAmount);
         if (addedDebt > 0) {
             updatedCustomers = prev.customers.map(c => 
                 c.id === order.customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - addedDebt) } : c
             );
         }
      }
      const updatedOrders = prev.orders.filter(o => o.id !== orderId);
      return { ...prev, products: updatedProducts, orders: updatedOrders, customers: updatedCustomers };
    });
  };

  const addRepayment = (r: Repayment) => {
    setData(prev => ({
      ...prev,
      repayments: [r, ...prev.repayments],
      customers: prev.customers.map(c => c.id === r.customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - r.amount) } : c)
    }));
  };

  const addExpense = (e: Expense) => {
    setData(prev => {
      let updatedBatches = prev.batches;
      if (e.batchId) {
        updatedBatches = prev.batches.map(b => 
          b.id === e.batchId ? { 
            ...b, 
            extraFees: [...b.extraFees, { id: e.id, name: e.type, amount: e.amount }] 
          } : b
        );
      }
      return { ...prev, expenses: [e, ...prev.expenses], batches: updatedBatches };
    });
  };

  const exportData = () => btoa(unescape(encodeURIComponent(JSON.stringify({ ...data, timestamp: Date.now(), type: 'FRUIT_SYNC' }))));
  
  const importData = (base64: string) => {
    try {
      const decoded = decodeURIComponent(escape(atob(base64)));
      const json = JSON.parse(decoded);
      
      if (!json || typeof json !== 'object') throw new Error('数据格式错误');
      
      // 使用相同的清洗逻辑
      const cleanData = sanitizeData(json);
      
      setData({ ...initialData, ...cleanData });
    } catch (e) { 
        console.error("Import failed:", e);
        throw new Error('导入失败：数据无效'); 
    }
  };

  return (
    <AppContext.Provider value={{ 
      data, addProduct, updateProduct, deleteProduct, adjustStock, addOrder, cancelOrder, deleteOrder, 
      addBatch, updateBatch, closeBatch, deleteBatch, addExtraFee, removeExtraFee, 
      addPayee, updatePayee, deletePayee, addCustomer, addRepayment, addExpense,
      importData, exportData 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
