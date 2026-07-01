
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { preciseCalc, downloadCSV } from '../utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { PaymentMethod, OrderStatus, Order, Expense } from '../types';
import { 
  Download, CreditCard, DollarSign, Wallet, 
  TrendingDown, TrendingUp, PieChart, BarChart3, Calendar, Layers, Truck, X, ArrowRight, ArrowLeft,
  Table2, ChevronRight, ChevronDown, Filter, ChevronUp, User, Tag, Clock, Plus, CheckCircle2,
  Store, AlertTriangle
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
  date: string; // Formatted date string based on grain
  rawDate: Date; // For sorting
  productName: string;
  category: string; 
  paymentMethod: string;
  payee: string;
  customerName: string;
  qty: number;
  amount: number; // Can be negative for expenses/costs
  type: 'INCOME' | 'EXPENSE' | 'COST'; // For styling
};

const PivotTable: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data } = useApp();
  
  // 1. New: Time Granularity State
  const [timeGrain, setTimeGrain] = useState<'day' | 'week' | 'month'>('day');

  const [groupBy, setGroupBy] = useState<('date' | 'productName' | 'category' | 'paymentMethod' | 'customerName' | 'payee')[]>(['date', 'category']);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  
  // Filters inside Pivot Table
  const [selectedBatchId, setSelectedBatchId] = useState('ALL');
  const [filterPayee, setFilterPayee] = useState('ALL');
  const [filterMethod, setFilterMethod] = useState('ALL');

  const activeBatches = useMemo(() => data.batches, [data.batches]); // Show all batches for history analysis
  
  const paymentMethodOptions = [
      { id: 'ALL', label: '全部渠道', icon: Wallet },
      { id: PaymentMethod.WECHAT, label: '微信', icon: null },
      { id: PaymentMethod.ALIPAY, label: '支付宝', icon: null },
      { id: PaymentMethod.CASH, label: '现金', icon: null },
      { id: PaymentMethod.OTHER, label: '欠款', icon: null },
  ];

  // Helper: Date Formatter based on Grain
  const formatDate = (dateStr: string | Date): string => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '未知日期';

      if (timeGrain === 'month') {
          return `${d.getFullYear()}年${d.getMonth() + 1}月`;
      }
      if (timeGrain === 'week') {
          // Simple week number
          const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
          const pastDays = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
          const weekNum = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
          return `${d.getFullYear()}年第${weekNum}周`;
      }
      // Day
      return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // 1. Flatten Data with ALL Filters AND Expenses/Costs
  const flatData = useMemo(() => {
    const rows: FlatItem[] = [];

    // --- A. INCOME (Orders) ---
    data.orders.filter(o => o.status === OrderStatus.ACTIVE).forEach(order => {
      if (filterPayee !== 'ALL' && order.payee !== filterPayee) return;
      
      const isMixedMatch = order.paymentMethod === PaymentMethod.MIXED && order.mixedPayments?.some(m => m.method === filterMethod);
      if (filterMethod !== 'ALL' && order.paymentMethod !== filterMethod && !isMixedMatch) return;

      const dateStr = formatDate(order.createdAt);
      
      const payMap: Record<string, string> = { 'WECHAT': '微信', 'ALIPAY': '支付宝', 'CASH': '现金', 'OTHER': '挂账' };
      const payLabel = payMap[order.paymentMethod] || '其他';

      // Calculate ratio for mixed payments if filtering by channel
      let channelRatio = 1;
      if (filterMethod !== 'ALL' && order.paymentMethod === PaymentMethod.MIXED) {
          const channelAmount = order.mixedPayments?.find(m => m.method === filterMethod)?.amount || 0;
          const totalReceived = order.receivedAmount || 1;
          channelRatio = channelAmount / totalReceived;
      }

      order.items.forEach(item => {
        const product = data.products.find(p => p.id === item.productId);
        if (selectedBatchId !== 'ALL') {
            if (product?.batchId !== selectedBatchId) return;
        }

        rows.push({
          date: dateStr,
          rawDate: new Date(order.createdAt),
          productName: item.productName,
          category: product?.category || '其他销售', 
          paymentMethod: payLabel,
          payee: order.payee || '未记录',
          customerName: order.customerName,
          qty: item.qty * channelRatio,
          amount: item.subtotal * channelRatio,
          type: 'INCOME'
        });
      });
    });

    // --- B. EXPENSES (Operational) ---
    // Only include if we are NOT filtering by specific Payment Method/Payee (Expenses don't strictly have these)
    // Or if we want to include them, we treat them as 'General'. 
    // For profit analysis, we usually want to subtract them regardless of payee filter unless strict.
    // Let's hide expenses if specific Payee/Method is selected to avoid confusion, OR keep them separately.
    // Decision: Only show Expenses if filters are 'ALL' to ensure "Profit" makes sense for the whole shop/batch.
    if (filterPayee === 'ALL' && filterMethod === 'ALL') {
        data.expenses.forEach(exp => {
            if (selectedBatchId !== 'ALL' && exp.batchId && exp.batchId !== selectedBatchId) return;
            // If expense has no batchId but we selected a batch, usually we hide it or show as overhead.
            // Let's strictly follow: if expense.batchId exists, it must match.
            if (selectedBatchId !== 'ALL' && !exp.batchId) return; // Hide general expenses when filtering specific batch? Or show? Let's hide to be precise.

            rows.push({
                date: formatDate(exp.date),
                rawDate: new Date(exp.date),
                productName: exp.type, // e.g. "Lunch"
                category: '❌ 运营支出',
                paymentMethod: '现金支出',
                payee: '公共',
                customerName: '无',
                qty: 0,
                amount: -exp.amount, // Negative!
                type: 'EXPENSE'
            });
        });

        // --- C. COST (Batch Purchase Cost) ---
        // Only show if we are looking at ALL batches or a specific batch
        data.batches.forEach(batch => {
            if (selectedBatchId !== 'ALL' && batch.id !== selectedBatchId) return;
            if (batch.cost <= 0) return;

            rows.push({
                date: formatDate(batch.inboundDate),
                rawDate: new Date(batch.inboundDate),
                productName: '货品采购',
                category: '📉 采购成本',
                paymentMethod: '本金支出',
                payee: '老板',
                customerName: '供应商',
                qty: 0,
                amount: -batch.cost, // Negative!
                type: 'COST'
            });
        });
    }

    return rows;
  }, [data.orders, data.products, data.expenses, data.batches, selectedBatchId, filterPayee, filterMethod, timeGrain]);

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
      
      // Sort children
      let children = groupData(groupItems, keys.slice(1), uniqueKey, level + 1);

      return {
        key: uniqueKey,
        label: keyVal,
        qty: totalQty,
        amount: totalAmount,
        level: level,
        children: children
      };
    });

    // Sorting logic
    if (currentKeyField === 'date') {
        // Sort dates chronologically if possible, otherwise string sort
        // Since we grouped by formatted string, string compare works for YYYY-MM, but maybe not MM-DD.
        // Simple string sort for now (or improve with rawDate map)
        rows.sort((a,b) => b.label.localeCompare(a.label)); // Newest first
    } else {
        // Sort by Amount (Profit/Rev) Descending
        rows.sort((a, b) => b.amount - a.amount);
    }

    return rows;
  };

  const pivotData = useMemo(() => {
    const rootChildren = groupData(flatData, groupBy);
    const grandQty = rootChildren.reduce((s, c) => s + c.qty, 0);
    const grandAmount = rootChildren.reduce((s, c) => s + c.amount, 0);
    
    return [
        ...rootChildren,
        { key: 'grand_total', label: '预估毛利 (收入-成本-支出)', qty: grandQty, amount: grandAmount, level: 0, isTotal: true }
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
        className={`px-3 py-2 rounded-lg text-[10px] font-black transition-all whitespace-nowrap ${active ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
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

    // Amount Color: Red for negative (Loss/Expense), Green/Black for positive
    let amountColor = 'text-gray-900';
    if (row.isTotal) amountColor = row.amount >= 0 ? 'text-emerald-600' : 'text-red-500';
    else if (row.amount < 0) amountColor = 'text-red-500';
    else if (row.level === 0) amountColor = 'text-gray-800';

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
             <span className={`font-mono font-bold ${row.isTotal ? 'text-emerald-600' : 'text-gray-400'} text-xs`}>{row.qty > 0 ? row.qty : '-'}</span>
          </div>

          {/* Amount Column */}
          <div className="w-24 text-right">
             <span className={`font-mono font-black ${amountColor} ${row.isTotal ? 'text-sm' : 'text-xs'}`}>
                {row.amount < 0 ? '-' : ''}¥{Math.abs(Math.round(row.amount)).toLocaleString()}
             </span>
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
       <div className="bg-white px-4 py-4 border-b border-gray-100 space-y-3 z-10 shadow-sm">
          
          {/* Filter Row 1: Batch */}
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

          {/* Filter Row 2: Payee & Method Combined Row */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 border-t border-gray-50 pt-2">
             {/* Payee Section */}
             <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
                <User size={12} className="text-gray-400" />
                <button 
                    onClick={() => setFilterPayee('ALL')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${filterPayee === 'ALL' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
                >
                    所有人
                </button>
                {data.payees.map(p => (
                    <button
                        key={p}
                        onClick={() => setFilterPayee(p)}
                        className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${filterPayee === p ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 bg-gray-50'}`}
                    >
                        {p}
                    </button>
                ))}
             </div>

             {/* Method Section */}
             <div className="flex items-center gap-1 pl-1">
                <Wallet size={12} className="text-gray-400" />
                <button 
                    onClick={() => setFilterMethod('ALL')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${filterMethod === 'ALL' ? 'bg-orange-100 text-orange-600' : 'text-gray-400'}`}
                >
                    所有渠道
                </button>
                {paymentMethodOptions.filter(m => m.id !== 'ALL').map(m => (
                    <button
                        key={m.id}
                        onClick={() => setFilterMethod(m.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${filterMethod === m.id ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 bg-gray-50'}`}
                    >
                        {m.label}
                    </button>
                ))}
             </div>
          </div>
          
          {/* Time Granularity Control */}
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2 border-t border-gray-50">
              <Clock size={12} />
              <span>时间粒度 (合并统计)</span>
          </div>
          <div className="flex gap-2">
              {[
                  { id: 'day', label: '按日' },
                  { id: 'week', label: '按周' },
                  { id: 'month', label: '按月' }
              ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTimeGrain(t.id as any)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black border transition-all ${timeGrain === t.id ? 'bg-purple-500 border-purple-500 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
                  >
                      {t.label}
                  </button>
              ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2 border-t border-gray-50">
              <Filter size={12} />
              <span>透视维度 (点击重组报表)</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
             <DimensionButton label="日期 ➔ 分类 (看盈亏)" active={groupBy[0] === 'date' && groupBy[1] === 'category'} onClick={() => setGroupBy(['date', 'category'])} />
             <DimensionButton label="日期 ➔ 商品" active={groupBy[0] === 'date' && groupBy[1] === 'productName'} onClick={() => setGroupBy(['date', 'productName'])} />
             <DimensionButton label="分类 ➔ 商品" active={groupBy[0] === 'category' && groupBy[1] === 'productName'} onClick={() => setGroupBy(['category', 'productName'])} />
             <DimensionButton label="收款人 ➔ 渠道" active={groupBy[0] === 'payee' && groupBy[1] === 'paymentMethod'} onClick={() => setGroupBy(['payee', 'paymentMethod'])} />
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

interface BusinessViewProps {
  onGoToReconcile?: () => void;
}

const EXPENSE_CATEGORIES = ['运费', '人工', '包装', '损耗', '其他'];

const BusinessView: React.FC<BusinessViewProps> = ({ onGoToReconcile }) => {
  const { data, addExpense } = useApp();
  
  // Initialize with today's date
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Filters
  const [filterBatchId, setFilterBatchId] = useState<string>('ALL');
  const [filterPayee, setFilterPayee] = useState<string>('ALL');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');

  const [activeDetail, setActiveDetail] = useState<'revenue' | 'expense' | null>(null);
  const [showPivotTable, setShowPivotTable] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [balanceRange, setBalanceRange] = useState<'today' | 'week' | 'month'>('today');
  const [expenseForm, setExpenseForm] = useState({ amount: '', type: '', note: '' });
  
  // 问题8修复：分页状态
  const [revenueDisplayCount, setRevenueDisplayCount] = useState(50);
  const [expenseDisplayCount, setExpenseDisplayCount] = useState(50);

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
    if (!dateRange.start || !dateRange.end) return { orders: [], expenses: [], repayments: [] };

    const startMs = new Date(dateRange.start + 'T00:00:00').getTime();
    const endMs = new Date(dateRange.end + 'T23:59:59').getTime();

    // 1. Orders
    const orders = data.orders.filter(o => {
      const oTime = new Date(o.createdAt).getTime();
      const inTime = oTime >= startMs && oTime <= endMs;
      const isActive = o.status === OrderStatus.ACTIVE;
      
      let matchBatch = true;
      if (filterBatchId !== 'ALL') {
          const batchProductIds = data.products.filter(p => p.batchId === filterBatchId).map(p => p.id);
          matchBatch = o.items.some(i => batchProductIds.includes(i.productId));
      }

      const matchPayee = filterPayee === 'ALL' || o.payee === filterPayee;
      const matchMethod = filterMethod === 'ALL' || o.paymentMethod === filterMethod || (o.paymentMethod === PaymentMethod.MIXED && o.mixedPayments?.some(m => m.method === filterMethod));

      return inTime && isActive && matchBatch && matchPayee && matchMethod;
    });

    // 2. Expenses
    const expenses = data.expenses.filter(e => {
       const eTime = new Date(e.date).getTime();
       const inTime = eTime >= startMs && eTime <= endMs;
       const inBatch = filterBatchId === 'ALL' || e.batchId === filterBatchId;
       
       // Expenses usually don't have payee/method in this app structure, but if we extended it, we would filter here.
       // For now, if user selects Payee/Method filters, we might want to hide expenses or show all. 
       // To be strict: if PaymentMethod is OTHER (Debt) or Cash, expenses (usually Cash) might apply.
       // Let's keep it simple: Show expenses unless filterMethod excludes CASH? 
       // For safety and simplicity in this logic: Only filter expenses by Batch & Date.
       return inTime && inBatch;
    });

    // 3. Repayments (New: Filter repayments within range)
    const repayments = data.repayments.filter(r => {
        const rTime = new Date(r.date).getTime();
        const inTime = rTime >= startMs && rTime <= endMs;
        const matchBatch = filterBatchId === 'ALL'; // Repayments don't link to batch well, hide if specific batch selected
        
        const matchPayee = filterPayee === 'ALL' || r.payee === filterPayee;
        const matchMethod = filterMethod === 'ALL' || r.paymentMethod === filterMethod || (r.paymentMethod === PaymentMethod.MIXED && r.mixedPayments?.some(m => m.method === filterMethod));

        return inTime && matchBatch && matchPayee && matchMethod;
    });

    return { orders, expenses, repayments };
  }, [data, dateRange, filterBatchId, filterPayee, filterMethod]);


  const stats = useMemo(() => {
    const { orders, expenses, repayments } = filteredData;
    
    // Revenue Calculation (成交额)
    let revenue = 0;
    if (filterMethod === 'ALL') {
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
    } else {
        revenue = orders.reduce((sum, o) => {
            if (o.paymentMethod === filterMethod) return sum + (o.totalAmount - o.discount);
            if (o.paymentMethod === PaymentMethod.MIXED && o.mixedPayments) {
                return sum + (o.mixedPayments.find(m => m.method === filterMethod)?.amount || 0);
            }
            return sum;
        }, 0);
    }

    const totalExpense = (filterMethod === 'ALL' || filterMethod === PaymentMethod.CASH) 
        ? expenses.reduce((sum, e) => sum + e.amount, 0) 
        : 0;

    const expenseByCategory: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(cat => expenseByCategory[cat] = 0);
    expenses.forEach(e => {
      const cat = EXPENSE_CATEGORIES.includes(e.type) ? e.type : '其他';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + e.amount;
    });

    // Summing up cash flow by channel
    // 现金流 = 开单时实收(initialReceivedAmount) + 还款实收
    const sumChannel = (method: PaymentMethod) => {
        if (filterMethod !== 'ALL' && filterMethod !== method) return 0;
        const fromOrders = orders.reduce((sum, o) => {
            if (o.paymentMethod === PaymentMethod.MIXED && o.mixedPayments) {
                return sum + (o.mixedPayments.find(m => m.method === method)?.amount || 0);
            }
            // 用 initialReceivedAmount：开单时收到的那部分（不含后续还款分摊）
            return sum + (o.paymentMethod === method ? (o.initialReceivedAmount || 0) : 0);
        }, 0);
        const fromRepayments = repayments.reduce((sum, r) => {
            if (r.paymentMethod === PaymentMethod.MIXED && r.mixedPayments) {
                return sum + (r.mixedPayments.find(m => m.method === method)?.amount || 0);
            }
            return sum + (r.paymentMethod === method ? r.amount : 0);
        }, 0);
        return fromOrders + fromRepayments;
    };

    const wechat = sumChannel(PaymentMethod.WECHAT);
    const alipay = sumChannel(PaymentMethod.ALIPAY);
    const cash = sumChannel(PaymentMethod.CASH);
    
    const debtIncrease = (filterMethod === 'ALL' || filterMethod === PaymentMethod.OTHER)
        ? orders.reduce((sum, o) => sum + (Math.max(0, (o.totalAmount - o.discount) - o.receivedAmount)), 0)
        : 0;
    
    // 开单时实收（不含后续还款分摊）
    const totalOrderReceived = orders.reduce((sum, o) => {
        if (filterMethod === 'ALL') return sum + (o.initialReceivedAmount || o.receivedAmount);
        if (o.paymentMethod === filterMethod) return sum + (o.initialReceivedAmount || o.receivedAmount);
        if (o.paymentMethod === PaymentMethod.MIXED && o.mixedPayments) {
            return sum + (o.mixedPayments.find(m => m.method === filterMethod)?.amount || 0);
        }
        return sum;
    }, 0);

    const totalRepaid = repayments.reduce((sum, r) => {
        if (filterMethod === 'ALL') return sum + r.amount;
        if (r.paymentMethod === filterMethod) return sum + r.amount;
        if (r.paymentMethod === PaymentMethod.MIXED && r.mixedPayments) {
            return sum + (r.mixedPayments.find(m => m.method === filterMethod)?.amount || 0);
        }
        return sum;
    }, 0);

    const totalReceived = totalOrderReceived + totalRepaid;
    
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

    return { wechat, alipay, cash, revenue, debtIncrease, expenses: totalExpense, balance, chartData, totalRepaid, expenseByCategory };
  }, [filteredData, filterBatchId, data.products]);

  const balanceStats = useMemo(() => {
    const now = new Date();
    let startMs: number;
    
    if (balanceRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startMs = start.getTime();
    } else if (balanceRange === 'week') {
      const day = now.getDay() || 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      startMs = start.getTime();
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startMs = start.getTime();
    }

    const rangeOrders = data.orders.filter(o => 
      o.status === OrderStatus.ACTIVE && new Date(o.createdAt).getTime() >= startMs
    );
    const rangeRepayments = data.repayments.filter(r => 
      new Date(r.date).getTime() >= startMs
    );
    const rangeExpenses = data.expenses.filter(e => 
      new Date(e.date).getTime() >= startMs
    );

    const totalIncome = rangeOrders.reduce((sum, o) => sum + o.receivedAmount, 0) + 
                        rangeRepayments.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = rangeExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netBalance = totalIncome - totalExpense;

    return { totalIncome, totalExpense, netBalance };
  }, [data, balanceRange]);

  const handleAddExpense = () => {
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      alert('请输入有效金额');
      return;
    }
    if (!expenseForm.type) {
      alert('请选择或输入支出类目');
      return;
    }

    addExpense({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: parseFloat(expenseForm.amount),
      type: expenseForm.type,
      date: new Date().toISOString(),
      note: expenseForm.note || ''
    });

    setExpenseForm({ amount: '', type: '', note: '' });
    setShowAddExpense(false);
    alert('✅ 支出登记成功！');
  };

  const handleExport = async () => {
    // Export filtered data to CSV
    const { orders, expenses } = filteredData;
    
    // 1. Orders CSV
    const orderHeaders = ['订单号', '时间', '客户', '商品明细', '总金额', '优惠', '实收', '支付方式', '收款人', '状态'];
    const orderRows = orders.map(o => [
        o.orderNo,
        new Date(o.createdAt).toLocaleString(),
        o.customerName,
        o.items.map(i => `${i.productName}x${i.qty}`).join('; '),
        o.totalAmount,
        o.discount,
        o.receivedAmount,
        o.paymentMethod,
        o.payee,
        o.status
    ]);
    
    // 2. Expenses CSV
    const expenseHeaders = ['时间', '类型', '金额', '备注', '车次ID'];
    const expenseRows = expenses.map(e => [
        new Date(e.date).toLocaleString(),
        e.type,
        e.amount,
        e.note || '',
        e.batchId || ''
    ]);

    const timestamp = new Date().toISOString().split('T')[0];
    
    // Download Orders
    if (orderRows.length > 0) {
        await downloadCSV(orderHeaders, orderRows, `Orders_${timestamp}.csv`);
    }
    
    // Download Expenses
    if (expenseRows.length > 0) {
        // Small delay to ensure both downloads trigger if on web, or sequential share on mobile
        setTimeout(async () => {
             await downloadCSV(expenseHeaders, expenseRows, `Expenses_${timestamp}.csv`);
        }, 1000);
    }

    if (orderRows.length === 0 && expenseRows.length === 0) {
        alert('当前筛选条件下没有数据可导出');
    }
  };

  if (showPivotTable) {
      return <PivotTable onClose={() => setShowPivotTable(false)} />;
  }

  const paymentMethodOptions = [
      { id: 'ALL', label: '全部渠道', icon: Wallet },
      { id: PaymentMethod.WECHAT, label: '微信', icon: null },
      { id: PaymentMethod.ALIPAY, label: '支付宝', icon: null },
      { id: PaymentMethod.CASH, label: '现金', icon: null },
      { id: PaymentMethod.OTHER, label: '欠款/挂账', icon: null },
  ];

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
             {/* 问题7修复：快捷日期按钮组 */}
             <div className="flex gap-2 mb-2">
               <button 
                 onClick={() => {
                   const today = new Date();
                   const todayStr = today.toISOString().slice(0, 10);
                   setDateRange({ start: todayStr, end: todayStr });
                 }}
                 className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-all"
               >
                 今天
               </button>
               <button 
                 onClick={() => {
                   const yesterday = new Date();
                   yesterday.setDate(yesterday.getDate() - 1);
                   const yesterdayStr = yesterday.toISOString().slice(0, 10);
                   setDateRange({ start: yesterdayStr, end: yesterdayStr });
                 }}
                 className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-all"
               >
                 昨天
               </button>
               <button 
                 onClick={() => {
                   const today = new Date();
                   const day = today.getDay();
                   const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 周一
                   const monday = new Date(today);
                   monday.setDate(diff);
                   const mondayStr = monday.toISOString().slice(0, 10);
                   const todayStr = today.toISOString().slice(0, 10);
                   setDateRange({ start: mondayStr, end: todayStr });
                 }}
                 className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-all"
               >
                 本周
               </button>
               <button 
                 onClick={() => {
                   const today = new Date();
                   const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                   const firstDayStr = firstDay.toISOString().slice(0, 10);
                   const todayStr = today.toISOString().slice(0, 10);
                   setDateRange({ start: firstDayStr, end: todayStr });
                 }}
                 className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-all"
               >
                 本月
               </button>
             </div>
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

             {/* Batch Selector */}
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button 
                    onClick={() => setFilterBatchId('ALL')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${filterBatchId === 'ALL' ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                    <Layers size={12} /> 全部车次
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

             {/* Advanced Filters (Payee & Method) */}
             <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                 {/* Payee Filter */}
                 <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setFilterPayee('ALL')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all border ${filterPayee === 'ALL' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                        <User size={12} /> 全体人员
                    </button>
                    {data.payees.map(p => (
                        <button
                            key={p}
                            onClick={() => setFilterPayee(p)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all border ${filterPayee === p ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500'}`}
                        >
                            {p}
                        </button>
                    ))}
                 </div>

                 {/* Method Filter */}
                 <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {paymentMethodOptions.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setFilterMethod(m.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all border ${filterMethod === m.id ? 'bg-orange-500 border-orange-500 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500'}`}
                        >
                            {m.icon && <m.icon size={12} />}
                            {m.label}
                        </button>
                    ))}
                 </div>
             </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32 no-scrollbar">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-slate-800">
            <CreditCard size={18} className="text-blue-500" />
            <h3 className="font-black text-sm">收款账户明细 (含回款)</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(filterMethod === 'ALL' || filterMethod === PaymentMethod.WECHAT) && (
              <div className="bg-[#F0FDF4] p-4 rounded-2xl text-center border border-emerald-50">
                <p className="text-[10px] text-emerald-600 font-black mb-1">💬 微信</p>
                <p className="text-lg font-black text-emerald-900">¥{stats.wechat.toLocaleString()}</p>
              </div>
            )}
            {(filterMethod === 'ALL' || filterMethod === PaymentMethod.ALIPAY) && (
              <div className="bg-[#EFF6FF] p-4 rounded-2xl text-center border border-blue-50">
                <p className="text-[10px] text-blue-600 font-black mb-1">💳 支付宝</p>
                <p className="text-lg font-black text-blue-900">¥{stats.alipay.toLocaleString()}</p>
              </div>
            )}
            {(filterMethod === 'ALL' || filterMethod === PaymentMethod.CASH) && (
              <div className="bg-[#FFFBEB] p-4 rounded-2xl text-center border border-amber-50">
                <p className="text-[10px] text-amber-600 font-black mb-1">💰 现金</p>
                <p className="text-lg font-black text-amber-900">¥{stats.cash.toLocaleString()}</p>
              </div>
            )}
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
              <p className="text-[10px] font-black uppercase tracking-widest">实收结余</p>
            </div>
            {/* 这里的结余包含了 回款 - 支出 */}
            <p className="text-3xl font-black text-blue-600 tracking-tighter">¥{stats.balance.toLocaleString()}</p>
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

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <TrendingUp size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">回款与欠款</p>
            </div>
            <div className="flex justify-between items-end">
                <div>
                    <p className="text-[10px] font-bold text-emerald-500">收回 ¥{stats.totalRepaid.toLocaleString()}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-red-400">新增 ¥{stats.debtIncrease.toLocaleString()}</p>
                </div>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-400 h-full" style={{ width: `${stats.totalRepaid / (stats.totalRepaid + stats.debtIncrease + 1) * 100}%` }}></div>
                <div className="bg-red-300 h-full" style={{ width: `${stats.debtIncrease / (stats.totalRepaid + stats.debtIncrease + 1) * 100}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-800">
              <Wallet size={18} className="text-purple-500" />
              <h3 className="font-black text-sm">收支结余</h3>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'today', label: '今日' },
                { id: 'week', label: '本周' },
                { id: 'month', label: '本月' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setBalanceRange(r.id as 'today' | 'week' | 'month')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${balanceRange === r.id ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#ECFDF5] p-4 rounded-2xl text-center border border-emerald-50">
              <p className="text-[10px] text-emerald-600 font-black mb-1">总收入</p>
              <p className="text-lg font-black text-emerald-900">¥{balanceStats.totalIncome.toLocaleString()}</p>
            </div>
            <div className="bg-[#FFF7ED] p-4 rounded-2xl text-center border border-orange-50">
              <p className="text-[10px] text-orange-600 font-black mb-1">总支出</p>
              <p className="text-lg font-black text-orange-900">¥{balanceStats.totalExpense.toLocaleString()}</p>
            </div>
            <div className="bg-[#F5F3FF] p-4 rounded-2xl text-center border border-purple-50">
              <p className="text-[10px] text-purple-600 font-black mb-1">结余</p>
              <p className={`text-lg font-black ${balanceStats.netBalance >= 0 ? 'text-purple-900' : 'text-red-600'}`}>
                ¥{balanceStats.netBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-slate-800">
            <Tag size={18} className="text-orange-500" />
            <h3 className="font-black text-sm">支出分类汇总</h3>
          </div>
          <div className="space-y-3">
            {EXPENSE_CATEGORIES.map(cat => {
              const amount = stats.expenseByCategory[cat] || 0;
              const percent = stats.expenses > 0 ? (amount / stats.expenses) * 100 : 0;
              const colors: Record<string, string> = {
                '运费': 'bg-blue-400',
                '人工': 'bg-emerald-400',
                '包装': 'bg-purple-400',
                '损耗': 'bg-red-400',
                '其他': 'bg-gray-400'
              };
              return (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600">{cat}</span>
                    <span className="text-xs font-black text-slate-800">¥{amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`${colors[cat] || 'bg-gray-400'} h-full rounded-full transition-all`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
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
                <h1 className="text-lg font-black flex-1 text-center">
                    {activeDetail === 'revenue' ? '营收明细 (实成交)' : '支出明细'}
                </h1>
                {activeDetail === 'expense' && (
                    <button 
                        onClick={() => setShowAddExpense(true)}
                        className="p-2 -mr-2 rounded-full bg-emerald-500 text-white active:scale-95 transition-all"
                    >
                        <Plus size={20} />
                    </button>
                )}
                {activeDetail === 'revenue' && <div className="w-10"></div>}
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 no-scrollbar">
                {activeDetail === 'revenue' ? (
                     (() => {
                       // 问题8修复：分页逻辑
                       const visibleOrders = filteredData.orders.slice(0, revenueDisplayCount);
                       return (
                         <>
                           {visibleOrders.length > 0 ? visibleOrders.map(o => (
                             <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50">
                                 <div className="flex justify-between items-center mb-1">
                                    <span className="font-black text-gray-800">{o.customerName}</span>
                                    <span className="text-emerald-600 font-black">
                                        ¥{filterMethod === 'ALL' 
                                            ? (o.totalAmount - o.discount).toLocaleString() 
                                            : (o.paymentMethod === filterMethod 
                                                ? (o.totalAmount - o.discount).toLocaleString() 
                                                : (o.mixedPayments?.find(m => m.method === filterMethod)?.amount || 0).toLocaleString())}
                                    </span>
                                 </div>
                                 <div className="text-xs text-gray-400 mb-2">
                                    {o.items.map(i => `${i.productName}x${i.qty}`).join(', ')}
                                 </div>
                                 <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase items-center">
                                    <span>{o.orderNo}</span>
                                    <span className="flex items-center gap-1">
                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{o.payee}</span>
                                        <span>{new Date(o.createdAt).toLocaleString()}</span>
                                    </span>
                                 </div>
                                 {o.discount > 0 && (
                                     <div className="mt-2 text-[10px] text-orange-400 font-bold bg-orange-50 p-1.5 rounded inline-block">
                                         已优惠/抹零: ¥{o.discount}
                                     </div>
                                 )}
                             </div>
                           )) : <div className="text-center py-20 text-gray-400 font-bold">无记录</div>}
                           {filteredData.orders.length > revenueDisplayCount && (
                             <button 
                               onClick={() => setRevenueDisplayCount(prev => prev + 50)}
                               className="w-full py-3 text-emerald-600 text-sm font-medium hover:bg-emerald-50 rounded-xl transition-all"
                             >
                               加载更多（还剩 {filteredData.orders.length - revenueDisplayCount} 条）
                             </button>
                           )}
                         </>
                       );
                     })()
                ) : (
                     (() => {
                       // 问题8修复：分页逻辑
                       const visibleExpenses = filteredData.expenses.slice(0, expenseDisplayCount);
                       return (
                         <>
                           {visibleExpenses.length > 0 ? visibleExpenses.map(e => {
                              const category = EXPENSE_CATEGORIES.includes(e.type) ? e.type : '其他';
                              const tagColors: Record<string, string> = {
                                  '运费': 'bg-blue-50 text-blue-600 border-blue-100',
                                  '人工': 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                  '包装': 'bg-purple-50 text-purple-600 border-purple-100',
                                  '损耗': 'bg-red-50 text-red-600 border-red-100',
                                  '其他': 'bg-gray-50 text-gray-600 border-gray-100'
                              };
                              return (
                                  <div key={e.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 flex justify-between items-center">
                                      <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${tagColors[category] || tagColors['其他']}`}>
                                                  {category}
                                              </span>
                                          </div>
                                          <p className="font-black text-gray-800">{e.type}</p>
                                          <p className="text-[10px] text-gray-400 font-bold">{new Date(e.date).toLocaleString()}</p>
                                          {e.note && <p className="text-[10px] text-gray-400">备注: {e.note}</p>}
                                      </div>
                                      <p className="font-black text-xl text-orange-500">-¥{e.amount.toLocaleString()}</p>
                                  </div>
                              );
                           }) : <div className="text-center py-20 text-gray-400 font-bold">无记录</div>}
                           {filteredData.expenses.length > expenseDisplayCount && (
                             <button 
                               onClick={() => setExpenseDisplayCount(prev => prev + 50)}
                               className="w-full py-3 text-emerald-600 text-sm font-medium hover:bg-emerald-50 rounded-xl transition-all"
                             >
                               加载更多（还剩 {filteredData.expenses.length - expenseDisplayCount} 条）
                             </button>
                           )}
                         </>
                       );
                     })()
                )}
            </div>
         </div>
      )}

      {showAddExpense && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-8 space-y-6 animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-800">登记经营支出</h2>
                <button onClick={() => setShowAddExpense(false)} className="p-3 bg-gray-100 rounded-full text-gray-400 active:bg-gray-200"><X size={24} /></button>
              </div>

              <div className="space-y-6">
                 <div className="space-y-3">
                    <label className="text-xs text-gray-400 font-black uppercase tracking-widest px-2">支出分类</label>
                    <div className="flex flex-wrap gap-2">
                      {EXPENSE_CATEGORIES.map(cat => {
                        const colors: Record<string, string> = {
                            '运费': 'bg-blue-50 text-blue-600 border-blue-200',
                            '人工': 'bg-emerald-50 text-emerald-600 border-emerald-200',
                            '包装': 'bg-purple-50 text-purple-600 border-purple-200',
                            '损耗': 'bg-red-50 text-red-600 border-red-200',
                            '其他': 'bg-gray-50 text-gray-600 border-gray-200'
                        };
                        const isActive = expenseForm.type === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setExpenseForm({...expenseForm, type: cat})}
                                className={`px-4 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${isActive ? colors[cat] + ' shadow-sm' : 'bg-white text-gray-400 border-gray-100'}`}
                            >
                                {cat}
                            </button>
                        );
                      })}
                    </div>
                 </div>

                 <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-black uppercase tracking-widest px-2">支出类目</label>
                  <input 
                    value={expenseForm.type} 
                    onChange={e=>setExpenseForm({...expenseForm, type: e.target.value})} 
                    placeholder="例如：运费、人工费"
                    className="w-full bg-gray-50 p-5 rounded-2xl font-black outline-none shadow-inner border-2 border-transparent focus:border-emerald-100 focus:bg-white transition-all" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-black uppercase tracking-widest px-2">金额 (元)</label>
                  <input 
                    type="number" 
                    value={expenseForm.amount} 
                    onChange={e=>setExpenseForm({...expenseForm, amount: e.target.value})} 
                    placeholder="0.00" 
                    className="w-full bg-gray-50 p-5 rounded-2xl font-black text-4xl text-emerald-600 outline-none shadow-inner border-2 border-transparent focus:border-emerald-100 focus:bg-white transition-all" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-black uppercase tracking-widest px-2">备注</label>
                  <input 
                    value={expenseForm.note} 
                    onChange={e=>setExpenseForm({...expenseForm, note: e.target.value})} 
                    placeholder="选填"
                    className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none shadow-inner border-2 border-transparent focus:border-emerald-100 focus:bg-white transition-all" 
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
    )}
    </div>
  );
};

export default BusinessView;
