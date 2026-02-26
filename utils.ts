
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

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

// Helper to share file on mobile or download on web
const shareFile = async (filename: string, base64Data: string, mimeType: string) => {
    if (Capacitor.isNativePlatform()) {
        try {
            // 1. Write file to cache directory
            const result = await Filesystem.writeFile({
                path: filename,
                data: base64Data,
                directory: Directory.Cache,
                // encoding: Encoding.UTF8 // Do not specify encoding for base64 data if it's binary, but for text it's fine. 
                // However, Filesystem.writeFile expects data to be base64 string if no encoding is provided? 
                // Actually for text files, we can pass string directly if encoding is UTF8.
                // But to be safe for all types, let's assume base64Data is indeed base64.
            });

            // 2. Share the file
            await Share.share({
                title: '分享文件',
                text: `请查收文件：${filename}`,
                url: result.uri,
                dialogTitle: '分享到微信/文件传输助手',
            });
        } catch (e) {
            console.error('Share failed', e);
            alert('分享失败，请检查权限或重试');
        }
    } else {
        // Web Fallback
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

export const downloadJSON = async (data: any, filename: string) => {
  const jsonStr = JSON.stringify(data, null, 2);
  // Convert to Base64
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
  await shareFile(filename, base64, 'application/json');
};

export const downloadCSV = async (headers: string[], rows: any[][], filename: string) => {
  const BOM = '\uFEFF';
  const csvContent = [headers, ...rows].map(row => 
    row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  const fullContent = BOM + csvContent;
  const base64 = btoa(unescape(encodeURIComponent(fullContent)));
  
  await shareFile(filename, base64, 'text/csv;charset=utf-8;');
};

export const downloadBase64File = async (filename: string, base64Data: string, mimeType: string) => {
    await shareFile(filename, base64Data, mimeType);
};
