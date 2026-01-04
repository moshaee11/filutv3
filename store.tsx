
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

// 辅助函数：确保数据结构完整
const sanitizeData = (incoming: any): AppData => {
  return {
    products: Array.isArray(incoming.products) ? incoming.products : [],
    batches: Array.isArray(incoming.batches) ? incoming.batches : [],
    orders: Array.isArray(incoming.orders) ? incoming.orders : [],
    repayments: Array.isArray(incoming.repayments) ? incoming.repayments : [],
    customers: Array.isArray(incoming.customers) ? incoming.customers : initialData.customers,
    payees: Array.isArray(incoming.payees) ? incoming.payees : initialData.payees,
    expenses: Array.isArray(incoming.expenses) ? incoming.expenses : [],
  };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return initialData;
      
      const parsed = JSON.parse(saved);
      
      // 关键修复：如果本地数据缺失关键字段，视为损坏，自动修复
      if (!Array.isArray(parsed.orders) || !Array.isArray(parsed.products)) {
         console.warn("Detected corrupted data. Resetting to initial state. Backup saved.");
         localStorage.setItem(CORRUPT_BACKUP_KEY, saved); // 备份坏数据以防万一
         return initialData;
      }
      
      // 合并以确保字段完整
      return { ...initialData, ...sanitizeData(parsed) };
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
      // 1. 解码
      const decoded = decodeURIComponent(escape(atob(base64)));
      const json = JSON.parse(decoded);
      
      // 2. 严格校验：必须包含关键数组，否则视为无效数据
      if (!json || typeof json !== 'object') throw new Error('数据格式错误');
      if (json.type !== 'FRUIT_SYNC') throw new Error('数据类型不匹配');
      
      // 3. 检查核心字段是否存在，防止白屏
      if (!Array.isArray(json.orders)) throw new Error('缺失订单数据');
      if (!Array.isArray(json.products)) throw new Error('缺失商品数据');
      
      // 4. 安全合并 (Sanitize)
      const cleanData = sanitizeData(json);
      
      // 5. 更新状态
      setData({ ...initialData, ...cleanData });
      
    } catch (e) { 
        console.error("Import failed:", e);
        // 抛出错误让 UI 层捕获并提示用户
        throw new Error('导入失败：数据格式严重错误或不完整。'); 
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
