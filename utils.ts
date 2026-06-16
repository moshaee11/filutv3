
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Order, Repayment, PaymentMethod, OrderStatus } from './types';

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

// ========== 统一支付渠道拆分 ==========
// 只要有 mixedPayments 就按拆分走；否则整笔算到 paymentMethod
export type MethodAmount = { method: PaymentMethod, amount: number };

export const breakdownOrderByMethod = (o: Order): MethodAmount[] => {
  if (o.mixedPayments && o.mixedPayments.length > 0) {
    return o.mixedPayments.map(m => ({ method: m.method, amount: m.amount }));
  }
  if (o.receivedAmount <= 0) return [];
  return [{ method: o.paymentMethod, amount: o.receivedAmount }];
};

export const breakdownRepaymentByMethod = (r: Repayment): MethodAmount[] => {
  if (r.mixedPayments && r.mixedPayments.length > 0) {
    return r.mixedPayments.map(m => ({ method: m.method, amount: m.amount }));
  }
  if (r.amount <= 0) return [];
  return [{ method: r.paymentMethod || PaymentMethod.OTHER, amount: r.amount }];
};

// ========== 实时计算客户欠款（不依赖累计字段） ==========
// 逻辑：客户所有 ACTIVE 订单的应收 - 已收 - 优惠 = 每笔订单欠款；然后减去所有还款
export const computeCustomerDebt = (
  customerId: string,
  orders: Order[],
  repayments: Repayment[]
): number => {
  if (customerId === 'guest') return 0;
  const orderDebt = orders
    .filter(o => o.customerId === customerId && o.status === OrderStatus.ACTIVE)
    .reduce((sum, o) => {
      const debt = preciseCalc(() => o.totalAmount - o.discount - o.receivedAmount);
      return sum + Math.max(0, debt);
    }, 0);

  const repaymentSum = repayments
    .filter(r => r.customerId === customerId)
    .reduce((sum, r) => sum + r.amount, 0);

  return preciseCalc(() => Math.max(0, orderDebt - repaymentSum));
};

// ========== 计算客户所有欠款订单明细 ==========
export type DebtOrderItem = {
  orderId: string;
  orderNo: string;
  createdAt: string;
  totalAmount: number;
  receivedAmount: number;
  discount: number;
  debt: number;
  items: string; // 摘要：苹果 x2, 西瓜 x1
};

export const getCustomerDebtOrders = (
  customerId: string,
  orders: Order[]
): DebtOrderItem[] => {
  return orders
    .filter(o => o.customerId === customerId && o.status === OrderStatus.ACTIVE)
    .map(o => {
      const debt = preciseCalc(() =>
        Math.max(0, o.totalAmount - o.discount - o.receivedAmount)
      );
      if (debt <= 0) return null;
      return {
        orderId: o.id,
        orderNo: o.orderNo,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        receivedAmount: o.receivedAmount,
        discount: o.discount,
        debt,
        items: o.items.map(i => `${i.productName}x${i.qty}`).join(', '),
      };
    })
    .filter((x): x is DebtOrderItem => x !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// ========== 客户成交价缓存（避免每次全扫 orders） ==========
// 缓存键：customerId + productId → 最近一次 unitPrice / netWeight
type PriceCacheKey = string;
type PriceCacheValue = {
  unitPrice?: number;   // 按件计价的单价
  netWeight?: number;   // 按斤计价的净重（实际意义是：每斤多少钱看 unitPrice）
  createdAt: string;
};

const _lastPriceCache: Map<PriceCacheKey, PriceCacheValue> = new Map();
let _lastPriceCacheOrdersLength = -1; // 订单数量变了就失效缓存

export const getLastPriceForProduct = (
  customerId: string,
  productName: string,
  orders: Order[]
): number | null => {
  if (!customerId || customerId === 'guest' || !productName) return null;
  if (orders.length === 0) return null;

  // 订单数量不变 → 使用缓存
  if (_lastPriceCacheOrdersLength === orders.length) {
    const cached = _lastPriceCache.get(`${customerId}::${productName}`);
    if (cached) return cached.unitPrice || null;
  }

  // 重建缓存（一次遍历，分摊复杂度 O(N)）
  _lastPriceCache.clear();
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (o.customerId !== customerId) continue;
    if (o.status !== OrderStatus.ACTIVE) continue;
    for (const item of o.items) {
      const key = `${o.customerId}::${item.productName}`;
      const existing = _lastPriceCache.get(key);
      if (!existing || new Date(o.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        _lastPriceCache.set(key, {
          unitPrice: item.unitPrice,
          createdAt: o.createdAt,
        });
      }
    }
  }
  _lastPriceCacheOrdersLength = orders.length;

  const cached = _lastPriceCache.get(`${customerId}::${productName}`);
  return cached ? (cached.unitPrice || null) : null;
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
