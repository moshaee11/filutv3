
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Product, Order, Customer, Batch, PricingMode, PaymentMethod, ExtraFeeItem, Repayment, Expense, OrderStatus, ProductTemplate, PendingOrder, StockLog, OpLog } from './types';
import { preciseCalc, downloadJSON } from './utils';

interface AppContextType {
  data: AppData;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  uploadToCloud: () => Promise<void>;
  downloadFromCloud: () => Promise<void>;
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, newQty: number, newWeight: number, newInitialQty: number, newInitialWeight: number, reason?: string) => void;
  addOrder: (o: Order) => void;
  cancelOrder: (id: string) => void;
  deleteOrder: (id: string) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  addRepayment: (r: Repayment, skipAutoAllocate?: boolean) => void;
  updateRepayment: (id: string, updates: Partial<Repayment>) => void;
  deleteRepayment: (id: string) => void;
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
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  importData: (jsonStr: string) => void;
  exportData: () => string;
  addTemplate: (t: ProductTemplate) => void;
  deleteTemplate: (id: string) => void;
  addPendingOrder: (p: PendingOrder) => void;
  removePendingOrder: (id: string) => void;
  getLastPrice: (customerId: string, productId: string) => number | null;
  archiveOldData: (months: number) => void;
  addOpLog: (type: OpLog['type'], description: string, before?: any, after?: any) => void;
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
  pendingOrders: [],
  stockLogs: [],
  opLogs: [],
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

  return customers.map(c => {
    if (c.isGuest) return c;
    const calculatedDebt = Math.max(0, debtMap.get(c.id) || 0); 
    return { ...c, totalDebt: calculatedDebt };
  });
};

const allocateRepaymentToOrders = (orders: Order[], customerId: string, amount: number): Order[] => {
  const customerOrders = orders
    .filter(o => o.status === OrderStatus.ACTIVE && o.customerId === customerId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let remaining = amount;
  const updatedOrders = orders.map(o => {
    if (o.customerId !== customerId || o.status !== OrderStatus.ACTIVE) return o;
    if (remaining <= 0) return o;
    const debt = preciseCalc(() => o.totalAmount - o.discount - o.receivedAmount);
    if (debt <= 0) return o;
    const pay = Math.min(debt, remaining);
    remaining = preciseCalc(() => remaining - pay);
    return { ...o, receivedAmount: preciseCalc(() => o.receivedAmount + pay) };
  });

  return updatedOrders;
};

const rollbackRepaymentFromOrders = (orders: Order[], customerId: string, amount: number): Order[] => {
  const customerOrders = orders
    .filter(o => o.status === OrderStatus.ACTIVE && o.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let remaining = amount;
  const updatedOrders = orders.map(o => {
    if (o.customerId !== customerId || o.status !== OrderStatus.ACTIVE) return o;
    if (remaining <= 0) return o;
    if (o.receivedAmount <= 0) return o;
    const rollback = Math.min(o.receivedAmount, remaining);
    remaining = preciseCalc(() => remaining - rollback);
    return { ...o, receivedAmount: preciseCalc(() => o.receivedAmount - rollback) };
  });

  return updatedOrders;
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
  }));

  const cleanRepayments = safeArray<Repayment>(incoming.repayments, (r) => !!r.id).map((r: any) => ({
      ...r,
      paymentMethod: r.paymentMethod || PaymentMethod.CASH 
  }));

  let cleanCustomers = safeArray<Customer>(incoming.customers, (c) => !!c.id && !!c.name).map((c: any) => ({
      ...c,
      totalDebt: Number(c.totalDebt) || 0,
      wechat: c.wechat || '',
      address: c.address || '',
      note: c.note || '',
      createdAt: c.createdAt || ''
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
    stockLogs: safeArray<StockLog>(incoming.stockLogs, (l) => !!l.id && !!l.productId),
    opLogs: safeArray<OpLog>(incoming.opLogs, (l) => !!l.id && !!l.type),
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
      
      const originalOrderCount = Array.isArray(parsed.orders) ? parsed.orders.length : 0;
      const cleanOrderCount = cleanData.orders?.length || 0;
      
      if (originalOrderCount > 0 && cleanOrderCount === 0) {
        console.warn('Data sanitization removed all orders - backing up corrupted data');
        try {
          localStorage.setItem(CORRUPT_BACKUP_KEY, saved);
        } catch (e) {
          console.error('Failed to backup corrupted data', e);
        }
      }
      
      return { ...initialData, ...cleanData };
    } catch (e) {
      console.error("Failed to parse local storage", e);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          localStorage.setItem(CORRUPT_BACKUP_KEY, saved);
        }
      } catch (backupErr) {
        console.error("Failed to backup corrupted data", backupErr);
      }
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
    setData(prev => ({ 
      ...prev, 
      batches: prev.batches.map(b => b.id === batchId ? { ...b, extraFees: b.extraFees.filter(f => f.id !== feeId) } : b),
      expenses: prev.expenses.filter(e => e.id !== feeId)
    }));
  };

  const addPayee = (name: string) => { if (!name || data.payees.includes(name)) return; setData(prev => ({ ...prev, payees: [...prev.payees, name] })); };
  const updatePayee = (oldName: string, newName: string) => setData(prev => ({ ...prev, payees: prev.payees.map(p => p === oldName ? newName : p), orders: prev.orders.map(o => o.payee === oldName ? { ...o, payee: newName } : o) }));
  const deletePayee = (name: string) => setData(prev => ({ ...prev, payees: prev.payees.filter(p => p !== name) }));

  const addCustomer = (c: Customer) => setData(prev => ({ ...prev, customers: [...prev.customers, c] }));

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setData(prev => {
      const before = prev.customers.find(c => c.id === id);
      if (!before || before.isGuest) return prev;
      const newCustomers = prev.customers.map(c =>
        c.id === id ? { ...c, ...updates } : c
      );

      let opLog: OpLog | null = null;
      const changes: string[] = [];
      if (updates.name !== undefined && updates.name !== before.name) {
        changes.push(`姓名 ${before.name} → ${updates.name}`);
      }
      if (updates.phone !== undefined && updates.phone !== before.phone) {
        changes.push(`电话 ${before.phone || '空'} → ${updates.phone || '空'}`);
      }
      if (updates.wechat !== undefined && updates.wechat !== before.wechat) {
        changes.push(`微信 ${before.wechat || '空'} → ${updates.wechat || '空'}`);
      }
      if (updates.address !== undefined && updates.address !== before.address) {
        changes.push(`地址 ${before.address || '空'} → ${updates.address || '空'}`);
      }
      if (changes.length > 0) {
        opLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'CUSTOMER_EDIT',
          description: `修改客户（${before.name}）：${changes.join('，')}`,
          beforeSnapshot: before,
          afterSnapshot: updates,
          createdAt: new Date().toISOString()
        };
      }

      return {
        ...prev,
        customers: newCustomers,
        opLogs: opLog ? [opLog, ...prev.opLogs] : prev.opLogs
      };
    });
  };

  const deleteCustomer = (id: string) => {
    setData(prev => {
      const target = prev.customers.find(c => c.id === id);
      if (!target || target.isGuest) return prev;

      const opLog: OpLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'CUSTOMER_EDIT',
        description: `删除客户：${target.name}`,
        beforeSnapshot: target,
        createdAt: new Date().toISOString()
      };

      return {
        ...prev,
        customers: prev.customers.filter(c => c.id !== id),
        opLogs: [opLog, ...prev.opLogs]
      };
    });
  };

  const addOpLog = (type: OpLog['type'], description: string, before?: any, after?: any) => {
    setData(prev => {
      const opLog: OpLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        description,
        beforeSnapshot: before,
        afterSnapshot: after,
        createdAt: new Date().toISOString()
      };
      return { ...prev, opLogs: [opLog, ...prev.opLogs] };
    });
  };
  
  const addTemplate = (t: ProductTemplate) => setData(prev => ({ ...prev, templates: [...(prev.templates || []), t] }));
  const deleteTemplate = (id: string) => setData(prev => ({ ...prev, templates: (prev.templates || []).filter(t => t.id !== id) }));

  // --- 挂单 (Pending Orders) ---
  const addPendingOrder = (p: PendingOrder) => setData(prev => ({ ...prev, pendingOrders: [p, ...prev.pendingOrders] }));
  const removePendingOrder = (id: string) => setData(prev => ({ ...prev, pendingOrders: prev.pendingOrders.filter(p => p.id !== id) }));

  // --- 智能价格记忆 ---
  const getLastPrice = (customerId: string, productId: string) => {
      // 散客不记忆
      if (customerId === 'guest') return null;
      
      // 在历史订单中查找该客户买过该商品的最近记录
      const relevantOrders = data.orders.filter(o => 
          o.customerId === customerId && 
          o.status === OrderStatus.ACTIVE &&
          o.items.some(i => i.productId === productId)
      );

      if (relevantOrders.length === 0) return null;

      // 按时间倒序
      relevantOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const lastOrder = relevantOrders[0];
      const item = lastOrder.items.find(i => i.productId === productId);
      return item ? item.unitPrice : null;
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

  const addOrder = (o: Order) => {
    setData(prev => {
      // 1) 扣库存
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

      // 2) 生成库存流水（出库）
      const newStockLogs: StockLog[] = o.items
        .filter(i => i.qty > 0 || i.netWeight > 0)
        .map(i => {
          const prod = newProducts.find(p => p.id === i.productId);
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId: i.productId,
            productName: i.productName,
            type: 'OUTBOUND' as const,
            qtyChange: -i.qty,
            weightChange: -i.netWeight,
            qtyAfter: prod?.stockQty ?? 0,
            weightAfter: prod?.stockWeight ?? 0,
            reason: '开单出库',
            relatedOrderId: o.id,
            createdAt: new Date().toISOString()
          };
        });

      // 3) 重算客户欠款
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

      // 4) 操作日志
      const opLog: OpLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'ORDER_EDIT',
        description: `新增订单 ${o.orderNo}，客户：${o.customerName}，金额：¥${o.totalAmount - o.discount}`,
        afterSnapshot: { orderNo: o.orderNo, customer: o.customerName, total: o.totalAmount - o.discount },
        createdAt: new Date().toISOString()
      };

      return {
        ...prev,
        products: newProducts,
        customers: newCustomers,
        orders: [o, ...prev.orders],
        stockLogs: [...newStockLogs, ...prev.stockLogs],
        opLogs: [opLog, ...prev.opLogs]
      };
    });
  };

  const cancelOrder = (id: string) => {
    setData(prev => {
      const targetOrder = prev.orders.find(o => o.id === id);
      if (!targetOrder || targetOrder.status === OrderStatus.CANCELLED) return prev;

      // 1) 回退库存
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

      // 2) 库存流水（作废回退）
      const newStockLogs: StockLog[] = targetOrder.items
        .filter(i => i.qty > 0 || i.netWeight > 0)
        .map(i => {
          const prod = newProducts.find(p => p.id === i.productId);
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId: i.productId,
            productName: i.productName,
            type: 'CANCEL_RETURN' as const,
            qtyChange: i.qty,
            weightChange: i.netWeight,
            qtyAfter: prod?.stockQty ?? 0,
            weightAfter: prod?.stockWeight ?? 0,
            reason: '订单作废回退',
            relatedOrderId: targetOrder.id,
            createdAt: new Date().toISOString()
          };
        });

      // 3) 重算客户欠款
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

      // 4) 操作日志
      const opLog: OpLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'ORDER_CANCEL',
        description: `作废订单 ${targetOrder.orderNo}，客户：${targetOrder.customerName}，金额：¥${targetOrder.totalAmount - targetOrder.discount}`,
        beforeSnapshot: { orderNo: targetOrder.orderNo, customer: targetOrder.customerName, total: targetOrder.totalAmount - targetOrder.discount },
        createdAt: new Date().toISOString()
      };

      return {
        ...prev,
        products: newProducts,
        customers: newCustomers,
        orders: prev.orders.map(o => o.id === id ? { ...o, status: OrderStatus.CANCELLED, updatedAt: new Date().toISOString() } : o),
        stockLogs: [...newStockLogs, ...prev.stockLogs],
        opLogs: [opLog, ...prev.opLogs]
      };
    });
  };

  const deleteOrder = (id: string) => {
    setData(prev => {
        const targetOrder = prev.orders.find(o => o.id === id);
        if (!targetOrder) return prev;

        let newProducts = prev.products;
        let newCustomers = prev.customers;
        let newStockLogs: StockLog[] = [];

        if (targetOrder.status === OrderStatus.ACTIVE) {
            // 回退库存
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

            // 库存流水（删除回退）
            newStockLogs = targetOrder.items
              .filter(i => i.qty > 0 || i.netWeight > 0)
              .map(i => {
                const prod = newProducts.find(p => p.id === i.productId);
                return {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  productId: i.productId,
                  productName: i.productName,
                  type: 'CANCEL_RETURN' as const,
                  qtyChange: i.qty,
                  weightChange: i.netWeight,
                  qtyAfter: prod?.stockQty ?? 0,
                  weightAfter: prod?.stockWeight ?? 0,
                  reason: '订单删除回退',
                  relatedOrderId: targetOrder.id,
                  createdAt: new Date().toISOString()
                };
              });

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

        // 操作日志
        const opLog: OpLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'ORDER_DELETE',
          description: `删除订单 ${targetOrder.orderNo}，客户：${targetOrder.customerName}，金额：¥${targetOrder.totalAmount - targetOrder.discount}`,
          beforeSnapshot: { orderNo: targetOrder.orderNo, customer: targetOrder.customerName, total: targetOrder.totalAmount - targetOrder.discount },
          createdAt: new Date().toISOString()
        };

        return {
            ...prev,
            products: newProducts,
            customers: newCustomers,
            orders: prev.orders.filter(o => o.id !== id),
            stockLogs: [...newStockLogs, ...prev.stockLogs],
            opLogs: [opLog, ...prev.opLogs]
        };
    });
  };

  const updateOrder = (id: string, updates: Partial<Order>) => {
    setData(prev => {
      const before = prev.orders.find(o => o.id === id);
      if (!before) return prev;

      let newProducts = prev.products;
      let newStockLogs: StockLog[] = [];
      let finalUpdates = { ...updates };

      // 如果有 items 变更，处理库存调整
      if (updates.items !== undefined && before.status === OrderStatus.ACTIVE) {
        const oldItems = before.items;
        const newItems = updates.items;

        // 重新计算 totalAmount
        const newTotalAmount = newItems.reduce((sum, item) => 
          preciseCalc(() => sum + item.subtotal), 0
        );
        finalUpdates.totalAmount = newTotalAmount;

        // 收集所有涉及的 productId
        const allProductIds = new Set([
          ...oldItems.map(i => i.productId),
          ...newItems.map(i => i.productId)
        ]);

        const productDiffs: Array<{
          productId: string;
          productName: string;
          qtyDiff: number;
          weightDiff: number;
        }> = [];

        allProductIds.forEach(pid => {
          const oldItem = oldItems.find(i => i.productId === pid);
          const newItem = newItems.find(i => i.productId === pid);
          const oldQty = oldItem?.qty || 0;
          const newQty = newItem?.qty || 0;
          const oldWeight = oldItem?.netWeight || 0;
          const newWeight = newItem?.netWeight || 0;
          const qtyDiff = preciseCalc(() => newQty - oldQty);
          const weightDiff = preciseCalc(() => newWeight - oldWeight);
          if (qtyDiff !== 0 || weightDiff !== 0) {
            productDiffs.push({
              productId: pid,
              productName: newItem?.productName || oldItem?.productName || '',
              qtyDiff,
              weightDiff
            });
          }
        });

        // 更新库存
        newProducts = prev.products.map(p => {
          const diff = productDiffs.find(d => d.productId === p.id);
          if (!diff) return p;
          const newQty = preciseCalc(() => p.stockQty - diff.qtyDiff);
          const newWeight = preciseCalc(() => p.stockWeight - diff.weightDiff);
          return {
            ...p,
            stockQty: newQty,
            stockWeight: newWeight
          };
        });

        // 生成库存流水
        productDiffs.forEach(diff => {
          const prod = newProducts.find(p => p.id === diff.productId);
          if (diff.qtyDiff === 0 && diff.weightDiff === 0) return;
          const isIncrease = diff.qtyDiff < 0 || diff.weightDiff < 0;
          newStockLogs.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${diff.productId.slice(-4)}`,
            productId: diff.productId,
            productName: diff.productName,
            type: isIncrease ? 'RETURN' : 'OUTBOUND',
            qtyChange: -diff.qtyDiff,
            weightChange: -diff.weightDiff,
            qtyAfter: prod?.stockQty ?? 0,
            weightAfter: prod?.stockWeight ?? 0,
            reason: '订单编辑调整',
            relatedOrderId: id,
            createdAt: new Date().toISOString()
          });
        });
      }

      const newOrders = prev.orders.map(o =>
        o.id === id ? { ...o, ...finalUpdates, updatedAt: new Date().toISOString() } : o
      );
      const newCustomers = recalculateAllDebts(newOrders, prev.repayments, prev.customers);

      // 操作日志
      let opLog: OpLog | null = null;
      if (before) {
        const changes: string[] = [];
        if (finalUpdates.items !== undefined) {
          changes.push(`商品明细变更（${before.items.length}项 → ${finalUpdates.items.length}项）`);
        }
        if (finalUpdates.totalAmount !== undefined && finalUpdates.totalAmount !== before.totalAmount) {
          changes.push(`金额 ¥${before.totalAmount} → ¥${finalUpdates.totalAmount}`);
        }
        if (finalUpdates.discount !== undefined && finalUpdates.discount !== before.discount) {
          changes.push(`优惠 ¥${before.discount} → ¥${finalUpdates.discount}`);
        }
        if (finalUpdates.receivedAmount !== undefined && finalUpdates.receivedAmount !== before.receivedAmount) {
          changes.push(`实收 ¥${before.receivedAmount} → ¥${finalUpdates.receivedAmount}`);
        }
        if (finalUpdates.paymentMethod !== undefined && finalUpdates.paymentMethod !== before.paymentMethod) {
          changes.push(`支付方式 ${before.paymentMethod} → ${finalUpdates.paymentMethod}`);
        }
        if (finalUpdates.status !== undefined && finalUpdates.status !== before.status) {
          changes.push(`状态 ${before.status} → ${finalUpdates.status}`);
        }
        if (changes.length > 0) {
          opLog = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'ORDER_EDIT',
            description: `修改订单 ${before.orderNo}：${changes.join('，')}`,
            beforeSnapshot: before,
            afterSnapshot: finalUpdates,
            createdAt: new Date().toISOString()
          };
        }
      }

      return {
        ...prev,
        products: newProducts,
        orders: newOrders,
        customers: newCustomers,
        stockLogs: [...newStockLogs, ...prev.stockLogs],
        opLogs: opLog ? [opLog, ...prev.opLogs] : prev.opLogs
      };
    });
  };

  const addRepayment = (r: Repayment, skipAutoAllocate?: boolean) => {
    setData(prev => {
      const normalized: Repayment = {
        ...r,
        createdAt: r.createdAt || new Date().toISOString(),
      };
      
      let newOrders = prev.orders;
      if (!skipAutoAllocate && r.customerId && r.customerId !== 'guest') {
        newOrders = allocateRepaymentToOrders(prev.orders, r.customerId, r.amount);
      }
      
      const newRepayments = [normalized, ...prev.repayments];
      const newCustomers = recalculateAllDebts(newOrders, newRepayments, prev.customers);

      // 操作日志
      const opLog: OpLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'DEBT_CHANGE',
        description: `收款 ¥${r.amount}，客户：${r.customerName}，方式：${r.paymentMethod || '现金'}`,
        afterSnapshot: { customer: r.customerName, amount: r.amount, method: r.paymentMethod },
        createdAt: new Date().toISOString()
      };

      return {
        ...prev,
        orders: newOrders,
        customers: newCustomers,
        repayments: newRepayments,
        opLogs: [opLog, ...prev.opLogs]
      };
    });
  };

  const updateRepayment = (id: string, updates: Partial<Repayment>) => {
    setData(prev => {
      const before = prev.repayments.find(r => r.id === id);
      if (!before) return prev;

      let newOrders = prev.orders;
      
      if (before.customerId && before.customerId !== 'guest') {
        newOrders = rollbackRepaymentFromOrders(newOrders, before.customerId, before.amount);
      }

      const newRepayments = prev.repayments.map(r =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      );

      const updatedRepayment = newRepayments.find(r => r.id === id);
      if (updatedRepayment && updatedRepayment.customerId && updatedRepayment.customerId !== 'guest') {
        newOrders = allocateRepaymentToOrders(newOrders, updatedRepayment.customerId, updatedRepayment.amount);
      }

      const newCustomers = recalculateAllDebts(newOrders, newRepayments, prev.customers);

      // 操作日志
      let opLog: OpLog | null = null;
      if (before) {
        const changes: string[] = [];
        if (updates.amount !== undefined && updates.amount !== before.amount) {
          changes.push(`金额 ¥${before.amount} → ¥${updates.amount}`);
        }
        if (updates.payee !== undefined && updates.payee !== before.payee) {
          changes.push(`收款人 ${before.payee} → ${updates.payee}`);
        }
        opLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'REPAYMENT_EDIT',
          description: `修改还款记录（${before.customerName}）：${changes.join('，')}`,
          beforeSnapshot: before,
          afterSnapshot: updates,
          createdAt: new Date().toISOString()
        };
      }

      return {
        ...prev,
        orders: newOrders,
        repayments: newRepayments,
        customers: newCustomers,
        opLogs: opLog ? [opLog, ...prev.opLogs] : prev.opLogs
      };
    });
  };

  const deleteRepayment = (id: string) => {
    setData(prev => {
      const target = prev.repayments.find(r => r.id === id);
      if (!target) return prev;
      
      let newOrders = prev.orders;
      if (target.customerId && target.customerId !== 'guest') {
        newOrders = rollbackRepaymentFromOrders(newOrders, target.customerId, target.amount);
      }
      
      const newRepayments = prev.repayments.filter(r => r.id !== id);
      const newCustomers = recalculateAllDebts(newOrders, newRepayments, prev.customers);

      // 操作日志
      const opLog: OpLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'REPAYMENT_DELETE',
        description: `删除还款记录 ¥${target.amount}，客户：${target.customerName}`,
        beforeSnapshot: target,
        createdAt: new Date().toISOString()
      };

      return {
        ...prev,
        orders: newOrders,
        repayments: newRepayments,
        customers: newCustomers,
        opLogs: [opLog, ...prev.opLogs]
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

  const adjustStock = (productId: string, newQty: number, newWeight: number, newInitialQty: number, newInitialWeight: number, reason?: string) => {
    setData(prev => {
      const before = prev.products.find(p => p.id === productId);
      const newProducts = prev.products.map(p => 
        p.id === productId ? { 
            ...p, 
            stockQty: newQty, 
            stockWeight: newWeight,
            initialStockQty: newInitialQty,
            initialStockWeight: newInitialWeight
        } : p
      );

      // 库存流水
      let stockLog: StockLog | null = null;
      if (before) {
        const qtyDiff = newQty - before.stockQty;
        const weightDiff = newWeight - before.stockWeight;
        if (qtyDiff !== 0 || weightDiff !== 0) {
          stockLog = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId,
            productName: before.name,
            type: 'ADJUST' as const,
            qtyChange: qtyDiff,
            weightChange: weightDiff,
            qtyAfter: newQty,
            weightAfter: newWeight,
            reason: reason || '库存调整',
            createdAt: new Date().toISOString()
          };
        }
      }

      // 操作日志
      let opLog: OpLog | null = null;
      if (before) {
        opLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'STOCK_ADJUST',
          description: `调整库存（${before.name}）：数量 ${before.stockQty} → ${newQty}，重量 ${before.stockWeight} → ${newWeight}`,
          beforeSnapshot: { qty: before.stockQty, weight: before.stockWeight },
          afterSnapshot: { qty: newQty, weight: newWeight },
          createdAt: new Date().toISOString()
        };
      }

      return {
        ...prev,
        products: newProducts,
        stockLogs: stockLog ? [stockLog, ...prev.stockLogs] : prev.stockLogs,
        opLogs: opLog ? [opLog, ...prev.opLogs] : prev.opLogs
      };
    });
  };

  const importData = (base64Str: string) => {
    try {
      let jsonStr = '';
      try {
        jsonStr = decodeURIComponent(escape(atob(base64Str)));
      } catch (e) {
        jsonStr = base64Str;
      }
      const parsed = JSON.parse(jsonStr);
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
      addCustomer, updateCustomer, deleteCustomer,
      importData, exportData,
      addTemplate, deleteTemplate,
      addPendingOrder, removePendingOrder, getLastPrice, archiveOldData,
      addOpLog
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
