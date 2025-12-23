
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { PaymentMethod, OrderStatus } from '../types';
import { 
  Download, CreditCard, DollarSign, Wallet, 
  TrendingDown, TrendingUp, PieChart, BarChart3 
} from 'lucide-react';

const BusinessView: React.FC = () => {
  const { data } = useApp();
  const [timeMode, setTimeMode] = useState<'today' | 'all'>('today');

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0)).getTime();

    // 关键：仅针对 ACTIVE 单据进行统计
    const filteredOrders = (timeMode === 'today' 
      ? data.orders.filter(o => new Date(o.createdAt).getTime() >= startOfToday)
      : data.orders).filter(o => o.status === OrderStatus.ACTIVE);
    
    const filteredExpenses = timeMode === 'today'
      ? data.expenses.filter(e => new Date(e.date).getTime() >= startOfToday)
      : data.expenses;

    const filteredRepayments = timeMode === 'today'
      ? data.repayments.filter(r => new Date(r.date).getTime() >= startOfToday)
      : data.repayments;

    const wechat = filteredOrders.filter(o => o.paymentMethod === PaymentMethod.WECHAT).reduce((sum, o) => sum + o.receivedAmount, 0);
    const alipay = filteredOrders.filter(o => o.paymentMethod === PaymentMethod.ALIPAY).reduce((sum, o) => sum + o.receivedAmount, 0);
    const cash = filteredOrders.filter(o => o.paymentMethod === PaymentMethod.CASH).reduce((sum, o) => sum + o.receivedAmount, 0);

    const revenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const debt = filteredOrders.reduce((sum, o) => sum + (o.totalAmount - o.receivedAmount), 0);
    const expenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    const totalReceived = filteredOrders.reduce((sum, o) => sum + o.receivedAmount, 0) + 
                         filteredRepayments.reduce((sum, r) => sum + r.amount, 0);
    const balance = totalReceived - expenses;

    const productSalesMap = new Map<string, number>();
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const current = productSalesMap.get(item.productName) || 0;
        productSalesMap.set(item.productName, current + item.subtotal);
      });
    });

    const chartData = Array.from(productSalesMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      wechat, alipay, cash,
      revenue, debt, expenses, balance,
      chartData
    };
  }, [data, timeMode]);

  const handleExport = () => {
    alert('正在准备经营报表...');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 overflow-y-auto no-scrollbar">
      <header className="px-6 pt-8 pb-4 flex justify-between items-end">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">经营概况</h1>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100 active:scale-95 transition-all"
          >
            <Download size={14} /> 导出
          </button>
          <div className="bg-slate-200/50 p-1 rounded-xl flex gap-1">
            <button 
              onClick={() => setTimeMode('today')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${timeMode === 'today' ? 'bg-[#1E293B] text-white shadow-lg' : 'text-slate-500'}`}
            >
              今日
            </button>
            <button 
              onClick={() => setTimeMode('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${timeMode === 'all' ? 'bg-[#1E293B] text-white shadow-lg' : 'text-slate-500'}`}
            >
              累计
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4 text-slate-800">
            <CreditCard size={18} className="text-blue-500" />
            <h3 className="font-black text-sm">收款账户明细 ({timeMode === 'today' ? '今日' : '全部'})</h3>
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
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <DollarSign size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">营收总额</p>
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">¥{stats.revenue.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Wallet size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">待收欠款</p>
            </div>
            <p className="text-3xl font-black text-red-500 tracking-tighter">¥{stats.debt.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <TrendingDown size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">各项开支</p>
            </div>
            <p className="text-3xl font-black text-orange-500 tracking-tighter">¥{stats.expenses.toLocaleString()}</p>
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
            <h3 className="font-black text-sm">热销单品 TOP5</h3>
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
    </div>
  );
};

export default BusinessView;
