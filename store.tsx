
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Product, Order, Customer, Batch, PricingMode, PaymentMethod, ExtraFeeItem, Repayment, Expense, OrderStatus } from './types';

interface AppContextType {
  data: AppData;
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, newQty: number, newWeight: number) => void; // 新增方法
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialData;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const addProduct = (p: Product) => setData(prev => ({ ...prev, products: [...prev.products, p] }));
  const updateProduct = (p: Product) => setData(prev => ({ ...prev, products: prev.products.map(old => old.id === p.id ? p : old) }));
  const deleteProduct = (id: string) => setData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
  
  // 新增：库存修正逻辑
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
      // 修正逻辑：欠款 = 总额(含杂费) - 优惠 - 实收
      const debt = Math.max(0, order.totalAmount - order.discount - order.receivedAmount);
      const updatedCustomers = prev.customers.map(c => c.id === order.customerId ? { ...c, totalDebt: c.totalDebt + debt } : c);
      return { ...prev, products: updatedProducts, orders: [order, ...prev.orders], customers: updatedCustomers };
    });
  };

  const cancelOrder = (orderId: string) => {
    setData(prev => {
      const order = prev.orders.find(o => o.id === orderId);
      if (!order || order.status === OrderStatus.CANCELLED) return prev;

      // 1. 回退产品库存
      const updatedProducts = prev.products.map(p => {
        const item = order.items.find(i => i.productId === p.id);
        if (item) return { ...p, stockQty: p.stockQty + item.qty, stockWeight: p.stockWeight + item.netWeight };
        return p;
      });

      // 2. 减去客户欠款 (对应 addOrder 中的增加逻辑)
      const debt = Math.max(0, order.totalAmount - order.discount - order.receivedAmount);
      const updatedCustomers = prev.customers.map(c => c.id === order.customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - debt) } : c);

      // 3. 更新单据状态为 CANCELLED
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

      // 如果订单是有效的（未作废），则需要回退数据
      if (order.status === OrderStatus.ACTIVE) {
         // 1. 回退库存
         updatedProducts = prev.products.map(p => {
            const item = order.items.find(i => i.productId === p.id);
            if (item) {
                return { 
                    ...p, 
                    stockQty: p.stockQty + item.qty, 
                    stockWeight: p.stockWeight + item.netWeight 
                };
            }
            return p;
         });

         // 2. 回退欠款 (如果有)
         // 计算产生的欠款金额
         const addedDebt = Math.max(0, order.totalAmount - order.discount - order.receivedAmount);
         if (addedDebt > 0) {
             updatedCustomers = prev.customers.map(c => 
                 c.id === order.customerId 
                     ? { ...c, totalDebt: Math.max(0, c.totalDebt - addedDebt) } 
                     : c
             );
         }
      }

      // 3. 彻底删除订单
      const updatedOrders = prev.orders.filter(o => o.id !== orderId);

      return { 
        ...prev, 
        products: updatedProducts, 
        orders: updatedOrders, 
        customers: updatedCustomers 
      };
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
      const json = JSON.parse(decodeURIComponent(escape(atob(base64))));
      if (json.type !== 'FRUIT_SYNC') throw new Error('Invalid format');
      setData(json);
    } catch (e) { alert('导入失败'); }
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
