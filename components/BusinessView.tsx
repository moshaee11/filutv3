import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { preciseCalc } from '../utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { PaymentMethod, OrderStatus, Order, Expense } from '../types';
import { 
  Download, CreditCard, DollarSign, Wallet, 
  TrendingDown, TrendingUp, PieChart, BarChart3, Calendar, Layers, Truck, X, ArrowRight, ArrowLeft,
  Table2, ChevronRight, ChevronDown, Filter, ChevronUp
} from 'lucide-react';

// --- Pivot Table Types & Components ---

type PivotRow = {
  key: string;
  label: string;
  qty: number;
  amount: number;
  children?: PivotRow[];
  level: number;
};

type FlatItem = {
  date: string;
  productName: string;
  category: string; 
  paymentMethod: string;
  customerName: string;
  qty: number;
  amount: number;
};

const PivotTable: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data } = useApp();
  const [groupBy, setGroupBy] = useState<('date' | 'productName' | 'paymentMethod' | 'customerName')[]>(['date', 'productName']);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  
  // Batch Filter State inside Pivot Table
  const [selectedBatchId, setSelectedBatchId] = useState('ALL');
  const activeBatches = useMemo(() => data.batches.filter(b => !b.isClosed), [data.batches]);

  // 1. Flatten Data with Batch Filtering
  const flatData = useMemo(() => {
    const rows: FlatItem[] = [];
    data.orders.filter(o => o.status === OrderStatus.ACTIVE).forEach(order => {
      const dateObj = new Date(order.createdAt);
      const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`; // MM月DD日 format
      
      const payMap: Record<string, string> = { 'WECHAT': '微信', 'ALIPAY': '支付宝', 'CASH': '现金', 'OTHER': '挂账' };
      const payLabel = payMap[order.paymentMethod] || '其他';

      order.items.forEach(item => {
        // Filter Logic: Check if product belongs to selected batch
        const product = data.products.find(p => p.id === item.productId);
        if (selectedBatchId !== 'ALL') {
            if (product?.batchId !== selectedBatchId) return; // Skip this item
        }

        rows.push({
          date: dateStr,
          productName: item.productName,
          category: item.productName.includes('果') ? '大果' : '其他', 
          paymentMethod: payLabel,
          customerName: order.customerName,
          qty: item.qty,
          amount: item.subtotal 
        });
      });
    });
    return rows;
  }, [data.orders, data.products, selectedBatchId]);

  // 2. Recursive Grouping Logic
  const groupData = (items: FlatItem[], keys: string[], parentKey: string = '', level: number = 0): PivotRow[] => {
    if (keys.length === 0) return [];

    const currentKeyField = keys[0] as keyof FlatItem;
    const groups: Record<string, FlatItem[]> = {};

    items.forEach(item => {
      const val = String(item[currentKeyField]);
      if (!groups[val]) groups[val] = [];
      groups[val].push(item);
    });

    const rows: PivotRow[] = Object.entries(groups).map(([keyVal, groupItems]) => {
      const uniqueKey = `${parentKey}-${keyVal}`;
      const totalQty = groupItems.reduce((sum, i) => sum + i.qty, 0);
      const totalAmount = groupItems.reduce((sum, i) => sum + i.amount, 0);
      
      return {
        key: uniqueKey,
        label: keyVal,
        qty: totalQty,
        amount: totalAmount,
        level: level,
        children: groupData(groupItems, keys.slice(1), uniqueKey, level + 1)
      };
    });

    if (currentKeyField === 'date') {
       rows.sort((a,b) => a.label.localeCompare(b.label)); 
    } else {
       rows.sort((a, b) => b.amount - a.amount);
    }

    return rows;
  };

  const pivotData = useMemo(() => {
    const rootChildren = groupData(flatData, groupBy);
    const grandQty = rootChildren.reduce((s, c) => s + c.qty, 0);
    const grandAmount = rootChildren.reduce((s, c) => s + c.amount, 0);
    
    // Auto expand top level if there are few items
    if (rootChildren.length < 5 && expandedKeys.size === 0) {
        // Effect handled outside render ideally, but acceptable here for init
        // setExpandedKeys(new Set(rootChildren.map(r => r.key)));
    }

    return [
        ...rootChildren,
        { key: 'grand_total', label: '总计', qty: grandQty, amount: grandAmount, level: 0, isTotal: true }
    ];
  }, [flatData, groupBy]);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
        const newSet = new Set(prev);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        return newSet;
    });
  };

  const DimensionButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${active ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-gray-100 text-gray-500'}`}
    >
        {label}
    </button>
  );

  // Render Row Recursive
  const renderRow = (row: PivotRow & { isTotal?: boolean }) => {
    const isExpanded = expandedKeys.has(row.key);
    const hasChildren = row.children && row.children.length > 0;
    const paddingLeft = row.level * 16 + 16; 

    const bgColor = row.isTotal ? 'bg-emerald-50' : (row.level === 0 ? 'bg-white' : 'bg-gray-50/50');
    const labelStyle = row.level === 0 ? 'font-black text-gray-800 text-sm' : 'font-bold text-gray-500 text-xs';
    const borderStyle = row.level === 0 ? 'border-b border-gray-100' : 'border-b border-gray-100 border-dashed';

    return (
      <React.Fragment key={row.key}>
        <div 
            onClick={() => hasChildren && toggleExpand(row.key)}
            className={`flex items-center py-3 pr-4 active:bg-gray-50 transition-colors ${bgColor} ${borderStyle}`}
        >
          {/* Label Column */}
          <div className="flex-1 flex items-center gap-2" style={{ paddingLeft }}>
            {hasChildren && (
                <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${isExpanded ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {isExpanded ? <ChevronDown size={12} strokeWidth={3} /> : <ChevronRight size={12} strokeWidth={3} />}
                </div>
            )}
            {!hasChildren && <div className="w-5"></div>}
            <span className={labelStyle}>{row.label}</span>
          </div>

          {/* Qty Column */}
          <div className="w-20 text-right">
             <span className={`font-mono font-bold ${row.isTotal ? 'text-emerald-600' : 'text-gray-500'} text-xs`}>{row.qty}</span>
          </div>

          {/* Amount Column */}
          <div className="w-24 text-right">
             <span className={`font-mono font-black ${row.isTotal ? 'text-emerald-600 text-sm' : 'text-gray-900 text-xs'}`}>¥{Math.round(row.amount).toLocaleString()}</span>
          </div>
        </div>
        {hasChildren && isExpanded && row.children!.map(child => renderRow(child as any))}
      </React.Fragment>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#F4F6F9] flex flex-col animate-in slide-in-from-right">
       <header className="bg-white px-4 py-4 flex items-center shrink-0 shadow-sm z-10">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full active:bg-gray-100"><ArrowLeft size={20}/></button>
            <h1 className="text-lg font-black flex-1 text-center pr-8">高级透视分析</h1>
       </header>

       {/* Controls */}
       <div className="bg-white px-4 py-4 border-b border-gray-100 space-y-3 z-10">
          
          {/* Batch Selector in Pivot Table */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
             <button 
                onClick={() => setSelectedBatchId('ALL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${selectedBatchId === 'ALL' ? 'bg-gray-800 border-gray-800 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
             >
                <Layers size={12} /> 全部车次
             </button>
             {activeBatches.map(batch => (
                <button
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${selectedBatchId === batch.id ? 'bg-emerald-50 border-emerald-500 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                <Truck size={12} /> {batch.plateNumber}
                </button>
             ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2 border-t border-gray-50">
              <Filter size={12} />
              <span>分析维度 (点击切换)</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
             <DimensionButton label="日期 ➔ 商品" active={groupBy[0] === 'date' && groupBy[1] === 'productName'} onClick={() => setGroupBy(['date', 'productName'])} />
             <DimensionButton label="商品 ➔ 日期" active={groupBy[0] === 'productName' && groupBy[1] === 'date'} onClick={() => setGroupBy(['productName', 'date'])} />
             <DimensionButton label="日期 ➔ 支付" active={groupBy[0] === 'date' && groupBy[1] === 'paymentMethod'} onClick={() => setGroupBy(['date', 'paymentMethod'])} />
             <DimensionButton label="客户 ➔ 商品" active={groupBy[0] === 'customerName' && groupBy[1] === 'productName'} onClick={() => setGroupBy(['customerName', 'productName'])} />
          </div>
       </div>

       {/* Table Header */}
       <div className="bg-gray-100 flex items-center py-2 pr-4 border-b border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-wider shrink-0 sticky top-0">
          <div className="flex-1 pl-4">分组名称</div>
          <div className="w-20 text-right">数量(件)</div>
          <div className="w-24 text-right">金额(元)</div>
       </div>

       {/* Scrollable List */}
       <div className="flex-1 overflow-y-auto bg-white pb-32 no-scrollbar">
           {pivotData.map(row => renderRow(row as any))}
           <div className="h-20"></div>
       </div>
    </div>
  );
};

// --- Main BusinessView Component ---

const BusinessView: React.FC = () => {
  const { data } = useApp();
  
  // Initialize with today's date
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterBatchId, setFilterBatchId] = useState<string>('ALL');
  const [activeDetail, setActiveDetail] = useState<'revenue' | 'expense' | null>(null);
  const [showPivotTable, setShowPivotTable] = useState(false);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    setDateRange({ start: todayStr, end: todayStr });
  }, []);

  // Filter Data Logic
  const filteredData = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return { orders: [], expenses: [] };

    const startMs = new Date(dateRange.start + 'T00:00:00').getTime();
    const endMs = new Date(dateRange.end + 'T23:59:59').getTime();

    const orders = data.orders.filter(o => {
      const oTime = new Date(o.createdAt).getTime();
      const inTime = oTime >= startMs && oTime <= endMs;
      const isActive = o.status === OrderStatus.ACTIVE;
      
      let inBatch = true;
      if (filterBatchId !== 'ALL') {
          const batchProductIds = data.products.filter(p => p.batchId === filterBatchId).map(p => p.id);
          inBatch = o.items.some(i => batchProductIds.includes(i.productId));
      }

      return inTime && isActive && inBatch;
    });

    const expenses = data.expenses.filter(e => {
       const eTime = new Date(e.date).getTime();
       const inTime = eTime >= startMs && eTime <= endMs;
       const inBatch = filterBatchId === 'ALL' || e.batchId === filterBatchId;
       return inTime && inBatch;
    });

    return { orders, expenses };
  }, [data, dateRange, filterBatchId]);


  const stats = useMemo(() => {
    const { orders, expenses } = filteredData;
    
    // Revenue Calculation (修正：扣除折扣)
    let revenue = 0;
    if (filterBatchId === 'ALL') {
        revenue = orders.reduce((sum, o) => sum + (o.totalAmount - o.discount), 0);
    } else {
        const batchProductIds = data.products.filter(p => p.batchId === filterBatchId).map(p => p.id);
        orders.forEach(o => {
            const orderSubtotal = o.items.reduce((s, i) => s + i.subtotal, 0);
            let batchSubtotalInOrder = 0;
            o.items.forEach(i => {
                if (batchProductIds.includes(i.productId)) {
                    batchSubtotalInOrder += i.subtotal;
                }
            });
            if (orderSubtotal > 0) {
               const ratio = batchSubtotalInOrder / orderSubtotal;
               const allocatedDiscount = o.discount * ratio;
               revenue += (batchSubtotalInOrder - allocatedDiscount);
            }
        });
    }

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const wechat = orders.filter(o => o.paymentMethod === PaymentMethod.WECHAT).reduce((sum, o) => sum + o.receivedAmount, 0);
    const alipay = orders.filter(o => o.paymentMethod === PaymentMethod.ALIPAY).reduce((sum, o) => sum + o.receivedAmount, 0);
    const cash = orders.filter(o => o.paymentMethod === PaymentMethod.CASH).reduce((sum, o) => sum + o.receivedAmount, 0);
    
    // 欠款 = 成交价 - 实收
    const debt = orders.reduce((sum, o) => sum + (Math.max(0, (o.totalAmount - o.discount) - o.receivedAmount)), 0);
    
    const totalReceived = orders.reduce((sum, o) => sum + o.receivedAmount, 0);
    const balance = totalReceived - totalExpense;

    const productSalesMap = new Map<string, number>();
    orders.forEach(order => {
      order.items.forEach(item => {
        if (filterBatchId === 'ALL' || data.products.find(p => p.id === item.productId)?.batchId === filterBatchId) {
            const current = productSalesMap.get(item.productName) || 0;
            productSalesMap.set(item.productName, current + item.subtotal);
        }
      });
    });

    const chartData = Array.from(productSalesMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return { wechat, alipay, cash, revenue, debt, expenses: totalExpense, balance, chartData };
  }, [filteredData, filterBatchId, data.products]);

  const handleExport = () => {
    alert('请前往“我的”页面进行完整数据导出。');
  };

  if (showPivotTable) {
      return <PivotTable onClose={() => setShowPivotTable(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col overflow-hidden">
      <header className="px-6 pt-8 pb-4 bg-white shrink-0 shadow-sm z-20 rounded-b-[2rem]">
        <div className="flex justify-between items-end mb-4">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">经营概况</h1>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowPivotTable(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black border border-blue-100 active:scale-95 transition-all shadow-sm"
                >
                    <Table2 size={16} /> 多维报表
                </button>
                <button 
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black border border-emerald-100 active:scale-95 transition-all"
                >
                    <Download size={16} /> 导出
                </button>
            </div>
        </div>
        
        {/* Filters */}
        <div className="space-y-3">
             <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <Calendar size={16} className="text-slate-400 ml-2" />
                <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24"
                />
                <span className="text-slate-300">-</span>
                <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24"
                />
             </div>

             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button 
                    onClick={() => setFilterBatchId('ALL')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${filterBatchId === 'ALL' ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                    <Layers size={12} /> 全部
                </button>
                {data.batches.filter(b => !b.isClosed).map(batch => (
                    <button
                    key={batch.id}
                    onClick={() => setFilterBatchId(batch.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${filterBatchId === batch.id ? 'bg-emerald-50 border-emerald-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}
                    >
                    <Truck size={12} /> {batch.plateNumber}
                    </button>
                ))}
             </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32 no-scrollbar">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-slate-800">
            <CreditCard size={18} className="text-blue-500" />
            <h3 className="font-black text-sm">收款账户明细 (筛选范围内)</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#F0FDF4] p-4 rounded-2xl text-center border border-emerald-50">
              <p className="text-[10px] text-emerald-600 font-black mb-1">💬 微信</p>
              <p className="text-lg font-black text-emerald-900">¥{stats.wechat.toLocaleString()}</p>
            </div>
            <div className="bg-[#EFF6FF] p-4 rounded-2xl text-center border border-blue-50">
              <p className="text-[10px] text-blue-600 font-black mb-1">💳 支付宝</p>
              <p className="text-lg font-black text-blue-900">¥{stats.alipay.toLocaleString()}</p>
            </div>
            <div className="bg-[#FFFBEB] p-4 rounded-2xl text-center border border-amber-50">
              <p className="text-[10px] text-amber-600 font-black mb-1">💰 现金</p>
              <p className="text-lg font-black text-amber-900">¥{stats.cash.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div 
             onClick={() => setActiveDetail('revenue')}
             className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-1 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1 relative z-10">
               <div className="flex items-center gap-1.5">
                    <DollarSign size={14} />
                    <p className="text-[10px] font-black uppercase tracking-widest">营收总额</p>
               </div>
               <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter relative z-10">¥{stats.revenue.toLocaleString()}</p>
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Wallet size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">欠款增加</p>
            </div>
            <p className="text-3xl font-black text-red-500 tracking-tighter">¥{stats.debt.toLocaleString()}</p>
          </div>

          <div 
            onClick={() => setActiveDetail('expense')}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-1 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1 relative z-10">
               <div className="flex items-center gap-1.5">
                    <TrendingDown size={14} />
                    <p className="text-[10px] font-black uppercase tracking-widest">各项开支</p>
               </div>
               <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-black text-orange-500 tracking-tighter relative z-10">¥{stats.expenses.toLocaleString()}</p>
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <TrendingUp size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">实收结余</p>
            </div>
            <p className="text-3xl font-black text-blue-600 tracking-tighter">¥{stats.balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-8 text-slate-800">
            <PieChart size={18} className="text-orange-500" />
            <h3 className="font-black text-sm">热销单品 TOP5 (按金额)</h3>
          </div>
          
          <div className="h-[300px] w-full">
            {stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={80} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 900, fill: '#64748B' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }} 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="amount" radius={[0, 10, 10, 0]} barSize={28}>
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#FB923C' : '#CBD5E1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                <BarChart3 size={48} strokeWidth={1} />
                <p className="text-xs font-black uppercase tracking-widest">暂无活跃数据</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Overlay */}
      {activeDetail && (
         <div className="fixed inset-0 z-[200] bg-[#F4F6F9] flex flex-col animate-in slide-in-from-right">
             <header className="bg-white px-4 py-4 border-b flex items-center shrink-0 shadow-sm z-10">
                <button onClick={() => setActiveDetail(null)} className="p-2 -ml-2 rounded-full active:bg-gray-100"><ArrowLeft size={20}/></button>
                <h1 className="text-lg font-black flex-1 text-center pr-8">
                    {activeDetail === 'revenue' ? '营收明细 (实成交)' : '支出明细'}
                </h1>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 no-scrollbar">
                {activeDetail === 'revenue' ? (
                     filteredData.orders.length > 0 ? filteredData.orders.map(o => (
                         <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50">
                             <div className="flex justify-between items-center mb-1">
                                <span className="font-black text-gray-800">{o.customerName}</span>
                                <span className="text-emerald-600 font-black">¥{preciseCalc(() => o.totalAmount - o.discount)}</span>
                             </div>
                             <div className="text-xs text-gray-400 mb-2">
                                {o.items.map(i => `${i.productName}x${i.qty}`).join(', ')}
                             </div>
                             <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                                <span>{o.orderNo}</span>
                                <span>{new Date(o.createdAt).toLocaleString()}</span>
                             </div>
                             {o.discount > 0 && (
                                 <div className="mt-2 text-[10px] text-orange-400 font-bold bg-orange-50 p-1.5 rounded inline-block">
                                     已优惠/抹零: ¥{o.discount}
                                 </div>
                             )}
                         </div>
                     )) : <div className="text-center py-20 text-gray-400 font-bold">无记录</div>
                ) : (
                     filteredData.expenses.length > 0 ? filteredData.expenses.map(e => (
                         <div key={e.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 flex justify-between items-center">
                            <div>
                                <p className="font-black text-gray-800">{e.type}</p>
                                <p className="text-[10px] text-gray-400 font-bold">{new Date(e.date).toLocaleString()}</p>
                            </div>
                            <p className="font-black text-xl text-orange-500">-¥{e.amount}</p>
                         </div>
                     )) : <div className="text-center py-20 text-gray-400 font-bold">无记录</div>
                )}
            </div>
         </div>
      )}
    </div>
  );
};

export default BusinessView;