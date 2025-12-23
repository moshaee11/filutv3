
import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { 
  Database, Download, Upload, Trash2, 
  CheckCircle2, FileSpreadsheet,
  ShieldAlert, UserCircle2, X, ClipboardPaste, ArrowUpRight, Copy, ShieldCheck
} from 'lucide-react';
import { downloadJSON, downloadCSV, preciseCalc } from '../utils';

const MeView: React.FC = () => {
  const { data, exportData, importData } = useApp();
  const [lastBackup, setLastBackup] = useState<string>(localStorage.getItem('LAST_BACKUP_TIME') || '从未备份');
  const [showWxTransferModal, setShowWxTransferModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
  const [isPersisted, setIsPersisted] = useState(false);

  // 初始化：申请持久化存储权限 (防止浏览器自动清理数据)
  useEffect(() => {
    const initPersistence = async () => {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persisted();
            // 尝试申请权限
            if (!isPersisted) {
                const granted = await navigator.storage.persist();
                setIsPersisted(granted);
            } else {
                setIsPersisted(true);
            }
        }
    };
    initPersistence();
  }, []);

  // 检测是否为微信浏览器
  const isWeChat = () => {
    return /MicroMessenger/i.test(navigator.userAgent);
  };

  const updateBackupTime = () => {
    const now = new Date().toLocaleString();
    localStorage.setItem('LAST_BACKUP_TIME', now);
    setLastBackup(now);
  };

  // 核心功能：打包数据到剪贴板
  const handleCopyDataToClipboard = async () => {
    const backupData = { ...data, timestamp: Date.now(), type: 'FRUIT_SYNC' };
    const jsonStr = JSON.stringify(backupData);
    
    try {
        // 优先尝试标准API
        await navigator.clipboard.writeText(jsonStr);
        setCopyStatus('success');
        updateBackupTime();
    } catch (err) {
        // 降级方案：创建隐藏文本域进行复制
        try {
            const textarea = document.createElement('textarea');
            textarea.value = jsonStr;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopyStatus('success');
            updateBackupTime();
        } catch (e) {
            alert('复制失败，请手动长按复制数据');
        }
    }
  };

  const handleExportClick = (type: 'excel' | 'copy') => {
    if (type === 'copy') {
        if (isWeChat()) {
            setShowWxTransferModal(true);
            handleCopyDataToClipboard();
        } else {
            handleCopyDataToClipboard();
            alert('✅ 数据已复制到剪贴板！\n请粘贴保存到安全的地方（如微信收藏）。');
        }
        return;
    }

    if (type === 'excel') {
        performExportExcel();
    }
  };

  const performExportExcel = () => {
    if (data.orders.length === 0) return alert('暂无订单数据可导出');
    
    const headers = [
        '销售日期', '销售时间', '系统单号', '客户名称', '客户类型', 
        '应收总额(元)', '实收金额(元)', '本单欠款(元)', '额外杂费', '折扣优惠', 
        '支付方式', '收款人', '货品详情 (车次-品名-规格-小计)'
    ];

    const sortedOrders = [...data.orders].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const rows = sortedOrders.map(o => {
      const customer = data.customers.find(c => c.id === o.customerId);
      const custType = customer ? (customer.isGuest ? '散客' : '长期客户') : '未知';
      const debt = preciseCalc(() => o.totalAmount - o.receivedAmount);
      const itemsDetail = o.items.map(i => {
          const weightInfo = i.netWeight > 0 ? `/${i.netWeight}斤` : '';
          return `${i.productName}【${i.qty}件${weightInfo}】¥${i.subtotal}`;
      }).join('  |  ');

      const dateObj = new Date(o.createdAt);
      const paymentMethodMap: Record<string, string> = { 'WECHAT': '微信支付', 'ALIPAY': '支付宝', 'CASH': '现金', 'OTHER': '其他' };

      return [
        dateObj.toLocaleDateString(), dateObj.toLocaleTimeString(), o.orderNo,
        o.customerName, custType, o.totalAmount, o.receivedAmount, debt,
        o.extraFee, o.discount, paymentMethodMap[o.paymentMethod] || o.paymentMethod,
        o.payee, itemsDetail
      ];
    });
    
    const totalAmount = sortedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalReceived = sortedOrders.reduce((sum, o) => sum + o.receivedAmount, 0);
    const totalDebt = sortedOrders.reduce((sum, o) => sum + (o.totalAmount - o.receivedAmount), 0);
    const emptyRow = new Array(headers.length).fill('');
    const summaryRow = ['【累计总计】', `共 ${sortedOrders.length} 单`, '', '', '', totalAmount, totalReceived, totalDebt, '', '', '', '', ''];

    downloadCSV(headers, [...rows, emptyRow, summaryRow], `经营报表_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const performImport = (content: string) => {
    if (!content) return;
    try {
        JSON.parse(content); 
        if (confirm('⚠️ 警告：导入数据将完全覆盖当前所有数据！\n\n确定要继续吗？')) {
           try {
             const base64 = btoa(unescape(encodeURIComponent(content)));
             importData(base64);
             alert('✅ 数据恢复成功！');
             setShowPasteModal(false);
             setPasteContent('');
           } catch (err) {
             alert('❌ 导入失败：数据格式不正确');
           }
        }
    } catch (e) {
        alert('❌ 格式错误：这不是有效的数据文本');
    }
  };

  const handleWipeData = () => {
    if (confirm('🔴 危险操作警告 🔴\n\n此操作将永久清空所有数据！\n确定要清空吗？')) {
      const emptyData = { products: [], batches: [], orders: [], repayments: [], customers: [{ id: 'guest', name: '散客', phone: '', totalDebt: 0, isGuest: true }], payees: ['豆建国', '王妮', '关灵恩', '楠楠嫂'], expenses: [], timestamp: Date.now(), type: 'FRUIT_SYNC' };
      const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(emptyData))));
      importData(base64);
      alert('所有数据已清空。');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="px-6 pt-12 pb-6 bg-white shrink-0">
         <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">我的</h1>
                <p className="text-gray-400 font-bold text-sm mt-1">数据管理与设置</p>
            </div>
            {isPersisted && (
                <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-100 animate-in fade-in">
                    <ShieldCheck size={14} className="fill-emerald-600 text-white"/>
                    <span className="text-[10px] font-black">浏览器数据保护中</span>
                </div>
            )}
         </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-4">
           <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <UserCircle2 size={40} />
           </div>
           <div>
              <p className="text-xl font-black text-gray-800">管理员</p>
              <p className="text-xs text-gray-400 font-bold">本地离线模式</p>
           </div>
        </div>

        <div className="space-y-3">
           <p className="px-2 text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Database size={14} /> 数据备份 (防丢失)
           </p>
           <div className="bg-white rounded-[2rem] p-2 shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Download size={20}/></div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">一键复制数据</p>
                       <p className="text-[10px] text-gray-400 font-bold">上次备份: {lastBackup}</p>
                    </div>
                 </div>
                 
                 <div className="flex gap-2">
                     <button 
                        onClick={() => handleExportClick('copy')} 
                        className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-black active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                     >
                        <Copy size={16} /> 
                        {copyStatus === 'success' ? '已复制，请粘贴发送' : '复制全部数据 (推荐)'}
                     </button>
                 </div>
              </div>

              <div className="p-4 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><Upload size={20}/></div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">恢复 / 移入数据</p>
                       <p className="text-[10px] text-gray-400 font-bold">粘贴数据代码即可恢复</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => setShowPasteModal(true)} className="w-9 h-9 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                        <ClipboardPaste size={16} />
                    </button>
                 </div>
              </div>
           </div>
        </div>

        <div className="space-y-3">
           <p className="px-2 text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <FileSpreadsheet size={14} /> 报表导出
           </p>
           <div className="bg-white rounded-[2rem] p-2 shadow-sm border border-gray-100">
              <div className="p-4 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center"><FileSpreadsheet size={20}/></div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">导出经营报表 (Excel)</p>
                       <p className="text-[10px] text-gray-400 font-bold">生成表格用于打印或查看</p>
                    </div>
                 </div>
                 <button onClick={() => handleExportClick('excel')} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black active:scale-95 transition-all">导出</button>
              </div>
           </div>
        </div>

        <div className="space-y-3">
           <p className="px-2 text-xs font-black text-red-300 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert size={14} /> 危险区域
           </p>
           <button onClick={handleWipeData} className="w-full bg-red-50 p-4 rounded-[2rem] flex items-center gap-4 text-red-500 active:bg-red-100 transition-all border border-red-100">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm"><Trash2 size={20}/></div>
              <div className="text-left">
                 <p className="font-black text-sm">清空所有数据</p>
                 <p className="text-[10px] opacity-70 font-bold">不可恢复，慎重操作</p>
              </div>
           </button>
        </div>

        <div className="text-center py-6 space-y-2">
           <p className="text-[10px] text-gray-300 font-bold">Fruit Pro Assistant v3.0.2</p>
        </div>
      </div>

      {/* 微信数据迁移向导 */}
      {showWxTransferModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex flex-col text-white px-6 pt-12 animate-in fade-in">
             <div className="absolute top-4 right-6 animate-bounce">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">去微信对话框</span>
                    <ArrowUpRight size={32} className="stroke-[3px]" />
                </div>
            </div>

            <div className="mt-8 space-y-8">
                <div>
                    <h3 className="text-3xl font-black mb-2 text-emerald-400">数据已复制！</h3>
                    <p className="text-base font-medium opacity-80 leading-relaxed">
                        您的所有经营数据已复制到剪贴板。
                    </p>
                </div>
                
                <div className="space-y-6">
                    {/* 步骤一：跳转浏览器 */}
                    <div className="bg-white/10 p-5 rounded-2xl border border-white/10">
                         <div className="flex justify-between items-center mb-2">
                            <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-xs font-black">下一步</span>
                        </div>
                        <p className="text-sm font-bold">点击右上角 <span className="text-xl mx-1">···</span> 选择“发送给朋友”</p>
                    </div>

                    {/* 步骤二：粘贴恢复 */}
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 opacity-80">
                         <div className="flex justify-between items-center mb-2">
                            <span className="bg-gray-600 text-white px-2 py-0.5 rounded text-xs font-black">最后</span>
                        </div>
                        <p className="text-sm font-bold">在聊天框长按 → 粘贴 → 发送。</p>
                        <p className="text-xs text-gray-400 mt-2">提示：这个长串代码就是您的所有数据。</p>
                    </div>
                </div>

                <div className="pt-4 flex justify-center">
                    <button onClick={() => setShowWxTransferModal(false)} className="text-gray-400 text-sm font-bold underline">我已完成发送</button>
                </div>
            </div>
        </div>
      )}

      {/* 粘贴导入弹窗 */}
      {showPasteModal && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 space-y-4 shadow-2xl flex flex-col">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-gray-800">粘贴恢复数据</h3>
                    <button onClick={() => setShowPasteModal(false)} className="p-1 bg-gray-100 rounded-full"><X size={20}/></button>
                </div>
                <p className="text-xs text-gray-400">请长按下方输入框 → 粘贴：</p>
                <textarea 
                    value={pasteContent}
                    onChange={e => setPasteContent(e.target.value)}
                    className="w-full h-32 bg-gray-50 rounded-xl p-3 text-xs font-mono border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none resize-none"
                    placeholder='在这里粘贴...'
                    autoFocus
                ></textarea>
                <button 
                    onClick={() => performImport(pasteContent)}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-black active:scale-95 transition-all"
                >
                    确认导入
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default MeView;
