
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Customer, Order, OrderStatus, Product, PricingMode, Repayment } from './types';

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

export const getCustomerDebtAge = (customerId: string, orders: Order[]): number => {
  const debtOrders = orders.filter(o => {
    if (o.customerId !== customerId) return false;
    if (o.status !== OrderStatus.ACTIVE) return false;
    const debt = o.totalAmount - o.discount - o.receivedAmount;
    return debt > 0;
  });

  if (debtOrders.length === 0) return 0;

  const earliestDate = debtOrders.reduce((earliest, order) => {
    const orderDate = new Date(order.createdAt).getTime();
    return orderDate < earliest ? orderDate : earliest;
  }, Infinity);

  if (earliestDate === Infinity) return 0;

  const now = new Date().getTime();
  const diffMs = now - earliestDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
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

export const daysBetween = (dateStr: string, refDate?: Date): number => {
    const date = new Date(dateStr);
    const ref = refDate || new Date();
    const diffMs = ref.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export interface CustomerPurchaseStat {
    customerId: string;
    customerName: string;
    totalAmount: number;
    orderCount: number;
    lastOrderDate: string | null;
}

export const getCustomerPurchaseStats = (
    customers: Customer[],
    orders: Order[]
): CustomerPurchaseStat[] => {
    const activeOrders = orders.filter(o => o.status === OrderStatus.ACTIVE);
    const statsMap = new Map<string, CustomerPurchaseStat>();

    customers.forEach(c => {
        if (!c.isGuest && !c.isDeleted) {
            statsMap.set(c.id, {
                customerId: c.id,
                customerName: c.name,
                totalAmount: 0,
                orderCount: 0,
                lastOrderDate: null,
            });
        }
    });

    activeOrders.forEach(order => {
        if (!order.customerId || order.customerId === 'guest') return;
        const stat = statsMap.get(order.customerId);
        if (!stat) return;

        const amount = Math.max(0, order.totalAmount - (order.discount || 0));
        stat.totalAmount = preciseCalc(() => stat.totalAmount + amount);
        stat.orderCount += 1;

        if (!stat.lastOrderDate || new Date(order.createdAt) > new Date(stat.lastOrderDate)) {
            stat.lastOrderDate = order.createdAt;
        }
    });

    return Array.from(statsMap.values());
};

export const getPurchaseRanking = (
    customers: Customer[],
    orders: Order[]
): CustomerPurchaseStat[] => {
    return getCustomerPurchaseStats(customers, orders)
        .filter(s => s.orderCount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount);
};

export interface CustomerDebtStat {
    customerId: string;
    customerName: string;
    totalDebt: number;
    firstDebtDate: string | null;
    debtAgeDays: number;
}

export const getCustomerDebtStats = (
    customers: Customer[],
    orders: Order[],
    repayments: Repayment[]
): CustomerDebtStat[] => {
    const debtCustomers = customers.filter(c => !c.isGuest && !c.isDeleted && c.totalDebt > 0);

    return debtCustomers.map(customer => {
        const customerOrders = orders.filter(
            o => o.customerId === customer.id &&
                o.status === OrderStatus.ACTIVE &&
                (o.totalAmount - (o.discount || 0) - o.receivedAmount) > 0
        );

        let firstDebtDate: string | null = null;
        if (customerOrders.length > 0) {
            const sorted = [...customerOrders].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            firstDebtDate = sorted[0].createdAt;
        }

        return {
            customerId: customer.id,
            customerName: customer.name,
            totalDebt: customer.totalDebt,
            firstDebtDate,
            debtAgeDays: firstDebtDate ? daysBetween(firstDebtDate) : 0,
        };
    }).sort((a, b) => b.totalDebt - a.totalDebt);
};

export interface DormantCustomer {
    customerId: string;
    customerName: string;
    lastOrderDate: string | null;
    dormantDays: number;
}

export const getDormantCustomers = (
    customers: Customer[],
    orders: Order[],
    thresholdDays: number = 30
): DormantCustomer[] => {
    const stats = getCustomerPurchaseStats(customers, orders);
    const now = new Date();

    return stats
        .map(s => {
            const dormantDays = s.lastOrderDate ? daysBetween(s.lastOrderDate, now) : 9999;
            return {
                customerId: s.customerId,
                customerName: s.customerName,
                lastOrderDate: s.lastOrderDate,
                dormantDays,
            };
        })
        .filter(c => c.dormantDays >= thresholdDays)
        .sort((a, b) => b.dormantDays - a.dormantDays);
};

export type DebtRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DebtRiskInfo {
    level: DebtRiskLevel;
    label: string;
    color: string;
    bg: string;
}

export const DEBT_RISK_CONFIG: Record<DebtRiskLevel, DebtRiskInfo> = {
    LOW: { level: 'LOW', label: '低风险', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    MEDIUM: { level: 'MEDIUM', label: '中风险', color: 'text-orange-600', bg: 'bg-orange-100' },
    HIGH: { level: 'HIGH', label: '高风险', color: 'text-red-600', bg: 'bg-red-100' },
    CRITICAL: { level: 'CRITICAL', label: '极高风险', color: 'text-red-700', bg: 'bg-red-200' },
};

export const getDebtRiskLevel = (debtAgeDays: number): DebtRiskInfo => {
    if (debtAgeDays > 30) return DEBT_RISK_CONFIG.CRITICAL;
    if (debtAgeDays > 15) return DEBT_RISK_CONFIG.HIGH;
    if (debtAgeDays >= 7) return DEBT_RISK_CONFIG.MEDIUM;
    return DEBT_RISK_CONFIG.LOW;
};

export interface DebtRiskSummary {
    totalCount: number;
    totalAmount: number;
    byLevel: Record<DebtRiskLevel, { count: number; amount: number }>;
}

export const getDebtRiskSummary = (
    debtStats: CustomerDebtStat[]
): DebtRiskSummary => {
    const summary: DebtRiskSummary = {
        totalCount: debtStats.length,
        totalAmount: debtStats.reduce((sum, s) => sum + s.totalDebt, 0),
        byLevel: {
            LOW: { count: 0, amount: 0 },
            MEDIUM: { count: 0, amount: 0 },
            HIGH: { count: 0, amount: 0 },
            CRITICAL: { count: 0, amount: 0 },
        },
    };

    debtStats.forEach(stat => {
        const risk = getDebtRiskLevel(stat.debtAgeDays);
        summary.byLevel[risk.level].count += 1;
        summary.byLevel[risk.level].amount = preciseCalc(
            () => summary.byLevel[risk.level].amount + stat.totalDebt
        );
    });

    return summary;
};

export interface ProductSalesStat {
    productId: string;
    productName: string;
    totalQty: number;
    totalWeight: number;
    dailyAvgQty: number;
    dailyAvgWeight: number;
    days: number;
}

export const getProductSalesStats = (
    products: Product[],
    orders: Order[],
    days: number = 7
): ProductSalesStat[] => {
    const now = new Date();
    const cutoffTime = now.getTime() - days * 24 * 60 * 60 * 1000;

    const relevantOrders = orders.filter(
        o => o.status === OrderStatus.ACTIVE && new Date(o.createdAt).getTime() >= cutoffTime
    );

    const statsMap = new Map<string, ProductSalesStat>();

    products.forEach(p => {
        statsMap.set(p.id, {
            productId: p.id,
            productName: p.name,
            totalQty: 0,
            totalWeight: 0,
            dailyAvgQty: 0,
            dailyAvgWeight: 0,
            days,
        });
    });

    relevantOrders.forEach(order => {
        order.items.forEach(item => {
            const stat = statsMap.get(item.productId);
            if (!stat) return;
            stat.totalQty += item.qty || 0;
            stat.totalWeight += item.netWeight || 0;
        });
    });

    statsMap.forEach(stat => {
        stat.dailyAvgQty = preciseCalc(() => stat.totalQty / days);
        stat.dailyAvgWeight = preciseCalc(() => stat.totalWeight / days);
    });

    return Array.from(statsMap.values());
};

export interface LowStockProduct {
    productId: string;
    productName: string;
    pricingMode: PricingMode;
    currentStock: number;
    threshold: number;
    gap: number;
    unit: string;
}

export const getLowStockProducts = (products: Product[]): LowStockProduct[] => {
    return products
        .map(p => {
            const threshold = p.lowStockThreshold || 0;
            const isWeight = p.pricingMode === PricingMode.WEIGHT;
            const currentStock = isWeight ? p.stockWeight : p.stockQty;
            const gap = Math.max(0, threshold - currentStock);

            return {
                productId: p.id,
                productName: p.name,
                pricingMode: p.pricingMode,
                currentStock,
                threshold,
                gap,
                unit: isWeight ? '斤' : '件',
            };
        })
        .filter(p => p.currentStock < p.threshold)
        .sort((a, b) => b.gap - a.gap);
};

export interface SellOutForecast {
    productId: string;
    productName: string;
    pricingMode: PricingMode;
    currentStock: number;
    dailyAvg: number;
    sellOutDays: number | null;
    unit: string;
    level: 'URGENT' | 'WARNING' | 'SAFE' | 'NO_DATA';
}

export const getSellOutForecast = (
    products: Product[],
    orders: Order[],
    days: number = 7
): SellOutForecast[] => {
    const salesStats = getProductSalesStats(products, orders, days);
    const salesMap = new Map(salesStats.map(s => [s.productId, s]));

    return products.map(p => {
        const isWeight = p.pricingMode === PricingMode.WEIGHT;
        const currentStock = isWeight ? p.stockWeight : p.stockQty;
        const sales = salesMap.get(p.id);
        const dailyAvg = isWeight ? (sales?.dailyAvgWeight || 0) : (sales?.dailyAvgQty || 0);
        const hasSales = sales && (isWeight ? sales.totalWeight > 0 : sales.totalQty > 0);

        let sellOutDays: number | null = null;
        let level: SellOutForecast['level'] = 'NO_DATA';

        if (hasSales && dailyAvg > 0) {
            sellOutDays = Math.floor(currentStock / dailyAvg);
            if (sellOutDays < 3) {
                level = 'URGENT';
            } else if (sellOutDays < 7) {
                level = 'WARNING';
            } else {
                level = 'SAFE';
            }
        }

        return {
            productId: p.id,
            productName: p.name,
            pricingMode: p.pricingMode,
            currentStock,
            dailyAvg,
            sellOutDays,
            unit: isWeight ? '斤' : '件',
            level,
        };
    }).sort((a, b) => {
        const order = { URGENT: 0, WARNING: 1, SAFE: 2, NO_DATA: 3 };
        if (a.level !== b.level) return order[a.level] - order[b.level];
        return (a.sellOutDays ?? 9999) - (b.sellOutDays ?? 9999);
    });
};

export interface UnsellableProduct {
    productId: string;
    productName: string;
    pricingMode: PricingMode;
    currentStock: number;
    unit: string;
    lastSaleDate: string | null;
    unsoldDays: number;
}

export const getUnsellableProducts = (
    products: Product[],
    orders: Order[],
    days: number = 30
): UnsellableProduct[] => {
    const now = new Date();
    const cutoffTime = now.getTime() - days * 24 * 60 * 60 * 1000;

    const lastSaleMap = new Map<string, string>();
    orders
        .filter(o => o.status === OrderStatus.ACTIVE)
        .forEach(order => {
            const orderTime = new Date(order.createdAt).getTime();
            order.items.forEach(item => {
                const existing = lastSaleMap.get(item.productId);
                if (!existing || orderTime > new Date(existing).getTime()) {
                    lastSaleMap.set(item.productId, order.createdAt);
                }
            });
        });

    return products
        .map(p => {
            const isWeight = p.pricingMode === PricingMode.WEIGHT;
            const currentStock = isWeight ? p.stockWeight : p.stockQty;
            const lastSaleDate = lastSaleMap.get(p.id) || null;
            let unsoldDays = 0;

            if (lastSaleDate) {
                unsoldDays = daysBetween(lastSaleDate, now);
            } else {
                unsoldDays = 9999;
            }

            return {
                productId: p.id,
                productName: p.name,
                pricingMode: p.pricingMode,
                currentStock,
                unit: isWeight ? '斤' : '件',
                lastSaleDate,
                unsoldDays,
            };
        })
        .filter(p => p.unsoldDays >= days && p.currentStock > 0)
        .sort((a, b) => b.unsoldDays - a.unsoldDays);
};
