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
  const [syncCode, setSyncCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastBackup, setLastBackup] = useState<string>(localStorage.getItem('LAST_BACKUP_TIME') || '从未备份');

  const updateBackupTime = () => {
    const now = new Date().toLocaleString();
    localStorage.setItem('LAST_BACKUP_TIME', now);
    setLastBackup(now);
  };

  const handleExportFile = () => {
    const date = new Date().toISOString().split('T')[0];
    downloadJSON(data, `水果助手备份_${date}.json`);
    updateBackupTime();
  };

  const handleExportExcel = () => {
    if (data.orders.length === 0) return alert('暂无订单数据可导出');
    
    // 定义更详细的表头
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

    const rows = data.orders.map(o => {
      // 获取客户类型
      const customer = data.customers.find(c => c.id === o.customerId);
      const custType = customer ? (customer.isGuest ? '散客' : '长期客户') : '未知';
      
      // 计算本单欠款 (解决浮点数精度问题)
      const debt = preciseCalc(() => o.totalAmount - o.receivedAmount);

      // 格式化商品详情字符串
      // 这里的 productName 在开单时已经包含了 "(车牌号)"，所以直接利用即可
      // 格式示例: [豫A1234]大果: 50件(1200斤) ¥2000 | ...
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
    
    console.log('触发详细报表导出...');
    const filename = `水果销售累计总表_截至${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(headers, rows, filename);
    updateBackupTime();
    alert(`✅ 成功导出 ${rows.length} 条历史订单！\n\n文件包含从开始使用至今的【所有累计数据】。\n\n包含：订单时间、客户欠款、车次归属及商品规格详情。`);
  };

  const handleCopySyncCode = () => {
    const code = exportData();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    updateBackupTime();
  };

  const handleImport = () => {
    if (!syncCode.trim()) return alert('请先粘贴同步码');
    if (confirm('⚠️ 警告：导入操作将覆盖当前手机上的所有数据！此过程不可逆，是否继续？')) {
      importData(syncCode);
      alert('数据同步成功！正在刷新应用...');
      window.location.reload();
    }
  };

  const isSafe = lastBackup !== '从未备份' && (Date.now() - new Date(lastBackup).getTime()) < 3 * 24 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-32 overflow-y-auto no-scrollbar">
      {/* 顶部个人资料区域 */}
      <header className="bg-white p-6 pt-16 border-b">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-18 h-18 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-emerald-100">
              店
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">店小二 (管理员)</h1>
            <div className="flex items-center gap-2">
              {!isSafe ? (
                <div className="bg-red-50 text-red-500 text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1 border border-red-100 animate-pulse">
                  <AlertTriangle size={12} /> 建议备份
                </div>
              ) : (
                <div className="bg-emerald-50 text-emerald-600 text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1 border border-emerald-100">
                  <ShieldCheck size={12} /> 数据已加密保护
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 最后备份监控卡片 - 仿截图 */}
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between transition-all active:bg-gray-50">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isSafe ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'}`}>
              <History size={24} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5">最后同步/备份</p>
              <p className={`text-sm font-black ${!isSafe ? 'text-red-500' : 'text-gray-800'}`}>{lastBackup}</p>
            </div>
          </div>
          {!isSafe && <ShieldAlert className="text-red-500 animate-bounce" size={24} />}
        </div>

        {/* 报表导出模块 */}
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-gray-100">
          <div className="p-5 bg-gray-50/50 border-b font-black text-sm flex items-center gap-2 text-gray-700">
            <FileSpreadsheet size={18} className="text-emerald-500" />
            自动化报表导出
          </div>
          <div className="p-4">
            <button 
              onClick={handleExportExcel}
              className="w-full flex items-center justify-between p-5 bg-emerald-50/50 rounded-2xl active:scale-[0.98] transition-all border border-emerald-100 group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg shadow-emerald-200 group-active:scale-95 transition-transform">
                  <FileSpreadsheet size={24} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-emerald-900">导出 Excel 累计总报表</p>
                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5 tracking-tight">包含自开始使用以来的【所有历史数据】</p>
                </div>
              </div>
              <ChevronRight className="text-emerald-200" size={20} />
            </button>
          </div>
        </div>

        {/* 云端同步模块 */}
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-gray-100">
          <div className="p-5 bg-gray-50/50 border-b font-black text-sm flex items-center gap-2 text-gray-700">
            <Database size={18} className="text-blue-500" />
            免服务器云端同步
          </div>
          <div className="p-5 space-y-5">
            <button 
              onClick={handleCopySyncCode}
              className="w-full flex items-center justify-between p-5 bg-blue-50/50 rounded-2xl active:scale-[0.98] transition-all border border-blue-100 group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-500 text-white p-3 rounded-2xl shadow-lg shadow-blue-200 group-active:scale-95 transition-transform">
                  <Share2 size={24} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-blue-900">{copied ? '✅ 同步码已复制' : '复制云端同步码'}</p>
                  <p className="text-[10px] text-blue-600 font-bold mt-0.5 tracking-tight">发送到微信，另一台手机粘贴即可</p>
                </div>
              </div>
              <Copy size={16} className="text-blue-200" />
            </button>

            <div className="pt-2 space-y-3">
               <textarea 
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value)}
                placeholder="在此粘贴另一台设备的同步码以恢复数据..."
                className="w-full h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 text-[10px] font-mono focus:border-blue-300 outline-none transition-all"
              />
              <button 
                onClick={handleImport}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl text-xs font-black shadow-xl active:scale-95 transition-transform"
              >
                从粘贴板恢复数据
              </button>
            </div>
          </div>
        </div>

        {/* 其他操作 */}
        <div className="flex flex-col items-center gap-4 py-8">
           <button 
            onClick={handleExportFile}
            className="flex items-center gap-2 text-gray-400 py-2 px-6 rounded-full border border-gray-200 text-[10px] font-black active:bg-gray-100"
          >
            <Download size={14} />
            下载数据库备份 (.json)
          </button>
          
          <div className="flex flex-col items-center opacity-30">
            <Info size={16} />
            <p className="text-[8px] font-bold mt-1 tracking-widest uppercase">Fruit Wholesale Pro v3.0.5</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeView;