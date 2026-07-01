
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { Product, PricingMode, OrderItem, PaymentMethod, Order, Customer, OrderStatus } from '../types';
import { Search, ShoppingBag, X, ArrowLeft, Check, Delete, PlusCircle, UserPlus, Scissors, FileText, Calendar, Clock, Layers, Truck, AlertTriangle, ChevronDown, StickyNote, Phone } from 'lucide-react';
import Keypad from './Keypad';
import { preciseCalc, generateOrderNo } from '../utils';

interface BillingViewProps {
  onBackToHome?: () => void;
}

let sessionOrderDate = '';
let sessionOrderTime = '';
let sessionIsManualDateTime = false;

const BillingView: React.FC<BillingViewProps> = ({ onBackToHome }) => {
  const { data, addOrder, addCustomer } = useApp();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeField, setActiveField] = useState<string>('qty');
  
  // Batch Filter State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');

  const [formValues, setFormValues] = useState({
    qty: '',
    gross: '',
    price: '',
    subtotal: ''
  });

  const [checkoutStep, setCheckoutStep] = useState<'select' | 'cart' | 'settle' | 'success'>('select');
  const [selectedCustomerId, setSelectedCustomerId] = useState('guest');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState(''); // New: Phone number state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // New Features State
  const [orderDate, setOrderDate] = useState(sessionOrderDate); // YYYY-MM-DD
  const [orderTime, setOrderTime] = useState(sessionOrderTime); // HH:mm
  const [isManualDateTime, setIsManualDateTime] = useState(sessionIsManualDateTime); // New: Track manual date/time
  const [isRounding, setIsRounding] = useState(false); // 抹零开关
  const [orderNote, setOrderNote] = useState(''); // New: Order Note
  
  // Toast State for Warnings
  const [toast, setToast] = useState<{msg: string, type: 'warning' | 'success'} | null>(null);

  // Initialize date/time on mount
  useEffect(() => {
    if (!sessionOrderDate || !sessionOrderTime) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const newDate = `${yyyy}-${mm}-${dd}`;
      
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const newTime = `${hh}:${min}`;
      
      setOrderDate(newDate);
      setOrderTime(newTime);
      sessionOrderDate = newDate;
      sessionOrderTime = newTime;
    }
  }, []);

  const updateOrderDate = (val: string, manual: boolean) => {
    setOrderDate(val);
    sessionOrderDate = val;
    setIsManualDateTime(manual);
    sessionIsManualDateTime = manual;
  };

  const updateOrderTime = (val: string, manual: boolean) => {
    setOrderTime(val);
    sessionOrderTime = val;
    setIsManualDateTime(manual);
    sessionIsManualDateTime = manual;
  };

  // Toast Auto-dismiss
  useEffect(() => {
    if (toast) {
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [toast]);

  const setQuickDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    updateOrderDate(`${yyyy}-${mm}-${dd}`, daysAgo !== 0);
  };

  const [paymentInfo, setPaymentInfo] = useState({
    received: '',
    method: PaymentMethod.WECHAT,
    mixedPayments: {
      [PaymentMethod.WECHAT]: '',
      [PaymentMethod.ALIPAY]: '',
      [PaymentMethod.CASH]: ''
    } as Record<PaymentMethod, string>,
    discount: '0',
    extraFee: '0',
    payee: data.payees[0] || ''
  });

  const resetBilling = () => {
    setCart([]);
    setSelectedProduct(null);
    setSearch('');
    setFormValues({ qty: '', gross: '', price: '', subtotal: '' });
    setPaymentInfo({
      received: '',
      method: PaymentMethod.WECHAT,
      mixedPayments: {
        [PaymentMethod.WECHAT]: '',
        [PaymentMethod.ALIPAY]: '',
        [PaymentMethod.CASH]: ''
      } as Record<PaymentMethod, string>,
      discount: '0',
      extraFee: '0',
      payee: data.payees[0] || ''
    });
    setCheckoutStep('select');
    setActiveField('qty');
    setSelectedCustomerId('guest');
    setCustomerSearchQuery('');
    setIsAddingNewCustomer(false);
    setIsRounding(false);
    setOrderNote('');
    
    // Reset date/time to now ONLY if not manually set
    if (!isManualDateTime) {
      setQuickDate(0);
      const today = new Date();
      const hh = String(today.getHours()).padStart(2, '0');
      const min = String(today.getMinutes()).padStart(2, '0');
      updateOrderTime(`${hh}:${min}`, false);
    }
  };

  const activeBatches = useMemo(() => {
    return data.batches.filter(b => !b.isClosed);
  }, [data.batches]);

  const filteredProducts = useMemo(() => {
    let products = data.products;

    // 1. 过滤已删除的商品
    products = products.filter(p => !p.isDeleted);

    // 2. Filter by Batch
    if (selectedBatchId !== 'ALL') {
      products = products.filter(p => p.batchId === selectedBatchId);
    }

    // 3. Filter by Search
    if (search) {
      products = products.filter(p => p.name.includes(search) || p.category.includes(search));
    }

    return products;
  }, [data.products, search, selectedBatchId]);

  const filteredCustomers = useMemo(() => {
    return data.customers.filter(c => 
      !c.isDeleted && (c.name.includes(customerSearchQuery) || (c.phone && c.phone.includes(customerSearchQuery)))
    );
  }, [data.customers, customerSearchQuery]);

  const totalSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  
  // === 核心金额计算逻辑 ===
  const baseTotalAmount = preciseCalc(() => totalSubtotal + (parseFloat(paymentInfo.extraFee) || 0));
  const manualDiscount = parseFloat(paymentInfo.discount) || 0;
  const estimatedReceivable = preciseCalc(() => baseTotalAmount - manualDiscount);
  
  let receivedVal = 0;
  if (paymentInfo.method === PaymentMethod.MIXED) {
    receivedVal = Math.floor((parseFloat(paymentInfo.mixedPayments[PaymentMethod.WECHAT]) || 0) +
                  (parseFloat(paymentInfo.mixedPayments[PaymentMethod.ALIPAY]) || 0) +
                  (parseFloat(paymentInfo.mixedPayments[PaymentMethod.CASH]) || 0));
  } else {
    receivedVal = paymentInfo.received === '' ? Math.floor(estimatedReceivable) : Math.floor(parseFloat(paymentInfo.received));
  }

  const finalReceivable = isRounding ? receivedVal : estimatedReceivable;
  const finalTotalDiscount = isRounding 
    ? preciseCalc(() => baseTotalAmount - receivedVal) 
    : manualDiscount;
  const finalDebt = isRounding ? 0 : preciseCalc(() => estimatedReceivable - receivedVal);


  const getBatchPlate = (batchId?: string) => {
    if (!batchId) return '散货';
    return data.batches.find(b => b.id === batchId)?.plateNumber || '未知车次';
  };

  const handleProductClick = (p: Product) => {
    setSelectedProduct(p);
    setFormValues({
      qty: '',
      gross: '',
      price: (p.sellingPrice || '').toString(),
      subtotal: ''
    });
    setActiveField('qty');
  };

  const handleKeypadInput = (val: string) => {
    if (checkoutStep === 'settle') {
      if (activeField.startsWith('mixed_')) {
        const method = activeField.split('_')[1] as PaymentMethod;
        setPaymentInfo(prev => {
          const current = prev.mixedPayments[method];
          return {
            ...prev,
            mixedPayments: {
              ...prev.mixedPayments,
              [method]: (current === '0' && val !== '.') ? val : current + val
            }
          };
        });
      } else {
        setPaymentInfo(prev => ({ 
          ...prev, 
          [activeField]: (prev[activeField as keyof typeof paymentInfo] === '0' && val !== '.') ? val : prev[activeField as keyof typeof paymentInfo] + val 
        }));
      }
    } else {
      setFormValues(prev => ({ ...prev, [activeField]: prev[activeField as keyof typeof formValues] + val }));
    }
  };

  const handleKeypadDelete = () => {
    if (checkoutStep === 'settle') {
      if (activeField.startsWith('mixed_')) {
        const method = activeField.split('_')[1] as PaymentMethod;
        setPaymentInfo(prev => {
          const current = prev.mixedPayments[method];
          return {
            ...prev,
            mixedPayments: {
              ...prev.mixedPayments,
              [method]: current.length <= 1 ? '0' : current.slice(0, -1)
            }
          };
        });
      } else {
        const current = String(paymentInfo[activeField as keyof typeof paymentInfo]);
        setPaymentInfo(prev => ({ ...prev, [activeField]: current.length <= 1 ? '0' : current.slice(0, -1) }));
      }
    } else {
      setFormValues(prev => ({ ...prev, [activeField]: prev[activeField as keyof typeof formValues].slice(0, -1) }));
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const qty = parseFloat(formValues.qty) || 0;
    const price = parseFloat(formValues.price) || 0;
    const manualSubtotal = parseFloat(formValues.subtotal);
    const hasManualSubtotal = !isNaN(manualSubtotal) && formValues.subtotal.trim() !== '';
    
    if (!hasManualSubtotal && qty <= 0) { alert('请输入有效的件数或总金额'); return; }

    let net = 0;
    let calculatedSubtotal = 0;
    const tare = selectedProduct.defaultTare || 0;
    const gross = parseFloat(formValues.gross) || 0;

    if (selectedProduct.pricingMode === PricingMode.WEIGHT) {
      net = Math.max(0, preciseCalc(() => gross - (qty * tare)));
      calculatedSubtotal = preciseCalc(() => net * price);
      
      // === 库存强拦截：按斤计价 ===
      if (net > 0 && net > selectedProduct.stockWeight) {
        alert(`❌ ${selectedProduct.name} 库存不足\n\n剩余 ${selectedProduct.stockWeight} 斤\n需求 ${net} 斤\n\n无法添加到购物车！`);
        return;
      }
    } else {
      calculatedSubtotal = preciseCalc(() => qty * price);
      
      // === 库存强拦截：按件计价 ===
      if (qty > 0 && qty > selectedProduct.stockQty) {
        alert(`❌ ${selectedProduct.name} 库存不足\n\n剩余 ${selectedProduct.stockQty} 件\n需求 ${qty} 件\n\n无法添加到购物车！`);
        return;
      }
    }

    // Request 1: 计算金额的时候不要小数点后面的，只要整数
    const finalSubtotal = hasManualSubtotal ? Math.floor(manualSubtotal) : Math.floor(calculatedSubtotal);

    if (finalSubtotal <= 0 && !hasManualSubtotal) { alert('总金额不能为0，请检查输入'); return; }

    const item: OrderItem = {
      productId: selectedProduct.id,
      productName: `${selectedProduct.name} (${getBatchPlate(selectedProduct.batchId)})`,
      qty,
      grossWeight: gross,
      tareWeight: tare,
      netWeight: net,
      unitPrice: price,
      subtotal: finalSubtotal
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
      phone: newCustomerPhone.trim(), // Save phone
      totalDebt: 0,
      isGuest: false
    };
    addCustomer(customer);
    setSelectedCustomerId(newId);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setIsAddingNewCustomer(false);
    setShowCustomerModal(false);
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    if (method === PaymentMethod.OTHER) {
      setPaymentInfo(prev => ({ ...prev, method, received: '0' }));
      setIsRounding(false);
      setActiveField('received');
    } else if (method === PaymentMethod.MIXED) {
      setPaymentInfo(prev => ({ ...prev, method, received: '0' }));
      setIsRounding(false);
      setActiveField('mixed_WECHAT');
    } else {
      setPaymentInfo(prev => ({ 
        ...prev, 
        method, 
        received: estimatedReceivable.toString() 
      }));
      setActiveField('received');
    }
  };

  const handleFinishOrder = () => {
    if (cart.length === 0) return;
    
    // === 库存最后一道防线：结算前再次校验 ===
    const stockCheckIssues: string[] = [];
    const productStockMap = new Map<string, { totalQty: number; totalWeight: number; product: Product }>();
    
    // 汇总购物车中每个商品的总需求量
    cart.forEach(item => {
      const existing = productStockMap.get(item.productId);
      if (existing) {
        existing.totalQty = preciseCalc(() => existing.totalQty + item.qty);
        existing.totalWeight = preciseCalc(() => existing.totalWeight + item.netWeight);
      } else {
        const product = data.products.find(p => p.id === item.productId);
        if (product) {
          productStockMap.set(item.productId, {
            totalQty: item.qty,
            totalWeight: item.netWeight,
            product
          });
        }
      }
    });
    
    // 检查每个商品库存是否足够
    productStockMap.forEach((value, productId) => {
      const { totalQty, totalWeight, product } = value;
      
      if (product.pricingMode === PricingMode.WEIGHT) {
        if (totalWeight > product.stockWeight) {
          stockCheckIssues.push(`${product.name}: 剩余 ${product.stockWeight} 斤，需求 ${totalWeight} 斤`);
        }
      } else {
        if (totalQty > product.stockQty) {
          stockCheckIssues.push(`${product.name}: 剩余 ${product.stockQty} 件，需求 ${totalQty} 件`);
        }
      }
    });
    
    if (stockCheckIssues.length > 0) {
      alert(`❌ 库存不足，无法完成开单！\n\n${stockCheckIssues.join('\n')}\n\n请先调整购物车或补充库存。`);
      return;
    }
    
    if (!isRounding && receivedVal < estimatedReceivable && selectedCustomerId === 'guest') {
      alert('❌ 散客不能欠款！\n\n请选择具体客户，或者开启"抹零"将剩余金额免除。');
      return;
    }

    const dateTimeStr = `${orderDate}T${orderTime}:00`;
    const finalDateObj = new Date(dateTimeStr);
    const validDate = isNaN(finalDateObj.getTime()) ? new Date() : finalDateObj;

    const order: Order = {
      id: Date.now().toString(),
      orderNo: generateOrderNo(),
      customerId: selectedCustomerId,
      customerName: data.customers.find(c => c.id === selectedCustomerId)?.name || '未知',
      items: cart,
      totalAmount: baseTotalAmount,
      receivedAmount: receivedVal,
      discount: finalTotalDiscount,
      extraFee: parseFloat(paymentInfo.extraFee) || 0,
      paymentMethod: paymentInfo.method,
      mixedPayments: paymentInfo.method === PaymentMethod.MIXED ? [
        { method: PaymentMethod.WECHAT, amount: Math.floor(parseFloat(paymentInfo.mixedPayments[PaymentMethod.WECHAT]) || 0) },
        { method: PaymentMethod.ALIPAY, amount: Math.floor(parseFloat(paymentInfo.mixedPayments[PaymentMethod.ALIPAY]) || 0) },
        { method: PaymentMethod.CASH, amount: Math.floor(parseFloat(paymentInfo.mixedPayments[PaymentMethod.CASH]) || 0) }
      ].filter(m => m.amount > 0) : undefined,
      payee: paymentInfo.payee,
      createdAt: validDate.toISOString(),
      status: OrderStatus.ACTIVE,
      note: orderNote // Save Note
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
          <div className="flex justify-center gap-3 mt-2">
              <span className="text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-lg text-gray-500 flex items-center gap-1"><Calendar size={12}/> {orderDate}</span>
              <span className="text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-lg text-gray-500 flex items-center gap-1"><Clock size={12}/> {orderTime}</span>
          </div>
        </div>
        <div className="w-full max-w-xs space-y-3 pt-8">
           <button onClick={() => onBackToHome?.()} className="w-full h-16 bg-emerald-500 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-100 active:scale-95 transition-all">回到首页</button>
           <button onClick={resetBilling} className="w-full py-4 text-gray-400 font-bold text-sm active:text-gray-600">继续下一单</button>
        </div>
      </div>
    );
  }

  // Settle View
  if (checkoutStep === 'settle') {
    const activeCustomer = data.customers.find(c => c.id === selectedCustomerId);
    return (
      <div className="fixed inset-0 bg-[#F4F6F9] z-[100] flex flex-col overflow-hidden animate-in slide-in-from-right">
        <header className="bg-[#2D3142] pt-4 pb-4 px-4 shrink-0 text-white shadow-md z-10">
          <div className="flex items-center justify-between mb-4">
             <button onClick={() => setCheckoutStep('select')} className="p-2 -ml-2 rounded-full active:bg-white/10"><ArrowLeft /></button>
             <h1 className="font-black text-lg tracking-wide">结算收银</h1>
             <div className="w-8"></div>
          </div>
          
          <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5">
              <div className="flex items-center gap-2 px-2">
                 <Calendar size={16} className="text-emerald-400"/>
                 <div className="relative">
                    <input 
                        type="date" 
                        value={orderDate}
                        onChange={(e) => updateOrderDate(e.target.value, true)}
                        className="bg-transparent text-sm font-bold text-white outline-none w-28 opacity-0 absolute inset-0 z-10"
                    />
                    <span className="text-sm font-bold text-white">{orderDate}</span>
                 </div>
              </div>
              <div className="h-4 w-[1px] bg-white/20"></div>
              <div className="flex items-center gap-2 px-2">
                 <Clock size={16} className="text-emerald-400"/>
                 <input 
                    type="time" 
                    value={orderTime}
                    onChange={(e) => updateOrderTime(e.target.value, true)}
                    className="bg-transparent text-sm font-bold text-white outline-none w-16 text-center"
                />
              </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-20">
          {/* Customer Selection Card */}
          <div 
            onClick={() => setShowCustomerModal(true)}
            className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-emerald-500/30 flex items-center justify-between active:scale-[0.98] transition-all relative overflow-hidden group"
          >
             <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
             <div className="flex items-center gap-4 pl-2">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-200 shrink-0">
                  {activeCustomer?.name[0]}
                </div>
                <div>
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-0.5">当前购货客户</p>
                  <div className="flex items-center gap-2">
                      <p className="text-lg font-black text-gray-800">{activeCustomer?.name}</p>
                      {activeCustomer?.phone && (
                          <a 
                            href={`tel:${activeCustomer.phone}`} 
                            onClick={(e) => e.stopPropagation()}
                            className="bg-green-100 text-green-600 p-1.5 rounded-full active:bg-green-200 transition-colors"
                          >
                             <Phone size={14} fill="currentColor" />
                          </a>
                      )}
                  </div>
                </div>
             </div>
             <div className="bg-gray-50 p-2.5 rounded-xl text-emerald-500 group-active:bg-emerald-50 transition-colors">
               <ChevronDown size={20} />
             </div>
          </div>

          <div className="bg-white p-4 rounded-[1.5rem] space-y-3 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-1">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">选择收款人 (经手人)</p>
                <div className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-md">
                   <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                   当前: {paymentInfo.payee}
                </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {data.payees.map(p => (
                <button 
                  key={p} 
                  onClick={() => setPaymentInfo({...paymentInfo, payee: p})}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border-2 ${paymentInfo.payee === p ? 'bg-gray-800 border-gray-800 text-white shadow-md scale-105' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] p-5 shadow-sm space-y-3 border border-gray-100">
             <div className="flex justify-between items-center mb-1 pb-2 border-b border-gray-50">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">购物清单</h3>
                <span className="text-xs font-bold text-gray-400">共 {cart.length} 项</span>
             </div>
             <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
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
             <div className="bg-white p-5 rounded-[1.5rem] space-y-1 border border-gray-100">
               <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">合计金额</p>
               <p className="text-2xl font-black text-gray-800">¥{totalSubtotal}</p>
             </div>
             <div className="bg-emerald-500 p-5 rounded-[1.5rem] space-y-1 shadow-lg shadow-emerald-100">
               <p className="text-[10px] text-white/70 font-black uppercase tracking-widest">应收金额</p>
               <p className="text-2xl font-black text-white">¥{estimatedReceivable}</p>
             </div>
          </div>

          {paymentInfo.method === PaymentMethod.MIXED ? (
            <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 space-y-3">
              <p className="text-xs text-emerald-600 font-black uppercase mb-2 tracking-widest text-center">混合支付明细</p>
              {[
                { id: PaymentMethod.WECHAT, label: '微信', color: 'text-green-600' },
                { id: PaymentMethod.ALIPAY, label: '支付宝', color: 'text-blue-600' },
                { id: PaymentMethod.CASH, label: '现金', color: 'text-orange-600' }
              ].map(m => (
                <div 
                  key={m.id}
                  onClick={() => setActiveField(`mixed_${m.id}`)}
                  className={`flex justify-between items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${activeField === `mixed_${m.id}` ? 'bg-emerald-50 border-emerald-500' : 'bg-gray-50 border-transparent'}`}
                >
                  <span className={`text-sm font-black ${m.color}`}>{m.label}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-gray-800">
                      {paymentInfo.mixedPayments[m.id as PaymentMethod] || '0'}
                    </span>
                    {activeField === `mixed_${m.id}` && <div className="bg-emerald-500 w-1 h-5 rounded-full animate-pulse"></div>}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400 font-black">混合总计</span>
                <span className="text-lg font-black text-emerald-600">¥{receivedVal}</span>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setActiveField('received')} 
              className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer relative overflow-hidden ${activeField === 'received' ? 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-50' : 'bg-white border-transparent'}`}
            >
               <p className="text-xs text-emerald-600 font-black uppercase mb-2 tracking-widest text-center">本次实收</p>
               <div className="flex items-baseline justify-center gap-2">
                 <span className="text-5xl font-black text-emerald-600 tracking-tighter">
                   {paymentInfo.received === '' ? estimatedReceivable : paymentInfo.received}
                 </span>
                 {activeField === 'received' && <div className="bg-emerald-500 w-1.5 h-8 rounded-full animate-pulse"></div>}
               </div>
               
               <div className="mt-4 text-center h-4 flex justify-center items-center">
                 {!isRounding && finalDebt > 0 && (
                   <p className="text-[10px] font-black text-red-500 animate-in fade-in flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg">
                     <FileText size={10} /> 剩余 {finalDebt} 元将计入欠款
                   </p>
                 )}
                 {isRounding && finalTotalDiscount > 0 && (
                   <p className="text-[10px] font-black text-blue-500 animate-in fade-in flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                     <Scissors size={10} /> 已抹零/优惠 {finalTotalDiscount} 元
                   </p>
                 )}
               </div>
            </div>
          )}

          {/* New: Order Note Field */}
          <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 space-y-2">
             <div className="flex items-center gap-2 px-2">
                 <StickyNote size={14} className="text-gray-400"/>
                 <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">订单备注 (选填)</p>
             </div>
             <input 
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="例如：欠3个框子、送货上门..."
                className="w-full bg-gray-50 h-12 px-4 rounded-xl text-sm font-bold text-gray-700 placeholder-gray-400 outline-none focus:ring-2 ring-gray-100 transition-all"
             />
          </div>
        </main>

        <div className="bg-[#2D3142] p-4 pb-12 safe-bottom z-50 rounded-t-[2rem] shadow-[0_-5px_20px_rgba(0,0,0,0.2)]">
           <div className="grid grid-cols-5 gap-2 mb-4">
              {[
                { id: PaymentMethod.WECHAT, label: '微信', icon: '💬', color: 'bg-green-500' },
                { id: PaymentMethod.ALIPAY, label: '支付宝', icon: '💳', color: 'bg-blue-500' },
                { id: PaymentMethod.CASH, label: '现金', icon: '💰', color: 'bg-orange-500' },
                { id: PaymentMethod.MIXED, label: '混合', icon: '🔀', color: 'bg-purple-500' },
                { id: PaymentMethod.OTHER, label: '挂账', icon: '⭕', color: 'bg-red-500' },
              ].map(m => (
                <button 
                  key={m.id} 
                  onClick={() => handlePaymentMethodChange(m.id)} 
                  className={`flex flex-col items-center py-2 rounded-2xl border transition-all active:scale-95 ${paymentInfo.method === m.id ? `${m.color} text-white border-transparent shadow-lg shadow-black/20 ring-2 ring-white/20 translate-y-[-2px]` : 'bg-white/5 text-gray-400 border-white/5'}`}
                >
                  <span className="text-xl mb-0.5">{m.icon}</span>
                  <span className="text-[10px] font-black">{m.label}</span>
                </button>
              ))}
           </div>
           
           <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 grid grid-cols-3 gap-3">
                 {['1','2','3','4','5','6','7','8','9','0','.'].map(k => (
                   <button key={k} onClick={() => handleKeypadInput(k)} className="h-14 bg-[#4A5064] text-white text-xl font-black rounded-2xl active:bg-gray-500 shadow-lg border-b-4 border-[#3a3f50] active:border-b-0 active:translate-y-[4px] transition-all">{k}</button>
                 ))}
                 <button onClick={handleKeypadDelete} className="h-14 bg-[#4A5064] text-white rounded-2xl flex items-center justify-center shadow-lg border-b-4 border-[#3a3f50] active:border-b-0 active:translate-y-[4px] transition-all"><Delete size={24} /></button>
              </div>
              
              <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                        const nextState = !isRounding;
                        setIsRounding(nextState);
                        if (nextState && paymentInfo.received === '') {
                             setPaymentInfo(p => ({...p, received: estimatedReceivable.toString()}));
                        }
                    }} 
                    className={`flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border ${isRounding ? 'bg-blue-500 text-white border-blue-600' : 'bg-white/10 text-gray-400 border-white/5'}`}
                  >
                     <Scissors size={20} />
                     <span className="text-[10px] font-black">{isRounding ? '已抹零' : '抹零'}</span>
                  </button>

                  <button 
                    onClick={handleFinishOrder} 
                    className="flex-[2] bg-emerald-500 text-white rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 shadow-xl border-b-4 border-emerald-600 active:border-b-0 active:translate-y-[4px] transition-all"
                  >
                     <Check size={28} strokeWidth={4} />
                     <span className="text-xs font-black">完成</span>
                  </button>
              </div>
           </div>
        </div>
        
        {/* Customer Modal code kept same */}
        {showCustomerModal && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end">
            <div className="bg-white w-full rounded-t-[3rem] p-6 space-y-6 animate-in slide-in-from-bottom max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center shrink-0">
                <h3 className="text-xl font-black text-gray-900">选择购货客户</h3>
                <button onClick={() => { setShowCustomerModal(false); setIsAddingNewCustomer(false); }} className="p-2 bg-gray-100 rounded-full"><X size={20} /></button>
              </div>

              {!isAddingNewCustomer ? (
                <>
                  <div className="relative shrink-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input value={customerSearchQuery} onChange={e => setCustomerSearchQuery(e.target.value)} placeholder="搜索现有客户..." className="w-full bg-gray-50 h-12 pl-12 pr-4 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-emerald-500/20" />
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-2">
                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                      <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setShowCustomerModal(false); }} className={`p-4 rounded-2xl flex justify-between items-center border transition-all ${selectedCustomerId === c.id ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-gray-50'}`}>
                         <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${selectedCustomerId === c.id ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-500'}`}>{c.name[0]}</div><p className="font-black text-gray-800">{c.name}</p></div>
                         {selectedCustomerId === c.id && <Check size={20} className="text-emerald-500" />}
                      </div>
                    )) : <div className="text-center py-10 text-gray-400 font-bold">未找到该客户</div>}
                  </div>
                  <button onClick={() => setIsAddingNewCustomer(true)} className="w-full py-4 bg-gray-50 text-emerald-600 rounded-2xl font-black text-sm border-2 border-dashed border-emerald-100 flex items-center justify-center gap-2 active:bg-emerald-50"><UserPlus size={18} /> 没有找到？添加新客户</button>
                </>
              ) : (
                <div className="space-y-6 py-4 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">客户姓名</label>
                    <input autoFocus value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="输入新客户姓名" className="w-full bg-gray-50 p-5 rounded-2xl text-xl font-black outline-none border-2 border-emerald-100 focus:border-emerald-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">手机号码 (选填)</label>
                    <input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} type="tel" placeholder="方便后续联系" className="w-full bg-gray-50 p-5 rounded-2xl text-lg font-bold outline-none border-2 border-transparent focus:border-blue-200 transition-all" />
                  </div>
                  <div className="flex gap-3 pt-4"><button onClick={() => setIsAddingNewCustomer(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black">取消</button><button onClick={handleAddNewCustomer} className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-100">确认添加并选择</button></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Select Step
  return (
    <div className="flex flex-col h-screen bg-[#F4F6F9] overflow-hidden relative">
      {/* Inventory Warning Toast */}
      {toast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[200] bg-yellow-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in slide-in-from-top-4 fade-in pointer-events-none">
            <AlertTriangle size={18} fill="white" className="text-yellow-600" />
            <span className="text-xs font-black tracking-wide">{toast.msg}</span>
        </div>
      )}

      <div className="bg-[#2D3142] p-4 pt-8 text-white shrink-0 space-y-4 rounded-b-[2rem] shadow-lg z-10">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
               <button onClick={() => onBackToHome?.()} className="p-2 -ml-2 rounded-full active:bg-white/10"><ArrowLeft size={24} /></button>
               <h1 className="text-xl font-black">开单收银</h1>
           </div>
           
           <button onClick={() => cart.length > 0 && setCheckoutStep('settle')} className={`flex items-center gap-2 text-xs font-black px-4 py-2 rounded-full border transition-all ${cart.length > 0 ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white/10 border-white/5 text-gray-400'}`}>
             <ShoppingBag size={14} /> 清单 ({cart.length})
           </button>
        </div>
        
        {/* Date Selector Row */}
        <div className="flex items-center gap-3">
             <div className="relative bg-white/10 rounded-xl px-3 py-2 border border-white/5 flex items-center gap-2 min-w-[120px]">
                <Calendar size={14} className="text-emerald-400"/>
                <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 font-bold uppercase">业务日期</span>
                    <span className="text-xs font-black">{orderDate}</span>
                </div>
                <input 
                    type="date" 
                    value={orderDate}
                    onChange={(e) => updateOrderDate(e.target.value, true)}
                    className="absolute inset-0 opacity-0 z-10 w-full h-full"
                />
             </div>
             <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                <button onClick={() => setQuickDate(2)} className="px-3 py-2 bg-white/5 rounded-xl border border-white/5 text-[10px] font-bold text-gray-400 active:bg-white/10 whitespace-nowrap">前天</button>
                <button onClick={() => setQuickDate(1)} className="px-3 py-2 bg-white/5 rounded-xl border border-white/5 text-[10px] font-bold text-gray-400 active:bg-white/10 whitespace-nowrap">昨天</button>
                <button onClick={() => setQuickDate(0)} className="px-3 py-2 bg-emerald-500/20 rounded-xl border border-emerald-500/50 text-[10px] font-black text-emerald-400 active:bg-white/10 whitespace-nowrap">今天</button>
             </div>
        </div>

        {/* Batch Selector */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setSelectedBatchId('ALL')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 border ${selectedBatchId === 'ALL' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-gray-300'}`}>
            <Layers size={14} /> 全部商品
          </button>
          {activeBatches.map(batch => (
            <button key={batch.id} onClick={() => setSelectedBatchId(batch.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 border ${selectedBatchId === batch.id ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-gray-300'}`}>
              <Truck size={14} /> {batch.plateNumber}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder={selectedBatchId === 'ALL' ? "搜索全部货品..." : `在 ${getBatchPlate(selectedBatchId)} 中搜索...`} className="w-full bg-white text-gray-900 h-12 pl-12 pr-4 rounded-xl shadow-inner outline-none font-bold placeholder-gray-400 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-40">
        {filteredProducts.length > 0 ? filteredProducts.map(p => (
          <div key={p.id} onClick={() => handleProductClick(p)} className="bg-white p-5 rounded-[1.5rem] flex justify-between items-center shadow-sm active:scale-[0.98] transition-all border border-gray-100 relative overflow-hidden">
            <div className="space-y-1 relative z-10">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-gray-800">{p.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${p.pricingMode === 'WEIGHT' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{p.pricingMode === 'WEIGHT' ? '称重' : '计件'}</span>
              </div>
              <p className="text-xs text-gray-400 font-bold">
                库存: <span className="text-gray-900">{p.stockQty}件 / {p.stockWeight.toFixed(0)}斤</span>
                <span className="ml-2 text-emerald-500 font-black">批次: {getBatchPlate(p.batchId)}</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-sm border border-emerald-100"><PlusCircle size={20} strokeWidth={2.5} /></div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-2">
            <ShoppingBag size={48} strokeWidth={1} />
            <p className="text-sm font-bold">暂无相关商品</p>
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-[90px] left-4 right-4 bg-gray-900/95 backdrop-blur-xl text-white p-4 rounded-[1.5rem] flex justify-between items-center shadow-2xl z-[60] border border-white/10 animate-in slide-in-from-bottom-10">
           <div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">待结金额</p><p className="text-2xl font-black text-orange-400 tracking-tighter">¥{totalSubtotal}</p></div>
           <button onClick={() => setCheckoutStep('settle')} className="bg-emerald-500 px-8 py-3 rounded-xl font-black text-base active:scale-95 shadow-lg shadow-emerald-900/50">去结算</button>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-sm">
          <div className="mt-auto bg-white rounded-t-[3rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <header className="p-8 pb-4 flex justify-between items-center bg-white z-10 rounded-t-[3rem]">
              <div className="space-y-1"><h2 className="text-2xl font-black text-gray-900">{selectedProduct.name}</h2><p className="text-[10px] text-gray-400 font-black uppercase">批次：{getBatchPlate(selectedProduct.batchId)}</p></div>
              <button onClick={() => setSelectedProduct(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={20} /></button>
            </header>

            <div className="px-6 grid grid-cols-2 gap-3 pb-4">
              <div onClick={() => setActiveField('qty')} className={`p-4 rounded-3xl border-2 transition-all ${activeField === 'qty' ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">件数</p><p className="text-3xl font-black text-gray-800">{formValues.qty || '0'}</p>
              </div>
              {selectedProduct.pricingMode === PricingMode.WEIGHT && (
                <div onClick={() => setActiveField('gross')} className={`p-4 rounded-3xl border-2 transition-all ${activeField === 'gross' ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                  <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">总毛重 (斤)</p><p className="text-3xl font-black text-gray-800">{formValues.gross || '0'}</p>
                </div>
              )}
              <div onClick={() => setActiveField('price')} className={`p-4 rounded-3xl border-2 transition-all ${activeField === 'price' ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">单价 (元)</p><p className="text-3xl font-black text-gray-800">{formValues.price || '0'}</p>
              </div>
              <div onClick={() => setActiveField('subtotal')} className={`p-4 rounded-3xl border-2 transition-all ${selectedProduct.pricingMode !== PricingMode.WEIGHT ? 'col-span-2' : ''} ${activeField === 'subtotal' ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50' : 'bg-gray-50 border-transparent'}`}>
                <p className="text-[10px] text-gray-400 mb-1 font-black uppercase">总金额 (元)</p><p className="text-3xl font-black text-gray-800">{formValues.subtotal || '0'}</p>
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
