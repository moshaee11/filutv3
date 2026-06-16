
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Product, Order, Customer, Batch, PricingMode, PaymentMethod, ExtraFeeItem, Repayment, Expense, OrderStatus, ProductTemplate, PendingOrder } from './types';
import { preciseCalc, downloadJSON, getLastPriceForProduct } from './utils';

interface AppContextType {
  data: AppData;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  uploadToCloud: () => Promise<void>;
  downloadFromCloud: () => Promise<void>;
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, newQty: number, newWeight: number, newInitialQty: number, newInitialWeight: number) => void;
  addOrder: (o: Order) => void;
  cancelOrder: (id: string) => void;
  deleteOrder: (id: string) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  addRepayment: (r: Repayment) => void;
  updateRepayment: (id: string, updates: Partial<Repayment>) => void;
  deleteRepayment: (id: string) => void; // 新增：删除还款记录
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
  // Template Methods
  addTemplate: (t: ProductTemplate) => void;
  deleteTemplate: (id: string) => void;
  // Pending Orders & History
  addPendingOrder: (p: PendingOrder) => void;
  removePendingOrder: (id: string) => void;
  getLastPrice: (customerId: string, productId: string, productName?: string) => number | null;
  archiveOldData: (months: number) => void;
}

const STORAGE_KEY = 'FRUIT_PRO_DATA_V3';
const SERVER_URL_KEY = 'FRUIT_PRO_SERVER_URL';
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
  expenses: [],
  templates: [
    { id: 't1', name: '砂糖橘-大框', category: '柑橘', pricingMode: PricingMode.WEIGHT, defaultTare: 2.5, defaultPrice: 3.5, lowStockThreshold: 20, unitWeight: 40 },
    { id: 't2', name: '砂糖橘-精品', category: '柑橘', pricingMode: PricingMode.WEIGHT, defaultTare: 1.5, defaultPrice: 4.2, lowStockThreshold: 10, unitWeight: 20 },
  ],
  pendingOrders: []
};

// --- 辅助函数：全量重算客户欠款 ---
const recalculateAllDebts = (orders: Order[], repayments: Repayment[], customers: Customer[]): Customer[] => {
  const debtMap = new Map<string, number>();

  orders.forEach(o => {
    if (o.status === OrderStatus.ACTIVE && o.customerId && o.customerId !== 'guest') {
      const debt = preciseCalc(() => Math.max(0, o.totalAmount - o.discount - o.receivedAmount));
      if (debt > 0) {
        const current = debtMap.get(o.customerId) || 0;
        debtMap.set(o.customerId, preciseCalc(() => current + debt));
      }
    }
  });

  repayments.forEach(r => {
    if (r.customerId) {
      const current = debtMap.get(r.customerId) || 0;
      debtMap.set(r.customerId, preciseCalc(() => current - r.amount));
    }
  });

  return customers.map(c => {
    if (c.isGuest) return c;
    const calculatedDebt = Math.max(0, debtMap.get(c.id) || 0); 
    return { ...c, totalDebt: calculatedDebt };
  });
};

const sanitizeData = (incoming: any): AppData => {
  if (!incoming || typeof incoming !== 'object') return initialData;

  const safeArray = <T,>(arr: any, validator: (item: any) => boolean): T[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => item && typeof item === 'object' && validator(item));
  };

  const cleanOrders = safeArray<Order>(incoming.orders, (o) => !!o.id).map((o: any) => ({
      ...o,
      items: Array.isArray(o.items) ? o.items : [],
      totalAmount: Number(o.totalAmount) || 0,
      receivedAmount: Number(o.receivedAmount) || 0,
      discount: Number(o.discount) || 0,
      // 补充 v3 新增字段默认值，undefined = 从未被修改
      updatedAt: o.updatedAt || undefined,
      source: o.source || undefined,
  }));

  const cleanRepayments = safeArray<Repayment>(incoming.repayments, (r) => !!r.id).map((r: any) => ({
      ...r,
      paymentMethod: r.paymentMethod || PaymentMethod.CASH,
      createdAt: r.createdAt || r.date || undefined, // 老数据没有 createdAt，用 date 兜底
      updatedAt: r.updatedAt || undefined,
      source: r.source || undefined,
  }));

  let cleanCustomers = safeArray<Customer>(incoming.customers, (c) => !!c.id && !!c.name).map((c: any) => ({
      ...c,
      totalDebt: Number(c.totalDebt) || 0
  }));

  cleanCustomers = recalculateAllDebts(cleanOrders, cleanRepayments, cleanCustomers);

  return {
    products: safeArray<Product>(incoming.products, (p) => !!p.id && !!p.name).map((p: any) => ({
        ...p,
        stockQty: Number(p.stockQty) || 0,
        stockWeight: Number(p.stockWeight) || 0,
        initialStockQty: Number(p.initialStockQty) || Number(p.stockQty) || 0,
        initialStockWeight: Number(p.initialStockWeight) || Number(p.stockWeight) || 0,
        sellingPrice: Number(p.sellingPrice) || 0,
        defaultTare: Number(p.defaultTare) || 0,
        lowStockThreshold: Number(p.lowStockThreshold) || 20
    })),
    batches: safeArray<Batch>(incoming.batches, (b) => !!b.id && !!b.plateNumber).map((b: any) => ({
        ...b,
        extraFees: Array.isArray(b.extraFees) ? b.extraFees : [], 
        cost: Number(b.cost) || 0,
        totalWeight: Number(b.totalWeight) || 0,
    })),
    orders: cleanOrders,
    repayments: cleanRepayments,
    customers: cleanCustomers,
    payees: Array.isArray(incoming.payees) ? incoming.payees.filter((p: any) => typeof p === 'string' && p.trim() !== '') : initialData.payees,
    expenses: safeArray<Expense>(incoming.expenses, (e) => !!e.id),
    templates: safeArray<ProductTemplate>(incoming.templates, (t) => !!t.id && !!t.name),
    pendingOrders: safeArray<PendingOrder>(incoming.pendingOrders, (p) => !!p.id && !!p.items),
  };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverUrl, setServerUrlState] = useState(localStorage.getItem(SERVER_URL_KEY) || '');
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return initialData;
      const parsed = JSON.parse(saved);
      const cleanData = sanitizeData(parsed);
      return { ...initialData, ...cleanData };
    } catch (e) {
      console.error("Failed to parse local storage", e);
      return initialData;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const setServerUrl = (url: string) => {
    const cleanUrl = url.replace(/\/+$/, '');
    setServerUrlState(cleanUrl);
    localStorage.setItem(SERVER_URL_KEY, cleanUrl);
  };

  const uploadToCloud = async () => { /* ... existing code ... */ };
  const downloadFromCloud = async () => { /* ... existing code ... */ };

  const addProduct = (p: Product) => setData(prev => ({ ...prev, products: [...prev.products, p] }));
  const updateProduct = (p: Product) => setData(prev => ({ ...prev, products: prev.products.map(old => old.id === p.id ? p : old) }));
  const deleteProduct = (id: string) => setData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
  
  const adjustStock = (productId: string, newQty: number, newWeight: number, newInitialQty: number, newInitialWeight: number) => {
    setData(prev => ({
      ...prev,
      products: prev.products.map(p => 
        p.id === productId ? { 
            ...p, 
            stockQty: newQty, 
            stockWeight: newWeight,
            initialStockQty: newInitialQty,
            initialStockWeight: newInitialWeight
        } : p
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

  const deleteBatch = (id: string) => setData(prev => ({ 
    ...prev, 
    batches: prev.batches.filter(b => b.id !== id), 
    products: prev.products.filter(p => p.batchId !== id),
    expenses: prev.expenses.filter(e => e.batchId !== id)
  }));

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
  
  const addTemplate = (t: ProductTemplate) => setData(prev => ({ ...prev, templates: [...(prev.templates || []), t] }));
  const deleteTemplate = (id: string) => setData(prev => ({ ...prev, templates: (prev.templates || []).filter(t => t.id !== id) }));

  // --- 挂单 (Pending Orders) ---
  const addPendingOrder = (p: PendingOrder) => setData(prev => ({ ...prev, pendingOrders: [p, ...prev.pendingOrders] }));
  const removePendingOrder = (id: string) => setData(prev => ({ ...prev, pendingOrders: prev.pendingOrders.filter(p => p.id !== id) }));

  // --- 智能价格记忆（用 utils 的缓存实现，避免每次全扫） ---
  const getLastPrice = (customerId: string, _productId: string, productName?: string) => {
      if (!productName) return null;
      if (customerId === 'guest') return null;
      return getLastPriceForProduct(customerId, productName, data.orders);
  };

  // --- 数据归档 ---
  const archiveOldData = (months: number) => {
      const now = new Date();
      // 计算截止日期
      const cutoffDate = new Date(now.setMonth(now.getMonth() - months));
      const cutoffTime = cutoffDate.getTime();

      // 筛选需要归档的数据
      const oldOrders = data.orders.filter(o => new Date(o.createdAt).getTime() < cutoffTime);
      const oldRepayments = data.repayments.filter(r => new Date(r.date).getTime() < cutoffTime);
      const oldExpenses = data.expenses.filter(e => new Date(e.date).getTime() < cutoffTime);

      if (oldOrders.length === 0 && oldRepayments.length === 0 && oldExpenses.length === 0) {
          alert('没有符合条件的历史数据需要归档。');
          return;
      }

      // 生成归档包
      const archivePayload = {
          archivedAt: new Date().toISOString(),
          range: `Before ${cutoffDate.toLocaleDateString()}`,
          orders: oldOrders,
          repayments: oldRepayments,
          expenses: oldExpenses
      };

      // 下载文件
      downloadJSON(archivePayload, `归档数据_${cutoffDate.toISOString().split('T')[0]}前.json`);

      // 从主数据中移除
      setData(prev => ({
          ...prev,
          orders: prev.orders.filter(o => new Date(o.createdAt).getTime() >= cutoffTime),
          repayments: prev.repayments.filter(r => new Date(r.date).getTime() >= cutoffTime),
          expenses: prev.expenses.filter(e => new Date(e.date).getTime() >= cutoffTime)
      }));

      alert(`✅ 归档成功！\n已将 ${cutoffDate.toLocaleDateString()} 之前的数据导出并清理。\n请妥善保管下载的文件。`);
  };

  // --- 辅助：从最新 orders+repayments 全量重算 customers.totalDebt ---
  // （所有写订单/还款的路径统一调用，避免累计漂移）
  const rebuildCustomersFromState = (orders: Order[], repayments: Repayment[], customers: Customer[]): Customer[] => {
    return recalculateAllDebts(orders, repayments, customers);
  };

  const addOrder = (o: Order) => {
    setData(prev => {
      const newProducts = prev.products.map(p => {
        const item = o.items.find(i => i.productId === p.id);
        if (item) {
          return {
            ...p,
            stockQty: p.stockQty - item.qty,
            stockWeight: p.stockWeight - item.netWeight
          };
        }
        return p;
      });

      const newOrders = [o, ...prev.orders];
      const newCustomers = rebuildCustomersFromState(newOrders, prev.repayments, prev.customers);

      return {
        ...prev,
        products: newProducts,
        customers: newCustomers,
        orders: newOrders
      };
    });
  };

  const cancelOrder = (id: string) => {
    setData(prev => {
      const targetOrder = prev.orders.find(o => o.id === id);
      if (!targetOrder || targetOrder.status === OrderStatus.CANCELLED) return prev;

      // 库存回退（软删除 = 把商品加回来）
      const newProducts = prev.products.map(p => {
        const item = targetOrder.items.find(i => i.productId === p.id);
        if (item) {
          return {
            ...p,
            stockQty: p.stockQty + item.qty,
            stockWeight: p.stockWeight + item.netWeight
          };
        }
        return p;
      });

      const newOrders = prev.orders.map(o =>
        o.id === id ? { ...o, status: OrderStatus.CANCELLED, updatedAt: new Date().toISOString() } : o
      );
      const newCustomers = rebuildCustomersFromState(newOrders, prev.repayments, prev.customers);

      return {
        ...prev,
        products: newProducts,
        customers: newCustomers,
        orders: newOrders
      };
    });
  };

  const deleteOrder = (id: string) => {
    setData(prev => {
      const targetOrder = prev.orders.find(o => o.id === id);
      if (!targetOrder) return prev;

      // 仅 ACTIVE 订单回退库存（CANCELLED 已经回退过一次，不可重复）
      let newProducts = prev.products;
      if (targetOrder.status === OrderStatus.ACTIVE) {
        newProducts = prev.products.map(p => {
          const item = targetOrder.items.find(i => i.productId === p.id);
          if (item) {
            return {
              ...p,
              stockQty: p.stockQty + item.qty,
              stockWeight: p.stockWeight + item.netWeight
            };
          }
          return p;
        });
      }

      const newOrders = prev.orders.filter(o => o.id !== id);
      const newCustomers = rebuildCustomersFromState(newOrders, prev.repayments, prev.customers);

      return {
        ...prev,
        products: newProducts,
        customers: newCustomers,
        orders: newOrders
      };
    });
  };

  const updateOrder = (id: string, updates: Partial<Order>) => {
    setData(prev => {
      const newOrders = prev.orders.map(o =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
      );
      const newCustomers = rebuildCustomersFromState(newOrders, prev.repayments, prev.customers);
      return {
        ...prev,
        orders: newOrders,
        customers: newCustomers
      };
    });
  };

  const addRepayment = (r: Repayment) => {
    setData(prev => {
      // 自动补充 createdAt（若无）
      const normalized: Repayment = {
        ...r,
        createdAt: r.createdAt || new Date().toISOString(),
      };
      const newRepayments = [normalized, ...prev.repayments];
      const newCustomers = rebuildCustomersFromState(prev.orders, newRepayments, prev.customers);
      return {
        ...prev,
        customers: newCustomers,
        repayments: newRepayments
      };
    });
  };

  const updateRepayment = (id: string, updates: Partial<Repayment>) => {
    setData(prev => {
      const newRepayments = prev.repayments.map(r =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      );
      const newCustomers = rebuildCustomersFromState(prev.orders, newRepayments, prev.customers);
      return {
        ...prev,
        repayments: newRepayments,
        customers: newCustomers
      };
    });
  };

  // 新增：删除还款记录（物理删除 + 全量重算欠款）
  const deleteRepayment = (id: string) => {
    setData(prev => {
      const target = prev.repayments.find(r => r.id === id);
      if (!target) return prev;
      const newRepayments = prev.repayments.filter(r => r.id !== id);
      const newCustomers = rebuildCustomersFromState(prev.orders, newRepayments, prev.customers);
      return {
        ...prev,
        repayments: newRepayments,
        customers: newCustomers
      };
    });
  };

  const addExpense = (e: Expense) => setData(prev => {
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

  const importData = (jsonStrOrBase64: string) => {
    try {
      let jsonStr = jsonStrOrBase64.trim();

      // 1) 首先尝试把输入当成原始 JSON 解析（MeView 传的是纯文本）
      let parsed: any = null;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (_) {
        // 2) 不是合法 JSON → 尝试 base64 → 解码 → 再 JSON.parse
        try {
          const decoded = decodeURIComponent(escape(atob(jsonStr)));
          parsed = JSON.parse(decoded);
        } catch (__) {
          throw new Error('无法解析数据文件');
        }
      }

      const clean = sanitizeData(parsed);
      setData(prev => ({ ...initialData, ...clean }));
      alert('数据导入成功！\n客户欠款已根据历史订单自动校准。');
    } catch (e) {
      console.error("Import failed", e);
      alert("导入失败：数据格式错误");
    }
  };

  const exportData = () => {
    const jsonStr = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(jsonStr)));
  };

  return (
    <AppContext.Provider value={{
      data, serverUrl, setServerUrl, uploadToCloud, downloadFromCloud,
      addProduct, updateProduct, deleteProduct, adjustStock,
      addBatch, updateBatch, closeBatch, deleteBatch,
      addExtraFee, removeExtraFee,
      addOrder, cancelOrder, deleteOrder, updateOrder,
      addRepayment, updateRepayment, deleteRepayment, addExpense,
      addPayee, updatePayee, deletePayee,
      addCustomer, 
      importData, exportData,
      addTemplate, deleteTemplate,
      addPendingOrder, removePendingOrder, getLastPrice, archiveOldData
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
