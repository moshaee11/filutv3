
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { getCustomerDebtAge, preciseCalc } from '../utils';
import { 
  Wallet, Send, Share2, Receipt, ArrowUpCircle, 
  ArrowDownCircle, X, Plus, CheckCircle2,
  Truck, Store, AlertTriangle, ShieldAlert, ClipboardPaste, ArrowRight, Copy, Share, User, Banknote,
  Clock, TrendingUp, BarChart3, AlertOctagon, DollarSign
} from 'lucide-react';
import { OrderStatus, PaymentMethod, Customer } from '../types';

const HomeView: React.FC<{ onStartBilling: () => void; onGoToReconcile: () => void }> = ({ onStartBilling, onGoToReconcile }) => {
  const { data, importData } = useApp();
  const [activeModal, setActiveModal] = useState<'repayment' | 'expense' | null>(null);
  
  // Backup Alert State
  const [showBackupAlert, setShowBackupAlert] = useState(false);
  const [needsBackup, setNeedsBackup] = useState(false);

  // Sync/Import State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncContent, setSyncContent] = useState('');

  const isEmptyData = data.orders.length === 0 && data.products.length === 0 && data.batches.length === 0;

  useEffect(() => {
    const checkBackupStatus = () => {
        if (isEmptyData) return;

        const lastBackupStr = localStorage.getItem('LAST_BACKUP_TIME');
        const now = new Date();
        const todayStr = now.toDateString(); 

        let isNeeded = false;

        if (!lastBackupStr) {
            isNeeded = true;
        } else {
            const lastBackupDate = new Date(lastBackupStr).toDateString();
            if (lastBackupDate !== todayStr) {
                isNeeded = true;
            }
        }
        
        setNeedsBackup(isNeeded);

        if (isNeeded) {
            const lastPromptDate = localStorage.getItem('HOME_BACKUP_PROMPT_DATE');
            const todayPromptKey = now.toISOString().split('T')[0];

            if (lastPromptDate !== todayPromptKey) {
                setShowBackupAlert(true);
                localStorage.setItem('HOME_BACKUP_PROMPT_DATE', todayPromptKey);
            }
        }
    };
    checkBackupStatus();
  }, [isEmptyData]);

  const totalDebtAmount = useMemo(() => 
    data.customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0)
  , [data.customers]);

  const overdueCustomers = useMemo(() => {
    const result: { customer: Customer; debtAge: number }[] = [];
    data.customers.forEach(c => {
      if (c.isGuest || c.totalDebt <= 0) return;
      const debtAge = getCustomerDebtAge(c.id, data.orders);
      if (debtAge > 15) {
        result.push({ customer: c, debtAge });
      }
    });
    result.sort((a, b) => b.debtAge - a.debtAge);
    return result;
  }, [data.customers, data.orders]);

  const totalOverdueAmount = useMemo(() => 
    overdueCustomers.reduce((sum, item) => sum + item.customer.totalDebt, 0)
  , [overdueCustomers]);

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();

    const todayOrders = data.orders.filter(o => 
      o.status === OrderStatus.ACTIVE && new Date(o.createdAt).getTime() >= startOfToday
    );
    const todayRepayments = data.repayments.filter(r => 
      new Date(r.date).getTime() >= startOfToday
    );

    const todaySales = todayOrders.reduce((sum, o) => sum + (o.totalAmount - o.discount), 0);
    const todayRepayment = todayRepayments.reduce((sum, r) => sum + r.amount, 0);
    const todayNewDebt = todayOrders.reduce((sum, o) => 
      sum + Math.max(0, (o.totalAmount - o.discount) - o.receivedAmount), 0
    );
    const todayDebtIncrease = todayNewDebt - todayRepayment;

    const lowStockCount = data.products.filter(p => {
      const threshold = p.lowStockThreshold ?? 20;
      return p.stockQty < threshold;
    }).length;

    const productSalesMap = new Map<string, { name: string; qty: number; amount: number }>();
    const last7DaysOrders = data.orders.filter(o => 
      o.status === OrderStatus.ACTIVE && new Date(o.createdAt).getTime() >= sevenDaysAgo
    );
    last7DaysOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productSalesMap.get(item.productId);
        if (existing) {
          existing.qty += item.qty;
          existing.amount += item.subtotal;
        } else {
          productSalesMap.set(item.productId, {
            name: item.productName,
            qty: item.qty,
            amount: item.subtotal
          });
        }
      });
    });

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const topDebtCustomers = data.customers
      .filter(c => !c.isGuest && c.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 5);

    return {
      todaySales,
      todayRepayment,
      todayDebtIncrease,
      lowStockCount,
      topProducts,
      topDebtCustomers
    };
  }, [data]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0,0,0,0)).getTime();
    
    // 1. 今日有效订单
    const orders = data.orders.filter(o => o.status === OrderStatus.ACTIVE && new Date(o.createdAt).getTime() >= startOfToday);
    
    // 2. 今日还款记录
    const repayments = data.repayments.filter(r => new Date(r.date).getTime() >= startOfToday);
    
    // 3. 计算逻辑优化
    // 今日营收 (只看新单成交)
    const orderAmount = orders.reduce((sum, o) => sum + (o.totalAmount - o.discount), 0);
    
    // 订单实收
    const orderReceived = orders.reduce((sum, o) => sum + o.receivedAmount, 0);
    
    // 还款实收
    const repaymentReceived = repayments.reduce((sum, r) => sum + r.amount, 0);
    
    // 今日总入账 (现金流) = 订单实收 + 还款实收
    const totalReceived = orderReceived + repaymentReceived;
    
    // 欠款增加量 = 实际成交价 - 订单实收
    const debtAmount = orderAmount - orderReceived;
    
    const activeBatches = data.batches.filter(b => !b.isClosed).length;
    
    return { orderAmount, totalReceived, repaymentReceived, debtAmount, activeBatches };
  }, [data]);

  const handleSyncImport = () => {
      if (!syncContent) return;
      try {
        const base64 = btoa(unescape(encodeURIComponent(syncContent)));
        importData(base64);
        alert('✅ 数据同步成功！');
        setShowSyncModal(false);
        setSyncContent('');
      } catch (e) {
        alert('❌ 格式错误：请确保复制了完整的数据文本');
      }
  };

  // 纯净版备份：仅复制
  const handleSmartBackup = async () => {
    const backupData = { ...data, timestamp: Date.now(), type: 'FRUIT_SYNC' };
    const nowStr = new Date().toLocaleString();
    const jsonStr = JSON.stringify(backupData);

    try {
        await navigator.clipboard.writeText(jsonStr);
        localStorage.setItem('LAST_BACKUP_TIME', nowStr);
        setNeedsBackup(false);
        setShowBackupAlert(false);
        alert('✅ 数据已复制！\n\n请立即去微信群 -> 粘贴 -> 发送。\n完成今日数据存档。');
    } catch (err) {
        // 兼容性回退
        const textarea = document.createElement('textarea');
        textarea.value = jsonStr;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            localStorage.setItem('LAST_BACKUP_TIME', nowStr);
            setNeedsBackup(false);
            setShowBackupAlert(false);
            alert('✅ 数据已复制！\n\n请立即去微信群 -> 粘贴 -> 发送。');
        } catch (e) {
            alert('❌ 自动备份失败，请前往“我的”页面手动导出。');
        }
        document.body.removeChild(textarea);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-32">
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-6 pt-12 text-white rounded-b-[2.5rem] shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">砂糖橘批发助手 Pro</h2>
            {needsBackup && !isEmptyData && (
                <div onClick={() => setShowBackupAlert(true)} className="inline-flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded-md mt-1 shadow-sm animate-pulse cursor-pointer">
                    <AlertTriangle size={10} className="text-white" fill="currentColor" />
                    <span className="text-[10px] font-black text-white">今日未备份，点击备份</span>
                </div>
            )}
          </div>
          <button className="bg-white/10 p-2 rounded-full active:scale-95"><Share2 size={20} /></button>
        </div>
        <div className="flex justify-between items-end">
          <div className="space-y-0.5"><p className="text-5xl font-black tracking-tighter">{totalDebtAmount.toLocaleString()}</p><p className="text-[10px] text-white/70 font-black uppercase tracking-widest">全店累计待收 (元)</p></div>
          <button 
            onClick={onGoToReconcile}
            className="bg-white text-emerald-600 px-6 py-2.5 rounded-full font-black text-xs flex items-center gap-2 shadow-xl border-none active:scale-95 transition-transform"
          >
            <Send size={14} /> 对账单
          </button>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4">
        {/* 数据同步引导卡片 */}
        {isEmptyData && (
            <div className="bg-gray-900 rounded-[2rem] p-6 shadow-xl text-white flex flex-col gap-4 animate-in slide-in-from-top-4 border border-gray-700">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-black text-xl flex items-center gap-2 text-emerald-400"><ClipboardPaste size={24}/> 数据接力</h3>
                        <p className="text-sm text-gray-300 mt-1 font-bold">是从微信跳转过来的吗？</p>
                    </div>
                    <div className="bg-white/10 p-2 rounded-xl"><ArrowRight size={20}/></div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-xs text-gray-400">如果在微信里已经点了“复制”，请点击下方按钮粘贴，数据将立即恢复。</p>
                </div>
                <button 
                    onClick={() => setShowSyncModal(true)}
                    className="w-full bg-emerald-500 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                    点击粘贴数据
                </button>
            </div>
        )}

        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex justify-between items-center gap-4 border border-gray-100">
           <button onClick={() => setActiveModal('repayment')} className="flex flex-col items-center gap-3 active:scale-90 flex-1 group transition-all">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner group-active:bg-emerald-100 transition-colors"><ArrowDownCircle size={32} /></div>
              <span className="text-xs font-black text-gray-700">欠款回收</span>
           </button>
           <button onClick={onStartBilling} className="flex flex-col items-center gap-3 active:scale-90 flex-1 group transition-all">
              <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner group-active:bg-blue-100 transition-colors"><Receipt size={32} /></div>
              <span className="text-xs font-black text-gray-700">开单收款</span>
           </button>
           <button onClick={() => setActiveModal('expense')} className="flex flex-col items-center gap-3 active:scale-90 flex-1 group transition-all">
              <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner group-active:bg-orange-100 transition-colors"><ArrowUpCircle size={32} /></div>
              <span className="text-xs font-black text-gray-700">记笔支出</span>
           </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-black text-lg text-gray-800 tracking-tight">经营看板</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-1">
             <div className="flex items-center gap-1 text-[10px] text-gray-400 font-black uppercase tracking-widest">
               <DollarSign size={12} />
               <span>今日销售额</span>
             </div>
             <p className="text-xl font-black text-gray-900">¥{dashboardStats.todaySales.toLocaleString()}</p>
           </div>
           
           <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-1">
             <div className="flex items-center gap-1 text-[10px] text-gray-400 font-black uppercase tracking-widest">
               <ArrowDownCircle size={12} />
               <span>今日回款</span>
             </div>
             <p className="text-xl font-black text-emerald-500">¥{dashboardStats.todayRepayment.toLocaleString()}</p>
           </div>
           
           <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-1">
             <div className="flex items-center gap-1 text-[10px] text-gray-400 font-black uppercase tracking-widest">
               <TrendingUp size={12} />
               <span>今日欠款增加</span>
             </div>
             <p className={`text-xl font-black ${dashboardStats.todayDebtIncrease >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
               {dashboardStats.todayDebtIncrease >= 0 ? '+' : ''}¥{Math.abs(dashboardStats.todayDebtIncrease).toLocaleString()}
             </p>
           </div>
           
           <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-1">
             <div className="flex items-center gap-1 text-[10px] text-gray-400 font-black uppercase tracking-widest">
               <AlertTriangle size={12} />
               <span>库存预警</span>
             </div>
             <p className="text-xl font-black text-orange-500">{dashboardStats.lowStockCount.toLocaleString()} 个</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-5 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-emerald-500" />
              <h4 className="font-black text-sm text-gray-800">热销商品 TOP5</h4>
            </div>
            <div className="space-y-2">
              {dashboardStats.topProducts.length > 0 ? (
                dashboardStats.topProducts.map((product, index) => {
                  const rankColors = [
                    'bg-amber-100 text-amber-600',
                    'bg-gray-100 text-gray-600',
                    'bg-orange-100 text-orange-600',
                    'bg-gray-50 text-gray-400',
                    'bg-gray-50 text-gray-400'
                  ];
                  const rankColor = rankColors[index] || rankColors[3];
                  return (
                    <div key={product.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${rankColor}`}>
                          {index + 1}
                        </span>
                        <span className="font-bold text-gray-700 truncate max-w-[80px]">{product.name}</span>
                      </div>
                      <span className="font-black text-gray-500">{product.qty.toLocaleString()}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-gray-300 text-xs font-bold">暂无数据</div>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} className="text-red-500" />
              <h4 className="font-black text-sm text-gray-800">欠款排行 TOP5</h4>
            </div>
            <div className="space-y-2">
              {dashboardStats.topDebtCustomers.length > 0 ? (
                dashboardStats.topDebtCustomers.map((customer, index) => {
                  const rankColors = [
                    'bg-red-100 text-red-600',
                    'bg-orange-100 text-orange-600',
                    'bg-amber-100 text-amber-600',
                    'bg-gray-50 text-gray-400',
                    'bg-gray-50 text-gray-400'
                  ];
                  const rankColor = rankColors[index] || rankColors[3];
                  return (
                    <div key={customer.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${rankColor}`}>
                          {index + 1}
                        </span>
                        <span className="font-bold text-gray-700 truncate max-w-[60px]">{customer.name}</span>
                      </div>
                      <span className="font-black text-red-500">¥{customer.totalDebt.toLocaleString()}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-gray-300 text-xs font-bold">暂无数据</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {activeModal && <QuickModal type={activeModal} onClose={() => setActiveModal(null)} onGoToReconcile={onGoToReconcile} />}

      {/* 首页直接同步数据弹窗 */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl flex flex-col">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-gray-800">粘贴以同步数据</h3>
                    <button onClick={() => setShowSyncModal(false)} className="p-1 bg-gray-100 rounded-full"><X size={20}/></button>
                </div>
                <p className="text-xs text-gray-400">请长按下方输入框 → 选择“粘贴”：</p>
                <textarea 
                    value={syncContent}
                    onChange={e => setSyncContent(e.target.value)}
                    className="w-full h-32 bg-gray-50 rounded-xl p-3 text-xs font-mono border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none resize-none"
                    placeholder='在这里粘贴刚才复制的代码...'
                    autoFocus
                ></textarea>
                <button 
                    onClick={handleSyncImport}
                    className="w-full bg-emerald-500 text-white py-3 rounded-xl font-black active:scale-95 transition-all shadow-lg shadow-emerald-200"
                >
                    确认恢复数据
                </button>
            </div>
        </div>
      )}

      {/* 每日首次打开时的备份提醒弹窗 (非空数据时) */}
      {showBackupAlert && !isEmptyData && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-[2rem] p-6 space-y-6 shadow-2xl animate-in zoom-in-95 text-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <ShieldAlert size={40} />
                </div>
                <div className="space-y-3">
                    <h3 className="text-2xl font-black text-gray-800">📅 每日数据打卡</h3>
                    <p className="text-sm text-gray-500 font-bold leading-relaxed px-2">
                        为防手机丢失导致<span className="text-red-500">账本丢失</span>，建议每天备份到云盘或微信。
                    </p>
                </div>
                
                <button 
                    onClick={handleSmartBackup} 
                    className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Copy size={20} strokeWidth={3} /> 一键复制备份
                </button>
                
                <button onClick={() => setShowBackupAlert(false)} className="text-gray-400 text-xs font-bold py-2">
                    今天不再提醒
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

// QuickModal 组件
const QuickModal: React.FC<{ 
  type: 'repayment' | 'expense', 
  onClose: () => void,
  onGoToReconcile?: () => void
}> = ({ type, onClose, onGoToReconcile }) => {
  const { data, addRepayment, addExpense, addCustomer, updateOrder } = useApp();
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState({ amount: '', type: '' });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  
  // Repayment Form State
  const [repayingCustomer, setRepayingCustomer] = useState<Customer | null>(null);
  const [showingDebtOrders, setShowingDebtOrders] = useState<Customer | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isSelectedOrderRepay, setIsSelectedOrderRepay] = useState(false);
  const [repayForm, setRepayForm] = useState({
      amount: '',
      method: PaymentMethod.WECHAT,
      mixedPayments: {
        [PaymentMethod.WECHAT]: '',
        [PaymentMethod.ALIPAY]: '',
        [PaymentMethod.CASH]: ''
      } as Record<PaymentMethod, string>,
      payee: data.payees[0] || '',
      note: ''
  });

  const [expenseScope, setExpenseScope] = useState<'DAILY' | 'BATCH'>('DAILY');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  
  const activeBatches = useMemo(() => data.batches.filter(b => !b.isClosed), [data.batches]);

  const overdueCustomers = useMemo(() => {
    const result: { customer: Customer; debtAge: number }[] = [];
    data.customers.forEach(c => {
      if (c.isGuest || c.totalDebt <= 0) return;
      const debtAge = getCustomerDebtAge(c.id, data.orders);
      if (debtAge > 15) {
        result.push({ customer: c, debtAge });
      }
    });
    result.sort((a, b) => b.debtAge - a.debtAge);
    return result;
  }, [data.customers, data.orders]);

  const totalOverdueAmount = useMemo(() => 
    overdueCustomers.reduce((sum, item) => sum + item.customer.totalDebt, 0)
  , [overdueCustomers]);

  React.useEffect(() => {
    if (expenseScope === 'BATCH' && activeBatches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(activeBatches[0].id);
    }
  }, [expenseScope, activeBatches, selectedBatchId]);

  const customerList = useMemo(() => {
    return data.customers
      .filter(c => !c.isGuest && c.name.includes(customerSearch))
      .map(c => {
        const lastOrder = data.orders.filter(o => o.customerId === c.id && o.status === OrderStatus.ACTIVE).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())[0];
        const lastDateObj = lastOrder ? new Date(lastOrder.createdAt) : null;
        const formattedDate = lastDateObj 
            ? `${lastDateObj.getFullYear()}/${(lastDateObj.getMonth()+1).toString().padStart(2,'0')}/${lastDateObj.getDate().toString().padStart(2,'0')}` 
            : '暂无交易';
        const debtAge = c.totalDebt > 0 ? getCustomerDebtAge(c.id, data.orders) : 0;
        return { ...c, lastDate: formattedDate, debtAge };
      })
      .sort((a, b) => {
        if (a.totalDebt > 0 && b.totalDebt > 0) {
          return b.debtAge - a.debtAge;
        }
        if (a.totalDebt > 0) return -1;
        if (b.totalDebt > 0) return 1;
        return b.totalDebt - a.totalDebt;
      });
  }, [data.customers, data.orders, customerSearch]);

  const debtOrders = useMemo(() => {
    if (!showingDebtOrders) return [];
    return data.orders
      .filter(o => 
        o.customerId === showingDebtOrders.id && 
        o.status === OrderStatus.ACTIVE &&
        (o.totalAmount - (o.discount || 0) - o.receivedAmount) > 0
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [showingDebtOrders, data.orders]);

  const selectedDebtAmount = useMemo(() => {
    return debtOrders
      .filter(o => selectedOrderIds.includes(o.id))
      .reduce((sum, o) => sum + (o.totalAmount - (o.discount || 0) - o.receivedAmount), 0);
  }, [debtOrders, selectedOrderIds]);

  const handleOpenDebtOrders = (customer: Customer) => {
      setShowingDebtOrders(customer);
      setSelectedOrderIds([]);
  };

  const handleToggleOrder = (orderId: string) => {
      setSelectedOrderIds(prev => 
        prev.includes(orderId) 
          ? prev.filter(id => id !== orderId)
          : [...prev, orderId]
      );
  };

  const handleFullRepayment = () => {
      if (!showingDebtOrders) return;
      setIsSelectedOrderRepay(false);
      setRepayingCustomer(showingDebtOrders);
      setRepayForm({
          amount: showingDebtOrders.totalDebt.toString(),
          method: PaymentMethod.WECHAT,
          mixedPayments: {
            [PaymentMethod.WECHAT]: '',
            [PaymentMethod.ALIPAY]: '',
            [PaymentMethod.CASH]: ''
          } as Record<PaymentMethod, string>,
          payee: data.payees[0] || '',
          note: ''
      });
  };

  const handleSelectedRepayment = () => {
      if (selectedOrderIds.length === 0) {
          alert('请至少选择一个订单');
          return;
      }
      if (!showingDebtOrders) return;
      setIsSelectedOrderRepay(true);
      setRepayingCustomer(showingDebtOrders);
      setRepayForm({
          amount: selectedDebtAmount.toString(),
          method: PaymentMethod.WECHAT,
          mixedPayments: {
            [PaymentMethod.WECHAT]: '',
            [PaymentMethod.ALIPAY]: '',
            [PaymentMethod.CASH]: ''
          } as Record<PaymentMethod, string>,
          payee: data.payees[0] || '',
          note: ''
      });
  };

  const handleSubmitRepayment = () => {
      if (!repayingCustomer) return;
      
      let amount = 0;
      if (repayForm.method === PaymentMethod.MIXED) {
          amount = Math.floor((parseFloat(repayForm.mixedPayments[PaymentMethod.WECHAT]) || 0) +
                   (parseFloat(repayForm.mixedPayments[PaymentMethod.ALIPAY]) || 0) +
                   (parseFloat(repayForm.mixedPayments[PaymentMethod.CASH]) || 0));
      } else {
          amount = Math.floor(parseFloat(repayForm.amount));
      }

      if (isNaN(amount) || amount <= 0) return alert('请输入有效还款金额');
      if (!repayForm.payee) return alert('请选择收款人');

      const paymentMethod = repayForm.method;
      const mixedPayments = repayForm.method === PaymentMethod.MIXED ? [
        { method: PaymentMethod.WECHAT, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.WECHAT]) || 0) },
        { method: PaymentMethod.ALIPAY, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.ALIPAY]) || 0) },
        { method: PaymentMethod.CASH, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.CASH]) || 0) }
      ].filter(m => m.amount > 0) : undefined;

      if (isSelectedOrderRepay && selectedOrderIds.length > 0) {
          const selectedOrders = debtOrders.filter(o => selectedOrderIds.includes(o.id));
          const totalSelectedDebt = selectedOrders.reduce(
              (sum, o) => sum + (o.totalAmount - (o.discount || 0) - o.receivedAmount), 0
          );
          
          if (amount > totalSelectedDebt) {
              alert(`还款金额不能超过选中订单的欠款总额 ¥${totalSelectedDebt}`);
              return;
          }

          let remainingAmount = amount;
          selectedOrders.forEach((order, index) => {
              const orderDebt = order.totalAmount - (order.discount || 0) - order.receivedAmount;
              let allocatedAmount = 0;
              
              if (index === selectedOrders.length - 1) {
                  allocatedAmount = remainingAmount;
              } else {
                  allocatedAmount = preciseCalc(() => (orderDebt / totalSelectedDebt) * amount);
                  remainingAmount = preciseCalc(() => remainingAmount - allocatedAmount);
              }
              
              const newReceived = preciseCalc(() => order.receivedAmount + allocatedAmount);
              updateOrder(order.id, { receivedAmount: newReceived });
          });

          addRepayment({ 
              id: Date.now().toString(), 
              customerId: repayingCustomer.id, 
              customerName: repayingCustomer.name, 
              amount: amount, 
              date: new Date().toISOString(), 
              payee: repayForm.payee,
              paymentMethod,
              mixedPayments,
              note: repayForm.note || `勾选还款(${selectedOrders.length}笔订单)`
          });
      } else {
          addRepayment({ 
              id: Date.now().toString(), 
              customerId: repayingCustomer.id, 
              customerName: repayingCustomer.name, 
              amount: amount, 
              date: new Date().toISOString(), 
              payee: repayForm.payee,
              paymentMethod,
              mixedPayments,
              note: repayForm.note 
          });
      }
      
      alert('✅ 收款成功！');
      setRepayingCustomer(null);
      setShowingDebtOrders(null);
      setSelectedOrderIds([]);
      setIsSelectedOrderRepay(false);
  };

  const handleAddNewCustomer = () => {
    if (!newCustomerName.trim()) return;
    addCustomer({
        id: Date.now().toString(),
        name: newCustomerName,
        phone: '',
        totalDebt: 0,
        isGuest: false
    });
    setNewCustomerName('');
    setShowAddCustomer(false);
    alert('客户添加成功');
  };

  const handleAddExpense = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return alert('请输入有效金额');
    if (!form.type) return alert('请输入支出类目');
    if (expenseScope === 'BATCH' && !selectedBatchId) return alert('请选择关联车辆');

    addExpense({
      id: Date.now().toString(),
      amount: parseFloat(form.amount),
      type: form.type,
      date: new Date().toISOString(),
      note: '',
      batchId: expenseScope === 'BATCH' ? selectedBatchId : undefined
    });
    onClose();
  };

  // 渲染：欠款订单列表
  if (showingDebtOrders) {
      return (
        <div className="fixed inset-0 z-[220] bg-[#F1F3F6] flex flex-col animate-in slide-in-from-right">
          <header className="bg-white px-4 py-4 flex items-center shrink-0 border-b border-gray-100 shadow-sm z-10">
            <button onClick={() => setShowingDebtOrders(null)} className="text-[#3b82f6] text-base font-bold active:scale-95 transition-all">返回</button>
            <h1 className="flex-1 text-center font-black text-lg text-[#1f2937] pr-8">{showingDebtOrders.name} - 欠款订单</h1>
          </header>

          <div className="bg-white px-4 py-3 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400 font-bold">欠款总额</p>
                <p className="text-2xl font-black text-red-500">¥{showingDebtOrders.totalDebt.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 font-bold">共 {debtOrders.length} 笔</p>
                <p className="text-xs text-gray-500 font-bold">已选 {selectedOrderIds.length} 笔</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar pb-40">
             {debtOrders.length > 0 ? debtOrders.map(order => {
                const debtAmount = order.totalAmount - (order.discount || 0) - order.receivedAmount;
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <div 
                    key={order.id} 
                    onClick={() => handleToggleOrder(order.id)}
                    className={`bg-white p-4 rounded-[1.2rem] shadow-sm border-2 transition-all cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-gray-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                          {isSelected && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-black text-gray-800 text-sm">{order.orderNo}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 font-bold">欠款</p>
                            <p className="font-black text-red-500">¥{debtAmount.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 font-bold">总额: ¥{order.totalAmount.toLocaleString()}</span>
                          <span className="text-gray-500 font-bold">已收: ¥{order.receivedAmount.toLocaleString()}</span>
                        </div>
                        {order.items.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-1 truncate">
                            {order.items.map(i => i.productName).join('、')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
             }) : (
                <div className="text-center py-20 text-gray-400 font-bold">暂无欠款订单</div>
             )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-lg z-20">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500 font-bold">已选金额</span>
              <span className="text-xl font-black text-blue-600">¥{selectedDebtAmount.toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleFullRepayment}
                className="flex-1 bg-gray-800 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-gray-200 active:scale-95 transition-all"
              >
                全额还款
              </button>
              <button 
                onClick={handleSelectedRepayment}
                disabled={selectedOrderIds.length === 0}
                className={`flex-1 py-4 rounded-2xl font-black text-base shadow-lg active:scale-95 transition-all ${selectedOrderIds.length > 0 ? 'bg-blue-500 text-white shadow-blue-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                勾选收款
              </button>
            </div>
          </div>
        </div>
      );
  }

  // 渲染：详细还款录入弹窗
  if (repayingCustomer) {
      return (
        <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
             <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 space-y-6 shadow-2xl">
                 <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                    <div>
                        <h3 className="text-xl font-black text-gray-800">{repayingCustomer.name}</h3>
                        <p className="text-xs text-gray-400 font-bold">当前欠款: <span className="text-red-500">¥{repayingCustomer.totalDebt.toLocaleString()}</span></p>
                    </div>
                    <button onClick={() => setRepayingCustomer(null)} className="p-2 bg-gray-100 rounded-full"><X size={20} /></button>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">收款方式</label>
                        <div className="grid grid-cols-4 gap-2">
                             {[
                                { id: PaymentMethod.WECHAT, label: '微信', icon: '💬', color: 'bg-green-100 text-green-600 border-green-200' },
                                { id: PaymentMethod.ALIPAY, label: '支付宝', icon: '💳', color: 'bg-blue-100 text-blue-600 border-blue-200' },
                                { id: PaymentMethod.CASH, label: '现金', icon: '💰', color: 'bg-orange-100 text-orange-600 border-orange-200' },
                                { id: PaymentMethod.MIXED, label: '混合', icon: '🔀', color: 'bg-purple-100 text-purple-600 border-purple-200' },
                             ].map(m => (
                                 <button
                                    key={m.id}
                                    onClick={() => setRepayForm({...repayForm, method: m.id})}
                                    className={`py-3 rounded-xl text-xs font-black border-2 transition-all flex flex-col items-center gap-1 ${repayForm.method === m.id ? m.color : 'bg-gray-50 text-gray-400 border-transparent'}`}
                                 >
                                    <span className="text-lg">{m.icon}</span>
                                    {m.label}
                                 </button>
                             ))}
                        </div>
                    </div>

                    {repayForm.method === PaymentMethod.MIXED ? (
                        <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">混合支付明细</label>
                            {[
                                { id: PaymentMethod.WECHAT, label: '微信', color: 'text-green-600' },
                                { id: PaymentMethod.ALIPAY, label: '支付宝', color: 'text-blue-600' },
                                { id: PaymentMethod.CASH, label: '现金', color: 'text-orange-600' }
                            ].map(m => (
                                <div key={m.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-100">
                                    <span className={`text-sm font-black w-16 ${m.color}`}>{m.label}</span>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={repayForm.mixedPayments[m.id as PaymentMethod]}
                                        onChange={e => setRepayForm({
                                            ...repayForm,
                                            mixedPayments: {
                                                ...repayForm.mixedPayments,
                                                [m.id]: e.target.value
                                            }
                                        })}
                                        className="w-full bg-transparent text-right text-lg font-black text-gray-800 outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">本次收款金额</label>
                            <input 
                                type="number"
                                autoFocus
                                value={repayForm.amount}
                                onChange={e => setRepayForm({...repayForm, amount: e.target.value})}
                                className="w-full bg-emerald-50 p-5 rounded-2xl text-3xl font-black text-emerald-600 outline-none border-2 border-transparent focus:border-emerald-500 transition-all text-center"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">收款人 (经手人)</label>
                        <div className="flex flex-wrap gap-2">
                            {data.payees.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setRepayForm({...repayForm, payee: p})}
                                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${repayForm.payee === p ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                 </div>

                 <button 
                    onClick={handleSubmitRepayment}
                    className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-gray-200 active:scale-95 transition-all"
                 >
                    确认收款
                 </button>
             </div>
        </div>
      );
  }

  // 渲染：客户列表
  if (type === 'repayment') {
    return (
      <div className="fixed inset-0 z-[200] bg-[#F1F3F6] flex flex-col animate-in slide-in-from-right">
        <header className="bg-white px-4 py-4 flex items-center shrink-0 border-b border-gray-100 shadow-sm z-10">
          <button onClick={onClose} className="text-[#3b82f6] text-base font-bold active:scale-95 transition-all">返回</button>
          <h1 className="flex-1 text-center font-black text-lg text-[#1f2937] pr-8">欠款/客户管理</h1>
        </header>

        <div className="px-4 pt-4 pb-2 flex gap-3 shrink-0">
           <div className="flex-1 relative bg-white rounded-xl shadow-sm overflow-hidden">
             <input 
                value={customerSearch} 
                onChange={e => setCustomerSearch(e.target.value)} 
                placeholder="搜索客户..." 
                className="w-full h-14 pl-5 rounded-xl font-bold outline-none text-gray-800 placeholder-gray-400" 
             />
           </div>
           <button 
                onClick={() => setShowAddCustomer(true)}
                className="w-14 h-14 bg-[#2ecc71] text-white rounded-xl flex items-center justify-center active:scale-95 shadow-[0_4px_12px_rgba(46,204,113,0.3)] transition-all"
           >
                <Plus size={32} strokeWidth={3} />
           </button>
        </div>

        {overdueCustomers.length > 0 && customerSearch === '' && (
          <div className="px-4 pb-2">
            <div 
              onClick={onGoToReconcile}
              className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertOctagon size={20} />
                  <div>
                    <p className="text-sm font-black">超期待回款提醒</p>
                    <p className="text-xs opacity-90">超15天未回款客户 {overdueCustomers.length} 人</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">¥{totalOverdueAmount.toLocaleString()}</p>
                  <p className="text-xs opacity-80">总超期金额</p>
                </div>
              </div>
              <div className="flex items-center justify-end mt-2 text-xs font-bold opacity-90">
                查看详情 <ArrowRight size={14} className="ml-1" />
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 no-scrollbar pb-32">
           {customerList.map(c => {
              const isOverdue = c.debtAge > 15;
              return (
             <div key={c.id} className="bg-white p-5 rounded-[1.2rem] flex justify-between items-center shadow-sm border border-gray-50 active:scale-[0.99] transition-all">
                <div className="space-y-1.5">
                   <div className="flex items-center gap-2">
                     <p className="text-xl font-black text-[#111827]">{c.name}</p>
                     {c.totalDebt > 0 && (
                       <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                         账龄 {c.debtAge}天
                       </span>
                     )}
                   </div>
                   <p className="text-xs text-[#9ca3af] font-bold">最近交易: {c.lastDate}</p>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-center">
                        <p className="text-xs text-[#9ca3af] font-bold mb-0.5">欠款</p>
                        <p className={`text-2xl font-black ${c.totalDebt > 0 ? 'text-[#ef4444]' : 'text-[#d1d5db]'}`}>¥{c.totalDebt.toLocaleString()}</p>
                   </div>
                   <button 
                        onClick={() => handleOpenDebtOrders(c)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all active:scale-90 ${c.totalDebt > 0 ? 'bg-[#ebf5ff] border-[#bfdbfe] text-[#3b82f6] shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-300'}`}
                   >
                        <Wallet size={20} strokeWidth={2.5} />
                   </button>
                </div>
             </div>
              );
           })}
           {customerList.length === 0 && (
                <div className="text-center py-20 text-gray-400 font-bold">暂无相关客户</div>
           )}
        </div>

        {showAddCustomer && (
            <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 space-y-6 shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-gray-800">添加新客户</h3>
                        <button onClick={() => setShowAddCustomer(false)} className="p-2 bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-blue-500 uppercase tracking-wider px-1">客户姓名</label>
                        <input 
                            autoFocus
                            value={newCustomerName}
                            onChange={e => setNewCustomerName(e.target.value)}
                            placeholder="输入姓名"
                            className="w-full bg-gray-50 p-4 rounded-xl font-black text-lg outline-none border-2 border-transparent focus:border-blue-400 focus:bg-white transition-all"
                        />
                    </div>
                    <button onClick={handleAddNewCustomer} className="w-full bg-[#2ecc71] text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-emerald-200 active:scale-95 transition-all">确认添加</button>
                </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end">
       <div className="bg-white w-full rounded-t-[3rem] p-8 space-y-6 animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#111827]">登记经营支出</h2>
            <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400 active:bg-gray-200"><X size={24} /></button>
          </div>

          <div className="space-y-6">
             <div className="bg-gray-100 p-1.5 rounded-2xl flex">
                <button 
                  onClick={() => setExpenseScope('DAILY')}
                  className={`flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${expenseScope === 'DAILY' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                >
                  <Store size={18} /> 日常运营
                </button>
                <button 
                  onClick={() => setExpenseScope('BATCH')}
                  className={`flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${expenseScope === 'BATCH' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                >
                  <Truck size={18} /> 跟车成本
                </button>
             </div>

             {expenseScope === 'BATCH' && (
                <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
                   <label className="text-xs text-gray-400 font-black uppercase tracking-widest px-2">关联车次 (计入该车成本)</label>
                   {activeBatches.length > 0 ? (
                     <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {activeBatches.map(batch => (
                           <button 
                              key={batch.id} 
                              onClick={() => setSelectedBatchId(batch.id)}
                              className={`shrink-0 px-4 py-3 rounded-xl text-sm font-black border-2 transition-all ${selectedBatchId === batch.id ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-100 bg-white text-gray-500'}`}
                           >
                              {batch.plateNumber}
                           </button>
                        ))}
                     </div>
                   ) : (
                     <div className="bg-orange-50 text-orange-500 p-4 rounded-2xl text-xs font-black flex items-center gap-2">
                        <AlertTriangle size={16} /> 暂无在售车辆，请先添加车辆
                     </div>
                   )}
                </div>
             )}

             <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-black uppercase tracking-widest px-2">支出类目</label>
                  <input 
                    value={form.type} 
                    onChange={e=>setForm({...form, type: e.target.value})} 
                    placeholder="例如：伙食费"
                    className="w-full bg-gray-50 p-5 rounded-2xl font-black outline-none shadow-inner border-2 border-transparent focus:border-emerald-100 focus:bg-white transition-all" 
                  />
                  <div className="flex gap-2 px-1">
                    {(expenseScope === 'BATCH' ? ['劳务费', '板车费', '过磅费', '运费'] : ['员工伙食', '店铺水电', '设备维修', '包装耗材']).map(tag => (
                       <button 
                          key={tag}
                          onClick={() => setForm({...form, type: tag})}
                          className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-[10px] font-bold active:bg-gray-200 transition-colors"
                       >
                          {tag}
                       </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-black uppercase tracking-widest px-2">金额 (元)</label>
                  <input 
                    type="number" 
                    value={form.amount} 
                    onChange={e=>setForm({...form, amount: e.target.value})} 
                    placeholder="0.00" 
                    className="w-full bg-gray-50 p-5 rounded-2xl font-black text-4xl text-emerald-600 outline-none shadow-inner border-2 border-transparent focus:border-emerald-100 focus:bg-white transition-all" 
                  />
                </div>
             </div>

             <button 
                onClick={handleAddExpense} 
                className="w-full bg-emerald-500 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2"
             >
                <CheckCircle2 size={24} /> 确认入账
             </button>
          </div>
       </div>
    </div>
  );
};

export default HomeView;
