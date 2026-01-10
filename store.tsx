
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Product, Order, Customer, Batch, PricingMode, PaymentMethod, ExtraFeeItem, Repayment, Expense, OrderStatus } from './types';
import { preciseCalc } from './utils';

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
  expenses: []
};

// --- 辅助函数：全量重算客户欠款 ---
// 解决导入旧数据或数据不一致时，客户欠款显示不正确的问题
const recalculateAllDebts = (orders: Order[], repayments: Repayment[], customers: Customer[]): Customer[] => {
  const debtMap = new Map<string, number>();

  // 1. 累加所有有效订单的欠款
  orders.forEach(o => {
    if (o.status === OrderStatus.ACTIVE && o.customerId && o.customerId !== 'guest') {
      // 优化：使用高精度计算，并移除 30 元门槛，确保所有欠款都被记录
      const debt = preciseCalc(() => Math.max(0, o.totalAmount - o.discount - o.receivedAmount));
      
      if (debt > 0) {
        const current = debtMap.get(o.customerId) || 0;
        debtMap.set(o.customerId, preciseCalc(() => current + debt));
      }
    }
  });

  // 2. 减去所有还款记录
  repayments.forEach(r => {
    if (r.customerId) {
      const current = debtMap.get(r.customerId) || 0;
      // 注意：这里可能会减成负数（如果数据有问题），后续会修正为0
      debtMap.set(r.customerId, preciseCalc(() => current - r.amount));
    }
  });

  // 3. 更新客户列表
  return customers.map(c => {
    if (c.isGuest) return c;
    const calculatedDebt = Math.max(0, debtMap.get(c.id) || 0); // 确保不小于0
    return { ...c, totalDebt: calculatedDebt };
  });
};

// --- 核心修复：数据深度清洗 (修复白屏问题 + 重算欠款 + 补全初始库存) ---
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
  }));

  const cleanRepayments = safeArray<Repayment>(incoming.repayments, (r) => !!r.id).map((r: any) => ({
      ...r,
      paymentMethod: r.paymentMethod || PaymentMethod.CASH // 兼容旧数据
  }));

  let cleanCustomers = safeArray<Customer>(incoming.customers, (c) => !!c.id && !!c.name).map((c: any) => ({
      ...c,
      totalDebt: Number(c.totalDebt) || 0
  }));

  // 关键步骤：根据清洗后的订单和还款，强制重算欠款
  cleanCustomers = recalculateAllDebts(cleanOrders, cleanRepayments, cleanCustomers);

  return {
    products: safeArray<Product>(incoming.products, (p) => !!p.id && !!p.name).map((p: any) => ({
        ...p,
        stockQty: Number(p.stockQty) || 0,
        stockWeight: Number(p.stockWeight) || 0,
        // 兼容旧数据：如果没有初始库存，默认等于当前库存
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
      if (parsed.orders?.length > 0 && cleanData.orders.length === 0) {
          console.warn("Data sanitization removed orders. Backup created.");
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

  const setServerUrl = (url: string) => {
    const cleanUrl = url.replace(/\/+$/, '');
    setServerUrlState(cleanUrl);
    localStorage.setItem(SERVER_URL_KEY, cleanUrl);
  };

  const uploadToCloud = async () => {
    if (!serverUrl) throw new Error('请先配置服务器地址');
    const payload = { ...data, timestamp: Date.now(), type: 'FRUIT_SYNC' };
    
    try {
      const res = await fetch(`${serverUrl}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`上传失败: ${res.statusText}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.message || '未知错误');
    } catch (e: any) {
      console.error(e);
      throw new Error('连接服务器失败，请检查网络或地址。\n' + e.message);
    }
  };

  const downloadFromCloud = async () => {
    if (!serverUrl) throw new Error('请先配置服务器地址');
    try {
      const res = await fetch(`${serverUrl}/api/backup`);
      if (!res.ok) throw new Error(`下载失败: ${res.statusText}`);
      const json = await res.json();
      
      if (!json || !json.data) throw new Error('服务器返回数据为空');
      
      const contentStr = JSON.stringify(json.data);
      const base64 = btoa(unescape(encodeURIComponent(contentStr)));
      importData(base64);
    } catch (e: any) {
      console.error(e);
      throw new Error('同步失败：' + e.message);
    }
  };

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

  // --- 订单管理 ---
  const addOrder = (o: Order) => {
    setData(prev => {
      // 1. 更新库存
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

      // 2. 更新客户欠款 (优化：高精度计算 + 移除 30 元门槛)
      const debtAmount = preciseCalc(() => Math.max(0, o.totalAmount - o.discount - o.receivedAmount));
      let newCustomers = prev.customers;
      
      const shouldTrackDebt = debtAmount > 0 && o.customerId !== 'guest';

      if (shouldTrackDebt) {
        newCustomers = prev.customers.map(c => 
          c.id === o.customerId 
            ? { ...c, totalDebt: preciseCalc(() => c.totalDebt + debtAmount) } 
            : c
        );
      }

      return {
        ...prev,
        products: newProducts,
        customers: newCustomers,
        orders: [o, ...prev.orders]
      };
    });
  };

  const cancelOrder = (id: string) => {
    setData(prev => {
      const targetOrder = prev.orders.find(o => o.id === id);
      if (!targetOrder || targetOrder.status === OrderStatus.CANCELLED) return prev;

      // 1. 回滚库存
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

      // 2. 回滚客户欠款
      const debtAmount = preciseCalc(() => Math.max(0, targetOrder.totalAmount - targetOrder.discount - targetOrder.receivedAmount));
      let newCustomers = prev.customers;
      
      const shouldRevertDebt = debtAmount > 0 && targetOrder.customerId !== 'guest';
      
      if (shouldRevertDebt) {
        newCustomers = prev.customers.map(c => 
          c.id === targetOrder.customerId 
            ? { ...c, totalDebt: Math.max(0, preciseCalc(() => c.totalDebt - debtAmount)) } 
            : c
        );
      }

      return {
        ...prev,
        products: newProducts,
        customers: newCustomers,
        orders: prev.orders.map(o => o.id === id ? { ...o, status: OrderStatus.CANCELLED } : o)
      };
    });
  };

  const deleteOrder = (id: string) => {
    setData(prev => {
        const targetOrder = prev.orders.find(o => o.id === id);
        if (!targetOrder) return prev;

        let newProducts = prev.products;
        let newCustomers = prev.customers;

        // 如果订单是有效状态，删除时需要回滚库存和欠款
        if (targetOrder.status === OrderStatus.ACTIVE) {
            // 回滚库存
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

            // 回滚欠款
            const debtAmount = preciseCalc(() => Math.max(0, targetOrder.totalAmount - targetOrder.discount - targetOrder.receivedAmount));
            const shouldRevertDebt = debtAmount > 0 && targetOrder.customerId !== 'guest';

            if (shouldRevertDebt) {
                newCustomers = prev.customers.map(c => 
                    c.id === targetOrder.customerId 
                        ? { ...c, totalDebt: Math.max(0, preciseCalc(() => c.totalDebt - debtAmount)) } 
                        : c
                );
            }
        }

        return {
            ...prev,
            products: newProducts,
            customers: newCustomers,
            orders: prev.orders.filter(o => o.id !== id)
        };
    });
  };

  // --- 财务管理 ---
  const addRepayment = (r: Repayment) => {
    setData(prev => {
      // 更新客户欠款
      const newCustomers = prev.customers.map(c => 
        c.id === r.customerId 
          ? { ...c, totalDebt: Math.max(0, preciseCalc(() => c.totalDebt - r.amount)) } 
          : c
      );
      return {
        ...prev,
        customers: newCustomers,
        repayments: [r, ...prev.repayments]
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

  // --- 数据导入导出 ---
  const importData = (base64Str: string) => {
    try {
      let jsonStr = '';
      try {
        jsonStr = decodeURIComponent(escape(atob(base64Str)));
      } catch (e) {
        jsonStr = base64Str;
      }
      
      const parsed = JSON.parse(jsonStr);
      // 调用增强版的数据清洗（含重算欠款）
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
      addOrder, cancelOrder, deleteOrder,
      addRepayment, addExpense,
      addPayee, updatePayee, deletePayee,
      addCustomer, 
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
