
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { 
  Wallet, Send, Share2, Receipt, ArrowUpCircle, 
  ArrowDownCircle, X, Plus, CheckCircle2,
  Truck, Store, AlertTriangle, ShieldAlert, ClipboardPaste, ArrowRight, Copy, Share, User, Banknote
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
        <div className="flex justify-between items-center px-2"><h3 className="font-black text-lg text-gray-800 tracking-tight">今日经营动态</h3></div>
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">今日营收 (实成交)</p><p className="text-2xl font-black text-gray-900">¥{stats.orderAmount.toLocaleString()}</p></div>
           
           {/* 今日实收卡片优化：显示回款构成 */}
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-1 relative overflow-hidden">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">今日实收 (总入账)</p>
                <p className="text-2xl font-black text-emerald-500">¥{stats.totalReceived.toLocaleString()}</p>
                {stats.repaymentReceived > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600/70 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                        <ArrowDownCircle size={10} />
                        含回款 ¥{stats.repaymentReceived.toLocaleString()}
                    </div>
                )}
           </div>
           
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">新增挂账</p><p className="text-2xl font-black text-red-500">¥{stats.debtAmount.toLocaleString()}</p></div>
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">在售车辆</p><p className="text-2xl font-black text-blue-500">{stats.activeBatches} 台</p></div>
        </div>
      </div>
      {activeModal && <QuickModal type={activeModal} onClose={() => setActiveModal(null)} />}

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
const QuickModal: React.FC<{ type: 'repayment' | 'expense', onClose: () => void }> = ({ type, onClose }) => {
  const { data, addRepayment, addExpense, addCustomer, updateOrder } = useApp();
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState({ amount: '', type: '' });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  // Repayment Form State
  const [repayingCustomer, setRepayingCustomer] = useState<Customer | null>(null);
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

  // 新增：查看欠款明细的客户
  const [viewingDebtCustomer, setViewingDebtCustomer] = useState<Customer | null>(null);
  // 新增：勾选要收款的订单
  const [selectedDebtOrderIds, setSelectedDebtOrderIds] = useState<string[]>([]);

  // 计算某客户的所有欠款订单（安全版，防白屏）
  const getDebtOrders = (customerId: string) => {
      try {
          if (!data.orders || !Array.isArray(data.orders)) return [];
          return data.orders
              .filter(o => {
                  if (!o || !o.id) return false;
                  if (o.customerId !== customerId) return false;
                  if (o.status && o.status !== 'ACTIVE') return false;
                  const total = Number(o.totalAmount) || 0;
                  const disc = Number(o.discount) || 0;
                  const paid = Number(o.receivedAmount) || 0;
                  return Math.max(0, total - disc - paid) > 0;
              })
              .map(o => {
                  const total = Number(o.totalAmount) || 0;
                  const disc = Number(o.discount) || 0;
                  const paid = Number(o.receivedAmount) || 0;
                  const debt = preciseCalc(() => Math.max(0, total - disc - paid));
                  const itemsArr = Array.isArray(o.items) ? o.items : [];
                  return {
                      id: o.id,
                      orderNo: o.orderNo || '无单号',
                      createdAt: o.createdAt || new Date().toISOString(),
                      totalAmount: total,
                      receivedAmount: paid,
                      discount: disc,
                      debt,
                      items: itemsArr.map((i: any) => {
                          const name = i?.productName || '商品';
                          const qty = i?.qty || 0;
                          return `${name}x${qty}`;
                      }).join(', ') || '（无商品明细）'
                  };
              })
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } catch (e) {
          console.error('getDebtOrders error', e);
          return [];
      }
  };

  const [expenseScope, setExpenseScope] = useState<'DAILY' | 'BATCH'>('DAILY');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  
  const activeBatches = useMemo(() => data.batches.filter(b => !b.isClosed), [data.batches]);

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
        return { ...c, lastDate: formattedDate };
      })
      .sort((a, b) => b.totalDebt - a.totalDebt);
  }, [data.customers, data.orders, customerSearch]);

  const handleOpenRepay = (customer: Customer) => {
      setRepayingCustomer(customer);
      setRepayForm({
          amount: customer.totalDebt.toString(),
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

  // 新：勾选具体订单后收款 —— 把还款金额分摊到每笔订单的 receivedAmount
  const handleSubmitDebtOrderRepayment = (orderIds: string[]) => {
      if (!viewingDebtCustomer) return;
      if (!repayingCustomer) return;

      let amount = 0;
      if (repayForm.method === PaymentMethod.MIXED) {
          amount = Math.floor((parseFloat(repayForm.mixedPayments[PaymentMethod.WECHAT]) || 0) +
              (parseFloat(repayForm.mixedPayments[PaymentMethod.ALIPAY]) || 0) +
              (parseFloat(repayForm.mixedPayments[PaymentMethod.CASH]) || 0));
      } else {
          amount = Math.floor(parseFloat(repayForm.amount) || 0);
      }
      if (isNaN(amount) || amount <= 0) return alert('请输入有效金额');
      if (!repayForm.payee) return alert('请选择收款人');

      const debtOrders = getDebtOrders(viewingDebtCustomer.id).filter(d => orderIds.includes(d.id));
      if (debtOrders.length === 0) {
          // 用户没选任何订单 → 走普通还款逻辑
          handleSubmitRepayment();
          return;
      }
      const totalDebtOfSelected = preciseCalc(() => debtOrders.reduce((s, d) => s + d.debt, 0));
      const actual = Math.min(amount, totalDebtOfSelected);
      if (actual <= 0) return alert('金额无效');

      // 按比例分摊到每笔订单的 receivedAmount
      let remaining = actual;
      debtOrders.forEach((d, idx) => {
          let allocated: number;
          if (idx === debtOrders.length - 1) {
              allocated = remaining;
          } else {
              allocated = preciseCalc(() => actual * d.debt / totalDebtOfSelected);
          }
          remaining = preciseCalc(() => remaining - allocated);
          const order = data.orders.find(o => o.id === d.id);
          if (!order) return;
          const newReceived = preciseCalc(() => (Number(order.receivedAmount) || 0) + allocated);
          updateOrder(order.id, { receivedAmount: newReceived });
      });

      // 也同步写一笔还款记录（让 customer.totalDebt 按订单重算）
      addRepayment({
          id: Date.now().toString(),
          customerId: viewingDebtCustomer.id,
          customerName: viewingDebtCustomer.name,
          amount: actual,
          date: new Date().toISOString(),
          payee: repayForm.payee,
          paymentMethod: repayForm.method,
          mixedPayments: repayForm.method === PaymentMethod.MIXED ? [
              { method: PaymentMethod.WECHAT, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.WECHAT]) || 0) },
              { method: PaymentMethod.ALIPAY, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.ALIPAY]) || 0) },
              { method: PaymentMethod.CASH, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.CASH]) || 0) },
          ].filter(m => m.amount > 0) : undefined,
          note: repayForm.note || `偿还 ${debtOrders.length} 笔订单`
      });

      alert(`✅ 收款成功！（共 ${debtOrders.length} 笔订单 / ¥${actual}）`);
      setSelectedDebtOrderIds([]);
      setViewingDebtCustomer(null);
      setRepayingCustomer(null);
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

      addRepayment({ 
          id: Date.now().toString(), 
          customerId: repayingCustomer.id, 
          customerName: repayingCustomer.name, 
          amount: amount, 
          date: new Date().toISOString(), 
          payee: repayForm.payee,
          paymentMethod: repayForm.method,
          mixedPayments: repayForm.method === PaymentMethod.MIXED ? [
            { method: PaymentMethod.WECHAT, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.WECHAT]) || 0) },
            { method: PaymentMethod.ALIPAY, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.ALIPAY]) || 0) },
            { method: PaymentMethod.CASH, amount: Math.floor(parseFloat(repayForm.mixedPayments[PaymentMethod.CASH]) || 0) }
          ].filter(m => m.amount > 0) : undefined,
          note: repayForm.note 
      });
      
      alert('✅ 收款成功！');
      setRepayingCustomer(null);
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
                    onClick={() => {
                      if (viewingDebtCustomer && selectedDebtOrderIds.length > 0) {
                        handleSubmitDebtOrderRepayment(selectedDebtOrderIds);
                      } else {
                        handleSubmitRepayment();
                      }
                    }}
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

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 no-scrollbar pb-32">
           {customerList.map(c => (
             <div key={c.id}
                  onClick={() => c.totalDebt > 0 && setViewingDebtCustomer(c)}
                  className={`bg-white p-5 rounded-[1.2rem] flex justify-between items-center shadow-sm border border-gray-50 transition-all ${c.totalDebt > 0 ? 'active:scale-[0.99] cursor-pointer' : 'opacity-90'}`}>
                <div className="space-y-1.5 flex-1">
                   <p className="text-xl font-black text-[#111827]">{c.name}</p>
                   <p className="text-xs text-[#9ca3af] font-bold">最近交易: {c.lastDate}</p>
                   {c.totalDebt > 0 && (
                     <p className="text-[10px] text-[#3b82f6] font-bold mt-1">点击查看具体欠款订单 →</p>
                   )}
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-center">
                        <p className="text-xs text-[#9ca3af] font-bold mb-0.5">欠款</p>
                        <p className={`text-2xl font-black ${c.totalDebt > 0 ? 'text-[#ef4444]' : 'text-[#d1d5db]'}`}>¥{c.totalDebt.toLocaleString()}</p>
                   </div>
                   <button
                        onClick={(e) => { e.stopPropagation(); c.totalDebt > 0 && handleOpenRepay(c); }}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all active:scale-90 ${c.totalDebt > 0 ? 'bg-[#ebf5ff] border-[#bfdbfe] text-[#3b82f6] shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-300'}`}
                   >
                        <Wallet size={20} strokeWidth={2.5} />
                   </button>
                </div>
             </div>
           ))}
           {customerList.length === 0 && (
                <div className="text-center py-20 text-gray-400 font-bold">暂无相关客户</div>
           )}
        </div>

        {/* 某客户欠款订单明细弹窗（支持勾选具体订单 + 直接收款） */}
        {viewingDebtCustomer && !repayingCustomer && (
          <div className="fixed inset-0 z-[350] bg-[#F1F3F6] flex flex-col animate-in slide-in-from-right">
            <header className="bg-white px-4 py-4 flex items-center shrink-0 border-b border-gray-100 shadow-sm z-10">
              <button
                onClick={() => { setViewingDebtCustomer(null); setSelectedDebtOrderIds([]); }}
                className="text-[#3b82f6] text-base font-bold active:scale-95 transition-all"
              >返回</button>
              <div className="flex-1 text-center pr-8">
                <h1 className="font-black text-lg text-[#1f2937]">{viewingDebtCustomer.name} 的欠款</h1>
                <p className="text-xs text-[#ef4444] font-bold mt-0.5">
                  共 {(() => { const ds = getDebtOrders(viewingDebtCustomer.id); return ds.length; })()} 笔 / 合计 ¥{(() => { const ds = getDebtOrders(viewingDebtCustomer.id); return ds.reduce((s,d)=>s+d.debt,0).toLocaleString(); })()}
                </p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar pb-32">
              {(() => {
                const debtOrders = getDebtOrders(viewingDebtCustomer.id);
                if (debtOrders.length === 0) {
                  return <div className="text-center py-20 text-gray-400 font-bold">该客户没有欠款订单</div>;
                }
                return debtOrders.map(order => {
                  const date = new Date(order.createdAt);
                  const dateStr = `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                  const checked = selectedDebtOrderIds.includes(order.id);
                  return (
                    <div key={order.id}
                      className={`bg-white rounded-[1.2rem] shadow-sm border-2 transition-all ${checked ? 'border-[#3b82f6]' : 'border-gray-50'}`}
                      onClick={() => {
                        if (checked) setSelectedDebtOrderIds(prev => prev.filter(id => id !== order.id));
                        else setSelectedDebtOrderIds(prev => [...prev, order.id]);
                      }}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={checked} readOnly
                            className="mt-1 w-5 h-5 rounded border-gray-300 text-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]" />
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-black text-gray-800">{order.orderNo}</p>
                            <p className="text-xs text-gray-400 font-bold">{dateStr}</p>
                            {order.items && <p className="text-xs text-gray-500 mt-1">{order.items}</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold">订单金额</p>
                            <p className="text-sm font-black text-gray-800">¥{order.totalAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold">已收</p>
                            <p className="text-sm font-black text-emerald-600">¥{order.receivedAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold">欠款</p>
                            <p className="text-sm font-black text-red-500">¥{order.debt.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* 底部：全选 / 收款按钮 */}
            {(() => {
              const debtOrders = getDebtOrders(viewingDebtCustomer.id);
              if (debtOrders.length === 0) return null;
              const allChecked = debtOrders.length > 0 && selectedDebtOrderIds.length === debtOrders.length;
              const selectedTotal = debtOrders.filter(d => selectedDebtOrderIds.includes(d.id)).reduce((s,d)=>s+d.debt,0);
              return (
                <div className="shrink-0 bg-white border-t border-gray-100 p-4 pb-6 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between text-sm">
                    <button
                      onClick={() => {
                        if (allChecked) setSelectedDebtOrderIds([]);
                        else setSelectedDebtOrderIds(debtOrders.map(d => d.id));
                      }}
                      className="text-[#3b82f6] font-bold active:scale-95 transition-all"
                    >{allChecked ? '取消全选' : '全选'}</button>
                    <span className="text-gray-500 font-bold">
                      {selectedDebtOrderIds.length > 0
                        ? `已选 ${selectedDebtOrderIds.length} 笔，¥${selectedTotal.toLocaleString()}`
                        : '请勾选要收款的订单'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedDebtOrderIds.length === 0) {
                        alert('请先勾选至少一笔欠款订单');
                        return;
                      }
                      // 打开还款金额输入面板（金额默认 = 勾选订单的欠款合计）
                      setRepayingCustomer(viewingDebtCustomer);
                      setRepayForm({
                        amount: selectedTotal.toString(),
                        method: PaymentMethod.WECHAT,
                        mixedPayments: {
                          [PaymentMethod.WECHAT]: '',
                          [PaymentMethod.ALIPAY]: '',
                          [PaymentMethod.CASH]: ''
                        } as Record<PaymentMethod, string>,
                        payee: data.payees[0] || '',
                        note: ''
                      });
                    }}
                    disabled={selectedDebtOrderIds.length === 0}
                    className={`w-full py-4 rounded-2xl font-black text-base shadow-lg active:scale-95 transition-all ${
                      selectedDebtOrderIds.length > 0
                        ? 'bg-[#3b82f6] text-white shadow-blue-200'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {selectedDebtOrderIds.length > 0 ? `对 ${selectedDebtOrderIds.length} 笔订单收款（¥${selectedTotal.toLocaleString()}）` : '请勾选要收款的订单'}
                  </button>
                </div>
              );
            })()}
          </div>
        )}

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
