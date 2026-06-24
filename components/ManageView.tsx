
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  Package, ArrowLeft, Truck, ChevronRight, X, Trash2, 
  Edit2, Scale, BoxSelect, TrendingUp, Search, Wallet, 
  Users, ArrowDownCircle, Share2, BarChart3, ClipboardCheck, Minus, 
  History, Receipt, UserCheck, Calendar, LayoutGrid, AlertTriangle, Layers, ClipboardEdit, RefreshCw, AlertCircle,
  Plus, PlusCircle, CheckCircle2, UserCog, FileText, Check
} from 'lucide-react';
import { PricingMode, OrderStatus, Order, Product, Batch, Repayment, ProductTemplate, PaymentMethod } from '../types';
import { 
  preciseCalc, downloadJSON, 
  getPurchaseRanking, getCustomerDebtStats, getDormantCustomers,
  getLowStockProducts, getSellOutForecast, getUnsellableProducts,
  getDebtRiskLevel, getDebtRiskSummary, DEBT_RISK_CONFIG,
  type CustomerPurchaseStat, type CustomerDebtStat, type DormantCustomer,
  type LowStockProduct, type SellOutForecast, type UnsellableProduct,
  type DebtRiskLevel, type DebtRiskSummary,
} from '../utils';

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
  headerRight?: React.ReactNode;
}> = ({ title, onBack, children, searchProps, batchSelectorProps, disableScroll = false, headerRight }) => (
  <div className="fixed inset-0 z-[100] bg-[#F4F6F9] flex flex-col animate-in slide-in-from-right">
    <header className="bg-white px-4 py-4 border-b flex items-center shrink-0 shadow-sm z-10">
      <button onClick={onBack} className="p-2 -ml-2 active:scale-90"><ArrowLeft /></button>
      <h1 className="text-lg font-black flex-1 text-center pr-8">{title}</h1>
      {headerRight && <div className="absolute right-4">{headerRight}</div>}
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
  productForm: { name: string; category: string; mode: PricingMode; sell: string; stock: string; tare: string; threshold: string; unitWeight: string };
  setProductForm: React.Dispatch<React.SetStateAction<{ name: string; category: string; mode: PricingMode; sell: string; stock: string; tare: string; threshold: string; unitWeight: string }>>;
  onOpenTemplates?: () => void;
}> = ({ productForm, setProductForm, onOpenTemplates }) => (
  <div className="space-y-5"> 
    {onOpenTemplates && (
        <button 
            onClick={onOpenTemplates}
            className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-sm border-2 border-dashed border-emerald-200 flex items-center justify-center gap-2 active:bg-emerald-100 mb-2"
        >
            <FileText size={18} /> 📜 从模板库导入... (快速填充)
        </button>
    )}
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
          <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">默认皮重 (小框/斤)</label>
          <input 
            value={productForm.tare} 
            onChange={e => setProductForm({...productForm, tare: e.target.value})} 
            type="number"
            placeholder="0.0"
            className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
          />
        </div>
      ) : (
        <div className="animate-in fade-in">
          <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">单件标准重量 (斤)</label>
          <input 
            value={productForm.unitWeight} 
            onChange={e => setProductForm({...productForm, unitWeight: e.target.value})} 
            type="number"
            placeholder="0.0"
            className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
          />
        </div>
      )}
      
      {productForm.mode === PricingMode.WEIGHT ? (
        <div className="animate-in fade-in">
          <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">预估单件毛重 (大框/斤)</label>
          <input 
            value={productForm.unitWeight} 
            onChange={e => setProductForm({...productForm, unitWeight: e.target.value})} 
            type="number"
            placeholder="如: 20"
            className="w-full mt-1 bg-gray-100 p-5 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all text-center" 
          />
        </div>
      ) : (
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
      )}
    </div>
    
    {productForm.mode === PricingMode.WEIGHT && (
      <div className="animate-in fade-in">
        <label className="text-xs font-bold text-red-400 uppercase tracking-wider px-1">预警件数 (低于变红)</label>
        <input 
          value={productForm.threshold} 
          onChange={e => setProductForm({...productForm, threshold: e.target.value})} 
          type="number"
          placeholder="20"
          className="w-full mt-1 bg-red-50 p-5 rounded-2xl font-bold text-lg text-red-500 border-2 border-transparent focus:border-red-400 focus:bg-white outline-none transition-all text-center placeholder-red-200" 
        />
      </div>
    )}
  </div>
);

const ManageView: React.FC<{ initialSubView?: string; onSubViewChange?: (view: string) => void }> = ({ initialSubView, onSubViewChange }) => {
  type ViewState = 'main' | 'history' | 'reconcile' | 'customers' | 'inventory' | 'adjust_stock' | 'batch_detail' | 'order_detail' | 'customer_detail' | 'stock_logs' | 'op_logs' | 'add_batch' | 'edit_batch' | 'add_product' | 'edit_product' | 'payees' | 'template_list' | 'customer_analysis' | 'stock_alert';
  const [subView, setSubViewState] = useState<ViewState>((initialSubView as ViewState) || 'main');

  const setSubView = (v: ViewState) => {
    setSubViewState(v);
    onSubViewChange?.(v);
  };
  
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // New State for delete confirmation
  
  // Filter States
  const [filterBatchId, setFilterBatchId] = useState<string>('ALL'); // For filters inside sub-views

  const [orderSearch, setOrderSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [stockLogSearch, setStockLogSearch] = useState('');
  const [opLogTypeFilter, setOpLogTypeFilter] = useState<string>('ALL');
  const [expandedOpLogId, setExpandedOpLogId] = useState<string | null>(null);
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({ name: '', phone: '', wechat: '', address: '', note: '' });
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({ name: '运费', amount: '' });
  const [newPayeeName, setNewPayeeName] = useState('');
  const [debtRiskFilter, setDebtRiskFilter] = useState<DebtRiskLevel | 'ALL'>('ALL');

  // Order Edit State
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [orderEditForm, setOrderEditForm] = useState({
    date: '',
    time: '',
    paymentMethod: PaymentMethod.WECHAT,
    mixedPayments: {
      [PaymentMethod.WECHAT]: '',
      [PaymentMethod.ALIPAY]: '',
      [PaymentMethod.CASH]: ''
    } as Record<PaymentMethod, string>,
    receivedAmount: '',
    discount: '',
    note: '',
    items: [] as Order['items']
  });

  // Payee Edit State
  const [editingPayee, setEditingPayee] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Batch Edit Orders State
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>([]);
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchEditDate, setBatchEditDate] = useState('');
  const [batchEditTime, setBatchEditTime] = useState('');
  const [batchEditPayee, setBatchEditPayee] = useState('');

  // Forms
  const [batchForm, setBatchForm] = useState({ plate: '', cost: '', weight: '' });
  const [productForm, setProductForm] = useState({ name: '', category: '柑橘', mode: PricingMode.WEIGHT, sell: '', stock: '', tare: '0', threshold: '', unitWeight: '' });
  
  // Template Form (Reusable)
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', category: '柑橘', mode: PricingMode.WEIGHT, sell: '', tare: '0', threshold: '', unitWeight: '' });

  // Reconcile States
  const [reconcileDate, setReconcileDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reconcileBatchId, setReconcileBatchId] = useState('ALL');

  // Inventory Adjustment State
  const [adjustForm, setAdjustForm] = useState({ 
    id: '', 
    name: '', 
    batchName: '', 
    currentQty: 0, 
    currentWeight: 0,
    initialQty: 0,
    initialWeight: 0,
    actualQty: '', 
    actualWeight: '',
    actualInitialQty: '',
    actualInitialWeight: '',
    reason: ''
  });

  const { data, addBatch, updateBatch, deleteBatch, addProduct, updateProduct, deleteProduct, adjustStock, addExtraFee, addOrder, addRepayment, deleteCustomer, updateCustomer, removeExtraFee, deleteOrder, updateOrder, updateRepayment, addPayee, updatePayee, deletePayee, addTemplate, deleteTemplate, exportData, importData, addExpense } = useApp();

  const selectedBatch = useMemo(() => data.batches.find(b => b.id === selectedBatchId), [data.batches, selectedBatchId]);
  const selectedOrder = useMemo(() => data.orders.find(o => o.id === selectedOrderId), [data.orders, selectedOrderId]);
  const selectedProduct = useMemo(() => data.products.find(p => p.id === selectedProductId), [data.products, selectedProductId]);
  const selectedCustomer = useMemo(() => data.customers.find(c => c.id === selectedCustId), [data.customers, selectedCustId]);

  const filteredStockLogs = useMemo(() => {
    return data.stockLogs.filter(log => 
      log.productName.includes(stockLogSearch)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.stockLogs, stockLogSearch]);

  const filteredOpLogs = useMemo(() => {
    return data.opLogs.filter(log => 
      opLogTypeFilter === 'ALL' || log.type === opLogTypeFilter
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.opLogs, opLogTypeFilter]);

  const customerOrders = useMemo(() => {
    if (!selectedCustId) return [];
    return data.orders
      .filter(o => o.customerId === selectedCustId && o.status === OrderStatus.ACTIVE)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.orders, selectedCustId]);

  const customerRepayments = useMemo(() => {
    if (!selectedCustId) return [];
    return data.repayments
      .filter(r => r.customerId === selectedCustId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.repayments, selectedCustId]);

  const customerStats = useMemo(() => {
    const orders = customerOrders;
    const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount - o.discount), 0);
    const orderCount = orders.length;
    const lastOrderDate = orders.length > 0 ? orders[0].createdAt : null;
    return { totalAmount, orderCount, lastOrderDate };
  }, [customerOrders]);

  const activeBatches = useMemo(() => data.batches.filter(b => b && !b.isClosed).sort((a, b) => new Date(b.inboundDate).getTime() - new Date(a.inboundDate).getTime()), [data.batches]);
  
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
    
    const existing = subView === 'edit_product' ? data.products.find(p => p.id === selectedProductId) : null;
    const inputStock = parseFloat(productForm.stock) || 0;
    const estimatedUnitWeight = parseFloat(productForm.unitWeight) || 0;
    const inputWeight = productForm.mode === PricingMode.WEIGHT ? (inputStock * estimatedUnitWeight) : 0;

    const newProduct: Product = {
      id: subView === 'edit_product' && selectedProductId ? selectedProductId : Date.now().toString(),
      name: productForm.name,
      category: productForm.category,
      pricingMode: productForm.mode,
      sellingPrice: parseFloat(productForm.sell) || 0,
      stockQty: inputStock,
      stockWeight: inputWeight,
      initialStockQty: existing ? existing.initialStockQty : inputStock,
      initialStockWeight: existing ? existing.initialStockWeight : inputWeight,
      defaultTare: parseFloat(productForm.tare) || 0,
      batchId: selectedBatchId,
      lowStockThreshold: parseFloat(productForm.threshold) || 20,
      unitWeight: estimatedUnitWeight
    };
    if (subView === 'edit_product') updateProduct(newProduct);
    else addProduct(newProduct);
    setSubView('batch_detail');
  };

  const handleAdjustStock = () => {
    const qty = parseFloat(adjustForm.actualQty);
    const weight = parseFloat(adjustForm.actualWeight);
    const initQty = parseFloat(adjustForm.actualInitialQty);
    const initWeight = parseFloat(adjustForm.actualInitialWeight);

    if (isNaN(qty)) return alert('请输入实际库存件数');
    if (isNaN(initQty)) return alert('请输入初始库存件数');
    
    const product = data.products.find(p => p.id === adjustForm.id);
    if (product?.pricingMode === PricingMode.WEIGHT) {
        if (isNaN(weight)) return alert('请输入实际总重量');
        if (isNaN(initWeight)) return alert('请输入初始总重量');
    }

    adjustStock(adjustForm.id, qty, isNaN(weight) ? 0 : weight, initQty, isNaN(initWeight) ? 0 : initWeight, adjustForm.reason || undefined);
    setSubView('inventory');
  };

  const handleAddFee = () => {
    if (!feeForm.amount || !selectedBatchId) return;
    const feeId = Date.now().toString();
    addExpense({
      id: feeId,
      amount: parseFloat(feeForm.amount),
      type: feeForm.name,
      date: new Date().toISOString().split('T')[0],
      note: '批次费用',
      batchId: selectedBatchId
    });
    setShowFeeModal(false);
    setFeeForm({ name: '运费', amount: '' });
  };

  const handleAddPayee = () => {
    if (!newPayeeName.trim()) return alert('请输入名字');
    addPayee(newPayeeName.trim());
    setNewPayeeName('');
  };

  const handleUpdatePayee = () => {
      if (!editingPayee || !editName.trim()) return;
      if (editName.trim() !== editingPayee && data.payees.includes(editName.trim())) {
          alert('该名字已存在');
          return;
      }
      updatePayee(editingPayee, editName.trim());
      setEditingPayee(null);
      setEditName('');
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name) return alert('请输入模板名称');
    addTemplate({
        id: Date.now().toString(),
        name: templateForm.name,
        category: templateForm.category,
        pricingMode: templateForm.mode,
        defaultPrice: parseFloat(templateForm.sell) || 0,
        defaultTare: parseFloat(templateForm.tare) || 0,
        lowStockThreshold: parseFloat(templateForm.threshold) || 20,
        unitWeight: parseFloat(templateForm.unitWeight) || 0
    });
    setIsAddingTemplate(false);
  };

  const handleOpenOrderEdit = () => {
    if (!selectedOrder) return;
    const dateObj = new Date(selectedOrder.createdAt);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = dateObj.toTimeString().slice(0, 5);
    
    const mixedPaymentsInit: Record<PaymentMethod, string> = {
      [PaymentMethod.WECHAT]: '',
      [PaymentMethod.ALIPAY]: '',
      [PaymentMethod.CASH]: ''
    };
    
    if (selectedOrder.paymentMethod === PaymentMethod.MIXED && selectedOrder.mixedPayments) {
      selectedOrder.mixedPayments.forEach(mp => {
        mixedPaymentsInit[mp.method] = mp.amount.toString();
      });
    }

    setOrderEditForm({
      date: dateStr,
      time: timeStr,
      paymentMethod: selectedOrder.paymentMethod,
      mixedPayments: mixedPaymentsInit,
      receivedAmount: selectedOrder.receivedAmount.toString(),
      discount: selectedOrder.discount.toString(),
      note: selectedOrder.note || '',
      items: [...selectedOrder.items]
    });
    setIsEditingOrder(true);
  };

  const handleEditItemQty = (index: number, qtyStr: string) => {
    const qty = parseFloat(qtyStr) || 0;
    if (qty < 0) return;
    setOrderEditForm(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index] };
      const product = data.products.find(p => p.id === item.productId);
      const oldQty = item.qty;
      const qtyDiff = qty - oldQty;
      if (product && qtyDiff > 0) {
        const availableQty = product.stockQty + oldQty;
        if (qty > availableQty) {
          alert(`库存不足！当前可用 ${availableQty} 件`);
          return prev;
        }
      }
      item.qty = qty;
      if (product?.pricingMode === PricingMode.WEIGHT) {
        const unitWeight = product.unitWeight || 0;
        const tareWeight = item.tareWeight || product.defaultTare * qty;
        item.grossWeight = preciseCalc(() => qty * unitWeight);
        item.netWeight = preciseCalc(() => item.grossWeight - tareWeight);
        if (product && qtyDiff > 0) {
          const availableWeight = product.stockWeight + (oldQty * unitWeight - item.tareWeight);
          if (item.netWeight > availableWeight + 0.01) {
            alert(`库存重量不足！`);
            return prev;
          }
        }
      }
      item.subtotal = preciseCalc(() => item.qty * item.unitPrice);
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const handleEditItemPrice = (index: number, priceStr: string) => {
    const price = parseFloat(priceStr) || 0;
    if (price < 0) return;
    setOrderEditForm(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index] };
      item.unitPrice = price;
      item.subtotal = preciseCalc(() => item.qty * item.unitPrice);
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const handleEditItemWeight = (index: number, weightStr: string) => {
    const weight = parseFloat(weightStr) || 0;
    if (weight < 0) return;
    setOrderEditForm(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index] };
      const product = data.products.find(p => p.id === item.productId);
      const oldNetWeight = item.netWeight;
      const weightDiff = weight - oldNetWeight;
      if (product && weightDiff > 0) {
        const availableWeight = product.stockWeight + oldNetWeight;
        if (weight > availableWeight + 0.01) {
          alert(`库存重量不足！当前可用 ${availableWeight.toFixed(2)} 斤`);
          return prev;
        }
      }
      item.netWeight = weight;
      item.subtotal = preciseCalc(() => item.netWeight * item.unitPrice);
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    setOrderEditForm(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: newItems };
    });
  };

  const handleAddProductToOrder = (product: Product) => {
    const existingIndex = orderEditForm.items.findIndex(i => i.productId === product.id);
    if (existingIndex >= 0) {
      alert('该商品已在订单中');
      return;
    }
    if (product.stockQty <= 0) {
      alert('该商品库存为0');
      return;
    }
    const isWeight = product.pricingMode === PricingMode.WEIGHT;
    const defaultQty = 1;
    const unitWeight = product.unitWeight || 0;
    const grossWeight = isWeight ? defaultQty * unitWeight : 0;
    const tareWeight = isWeight ? product.defaultTare * defaultQty : 0;
    const netWeight = isWeight ? grossWeight - tareWeight : 0;
    const unitPrice = product.sellingPrice || 0;
    const subtotal = isWeight 
      ? preciseCalc(() => netWeight * unitPrice)
      : preciseCalc(() => defaultQty * unitPrice);

    const newItem: Order['items'][0] = {
      productId: product.id,
      productName: product.name,
      qty: defaultQty,
      grossWeight,
      tareWeight,
      netWeight,
      unitPrice,
      subtotal
    };

    setOrderEditForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setShowProductPicker(false);
  };

  const handleSaveOrderEdit = () => {
    if (!selectedOrderId || !selectedOrder) return;
    
    const receivedAmount = parseFloat(orderEditForm.receivedAmount);
    const discount = parseFloat(orderEditForm.discount);
    
    if (isNaN(receivedAmount) || receivedAmount < 0) return alert('请输入有效的实收金额');
    if (isNaN(discount) || discount < 0) return alert('请输入有效的优惠金额');
    if (orderEditForm.items.length === 0) return alert('订单至少需要一个商品');

    const dateObj = new Date(selectedOrder.createdAt);
    if (orderEditForm.date) {
      const [y, m, d] = orderEditForm.date.split('-');
      dateObj.setFullYear(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    if (orderEditForm.time) {
      const [h, min] = orderEditForm.time.split(':');
      dateObj.setHours(parseInt(h), parseInt(min), 0, 0);
    }

    let mixedPayments: { method: PaymentMethod; amount: number }[] | undefined;
    if (orderEditForm.paymentMethod === PaymentMethod.MIXED) {
      mixedPayments = [
        { method: PaymentMethod.WECHAT, amount: parseFloat(orderEditForm.mixedPayments[PaymentMethod.WECHAT]) || 0 },
        { method: PaymentMethod.ALIPAY, amount: parseFloat(orderEditForm.mixedPayments[PaymentMethod.ALIPAY]) || 0 },
        { method: PaymentMethod.CASH, amount: parseFloat(orderEditForm.mixedPayments[PaymentMethod.CASH]) || 0 }
      ].filter(m => m.amount > 0);
    }

    const updates: Partial<Order> = {
      createdAt: dateObj.toISOString(),
      paymentMethod: orderEditForm.paymentMethod,
      receivedAmount,
      discount,
      note: orderEditForm.note,
      items: orderEditForm.items
    };

    if (mixedPayments !== undefined) {
      updates.mixedPayments = mixedPayments;
    }

    updateOrder(selectedOrderId, updates);
    setIsEditingOrder(false);
    alert('✅ 订单修改成功');
  };

  const handleSelectTemplate = (t: ProductTemplate) => {
      setProductForm({
          name: t.name,
          category: t.category,
          mode: t.pricingMode,
          sell: t.defaultPrice.toString(),
          tare: t.defaultTare.toString(),
          threshold: t.lowStockThreshold.toString(),
          stock: '',
          unitWeight: t.unitWeight?.toString() || ''
      });
      setSubView('add_product');
  };

  const handleOpenCustomerEdit = () => {
    if (!selectedCustomer) return;
    setCustomerEditForm({
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      wechat: selectedCustomer.wechat || '',
      address: selectedCustomer.address || '',
      note: selectedCustomer.note || ''
    });
    setShowCustomerEditModal(true);
  };

  const handleSaveCustomerEdit = () => {
    if (!selectedCustId || !customerEditForm.name.trim()) {
      alert('请输入客户姓名');
      return;
    }
    updateCustomer(selectedCustId, {
      name: customerEditForm.name.trim(),
      phone: customerEditForm.phone.trim(),
      wechat: customerEditForm.wechat.trim(),
      address: customerEditForm.address.trim(),
      note: customerEditForm.note.trim()
    });
    setShowCustomerEditModal(false);
  };

  // --- MERGED HISTORY LIST (Orders + Repayments) ---
  const combinedHistory = useMemo(() => {
    const orders: any[] = data.orders.map(o => ({ ...o, type: 'order' }));
    const repayments: any[] = data.repayments.map(r => ({ ...r, type: 'repayment', createdAt: r.date }));
    
    const combined = [...orders, ...repayments].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return combined.filter(item => {
        if (!item) return false;
        const name = item.customerName || '';
        const no = item.orderNo || '';
        const matchSearch = name.includes(orderSearch) || no.includes(orderSearch);
        
        let matchBatch = true;
        if (filterBatchId !== 'ALL') {
             if (item.type === 'order') {
                 const order = item as Order;
                 matchBatch = order.items.some(i => getProductBatchId(i.productId) === filterBatchId);
             } else {
                 matchBatch = false; 
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
           <div onClick={() => setSubView('payees')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all col-span-2 flex items-center gap-4">
               <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shrink-0"><UserCog size={24} /></div>
               <div>
                    <p className="font-black text-gray-800">收款人/员工管理</p>
                    <p className="text-xs text-gray-400 font-bold mt-1">配置开单与收款时的可选人员</p>
               </div>
           </div>
           <div onClick={() => setSubView('op_logs')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all col-span-2 flex items-center gap-4">
               <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center shrink-0"><ClipboardCheck size={24} /></div>
               <div>
                    <p className="font-black text-gray-800">操作日志</p>
                    <p className="text-xs text-gray-400 font-bold mt-1">查看系统所有操作记录</p>
               </div>
           </div>
           
           {/* Data Backup & Restore */}
           <div className="col-span-2 grid grid-cols-2 gap-4">
               <div onClick={() => {
                   const timestamp = new Date().toISOString().split('T')[0];
                   downloadJSON(data, `FruitPro_Backup_${timestamp}.json`);
               }} className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0"><Share2 size={20} /></div>
                   <div>
                       <p className="font-black text-gray-800 text-sm">备份数据</p>
                       <p className="text-[10px] text-gray-400 font-bold">导出到微信</p>
                   </div>
               </div>
               
               <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 active:scale-95 transition-all flex items-center gap-3 relative overflow-hidden">
                   <input 
                       type="file" 
                       accept=".json"
                       onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (!file) return;
                           const reader = new FileReader();
                           reader.onload = (ev) => {
                               const content = ev.target?.result as string;
                               if (content) {
                                   // The importData in store expects base64 string if it was exported via old method, 
                                   // OR it can handle raw JSON string if we modify it.
                                   // Let's try to parse it first to see if it's JSON.
                                   try {
                                       JSON.parse(content);
                                       // If successful, it's a JSON string.
                                       // We need to pass it to importData. 
                                       // Current importData handles base64 decoding.
                                       // Let's just pass the content, and let store handle it.
                                       // We might need to encode it to base64 to satisfy current store implementation 
                                       // or update store implementation.
                                       // Let's update store implementation to be more robust.
                                       importData(content); 
                                   } catch (e) {
                                       // If not JSON, maybe it's base64?
                                       importData(content);
                                   }
                               }
                           };
                           reader.readAsText(file);
                       }}
                       className="absolute inset-0 opacity-0 z-10"
                   />
                   <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0"><ArrowDownCircle size={20} /></div>
                   <div>
                       <p className="font-black text-gray-800 text-sm">恢复数据</p>
                       <p className="text-[10px] text-gray-400 font-bold">导入备份文件</p>
                   </div>
               </div>
           </div>
        </div>

        <div className="space-y-4">
           <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-lg text-gray-800">车次/批次管理</h3>
              <button onClick={() => { setBatchForm({plate:'', cost:'', weight:''}); setSubView('add_batch'); }} className="flex items-center gap-1 text-emerald-600 text-xs font-black bg-emerald-50 px-3 py-1.5 rounded-full"><Plus size={14}/> 新车入库</button>
           </div>
           
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

  // Payees View
  if (subView === 'payees') {
      return (
          <SubViewShell title="收款人管理" onBack={() => setSubView('main')}>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
                  <h3 className="font-black text-gray-800 text-sm">添加新人员</h3>
                  <div className="flex gap-3">
                      <input 
                        value={newPayeeName}
                        onChange={e => setNewPayeeName(e.target.value)}
                        placeholder="输入名字，如：李四"
                        className="flex-1 bg-gray-50 px-4 py-3 rounded-xl font-bold text-sm outline-none focus:bg-white focus:ring-2 ring-emerald-100 transition-all"
                      />
                      <button onClick={handleAddPayee} className="bg-emerald-500 text-white px-6 rounded-xl font-black text-sm active:scale-95 transition-all shadow-md shadow-emerald-200">添加</button>
                  </div>
              </div>
              
              <div className="space-y-3">
                  <p className="px-2 text-xs font-black text-gray-400 uppercase tracking-widest">现有人员列表</p>
                  {data.payees.map(p => (
                      <div key={p} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 flex justify-between items-center transition-all">
                          {editingPayee === p ? (
                              <div className="flex items-center gap-2 flex-1 animate-in fade-in">
                                  <input 
                                    autoFocus
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="flex-1 bg-gray-50 px-3 py-2 rounded-lg font-black text-gray-800 outline-none focus:ring-2 ring-emerald-100"
                                  />
                                  <button onClick={handleUpdatePayee} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg active:bg-emerald-100">
                                      <Check size={18} />
                                  </button>
                                  <button onClick={() => setEditingPayee(null)} className="p-2 bg-gray-50 text-gray-400 rounded-lg active:bg-gray-100">
                                      <X size={18} />
                                  </button>
                              </div>
                          ) : (
                              <>
                                <span className="font-black text-gray-800">{p}</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setEditingPayee(p); setEditName(p); }}
                                        className="text-blue-400 p-2 bg-blue-50 rounded-xl active:bg-blue-100 transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => { if(confirm(`确定要删除“${p}”吗？`)) deletePayee(p); }}
                                        className="text-red-400 p-2 bg-red-50 rounded-xl active:bg-red-100 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                              </>
                          )}
                      </div>
                  ))}
                  {data.payees.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">暂无人员，请添加</div>}
              </div>
          </SubViewShell>
      );
  }

  // Template List View
  if (subView === 'template_list') {
      const templates = data.templates || [];
      return (
          <SubViewShell title="选择商品模板" onBack={() => setSubView('add_product')}>
              <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 mb-4">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-black text-gray-800">常用商品模板</h3>
                     <button onClick={() => setIsAddingTemplate(true)} className="flex items-center gap-1 text-emerald-600 text-xs font-black bg-emerald-50 px-3 py-1.5 rounded-full"><Plus size={14}/> 新建模板</button>
                 </div>
                 
                 {isAddingTemplate && (
                     <div className="bg-gray-50 p-4 rounded-xl space-y-3 animate-in fade-in mb-4">
                         <input value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} placeholder="模板名称 (如: 砂糖橘-大框)" className="w-full bg-white px-3 py-2 rounded-lg text-sm font-bold" />
                         <div className="grid grid-cols-2 gap-2">
                             <input type="number" value={templateForm.sell} onChange={e => setTemplateForm({...templateForm, sell: e.target.value})} placeholder="默认售价" className="bg-white px-3 py-2 rounded-lg text-sm font-bold" />
                             <input type="number" value={templateForm.tare} onChange={e => setTemplateForm({...templateForm, tare: e.target.value})} placeholder={templateForm.mode === PricingMode.WEIGHT ? "默认皮重 (小框)" : "默认皮重"} className="bg-white px-3 py-2 rounded-lg text-sm font-bold" />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                             <input type="number" value={templateForm.unitWeight} onChange={e => setTemplateForm({...templateForm, unitWeight: e.target.value})} placeholder={templateForm.mode === PricingMode.WEIGHT ? "预估单件毛重 (大框)" : "单件标准重量"} className="bg-white px-3 py-2 rounded-lg text-sm font-bold" />
                             <input type="number" value={templateForm.threshold} onChange={e => setTemplateForm({...templateForm, threshold: e.target.value})} placeholder="预警件数" className="bg-white px-3 py-2 rounded-lg text-sm font-bold" />
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => setTemplateForm({...templateForm, mode: PricingMode.WEIGHT})} className={`flex-1 py-2 rounded-lg text-xs font-black ${templateForm.mode === PricingMode.WEIGHT ? 'bg-white shadow text-emerald-600' : 'text-gray-400'}`}>按斤</button>
                             <button onClick={() => setTemplateForm({...templateForm, mode: PricingMode.PIECE})} className={`flex-1 py-2 rounded-lg text-xs font-black ${templateForm.mode === PricingMode.PIECE ? 'bg-white shadow text-emerald-600' : 'text-gray-400'}`}>按件</button>
                         </div>
                         <div className="flex gap-2 pt-2">
                             <button onClick={handleSaveTemplate} className="flex-1 bg-emerald-500 text-white py-2 rounded-lg text-xs font-black">保存</button>
                             <button onClick={() => setIsAddingTemplate(false)} className="flex-1 bg-gray-200 text-gray-500 py-2 rounded-lg text-xs font-black">取消</button>
                         </div>
                     </div>
                 )}

                 <div className="space-y-2">
                     {templates.map(t => (
                         <div key={t.id} onClick={() => handleSelectTemplate(t)} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl active:bg-emerald-50 active:border-emerald-200 border border-transparent transition-all">
                             <div>
                                 <p className="font-black text-gray-800">{t.name}</p>
                                 <p className="text-[10px] text-gray-400 font-bold">默认: ¥{t.defaultPrice} | 皮: {t.defaultTare}</p>
                             </div>
                             <button 
                                onClick={(e) => { e.stopPropagation(); if(confirm('确认删除此模板？')) deleteTemplate(t.id); }}
                                className="p-2 text-gray-300 hover:text-red-400"
                             >
                                 <Trash2 size={16} />
                             </button>
                         </div>
                     ))}
                     {templates.length === 0 && !isAddingTemplate && (
                         <div className="text-center py-8 text-gray-400 font-bold text-xs">暂无模板，请先新建</div>
                     )}
                 </div>
              </div>
          </SubViewShell>
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
    
    // --- Dynamic Cost Logic ---
    const totalCost = selectedBatch.cost + selectedBatch.extraFees.reduce((sum, f) => sum + f.amount, 0);
    
    const recoveredRevenue = data.orders
        .filter(o => o.status === OrderStatus.ACTIVE)
        .reduce((sum, order) => {
            const batchItems = order.items.filter(i => getProductBatchId(i.productId) === selectedBatchId);
            const batchRevenue = batchItems.reduce((s, i) => s + i.subtotal, 0);
            return sum + batchRevenue;
        }, 0);

    const remainingDebt = Math.max(0, totalCost - recoveredRevenue);
    
    const remainingInventoryWeight = products.reduce((sum, p) => {
        if (p.pricingMode === PricingMode.WEIGHT) {
            return sum + p.stockWeight;
        } else {
            return sum + (p.stockQty * (p.unitWeight || 0));
        }
    }, 0);
    
    const dynamicUnitCost = remainingInventoryWeight > 0 ? remainingDebt / remainingInventoryWeight : 0;
    // --------------------------

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
             {/* Dynamic Cost Card */}
             <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-[2rem] shadow-lg text-white space-y-4">
                <div className="flex items-center gap-2 opacity-80">
                    <TrendingUp size={18} />
                    <h3 className="font-black text-sm uppercase tracking-wider">动态成本分析</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <p className="text-[10px] opacity-70 mb-1">待回本资金 (敞口)</p>
                        <p className="text-2xl font-black">¥{remainingDebt.toFixed(0)}</p>
                        <p className="text-[10px] opacity-50 mt-1">总投 {totalCost} - 已回 {recoveredRevenue.toFixed(0)}</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <p className="text-[10px] opacity-70 mb-1">死水斤价 (保底)</p>
                        <p className="text-2xl font-black">¥{dynamicUnitCost.toFixed(2)}<span className="text-xs font-normal">/斤</span></p>
                        <p className="text-[10px] opacity-50 mt-1">剩余库存折算 {remainingInventoryWeight.toFixed(0)}斤</p>
                    </div>
                </div>

                <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm space-y-2">
                    <p className="text-[10px] opacity-70 uppercase font-bold">各规格保底售价 (不亏本)</p>
                    {products.map(p => {
                        const unitWeight = p.pricingMode === PricingMode.WEIGHT ? 1 : (p.unitWeight || 0);
                        const breakEvenPrice = dynamicUnitCost * unitWeight;
                        if (unitWeight <= 0) return null;
                        
                        return (
                            <div key={p.id} className="flex justify-between items-center text-sm">
                                <span className="opacity-90">{p.name}</span>
                                <span className="font-mono font-bold">
                                    ¥{breakEvenPrice.toFixed(2)}
                                    <span className="text-[10px] opacity-60">/{p.pricingMode === PricingMode.WEIGHT ? '斤' : '件'}</span>
                                </span>
                            </div>
                        );
                    })}
                    {products.length === 0 && <p className="text-xs opacity-50 text-center">暂无商品</p>}
                </div>
             </div>

             <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="font-black text-gray-800">关联商品</h3>
                   <button onClick={() => { setSelectedBatchId(selectedBatch.id); setProductForm({ name: '', category: '柑橘', mode: PricingMode.WEIGHT, sell: '', stock: '', tare: '0', threshold: '', unitWeight: '' }); setSubView('add_product'); }} className="flex items-center gap-1 text-emerald-600 text-xs font-black"><PlusCircle size={14}/> 添加商品</button>
                </div>
                {products.map(p => (
                   <div key={p.id} onClick={() => { setSelectedProductId(p.id); setProductForm({ name: p.name, category: p.category, mode: p.pricingMode, sell: p.sellingPrice?.toString() || '0', stock: p.stockQty.toString(), tare: p.defaultTare.toString(), threshold: p.lowStockThreshold?.toString() || '20', unitWeight: p.unitWeight?.toString() || '' }); setSubView('edit_product'); }} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl active:bg-gray-100 transition-colors">
                      <div>
                        <p className="font-black text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400 font-bold">
                            库存: {p.stockQty} 
                            {p.pricingMode === PricingMode.PIECE && p.unitWeight ? <span className="text-gray-300 ml-1">({p.unitWeight}斤/件)</span> : ''}
                        </p>
                      </div>
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
             
             <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-lg active:bg-red-100 transition-all flex items-center justify-center gap-2 mt-8"
             >
                <Trash2 size={20} /> 删除此车次
             </button>
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

          {/* Custom Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-[600] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
                    <div className="flex items-center gap-3 text-red-500 mb-1">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle size={24} strokeWidth={2.5}/>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900">确认删除车次？</h3>
                            <p className="text-xs font-bold text-red-500">此操作无法撤销</p>
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm text-gray-600 space-y-3">
                        <p>您即将删除：<span className="font-black text-gray-900">{selectedBatch.plateNumber}</span></p>
                        <div className="h-px bg-gray-200"></div>
                        <p className="font-bold">连带删除内容：</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                            <li>关联的所有商品及库存</li>
                            <li>关联的费用支出 (运费/过磅费等)</li>
                        </ul>
                        <div className="h-px bg-gray-200"></div>
                        <p className="font-bold">库存详情：</p>
                        {(() => {
                            const batchProducts = data.products.filter(p => p.batchId === selectedBatch.id);
                            const productCount = batchProducts.length;
                            const totalStockQty = batchProducts.reduce((sum, p) => sum + p.stockQty, 0);
                            const totalStockWeight = batchProducts.reduce((sum, p) => sum + p.stockWeight, 0);
                            const hasStock = totalStockQty > 0 || totalStockWeight > 0;
                            return (
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">商品种类：</span>
                                        <span className="font-black text-gray-800">共 {productCount} 种</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">剩余库存件数：</span>
                                        <span className="font-black text-gray-800">{totalStockQty} 件</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">剩余库存重量：</span>
                                        <span className="font-black text-gray-800">{totalStockWeight} 斤</span>
                                    </div>
                                    {hasStock && (
                                        <p className="text-red-500 font-black pt-2 flex items-center gap-1">
                                            <AlertTriangle size={14} /> 还有库存未售完，删除后数据无法恢复
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setShowDeleteConfirm(false)} 
                            className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-xl font-black text-sm active:scale-95 transition-all"
                        >
                            我再想想
                        </button>
                        <button 
                            onClick={() => {
                                deleteBatch(selectedBatch.id);
                                setShowDeleteConfirm(false);
                                setSubView('main');
                                setSelectedBatchId(null);
                            }}
                            className="flex-1 py-4 bg-red-500 text-white rounded-xl font-black text-sm shadow-lg shadow-red-200 active:scale-95 transition-all"
                        >
                            确认删除
                        </button>
                    </div>
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
           <ProductFormFields 
                productForm={productForm} 
                setProductForm={setProductForm} 
                onOpenTemplates={subView === 'add_product' ? () => setSubView('template_list') : undefined} 
           />
           {subView === 'edit_product' && (
              <button onClick={() => { if(confirm('确认删除该商品吗？')) { deleteProduct(selectedProductId!); setSubView('batch_detail'); }}} className="w-full mt-8 py-4 text-red-500 bg-red-50 rounded-2xl font-black flex items-center justify-center gap-2"><Trash2 size={18}/> 删除此商品</button>
           )}
        </FormModal>
     );
  }

  // 5. History View (Standard List)
  if (subView === 'history') {
    return (
      <SubViewShell 
        title="单据查询" 
        onBack={() => {
            if (isBatchEditMode) {
                setIsBatchEditMode(false);
                setSelectedHistoryItems([]);
            } else {
                setSubView('main');
            }
        }} 
        searchProps={{ value: orderSearch, onChange: setOrderSearch, placeholder: '搜索单号或客户...' }}
        batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: activeBatches }}
        headerRight={
            <button 
                onClick={() => {
                    if (isBatchEditMode) {
                        if (selectedHistoryItems.length > 0) {
                            setShowBatchEditModal(true);
                        } else {
                            setIsBatchEditMode(false);
                        }
                    } else {
                        setIsBatchEditMode(true);
                        setSelectedHistoryItems([]);
                    }
                }}
                className={`text-sm font-bold ${isBatchEditMode ? (selectedHistoryItems.length > 0 ? 'text-emerald-600' : 'text-gray-500') : 'text-emerald-600'}`}
            >
                {isBatchEditMode ? (selectedHistoryItems.length > 0 ? `修改(${selectedHistoryItems.length})` : '取消') : '批量修改'}
            </button>
        }
      >
        {combinedHistory.length > 0 ? combinedHistory.map((item: any) => {
             // ... Repayment Logic ...
             if (item.type === 'repayment') {
                 const rep = item as Repayment;
                 const payMethodMap: Record<string, string> = { 'WECHAT': '微信', 'ALIPAY': '支付宝', 'CASH': '现金', 'OTHER': '其他' };
                 const methodLabel = rep.paymentMethod ? payMethodMap[rep.paymentMethod] : '现金';

                 return (
                    <div key={rep.id} className="flex items-center gap-2">
                       {isBatchEditMode && (
                           <input 
                               type="checkbox" 
                               checked={selectedHistoryItems.includes(rep.id)}
                               onChange={(e) => {
                                   if (e.target.checked) {
                                       setSelectedHistoryItems(prev => [...prev, rep.id]);
                                   } else {
                                       setSelectedHistoryItems(prev => prev.filter(id => id !== rep.id));
                                   }
                               }}
                               className="w-5 h-5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                           />
                       )}
                       <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 flex justify-between items-center relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400"></div>
                          <div className="pl-3">
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="font-black text-gray-800">{rep.customerName}</span>
                                  <span className="bg-emerald-100 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded font-black">还款</span>
                              </div>
                              <p className="text-xs text-gray-600 font-bold mb-1">
                                {rep.payee ? `${rep.payee}收 - ${methodLabel}` : '未记录经手人'}
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono">{new Date(rep.date).toLocaleString()}</p>
                              {rep.note && <p className="text-[10px] text-gray-300 mt-0.5">备注: {rep.note}</p>}
                          </div>
                          <div className="text-right">
                              <p className="font-black text-lg text-emerald-500">+¥{rep.amount}</p>
                              <p className="text-[10px] text-gray-400 font-bold">已入账</p>
                          </div>
                       </div>
                    </div>
                 );
             }

             // ... Order Logic ...
             const order = item as Order;
             const isCancelled = order.status === OrderStatus.CANCELLED;
             const summary = order.items.map(i => `${i.productName} x${i.qty}`).join(', ');

             return (
                <div key={order.id} className="flex items-center gap-2">
                   {isBatchEditMode && (
                       <input 
                           type="checkbox" 
                           checked={selectedHistoryItems.includes(order.id)}
                           onChange={(e) => {
                               if (e.target.checked) {
                                   setSelectedHistoryItems(prev => [...prev, order.id]);
                               } else {
                                   setSelectedHistoryItems(prev => prev.filter(id => id !== order.id));
                               }
                           }}
                           className="w-5 h-5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                       />
                   )}
                   <div 
                     onClick={() => { if (!isBatchEditMode) { setSelectedOrderId(order.id); setSubView('order_detail'); } }} 
                     className={`flex-1 bg-white rounded-2xl p-4 shadow-sm border ${isCancelled ? 'border-red-100 bg-red-50/30 opacity-70' : 'border-gray-50'} ${!isBatchEditMode ? 'active:scale-[0.98]' : ''} transition-all flex justify-between items-center`}
                   >
                     <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                           <span className={`font-black text-sm ${isCancelled ? 'text-red-400 line-through' : 'text-gray-800'}`}>{order.customerName}</span>
                           {isCancelled ? (
                                <span className="bg-red-100 text-red-500 text-[10px] px-1.5 py-0.5 rounded font-black whitespace-nowrap">已作废</span>
                           ) : (
                                <span className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-black whitespace-nowrap">开单</span>
                           )}
                        </div>
                        
                        <p className="text-xs text-gray-600 font-bold mb-1.5 truncate">
                           {summary || '无商品明细'}
                        </p>
                        
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                           <span>{order.payee ? `${order.payee}开单` : '无经手人'}</span>
                           <span className="w-0.5 h-2 bg-gray-300"></span>
                           <span className="font-mono">{new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                     </div>
                     
                     <div className="text-right shrink-0">
                        <p className="font-black text-lg text-gray-900">¥{order.totalAmount}</p>
                        <p className={`text-[10px] font-bold ${order.totalAmount - order.receivedAmount > 0.01 ? 'text-red-400' : 'text-emerald-500'}`}>
                           {order.totalAmount - order.receivedAmount > 0.01 ? `欠 ¥${(order.totalAmount - order.receivedAmount).toFixed(1)}` : '已付清'}
                        </p>
                     </div>
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

      if (isEditingOrder) {
        return (
          <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right">
            <header className="bg-[#2D3142] text-white p-6 pb-4 shrink-0 relative z-20">
              <div className="flex justify-between items-center mb-2">
                <button onClick={() => setIsEditingOrder(false)} className="bg-white/10 p-2 rounded-full"><X size={20} /></button>
                <h1 className="font-black text-lg">编辑订单</h1>
                <div className="w-9"></div>
              </div>
              <p className="text-center text-sm text-white/70 font-bold">{selectedOrder.orderNo}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">商品明细</label>
                  <button 
                    onClick={() => setShowProductPicker(true)}
                    className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1"
                  >
                    <Plus size={14} /> 添加商品
                  </button>
                </div>
                <div className="space-y-3">
                  {orderEditForm.items.map((item, idx) => {
                    const product = data.products.find(p => p.id === item.productId);
                    const isWeight = product?.pricingMode === PricingMode.WEIGHT;
                    return (
                      <div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-black text-gray-800">{item.productName}</p>
                          <button 
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-400 p-1 -mr-1"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400">数量(件)</label>
                            <input
                              type="number"
                              value={item.qty}
                              onChange={e => handleEditItemQty(idx, e.target.value)}
                              className="w-full mt-1 bg-white p-2 rounded-xl font-bold text-sm text-gray-800 outline-none border border-gray-200 focus:border-emerald-400 text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400">单价(元)</label>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={e => handleEditItemPrice(idx, e.target.value)}
                              className="w-full mt-1 bg-white p-2 rounded-xl font-bold text-sm text-emerald-600 outline-none border border-gray-200 focus:border-emerald-400 text-center"
                            />
                          </div>
                          {isWeight ? (
                            <div>
                              <label className="text-[10px] font-bold text-gray-400">净重(斤)</label>
                              <input
                                type="number"
                                value={item.netWeight}
                                onChange={e => handleEditItemWeight(idx, e.target.value)}
                                className="w-full mt-1 bg-white p-2 rounded-xl font-bold text-sm text-gray-800 outline-none border border-gray-200 focus:border-emerald-400 text-center"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="text-[10px] font-bold text-gray-400">小计(元)</label>
                              <div className="w-full mt-1 bg-white p-2 rounded-xl font-bold text-sm text-gray-800 border border-gray-200 text-center">
                                ¥{item.subtotal}
                              </div>
                            </div>
                          )}
                        </div>
                        {isWeight && (
                          <div className="flex justify-between text-xs bg-white p-2 rounded-xl border border-gray-100">
                            <span className="text-gray-400 font-bold">小计</span>
                            <span className="font-black text-gray-800">¥{item.subtotal}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {orderEditForm.items.length === 0 && (
                    <div className="bg-gray-50 p-8 rounded-2xl text-center text-gray-400 font-bold text-sm border border-dashed border-gray-200">
                      暂无商品，点击上方"添加商品"添加
                    </div>
                  )}
                </div>
                {orderEditForm.items.length > 0 && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center">
                    <span className="font-black text-emerald-700 text-sm">商品合计</span>
                    <span className="font-black text-emerald-600 text-xl">
                      ¥{orderEditForm.items.reduce((sum, item) => preciseCalc(() => sum + item.subtotal), 0)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">日期与时间</label>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="date"
                    value={orderEditForm.date}
                    onChange={e => setOrderEditForm({...orderEditForm, date: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-gray-800 outline-none border-2 border-transparent focus:border-emerald-400 focus:bg-white transition-all"
                  />
                  <input 
                    type="time"
                    value={orderEditForm.time}
                    onChange={e => setOrderEditForm({...orderEditForm, time: e.target.value})}
                    className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-gray-800 outline-none border-2 border-transparent focus:border-emerald-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">支付方式</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: PaymentMethod.WECHAT, label: '微信', icon: '💬' },
                    { id: PaymentMethod.ALIPAY, label: '支付宝', icon: '💳' },
                    { id: PaymentMethod.CASH, label: '现金', icon: '💰' },
                    { id: PaymentMethod.OTHER, label: '其他', icon: '📋' },
                    { id: PaymentMethod.MIXED, label: '混合', icon: '🔀' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setOrderEditForm({...orderEditForm, paymentMethod: m.id})}
                      className={`py-3 rounded-xl text-[10px] font-black border-2 transition-all flex flex-col items-center gap-1 ${orderEditForm.paymentMethod === m.id ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                    >
                      <span className="text-lg">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {orderEditForm.paymentMethod === PaymentMethod.MIXED && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">混合支付明细</label>
                  {[
                    { id: PaymentMethod.WECHAT, label: '微信', color: 'text-green-600' },
                    { id: PaymentMethod.ALIPAY, label: '支付宝', color: 'text-blue-600' },
                    { id: PaymentMethod.CASH, label: '现金', color: 'text-orange-600' }
                  ].map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                      <span className={`text-sm font-black w-16 ${m.color}`}>{m.label}</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={orderEditForm.mixedPayments[m.id as PaymentMethod]}
                        onChange={e => setOrderEditForm({
                          ...orderEditForm,
                          mixedPayments: {
                            ...orderEditForm.mixedPayments,
                            [m.id]: e.target.value
                          }
                        })}
                        className="w-full bg-transparent text-right text-lg font-black text-gray-800 outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">实收金额</label>
                <input 
                  type="number"
                  value={orderEditForm.receivedAmount}
                  onChange={e => setOrderEditForm({...orderEditForm, receivedAmount: e.target.value})}
                  className="w-full bg-emerald-50 p-5 rounded-2xl text-3xl font-black text-emerald-600 outline-none border-2 border-transparent focus:border-emerald-500 transition-all text-center"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">优惠/抹零</label>
                <input 
                  type="number"
                  value={orderEditForm.discount}
                  onChange={e => setOrderEditForm({...orderEditForm, discount: e.target.value})}
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xl font-black text-gray-800 outline-none border-2 border-transparent focus:border-emerald-400 transition-all text-center"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">备注</label>
                <textarea
                  value={orderEditForm.note}
                  onChange={e => setOrderEditForm({...orderEditForm, note: e.target.value})}
                  placeholder="备注信息（可选）"
                  rows={3}
                  className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-gray-800 outline-none border-2 border-transparent focus:border-emerald-400 transition-all resize-none"
                />
              </div>
            </div>
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-20">
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditingOrder(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-base active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveOrderEdit}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-base shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  保存修改
                </button>
              </div>
            </div>

            {showProductPicker && (
              <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end justify-center animate-in fade-in">
                <div className="bg-white w-full max-w-lg rounded-t-[2rem] p-6 space-y-4 animate-in slide-in-from-bottom max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xl">选择商品</h3>
                    <button 
                      onClick={() => setShowProductPicker(false)}
                      className="p-2 text-gray-400"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {data.products.filter(p => p.stockQty > 0).map(product => {
                      const alreadyInOrder = orderEditForm.items.some(i => i.productId === product.id);
                      return (
                        <div
                          key={product.id}
                          onClick={() => !alreadyInOrder && handleAddProductToOrder(product)}
                          className={`p-4 rounded-2xl border flex justify-between items-center transition-all ${
                            alreadyInOrder 
                              ? 'bg-gray-50 border-gray-200 opacity-50' 
                              : 'bg-white border-gray-100 active:bg-emerald-50 active:border-emerald-200'
                          }`}
                        >
                          <div>
                            <p className="font-black text-gray-800">{product.name}</p>
                            <p className="text-xs text-gray-400 font-bold">
                              库存: {product.stockQty}件 / {product.stockWeight}斤
                              {product.sellingPrice ? ` | 售价 ¥${product.sellingPrice}` : ''}
                            </p>
                          </div>
                          {alreadyInOrder ? (
                            <span className="text-xs font-black text-gray-400">已添加</span>
                          ) : (
                            <Plus size={20} className="text-emerald-500" />
                          )}
                        </div>
                      );
                    })}
                    {data.products.filter(p => p.stockQty > 0).length === 0 && (
                      <div className="text-center py-10 text-gray-400 font-bold text-sm">
                        暂无库存商品
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

       return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right">
         <header className="bg-[#2D3142] text-white p-6 pb-8 shrink-0 relative z-20">
            <div className="flex justify-between items-center mb-6">
               <button onClick={() => setSubView('history')} className="bg-white/10 p-2 rounded-full"><ArrowLeft size={20} /></button>
               <h1 className="font-black text-lg">订单详情</h1>
               {!isCancelled ? (
                 <button onClick={handleOpenOrderEdit} className="bg-white/10 p-2 rounded-full"><Edit2 size={20} /></button>
               ) : (
                 <div className="w-9"></div>
               )}
            </div>
            <div className="text-center space-y-1">
               <p className="text-3xl font-black">¥{selectedOrder.totalAmount}</p>
               <p className={`text-sm font-bold opacity-80 ${isCancelled ? 'text-red-400' : ''}`}>{isCancelled ? '已作废' : '订单总额'}</p>
            </div>
         </header>
         <div className="flex-1 overflow-y-auto p-6 -mt-6 bg-white rounded-t-[2rem] space-y-6 relative z-10 pt-10 pb-32">
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
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">开单人</span><span className="font-black">{selectedOrder.payee || '未记录'}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">支付方式</span><span className="font-black">{selectedOrder.paymentMethod}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">实收</span><span className="font-black text-emerald-600">¥{selectedOrder.receivedAmount}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">优惠/抹零</span><span className="font-black text-gray-800">¥{selectedOrder.discount}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">时间</span><span className="font-black text-gray-800">{new Date(selectedOrder.createdAt).toLocaleString()}</span></div>
               <div className="flex justify-between text-sm"><span className="text-gray-500 font-bold">单号</span><span className="font-black text-gray-400 font-mono text-xs">{selectedOrder.orderNo}</span></div>
               {selectedOrder.note && (
                   <div className="pt-2 border-t border-gray-200 mt-2">
                       <p className="text-xs text-gray-400 font-bold mb-1">备注</p>
                       <p className="text-sm font-black text-gray-700">{selectedOrder.note}</p>
                   </div>
               )}
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

  // 7. Inventory List View (Standard List) - Same as before
  if (subView === 'inventory') {
     return (
        <SubViewShell 
            title="库存盘点" 
            onBack={() => setSubView('main')}
            searchProps={{ value: invSearch, onChange: setInvSearch, placeholder: '搜索库存商品...' }}
            batchSelectorProps={{ selectedBatchId: filterBatchId, onSelectBatch: setFilterBatchId, batches: activeBatches }}
        >
            <div className="grid grid-cols-2 gap-3 mb-2">
                <button
                    onClick={() => setSubView('stock_logs')}
                    className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.98] transition-all"
                >
                    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                        <ClipboardEdit size={20} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-black text-gray-800 text-sm">库存流水</p>
                        <p className="text-[10px] text-gray-400 font-bold">出入库记录</p>
                    </div>
                </button>
                <button
                    onClick={() => setSubView('stock_alert')}
                    className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-orange-100 flex items-center gap-3 active:scale-[0.98] transition-all"
                >
                    <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="font-black text-gray-800 text-sm">库存预警</p>
                        <p className="text-[10px] text-gray-400 font-bold">低库存/售罄预测</p>
                    </div>
                </button>
            </div>

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
                        <div className="flex items-center gap-3 mt-1 text-xs">
                             <div className="font-bold text-gray-900">
                                现: {p.stockQty} {p.pricingMode === PricingMode.WEIGHT ? `(${p.stockWeight.toFixed(1)}斤)` : '件'}
                             </div>
                             <div className="font-bold text-gray-300">|</div>
                             <div className="font-bold text-gray-400">
                                原: {p.initialStockQty}
                             </div>
                        </div>
                     </div>
                     <button 
                       onClick={() => { 
                           setAdjustForm({ 
                               id: p.id, 
                               name: p.name,
                               batchName: batch?.plateNumber || '未知车次',
                               currentQty: p.stockQty, 
                               currentWeight: p.stockWeight,
                               initialQty: p.initialStockQty,
                               initialWeight: p.initialStockWeight,
                               actualQty: '',
                               actualWeight: '',
                               actualInitialQty: p.initialStockQty.toString(),
                               actualInitialWeight: p.initialStockWeight.toString(),
                               reason: ''
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

  // 8. Adjust Stock View - Same as before
  if (subView === 'adjust_stock') {
    const qtyDiff = (parseFloat(adjustForm.actualQty) || 0) - adjustForm.currentQty;
    const isLoss = qtyDiff < 0;
    const isGain = qtyDiff > 0;

    return (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-bottom">
            <header className="px-6 py-6 border-b flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-800">库存修正</h2>
                <button onClick={() => setSubView('inventory')} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
            </header>
            <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                        <Truck size={14} className="text-gray-400"/>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">所属车次</p>
                    </div>
                    <h3 className="text-lg font-black text-gray-800">{adjustForm.batchName}</h3>
                    <p className="text-2xl font-black text-emerald-600 mt-2">{adjustForm.name}</p>
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

                {/* 实时损耗计算显示 */}
                {adjustForm.actualQty !== '' && qtyDiff !== 0 && (
                    <div className={`p-4 rounded-2xl flex items-center justify-between border ${isLoss ? 'bg-red-50 border-red-100 text-red-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                        <span className="font-bold text-sm">{isLoss ? '盘亏 / 损耗' : '盘盈 / 多出'}</span>
                        <span className="font-black text-xl">{qtyDiff > 0 ? '+' : ''}{qtyDiff} 件</span>
                    </div>
                )}

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

                {/* 修正初始数据区域 */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-50">
                        <Edit2 size={14} className="text-gray-400"/>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">修正原始入库数据</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 mb-1">初始件数</p>
                            <input 
                                type="number" 
                                value={adjustForm.actualInitialQty} 
                                onChange={e => setAdjustForm({...adjustForm, actualInitialQty: e.target.value})}
                                className="w-full bg-gray-50 p-3 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 ring-emerald-100 border border-gray-100"
                            />
                        </div>
                         <div>
                            <p className="text-[10px] font-bold text-gray-400 mb-1">初始重量</p>
                            <input 
                                type="number" 
                                value={adjustForm.actualInitialWeight} 
                                onChange={e => setAdjustForm({...adjustForm, actualInitialWeight: e.target.value})}
                                className="w-full bg-gray-50 p-3 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 ring-emerald-100 border border-gray-100"
                            />
                        </div>
                    </div>
                </div>

                {/* 原因/备注 */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center gap-2">
                        <ClipboardEdit size={14} className="text-gray-400"/>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">原因 / 备注</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['切瓜损耗', '自然损耗', '质量损坏', '退货', '盘点差异', '其他'].map(reason => (
                            <button
                                key={reason}
                                onClick={() => setAdjustForm({...adjustForm, reason})}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${adjustForm.reason === reason ? 'bg-purple-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 active:bg-gray-200'}`}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                    <input 
                        type="text" 
                        value={adjustForm.reason} 
                        onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})}
                        placeholder="可手动输入原因..."
                        className="w-full bg-gray-50 p-3 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 ring-purple-100 border border-gray-100 text-sm"
                    />
                </div>

                <div className="pt-8 pb-32">
                    <button onClick={handleAdjustStock} className="w-full bg-gray-900 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-gray-200 active:scale-95 transition-all">确认修正</button>
                    <p className="text-center text-xs text-gray-400 mt-4 font-bold">修正后系统将以新数据为准</p>
                </div>
            </div>
        </div>
    );
  }

  // 9. Reconcile View (Code kept same, skipped for brevity as no changes)
  // ...
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
      
      const filteredReconcileRepayments = data.repayments.filter(r => {
          if (!r || !r.date) return false;
          return r.date.startsWith(reconcileDate);
      });
      
      // 现金流 = 开单时实收 + 还款实收（不重复计算）
      const incomeFromOrders = filteredReconcileOrders.reduce((sum, o) => sum + (o.initialReceivedAmount || o.receivedAmount), 0);
      const incomeFromRepayments = filteredReconcileRepayments.reduce((sum, r) => sum + r.amount, 0);
      const income = incomeFromOrders + incomeFromRepayments;
      
      const expense = filteredReconcileExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      // 按渠道拆分：订单开单时实收 + 还款
      const sumByMethod = (method: string) => {
          const fromOrders = filteredReconcileOrders.reduce((s, o) => {
            if (o.paymentMethod === PaymentMethod.MIXED && o.mixedPayments) {
              return s + (o.mixedPayments.find(m => m.method === method)?.amount || 0);
            }
            return s + (o.paymentMethod === method ? (o.initialReceivedAmount || o.receivedAmount) : 0);
          }, 0);
          const fromRepayments = filteredReconcileRepayments.reduce((s, r) => {
            if (r.paymentMethod === PaymentMethod.MIXED && r.mixedPayments) {
              return s + (r.mixedPayments.find(m => m.method === method)?.amount || 0);
            }
            return s + (r.paymentMethod === method ? r.amount : 0);
          }, 0);
          return fromOrders + fromRepayments;
      };

      const byMethod = {
          WECHAT: sumByMethod('WECHAT'),
          ALIPAY: sumByMethod('ALIPAY'),
          CASH: sumByMethod('CASH'),
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
      const debtStats = getCustomerDebtStats(data.customers, data.orders, data.repayments);
      const riskSummary = getDebtRiskSummary(debtStats);
      const totalReceivable = riskSummary.totalAmount;

      const filteredDebtStats = debtStats.filter(s => {
          const matchSearch = s.customerName.includes(custSearch);
          const matchRisk = debtRiskFilter === 'ALL' || getDebtRiskLevel(s.debtAgeDays).level === debtRiskFilter;
          return matchSearch && matchRisk;
      });

      // 按开单人统计欠款：只基于订单 receivedAmount，不含还款记录（避免双重扣减）
      const debtByPayee: Record<string, number> = {};
      data.payees.forEach(p => debtByPayee[p] = 0);
      
      data.orders.filter(o => o.status === OrderStatus.ACTIVE && o.totalAmount - o.receivedAmount - o.discount > 0).forEach(o => {
          const debt = o.totalAmount - o.receivedAmount - o.discount;
          if (o.payee) {
              debtByPayee[o.payee] = (debtByPayee[o.payee] || 0) + debt;
          }
      });

      const riskLevels: { key: DebtRiskLevel | 'ALL'; label: string }[] = [
          { key: 'ALL', label: '全部' },
          { key: 'CRITICAL', label: DEBT_RISK_CONFIG.CRITICAL.label },
          { key: 'HIGH', label: DEBT_RISK_CONFIG.HIGH.label },
          { key: 'MEDIUM', label: DEBT_RISK_CONFIG.MEDIUM.label },
          { key: 'LOW', label: DEBT_RISK_CONFIG.LOW.label },
      ];

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

             {/* 风险等级汇总 */}
             <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 mb-4">
                 <div className="flex justify-between items-center mb-3">
                     <p className="text-xs font-black text-gray-400 uppercase tracking-widest">风险等级汇总</p>
                     <button 
                        onClick={() => setSubView('customer_analysis')}
                        className="flex items-center gap-1 text-blue-500 text-xs font-bold"
                     >
                         <BarChart3 size={14} /> 客户分析
                     </button>
                 </div>
                 <div className="grid grid-cols-4 gap-2">
                     {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as DebtRiskLevel[]).map(level => {
                         const info = DEBT_RISK_CONFIG[level];
                         const stat = riskSummary.byLevel[level];
                         return (
                             <div 
                                key={level} 
                                onClick={() => setDebtRiskFilter(level)}
                                className={`p-3 rounded-xl text-center cursor-pointer transition-all ${debtRiskFilter === level ? 'ring-2 ring-offset-1 ring-blue-400' : ''} ${info.bg}`}
                             >
                                 <p className={`text-xs font-black ${info.color}`}>{info.label}</p>
                                 <p className={`text-lg font-black ${info.color} mt-1`}>{stat.count}</p>
                                 <p className="text-[10px] text-gray-500 font-bold">¥{stat.amount.toLocaleString()}</p>
                             </div>
                         );
                     })}
                 </div>
             </div>

             {/* 风险筛选标签 */}
             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
                 {riskLevels.map(({ key, label }) => (
                     <button
                        key={key}
                        onClick={() => setDebtRiskFilter(key)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black transition-all shrink-0 border ${
                            debtRiskFilter === key 
                                ? 'bg-blue-500 text-white border-blue-500 shadow-md' 
                                : 'bg-white text-gray-500 border-gray-200'
                        }`}
                     >
                         {label}
                     </button>
                 ))}
             </div>

             {/* 经手人欠款汇总 */}
             <div className="mb-6 space-y-2">
                 <p className="px-2 text-xs font-black text-gray-400 uppercase tracking-widest">按经手人汇总</p>
                 <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar px-1">
                     {Object.entries(debtByPayee).filter(([_, amount]) => amount > 0).map(([payee, amount]) => (
                         <div key={payee} className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm shrink-0 min-w-[120px]">
                             <p className="text-xs text-gray-400 font-bold mb-1">{payee}</p>
                             <p className="text-lg font-black text-gray-800">¥{amount.toLocaleString()}</p>
                         </div>
                     ))}
                     {Object.values(debtByPayee).every(a => a <= 0) && (
                         <div className="text-xs text-gray-400 px-2">暂无经手人欠款数据</div>
                     )}
                 </div>
             </div>
             
             <div className="space-y-3">
                 <p className="px-2 text-xs font-black text-gray-400 uppercase tracking-widest">客户明细</p>
                 {filteredDebtStats.length > 0 ? filteredDebtStats.map(stat => {
                     const riskInfo = getDebtRiskLevel(stat.debtAgeDays);
                     const customer = data.customers.find(c => c.id === stat.customerId);
                     
                     const customerDebtByPayee: Record<string, number> = {};
                     data.orders.filter(o => o.customerId === stat.customerId && o.status === OrderStatus.ACTIVE && o.totalAmount > o.receivedAmount + o.discount).forEach(o => {
                         const debt = o.totalAmount - o.receivedAmount - o.discount;
                         if (o.payee) customerDebtByPayee[o.payee] = (customerDebtByPayee[o.payee] || 0) + debt;
                     });
                     data.repayments.filter(r => r.customerId === stat.customerId).forEach(r => {
                         if (r.payee && customerDebtByPayee[r.payee] !== undefined) {
                             customerDebtByPayee[r.payee] -= r.amount;
                         }
                     });

                     return (
                     <div 
                        key={stat.customerId} 
                        onClick={() => { setSelectedCustId(stat.customerId); setSubView('customer_detail'); }}
                        className="bg-white p-5 rounded-[1.5rem] flex flex-col gap-3 shadow-sm border border-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                     >
                         <div className="flex justify-between items-center">
                             <div>
                                 <div className="flex items-center gap-2">
                                     <p className="font-black text-gray-800 text-lg">{stat.customerName}</p>
                                     <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${riskInfo.bg} ${riskInfo.color}`}>
                                         {riskInfo.label}
                                     </span>
                                 </div>
                                 <p className="text-xs text-gray-400 font-bold mt-1">
                                     电话: {customer?.phone || '未记录'} · 账龄 {stat.debtAgeDays} 天
                                 </p>
                             </div>
                             <div className="text-right">
                                 <p className="text-xl font-black text-red-500">¥{stat.totalDebt.toLocaleString()}</p>
                                 <p className="text-[10px] text-gray-400 font-bold">总欠款</p>
                             </div>
                         </div>
                         
                         {Object.entries(customerDebtByPayee).filter(([_, amt]) => amt > 0).length > 0 && (
                             <div className="bg-gray-50 rounded-xl p-3 flex flex-wrap gap-3">
                                 {Object.entries(customerDebtByPayee).filter(([_, amt]) => amt > 0).map(([payee, amt]) => (
                                     <div key={payee} className="flex items-center gap-1.5">
                                         <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                         <span className="text-xs text-gray-500 font-bold">{payee}:</span>
                                         <span className="text-xs font-black text-gray-800">¥{amt.toLocaleString()}</span>
                                     </div>
                                 ))}
                             </div>
                         )}
                     </div>
                 )}) : (
                     <div className="text-center py-10 text-gray-400 font-bold">
                         {debtStats.length === 0 ? '没有欠款客户，经营状况良好！' : '没有符合筛选条件的客户'}
                     </div>
                 )}
             </div>
         </SubViewShell>
      );
  }

  if (showBatchEditModal) {
      return (
          <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95">
                  <h2 className="text-xl font-black text-gray-800 mb-6">批量修改订单 ({selectedHistoryItems.length}个)</h2>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">修改日期 (留空不修改)</label>
                          <input 
                              type="date" 
                              value={batchEditDate}
                              onChange={e => setBatchEditDate(e.target.value)}
                              className="w-full h-12 bg-gray-50 rounded-xl px-4 font-bold text-gray-800 border-none focus:ring-2 ring-emerald-100 outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">修改时间 (留空不修改)</label>
                          <input 
                              type="time" 
                              value={batchEditTime}
                              onChange={e => setBatchEditTime(e.target.value)}
                              className="w-full h-12 bg-gray-50 rounded-xl px-4 font-bold text-gray-800 border-none focus:ring-2 ring-emerald-100 outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">修改开单人 (留空不修改)</label>
                          <select 
                              value={batchEditPayee} 
                              onChange={e => setBatchEditPayee(e.target.value)}
                              className="w-full h-12 bg-gray-50 rounded-xl px-4 font-bold text-gray-800 border-none focus:ring-2 ring-emerald-100 outline-none appearance-none"
                          >
                              <option value="">-- 不修改 --</option>
                              {data.payees.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                      </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                      <button 
                          onClick={() => setShowBatchEditModal(false)}
                          className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-xl font-black text-sm active:scale-95 transition-all"
                      >
                          取消
                      </button>
                      <button 
                          onClick={() => {
                              selectedHistoryItems.forEach(id => {
                                  const order = data.orders.find(o => o.id === id);
                                  const repayment = data.repayments.find(r => r.id === id);
                                  
                                  if (order) {
                                      const updates: any = {};
                                      if (batchEditDate || batchEditTime) {
                                          const currentCreatedAt = new Date(order.createdAt);
                                          let newDate = currentCreatedAt;
                                          if (batchEditDate) {
                                              const [y, m, d] = batchEditDate.split('-');
                                              newDate.setFullYear(parseInt(y), parseInt(m) - 1, parseInt(d));
                                          }
                                          if (batchEditTime) {
                                              const [h, min] = batchEditTime.split(':');
                                              newDate.setHours(parseInt(h), parseInt(min), 0, 0);
                                          }
                                          updates.createdAt = newDate.toISOString();
                                      }
                                      if (batchEditPayee) {
                                          updates.payee = batchEditPayee;
                                      }
                                      if (Object.keys(updates).length > 0) {
                                          updateOrder(id, updates);
                                      }
                                  } else if (repayment) {
                                      const updates: any = {};
                                      if (batchEditDate || batchEditTime) {
                                          const currentCreatedAt = new Date(repayment.date);
                                          let newDate = currentCreatedAt;
                                          if (batchEditDate) {
                                              const [y, m, d] = batchEditDate.split('-');
                                              newDate.setFullYear(parseInt(y), parseInt(m) - 1, parseInt(d));
                                          }
                                          if (batchEditTime) {
                                              const [h, min] = batchEditTime.split(':');
                                              newDate.setHours(parseInt(h), parseInt(min), 0, 0);
                                          }
                                          updates.date = newDate.toISOString();
                                      }
                                      if (batchEditPayee) {
                                          updates.payee = batchEditPayee;
                                      }
                                      if (Object.keys(updates).length > 0) {
                                          updateRepayment(id, updates);
                                      }
                                  }
                              });
                              setShowBatchEditModal(false);
                              setIsBatchEditMode(false);
                              setSelectedHistoryItems([]);
                              setBatchEditDate('');
                              setBatchEditTime('');
                              setBatchEditPayee('');
                          }}
                          className="flex-1 py-3.5 bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                      >
                          确认修改
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  if (subView === 'customer_detail' && selectedCustomer) {
      const stats = customerStats;
      const orders = customerOrders;
      const repayments = customerRepayments;

      return (
          <div className="fixed inset-0 z-[100] bg-[#F4F6F9] flex flex-col animate-in slide-in-from-right">
              <header className="bg-white px-4 py-4 border-b flex items-center shrink-0 shadow-sm z-10">
                  <button onClick={() => setSubView('customers')} className="p-2 -ml-2 active:scale-90">
                      <ArrowLeft />
                  </button>
                  <h1 className="text-lg font-black flex-1 text-center pr-8">{selectedCustomer.name}</h1>
                  <button 
                      onClick={handleOpenCustomerEdit}
                      className="absolute right-4 p-2 text-emerald-600 bg-emerald-50 rounded-xl active:scale-95"
                  >
                      <Edit2 size={18} />
                  </button>
              </header>

              <div className="flex-1 p-4 pb-32 overflow-y-auto no-scrollbar space-y-4">
                  <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-3">
                      <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                              <UserCheck size={24} />
                          </div>
                          <div className="flex-1">
                              <h2 className="font-black text-gray-800 text-lg">{selectedCustomer.name}</h2>
                              <p className="text-xs text-gray-400 font-bold">
                                  {selectedCustomer.phone ? `电话: ${selectedCustomer.phone}` : '暂无电话'}
                              </p>
                          </div>
                      </div>
                      {selectedCustomer.wechat && (
                          <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-400 font-bold">微信:</span>
                              <span className="font-bold text-gray-700">{selectedCustomer.wechat}</span>
                          </div>
                      )}
                      {selectedCustomer.address && (
                          <div className="flex items-start gap-2 text-sm">
                              <span className="text-gray-400 font-bold shrink-0">地址:</span>
                              <span className="font-bold text-gray-700">{selectedCustomer.address}</span>
                          </div>
                      )}
                      {selectedCustomer.note && (
                          <div className="flex items-start gap-2 text-sm pt-2 border-t border-gray-50">
                              <span className="text-gray-400 font-bold shrink-0">备注:</span>
                              <span className="font-bold text-gray-600">{selectedCustomer.note}</span>
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-black uppercase">累计采购</p>
                          <p className="text-xl font-black text-gray-800 mt-1">¥{stats.totalAmount.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">{stats.orderCount} 笔订单</p>
                      </div>
                      <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-black uppercase">采购次数</p>
                          <p className="text-xl font-black text-blue-600 mt-1">{stats.orderCount}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">笔</p>
                      </div>
                      <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-red-100">
                          <p className="text-[10px] text-red-400 font-black uppercase">当前欠款</p>
                          <p className="text-xl font-black text-red-500 mt-1">¥{selectedCustomer.totalDebt.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">待回收</p>
                      </div>
                      <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-black uppercase">最近采购</p>
                          <p className="text-sm font-black text-gray-800 mt-1">
                              {stats.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleDateString() : '暂无记录'}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                              {stats.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                          </p>
                      </div>
                  </div>

                  <div className="space-y-3">
                      <div className="flex justify-between items-center px-2">
                          <h3 className="font-black text-gray-800 text-sm">历史订单</h3>
                          <span className="text-xs text-gray-400 font-bold">{orders.length} 笔</span>
                      </div>
                      {orders.length > 0 ? orders.map(order => {
                          const debtAmount = order.totalAmount - order.discount - order.receivedAmount;
                          const isPaid = debtAmount <= 0.01;
                          return (
                              <div
                                  key={order.id}
                                  onClick={() => { setSelectedOrderId(order.id); setSubView('order_detail'); }}
                                  className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-50 active:scale-[0.98] transition-all"
                              >
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <p className="font-black text-gray-800">{order.orderNo}</p>
                                          <p className="text-[10px] text-gray-400 font-mono">
                                              {new Date(order.createdAt).toLocaleString()}
                                          </p>
                                      </div>
                                      <div className="text-right">
                                          <p className="font-black text-gray-800">¥{(order.totalAmount - order.discount).toLocaleString()}</p>
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                              {isPaid ? '已结清' : `欠 ¥${debtAmount.toLocaleString()}`}
                                          </span>
                                      </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                      {order.items.slice(0, 3).map((item, idx) => (
                                          <span key={idx} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded font-bold">
                                              {item.productName}
                                          </span>
                                      ))}
                                      {order.items.length > 3 && (
                                          <span className="text-[10px] text-gray-400 font-bold">+{order.items.length - 3}</span>
                                      )}
                                  </div>
                              </div>
                          );
                      }) : (
                          <div className="bg-white p-8 rounded-[1.5rem] text-center">
                              <Receipt size={32} className="mx-auto text-gray-200 mb-2" />
                              <p className="text-gray-400 font-bold text-sm">暂无订单记录</p>
                          </div>
                      )}
                  </div>

                  {repayments.length > 0 && (
                      <div className="space-y-3">
                          <div className="flex justify-between items-center px-2">
                              <h3 className="font-black text-gray-800 text-sm">还款记录</h3>
                              <span className="text-xs text-gray-400 font-bold">{repayments.length} 笔</span>
                          </div>
                          {repayments.map(repayment => (
                              <div key={repayment.id} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-emerald-50 flex justify-between items-center">
                                  <div>
                                      <p className="font-black text-emerald-600">+¥{repayment.amount.toLocaleString()}</p>
                                      <p className="text-[10px] text-gray-400 font-mono">
                                          {new Date(repayment.date).toLocaleString()}
                                      </p>
                                      {repayment.payee && (
                                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                                              收款人: {repayment.payee}
                                          </p>
                                      )}
                                  </div>
                                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                                      <Wallet size={18} />
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-20 flex gap-3">
                  <button
                      onClick={() => {
                          if (typeof window !== 'undefined' && (window as any).navigateToBilling) {
                              (window as any).navigateToBilling(selectedCustomer.id);
                          } else {
                              alert('请到开单页面新增订单');
                          }
                      }}
                      className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-base shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                      <Plus size={18} /> 新增订单
                  </button>
                  <button
                      onClick={() => {
                          alert('快速还款功能需在收款页面操作');
                      }}
                      className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-black text-base shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                      <Wallet size={18} /> 快速还款
                  </button>
              </div>

              {showCustomerEditModal && (
                  <div className="fixed inset-0 z-[500] bg-white flex flex-col animate-in slide-in-from-bottom">
                      <header className="px-4 py-4 border-b flex items-center shrink-0">
                          <button onClick={() => setShowCustomerEditModal(false)} className="p-2 active:scale-90">
                              <X size={28}/>
                          </button>
                          <h1 className="text-xl font-black flex-1 text-center pr-10">编辑客户信息</h1>
                      </header>
                      <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                          <div>
                              <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">客户姓名</label>
                              <input
                                  value={customerEditForm.name}
                                  onChange={e => setCustomerEditForm({...customerEditForm, name: e.target.value})}
                                  placeholder="请输入客户姓名"
                                  className="w-full mt-1 bg-gray-100 p-4 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">联系电话</label>
                              <input
                                  value={customerEditForm.phone}
                                  onChange={e => setCustomerEditForm({...customerEditForm, phone: e.target.value})}
                                  placeholder="请输入电话号码"
                                  className="w-full mt-1 bg-gray-100 p-4 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">微信号</label>
                              <input
                                  value={customerEditForm.wechat}
                                  onChange={e => setCustomerEditForm({...customerEditForm, wechat: e.target.value})}
                                  placeholder="请输入微信号"
                                  className="w-full mt-1 bg-gray-100 p-4 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">地址</label>
                              <input
                                  value={customerEditForm.address}
                                  onChange={e => setCustomerEditForm({...customerEditForm, address: e.target.value})}
                                  placeholder="请输入地址"
                                  className="w-full mt-1 bg-gray-100 p-4 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-blue-500 uppercase tracking-wider px-1">备注</label>
                              <textarea
                                  value={customerEditForm.note}
                                  onChange={e => setCustomerEditForm({...customerEditForm, note: e.target.value})}
                                  placeholder="备注信息"
                                  rows={3}
                                  className="w-full mt-1 bg-gray-100 p-4 rounded-2xl font-bold text-lg text-gray-800 border-2 border-transparent focus:border-blue-400 focus:bg-white outline-none transition-all resize-none"
                              />
                          </div>
                      </div>
                      <div className="p-4 shrink-0 flex gap-3">
                          <button
                              onClick={() => {
                                  if (selectedCustomer.totalDebt > 0) {
                                      alert("该客户还有未结清欠款，无法删除。请先结清所有欠款后再删除。");
                                      return;
                                  }
                                  if (confirm(`确认删除客户「${selectedCustomer.name}」吗？`)) {
                                      deleteCustomer(selectedCustomer.id);
                                      setShowCustomerEditModal(false);
                                      setSubView('customers');
                                  }
                              }}
                              className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl font-black flex items-center justify-center active:scale-95 transition-all"
                          >
                              <Trash2 size={20} />
                          </button>
                          <button
                              onClick={handleSaveCustomerEdit}
                              className="flex-1 bg-[#10b981] text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-300 active:scale-95 transition-all"
                          >
                              保存修改
                          </button>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  if (subView === 'stock_logs') {
      const stockLogTypeMap: Record<string, { label: string; color: string; bg: string }> = {
          INBOUND: { label: '入库', color: 'text-emerald-600', bg: 'bg-emerald-100' },
          OUTBOUND: { label: '出库', color: 'text-orange-600', bg: 'bg-orange-100' },
          RETURN: { label: '回退', color: 'text-blue-600', bg: 'bg-blue-100' },
          ADJUST: { label: '调整', color: 'text-purple-600', bg: 'bg-purple-100' },
          CANCEL_RETURN: { label: '作废回退', color: 'text-gray-600', bg: 'bg-gray-100' },
      };

      return (
          <SubViewShell
              title="库存流水"
              onBack={() => setSubView('inventory')}
              searchProps={{ value: stockLogSearch, onChange: setStockLogSearch, placeholder: '搜索商品名称...' }}
          >
              {filteredStockLogs.length > 0 ? filteredStockLogs.map(log => {
                  const typeInfo = stockLogTypeMap[log.type] || { label: log.type, color: 'text-gray-600', bg: 'bg-gray-100' };
                  const isPositive = log.qtyChange > 0;
                  return (
                      <div key={log.id} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-50">
                          <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                  <h3 className="font-black text-gray-800">{log.productName}</h3>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${typeInfo.bg} ${typeInfo.color}`}>
                                      {typeInfo.label}
                                  </span>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono text-right">
                                  {new Date(log.createdAt).toLocaleString()}
                              </p>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="bg-gray-50 p-3 rounded-xl">
                                  <p className="text-[10px] text-gray-400 font-bold">数量变化</p>
                                  <p className={`font-black text-sm mt-1 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {isPositive ? '+' : ''}{log.qtyChange.toLocaleString()}
                                  </p>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl">
                                  <p className="text-[10px] text-gray-400 font-bold">重量变化</p>
                                  <p className={`font-black text-sm mt-1 ${log.weightChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {log.weightChange > 0 ? '+' : ''}{log.weightChange.toFixed(1)}斤
                                  </p>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl">
                                  <p className="text-[10px] text-gray-400 font-bold">结存数量</p>
                                  <p className="font-black text-sm mt-1 text-gray-800">{log.qtyAfter.toLocaleString()}</p>
                              </div>
                          </div>
                          {log.reason && (
                              <div className="mt-3 pt-3 border-t border-gray-50">
                                  <p className="text-xs text-gray-500 font-bold">
                                      <span className="text-gray-400">原因:</span> {log.reason}
                                  </p>
                              </div>
                          )}
                          {log.operator && (
                              <p className="text-[10px] text-gray-400 font-bold mt-1">
                                  操作人: {log.operator}
                              </p>
                          )}
                      </div>
                  );
              }) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                      <ClipboardEdit size={48} strokeWidth={1} className="opacity-20"/>
                      <p className="font-bold text-sm">暂无库存流水记录</p>
                      <p className="text-xs text-gray-300">开单或调整库存后会在这里显示</p>
                  </div>
              )}
          </SubViewShell>
      );
  }

  if (subView === 'op_logs') {
      const opLogTypeMap: Record<string, { label: string; color: string; bg: string; icon: string }> = {
          ORDER_DELETE: { label: '订单删除', color: 'text-red-600', bg: 'bg-red-100', icon: '🗑️' },
          ORDER_CANCEL: { label: '订单作废', color: 'text-orange-600', bg: 'bg-orange-100', icon: '🚫' },
          ORDER_EDIT: { label: '订单修改', color: 'text-blue-600', bg: 'bg-blue-100', icon: '✏️' },
          STOCK_ADJUST: { label: '库存调整', color: 'text-purple-600', bg: 'bg-purple-100', icon: '📦' },
          PRICE_CHANGE: { label: '价格变动', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: '💰' },
          DEBT_CHANGE: { label: '欠款变动', color: 'text-red-500', bg: 'bg-red-50', icon: '💳' },
          REPAYMENT_DELETE: { label: '还款删除', color: 'text-red-600', bg: 'bg-red-100', icon: '🗑️' },
          REPAYMENT_EDIT: { label: '还款修改', color: 'text-blue-600', bg: 'bg-blue-100', icon: '✏️' },
          CUSTOMER_EDIT: { label: '客户修改', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: '👤' },
          PRODUCT_EDIT: { label: '商品修改', color: 'text-orange-600', bg: 'bg-orange-100', icon: '🍎' },
      };

      const opLogTypes = Object.entries(opLogTypeMap);

      return (
          <div className="fixed inset-0 z-[100] bg-[#F4F6F9] flex flex-col animate-in slide-in-from-right">
              <header className="bg-white px-4 py-4 border-b flex items-center shrink-0 shadow-sm z-10">
                  <button onClick={() => setSubView('main')} className="p-2 -ml-2 active:scale-90">
                      <ArrowLeft />
                  </button>
                  <h1 className="text-lg font-black flex-1 text-center pr-8">操作日志</h1>
              </header>

              <div className="bg-white border-b shadow-sm z-10 px-4 py-3">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      <button
                          onClick={() => setOpLogTypeFilter('ALL')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${opLogTypeFilter === 'ALL' ? 'bg-gray-800 border-gray-800 text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}
                      >
                          <Layers size={12} /> 全部
                      </button>
                      {opLogTypes.map(([type, info]) => (
                          <button
                              key={type}
                              onClick={() => setOpLogTypeFilter(type)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shrink-0 border ${opLogTypeFilter === type ? `${info.bg} ${info.color} border-current shadow-md` : 'bg-white border-gray-200 text-gray-500'}`}
                          >
                              {info.icon} {info.label}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex-1 p-4 pb-32 overflow-y-auto no-scrollbar space-y-3">
                  {filteredOpLogs.length > 0 ? filteredOpLogs.map(log => {
                      const typeInfo = opLogTypeMap[log.type] || { label: log.type, color: 'text-gray-600', bg: 'bg-gray-100', icon: '📝' };
                      const isExpanded = expandedOpLogId === log.id;
                      const hasSnapshot = log.beforeSnapshot || log.afterSnapshot;

                      return (
                          <div key={log.id} className="bg-white rounded-[1.5rem] shadow-sm border border-gray-50 overflow-hidden">
                              <div
                                  onClick={() => hasSnapshot && setExpandedOpLogId(isExpanded ? null : log.id)}
                                  className={`p-4 ${hasSnapshot ? 'cursor-pointer active:bg-gray-50' : ''}`}
                              >
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2">
                                          <span className="text-lg">{typeInfo.icon}</span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${typeInfo.bg} ${typeInfo.color}`}>
                                              {typeInfo.label}
                                          </span>
                                      </div>
                                      <p className="text-[10px] text-gray-400 font-mono text-right">
                                          {new Date(log.createdAt).toLocaleString()}
                                      </p>
                                  </div>
                                  <p className="text-sm font-bold text-gray-800 leading-relaxed">{log.description}</p>
                                  {log.operator && (
                                      <p className="text-[10px] text-gray-400 font-bold mt-1">
                                          操作人: {log.operator}
                                      </p>
                                  )}
                                  {hasSnapshot && (
                                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 font-bold">
                                          {isExpanded ? '收起详情' : '点击查看详情'}
                                          <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                      </div>
                                  )}
                              </div>

                              {isExpanded && hasSnapshot && (
                                  <div className="bg-gray-50 p-4 border-t border-gray-100 space-y-3 animate-in fade-in">
                                      {log.beforeSnapshot && (
                                          <div>
                                              <p className="text-[10px] font-black text-gray-400 uppercase mb-2">修改前</p>
                                              <div className="bg-white p-3 rounded-xl border border-gray-100">
                                                  <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-all">
                                                      {JSON.stringify(log.beforeSnapshot, null, 2)}
                                                  </pre>
                                              </div>
                                          </div>
                                      )}
                                      {log.afterSnapshot && (
                                          <div>
                                              <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">修改后</p>
                                              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                                  <pre className="text-xs text-emerald-700 font-mono whitespace-pre-wrap break-all">
                                                      {JSON.stringify(log.afterSnapshot, null, 2)}
                                                  </pre>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>
                      );
                  }) : (
                      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                          <ClipboardCheck size={48} strokeWidth={1} className="opacity-20"/>
                          <p className="font-bold text-sm">暂无操作日志</p>
                          <p className="text-xs text-gray-300">系统操作记录会在这里显示</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // 11. Customer Analysis View
  if (subView === 'customer_analysis') {
      const purchaseRanking = getPurchaseRanking(data.customers, data.orders);
      const debtRanking = getCustomerDebtStats(data.customers, data.orders, data.repayments);
      const dormantCustomers = getDormantCustomers(data.customers, data.orders, 30);

      return (
         <SubViewShell 
            title="客户分析" 
            onBack={() => setSubView('customers')}
         >
             {/* 采购排行榜 */}
             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                         <TrendingUp size={20} />
                     </div>
                     <div>
                         <h3 className="font-black text-gray-800">采购排行榜</h3>
                         <p className="text-[10px] text-gray-400 font-bold">按累计采购金额降序</p>
                     </div>
                 </div>
                 {purchaseRanking.length > 0 ? (
                     <div className="space-y-2">
                         {purchaseRanking.slice(0, 10).map((customer, idx) => (
                             <div key={customer.customerId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                 <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                     idx === 0 ? 'bg-yellow-400 text-white' :
                                     idx === 1 ? 'bg-gray-300 text-white' :
                                     idx === 2 ? 'bg-orange-400 text-white' :
                                     'bg-gray-200 text-gray-500'
                                 }`}>
                                     {idx + 1}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <p className="font-black text-gray-800 text-sm truncate">{customer.customerName}</p>
                                     <p className="text-[10px] text-gray-400 font-bold">
                                         {customer.orderCount} 笔 · {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : '无记录'}
                                     </p>
                                 </div>
                                 <div className="text-right shrink-0">
                                     <p className="font-black text-emerald-600 text-sm">¥{customer.totalAmount.toLocaleString()}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-6 text-gray-400 text-sm font-bold">暂无采购数据</div>
                 )}
             </div>

             {/* 欠款排行榜 */}
             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                         <Wallet size={20} />
                     </div>
                     <div>
                         <h3 className="font-black text-gray-800">欠款排行榜</h3>
                         <p className="text-[10px] text-gray-400 font-bold">按当前欠款金额降序</p>
                     </div>
                 </div>
                 {debtRanking.length > 0 ? (
                     <div className="space-y-2">
                         {debtRanking.slice(0, 10).map((customer, idx) => {
                             const riskInfo = getDebtRiskLevel(customer.debtAgeDays);
                             return (
                                 <div key={customer.customerId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                     <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                         idx === 0 ? 'bg-red-500 text-white' :
                                         idx === 1 ? 'bg-orange-500 text-white' :
                                         idx === 2 ? 'bg-yellow-500 text-white' :
                                         'bg-gray-200 text-gray-500'
                                     }`}>
                                         {idx + 1}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <div className="flex items-center gap-2">
                                             <p className="font-black text-gray-800 text-sm truncate">{customer.customerName}</p>
                                             <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${riskInfo.bg} ${riskInfo.color}`}>
                                                 {riskInfo.label}
                                             </span>
                                         </div>
                                         <p className="text-[10px] text-gray-400 font-bold">
                                             账龄 {customer.debtAgeDays} 天
                                         </p>
                                     </div>
                                     <div className="text-right shrink-0">
                                         <p className="font-black text-red-500 text-sm">¥{customer.totalDebt.toLocaleString()}</p>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 ) : (
                     <div className="text-center py-6 text-gray-400 text-sm font-bold">暂无欠款客户</div>
                 )}
             </div>

             {/* 沉睡客户 */}
             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
                         <Users size={20} />
                     </div>
                     <div>
                         <h3 className="font-black text-gray-800">沉睡客户</h3>
                         <p className="text-[10px] text-gray-400 font-bold">超过30天未采购</p>
                     </div>
                 </div>
                 {dormantCustomers.length > 0 ? (
                     <div className="space-y-2">
                         {dormantCustomers.slice(0, 10).map(customer => (
                             <div key={customer.customerId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                 <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-500 shrink-0">
                                     <UserCheck size={18} />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <p className="font-black text-gray-800 text-sm truncate">{customer.customerName}</p>
                                     <p className="text-[10px] text-gray-400 font-bold">
                                         最近: {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : '从未采购'}
                                     </p>
                                 </div>
                                 <div className="text-right shrink-0">
                                     <p className="font-black text-purple-500 text-sm">{customer.dormantDays} 天</p>
                                     <p className="text-[10px] text-gray-400 font-bold">未采购</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-6 text-gray-400 text-sm font-bold">暂无沉睡客户</div>
                 )}
             </div>
         </SubViewShell>
      );
  }

  // 12. Stock Alert View
  if (subView === 'stock_alert') {
      const lowStockProducts = getLowStockProducts(data.products);
      const sellOutForecast = getSellOutForecast(data.products, data.orders, 7);
      const unsellableProducts = getUnsellableProducts(data.products, data.orders, 30);

      const getSellOutLevelStyle = (level: SellOutForecast['level']) => {
          switch (level) {
              case 'URGENT':
                  return { bg: 'bg-red-100', text: 'text-red-600', label: '紧急' };
              case 'WARNING':
                  return { bg: 'bg-orange-100', text: 'text-orange-600', label: '预警' };
              case 'SAFE':
                  return { bg: 'bg-emerald-100', text: 'text-emerald-600', label: '安全' };
              default:
                  return { bg: 'bg-gray-100', text: 'text-gray-500', label: '暂无数据' };
          }
      };

      return (
         <SubViewShell 
            title="库存预警" 
            onBack={() => setSubView('inventory')}
         >
             {/* 低库存预警 */}
             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                         <AlertTriangle size={20} />
                     </div>
                     <div>
                         <h3 className="font-black text-gray-800">低库存预警</h3>
                         <p className="text-[10px] text-gray-400 font-bold">当前库存低于预警阈值</p>
                     </div>
                 </div>
                 {lowStockProducts.length > 0 ? (
                     <div className="space-y-2">
                         {lowStockProducts.map(product => (
                             <div key={product.productId} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                                 <div className="flex-1 min-w-0">
                                     <p className="font-black text-gray-800 text-sm truncate">{product.productName}</p>
                                     <p className="text-[10px] text-gray-500 font-bold">
                                         当前: {product.currentStock.toFixed(product.pricingMode === PricingMode.WEIGHT ? 1 : 0)} {product.unit} 
                                         <span className="text-red-400 mx-1">/</span>
                                         阈值: {product.threshold} {product.unit}
                                     </p>
                                 </div>
                                 <div className="text-right shrink-0">
                                     <p className="font-black text-red-500 text-sm">-{product.gap.toFixed(product.pricingMode === PricingMode.WEIGHT ? 1 : 0)}</p>
                                     <p className="text-[10px] text-gray-400 font-bold">缺口</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-6 text-gray-400 text-sm font-bold">
                         <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                         库存状况良好，无低库存商品
                     </div>
                 )}
             </div>

             {/* 预估售罄天数 */}
             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                         <BarChart3 size={20} />
                     </div>
                     <div>
                         <h3 className="font-black text-gray-800">预估售罄天数</h3>
                         <p className="text-[10px] text-gray-400 font-bold">基于近7天日均销量</p>
                     </div>
                 </div>
                 {sellOutForecast.length > 0 ? (
                     <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                         {sellOutForecast.filter(f => f.level !== 'NO_DATA').slice(0, 15).map(forecast => {
                             const style = getSellOutLevelStyle(forecast.level);
                             return (
                                 <div key={forecast.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                     <div className={`w-2 h-2 rounded-full shrink-0 ${
                                         forecast.level === 'URGENT' ? 'bg-red-500' :
                                         forecast.level === 'WARNING' ? 'bg-orange-500' :
                                         'bg-emerald-500'
                                     }`} />
                                     <div className="flex-1 min-w-0">
                                         <p className="font-black text-gray-800 text-sm truncate">{forecast.productName}</p>
                                         <p className="text-[10px] text-gray-400 font-bold">
                                             日均: {forecast.dailyAvg.toFixed(forecast.pricingMode === PricingMode.WEIGHT ? 1 : 2)} {forecast.unit}
                                         </p>
                                     </div>
                                     <div className="text-right shrink-0">
                                         <p className={`font-black text-sm ${style.text}`}>
                                             {forecast.sellOutDays !== null ? `${forecast.sellOutDays} 天` : '暂无数据'}
                                         </p>
                                         <p className="text-[10px] text-gray-400 font-bold">{style.label}</p>
                                     </div>
                                 </div>
                             );
                         })}
                         {sellOutForecast.filter(f => f.level !== 'NO_DATA').length === 0 && (
                             <div className="text-center py-4 text-gray-400 text-sm font-bold">
                                 暂无销量数据
                             </div>
                         )}
                     </div>
                 ) : (
                     <div className="text-center py-6 text-gray-400 text-sm font-bold">暂无商品数据</div>
                 )}
             </div>

             {/* 滞销商品 */}
             <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center">
                         <Package size={20} />
                     </div>
                     <div>
                         <h3 className="font-black text-gray-800">滞销商品</h3>
                         <p className="text-[10px] text-gray-400 font-bold">近30天销量为0</p>
                     </div>
                 </div>
                 {unsellableProducts.length > 0 ? (
                     <div className="space-y-2">
                         {unsellableProducts.slice(0, 10).map(product => (
                             <div key={product.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                 <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 shrink-0">
                                     <Package size={18} />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <p className="font-black text-gray-800 text-sm truncate">{product.productName}</p>
                                     <p className="text-[10px] text-gray-400 font-bold">
                                         库存: {product.currentStock.toFixed(product.pricingMode === PricingMode.WEIGHT ? 1 : 0)} {product.unit}
                                     </p>
                                 </div>
                                 <div className="text-right shrink-0">
                                     <p className="font-black text-gray-500 text-sm">{product.unsoldDays > 999 ? '999+' : product.unsoldDays} 天</p>
                                     <p className="text-[10px] text-gray-400 font-bold">未动销</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-center py-6 text-gray-400 text-sm font-bold">
                         <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                         暂无滞销商品
                     </div>
                 )}
             </div>
         </SubViewShell>
      );
  }

  return null;
};

export default ManageView;
