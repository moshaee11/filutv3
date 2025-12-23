import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Product, PricingMode, OrderItem, PaymentMethod, Order, Customer, OrderStatus } from '../types';
import { Search, ShoppingBag, X, ArrowLeft, ChevronDown, Check, Delete, PlusCircle, UserPlus, Trash2, User, Truck, Layers } from 'lucide-react';
import Keypad from './Keypad';
import { preciseCalc, generateOrderNo } from '../utils';

interface BillingViewProps {
  onBackToHome?: () => void;
}

const BillingView: React.FC<BillingViewProps> = ({ onBackToHome }) => {
  const { data, addOrder, addCustomer } = useApp();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeField, setActiveField] = useState<'qty' | 'gross' | 'tare' | 'price' | 'received' | 'discount' | 'extraFee'>('qty');
  
  // Batch Filter State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');

  const [formValues, setFormValues] = useState({
    qty: '',
    gross: '',
    tare: '0',
    price: ''
  });

  const [checkoutStep, setCheckoutStep] = useState<'select' | 'cart' | 'settle' | 'success'>('select');
  const [selectedCustomerId, setSelectedCustomerId] = useState('guest');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const [paymentInfo, setPaymentInfo] = useState({
    received: '',
    method: PaymentMethod.WECHAT,
    discount: '0',
    extraFee: '0',
    payee: data.payees[0] || ''
  });

  const resetBilling = () => {
    setCart([]);
    setSelectedProduct(null);
    setSearch('');
    setFormValues({ qty: '', gross: '', tare: '0', price: '' });
    setPaymentInfo({
      received: '',
      method: PaymentMethod.WECHAT,
      discount: '0',
      extraFee: '0',
      payee: data.payees[0] || ''
    });
    setCheckoutStep('select');
    setActiveField('qty');
    setSelectedCustomerId('guest');
    setCustomerSearchQuery('');
    setIsAddingNewCustomer(false);
  };

  const activeBatches = useMemo(() => {
    return data.batches.filter(b => !b.isClosed);
  }, [data.batches]);

  const filteredProducts = useMemo(() => {
    let products = data.products;

    // 1. Filter by Batch
    if (selectedBatchId !== 'ALL') {
      products = products.filter(p => p.batchId === selectedBatchId);
    }

    // 2. Filter by Search
    if (search) {
      products = products.filter(p => p.name.includes(search) || p.category.includes(search));
    }

    return products;
  }, [data.products, search, selectedBatchId]);

  const filteredCustomers = useMemo(() => {
    return data.customers.filter(c => 
      c.name.includes(customerSearchQuery) || (c.phone && c.phone.includes(customerSearchQuery))
    );
  }, [data.customers, customerSearchQuery]);

  const totalSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const finalReceivable = preciseCalc(() => 
    totalSubtotal + (parseFloat(paymentInfo.extraFee) || 0) - (parseFloat(paymentInfo.discount) || 0)
  );

  const getBatchPlate = (batchId?: string) => {
    if (!batchId) return '散货';
    return data.batches.find(b => b.id === batchId)?.plateNumber || '未知车次';
  };

  const handleProductClick = (p: Product) => {
    setSelectedProduct(p);
    setFormValues({
      qty: '',
      gross: '',
      tare: (p.defaultTare || 0).toString(),
      price: (p.sellingPrice || '').toString()
    });
    setActiveField('qty');
  };

  const handleKeypadInput = (val: string) => {
    if (checkoutStep === 'settle') {
      setPaymentInfo(prev => ({ 
        ...prev, 
        [activeField]: (prev[activeField as keyof typeof paymentInfo] === '0' && val !== '.') ? val : prev[activeField as keyof typeof paymentInfo] + val 
      }));
    } else {
      setFormValues(prev => ({ ...prev, [activeField]: prev[activeField as keyof typeof formValues] + val }));
    }
  };

  const handleKeypadDelete = () => {
    if (checkoutStep === 'settle') {
      const current = String(paymentInfo[activeField as keyof typeof paymentInfo]);
      setPaymentInfo(prev => ({ ...prev, [activeField]: current.length <= 1 ? '0' : current.slice(0, -1) }));
    } else {
      setFormValues(prev => ({ ...prev, [activeField]: prev[activeField as keyof typeof formValues].slice(0, -1) }));
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const qty = parseFloat(formValues.qty) || 0;
    const price = parseFloat(formValues.price) || 0;
    
    if (qty <= 0) { alert('请输入有效的件数'); return; }

    let net = 0;
    let subtotal = 0;
    if (selectedProduct.pricingMode === PricingMode.WEIGHT) {
      const gross = parseFloat(formValues.gross) || 0;
      const tare = parseFloat(formValues.tare) || 0;
      net = preciseCalc(() => gross - (qty * tare));
      subtotal = preciseCalc(() => net * price);
    } else {
      subtotal = preciseCalc(() => qty * price);
    }

    const item: OrderItem = {
      productId: selectedProduct.id,
      productName: `${selectedProduct.name} (${getBatchPlate(selectedProduct.batchId)})`,
      qty,
      grossWeight: parseFloat(formValues.gross) || 0,
      tareWeight: parseFloat(formValues.tare) || 0,
      netWeight: net,
      unitPrice: price,
      subtotal
    };

    setCart(prev => [...prev, item]);
    setSelectedProduct(null);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewCustomer = () => {
    if (!newCustomerName.trim()) return;
    const newId = Date.now().toString();
    const customer: Customer = {
      id: newId,
      name: newCustomerName.trim(),
      phone: '',
      totalDebt: 0,
      isGuest: false
    };
    addCustomer(customer);
    setSelectedCustomerId(newId);
    setNewCustomerName('');
    setIsAddingNewCustomer(false);
    setShowCustomerModal(false);
  };

  const handleFinishOrder = () => {
    if (cart.length === 0) return;
    
    const receivedStr = paymentInfo.received;
    const actualReceived = (receivedStr === '') ? finalReceivable : parseFloat(receivedStr);

    if (actualReceived < finalReceivable && selectedCustomerId === 'guest') {
      alert('❌ 散客不能欠款！请选择具体客户或补齐实收金额。');
      return;
    }

    const order: Order = {
      id: Date.now().toString(),
      orderNo: generateOrderNo(),
      customerId: selectedCustomerId,
      customerName: data.customers.find(c => c.id === selectedCustomerId)?.name || '未知',
      items: cart,
      totalAmount: finalReceivable,
      receivedAmount: actualReceived,
      discount: parseFloat(paymentInfo.discount) || 0,
      extraFee: parseFloat(paymentInfo.extraFee) || 0,
      paymentMethod: paymentInfo.method,
      payee: paymentInfo.payee,
      createdAt: new Date().toISOString(),
      status: OrderStatus.ACTIVE
    };

    addOrder(order);
    setCheckoutStep('success');
  };

  if (checkoutStep === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 scale-125 transition-transform mb-4">
          <Check size={56} strokeWidth={3} />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">开单成功</h1>
          <p className="text-gray-400 font-mono">订单已保存，库存已自动扣减</p>
        </div>
        <div className="w-full max-w-xs space-y-3 pt-8">
           <button onClick={() => onBackToHome?.()} className="w-full h-16 bg-emerald-500 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-100 active:scale-95 transition-all">回到首页</button>
           <button onClick={resetBilling} className="w-full py-4 text-gray-400 font-bold text-sm active:text-gray-600">继续下一单</button>
        </div>
      </div>
    );
  }

  if (checkoutStep === 'settle') {
    const activeCustomer = data.customers.find(c => c.id === selectedCustomerId);
    return (
      <div className="fixed inset-0 bg-[#F4F6F9] z-[100] flex flex-col overflow-hidden animate-in slide-in-from-right">
        <header className="h-16 bg-[#2D3142] flex items-center px-4 shrink-0 text-white">
          <button onClick={() => setCheckoutStep('select')} className="p-2 -ml-2"><ArrowLeft /></button>
          <h1 className="text-lg font-black flex-1 text-center pr-8">结算确认</h1>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-20">
          <div 
            onClick={() => setShowCustomerModal(true)}
            className="bg-white rounded-[2rem] p-5 shadow-sm border border-emerald-100 flex items-center justify-between active:scale-[0.98] transition-all"
          >
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-xl shadow-lg">
                  {activeCustomer?.name[0]}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">当前购货客户</p>
                  <p className="text-lg font-black text-gray-800">{activeCustomer?.name}</p>
                </div>
             </div>
             <div className="bg-gray-50 p-2 rounded-xl text-emerald-500">
               <UserPlus size={20} />
             </div>
          </div>

          <div className="bg-white rounded-[2rem] p-5 shadow-sm space-y-3">
             <div className="flex justify-between items-center mb-1">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">货品详情</h3>
                <span className="text-xs font-bold text-gray-400">共 {cart.length} 项</span>
             </div>
             <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1">
                     <div className="space-y-0.5">
                        <p className="font-black text-gray-800 text-sm">{item.productName}</p>
                        <p className="text-[10px] text-gray-400 font-bold">{item.qty}件 | {item.netWeight > 0 ? `${item.netWeight}斤` : ''} | ¥{item.unitPrice}</p>
                     </div>
                     <p className="font-black text-gray-900 text-sm">¥{item.subtotal}</p>
                  </div>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white p-5 rounded-3xl space-y-1 border border-gray-100">
               <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">合计金额</p>
               <p className="text-2xl font-black text-gray-800">¥{totalSubtotal}</p>
             </div>
             <div className="bg-emerald-500 p-5 rounded-3xl space-y-1 shadow-lg shadow-emerald-100">
               <p className="text-[10px] text-white/70 font-black uppercase tracking-widest">应收金额</p>
               <p className="text-2xl font-black text-white">¥{finalReceivable}</p>
             </div>
          </div>

          <div 
            onClick={() => setActiveField('received')} 
            className={`p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer ${activeField === 'received' ? 'bg-emerald-50 border-emerald-500 ring-8 ring-emerald-50' : 'bg-white border-transparent'}`}
          >
             <p className="text-xs text-emerald-600 font-black uppercase mb-3 tracking-widest text-center">本次实收</p>
             <div className="flex items-baseline justify-center gap-2">
               <span className="text-6xl font-black text-emerald-600 tracking-tighter">
                 {paymentInfo.received === '' ? finalReceivable : paymentInfo.received}
               </span>
               <div className="bg-emerald-500 w-2 h-10 rounded-full animate-pulse"></div>
             </div>
             {selectedCustomerId !== 'guest' && parseFloat(paymentInfo.received || finalReceivable.toString()) < finalReceivable && (
               <p className="text-center text-xs font-black text-red-500 mt-2">剩余金额将计入客户欠款</p>
             )}
          </div>

          <div className="bg-white p-5 rounded-3xl space-y-3">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">收款人</p>
            <div className="flex flex-wrap gap-2">
              {data.payees.map(p => (
                <button 
                  key={p} 
                  onClick={() => setPaymentInfo({...paymentInfo, payee: p})}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${paymentInfo.payee === p ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </main>

        <div className="bg-[#2D3142] p-4 pb-12 safe-bottom z-50">
           <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { id: PaymentMethod.WECHAT, label: '微信', icon: '💬', color: 'bg-green-500' },
                { id: PaymentMethod.ALIPAY, label: '支付宝', icon: '💳', color: 'bg-blue-500' },
                { id: PaymentMethod.CASH, label: '现金', icon: '💰', color: 'bg-orange-500' },
                { id: PaymentMethod.OTHER, label: '其他', icon: '📁', color: 'bg-gray-500' },
              ].map(m => (
                <button 
                  key={m.id} 
                  onClick={() => setPaymentInfo({...paymentInfo, method: m.id})} 
                  className={`flex flex-col items-center py-2.5 rounded-2xl border transition-all ${paymentInfo.method === m.id ? `${m.color} text-white border-transparent shadow-xl` : 'bg-white/5 text-gray-500 border-white/5'}`}
                >
                  <span className="text-xl mb-0.5">{m.icon}</span>
                  <span className="text-[10px] font-black">{m.label}</span>
                </button>
              ))}
           </div>
           <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3 grid grid-cols-3 gap-2">
                 {['1','2','3','4','5','6','7','8','9','0','.'].map(k => (
                   <button key={k} onClick={() => handleKeypadInput(k)} className="h-16 bg-[#4A5064] text-white text-2xl font-black rounded-2xl active:bg-gray-500 shadow-lg">{k}</button>
                 ))}
                 <button onClick={handleKeypadDelete} className="h-16 bg-[#4A5064] text-white rounded-2xl flex items-center justify-center shadow-lg"><Delete size={28} /></button>
              </div>
              <button 
                onClick={handleFinishOrder} 
                className="bg-emerald-500 text-white rounded-3xl flex flex-col items-center justify-center gap-1 active:scale-95 shadow-xl"
              >
                 <Check size={32} strokeWidth={4} />
                 <span className="text-xs font-black">完成确认</span>
              </button>
           </div>
        </div>

        {showCustomerModal && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end">
            <div className="bg-white w-full rounded-t-[3rem] p-6 space-y-6 animate-in slide-in-from-bottom max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center shrink-0">
                <h3 className="text-xl font-black text-gray-900">选择购货客户</h3>
                <button 
                  onClick={() => { setShowCustomerModal(false); setIsAddingNewCustomer(false); }} 
                  className="p-2 bg-gray-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              {!isAddingNewCustomer ? (
                <>
                  <div className="relative shrink-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      value={customerSearchQuery}
                      onChange={e => setCustomerSearchQuery(e.target.value)}
                      placeholder="搜索现有客户..." 
                      className="w-full bg-gray-50 h-12 pl-12 pr-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-emerald-500/20" 
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-2">
                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => { setSelectedCustomerId(c.id); setShowCustomerModal(false); }} 
                        className={`p-4 rounded-2xl flex justify-between items-center border transition-all ${selectedCustomerId === c.id ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-gray-50'}`}
                      >
                         <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${selectedCustomerId === c.id ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-500'}`}>
                              {c.name[0]}
                            </div>
                            <p className="font-black text-gray-800">{c.name}</p>
                         </div>
                         {selectedCustomerId === c.id && <Check size={20} className="text-emerald-500" />}
                      </div>
                    )) : (
                      <div className="text-center py-10 text-gray-400 font-bold">未找到该客户</div>
                    )}
                  </div>

                  <button 
                    onClick={() => setIsAddingNewCustomer(true)}
                    className="w-full py-4 bg-gray-50 text-emerald-600 rounded-2xl font-black text-sm border-2 border-dashed border-emerald-100 flex items-center justify-center gap-2 active:bg-emerald-50"
                  >
                    <UserPlus size={18} /> 没有找到？添加新客户
                  </button>
                </>
              ) : (
                <div className="space-y-6 py-4 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">客户姓名</label>
                    <input 
                      autoFocus
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      placeholder="输入新客户姓名" 
                      className="w-full bg-gray-50 p-5 rounded-2xl text-xl font-black outline-none border-2 border-emerald-100 focus:border-emerald-500 transition-all" 
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsAddingNewCustomer(false)}
                      className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleAddNewCustomer}
                      className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-100"
                    >
                      确认添加并选择
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <div className="bg-[#2D3142] p-4 pt-8 text-white shrink-0 space-y-4">
        <div className="flex items-center gap-4">
           <button onClick={() => onBackToHome?.()} className="p-1 -ml-1 active:scale-90"><ArrowLeft size={24} /></button>
           <div className="bg-emerald-500 w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">单</div>
           <button 
              onClick={() => cart.length > 0 && setCheckoutStep('settle')} 
              className="flex items-center gap-2 text-xs font-black bg-white/10 px-4 py-2 rounded-full border border-white/5 active:bg-white/20 ml-auto"
           >
             <ShoppingBag size={14} /> 结算清单 ({cart.length})
           </button>
        </div>
        
        {/* 车次选择器 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            onClick={() => setSelectedBatchId('ALL')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 border ${selectedBatchId === 'ALL' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-gray-300'}`}
          >
            <Layers size={14} /> 全部商品
          </button>
          {activeBatches.map(batch => (
            <button
              key={batch.id}
              onClick={() => setSelectedBatchId(batch.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 border ${selectedBatchId === batch.id ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-gray-300'}`}
            >
              <Truck size={14} /> {batch.plateNumber}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder={selectedBatchId === 'ALL' ? "搜索全部货品..." : `在 ${getBatchPlate(selectedBatchId)} 中搜索...`}
            className="w-full bg-white text-gray-900 h-14 pl-12 pr-4 rounded-2xl shadow-inner outline-none font-bold placeholder-gray-400" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-40">
        {filteredProducts.length > 0 ? filteredProducts.map(p => (
          <div key={p.id} onClick={() => handleProductClick(p)} className="bg-white p-6 rounded-[2rem] flex justify-between items-center shadow-sm active:scale-[0.98] transition-all border border-gray-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-gray-800">{p.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${p.pricingMode === 'WEIGHT' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                  {p.pricingMode === 'WEIGHT' ? '称重' : '计件'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-bold">
                库存: <span className="text-gray-900">{p.stockQty}件 / {p.stockWeight.toFixed(0)}斤</span>
                <span className="ml-2 text-emerald-500 font-black">批次: {getBatchPlate(p.batchId)}</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100"><PlusCircle size={32} strokeWidth={3} /></div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-2">
            <ShoppingBag size={48} strokeWidth={1} />
            <p className="text-sm font-bold">暂无相关商品</p>
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-[90px] left-4 right-4 bg-gray-900/95 backdrop-blur-xl text-white p-5 rounded-[2rem] flex justify-between items-center shadow-2xl z-[60] border border-white/10">
           <div>
             <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">待结金额</p>
             <p className="text-3xl font-black text-orange-400 tracking-tighter">¥{totalSubtotal}</p>
           </div>
           <button onClick={() => setCheckoutStep('settle')} className="bg-emerald-500 px-10 py-4 rounded-2xl font-black text-lg active:scale-95 shadow-lg">去结算</button>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-sm">
          <div className="mt-auto bg-white rounded-t-[3rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <header className="p-8 pb-4 flex justify-between items-center bg-white z-10 rounded-t-[3rem]">
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-gray-900">{selectedProduct.name}</h2>
                <p className="text-[10px] text-gray-400 font-black uppercase">批次：{getBatchPlate(selectedProduct.batchId)}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><X size={20} /></button>
            </header>

            <div className="px-6 grid grid-cols-2 gap-4 pb-4">
              <div onClick={() => setActiveField('qty')} className={`p-6 rounded-3xl border-2 transition-all ${activeField === 'qty' ? 'border-emerald-500 bg-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">件数</p>
                <p className="text-3xl font-black text-gray-800">{formValues.qty || '0'}</p>
              </div>
              {selectedProduct.pricingMode === PricingMode.WEIGHT && (
                <>
                  <div onClick={() => setActiveField('gross')} className={`p-6 rounded-3xl border-2 transition-all ${activeField === 'gross' ? 'border-emerald-500 bg-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                    <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">总毛重 (斤)</p>
                    <p className="text-3xl font-black text-gray-800">{formValues.gross || '0'}</p>
                  </div>
                  <div onClick={() => setActiveField('tare')} className={`p-6 rounded-3xl border-2 transition-all ${activeField === 'tare' ? 'border-emerald-500 bg-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                    <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">皮重 (斤)</p>
                    <p className="text-3xl font-black text-gray-800">{formValues.tare || '0'}</p>
                  </div>
                </>
              )}
              <div onClick={() => setActiveField('price')} className={`p-6 rounded-3xl border-2 transition-all ${activeField === 'price' ? 'border-emerald-500 bg-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">单价 (元)</p>
                <p className="text-3xl font-black text-gray-800">{formValues.price || '0'}</p>
              </div>
            </div>

            <Keypad onInput={handleKeypadInput} onDelete={handleKeypadDelete} onSubmit={handleAddToCart} submitLabel="加入清单" />
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingView;