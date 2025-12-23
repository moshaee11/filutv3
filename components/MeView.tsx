
import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { 
  Database, Download, Upload, Trash2, ShieldCheck, 
  Info, Share2, Copy, CheckCircle2, AlertTriangle, FileSpreadsheet,
  History, ShieldAlert, ChevronRight, UserCircle2, ExternalLink
} from 'lucide-react';
import { downloadJSON, downloadCSV, preciseCalc } from '../utils';

const MeView: React.FC = () => {
  const { data, exportData, importData } = useApp();
  const [lastBackup, setLastBackup] = useState<string>(localStorage.getItem('LAST_BACKUP_TIME') || '从未备份');

  const updateBackupTime = () => {
    const now = new Date().toLocaleString();
    localStorage.setItem('LAST_BACKUP_TIME', now);
    setLastBackup(now);
  };

  const handleExportFile = () => {
    const backupData = { ...data, timestamp: Date.now(), type: 'FRUIT_SYNC' };
    const date = new Date().toISOString().split('T')[0];
    downloadJSON(backupData, `水果助手备份_${date}.json`);
    updateBackupTime();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (confirm('⚠️ 警告：导入数据将完全覆盖当前所有数据！\n\n建议在导入前先导出备份当前数据。\n确定要继续吗？')) {
           try {
             const base64 = btoa(unescape(encodeURIComponent(content)));
             importData(base64);
             alert('数据恢复成功！');
           } catch (err) {
             alert('导入失败：文件格式不正确');
           }
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportExcel = () => {
    if (data.orders.length === 0) return alert('暂无订单数据可导出');
    
    // 定义表头
    const headers = [
        '销售日期', 
        '销售时间', 
        '系统单号', 
        '客户名称', 
        '客户类型', 
        '应收总额(元)', 
        '实收金额(元)', 
        '本单欠款(元)', 
        '额外杂费', 
        '折扣优惠', 
        '支付方式', 
        '收款人', 
        '货品详情 (车次-品名-规格-小计)'
    ];

    // 1. 强制按时间倒序排列 (最新的在最前)，确保报表逻辑清晰
    const sortedOrders = [...data.orders].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 2. 映射数据行
    const rows = sortedOrders.map(o => {
      // 获取客户类型
      const customer = data.customers.find(c => c.id === o.customerId);
      const custType = customer ? (customer.isGuest ? '散客' : '长期客户') : '未知';
      
      // 计算本单欠款 (解决浮点数精度问题)
      const debt = preciseCalc(() => o.totalAmount - o.receivedAmount);

      // 格式化商品详情字符串
      const itemsDetail = o.items.map(i => {
          const weightInfo = i.netWeight > 0 ? `/${i.netWeight}斤` : '';
          return `${i.productName}【${i.qty}件${weightInfo}】¥${i.subtotal}`;
      }).join('  |  ');

      // 格式化时间
      const dateObj = new Date(o.createdAt);
      const dateStr = dateObj.toLocaleDateString();
      const timeStr = dateObj.toLocaleTimeString();

      // 翻译支付方式
      const paymentMethodMap: Record<string, string> = {
          'WECHAT': '微信支付',
          'ALIPAY': '支付宝',
          'CASH': '现金',
          'OTHER': '其他'
      };

      return [
        dateStr,
        timeStr,
        o.orderNo,
        o.customerName,
        custType,
        o.totalAmount,
        o.receivedAmount,
        debt,
        o.extraFee,
        o.discount,
        paymentMethodMap[o.paymentMethod] || o.paymentMethod,
        o.payee,
        itemsDetail
      ];
    });
    
    // 3. 计算累计总数据 (用于底部汇总)
    const totalAmount = sortedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalReceived = sortedOrders.reduce((sum, o) => sum + o.receivedAmount, 0);
    const totalDebt = sortedOrders.reduce((sum, o) => sum + (o.totalAmount - o.receivedAmount), 0);
    
    // 4. 构建汇总行
    const emptyRow = new Array(headers.length).fill('');
    const summaryRow = [
        '【累计总计】', 
        `共 ${sortedOrders.length} 单`,
        '',
        '',
        '',
        totalAmount,
        totalReceived,
        totalDebt,
        '',
        '',
        '',
        '',
        ''
    ];

    downloadCSV(headers, [...rows, emptyRow, summaryRow], `经营报表_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleWipeData = () => {
    if (confirm('🔴 危险操作警告 🔴\n\n此操作将永久清空所有数据（商品、订单、客户等）且无法恢复！\n\n请再次确认：您确定要清空所有数据吗？')) {
      const emptyData = {
        products: [],
        batches: [],
        orders: [],
        repayments: [],
        customers: [{ id: 'guest', name: '散客', phone: '', totalDebt: 0, isGuest: true }],
        payees: ['豆建国', '王妮', '关灵恩', '楠楠嫂'],
        expenses: [],
        timestamp: Date.now(),
        type: 'FRUIT_SYNC'
      };
      const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(emptyData))));
      importData(base64);
      alert('所有数据已清空，应用已重置。');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="px-6 pt-12 pb-6 bg-white shrink-0">
         <h1 className="text-3xl font-black text-gray-900 tracking-tight">我的</h1>
         <p className="text-gray-400 font-bold text-sm mt-1">数据管理与设置</p>
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
              <Database size={14} /> 数据安全
           </p>
           <div className="bg-white rounded-[2rem] p-2 shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Download size={20}/></div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">备份数据 (JSON)</p>
                       <p className="text-[10px] text-gray-400 font-bold">上次备份: {lastBackup}</p>
                    </div>
                 </div>
                 <button onClick={handleExportFile} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black active:scale-95 transition-all">下载</button>
              </div>
              <div className="p-4 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><Upload size={20}/></div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">恢复数据</p>
                       <p className="text-[10px] text-gray-400 font-bold">导入JSON备份文件覆盖当前</p>
                    </div>
                 </div>
                 <button onClick={handleImport} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-black active:scale-95 transition-all">导入</button>
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
                       <p className="font-black text-gray-800 text-sm">导出经营报表 (Excel/CSV)</p>
                       <p className="text-[10px] text-gray-400 font-bold">包含所有销售明细与统计</p>
                    </div>
                 </div>
                 <button onClick={handleExportExcel} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black active:scale-95 transition-all">导出</button>
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
           <p className="text-[10px] text-gray-300 font-bold">Fruit Pro Assistant v3.0.0</p>
           <div className="flex justify-center gap-4 text-gray-300">
             <ShieldCheck size={16} />
             <span className="text-[10px] font-bold">本地存储 · 安全私密 · 无需联网</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MeView;
