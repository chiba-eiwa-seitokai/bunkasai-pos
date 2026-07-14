import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import pkg from '../package.json';
import GAS_SCRIPT from '../gas/Code.gs?raw';
const APP_VERSION = pkg.version;
import { 
  ShoppingCart, Settings, RefreshCw, CheckCircle, BarChart3, 
  X, Edit3, Trash2, ChevronRight, Calculator, Wifi, 
  User, CloudOff, Minus, Plus, Download, LayoutGrid, 
  RotateCcw, HelpCircle, Copy, Link2, Check, Cloud, 
  CloudLightning, Inbox, Loader2, Users, Clock, Monitor, DollarSign, Image as ImageIcon, Layers 
} from 'lucide-react';

// --- 初期データ ---
const INITIAL_MENU = [
  { id: 'm1', category: '主食', name: '焼きそば', price: 400, stock: 50, initialStock: 50, imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=400', toppings: [{name: '目玉焼き', price: 50}, {name: '大盛り', price: 100}] },
  { id: 'm2', category: '主食', name: 'オムライス', price: 500, stock: 30, initialStock: 30, imageUrl: 'https://images.unsplash.com/photo-1614548624185-30018d96b007?auto=format&fit=crop&q=80&w=400', toppings: [{name: 'チーズ', price: 50}, {name: '大盛り', price: 100}] }, 
  { id: 'm3', category: 'サイド', name: 'フランクフルト', price: 200, stock: 100, initialStock: 100, imageUrl: 'https://images.unsplash.com/photo-1595286595829-1959728cb187?auto=format&fit=crop&q=80&w=400', toppings: [{name: 'ケチャップ増し', price: 0}, {name: 'マスタード', price: 0}] },
  { id: 'm4', category: 'ドリンク', name: 'タピオカ', price: 250, stock: 80, initialStock: 80, imageUrl: 'https://images.unsplash.com/photo-1551608974-9eb51b1f09bb?auto=format&fit=crop&q=80&w=400', toppings: [{name: 'タピオカ2倍', price: 50}] },
  { id: 'm5', category: 'ドリンク', name: 'ラムネ', price: 150, stock: 120, initialStock: 120, imageUrl: '', toppings: [] },
  { id: 'm6', category: 'デザート', name: 'パンケーキ', price: 300, stock: 40, initialStock: 40, imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=400', toppings: [{name: 'ホイップ増量', price: 50}, {name: 'チョコソース', price: 30}] },
];

const INITIAL_STAFF = [
  { name: "A班", shift: "10:00-12:00", role: "レジ" },
  { name: "B班", shift: "12:00-14:00", role: "レジ" },
  { name: "C班", shift: "14:00-16:00", role: "レジ" },
  { name: "先生", shift: "終日", role: "監督" },
];

const CATEGORIES_LIST = ['主食', 'サイド', 'ドリンク', 'デザート', 'その他'];
const MONEY_BUTTONS = [{val:1000, label:'1000'}, {val:500, label:'500'}, {val:100, label:'100'}];

// 金種リスト（レジ締め用）
const CASH_DENOMINATIONS = [
  { val: 10000, label: '1万円札' },
  { val: 5000, label: '5千円札' },
  { val: 1000, label: '千円札' },
  { val: 500, label: '500円玉' },
  { val: 100, label: '100円玉' },
  { val: 50, label: '50円玉' },
  { val: 10, label: '10円玉' },
  { val: 5, label: '5円玉' },
  { val: 1, label: '1円玉' },
];

// --- Utils ---
const resizeImage = (file, maxWidth = 400, quality = 0.82) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'beep') {
      osc.frequency.setValueAtTime(1200, now); gain.gain.setValueAtTime(0.05, now); osc.start(); osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(1046, now); osc.frequency.setValueAtTime(1318, now+0.1); gain.gain.exponentialRampToValueAtTime(0.001, now+0.4); osc.start(); osc.stop(now+0.4);
    } else if (type === 'error') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); gain.gain.linearRampToValueAtTime(0, now+0.3); osc.start(); osc.stop(now+0.3);
    } else if (type === 'bell') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.setValueAtTime(1760, now+0.1); gain.gain.exponentialRampToValueAtTime(0.001, now+0.5); osc.start(); osc.stop(now+0.5);
    }
  } catch (e) {}
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'bg-teal-600', error: 'bg-red-600', warning: 'bg-orange-500', info: 'bg-slate-700' };
  return (
    <div className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded shadow-lg z-[100] animate-in slide-in-from-bottom-2 fade-in text-white text-sm font-medium ${colors[type]||colors.info}`}>
      {message}
    </div>
  );
};

// トッピング文字列パース用
const parseToppings = (str) => {
  if (!str) return [];
  return str.split(',').map(s => {
    const parts = s.split(':');
    if(parts.length >= 2) {
        return { name: parts[0].trim(), price: parseInt(parts[1]) || 0 };
    }
    return null;
  }).filter(t => t && t.name);
};

const stringifyToppings = (toppings) => {
  if (!toppings || !toppings.length) return '';
  return toppings.map(t => `${t.name}:${t.price}`).join(', ');
};

// --- Main Component ---
const loadLS = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!data || data.status === 'error') throw new Error(data?.message || 'サーバー処理に失敗しました');
  return data;
};

const postJson = (url, payload) => fetchJson(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(payload),
});

const createClientOrderId = () =>
  globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const escapeCsv = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function App() {

  // App States
  const [activeTab, setActiveTab] = useState('register');
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('bunka_gas_url') || '');
  const [deviceName, setDeviceName] = useState(() => localStorage.getItem('bunka_device') || 'レジ01');
  const [staffName, setStaffName] = useState(() => localStorage.getItem('bunka_staff_name') || '未設定');
  const [salesTarget, setSalesTarget] = useState(() => { const v = localStorage.getItem('bunka_sales_target'); return v ? Number(v) : 50000; });

  // Queue & Sync Mode
  const [isQueueMode, setIsQueueMode] = useState(() => loadLS('bunka_queue_mode', false));

  // Sync Status
  const [isMenuSyncing, setIsMenuSyncing] = useState(false);
  const [isHistorySyncing, setIsHistorySyncing] = useState(false);
  const [isOrderSyncing, setIsOrderSyncing] = useState(false);
  const [isSendingQueue, setIsSendingQueue] = useState(false);

  // Data
  const [menuItems, setMenuItems] = useState(() => loadLS('bunka_menu', INITIAL_MENU));
  const [staffList, setStaffList] = useState(() => loadLS('bunka_staff', INITIAL_STAFF));
  const [cart, setCart] = useState([]);
  const [salesHistory, setSalesHistory] = useState(() => loadLS('bunka_history', []));
  const [unsentOrders, setUnsentOrders] = useState(() => loadLS('bunka_unsent', []));
  const [orderNumber, setOrderNumber] = useState(() => loadLS('bunka_order_num', 1));
  const [displayOrderNumber, setDisplayOrderNumber] = useState(() => loadLS('bunka_display_num', 1));
  
  // UI
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isSuccessScreenOpen, setIsSuccessScreenOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState(false); 
  const [editingProduct, setEditingProduct] = useState(null); 
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');
  
  // トッピング機能用ステート
  const [toppingModalItem, setToppingModalItem] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);

  // 商品画像編集用ステート
  const [editImageUrl, setEditImageUrl] = useState('');
  const fileInputRef = useRef(null);

  // Payment
  const [deposit, setDeposit] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [lastOrderDetails, setLastOrderDetails] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('unknown');

  // Closing (レジ締め)
  const [cashCounts, setCashCounts] = useState(() => loadLS('bunka_cash_counts', {}));

  const showToast = (message, type = 'info') => setToast({ message, type });
  const play = (type) => playSound(type);

  const handleCopy = (text, successMsg) => {
    navigator.clipboard.writeText(text).then(() => showToast(successMsg, 'success')).catch(() => showToast('コピーに失敗しました', 'error'));
  };

  const handleImageFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      setEditImageUrl(dataUrl);
    } catch {
      showToast('画像の読み込みに失敗しました', 'error');
    }
    e.target.value = '';
  }, []);

  // Persist State to LocalStorage
  useEffect(() => localStorage.setItem('bunka_menu', JSON.stringify(menuItems)), [menuItems]);
  useEffect(() => localStorage.setItem('bunka_staff', JSON.stringify(staffList)), [staffList]);
  useEffect(() => localStorage.setItem('bunka_history', JSON.stringify(salesHistory)), [salesHistory]);
  useEffect(() => localStorage.setItem('bunka_unsent', JSON.stringify(unsentOrders)), [unsentOrders]);
  useEffect(() => localStorage.setItem('bunka_order_num', JSON.stringify(orderNumber)), [orderNumber]);
  useEffect(() => localStorage.setItem('bunka_device', deviceName), [deviceName]);
  useEffect(() => localStorage.setItem('bunka_staff_name', staffName), [staffName]);
  useEffect(() => localStorage.setItem('bunka_queue_mode', JSON.stringify(isQueueMode)), [isQueueMode]);
  useEffect(() => localStorage.setItem('bunka_cash_counts', JSON.stringify(cashCounts)), [cashCounts]);
  useEffect(() => localStorage.setItem('bunka_gas_url', gasUrl), [gasUrl]);
  useEffect(() => localStorage.setItem('bunka_sales_target', String(salesTarget)), [salesTarget]);
  useEffect(() => localStorage.setItem('bunka_display_num', JSON.stringify(displayOrderNumber)), [displayOrderNumber]);

  // Tab Sync (同じブラウザの別タブで客用画面を開いたとき用)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'bunka_display_num' && e.newValue) {
        setDisplayOrderNumber(JSON.parse(e.newValue));
        if (activeTab === 'customer') play('bell');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [activeTab]);

  // --- Calculations ---
  // 合計計算（トッピング込み）
  const totalAmount = useMemo(() => cart.reduce((sum, i) => {
    const itemTotal = i.price + (i.toppings?.reduce((tSum, t) => tSum + t.price, 0) || 0);
    return sum + itemTotal * i.quantity;
  }, 0), [cart]);

  const totalQuantity = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);
  const changeAmount = useMemo(() => (parseInt(deposit)||0) - totalAmount, [deposit, totalAmount]);
  const salesSummary = useMemo(() => {
    const valid = salesHistory.filter(s => !s.isCanceled);
    return {
      total: valid.reduce((a, c) => a + c.total, 0),
      count: valid.length,
      cash: valid.filter(s => s.paymentMethod === 'cash').reduce((a, c) => a + c.total, 0),
      ticket: valid.filter(s => s.paymentMethod === 'ticket').reduce((a, c) => a + c.total, 0)
    };
  }, [salesHistory]);

  const cashTotal = useMemo(() => {
    return CASH_DENOMINATIONS.reduce((sum, d) => sum + (d.val * (cashCounts[d.val] || 0)), 0);
  }, [cashCounts]);

  // --- Actions ---
  const fetchAllData = async (silent = false) => {
    if (!gasUrl || !navigator.onLine) { if(!silent) showToast("オフラインまたはURL未設定", "warning"); return; }
    if (!silent) setIsMenuSyncing(true);
    try {
      const dataMenu = await fetchJson(`${gasUrl}?action=getMenu`);
      if (dataMenu.items) {
        setMenuItems(prev => {
          const localMap = new Map(prev.map(i => [i.id, i]));
          const gasMap = new Map(dataMenu.items.map(i => [i.id, i]));
          // 既存ローカル商品をGASデータで更新し、GAS管理フラグを付与
          const updated = prev.map(p => {
            if (!gasMap.has(p.id)) return p; // GASにない → ローカル専用としてそのまま維持
            const g = gasMap.get(p.id);
            return {
              ...p, ...g,
              imageUrl: g.imageUrl || p.imageUrl,
              toppings: (g.toppings && g.toppings.length) ? g.toppings : p.toppings,
              initialStock: p.initialStock,
              gasManaged: true,
            };
          });
          // GASにあってローカルにない商品を追加（GAS管理フラグ付き）
          const newFromGas = dataMenu.items.filter(g => !localMap.has(g.id)).map(g => ({ ...g, gasManaged: true }));
          // GAS管理商品でスプシから行が消えたものを削除
          return [...updated, ...newFromGas].filter(p => !p.gasManaged || gasMap.has(p.id));
        });
      }
      const dataStaff = await fetchJson(`${gasUrl}?action=getStaff`);
      if (dataStaff.staff) setStaffList(dataStaff.staff);
      if (!silent) showToast('データ同期完了', 'success');
    } catch (e) {
      if (!silent) showToast('同期失敗', 'error');
    } finally {
      if (!silent) setIsMenuSyncing(false);
    }
  };

  const fetchSalesHistory = async () => {
    if (!gasUrl || !navigator.onLine) { showToast("オフラインまたはURL未設定", "warning"); return; }
    setIsHistorySyncing(true);
    try {
      const data = await fetchJson(`${gasUrl}?action=getSales&limit=50`);
      if (data.sales) {
        setSalesHistory(data.sales);
        showToast('履歴をクラウドと同期しました', 'success');
      }
    } catch (e) { showToast('履歴同期失敗', 'error'); } finally { setIsHistorySyncing(false); }
  };

  // 商品タップ時のハンドラ（トッピングがあればモーダルを開く）
  const handleItemClick = (item, isCustom) => {
    if (!isCustom && item.stock <= 0) { play('error'); showToast('在庫切れです', 'error'); return; }
    
    if (item.toppings && item.toppings.length > 0) {
      setToppingModalItem(item);
      setSelectedToppings([]); // 選択をリセット
    } else {
      executeAddToCart(item, [], isCustom);
    }
  };

  // カートへ実際に投入する処理
  const executeAddToCart = (item, toppings = [], isCustom = false) => {
    play('beep');
    setCart(prev => {
      // トッピング構成が完全に一致するものを探す
      const toppingsStr = JSON.stringify([...toppings].sort((a,b)=>a.name.localeCompare(b.name)));
      const existIdx = prev.findIndex(i => 
        i.id === item.id && 
        i.price === item.price && 
        JSON.stringify([...(i.toppings||[])].sort((a,b)=>a.name.localeCompare(b.name))) === toppingsStr
      );
      
      if (existIdx >= 0) {
        if (!isCustom && prev[existIdx].quantity >= item.stock) { showToast('在庫不足', 'error'); return prev; }
        const newCart = [...prev];
        newCart[existIdx].quantity += 1;
        return newCart;
      }
      return [...prev, { ...item, quantity: 1, toppings, cartId: `c-${Date.now()}-${Math.random()}` }];
    });
    setToppingModalItem(null);
  };

  // トッピングのトグル処理
  const toggleTopping = (topping) => {
    setSelectedToppings(prev => {
      if (prev.find(t => t.name === topping.name)) return prev.filter(t => t.name !== topping.name);
      return [...prev, topping];
    });
  };

  const submitOrder = async () => {
    if (cart.length === 0 || totalAmount <= 0) { showToast('商品を追加してください', 'warning'); return; }
    const finalDeposit = parseInt(deposit) || totalAmount;
    if (finalDeposit < totalAmount) { play('error'); showToast('金額不足', 'error'); return; }
    
    const orderData = {
      deviceId: deviceName, staffName, items: cart, total: totalAmount, paymentMethod,
      orderNumber: null, clientOrderId: createClientOrderId(),
      timestamp: new Date().toISOString(), isCanceled: false
    };

    setIsOrderSyncing(true);
    let isOfflineAction = false;
    let completedOrder = orderData;
    if (isQueueMode) {
        setUnsentOrders(prev => [...prev, orderData]);
        isOfflineAction = true;
    } else if (gasUrl && navigator.onLine) {
        try {
            const result = await postJson(gasUrl, { action: 'createOrder', order: orderData });
            completedOrder = { ...orderData, orderNumber: result.orderNumber };
        } catch (e) {
            showToast(e.message || '会計を保存できませんでした', 'error');
            play('error');
            setIsOrderSyncing(false);
            return;
        }
    } else {
        setUnsentOrders(prev => [...prev, orderData]);
        isOfflineAction = true;
    }

    const provisionalNumber = `仮-${deviceName}-${orderNumber}`;
    if (!completedOrder.orderNumber) completedOrder = { ...completedOrder, orderNumber: provisionalNumber };
    setMenuItems(prev => prev.map(m => {
      const totalQty = cart.filter(c => c.id === m.id).reduce((sum, c) => sum + c.quantity, 0);
      return (totalQty > 0 && !m.id.toString().startsWith('custom')) ? { ...m, stock: Math.max(0, m.stock - totalQty) } : m;
    }));
    setSalesHistory(prev => [completedOrder, ...prev]);

    setDisplayOrderNumber(completedOrder.orderNumber);

    play('success');
    setLastOrderDetails({ total: totalAmount, deposit: finalDeposit, change: finalDeposit - totalAmount, orderNumber: completedOrder.orderNumber, isOfflineAction });
    setOrderNumber(n => n + 1);
    setCart([]); setDeposit(''); setPaymentMethod('cash');
    setIsOrderSyncing(false);
    setIsCheckoutModalOpen(false); setIsMobileCartOpen(false); setIsSuccessScreenOpen(true);
  };

  const syncUnsentOrders = async () => {
    if (unsentOrders.length === 0) return;
    if (!gasUrl || !navigator.onLine) { showToast("オフラインのため送信できません", "warning"); return; }

    setIsSendingQueue(true);
    let successCount = 0;
    const remaining = [];

    for (const order of unsentOrders) {
      try {
        const result = await postJson(gasUrl, { action: 'createOrder', order: { ...order, orderNumber: null } });
        setSalesHistory(prev => prev.map(s => s.clientOrderId === order.clientOrderId ? { ...s, orderNumber: result.orderNumber } : s));
        successCount++;
      } catch (e) { remaining.push(order); }
    }

    setUnsentOrders(remaining);
    setIsSendingQueue(false);
    if (successCount > 0) { showToast(`${successCount}件 送信完了`, "success"); play('success'); }
  };

  const saveProduct = async (product) => {
    setIsMenuSyncing(true);
    const productId = editingProduct?.id || product.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let finalProduct = { ...product, id: productId, initialStock: editingProduct?.initialStock ?? product.stock };

    // base64画像 → GAS経由でGoogle Driveにアップロード
    if (product.imageUrl?.startsWith('data:') && gasUrl && navigator.onLine) {
      try {
        const base64 = product.imageUrl.split(',')[1];
        const mimeType = product.imageUrl.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        const uploadData = await postJson(gasUrl, { action: 'uploadImage', base64, mimeType, filename: `product_${productId}.jpg` });
        if (uploadData.url) {
          finalProduct.imageUrl = uploadData.url;
          setEditImageUrl(uploadData.url); // プレビューをDriveのURLに差し替え
        }
      } catch(e) {
        // アップロード失敗 → base64のままローカル保存
      }
    }

    if (gasUrl && navigator.onLine && !isQueueMode) {
      const productForGas = { ...finalProduct, imageUrl: finalProduct.imageUrl?.startsWith('data:') ? '' : (finalProduct.imageUrl || '') };
      try {
        await postJson(gasUrl, { action: 'updateProduct', product: productForGas });
        showToast('保存しました（クラウド同期済）', 'success');
      } catch(e) {
        showToast(e.message || 'クラウド保存に失敗しました', 'error');
        setIsMenuSyncing(false);
        return;
      }
    } else {
      showToast('端末内に保存しました', 'warning');
    }
    if (editingProduct) setMenuItems(prev => prev.map(i => i.id === finalProduct.id ? finalProduct : i));
    else setMenuItems(prev => [...prev, finalProduct]);
    setEditingProduct(null); setIsEditMenuModalOpen(false); setIsMenuSyncing(false);
  };

  const deleteProduct = async (id) => {
    if(!window.confirm('この商品を削除しますか？')) return;
    setIsMenuSyncing(true);
    if (gasUrl && navigator.onLine && !isQueueMode) {
      try {
        await postJson(gasUrl, { action: 'deleteProduct', id });
        showToast('削除しました（クラウド同期済）', 'success');
      } catch(e) {
        showToast(e.message || 'クラウド削除に失敗しました', 'error');
        setIsMenuSyncing(false);
        return;
      }
    } else {
      showToast('削除しました', 'success');
    }
    setMenuItems(prev => prev.filter(i => i.id !== id));
    setIsMenuSyncing(false);
  };

  const exportCSV = () => {
    const headers = ['日時', '注文番号', '合計金額', '支払方法', '商品詳細', '担当者', '取消ステータス'];
    const rows = salesHistory.map(s => {
      // トッピング情報を含めてCSVに出力
      const itemsDetail = s.items.map(i => {
        const topStr = (i.toppings && i.toppings.length) ? `(+${i.toppings.map(t=>t.name).join(',')})` : '';
        return `${i.name}${topStr} x${i.quantity}`;
      }).join('; ');
      return [new Date(s.timestamp).toLocaleString(), s.orderNumber, s.total, s.paymentMethod === 'cash' ? '現金' : '食券', itemsDetail, s.staffName, s.isCanceled ? '取消済' : ''];
    });
    const csvContent = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `sales_${new Date().toISOString().slice(0,10)}.csv`; link.click();
    showToast('CSVダウンロード', 'success');
  };

  const testConnection = async () => {
    if (!gasUrl) { showToast("URLを入力してください", "warning"); return; }
    setConnectionStatus('checking');
    try {
      const data = await fetchJson(`${gasUrl}?action=ping`);
      if (data.status === 'success') { setConnectionStatus('success'); showToast("接続成功", "success"); fetchAllData(true); } else throw new Error();
    } catch (e) { setConnectionStatus('error'); showToast("接続失敗", "error"); }
  };

  // カートのアイテム単価計算ユーティリティ
  const getItemUnitPrice = (item) => item.price + (item.toppings?.reduce((s,t)=>s+t.price,0) || 0);

  // --- レイアウト ---
  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-gray-100 font-sans text-slate-800 select-none overflow-hidden">
      
      {/* 1. 左サイドバー */}
      <nav className="hidden md:flex w-16 bg-slate-900 flex-col items-center py-4 gap-6 shrink-0 z-50 shadow-xl">
        <div className="text-white font-bold text-xs tracking-widest mb-2" style={{ writingMode: 'vertical-rl' }}>POS</div>
        {['register', 'history', 'closing', 'customer', 'menu', 'settings', 'help'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab===tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            {tab==='register' && <LayoutGrid size={24}/>}
            {tab==='history' && <BarChart3 size={24}/>}
            {tab==='closing' && <DollarSign size={24}/>}
            {tab==='customer' && <Monitor size={24}/>}
            {tab==='menu' && <Edit3 size={24}/>}
            {tab==='settings' && <Settings size={24}/>}
            {tab==='help' && <HelpCircle size={24}/>}
            <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {tab==='register'?'レジ':tab==='history'?'履歴':tab==='closing'?'レジ締め':tab==='customer'?'客用画面':tab==='menu'?'商品':tab==='settings'?'設定':'ガイド'}
            </span>
          </button>
        ))}
        <div className="mt-auto flex flex-col gap-4">
          <div className={`w-3 h-3 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
        </div>
      </nav>

      {/* 2. メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 relative">
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-slate-700 hidden md:block">
              {activeTab === 'register' && '販売'}
              {activeTab === 'history' && '取引履歴'}
              {activeTab === 'closing' && 'レジ締め・点検'}
              {activeTab === 'customer' && 'お客様用ディスプレイ'}
              {activeTab === 'menu' && '商品管理'}
              {activeTab === 'settings' && '設定'}
              {activeTab === 'help' && 'セットアップガイド'}
            </h2>
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 ml-2">
                <button onClick={() => setIsQueueMode(false)} className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${!isQueueMode ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><CloudLightning size={14} /> 即時</button>
                <button onClick={() => setIsQueueMode(true)} className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${isQueueMode ? 'bg-slate-700 shadow text-white' : 'text-slate-400 hover:text-slate-600'}`}><Inbox size={14} /> 後で</button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {unsentOrders.length > 0 && (
                <button onClick={syncUnsentOrders} disabled={isSendingQueue || !navigator.onLine} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isSendingQueue ? 'bg-slate-200 text-slate-500' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 animate-pulse'}`}>
                    {isSendingQueue ? <Loader2 size={14} className="animate-spin"/> : <CloudOff size={14} />}
                    未送信 {unsentOrders.length}件
                </button>
            )}
            <button onClick={() => setIsStaffModalOpen(true)} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">
              <User size={16}/> <span className="hidden md:inline">{staffName}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative pb-16 md:pb-0">
          
          {/* === レジ画面 === */}
          {activeTab === 'register' && (
            <div className="flex h-full flex-col md:flex-row">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center bg-white border-b shrink-0 px-2">
                  <div className="flex-1 flex overflow-x-auto p-2 gap-2 hide-scrollbar">
                    <button onClick={() => setSelectedCategory('すべて')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${selectedCategory === 'すべて' ? 'bg-slate-800 text-white shadow' : 'bg-white border text-slate-600 hover:bg-gray-50'}`}>すべて</button>
                    {CATEGORIES_LIST.map(cat => (
                      <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${selectedCategory === cat ? 'bg-slate-800 text-white shadow' : 'bg-white border text-slate-600 hover:bg-gray-50'}`}>{cat}</button>
                    ))}
                  </div>
                  <button onClick={()=>fetchAllData(false)} disabled={isMenuSyncing} className="p-3 text-blue-600 hover:bg-blue-50 rounded-full shrink-0 relative" title="メニューと在庫を同期">
                    {isMenuSyncing ? <Loader2 size={20} className="animate-spin text-slate-400"/> : <RefreshCw size={20} />}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {menuItems.filter(i => selectedCategory === 'すべて' || i.category === selectedCategory).map(item => {
                      const isSoldOut = item.stock <= 0;
                      const hasImage = Boolean(item.imageUrl);
                      const hasTopping = item.toppings && item.toppings.length > 0;
                      
                      return (
                        <button 
                          key={item.id} 
                          onClick={() => handleItemClick(item)} 
                          disabled={isSoldOut} 
                          style={hasImage ? { backgroundImage: `url(${item.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                          className={`relative flex flex-col justify-between p-4 rounded-xl border h-40 transition-all active:scale-[0.98] overflow-hidden shadow-sm ${isSoldOut ? 'opacity-60' : 'hover:border-blue-400 hover:shadow-md'} ${!hasImage ? 'bg-white border-gray-200' : 'border-transparent'}`}
                        >
                          {/* 背景画像用のオーバーレイ */}
                          {hasImage && <div className="absolute inset-0 bg-black/40 z-0"></div>}
                          
                          <div className="w-full text-left relative z-10">
                            <span className={`font-bold text-lg line-clamp-2 leading-snug drop-shadow-md ${hasImage ? 'text-white' : 'text-slate-800'}`}>
                              {item.name}
                            </span>
                            {hasTopping && (
                                <span className={`inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded font-bold ${hasImage ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-blue-50 text-blue-600'}`}>
                                    <Layers size={10}/> トッピング
                                </span>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-end w-full mt-auto relative z-10">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${item.stock <= 10 ? 'bg-red-500 text-white' : (hasImage ? 'bg-black/50 text-white backdrop-blur-sm' : 'bg-slate-100 text-slate-500')}`}>残 {item.stock}</span>
                            <span className={`text-xl font-bold drop-shadow-md ${hasImage ? 'text-white' : 'text-slate-900'}`}>¥{item.price}</span>
                          </div>
                          
                          {isSoldOut && <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-[1px] z-20"><span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded">SOLD OUT</span></div>}
                        </button>
                      );
                    })}
                    <button onClick={() => setIsCalculatorOpen(true)} className="flex flex-col justify-center items-center p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 h-40 active:scale-95 text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors"><Calculator size={32} className="mb-2"/> <span className="font-bold text-sm">金額入力</span></button>
                  </div>
                </div>
              </div>
              <div className={`w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 fixed md:static inset-y-0 right-0 transform transition-transform duration-300 ${isMobileCartOpen ? 'translate-x-0 bottom-16' : 'translate-x-full md:translate-x-0 bottom-0'} h-[calc(100%-4rem)] md:h-auto`}>
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><ShoppingCart size={18}/> カート</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setIsMobileCartOpen(false)} className="md:hidden p-1 rounded hover:bg-slate-100"><X size={20}/></button>
                    <button onClick={() => setCart([])} disabled={cart.length===0} className="text-red-500 text-xs font-bold px-2 py-1 rounded hover:bg-red-50 disabled:opacity-30">全て削除</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {cart.map((item, idx) => (
                    <div key={item.cartId || idx} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                        {item.toppings && item.toppings.length > 0 && (
                            <div className="text-[10px] text-blue-600 mt-0.5 truncate flex flex-wrap gap-1">
                                {item.toppings.map((t, i) => <span key={i} className="bg-blue-50 px-1 rounded">+{t.name}</span>)}
                            </div>
                        )}
                        <div className="text-xs text-slate-500 mt-0.5">@¥{getItemUnitPrice(item)}</div>
                      </div>
                      <div className="flex items-center gap-3 pl-2">
                        <div className="font-bold text-slate-700">x{item.quantity}</div>
                        <div className="font-bold text-right w-16">¥{getItemUnitPrice(item) * item.quantity}</div>
                        <button onClick={() => setCart(p => p.filter((_,i)=>i!==idx))} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {cart.length === 0 && <div className="h-40 flex flex-col items-center justify-center text-slate-300"><ShoppingCart size={40} className="mb-2 opacity-50"/><span className="text-sm font-medium">商品を選択してください</span></div>}
                </div>
                <div className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex justify-between items-end mb-4"><span className="text-sm font-bold text-slate-500">合計点数: {totalQuantity}</span><div className="text-right"><span className="text-xs text-slate-400 block">税込合計</span><span className="text-4xl font-bold text-slate-800 tracking-tight">¥{totalAmount.toLocaleString()}</span></div></div>
                  <button onClick={() => setIsCheckoutModalOpen(true)} disabled={cart.length===0} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2">会計へ進む <ChevronRight size={20}/></button>
                </div>
              </div>
              {!isMobileCartOpen && cart.length > 0 && (
                <div className={`md:hidden fixed bottom-20 left-0 right-0 p-3 z-30 transition-transform`}>
                  <button onClick={() => setIsMobileCartOpen(true)} className="w-full bg-slate-900 text-white p-4 rounded-xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3"><div className="bg-yellow-400 text-slate-900 font-bold w-8 h-8 rounded-full flex items-center justify-center">{totalQuantity}</div><div className="text-sm font-bold">カートを見る</div></div>
                    <div className="text-xl font-bold">¥{totalAmount.toLocaleString()}</div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* === レジ締め画面 === */}
          {activeTab === 'closing' && (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-700"><DollarSign/> レジ締め・点検</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="font-bold text-sm text-slate-500 border-b pb-2">金種入力</h3>
                      {CASH_DENOMINATIONS.map(d => (
                        <div key={d.val} className="flex items-center gap-4">
                          <span className="w-20 text-sm font-bold text-slate-700">{d.label}</span>
                          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                            <button onClick={() => setCashCounts(p => ({...p, [d.val]: Math.max(0, (p[d.val]||0)-1)}))} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:bg-slate-50"><Minus size={16}/></button>
                            <input 
                              type="number" 
                              value={cashCounts[d.val] || 0} 
                              onChange={(e) => setCashCounts(p => ({...p, [d.val]: parseInt(e.target.value)||0}))}
                              className="w-16 text-center bg-transparent font-bold"
                            />
                            <button onClick={() => setCashCounts(p => ({...p, [d.val]: (p[d.val]||0)+1}))} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-blue-600 hover:bg-blue-50"><Plus size={16}/></button>
                          </div>
                          <span className="flex-1 text-right text-sm text-slate-500">¥{(d.val * (cashCounts[d.val]||0)).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="pt-4 border-t flex justify-between items-end">
                        <span className="font-bold text-slate-700">現金合計</span>
                        <span className="text-2xl font-bold text-blue-600">¥{cashTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-sm text-slate-500 mb-3">売上データ照合</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span>システム上の現金売上</span><span className="font-bold">¥{salesSummary.cash.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>手元の現金合計</span><span className="font-bold">¥{cashTotal.toLocaleString()}</span></div>
                          <div className="border-t border-slate-300 my-2"></div>
                          <div className="flex justify-between items-center">
                            <span className="font-bold">過不足 (ズレ)</span>
                            <span className={`text-xl font-bold ${cashTotal - salesSummary.cash === 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {cashTotal - salesSummary.cash > 0 ? '+' : ''}{(cashTotal - salesSummary.cash).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-400">
                        <p>※ 準備金（釣銭準備金）がある場合は、その分を差し引いて計算してください。</p>
                        <p>※ 「過不足」が0になるのが理想です。</p>
                      </div>
                      
                      <button onClick={() => {if(window.confirm('レジ締めデータをリセットしますか？')) setCashCounts({})}} className="w-full py-3 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 flex items-center justify-center gap-2">
                        <RotateCcw size={16}/> 入力をリセット
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === 客用ディスプレイ === */}
          {activeTab === 'customer' && (
            <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 text-center relative overflow-hidden">
              <div className="absolute top-4 left-4 text-xs opacity-50 flex items-center gap-2"><Wifi size={12}/> {navigator.onLine ? 'ローカル接続' : 'オフライン'}</div>
              
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-blue-400 mb-2 tracking-widest">CALL NUMBER</h2>
                <p className="text-sm opacity-60">現在のお呼び出し番号</p>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse"></div>
                <div className="text-[12rem] font-black leading-none tracking-tighter font-mono relative z-10 text-white" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                  {String(displayOrderNumber).padStart(3, '0')}
                </div>
              </div>

              <div className="mt-12 p-6 bg-slate-800/50 rounded-2xl border border-slate-700 max-w-md w-full backdrop-blur-sm">
                <p className="text-lg font-bold mb-2">お客様へのお願い</p>
                <p className="text-sm opacity-70 leading-relaxed">
                  番号が呼ばれましたら、商品受け渡し口までお越しください。<br/>
                  お手元のレシート番号（またはスマホ画面）をご提示ください。
                </p>
                <p className="text-xs text-slate-500 mt-4 border-t border-slate-700 pt-2">※異なる端末間での番号同期は行われません</p>
              </div>
            </div>
          )}

          {/* === 履歴タブ === */}
          {activeTab === 'history' && (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-end"><h2 className="text-xl font-bold text-slate-800">売上レポート</h2><div className="flex gap-2"><button onClick={()=>fetchSalesHistory()} disabled={isHistorySyncing} className="text-sm font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2">{isHistorySyncing ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} 更新</button><button onClick={exportCSV} className="text-sm font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-2"><Download size={16}/> CSV出力</button></div></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div className="text-sm font-bold text-slate-400 mb-1">本日の総売上</div><div className="text-3xl font-bold text-slate-800">¥{salesSummary.total.toLocaleString()}</div></div>
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div className="text-sm font-bold text-slate-400 mb-1">取引回数</div><div className="text-3xl font-bold text-slate-800">{salesSummary.count}<span className="text-sm font-normal ml-1">回</span></div></div>
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div className="text-sm font-bold text-slate-400 mb-1">平均客単価</div><div className="text-3xl font-bold text-slate-800">¥{salesSummary.count ? Math.round(salesSummary.total/salesSummary.count).toLocaleString() : 0}</div></div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 font-bold text-slate-700">取引一覧 (最新50件)</div>
                  <div className="divide-y divide-slate-100">
                    {salesHistory.slice(0, 50).map((s, i) => (
                      <div key={i} className={`flex items-center justify-between p-4 ${s.isCanceled ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${s.isCanceled ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-500'}`}>#{s.orderNumber}</div>
                          <div><div className="text-sm font-bold text-slate-800">¥{s.total.toLocaleString()}{s.isCanceled && <span className="ml-2 text-xs text-red-500 bg-red-100 px-1.5 py-0.5 rounded">取消済</span>}</div><div className="text-xs text-slate-400">{new Date(s.timestamp).toLocaleTimeString()} · {s.paymentMethod==='cash'?'現金':'食券'} · {s.staffName}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === 商品マスタ管理 === */}
          {activeTab === 'menu' && (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center"><h2 className="font-bold text-lg text-slate-700">商品マスタ管理</h2><button onClick={() => { setEditingProduct(null); setEditImageUrl(''); setIsEditMenuModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Plus size={16}/> 新規登録</button></div>
                <div className="divide-y divide-slate-100">
                  {menuItems.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 group">
                      <div className="flex items-center gap-4">
                        {item.imageUrl ? (
                            <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-300 flex items-center justify-center shrink-0 border border-slate-200">
                                <ImageIcon size={20} />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">{item.category}</span>
                                <span className="font-bold text-slate-800">{item.name}</span>
                                {item.toppings && item.toppings.length > 0 && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Layers size={10}/>トッピング有</span>}
                            </div>
                            <div className="text-sm text-slate-500">¥{item.price} / 在庫: {item.stock}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingProduct(item); setEditImageUrl(item.imageUrl || ''); setIsEditMenuModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit3 size={18}/></button><button onClick={() => deleteProduct(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={18}/></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === 設定タブ === */}
          {activeTab === 'settings' && (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                <h2 className="font-bold text-lg border-b pb-2">システム設定</h2>
                
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-2">GAS連携 URL</label>
                  <div className="flex gap-2 mb-2">
                    <input value={gasUrl} onChange={e=>setGasUrl(e.target.value)} className="flex-1 p-2 border rounded-lg bg-slate-50 text-xs font-mono" placeholder="https://script.google.com/..." />
                    <button onClick={testConnection} disabled={connectionStatus==='checking'} className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1 ${connectionStatus==='success'?'bg-green-100 text-green-700':connectionStatus==='error'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>
                      {connectionStatus==='checking' ? <RefreshCw size={14} className="animate-spin"/> : connectionStatus==='success' ? <Check size={14}/> : <Link2 size={14}/>}
                      {connectionStatus==='success' ? 'OK' : 'テスト'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">※空欄の場合はデモモード（端末内保存のみ）で動作します。</p>
                </div>

                <div><label className="text-xs font-bold text-slate-500 block mb-2">端末名</label><input type="text" value={deviceName} onChange={e=>setDeviceName(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50 font-bold text-slate-700" /></div>
                
                <div className="pt-4 border-t"><button onClick={() => { if(window.confirm('履歴を全て削除しますか？')) setSalesHistory([]); }} className="w-full py-3 text-red-600 font-bold border border-red-200 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2"><RotateCcw size={18}/> 履歴リセット</button></div>
                <div className="pt-4 border-t text-center text-xs text-slate-400">bunkasai-pos v{APP_VERSION}</div>
              </div>
            </div>
          )}

          {/* === ヘルプタブ === */}
          {activeTab === 'help' && (
            <div className="h-full overflow-y-auto p-6 bg-gray-50">
              <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-slate-800">
                <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-100 flex items-center gap-2"><HelpCircle className="text-blue-600"/> セットアップ & 使い方ガイド</h2>
                <div className="space-y-8">
                  <section>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>Googleスプレッドシートの準備</h3>
                    <p className="text-sm text-slate-600 mb-2">以下のシートを作成してください。</p>
                    <ol className="list-decimal list-inside text-sm space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <li className="space-y-2">
                        <div><strong><code>Menu</code> シートの1行目 (A1):</strong></div>
                        <div className="flex items-center gap-2"><code className="bg-white border border-slate-300 px-2 py-1 rounded text-xs flex-1 overflow-x-auto whitespace-nowrap">ID	Category	Name	Price	Stock	ImageUrl	Toppings</code><button onClick={() => handleCopy("ID\tCategory\tName\tPrice\tStock\tImageUrl\tToppings", 'Menuヘッダーをコピーしました')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded text-xs flex items-center gap-1 shrink-0"><Copy size={12}/> コピー</button></div>
                        <div className="text-[10px] text-slate-500 pl-4">※ ImageUrl列に画像のURLを入れると同期時に反映されます。空欄の場合は端末にアップロードした画像が維持されます。</div>
                      </li>
                      <li className="space-y-2">
                        <div><strong><code>Sales</code> シートの1行目 (A1):</strong></div>
                        <div className="flex items-center gap-2"><code className="bg-white border border-slate-300 px-2 py-1 rounded text-xs flex-1 overflow-x-auto whitespace-nowrap">Date	Total	Items	PaymentMethod	Device	OrderNum	Staff</code><button onClick={() => handleCopy("Date\tTotal\tItems\tPaymentMethod\tDevice\tOrderNum\tStaff", 'Salesヘッダーをコピーしました')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded text-xs flex items-center gap-1 shrink-0"><Copy size={12}/> コピー</button></div>
                      </li>
                    </ol>
                  </section>
                  <section>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>Google Apps Script (GAS) の設定</h3>
                    <p className="text-sm text-slate-600 mb-3">スプレッドシートの「拡張機能」→「Apps Script」を開き、以下のコードを貼り付けて「デプロイ」してください。</p>
                    <div className="relative bg-slate-900 rounded-lg overflow-hidden">
                      <button onClick={() => handleCopy(GAS_SCRIPT, 'GASスクリプトをコピーしました')} className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 z-10"><Copy size={12}/> コピー</button>
                      <pre className="text-green-400 text-[10px] p-4 pt-12 overflow-x-auto leading-relaxed whitespace-pre">{GAS_SCRIPT}</pre>
                    </div>
                    <div className="hidden">
                      <button onClick={() => handleCopy(`function doGet(e){const a=e.parameter.action,ss=SpreadsheetApp.getActiveSpreadsheet();if(a==='getMenu'){const sh=ss.getSheetByName('Menu'),d=sh.getDataRange().getValues(),items=d.slice(1).filter(r=>r[0]).map(r=>({id:r[0],category:r[1],name:r[2],price:Number(r[3]),stock:Number(r[4]),initialStock:Number(r[4]),imageUrl:r[5]||'',toppings:parseToppings(r[6]||'')}));return res({items})}if(a==='getStaff'){const sh=ss.getSheetByName('Staff');if(!sh)return res({staff:[]});const d=sh.getDataRange().getValues(),staff=d.slice(1).filter(r=>r[0]).map(r=>({name:r[0],shift:r[1]||'',role:r[2]||''}));return res({staff})}if(a==='getSales'){const sh=ss.getSheetByName('Sales');if(!sh)return res({sales:[]});const d=sh.getDataRange().getValues(),lim=Number(e.parameter.limit)||50,sales=d.slice(1).filter(r=>r[0]).slice(-lim).reverse().map(r=>({timestamp:r[0],total:r[1],items:JSON.parse(r[2]||'[]'),paymentMethod:r[3],deviceId:r[4],orderNumber:r[5],staffName:r[6],isCanceled:r[7]||false}));return res({sales})}if(a==='ping')return res({status:'success'});return res({status:'error'})}
function doPost(e){const data=JSON.parse(e.postData.contents),ss=SpreadsheetApp.getActiveSpreadsheet();if(data.action==='uploadImage'){const decoded=Utilities.base64Decode(data.base64),blob=Utilities.newBlob(decoded,data.mimeType||'image/jpeg',data.filename||'product.jpg'),folders=DriveApp.getFoldersByName('BunkasaiPOS_Images'),folder=folders.hasNext()?folders.next():DriveApp.createFolder('BunkasaiPOS_Images'),file=folder.createFile(blob);file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);return res({status:'success',url:'https://drive.google.com/thumbnail?id='+file.getId()+'&sz=w400'})}if(data.action==='updateProduct'){const sh=ss.getSheetByName('Menu'),d=sh.getDataRange().getValues();for(let i=1;i<d.length;i++){if(d[i][0]==data.product.id){sh.getRange(i+1,1,1,7).setValues([[data.product.id,data.product.category,data.product.name,data.product.price,data.product.stock,data.product.imageUrl||'',strToppings(data.product.toppings||[])]]);return res({status:'success'})}}sh.appendRow([data.product.id,data.product.category,data.product.name,data.product.price,data.product.stock,data.product.imageUrl||'',strToppings(data.product.toppings||[])]);return res({status:'success'})}if(data.action==='deleteProduct'){const sh=ss.getSheetByName('Menu'),d=sh.getDataRange().getValues();for(let i=1;i<d.length;i++){if(d[i][0]==data.id){sh.deleteRow(i+1);return res({status:'success'})}}return res({status:'success'})}const sh=ss.getSheetByName('Sales')||ss.insertSheet('Sales');if(sh.getLastRow()===0)sh.appendRow(['Date','Total','Items','PaymentMethod','Device','OrderNum','Staff','Canceled']);sh.appendRow([data.timestamp,data.total,JSON.stringify(data.items),data.paymentMethod,data.deviceId,data.orderNumber,data.staffName,data.isCanceled||false]);return res({status:'success'})}
function parseToppings(s){if(!s)return[];return s.split(',').map(t=>{const p=t.trim().split(':');return p.length>=2?{name:p[0].trim(),price:parseInt(p[1])||0}:null}).filter(t=>t&&t.name)}
function strToppings(t){return t&&t.length?t.map(x=>x.name+':'+x.price).join(', '):''}
function res(d){return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON)}`, 'GASスクリプトをコピーしました')} className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 z-10"><Copy size={12}/> コピー</button>
                      <pre className="text-green-400 text-[10px] p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">{`function doGet(e) {
  const a = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (a === 'getMenu') {
    const sh = ss.getSheetByName('Menu');
    const items = sh.getDataRange().getValues().slice(1)
      .filter(r => r[0]).map(r => ({
        id: r[0], category: r[1], name: r[2],
        price: Number(r[3]), stock: Number(r[4]), initialStock: Number(r[4]),
        imageUrl: r[5] || '', toppings: parseToppings(r[6] || '')
      }));
    return res({ items });
  }
  if (a === 'getStaff') {
    const sh = ss.getSheetByName('Staff');
    if (!sh) return res({ staff: [] });
    const staff = sh.getDataRange().getValues().slice(1)
      .filter(r => r[0]).map(r => ({ name: r[0], shift: r[1]||'', role: r[2]||'' }));
    return res({ staff });
  }
  if (a === 'getSales') {
    const sh = ss.getSheetByName('Sales');
    if (!sh) return res({ sales: [] });
    const lim = Number(e.parameter.limit) || 50;
    const sales = sh.getDataRange().getValues().slice(1)
      .filter(r => r[0]).slice(-lim).reverse()
      .map(r => ({ timestamp:r[0], total:r[1], items:JSON.parse(r[2]||'[]'),
        paymentMethod:r[3], deviceId:r[4], orderNumber:r[5], staffName:r[6], isCanceled:r[7]||false }));
    return res({ sales });
  }
  if (a === 'ping') return res({ status: 'success' });
  return res({ status: 'error' });
}
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 端末からアップロードした画像をGoogle Driveに保存してURLを返す
  if (data.action === 'uploadImage') {
    const decoded = Utilities.base64Decode(data.base64);
    const blob = Utilities.newBlob(decoded, data.mimeType || 'image/jpeg', data.filename || 'product.jpg');
    const folders = DriveApp.getFoldersByName('BunkasaiPOS_Images');
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('BunkasaiPOS_Images');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return res({ status: 'success', url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400' });
  }

  if (data.action === 'updateProduct') {
    const sh = ss.getSheetByName('Menu');
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == data.product.id) {
        sh.getRange(i+1,1,1,7).setValues([[
          data.product.id, data.product.category, data.product.name,
          data.product.price, data.product.stock,
          data.product.imageUrl || '', strToppings(data.product.toppings||[])
        ]]);
        return res({ status: 'success' });
      }
    }
    sh.appendRow([data.product.id, data.product.category, data.product.name,
      data.product.price, data.product.stock, data.product.imageUrl||'', strToppings(data.product.toppings||[])]);
    return res({ status: 'success' });
  }
  if (data.action === 'deleteProduct') {
    const sh = ss.getSheetByName('Menu');
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == data.id) { sh.deleteRow(i+1); break; }
    }
    return res({ status: 'success' });
  }
  const sh = ss.getSheetByName('Sales') || ss.insertSheet('Sales');
  if (sh.getLastRow() === 0)
    sh.appendRow(['Date','Total','Items','PaymentMethod','Device','OrderNum','Staff','Canceled']);
  sh.appendRow([data.timestamp, data.total, JSON.stringify(data.items),
    data.paymentMethod, data.deviceId, data.orderNumber, data.staffName, data.isCanceled||false]);
  return res({ status: 'success' });
}
function parseToppings(s) {
  if (!s) return [];
  return s.split(',').map(t => {
    const p = t.trim().split(':');
    return p.length >= 2 ? { name: p[0].trim(), price: parseInt(p[1])||0 } : null;
  }).filter(t => t && t.name);
}
function strToppings(t) { return t&&t.length ? t.map(x=>x.name+':'+x.price).join(', ') : ''; }
function res(d) {
  return ContentService.createTextOutput(JSON.stringify(d))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">※ デプロイ時は「アクセスできるユーザー：全員」に設定してください。画像アップロードにはDriveへのアクセス権限が必要です（初回デプロイ時に許可を求められます）。</p>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ボトムナビゲーション (モバイル用) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 flex justify-around items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
        {['register', 'history', 'closing', 'customer', 'menu', 'settings', 'help'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab===tab ? 'text-white bg-slate-800 border-t-2 border-blue-500' : 'text-slate-400 hover:text-white'}`}>
            {tab==='register' && <LayoutGrid size={20}/>}{tab==='history' && <BarChart3 size={20}/>}{tab==='closing' && <DollarSign size={20}/>}{tab==='customer' && <Monitor size={20}/>}{tab==='menu' && <Edit3 size={20}/>}{tab==='settings' && <Settings size={20}/>}{tab==='help' && <HelpCircle size={20}/>}
            <span className="text-[9px] mt-1">{tab==='register'?'レジ':tab==='history'?'履歴':tab==='closing'?'レジ締め':tab==='customer'?'客用画面':tab==='menu'?'商品':tab==='settings'?'設定':'ガイド'}</span>
          </button>
        ))}
      </nav>

      {/* トッピング選択モーダル */}
      {toppingModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 z-[85] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl md:rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{toppingModalItem.name}</h3>
                <p className="text-xs text-slate-500">トッピングを選択してください</p>
              </div>
              <button onClick={() => setToppingModalItem(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {toppingModalItem.toppings.map((topping, idx) => {
                const isSelected = selectedToppings.find(t => t.name === topping.name);
                return (
                  <button 
                    key={idx}
                    onClick={() => toggleTopping(topping)}
                    className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check size={16} strokeWidth={3} />}
                      </div>
                      <span className="font-bold text-slate-700">{topping.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">{topping.price > 0 ? `+¥${topping.price}` : '無料'}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white md:rounded-b-2xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
              <div className="flex justify-between items-end mb-4">
                <span className="text-sm font-bold text-slate-500">追加料金: ¥{selectedToppings.reduce((sum, t) => sum + t.price, 0)}</span>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">小計</span>
                  <span className="text-3xl font-bold text-slate-800 tracking-tight">¥{toppingModalItem.price + selectedToppings.reduce((sum, t) => sum + t.price, 0)}</span>
                </div>
              </div>
              <button 
                onClick={() => executeAddToCart(toppingModalItem, selectedToppings, false)} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart size={20}/> カートに追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 会計モーダル */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[85vh] md:h-auto overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-700">お会計</h3>
              <div className="flex bg-slate-200 rounded-lg p-1">
                <button onClick={()=>setPaymentMethod('cash')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${paymentMethod==='cash'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>現金</button>
                <button onClick={()=>setPaymentMethod('ticket')} className={`px-6 py-1.5 rounded-md text-sm font-bold transition-all ${paymentMethod==='ticket'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>食券</button>
              </div>
              <button onClick={()=>setIsCheckoutModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={24}/></button>
            </div>
            <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 overflow-y-auto">
              <div className="flex-1 flex flex-col justify-center gap-6">
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-400 mb-1">お買上げ合計</div>
                  <div className="text-5xl font-bold text-slate-800 tracking-tight">¥{totalAmount.toLocaleString()}</div>
                </div>
                <div className={`p-6 rounded-xl border-2 flex flex-col gap-4 relative transition-colors ${changeAmount<0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center"><span className="font-bold text-slate-500">お預かり</span><span className="text-4xl font-bold text-slate-800">¥{deposit||'0'}</span></div>
                  <div className="h-px bg-slate-300 w-full"></div>
                  <div className="flex justify-between items-center"><span className="font-bold text-slate-500">お釣り</span><span className={`text-4xl font-bold ${changeAmount<0?'text-red-500':'text-slate-800'}`}>¥{changeAmount<0?'-':changeAmount.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="flex-1 min-h-[400px]">
                <NumPad onInput={(v) => { play('beep'); if(deposit.length<7) setDeposit(d=>d+v); }} onClear={() => setDeposit('')} onEnter={submitOrder} isProcessing={isOrderSyncing} canSubmit={paymentMethod === 'ticket' || changeAmount >= 0} onMoneyTap={(v) => { play('beep'); setDeposit(d=>String((parseInt(d)||0)+v)); }} onExact={() => { setDeposit(String(totalAmount)); }} paymentMethod={paymentMethod} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 完了画面 */}
      {isSuccessScreenOpen && lastOrderDetails && (
        <div className="fixed inset-0 bg-teal-600 z-[80] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-20 h-20 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={48} /></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">会計完了</h2>
            <div className="text-5xl font-black text-slate-900 tracking-widest my-8 font-mono border-2 border-dashed border-slate-200 py-4 rounded-xl bg-slate-50">{String(lastOrderDetails.orderNumber).padStart(3, '0')}</div>
            
            {lastOrderDetails.isOfflineAction ? (
                <div className="flex items-center justify-center gap-2 text-orange-600 font-bold bg-orange-100 px-4 py-2 rounded-full mb-4"><CloudOff size={16} /> 端末に一時保存 (未送信)</div>
            ) : (
                <div className="flex items-center justify-center gap-2 text-green-600 font-bold bg-green-100 px-4 py-2 rounded-full mb-4"><Cloud size={16} /> クラウド保存完了 ✅</div>
            )}

            <div className="flex justify-between items-center bg-slate-50 px-6 py-4 rounded-xl mb-8"><span className="font-bold text-slate-500 text-sm">お釣り</span><span className="text-3xl font-bold text-slate-800">¥{lastOrderDetails.change.toLocaleString()}</span></div>
            <button onClick={()=>{setIsSuccessScreenOpen(false);setLastOrderDetails(null)}} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 text-lg transition-all">次の会計へ</button>
          </div>
        </div>
      )}

      {/* 商品追加・編集モーダル */}
      {isEditMenuModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            const fd = new FormData(e.target); 
            saveProduct({
              id: editingProduct ? editingProduct.id : null,
              name: fd.get('name'),
              price: Number(fd.get('price')),
              stock: Number(fd.get('stock')),
              category: fd.get('category'),
              // 編集時は元の初期在庫を維持、新規追加時のみ現在庫を初期在庫にする
              initialStock: editingProduct ? editingProduct.initialStock : Number(fd.get('stock')),
              imageUrl: editImageUrl,
              toppings: parseToppings(fd.get('toppings'))
            });
          }} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl text-slate-800 border-b pb-2">{editingProduct ? '商品情報を編集' : '新しい商品を追加'}</h3>
            
            <div><label className="text-xs font-bold text-slate-500 mb-1 block">商品名</label><input name="name" defaultValue={editingProduct?.name} required className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50" placeholder="例: 唐揚げ" /></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">販売価格 (¥)</label><input name="price" type="number" defaultValue={editingProduct?.price} required className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">初期在庫</label><input name="stock" type="number" defaultValue={editingProduct?.stock} required className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50" /></div>
            </div>
            
            <div><label className="text-xs font-bold text-slate-500 mb-1 block">カテゴリ</label><select name="category" defaultValue={editingProduct?.category||'その他'} className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50">{CATEGORIES_LIST.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-2"><ImageIcon size={14}/> 商品画像 (任意)</label>

                    {/* プレビュー */}
                    {editImageUrl && (
                        <div className="relative mb-2 w-full h-36 rounded-lg overflow-hidden bg-slate-200">
                            <img src={editImageUrl} alt="プレビュー" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => setEditImageUrl('')}
                                className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                            ><X size={14}/></button>
                        </div>
                    )}

                    {/* ファイル選択ボタン */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full mb-2 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-sm hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-colors"
                    >
                        <ImageIcon size={16}/> 端末から画像を選択
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />

                    {/* URL入力 */}
                    <input
                        value={editImageUrl}
                        onChange={e => setEditImageUrl(e.target.value)}
                        className="w-full p-2 text-sm border border-slate-300 rounded bg-white"
                        placeholder="または画像URLを入力 https://..."
                    />
                    <p className="text-[10px] text-slate-400 mt-1">※ 端末からアップロードするか、外部の画像URLを入力できます。</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1"><Layers size={14}/> トッピング設定 (任意)</label>
                    <input name="toppings" defaultValue={stringifyToppings(editingProduct?.toppings)} className="w-full p-2 text-sm border border-slate-300 rounded bg-white" placeholder="例: チーズ:50, 大盛り:100" />
                    <p className="text-[10px] text-slate-400 mt-1">※ カンマ区切りで「名称:追加料金」を入力（無料の場合は0）。</p>
                </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsEditMenuModalOpen(false)} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50">キャンセル</button>
              <button type="submit" disabled={isMenuSyncing} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md">{isMenuSyncing ? <Loader2 size={18} className="animate-spin"/> : '保存する'}</button>
            </div>
          </form>
        </div>
      )}

      {isCalculatorOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[90] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-700">金額入力</h3><button onClick={()=>setIsCalculatorOpen(false)}><X/></button></div>
            <div className="bg-slate-100 p-4 rounded-xl text-right text-4xl font-bold text-slate-800 mb-6 font-mono">¥{customPriceInput||'0'}</div>
            <div className="h-80"><NumPad onInput={(v)=>{if(customPriceInput.length<6)setCustomPriceInput(p=>p+v)}} onClear={()=>setCustomPriceInput('')} onEnter={()=>{ const p = parseInt(customPriceInput); if(p){ executeAddToCart({id:`c-${Date.now()}`, name:'金額入力', price:p, category:'その他', stock:999}, [], true); setCustomPriceInput(''); setIsCalculatorOpen(false); } }} canSubmit={customPriceInput.length>0} submitLabel="追加" /></div>
          </div>
        </div>
      )}

      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[90] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl p-4 shadow-xl animate-in fade-in zoom-in-95 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Users size={20} /> 担当者変更</h3>
                <div className="flex gap-2">
                    <button onClick={()=>fetchAllData(false)} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded flex items-center gap-1"><RefreshCw size={12}/>同期</button>
                    <button onClick={()=>setIsStaffModalOpen(false)}><X size={20}/></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {staffList.map((s, idx) => (
                <button key={idx} onClick={()=>{setStaffName(s.name);setIsStaffModalOpen(false);showToast(`担当: ${s.name}`)}} className={`w-full p-3 rounded-lg border text-left transition-colors hover:bg-slate-50 ${staffName===s.name ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">{s.name}</span>
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{s.role}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Clock size={12}/> {s.shift}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
      
      {/* 処理中オーバーレイ（注文送信中のみ） */}
      {isOrderSyncing && <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center backdrop-blur-sm"><div className="bg-white px-8 py-6 rounded-2xl shadow-2xl font-bold flex flex-col items-center gap-4"><Loader2 size={40} className="text-blue-600 animate-spin"/><span className="text-lg">送信中...</span></div></div>}
    </div>
  );
}

// テンキー (共通部品)
const NumPad = ({ onInput, onClear, onEnter, isProcessing, canSubmit, onMoneyTap, onExact, paymentMethod, submitLabel }) => (
  <div className="flex gap-3 h-full">
    {onMoneyTap && (
      <div className="flex flex-col gap-2 w-24">
        <button onClick={onExact} disabled={isProcessing} className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold rounded-lg shadow-sm border-2 border-yellow-500 active:scale-95 transition-transform flex flex-col items-center justify-center"><span className="text-xs font-normal opacity-80">お釣りなし</span><span className="text-xl">ぴったり</span></button>
        {MONEY_BUTTONS.map(m => <button key={m.val} onClick={() => onMoneyTap(m.val)} disabled={isProcessing} className="py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg shadow-sm active:scale-95 hover:bg-slate-50">{m.label}</button>)}
      </div>
    )}
    <div className="flex-1 grid grid-cols-3 gap-2">
      {[7,8,9,4,5,6,1,2,3,0,'00'].map(n => <button key={n} onClick={() => onInput(n)} disabled={isProcessing} className="bg-white border border-slate-200 text-2xl font-bold rounded-lg shadow-sm active:scale-95 hover:bg-slate-50 text-slate-700 font-mono">{n}</button>)}
      <button onClick={onClear} className="bg-white border border-slate-200 text-red-500 text-xl font-bold rounded-lg active:scale-95 hover:bg-red-50">C</button>
      <button onClick={onEnter} disabled={isProcessing || !canSubmit} className={`col-span-3 text-white text-xl font-bold py-3 rounded-lg shadow-md active:scale-95 transition-colors ${paymentMethod==='ticket'?'bg-purple-600 hover:bg-purple-700':'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'}`}>{submitLabel||(paymentMethod==='ticket'?'食券で会計':'確定')}</button>
    </div>
  </div>
);
