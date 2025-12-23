import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { 
  PlusCircle, Wallet, FileText, Send, 
  ChevronRight, Share2, Receipt, ArrowUpCircle, 
  ArrowDownCircle, PackageCheck, ShoppingBag, X, Info, Search, UserCheck, Plus, CheckCircle2,
  Truck, Store, Tag, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { OrderStatus } from '../types';

const HomeView: React.FC<{ onStartBilling: () => void }> = ({ onStartBilling }) => {
  const { data } = useApp();
  const [activeModal, setActiveModal] = useState<'repayment' | 'expense' | null>(null);
  
  // Backup Alert State
  const [showBackupAlert, setShowBackupAlert] = useState(false);
  const [needsBackup, setNeedsBackup] = useState(false);

  useEffect(() => {
    // Check backup status on mount
    const checkBackupStatus = () => {
        const lastBackupStr = localStorage.getItem('LAST_BACKUP_TIME');
        // Logic: Needs backup if never backed up OR last backup was > 3 days ago
        const isNeeded = !lastBackupStr || (Date.now() - new Date(lastBackupStr).getTime() > 3 * 24 * 60 * 60 * 1000);
        
        setNeedsBackup(isNeeded);

        if (isNeeded) {
            const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const lastPromptDate = localStorage.getItem('HOME_BACKUP_PROMPT_DATE');
            
            // If prompt hasn't been shown today, show it
            if (lastPromptDate !== todayStr) {
                setShowBackupAlert(true);
                localStorage.setItem('HOME_BACKUP_PROMPT_DATE', todayStr);
            }
        }
    };
    checkBackupStatus();
  }, []);

  const totalDebtAmount = useMemo(() => 
    data.customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0)
  , [data.customers]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0,0,0,0)).getTime();
    const orders = data.orders.filter(o => o.status === OrderStatus.ACTIVE && new Date(o.createdAt).getTime() >= startOfToday);
    const repayments = data.repayments.filter(r => new Date(r.date).getTime() >= startOfToday);
    const orderAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const receivedAmount = orders.reduce((sum, o) => sum + o.receivedAmount, 0);
    const repaymentAmount = repayments.reduce((sum, r) => sum + r.amount, 0);
    return { orderAmount, receivedAmount, debtAmount: orderAmount - receivedAmount, repaymentAmount, activeBatches: data.batches.filter(b => !b.isClosed).length };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-32">
      <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-6 pt-12 text-white rounded-b-[2.5rem] shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">砂糖橘批发助手 Pro</h2>
            {/* 常驻红字提示 */}
            {needsBackup && (
                <div className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md mt-1 shadow-sm animate-pulse">
                    <AlertTriangle size={10} className="text-red-500" fill="currentColor" />
                    <span className="text-[10px] font-black text-red-500">建议立即备份数据</span>
                </div>
            )}
          </div>
          <button className="bg-white/10 p-2 rounded-full active:scale-95"><Share2 size={20} /></button>
        </div>
        <div className="flex justify-between items-end">
          <div className="space-y-0.5"><p className="text-5xl font-black tracking-tighter">{totalDebtAmount.toLocaleString()}</p><p className="text-[10px] text-white/70 font-black uppercase tracking-widest">全店累计待收 (元)</p></div>
          <button className="bg-white text-emerald-600 px-6 py-2.5 rounded-full font-black text-xs flex items-center gap-2 shadow-xl border-none"><Send size={14} /> 对账单</button>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10">
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
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">今日营收</p><p className="text-2xl font-black text-gray-900">¥{stats.orderAmount.toLocaleString()}</p></div>
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">今日实收</p><p className="text-2xl font-black text-emerald-500">¥{stats.receivedAmount.toLocaleString()}</p></div>
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">新增挂账</p><p className="text-2xl font-black text-red-500">¥{stats.debtAmount.toLocaleString()}</p></div>
           <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">在售车辆</p><p className="text-2xl font-black text-blue-500">{stats.activeBatches} 台</p></div>
        </div>
      </div>
      {activeModal && <QuickModal type={activeModal} onClose={() => setActiveModal(null)} />}

      {/* 每日首次打开时的备份提醒弹窗 */}
      {showBackupAlert && (
        <div className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-[2rem] p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <ShieldAlert size={32} />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-gray-800">数据安全提醒</h3>
                    <p className="text-sm text-gray-500 font-bold leading-relaxed">检测到您长时间未备份数据，为了您的资产安全，建议前往“我的”页面导出备份。</p>
                </div>
                <button onClick={() => setShowBackupAlert(false)} className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-black shadow-lg active:scale-95 transition-all">我知道了</button>
            </div>
        </div>
      )}
    </div>
  );
};

const QuickModal: React.FC<{ type: 'repayment' | 'expense', onClose: () => void }> = ({ type, onClose }) => {
  const { data, addRepayment, addExpense, addCustomer } = useApp();
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState({ amount: '', type: '' });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  
  // Expense specific state
  const [expenseScope, setExpenseScope] = useState<'DAILY' | 'BATCH'>('DAILY');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  
  const activeBatches = useMemo(() => data.batches.filter(b => !b.isClosed), [data.batches]);

  // Set default batch if available when switching to BATCH mode
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

  const handleWipeDebt = (customer: any) => {
    if (customer.totalDebt <= 0) return alert('该客户当前无欠款');
    if (confirm(`确认要将客户 [${customer.name}] 的欠款“一笔勾销”吗？\n本次全额核销：¥${customer.totalDebt.toLocaleString()}`)) {
      addRepayment({ id: Date.now().toString(), customerId: customer.id, customerName: customer.name, amount: customer.totalDebt, date: new Date().toISOString(), payee: data.payees[0], note: '快速一笔勾销' });
      alert('✅ 核销成功！');
    }
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

  if (type === 'repayment') {
    return (
      <div className="fixed inset-0 z-[200] bg-[#F1F3F6] flex flex-col animate-in slide-in-from-right">
        {/* 顶部标题栏 */}
        <header className="bg-white px-4 py-4 flex items-center shrink-0 border-b border-gray-100 shadow-sm z-10">
          <button onClick={onClose} className="text-[#3b82f6] text-base font-bold active:scale-95 transition-all">返回</button>
          <h1 className="flex-1 text-center font-black text-lg text-[#1f2937] pr-8">欠款/客户管理</h1>
        </header>

        {/* 搜索栏 */}
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

        {/* 列表区域 */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 no-scrollbar pb-32">
           {customerList.map(c => (
             <div key={c.id} className="bg-white p-5 rounded-[1.2rem] flex justify-between items-center shadow-sm border border-gray-50 active:scale-[0.99] transition-all">
                <div className="space-y-1.5">
                   <p className="text-xl font-black text-[#111827]">{c.name}</p>
                   <p className="text-xs text-[#9ca3af] font-bold">最近交易: {c.lastDate}</p>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-center">
                        <p className="text-xs text-[#9ca3af] font-bold mb-0.5">欠款</p>
                        <p className={`text-2xl font-black ${c.totalDebt > 0 ? 'text-[#ef4444]' : 'text-[#d1d5db]'}`}>¥{c.totalDebt.toLocaleString()}</p>
                   </div>
                   <button 
                        onClick={() => handleWipeDebt(c)}
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

        {/* 新增客户弹窗 */}
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

  // 支出登记弹窗
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end">
       <div className="bg-white w-full rounded-t-[3rem] p-8 space-y-6 animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#111827]">登记经营支出</h2>
            <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400 active:bg-gray-200"><X size={24} /></button>
          </div>

          <div className="space-y-6">
             {/* 归属类型选择 */}
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

             {/* 车次选择 (仅跟车成本显示) */}
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
                  {/* 快捷标签 */}
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