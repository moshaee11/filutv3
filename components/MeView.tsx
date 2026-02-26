
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../store';
import { 
  Database, Download, Upload, Trash2, 
  CheckCircle2, FileSpreadsheet,
  ShieldAlert, UserCircle2, X, ClipboardPaste, ArrowUpRight, Copy, ShieldCheck,
  FileJson, FileUp, FileDown, ExternalLink
} from 'lucide-react';
import { downloadJSON, downloadBase64File, preciseCalc } from '../utils';
import * as XLSX from 'xlsx';

const MeView: React.FC = () => {
  const { data, exportData, importData } = useApp();
  const [lastBackup, setLastBackup] = useState<string>(localStorage.getItem('LAST_BACKUP_TIME') || '从未备份');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [isPersisted, setIsPersisted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化：申请持久化存储权限 (防止浏览器自动清理数据)
  useEffect(() => {
    const initPersistence = async () => {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persisted();
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

  const updateBackupTime = () => {
    const now = new Date().toLocaleString();
    localStorage.setItem('LAST_BACKUP_TIME', now);
    setLastBackup(now);
  };

  const handleCopyDataToClipboard = async () => {
    const backupData = { ...data, timestamp: Date.now(), type: 'FRUIT_SYNC' };
    const jsonStr = JSON.stringify(backupData);
    
    try {
        await navigator.clipboard.writeText(jsonStr);
        updateBackupTime();
        alert('✅ 数据已复制到剪贴板！');
    } catch (err) {
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
            updateBackupTime();
            alert('✅ 数据已复制到剪贴板！');
        } catch (e) {
            alert('复制失败，请手动长按复制数据');
        }
    }
  };

  const handleExportClick = async (type: 'excel' | 'copy' | 'file') => {
    if (type === 'copy') {
        handleCopyDataToClipboard();
        return;
    }

    if (type === 'excel') {
        performAdvancedExcelExport();
    }

    if (type === 'file') {
        const backupData = { ...data, timestamp: Date.now(), type: 'FRUIT_SYNC' };
        const filename = `FruitPro_Backup_${new Date().toISOString().split('T')[0]}.json`;
        await downloadJSON(backupData, filename);
        updateBackupTime();
    }
  };

  const handleFileImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const content = ev.target?.result as string;
        performImport(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- 高级 Excel 导出 (仿照截图格式: 左侧明细，右侧透视) ---
  const performAdvancedExcelExport = async () => {
    if (data.orders.length === 0) return alert('暂无订单数据可导出');

    // 1. 准备左侧原始数据 (Raw Data)
    // 格式: 日期 | 类别 | 数量(件) | 重量(斤) | 单价(元) | 金额 | 支付方式 | 备注
    const rawDataRows: any[][] = [['日期', '类别', '数量(件)', '重量(斤)', '单价(元)', '金额', '支付方式', '备注']];
    
    // 按时间正序排列
    const sortedOrders = [...data.orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sortedOrders.forEach(o => {
        const dateObj = new Date(o.createdAt);
        const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2,'0')}.${dateObj.getDate().toString().padStart(2,'0')}`;
        const payMap: Record<string, string> = { 'WECHAT': '微信', 'ALIPAY': '支付宝', 'CASH': '现金', 'OTHER': '欠款' };
        
        o.items.forEach(item => {
            rawDataRows.push([
                dateStr,
                item.productName.split(' ')[0], // 简化品名，如 "大果"
                item.qty,
                item.netWeight > 0 ? item.netWeight : '-',
                item.unitPrice,
                item.subtotal,
                payMap[o.paymentMethod] || '其他',
                o.note || (o.paymentMethod === 'OTHER' ? `${o.customerName}欠` : '')
            ]);
        });
    });

    // 2. 准备右侧透视数据 (Pivot Data)
    // 格式: 日期 | 类别 | 求和项:数量 | 求和项:金额
    const pivotRows: any[][] = [['日期', '类别', '求和项:数量(件)', '求和项:金额']];
    
    // 分组聚合
    type DaySummary = {
        dateStr: string;
        products: Record<string, { qty: number, amount: number }>;
        totalQty: number;
        totalAmount: number;
    };
    const summaryMap = new Map<string, DaySummary>();

    sortedOrders.forEach(o => {
        const dateObj = new Date(o.createdAt);
        const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2,'0')}.${dateObj.getDate().toString().padStart(2,'0')}`;
        
        if (!summaryMap.has(dateStr)) {
            summaryMap.set(dateStr, { dateStr, products: {}, totalQty: 0, totalAmount: 0 });
        }
        const daySummary = summaryMap.get(dateStr)!;

        o.items.forEach(item => {
            const cat = item.productName.split(' ')[0]; 
            if (!daySummary.products[cat]) {
                daySummary.products[cat] = { qty: 0, amount: 0 };
            }
            daySummary.products[cat].qty += item.qty;
            daySummary.products[cat].amount += item.subtotal;
            
            daySummary.totalQty += item.qty;
            daySummary.totalAmount += item.subtotal;
        });
    });

    let grandTotalQty = 0;
    let grandTotalAmount = 0;

    Array.from(summaryMap.values()).forEach(day => {
        let isFirstRow = true;
        Object.entries(day.products).forEach(([cat, val]) => {
            pivotRows.push([
                isFirstRow ? day.dateStr : '', 
                cat,
                val.qty,
                val.amount
            ]);
            isFirstRow = false;
        });
        // 每日合计
        pivotRows.push(['', '合计', day.totalQty, day.totalAmount]);
        grandTotalQty += day.totalQty;
        grandTotalAmount += day.totalAmount;
    });
    // 总计
    pivotRows.push(['总计', '', grandTotalQty, grandTotalAmount]);

    // 3. 合并数据
    const finalData: any[][] = [];
    const maxRows = Math.max(rawDataRows.length, pivotRows.length);

    for (let i = 0; i < maxRows; i++) {
        const left = rawDataRows[i] || Array(8).fill('');
        const gap = ['']; // 空列 I
        const right = pivotRows[i] || Array(4).fill('');
        finalData.push([...left, ...gap, ...right]);
    }

    // 4. 生成文件
    try {
        // Use downloadCSV for Excel export as well for now, or convert to CSV
        // Since we are using XLSX library, we can generate XLSX file.
        // But to share it via Capacitor, we need to write it to filesystem.
        // XLSX.writeFile tries to download in browser.
        // We need to get the binary data and use shareFile.
        
        const ws = XLSX.utils.aoa_to_sheet(finalData);
        // 设置大致列宽
        ws['!cols'] = [
            { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, // A-H
            { wch: 2 }, // I (Empty)
            { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 } // J-M
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "经营报表");
        
        // Generate base64 string
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        
        await downloadBase64File(`经营报表_${new Date().toISOString().split('T')[0]}.xlsx`, wbout, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    } catch (e) {
        console.error(e);
        alert('导出失败: Excel 组件加载错误。请确保网络连接正常。');
    }
  };

  const performImport = (content: string) => {
    if (!content) return;
    
    // 安全检查预解析
    try {
        const testParse = JSON.parse(content);
        if (!testParse || typeof testParse !== 'object') {
             throw new Error("Invalid JSON");
        }
    } catch (e) {
         alert('❌ 格式错误：这不是有效的数据文件。\n\n如果是从微信复制的，很可能是因为字数太长被截断了。\n\n✅ 强烈建议：请让对方使用【导出备份文件】功能，发送 .json 文件给您。');
         return;
    }

    if (confirm('⚠️ 警告：导入数据将覆盖当前所有数据！\n\n确定要继续吗？')) {
       try {
         // 转为 Base64 模拟旧接口格式
         const base64 = btoa(unescape(encodeURIComponent(content)));
         importData(base64);
         
         // 成功后关闭弹窗
         alert('✅ 数据恢复成功！');
         setShowPasteModal(false);
         setPasteContent('');
       } catch (err: any) {
         alert('❌ 导入被拒绝：' + (err.message || '数据格式严重错误'));
       }
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
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />

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
           <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 overflow-hidden space-y-6">
              
              {/* Export Section */}
              <div className="space-y-3">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Download size={20}/></div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">备份 / 导出</p>
                       <p className="text-[10px] text-gray-400 font-bold">上次备份: {lastBackup}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                     <button 
                        onClick={() => handleExportClick('copy')} 
                        className="py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-blue-100"
                     >
                        <Copy size={16} /> 复制文本
                     </button>
                     <button 
                        onClick={() => handleExportClick('file')} 
                        className="py-3 bg-gray-900 text-white rounded-xl text-xs font-black active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-gray-200"
                     >
                        <FileDown size={16} /> 导出备份文件
                     </button>
                 </div>
              </div>
              
              <div className="h-px bg-gray-100 w-full"></div>

              {/* Import Section */}
              <div className="space-y-3">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><Upload size={20}/></div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">恢复 / 导入</p>
                       <p className="text-[10px] text-gray-400 font-bold">请优先使用文件恢复</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setShowPasteModal(true)} 
                        className="py-3 bg-orange-50 text-orange-500 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-orange-100"
                    >
                        <ClipboardPaste size={16} /> 粘贴文本
                    </button>
                    <button 
                        onClick={handleFileImportClick}
                        className="py-3 bg-emerald-500 text-white rounded-xl text-xs font-black active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200"
                    >
                        <FileUp size={16} /> 选择文件恢复
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
                       <p className="text-[10px] text-gray-400 font-bold">左侧明细 | 右侧统计</p>
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
           <p className="text-[10px] text-gray-300 font-bold">Fruit Pro Assistant v3.0.7</p>
        </div>
      </div>

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
                <p className="text-[10px] text-red-400 text-center font-bold">如果提示“格式错误”，请改用文件导入</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default MeView;
