import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  Package, ArrowLeft, Truck, ChevronRight, X, Trash2, 
  Edit2, Scale, BoxSelect, TrendingUp, Search, Wallet, 
  Users, ArrowDownCircle, Share2, BarChart3, ClipboardCheck, Minus, 
  History, Receipt, UserCheck, Calendar, LayoutGrid, AlertTriangle, Layers
} from 'lucide-react';
import { PricingMode, OrderStatus, Order, Product, Batch } from '../types';

// Helper: Filter Props Interface
interface BatchSelectorProps {
  selectedBatchId: string;
  onSelectBatch: (id: string) => void;
  batches: Batch[];
}

// Helper function to render a sub-view shell
const SubViewShell: React.FC<{ 
  title: string; 
  onBack: () => void; 
  children: React.ReactNode; 
  searchProps?: { value: string; onChange: (s: string) => void; placeholder: string };
  batchSelectorProps?: BatchSelectorProps; // New Prop for Batch Filtering
}> = ({ title, onBack, children, searchProps, batchSelectorProps }) => (
  <div className="fixed inset-0 z-[100] bg-[#F4F6F9] flex flex-col animate-in slide-in-from-right">
    <header className="bg-white px-4 py-4 border-b flex items-center shrink-0 shadow-sm z-10">
      <button onClick={onBack} className="p-2 -ml-2 active:scale-90"><ArrowLeft /></button>
      <h1 className="text-lg font-black flex-1 text-center pr-8">{title}</h1>
    </header>
    
    <div className="bg-white border-b shadow-sm z-10">
      {/* Search Bar */}
      {searchProps && (
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              value={searchProps.value} 
              onChange={e => searchProps.onChange(e.target.value)} 
              placeholder={searchProps.placeholder} 
              className="w-full h-10 bg-gray-50 pl-11 pr-4 rounded-xl font-bold text-sm border-none focus:ring-2 ring-emerald-100 transition-all outline-none" 
            />
          </div>
        </div>
      )}

      {/* Batch Selector */}
      {batchSelectorProps && (
        <div className="px-4 pb-3 pt-1 flex gap-2 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => batchSelectorProps.onSelectBatch('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${batchSelectorProps.selectedBatchId === 'ALL' ? 'bg-gray-800 border-gray-800 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
          >
            <Layers size={12} /> 全部
          </button>
          {batchSelectorProps.batches.map(batch => (
            <button
              key={batch.id}
              onClick={() => batchSelectorProps.onSelectBatch(batch.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${batchSelectorProps.selectedBatchId === batch.id ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
            >
              <Truck size={12} /> {batch.plateNumber}
            </button>
          ))}
        </div>
      )}
    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 no-scrollbar">
      {children}
    </div>
  </div>
);

const FormModal: React.FC<{title:string, onBack:()=>void, onSave:()=>void, children: React.ReactNode}> = ({title, onBack, onSave, children}) => (
    <div className="fixed inset-0 z-[500] bg-white flex flex-col animate-in slide-in-from-bottom">
       <header className="px-4 py-4 border-b flex items-center shrink-0"><button onClick={onBack} className="p-2 active:scale-90"><X size={28}/></button><h1 className="text-xl font-black flex-1 text-center pr-10">{title}</h1></header>
       <div className="p-8 space-y-5 flex-1 overflow-y-auto">{children}</div>
       <div className="p-4 shrink-0"><button onClick={onSave} className="w-full bg-[#10b981] text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-emerald-300 active:scale-95 transition-all shadow-[0_0_25px_rgba(16,185,129,0.6)]">确认保存</button></div>
    </div>
);

const BatchFormFields: React.FC<{
  batchForm: { plate: string; cost: string; weight: string };
  setBatchForm: React.Dispatch<React.SetStateAction<{ plate: string; cost: string; weight: string }>>;
}> = ({ batchForm, setBatchForm }) => (
  <div className="space-y-5">
    <div>
      <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">车牌号</label>
      <input 
        value={batchForm.plate} 
        onChange={e => setBatchForm({...batchForm, plate: e.target.value})} 
        placeholder="例: 豫RND392"
        className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-2xl text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all uppercase" 
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">总斤数</label>
        <input 
          value={batchForm.weight} 
          onChange={e => setBatchForm({...batchForm, weight: e.target.value})} 
          type="number" 
          placeholder="0"
          className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
        />
      </div>
      <div>
        <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">货款成本</label>
        <input 
          value={batchForm.cost} 
          onChange={e => setBatchForm({...batchForm, cost: e.target.value})} 
          type="number"
          placeholder="0.0" 
          className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-emerald-600 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
        />
      </div>
    </div>
  </div>
);

const ProductFormFields: React.FC<{
  productForm: { name: string; category: string; mode: PricingMode; sell: string; stock: string; tare: string };
  setProductForm: React.Dispatch<React.SetStateAction<{ name: string; category: string; mode: PricingMode; sell: string; stock: string; tare: string }>>;
}> = ({ productForm, setProductForm }) => (
  <div className="space-y-5"> 
    <div>
      <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">品名</label>
      <input 
        value={productForm.name} 
        onChange={e => setProductForm({...productForm, name: e.target.value})} 
        placeholder="例: 大果 / 小框" 
        className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all" 
      />
    </div>
    <div>
      <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">计价方式</label>
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-2xl mt-1">
        <button 
          onClick={() => setProductForm({...productForm, mode: PricingMode.WEIGHT})} 
          className={`py-4 rounded-xl font-black text-sm transition-all ${productForm.mode === PricingMode.WEIGHT ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
        >
          按重量 (斤)
        </button>
        <button 
          onClick={() => setProductForm({...productForm, mode: PricingMode.PIECE})} 
          className={`py-4 rounded-xl font-black text-sm transition-all ${productForm.mode === PricingMode.PIECE ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
        >
          按件数 (件)
        </button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">库存件数</label>
        <input 
          value={productForm.stock} 
          onChange={e => setProductForm({...productForm, stock: e.target.value})} 
          type="number" 
          placeholder="0"
          className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
        />
      </div>
      <div>
        <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">默认售价</label>
        <input 
          value={productForm.sell} 
          onChange={e => setProductForm({...productForm, sell: e.target.value})} 
          type="number"
          placeholder="0.0" 
          className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-emerald-600 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
        />
      </div>
    </div>
    {productForm.mode === PricingMode.WEIGHT && (
      <div className="animate-in fade-in">
        <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">默认皮重 (斤/件)</label>
        <input 
          value={productForm.tare} 
          onChange={e => setProductForm({...productForm, tare: e.target.value})} 
          type="number"
          placeholder="0.0"
          className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all" 
        />
      </div>
    )}
  </div>
);

const ManageView: React.FC = () => {
  type ViewState = 'main' | 'history' | 'reconcile' | 'customers' | 'inventory' | 'batch_detail' | 'order_detail' | 'customer_detail' | 'add_batch' | 'edit_batch' | 'add_product' | 'edit_product';
  const [subView, setSubView] = useState<ViewState>('main');
  
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  // Filter States
  const [filterBatchId, setFilterBatchId] = useState<string>('ALL'); // For filters inside sub-views

  const [orderSearch, setOrderSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({ name: '运费', amount: '' });

  const [batchForm, setBatchForm] = useState({ plate: '', cost: '', weight: '' });
  const [productForm, setProductForm] = useState({ name: '', category: '柑橘', mode: PricingMode.WEIGHT, sell: '', stock: '', tare: '2.5' });

  const { data, addBatch, updateBatch, deleteBatch, addProduct, updateProduct, deleteProduct, addExtraFee, removeExtraFee, cancelOrder } = useApp();

  const selectedBatch = useMemo(() => data.batches.find(b => b.id === selectedBatchId), [data.batches, selectedBatchId]);
  const selectedOrder = useMemo(() => data.orders.find(o => o.id === selectedOrderId), [data.orders, selectedOrderId]);
  const selectedProduct = useMemo(() => data.products.find(p => p.id === selectedProductId), [data.products, selectedProductId]);

  const activeBatches = useMemo(() => data.batches.filter(b => !b.isClosed), [data.batches]);
  
  // Helper to find which batch a product belongs to
  const getProductBatchId = (productId: string) => data.products.find(p => p.id === productId)?.batchId;

  // Analysis for specific batch detail view
  const productPerformance = useMemo(() => {
    if (!selectedBatchId) return [];
    return data.products.filter(p => p.batchId === selectedBatchId).map(p => {
      let soldQty = 0; let salesAmount = 0;
      data.orders.filter(o => o.status === OrderStatus.ACTIVE).forEach(order => {
        order.items.forEach(item => { if (item.productId === p.id) { soldQty += item.qty; salesAmount += item.subtotal; } });
      });
      return { ...p, soldQty, salesAmount };
    });
  }, [selectedBatchId, data.products, data.orders]);

  const batchAnalysis = useMemo(() => {
    if (!selectedBatch) return null;
    const totalSales = productPerformance.reduce((s, p) => s + p.salesAmount, 0);
    const totalCost = selectedBatch.cost + selectedBatch.extraFees.reduce((s, f) => s + f.amount, 0);
    return { totalSales, totalCost, profit: totalSales - totalCost, progress: totalCost > 0 ? Math.min(100, (totalSales/totalCost)*100) : 0 };
  }, [selectedBatch, productPerformance]);

  // --- SUB-VIEWS RENDER ---
  if (subView === 'history') {
    // Filter orders:
    // 1. Matches Search
    // 2. If Batch selected, order MUST contain at least one item from that batch
    const filteredOrders = data.orders.filter(o => {
      const matchesSearch = o.orderNo.includes(orderSearch) || o.customerName.includes(orderSearch);
      const matchesBatch = filterBatchId === 'ALL' 
        ? true 
        : o.items.some(item => getProductBatchId(item.productId) === filterBatchId);
      return matchesSearch && matchesBatch;
    });

    return (
      <SubViewShell 
        title="单据查询" 
        onBack={() => setSubView('main')} 
        searchProps={{ value: orderSearch, onChange: setOrderSearch, placeholder: '搜索单号或客户...' }}
        batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: data.batches }}
      >
        {filteredOrders.map(o => (
          <div key={o.id} onClick={() => { setSelectedOrderId(o.id); setSubView('order_detail'); }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 active:bg-gray-50 transition-all">
            <div className="flex justify-between items-center mb-2">
              <span className="font-black text-lg">{o.customerName}</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${o.status === OrderStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>{o.status === OrderStatus.ACTIVE ? '有效' : '已作废'}</span>
            </div>
            <div className="flex justify-between items-end text-sm">
              <div className="text-gray-400 space-y-1"><p>单号: {o.orderNo}</p><p>时间: {new Date(o.createdAt).toLocaleString()}</p></div>
              <p className="text-xl font-black text-emerald-600">¥{o.totalAmount.toLocaleString()}</p>
            </div>
            {filterBatchId !== 'ALL' && (
               <div className="mt-2 pt-2 border-t border-dashed border-gray-100 text-[10px] text-gray-400">
                 * 此单包含当前筛选车次的商品
               </div>
            )}
          </div>
        ))}
        {filteredOrders.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">无符合条件的订单</div>}
      </SubViewShell>
    );
  }

  if (subView === 'order_detail' && selectedOrder) {
    return (
      <SubViewShell title="订单详情" onBack={() => setSubView('history')}>
        <div className="bg-white p-6 rounded-3xl space-y-4">
          <p className="font-black text-2xl">{selectedOrder.customerName}</p>
          <div className="space-y-1 text-xs text-gray-500"><p>单号: {selectedOrder.orderNo}</p><p>时间: {new Date(selectedOrder.createdAt).toLocaleString()}</p></div>
          <div className="border-t border-dashed my-4"></div>
          {selectedOrder.items.map((item, i) => (
            <div key={i} className="flex justify-between items-center"><p className="font-bold">{item.productName} <span className="text-gray-400">x{item.qty}</span></p><p>¥{item.subtotal}</p></div>
          ))}
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>应收</span><span className="font-black">¥{selectedOrder.totalAmount}</span></div>
            <div className="flex justify-between"><span>实收</span><span className="font-black text-emerald-500">¥{selectedOrder.receivedAmount}</span></div>
            <div className="flex justify-between"><span>欠款</span><span className="font-black text-red-500">¥{(selectedOrder.totalAmount - selectedOrder.receivedAmount).toFixed(2)}</span></div>
          </div>
          {selectedOrder.status === OrderStatus.ACTIVE && <button onClick={() => { if(confirm('确认作废此单？库存和欠款将回退。')){ cancelOrder(selectedOrder.id); setSubView('history');} }} className="w-full mt-4 py-4 bg-red-50 text-red-500 rounded-2xl font-black flex items-center justify-center gap-2"><AlertTriangle size={16}/> 作废此单</button>}
        </div>
      </SubViewShell>
    );
  }

  if (subView === 'inventory') {
    // Filter Products by Search AND Batch
    const filteredProducts = data.products.filter(p => {
       const matchSearch = p.name.includes(invSearch);
       const matchBatch = filterBatchId === 'ALL' || p.batchId === filterBatchId;
       return matchSearch && matchBatch;
    });

    return (
      <SubViewShell 
        title="库存盘点" 
        onBack={() => setSubView('main')} 
        searchProps={{ value: invSearch, onChange: setInvSearch, placeholder: "搜索品名..." }}
        batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: data.batches }}
      >
        {filteredProducts.map(p => {
          const batch = data.batches.find(b => b.id === p.batchId);
          return (
            <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 grid grid-cols-3 items-center">
              <div className="col-span-1">
                <p className="font-black text-lg">{p.name}</p>
                {filterBatchId === 'ALL' && batch && (
                   <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{batch.plateNumber}</span>
                )}
              </div>
              <p className="text-center"><span className="font-bold text-xl">{p.stockQty}</span><span className="text-xs text-gray-400"> 件</span></p>
              <p className="text-center"><span className="font-bold text-xl">{p.stockWeight.toFixed(1)}</span><span className="text-xs text-gray-400"> 斤</span></p>
            </div>
          );
        })}
        {filteredProducts.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">暂无库存记录</div>}
      </SubViewShell>
    );
  }

  if (subView === 'customers') {
    // Advanced Logic for Batch-Specific Accounts Receivable
    // If 'ALL': Show Total Debt.
    // If 'Batch': Show Total Sales of that Batch to that Customer (Not exactly debt, but "Business Volume" for that batch). 
    // Calculating "Debt per batch" is mathematically ambiguous in a pool-based debt system. 
    // So we show "Purchase Amount" from this batch.

    const customerDisplayList = data.customers
      .filter(c => !c.isGuest && c.name.includes(custSearch))
      .map(c => {
        if (filterBatchId === 'ALL') {
            return { ...c, displayValue: c.totalDebt, label: '当前欠款' };
        } else {
            // Calculate total purchases by this customer from this batch
            let batchPurchaseTotal = 0;
            data.orders.forEach(o => {
                if (o.customerId === c.id && o.status === OrderStatus.ACTIVE) {
                    o.items.forEach(item => {
                        if (getProductBatchId(item.productId) === filterBatchId) {
                            batchPurchaseTotal += item.subtotal;
                        }
                    });
                }
            });
            return { ...c, displayValue: batchPurchaseTotal, label: '本车购买额' };
        }
      })
      .filter(c => c.displayValue > 0) // Only show relevant customers
      .sort((a,b) => b.displayValue - a.displayValue);

    return (
      <SubViewShell 
        title={filterBatchId === 'ALL' ? "应收账款" : "车次客户统计"}
        onBack={() => setSubView('main')} 
        searchProps={{ value: custSearch, onChange: setCustSearch, placeholder: "搜索客户..." }}
        batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: data.batches }}
      >
        {customerDisplayList.map(c => (
          <div key={c.id} className="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border border-gray-50">
            <p className="font-black text-lg">{c.name}</p>
            <div className="text-right">
                <p className={`font-black text-2xl ${filterBatchId === 'ALL' ? 'text-red-500' : 'text-emerald-500'}`}>¥{c.displayValue.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{c.label}</p>
            </div>
          </div>
        ))}
        {customerDisplayList.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">无相关数据</div>}
      </SubViewShell>
    );
  }
  
  if (subView === 'reconcile') {
    // Reconcile Logic
    // ALL: Store Global View
    // BATCH: Specific Batch Profitability

    let displayData = {
        label1: '累计总营收', val1: 0, color1: 'text-emerald-600',
        label2: '累计总实收', val2: 0, color2: 'text-blue-600',
        label3: '当前总欠款', val3: 0, color3: 'text-red-600',
        isBatchView: false
    };

    if (filterBatchId === 'ALL') {
        const totalRevenue = data.orders.filter(o=>o.status===OrderStatus.ACTIVE).reduce((s,o)=>s+o.totalAmount,0);
        const totalReceived = data.orders.filter(o=>o.status===OrderStatus.ACTIVE).reduce((s,o)=>s+o.receivedAmount,0);
        const totalDebt = data.customers.reduce((s,c)=>s+c.totalDebt,0);
        displayData = {
            label1: '累计总营收', val1: totalRevenue, color1: 'text-emerald-600',
            label2: '累计总实收', val2: totalReceived, color2: 'text-blue-600',
            label3: '当前总欠款', val3: totalDebt, color3: 'text-red-600',
            isBatchView: false
        };
    } else {
        // Specific Batch Calculation
        const batch = data.batches.find(b => b.id === filterBatchId);
        if (batch) {
            let batchRevenue = 0;
            data.orders.filter(o => o.status === OrderStatus.ACTIVE).forEach(o => {
                o.items.forEach(item => {
                    if (getProductBatchId(item.productId) === batch.id) {
                        batchRevenue += item.subtotal;
                    }
                });
            });
            const batchCost = batch.cost + batch.extraFees.reduce((s, f) => s + f.amount, 0);
            const batchProfit = batchRevenue - batchCost;

            displayData = {
                label1: '本车销售额', val1: batchRevenue, color1: 'text-emerald-600',
                label2: '总成本投入', val2: batchCost, color2: 'text-orange-600',
                label3: '毛利盈亏', val3: batchProfit, color3: batchProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
                isBatchView: true
            };
        }
    }

    return (
      <SubViewShell 
        title="财务核对" 
        onBack={() => setSubView('main')}
        batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: data.batches }}
      >
         <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 space-y-2">
            <p className="text-sm text-gray-400 font-bold">{displayData.label1}</p>
            <p className={`font-black text-3xl ${displayData.color1}`}>¥{displayData.val1.toLocaleString()}</p>
         </div>
         <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 space-y-2">
            <p className="text-sm text-gray-400 font-bold">{displayData.label2}</p>
            <p className={`font-black text-3xl ${displayData.color2}`}>¥{displayData.val2.toLocaleString()}</p>
         </div>
         <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 space-y-2">
            <p className="text-sm text-gray-400 font-bold">{displayData.label3}</p>
            <p className={`font-black text-3xl ${displayData.color3}`}>¥{displayData.val3.toLocaleString()}</p>
         </div>
         
         {displayData.isBatchView && (
             <div className="text-center text-xs text-gray-400 pt-4">
                 * 车次视图下不显示“实收”和“欠款”，因为收款是针对整单的，无法精准拆分到车次。
             </div>
         )}
      </SubViewShell>
    );
  }

  if (subView === 'batch_detail' && selectedBatch && batchAnalysis) {
    return (
      <div className="flex flex-col h-screen bg-[#F4F6F9] animate-in fade-in overflow-hidden">
        <header className="bg-white px-4 py-4 border-b flex items-center shrink-0"><button onClick={() => setSubView('main')} className="p-2 -ml-2 active:scale-90"><ArrowLeft /></button><h1 className="text-lg font-black flex-1 text-center">{selectedBatch.plateNumber} 看板</h1><button onClick={() => { setBatchForm({ plate: selectedBatch.plateNumber, cost: selectedBatch.cost.toString(), weight: selectedBatch.totalWeight.toString() }); setSubView('edit_batch'); }} className="p-2 text-blue-500 active:scale-90"><Edit2 size={20}/></button></header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 no-scrollbar">
           <div className="bg-[#1C2033] text-white p-7 rounded-[2.5rem] shadow-2xl space-y-6 relative overflow-hidden"><div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div><div className="flex justify-between items-start"><div><p className="text-[10px] text-gray-400 font-black uppercase">批次: #{selectedBatch.batchNo}</p><h2 className="text-3xl font-black tracking-tight">{selectedBatch.plateNumber}</h2></div><div className="text-right"><p className="text-[10px] text-emerald-400 font-black uppercase">当前流水</p><p className="text-2xl font-black text-emerald-400">¥{batchAnalysis.totalSales.toLocaleString()}</p></div></div><div className="space-y-3 pt-2"><div className="flex justify-between items-end"><span className="text-xs font-black">{batchAnalysis.profit >= 0 ? '当前盈利' : '尚未回本'}</span><span className={`text-xl font-black ${batchAnalysis.profit >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>¥{Math.abs(batchAnalysis.profit).toLocaleString()}</span></div><div className="h-3 bg-white/10 rounded-full overflow-hidden"><div className={`h-full ${batchAnalysis.profit >= 0 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${batchAnalysis.progress}%` }}></div></div></div></div>
           <div className="space-y-3"><div className="flex justify-between items-center px-2"><h3 className="font-black text-gray-800">入库规格清单</h3><button onClick={() => { setProductForm({ name: '', category:'柑橘', mode: PricingMode.WEIGHT, sell: '', stock: '', tare: '2.5' }); setSubView('add_product'); }} className="text-xs font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">+ 新规格</button></div>{productPerformance.map(p => (<div key={p.id} className="bg-white p-5 rounded-[2rem] flex justify-between items-center shadow-sm border border-gray-100"><div className="flex items-center gap-4"><div className={`p-3 rounded-2xl ${p.pricingMode === 'WEIGHT' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>{p.pricingMode === 'WEIGHT' ? <Scale size={20} /> : <BoxSelect size={20} />}</div><div><p className="font-black text-gray-800">{p.name}</p><p className="text-[10px] text-gray-400 font-bold uppercase">余:{p.stockQty}件 / 售:{p.soldQty}件</p></div></div><div className="flex gap-1"><button onClick={() => { setSelectedProductId(p.id); setProductForm({ name: p.name, category: p.category, mode: p.pricingMode, sell: p.sellingPrice?.toString() || '', stock: p.stockQty.toString(), tare: p.defaultTare.toString() }); setSubView('edit_product'); }} className="p-2 text-gray-300"><Edit2 size={16}/></button><button onClick={() => { if(confirm('确认删除规格？')) deleteProduct(p.id); }} className="p-2 text-gray-300"><Trash2 size={16} /></button></div></div>))}</div>
           <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4"><div className="flex justify-between items-center"><h3 className="font-black text-gray-800">批次费用明细</h3><button onClick={() => setShowFeeModal(true)} className="text-xs font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">+ 杂费</button></div><div className="space-y-2"><div className="flex justify-between p-3 bg-gray-50 rounded-xl text-xs font-bold"><span>产地货款</span><span>¥{selectedBatch.cost.toLocaleString()}</span></div>{selectedBatch.extraFees.map(fee => (<div key={fee.id} className="flex justify-between p-3 bg-red-50/50 rounded-xl text-xs font-black text-red-600"><span>{fee.name}</span><div className="flex items-center gap-3"><span>¥{fee.amount}</span><button onClick={() => removeExtraFee(selectedBatch.id, fee.id)} className="text-red-200"><Minus size={14} /></button></div></div>))} <div className="flex justify-between pt-3 border-t font-black"><span className="text-xs uppercase">累计投入成本</span><span className="text-lg">¥{batchAnalysis.totalCost.toLocaleString()}</span></div></div></div>
           
           <button onClick={() => { 
             const batchProductIds = data.products.filter(p => p.batchId === selectedBatch.id).map(p => p.id);
             const hasActiveOrders = data.orders.some(o => 
               o.status === OrderStatus.ACTIVE && 
               o.items.some(item => batchProductIds.includes(item.productId))
             );
             
             if (hasActiveOrders) {
               alert('❌ 删除失败：该车次下存在关联的销售订单。\n\n请先前往“单据查询”将相关订单作废，确保数据一致性后再进行删除。');
               return;
             }

             if(confirm('⚠️ 危险操作警告\n\n确认要彻底删除该车次吗？\n此操作将永久删除该车次及其所有关联的商品规格，且无法恢复！')) { 
               deleteBatch(selectedBatch.id); 
               setSubView('main'); 
             } 
           }} className="w-full py-5 text-red-300 font-black text-[10px] uppercase tracking-widest border-2 border-dashed border-red-50 rounded-[2rem]">删除整车记录</button>
        
        </div>
        {showFeeModal && <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in"><div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl"><h2 className="text-xl font-black">登记额外支出</h2><input value={feeForm.name} onChange={e=>setFeeForm({...feeForm, name: e.target.value})} placeholder="支出说明" className="w-full bg-gray-50 p-5 rounded-2xl font-black" /><input type="number" autoFocus value={feeForm.amount} onChange={e=>setFeeForm({...feeForm, amount: e.target.value})} placeholder="金额" className="w-full bg-gray-50 p-5 rounded-2xl font-black text-3xl text-emerald-600" /><button onClick={() => { if(!feeForm.amount) return; addExtraFee(selectedBatch.id, { id: Date.now().toString(), name: feeForm.name, amount: parseFloat(feeForm.amount) }); setShowFeeModal(false); setFeeForm({name:'运费', amount:''}); }} className="w-full bg-gray-900 text-white py-5 rounded-3xl font-black">确认记录</button></div></div>}
      </div>
    );
  }
  
  if (subView === 'edit_batch' && selectedBatch) {
    return <FormModal title="编辑车辆信息" onBack={()=>setSubView('batch_detail')} onSave={()=>{ updateBatch({ ...selectedBatch, plateNumber: batchForm.plate, cost: parseFloat(batchForm.cost) || 0, totalWeight: parseFloat(batchForm.weight) || 0 }); setSubView('batch_detail'); }}>
      <BatchFormFields batchForm={batchForm} setBatchForm={setBatchForm} />
    </FormModal>;
  }

  if (subView === 'add_product' && selectedBatchId) {
    return <FormModal title="新增规格" onBack={()=>setSubView('batch_detail')} onSave={()=>{ addProduct({ id: Date.now().toString(), batchId: selectedBatchId, name: productForm.name, category: productForm.category, pricingMode: productForm.mode, defaultTare: parseFloat(productForm.tare) || 0, stockQty: parseInt(productForm.stock) || 0, stockWeight: 0, sellingPrice: parseFloat(productForm.sell) || 0 }); setSubView('batch_detail'); }}>
      <ProductFormFields productForm={productForm} setProductForm={setProductForm} />
    </FormModal>
  }

  if (subView === 'edit_product' && selectedProduct) {
    return <FormModal title="编辑规格" onBack={()=>setSubView('batch_detail')} onSave={()=>{ updateProduct({ ...selectedProduct, name: productForm.name, category: productForm.category, pricingMode: productForm.mode, stockQty: parseInt(productForm.stock) || selectedProduct.stockQty, defaultTare: parseFloat(productForm.tare) || 0, sellingPrice: parseFloat(productForm.sell) || 0 }); setSubView('batch_detail'); }}>
      <ProductFormFields productForm={productForm} setProductForm={setProductForm} />
    </FormModal>
  }

  // --- MAIN VIEW ---
  return (
    <div className="flex flex-col h-screen bg-[#F4F6F9] overflow-hidden">
      <header className="bg-white px-6 py-6 border-b flex items-center justify-between shrink-0">
        <h1 className="text-3xl font-black text-[#1a2333] tracking-tight">业务管理</h1>
        <div className="bg-[#f0f2f5] p-3 rounded-2xl text-[#9ca3af] shadow-inner active:scale-95 transition-all"><LayoutGrid size={24} strokeWidth={2.5} /></div>
      </header>

      <div className="p-4 space-y-8 flex-1 overflow-y-auto pb-32 no-scrollbar">
        <div className="grid grid-cols-2 gap-4">
           <div onClick={() => { setFilterBatchId('ALL'); setSubView('history'); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col items-center gap-4 active:scale-[0.97] transition-all cursor-pointer"><div className="w-16 h-16 bg-[#ecfdf5] text-[#10b981] rounded-[1.5rem] flex items-center justify-center shadow-inner"><ArrowDownCircle size={36} strokeWidth={2.5} /></div><span className="text-sm font-black text-[#4b5563]">单据查询</span></div>
           <div onClick={() => { setFilterBatchId('ALL'); setSubView('reconcile'); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col items-center gap-4 active:scale-[0.97] transition-all cursor-pointer"><div className="w-16 h-16 bg-[#eff6ff] text-[#3b82f6] rounded-[1.5rem] flex items-center justify-center shadow-inner"><Wallet size={36} strokeWidth={2.5} /></div><span className="text-sm font-black text-[#4b5563]">财务核对</span></div>
           <div onClick={() => { setFilterBatchId('ALL'); setSubView('customers'); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col items-center gap-4 active:scale-[0.97] transition-all cursor-pointer"><div className="w-16 h-16 bg-[#fff1f2] text-[#ef4444] rounded-[1.5rem] flex items-center justify-center shadow-inner"><Users size={36} strokeWidth={2.5} /></div><span className="text-sm font-black text-[#4b5563]">应收账款</span></div>
           <div onClick={() => { setFilterBatchId('ALL'); setSubView('inventory'); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col items-center gap-4 active:scale-[0.97] transition-all cursor-pointer"><div className="w-16 h-16 bg-[#fff7ed] text-[#f59e0b] rounded-[1.5rem] flex items-center justify-center shadow-inner"><BarChart3 size={36} strokeWidth={2.5} /></div><span className="text-sm font-black text-[#4b5563]">库存盘点</span></div>
        </div>

        <div className="space-y-4">
           <div className="flex justify-between items-center px-2"><h3 className="font-black text-xl text-[#1a2333] flex items-center gap-2"><Truck size={24} className="text-[#10b981]" /> 在售车次管理</h3><button onClick={() => { setBatchForm({ plate: '', cost: '', weight: '' }); setSubView('add_batch'); }} className="text-xs font-black text-[#059669] bg-[#ecfdf5] px-5 py-2.5 rounded-full border border-[#d1fae5] active:scale-95 shadow-sm transition-all">+ 新增车辆</button></div>
           <div className="space-y-3">
              {data.batches.length === 0 ? (<div className="text-center py-16 rounded-3xl border-2 border-dashed border-gray-200/80"><p className="text-gray-400 text-sm font-medium">暂无在售车辆记录</p></div>) : data.batches.map(batch => (<div key={batch.id} onClick={() => { setSelectedBatchId(batch.id); setSubView('batch_detail'); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex justify-between items-center active:bg-gray-50 transition-all group cursor-pointer"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-[#f8fafc] text-[#64748b] rounded-2xl flex items-center justify-center shadow-inner transition-transform group-active:scale-90"><Truck size={28} /></div><div><h4 className="font-black text-xl text-[#1a2333] leading-tight">{batch.plateNumber}</h4><p className="text-[10px] text-white font-black uppercase tracking-widest mt-1 inline-block px-2 py-0.5 bg-blue-500 rounded">重: {batch.totalWeight} 斤 / #{batch.batchNo}</p></div></div><ChevronRight className="text-[#d1d5db] group-active:translate-x-1 transition-transform" /></div>))}
           </div>
        </div>
      </div>

      {subView === 'add_batch' && (
         <FormModal title="新车入场登记" onBack={() => setSubView('main')} onSave={() => { if(!batchForm.plate) return; addBatch({ id: Date.now().toString(), plateNumber: batchForm.plate.toUpperCase(), inboundDate: new Date().toISOString(), cost: parseFloat(batchForm.cost)||0, extraFees: [], totalWeight: parseFloat(batchForm.weight)||0, isClosed: false, batchNo: data.batches.length + 1 }); setSubView('main'); }}>
            <BatchFormFields batchForm={batchForm} setBatchForm={setBatchForm} />
         </FormModal>
      )}
    </div>
  );
};

export default ManageView;