
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  Package, ArrowLeft, Truck, ChevronRight, X, Trash2, 
  Edit2, Scale, BoxSelect, TrendingUp, Search, Wallet, 
  Users, ArrowDownCircle, Share2, BarChart3, ClipboardCheck, Minus, 
  History, Receipt, UserCheck, Calendar, LayoutGrid, AlertTriangle, Layers, ClipboardEdit, RefreshCw, AlertCircle,
  Plus, PlusCircle, CheckCircle2
} from 'lucide-react';
import { PricingMode, OrderStatus, Order, Product, Batch, Repayment } from '../types';

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
  batchSelectorProps?: BatchSelectorProps; 
  disableScroll?: boolean;
}> = ({ title, onBack, children, searchProps, batchSelectorProps, disableScroll = false }) => (
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${batchSelectorProps.selectedBatchId === batch.id ? 'bg-emerald-50 border-emerald-500 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
            >
              <Truck size={12} /> {batch.plateNumber}
            </button>
          ))}
        </div>
      )}
    </div>

    <div className={`flex-1 ${disableScroll ? 'overflow-hidden' : 'p-4 pb-32 overflow-y-auto no-scrollbar space-y-3'}`}>
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
  productForm: { name: string; category: string; mode: PricingMode; sell: string; stock: string; tare: string; threshold: string };
  setProductForm: React.Dispatch<React.SetStateAction<{ name: string; category: string; mode: PricingMode; sell: string; stock: string; tare: string; threshold: string }>>;
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
    
    <div className="grid grid-cols-2 gap-4">
      {productForm.mode === PricingMode.WEIGHT ? (
        <div className="animate-in fade-in">
          <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">默认皮重 (斤/件)</label>
          <input 
            value={productForm.tare} 
            onChange={e => setProductForm({...productForm, tare: e.target.value})} 
            type="number"
            placeholder="0.0"
            className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
          />
        </div>
      ) : <div />}
      
      <div>
        <label className="text-xs font-bold text-red-400 uppercase tracking-wider px-1">预警件数 (低于变红)</label>
        <input 
          value={productForm.threshold} 
          onChange={e => setProductForm({...productForm, threshold: e.target.value})} 
          type="number"
          placeholder="20"
          className="w-full mt-1 bg-red-50 p-5 rounded-2xl font-bold text-lg text-red-500 border-2 border-transparent focus:border-red-400 focus:bg-white outline-none transition-all text-center placeholder-red-200" 
        />
      </div>
    </div>
  </div>
);

const ManageView: React.FC = () => {
  type ViewState = 'main' | 'history' | 'reconcile' | 'customers' | 'inventory' | 'adjust_stock' | 'batch_detail' | 'order_detail' | 'customer_detail' | 'add_batch' | 'edit_batch' | 'add_product' | 'edit_product';
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
  const [productForm, setProductForm] = useState({ name: '', category: '柑橘', mode: PricingMode.WEIGHT, sell: '', stock: '', tare: '0', threshold: '' });
  
  // Reconcile States
  const [reconcileDate, setReconcileDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reconcileBatchId, setReconcileBatchId] = useState('ALL');

  // Inventory Adjustment State
  const [adjustForm, setAdjustForm] = useState({ 
    id: '', 
    name: '', 
    currentQty: 0, 
    currentWeight: 0, 
    actualQty: '', 
    actualWeight: '' 
  });

  const { data, addBatch, updateBatch, deleteBatch, addProduct, updateProduct, deleteProduct, adjustStock, addExtraFee, removeExtraFee, deleteOrder } = useApp();

  const selectedBatch = useMemo(() => data.batches.find(b => b.id === selectedBatchId), [data.batches, selectedBatchId]);
  const selectedOrder = useMemo(() => data.orders.find(o => o.id === selectedOrderId), [data.orders, selectedOrderId]);
  const selectedProduct = useMemo(() => data.products.find(p => p.id === selectedProductId), [data.products, selectedProductId]);

  const activeBatches = useMemo(() => data.batches.filter(b => b && !b.isClosed), [data.batches]);
  
  // Helper to find which batch a product belongs to
  const getProductBatchId = (productId: string) => {
    return data.products.find(p => p.id === productId)?.batchId;
  };
  
  // --- SUBMIT HANDLERS ---
  const handleSaveBatch = () => {
    if (!batchForm.plate) return alert('请输入车牌号');
    const newBatch: Batch = {
      id: subView === 'edit_batch' && selectedBatchId ? selectedBatchId : Date.now().toString(),
      plateNumber: batchForm.plate,
      inboundDate: selectedBatch ? selectedBatch.inboundDate : new Date().toISOString(),
      cost: parseFloat(batchForm.cost) || 0,
      totalWeight: parseFloat(batchForm.weight) || 0,
      extraFees: selectedBatch ? selectedBatch.extraFees : [],
      isClosed: false,
      batchNo: selectedBatch ? selectedBatch.batchNo : data.batches.length + 1
    };
    if (subView === 'edit_batch') updateBatch(newBatch);
    else addBatch(newBatch);
    setSubView('main');
  };

  const handleSaveProduct = () => {
    if (!productForm.name) return alert('请输入商品名称');
    if (!selectedBatchId) return alert('未选择车次');
    const newProduct: Product = {
      id: subView === 'edit_product' && selectedProductId ? selectedProductId : Date.now().toString(),
      name: productForm.name,
      category: productForm.category,
      pricingMode: productForm.mode,
      sellingPrice: parseFloat(productForm.sell) || 0,
      stockQty: parseFloat(productForm.stock) || 0,
      stockWeight: productForm.mode === PricingMode.WEIGHT ? (parseFloat(productForm.stock) * 20) : 0, // Initial estimate
      defaultTare: parseFloat(productForm.tare) || 0,
      batchId: selectedBatchId,
      lowStockThreshold: parseFloat(productForm.threshold) || 20
    };
    if (subView === 'edit_product') updateProduct(newProduct);
    else addProduct(newProduct);
    setSubView('batch_detail');
  };

  const handleAdjustStock = () => {
    const qty = parseFloat(adjustForm.actualQty);
    const weight = parseFloat(adjustForm.actualWeight);
    if (isNaN(qty)) return alert('请输入实际库存件数');
    
    // 如果是计重，必须输入重量
    const product = data.products.find(p => p.id === adjustForm.id);
    if (product?.pricingMode === PricingMode.WEIGHT && isNaN(weight)) {
         return alert('请输入实际总重量');
    }

    adjustStock(adjustForm.id, qty, isNaN(weight) ? 0 : weight);
    setSubView('inventory');
  };

  const handleAddFee = () => {
    if (!feeForm.amount || !selectedBatchId) return;
    addExtraFee(selectedBatchId, { id: Date.now().toString(), name: feeForm.name, amount: parseFloat(feeForm.amount) });
    setShowFeeModal(false);
    setFeeForm({ name: '运费', amount: '' });
  };

  // --- MERGED HISTORY LIST (Orders + Repayments) ---
  const combinedHistory = useMemo(() => {
    const orders: any[] = data.orders.map(o => ({ ...o, type: 'order' }));
    const repayments: any[] = data.repayments.map(r => ({ ...r, type: 'repayment', createdAt: r.date }));
    
    // Combine and Sort
    const combined = [...orders, ...repayments].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Filter
    return combined.filter(item => {
        if (!item) return false;
        // Search Filter (checks OrderNo or CustomerName)
        const name = item.customerName || '';
        const no = item.orderNo || '';
        const matchSearch = name.includes(orderSearch) || no.includes(orderSearch);
        
        // Batch Filter (Only applies to orders effectively, repayments don't usually have batchId unless we track it)
        // For simplicity, if filtering by batch, only show orders from that batch. Repayments shown only on 'ALL' or ignored.
        // Let's hide repayments if a specific batch is selected, as repayments are usually global to customer.
        let matchBatch = true;
        if (filterBatchId !== 'ALL') {
             if (item.type === 'order') {
                 const order = item as Order;
                 matchBatch = order.items.some(i => getProductBatchId(i.productId) === filterBatchId);
             } else {
                 matchBatch = false; // Hide repayments when filtering by specific batch
             }
        }
        
        return matchSearch && matchBatch;
    });
  }, [data.orders, data.repayments, orderSearch, filterBatchId, data.products]);

  const filteredInventory = useMemo(() => {
    return data.products.filter(p => {
        if (!p || !p.name) return false;
        const matchSearch = p.name.includes(invSearch);
        const matchBatch = filterBatchId === 'ALL' || p.batchId === filterBatchId;
        return matchSearch && matchBatch;
    });
  }, [data.products, invSearch, filterBatchId]);


  // --- VIEW RENDERERS ---
  
  // 1. Main Dashboard
  if (subView === 'main') {
    return (
      <div className="p-4 space-y-6 pb-32">
        <header className="py-4"><h1 className="text-2xl font-black text-gray-800">店铺管理</h1></header>
        
        <div className="grid grid-cols-2 gap-4">
           <div onClick={() => setSubView('history')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3"><History size={24} /></div>
              <p className="font-black text-gray-800">单据查询</p>
              <p className="text-xs text-gray-400 font-bold mt-1">订单与还款记录</p>
           </div>
           {/* Reconcile and Customers Views restored here */}
           <div onClick={() => setSubView('reconcile')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-3"><Wallet size={24} /></div>
              <p className="font-black text-gray-800">财务核对</p>
              <p className="text-xs text-gray-400 font-bold mt-1">收支对账 / 分车次</p>
           </div>
           <div onClick={() => setSubView('customers')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-3"><Users size={24} /></div>
              <p className="font-black text-gray-800">应收账款</p>
              <p className="text-xs text-gray-400 font-bold mt-1">客户欠款总览</p>
           </div>
           <div onClick={() => setSubView('inventory')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all">
              <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-3"><ClipboardCheck size={24} /></div>
              <p className="font-black text-gray-800">库存盘点</p>
              <p className="text-xs text-gray-400 font-bold mt-1">修正库存 / 报损</p>
           </div>
        </div>

        <div className="space-y-4">
           <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-lg text-gray-800">车次/批次管理</h3>
              <button onClick={() => { setBatchForm({plate:'', cost:'', weight:''}); setSubView('add_batch'); }} className="flex items-center gap-1 text-emerald-600 text-xs font-black bg-emerald-50 px-3 py-1.5 rounded-full"><Plus size={14}/> 新车入库</button>
           </div>
           
           {/* 防御性渲染：确保batch存在且有关键属性 */}
           {activeBatches.map(batch => (
              batch && batch.id ? (
                <div key={batch.id} onClick={() => { setSelectedBatchId(batch.id); setSubView('batch_detail'); }} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 active:scale-[0.98] transition-all flex justify-between items-center">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500"><Truck size={24} /></div>
                      <div>
                         <p className="font-black text-gray-800 text-lg">{batch.plateNumber || '未知车牌'}</p>
                         <p className="text-xs text-gray-400 font-bold">{batch.inboundDate ? new Date(batch.inboundDate).toLocaleDateString() : '未知日期'} 入库</p>
                      </div>
                   </div>
                   <ChevronRight className="text-gray-300" />
                </div>
              ) : null
           ))}
           
           <div onClick={() => alert('请在已结束的车次中查看（功能开发中）')} className="bg-gray-50 p-4 rounded-[2rem] text-center text-gray-400 font-bold text-xs">
              查看已结清的历史车次
           </div>
        </div>
      </div>
    );
  }

  // 2. Add/Edit Batch Modal
  if (subView === 'add_batch' || subView === 'edit_batch') {
    return (
      <FormModal title={subView === 'add_batch' ? '新车登记' : '修改信息'} onBack={() => setSubView(selectedBatchId ? 'batch_detail' : 'main')} onSave={handleSaveBatch}>
        <BatchFormFields batchForm={batchForm} setBatchForm={setBatchForm} />
      </FormModal>
    );
  }

  // 3. Batch Detail View
  if (subView === 'batch_detail' && selectedBatch) {
    const products = data.products.filter(p => p.batchId === selectedBatchId);
    return (
       <div className="fixed inset-0 z-[100] bg-[#F4F6F9] flex flex-col animate-in slide-in-from-right">
          <header className="bg-[#2D3142] text-white p-6 pb-12 rounded-b-[2.5rem] shadow-xl shrink-0">
             <div className="flex justify-between items-start mb-6">
                <button onClick={() => setSubView('main')} className="bg-white/10 p-2 rounded-full"><ArrowLeft size={20} /></button>
                <div className="flex gap-2">
                   <button onClick={() => { setBatchForm({ plate: selectedBatch.plateNumber, cost: selectedBatch.cost.toString(), weight: selectedBatch.totalWeight.toString() }); setSubView('edit_batch'); }} className="bg-white/10 p-2 rounded-full"><Edit2 size={20} /></button>
                </div>
             </div>
             <div>
                <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">当前车次</p>
                <h1 className="text-4xl font-black tracking-tighter mb-4">{selectedBatch.plateNumber}</h1>
                <div className="flex gap-4">
                   <div className="bg-white/10 px-4 py-2 rounded-xl"><p className="text-[10px] text-gray-400 uppercase">总成本</p><p className="font-black">¥{selectedBatch.cost}</p></div>
                   <div className="bg-white/10 px-4 py-2 rounded-xl"><p className="text-[10px] text-gray-400 uppercase">总重量</p><p className="font-black">{selectedBatch.totalWeight}斤</p></div>
                </div>
             </div>
          </header>
          
          <div className="flex-1 overflow-y-auto px-4 -mt-8 space-y-4 pb-32 no-scrollbar">
             <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="font-black text-gray-800">关联商品</h3>
                   <button onClick={() => { setSelectedBatchId(selectedBatch.id); setProductForm({ name: '', category: '柑橘', mode: PricingMode.WEIGHT, sell: '', stock: '', tare: '0', threshold: '' }); setSubView('add_product'); }} className="flex items-center gap-1 text-emerald-600 text-xs font-black"><PlusCircle size={14}/> 添加商品</button>
                </div>
                {products.map(p => (
                   <div key={p.id} onClick={() => { setSelectedProductId(p.id); setProductForm({ name: p.name, category: p.category, mode: p.pricingMode, sell: p.sellingPrice?.toString() || '0', stock: p.stockQty.toString(), tare: p.defaultTare.toString(), threshold: p.lowStockThreshold?.toString() || '20' }); setSubView('edit_product'); }} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl active:bg-gray-100 transition-colors">
                      <div><p className="font-black text-gray-800">{p.name}</p><p className="text-xs text-gray-400 font-bold">库存: {p.stockQty}</p></div>
                      <Edit2 size={16} className="text-gray-300" />
                   </div>
                ))}
             </div>
             
             <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="font-black text-gray-800">额外费用</h3>
                   <button onClick={() => setShowFeeModal(true)} className="flex items-center gap-1 text-blue-600 text-xs font-black"><PlusCircle size={14}/> 添加费用</button>
                </div>
                {selectedBatch.extraFees.length > 0 ? selectedBatch.extraFees.map(f => (
                   <div key={f.id} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                      <span className="text-gray-500 font-bold text-sm">{f.name}</span>
                      <div className="flex items-center gap-3">
                         <span className="font-black text-gray-800">¥{f.amount}</span>
                         <button onClick={() => removeExtraFee(selectedBatch.id, f.id)} className="text-red-300"><Minus size={14} /></button>
                      </div>
                   </div>
                )) : <div className="text-center text-xs text-gray-300 py-2">暂无额外费用</div>}
             </div>
          </div>
          
          {showFeeModal && (
             <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-6 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 space-y-4">
                   <h3 className="font-black text-xl">添加费用</h3>
                   <input value={feeForm.name} onChange={e => setFeeForm({...feeForm, name: e.target.value})} placeholder="费用名称" className="w-full bg-gray-50 p-4 rounded-xl font-bold" />
                   <input type="number" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: e.target.value})} placeholder="金额" className="w-full bg-gray-50 p-4 rounded-xl font-bold" />
                   <button onClick={handleAddFee} className="w-full bg-blue-500 text-white py-4 rounded-xl font-black">确认添加</button>
                   <button onClick={() => setShowFeeModal(false)} className="w-full text-gray-400 py-2 font-bold">取消</button>
                </div>
             </div>
          )}
       </div>
    );
  }

  // 4. Add/Edit Product Modal
  if (subView === 'add_product' || subView === 'edit_product') {
     return (
        <FormModal title={subView === 'add_product' ? '添加商品' : '编辑商品'} onBack={() => setSubView('batch_detail')} onSave={handleSaveProduct}>
           <ProductFormFields productForm={productForm} setProductForm={setProductForm} />
           {subView === 'edit_product' && (
              <button onClick={() => { if(confirm('确认删除该商品吗？')) { deleteProduct(selectedProductId!); setSubView('batch_detail'); }}} className="w-full mt-8 py-4 text-red-500 bg-red-50 rounded-2xl font-black flex items-center justify-center gap-2"><Trash2 size={18}/> 删除此商品</button>
           )}
        </FormModal>
     );
  }

  // 5. History View (Standard List) - Enhanced to show Repayments
  if (subView === 'history') {
    return (
      <SubViewShell 
        title="单据查询" 
        onBack={() => setSubView('main')} 
        searchProps={{ value: orderSearch, onChange: setOrderSearch, placeholder: '搜索单号或客户...' }}
        batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: activeBatches }}
      >
        {combinedHistory.length > 0 ? combinedHistory.map((item: any) => {
             // --- Render REPAYMENT Record ---
             if (item.type === 'repayment') {
                 const rep = item as Repayment;
                 return (
                    <div key={rep.id} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 flex justify-between items-center relative overflow-hidden">
                       <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400"></div>
                       <div className="pl-3">
                           <div className="flex items-center gap-2 mb-1">
                               <span className="font-black text-gray-800">{rep.customerName}</span>
                               <span className="bg-emerald-100 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded font-black">还款</span>
                           </div>
                           <p className="text-xs text-gray-400 font-bold">{new Date(rep.date).toLocaleString()}</p>
                           {rep.note && <p className="text-[10px] text-gray-300 mt-0.5">备注: {rep.note}</p>}
                       </div>
                       <div className="text-right">
                           <p className="font-black text-lg text-emerald-500">+¥{rep.amount}</p>
                           <p className="text-[10px] text-gray-400 font-bold">已入账</p>
                       </div>
                    </div>
                 );
             }

             // --- Render ORDER Record ---
             const order = item as Order;
             const isCancelled = order.status === OrderStatus.CANCELLED;
             return (
                <div 
                  key={order.id}
                  onClick={() => { setSelectedOrderId(order.id); setSubView('order_detail'); }} 
                  className={`bg-white rounded-2xl p-4 shadow-sm border ${isCancelled ? 'border-red-100 bg-red-50/30 opacity-70' : 'border-gray-50'} active:scale-[0.98] transition-all flex justify-between items-center`}
                >
                  <div>
                     <div className="flex items-center gap-2 mb-1">
                        <span className={`font-black ${isCancelled ? 'text-red-400 line-through' : 'text-gray-800'}`}>{order.customerName}</span>
                        {isCancelled ? (
                             <span className="bg-red-100 text-red-500 text-[10px] px-1 rounded font-black">已作废</span>
                        ) : (
                             <span className="bg-blue-50 text-blue-500 text-[10px] px-1 rounded font-black">开单</span>
                        )}
                     </div>
                     <p className="text-xs text-gray-400 font-bold mb-1">{order.items ? order.items.length : 0}项商品 - {new Date(order.createdAt).toLocaleTimeString()}</p>
                     <p className="text-[10px] text-gray-300 font-mono">{order.orderNo}</p>
                  </div>
                  <div className="text-right">
                     <p className="font-black text-lg text-gray-900">¥{order.totalAmount}</p>
                     <p className={`text-[10px] font-bold ${order.totalAmount - order.receivedAmount > 0.01 ? 'text-red-400' : 'text-emerald-500'}`}>
                        {order.totalAmount - order.receivedAmount > 0.01 ? `欠 ¥${(order.totalAmount - order.receivedAmount).toFixed(1)}` : '已付清'}
                     </p>
                  </div>
                </div>
             );
        }) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <Search size={48} strokeWidth={1} className="opacity-20"/>
                <p className="font-bold text-sm">没有找到相关记录</p>
            </div>
        )}
      </SubViewShell>
    );
  }

  // 6. Order Detail View
  if (subView === 'order_detail' && selectedOrder) {
    const isCancelled = selectedOrder.status === OrderStatus.CANCELLED;
    return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right">
         <header className="bg-[#2D3142] text-white p-6 pb-8 shrink-0 relative z-20">
            <div className="flex justify-between items-center mb-6">
               <button onClick={() => setSubView('history')} className="bg-white/10 p-2 rounded-full"><ArrowLeft size={20} /></button>
               <h1 className="font-black text-lg">订单详情</h1>
               <div className="w-9"></div>
            </div>
            <div className="text-center space-y-1">
               <p className="text-3xl font-black">¥{selectedOrder.totalAmount}</p>
               <p className={`text-sm font-bold opacity-80 ${isCancelled ? 'text-red-400' : ''}`}>{isCancelled ? '已作废' : '订单总额'}</p>
            </div>
         </header>
         <div className="flex-1 overflow-y-auto p-6 -mt-6 bg-white rounded-t-[2rem] space-y-6 relative z-10 pt-10">
            <div className="space-y-4">
               {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-4 last:border-0">
                     <div>
                        <p className="font-black text-gray-800 text-lg">{item.productName}</p>
                        <p className="text-xs text-gray-400 font-bold">{item.qty}件 | ¥{item.unitPrice}/单价</p>
                     </div>
                     <p className="font-black text-gray-900">¥{item.subtotal}</p>
                  </div>
               ))}
            </div>
            
            <div className="bg-gray-50 p-6 rounded-2xl space-y-3">
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">客户</span><span className="font-black">{selectedOrder.customerName}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">支付方式</span><span className="font-black">{selectedOrder.paymentMethod}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">实收</span><span className="font-black text-emerald-600">¥{selectedOrder.receivedAmount}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">优惠/抹零</span><span className="font-black text-gray-800">¥{selectedOrder.discount}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">时间</span><span className="font-black text-gray-800">{new Date(selectedOrder.createdAt).toLocaleString()}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">单号</span><span className="font-black text-gray-400 font-mono text-xs">{selectedOrder.orderNo}</span></div>
            </div>

            {!isCancelled && (
                <button 
                  onClick={() => { 
                      deleteOrder(selectedOrder.id); 
                      setSubView('history'); 
                  }} 
                  className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-lg active:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={20} />
                  删除此单 (自动退货/退库存)
                </button>
            )}
         </div>
      </div>
    );
  }

  // 7. Inventory List View (Standard List)
  if (subView === 'inventory') {
     return (
        <SubViewShell 
            title="库存盘点" 
            onBack={() => setSubView('main')}
            searchProps={{ value: invSearch, onChange: setInvSearch, placeholder: '搜索库存商品...' }}
            batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: activeBatches }}
        >
            {filteredInventory.length > 0 ? filteredInventory.map(p => {
               if (!p) return null;
               const isLowStock = p.stockQty <= (p.lowStockThreshold || 10);
               const batch = data.batches.find(b => b && b.id === p.batchId);
               return (
                  <div key={p.id} className={`bg-white rounded-2xl p-4 shadow-sm border active:scale-[0.99] transition-all flex justify-between items-center ${isLowStock ? 'border-red-200 bg-red-50/20' : 'border-gray-50'}`}>
                     <div>
                        <div className="flex items-center gap-2">
                           <h3 className="font-black text-gray-800">{p.name}</h3>
                           <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{batch?.plateNumber || '未知车次'}</span>
                           {isLowStock && <AlertTriangle size={14} className="text-red-500" />}
                        </div>
                        <p className="text-xs text-gray-400 font-bold mt-1">
                           {p.stockQty}件 {p.pricingMode === PricingMode.WEIGHT && `| ${p.stockWeight.toFixed(1)}斤`}
                        </p>
                     </div>
                     <button 
                       onClick={() => { 
                           setAdjustForm({ 
                               id: p.id, 
                               name: p.name, 
                               currentQty: p.stockQty, 
                               currentWeight: p.stockWeight,
                               actualQty: '',
                               actualWeight: ''
                           }); 
                           setSubView('adjust_stock'); 
                       }} 
                       className="px-3 py-2 bg-gray-50 text-emerald-600 rounded-xl text-xs font-black border border-gray-100"
                     >
                        盘点
                     </button>
                  </div>
               );
            }) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                    <BoxSelect size={48} strokeWidth={1} className="opacity-20"/>
                    <p className="font-bold text-sm">无符合条件的商品</p>
                </div>
            )}
        </SubViewShell>
     );
  }

  // 8. Adjust Stock View
  if (subView === 'adjust_stock') {
    return (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-bottom">
            <header className="px-6 py-6 border-b flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-800">库存修正</h2>
                <button onClick={() => setSubView('inventory')} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
            </header>
            <div className="p-8 space-y-8">
                <div>
                    <p className="text-sm font-bold text-gray-400 mb-2">当前商品</p>
                    <h3 className="text-3xl font-black text-gray-900">{adjustForm.name}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-2xl border-2 border-transparent">
                        <p className="text-xs font-black text-gray-400 uppercase">系统库存 (件)</p>
                        <p className="text-2xl font-black text-gray-800">{adjustForm.currentQty}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-500 relative">
                        <p className="text-xs font-black text-emerald-600 uppercase">实际盘点 (件)</p>
                        <input 
                            autoFocus
                            type="number" 
                            value={adjustForm.actualQty} 
                            onChange={e => setAdjustForm({...adjustForm, actualQty: e.target.value})}
                            className="w-full bg-transparent text-2xl font-black text-emerald-900 outline-none mt-1 placeholder-emerald-200"
                            placeholder="?"
                        />
                        <div className="absolute top-2 right-2 text-emerald-500"><Edit2 size={16}/></div>
                    </div>
                </div>

                {/* 如果是按斤计价的，可能也需要修正重量 */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-2xl border-2 border-transparent">
                        <p className="text-xs font-black text-gray-400 uppercase">系统重量 (斤)</p>
                        <p className="text-2xl font-black text-gray-800">{adjustForm.currentWeight.toFixed(1)}</p>
                    </div>
                     <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-500 relative">
                        <p className="text-xs font-black text-blue-600 uppercase">实际称重 (斤)</p>
                        <input 
                            type="number" 
                            value={adjustForm.actualWeight} 
                            onChange={e => setAdjustForm({...adjustForm, actualWeight: e.target.value})}
                            className="w-full bg-transparent text-2xl font-black text-blue-900 outline-none mt-1 placeholder-blue-200"
                            placeholder="?"
                        />
                        <div className="absolute top-2 right-2 text-blue-500"><Scale size={16}/></div>
                    </div>
                </div>

                <div className="pt-8">
                    <button onClick={handleAdjustStock} className="w-full bg-gray-900 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-gray-200 active:scale-95 transition-all">确认修正</button>
                    <p className="text-center text-xs text-gray-400 mt-4 font-bold">修正后系统将以新数据为准，差异不计入报表</p>
                </div>
            </div>
        </div>
    );
  }

  // 9. Reconcile View
  if (subView === 'reconcile') {
      const filteredReconcileOrders = data.orders.filter(o => {
          if (!o || !o.createdAt) return false;
          const isDate = o.createdAt.startsWith(reconcileDate);
          const isActive = o.status === OrderStatus.ACTIVE;
          let isBatch = true;
          if (reconcileBatchId !== 'ALL') {
             const batchProductIds = data.products.filter(p => p.batchId === reconcileBatchId).map(p => p.id);
             isBatch = o.items.some(i => batchProductIds.includes(i.productId));
          }
          return isDate && isActive && isBatch;
      });

      const filteredReconcileExpenses = data.expenses.filter(e => {
          if (!e || !e.date) return false;
          const isDate = e.date.startsWith(reconcileDate);
          let isBatch = true;
          if (reconcileBatchId !== 'ALL') {
              isBatch = e.batchId === reconcileBatchId;
          }
          return isDate && isBatch;
      });
      
      const income = filteredReconcileOrders.reduce((sum, o) => sum + o.receivedAmount, 0);
      const expense = filteredReconcileExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      const byMethod = {
          WECHAT: filteredReconcileOrders.filter(o => o.paymentMethod === 'WECHAT').reduce((s,o)=>s+o.receivedAmount,0),
          ALIPAY: filteredReconcileOrders.filter(o => o.paymentMethod === 'ALIPAY').reduce((s,o)=>s+o.receivedAmount,0),
          CASH: filteredReconcileOrders.filter(o => o.paymentMethod === 'CASH').reduce((s,o)=>s+o.receivedAmount,0),
          OTHER: 0,
      };

      return (
         <SubViewShell 
             title="财务核对" 
             onBack={() => setSubView('main')}
             batchSelectorProps={{ 
                selectedBatchId: reconcileBatchId, 
                onSelectBatch: setReconcileBatchId, 
                batches: activeBatches 
            }}
         >
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-2 flex items-center justify-between">
                <span className="font-bold text-gray-500 text-sm flex items-center gap-1"><Calendar size={16}/> 选择日期</span>
                <div className="relative">
                     <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                        <span className="font-black text-gray-800">{reconcileDate}</span>
                     </div>
                     <input 
                        type="date" 
                        value={reconcileDate} 
                        onChange={e => setReconcileDate(e.target.value)} 
                        className="absolute inset-0 opacity-0 w-full h-full"
                     />
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">净现金流 (选定日期/车次)</p>
                    <p className="text-4xl font-black text-gray-900 mt-2">¥{(income - expense).toLocaleString()}</p>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-emerald-50 p-3 rounded-2xl"><p className="text-[10px] text-emerald-600 font-bold uppercase">总收入</p><p className="text-xl font-black text-emerald-600">+{income}</p></div>
                        <div className="bg-orange-50 p-3 rounded-2xl"><p className="text-[10px] text-orange-600 font-bold uppercase">总支出</p><p className="text-xl font-black text-orange-600">-{expense}</p></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                    <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2"><Wallet size={18}/> 渠道明细</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span>微信支付</span><span className="font-black">¥{byMethod.WECHAT}</span></div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span>支付宝</span><span className="font-black">¥{byMethod.ALIPAY}</span></div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span>现金</span><span className="font-black">¥{byMethod.CASH}</span></div>
                    </div>
                </div>
            </div>
         </SubViewShell>
      );
  }

  // 10. Customers View
  if (subView === 'customers') {
      const debtCustomers = data.customers.filter(c => c && c.totalDebt > 0 && !c.isGuest).sort((a,b) => b.totalDebt - a.totalDebt);
      const totalReceivable = debtCustomers.reduce((sum, c) => sum + c.totalDebt, 0);

      return (
         <SubViewShell 
            title="应收账款" 
            onBack={() => setSubView('main')}
            searchProps={{ value: custSearch, onChange: setCustSearch, placeholder: '搜索欠款客户...' }}
         >
             <div className="bg-red-50 p-6 rounded-[2rem] mb-4 flex justify-between items-center border border-red-100">
                 <div><p className="text-xs text-red-400 font-black uppercase tracking-widest">总应收款</p><p className="text-3xl font-black text-red-500">¥{totalReceivable.toLocaleString()}</p></div>
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-red-500 shadow-sm"><Users size={24}/></div>
             </div>
             
             <div className="space-y-3">
                 {debtCustomers.filter(c => c.name.includes(custSearch)).map(c => (
                     <div key={c.id} className="bg-white p-5 rounded-[1.5rem] flex justify-between items-center shadow-sm border border-gray-50">
                         <div>
                             <p className="font-black text-gray-800 text-lg">{c.name}</p>
                             <p className="text-xs text-gray-400 font-bold">电话: {c.phone || '未记录'}</p>
                         </div>
                         <div className="text-right">
                             <p className="text-xl font-black text-red-500">¥{c.totalDebt.toLocaleString()}</p>
                             <p className="text-[10px] text-gray-400 font-bold">欠款</p>
                         </div>
                     </div>
                 ))}
                 {debtCustomers.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">没有欠款客户，经营状况良好！</div>}
             </div>
         </SubViewShell>
      );
  }

  return null;
};

export default ManageView;
