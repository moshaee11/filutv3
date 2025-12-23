
export const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount);
};

export const preciseCalc = (expression: () => number): number => {
  const result = expression();
  return Math.round(result * 100) / 100;
};

export const generateOrderNo = () => {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
                 (now.getMonth() + 1).toString().padStart(2, '0') + 
                 now.getDate().toString().padStart(2, '0');
  const timeStr = now.getHours().toString().padStart(2, '0') + 
                 now.getMinutes().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${dateStr}${timeStr}${random}`;
};

export const downloadJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadCSV = (headers: string[], rows: any[][], filename: string) => {
  const BOM = '\uFEFF';
  const csvContent = [headers, ...rows].map(row => 
    row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};
