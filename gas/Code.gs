const SHEETS = { MENU: 'Menu', SALES: 'Sales', STAFF: 'Staff' };

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '');
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') return json_({ status: 'success', version: '2.0.0' });
    if (action === 'getMenu') return json_({ status: 'success', items: readMenu_(ss) });
    if (action === 'getStaff') {
      const sheet = ss.getSheetByName(SHEETS.STAFF);
      const staff = !sheet || sheet.getLastRow() < 2 ? [] : sheet.getDataRange().getValues().slice(1)
        .filter(function(row) { return row[0]; })
        .map(function(row) { return { name: row[0], shift: row[1] || '', role: row[2] || '' }; });
      return json_({ status: 'success', staff: staff });
    }
    if (action === 'getSales') {
      const limit = Math.min(Math.max(Number(e.parameter.limit) || 50, 1), 500);
      return json_({ status: 'success', sales: readSales_(ss, limit) });
    }
    return json_({ status: 'error', message: '未対応のactionです' });
  } catch (error) {
    return error_(error);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (data.action === 'uploadImage') return uploadImage_(data);
    if (data.action === 'updateProduct') return withLock_(function() { return updateProduct_(ss, data.product); });
    if (data.action === 'deleteProduct') return withLock_(function() { return deleteProduct_(ss, data.id); });
    if (data.action === 'createOrder') return withLock_(function() { return createOrder_(ss, data.order); });

    // v1クライアントとの互換性
    if (data.items) return withLock_(function() { return createOrder_(ss, data); });
    return json_({ status: 'error', message: '未対応のactionです' });
  } catch (error) {
    return error_(error);
  }
}

function readMenu_(ss) {
  const sheet = ensureMenuSheet_(ss);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).filter(function(row) { return row[0]; }).map(function(row) {
    return {
      id: String(row[0]), category: row[1] || 'その他', name: row[2] || '',
      price: Number(row[3]) || 0, stock: Number(row[4]) || 0,
      initialStock: Number(row[4]) || 0, imageUrl: row[5] || '', toppings: parseToppings_(row[6] || '')
    };
  });
}

function readSales_(ss, limit) {
  const sheet = ensureSalesSheet_(ss);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).filter(function(row) { return row[0]; })
    .slice(-limit).reverse().map(function(row) {
      let items = [];
      try { items = JSON.parse(row[2] || '[]'); } catch (ignore) {}
      return {
        timestamp: row[0] instanceof Date ? row[0].toISOString() : row[0], total: Number(row[1]) || 0,
        items: items, paymentMethod: row[3], deviceId: row[4], orderNumber: row[5],
        staffName: row[6], isCanceled: row[7] === true, clientOrderId: row[8] || ''
      };
    });
}

function createOrder_(ss, order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) throw new Error('注文内容が空です');
  if (!order.clientOrderId) order.clientOrderId = Utilities.getUuid();

  const salesSheet = ensureSalesSheet_(ss);
  const existing = findOrderByClientId_(salesSheet, order.clientOrderId);
  if (existing) return json_({ status: 'success', duplicate: true, orderNumber: existing.orderNumber });

  const menuSheet = ensureMenuSheet_(ss);
  const values = menuSheet.getDataRange().getValues();
  const rowById = {};
  for (let i = 1; i < values.length; i++) if (values[i][0]) rowById[String(values[i][0])] = i + 1;

  const quantities = {};
  order.items.forEach(function(item) {
    const id = String(item.id || '');
    if (!id || id.indexOf('custom') === 0) return;
    quantities[id] = (quantities[id] || 0) + Math.max(0, Number(item.quantity) || 0);
  });

  Object.keys(quantities).forEach(function(id) {
    if (!rowById[id]) throw new Error('商品が見つかりません: ' + id);
    const currentStock = Number(values[rowById[id] - 1][4]) || 0;
    if (currentStock < quantities[id]) throw new Error(values[rowById[id] - 1][2] + 'の在庫が不足しています（残り' + currentStock + '）');
  });

  Object.keys(quantities).forEach(function(id) {
    const row = rowById[id];
    const nextStock = (Number(values[row - 1][4]) || 0) - quantities[id];
    menuSheet.getRange(row, 5).setValue(nextStock);
  });

  const orderNumber = nextOrderNumber_(salesSheet);
  salesSheet.appendRow([
    order.timestamp || new Date().toISOString(), Number(order.total) || 0, JSON.stringify(order.items),
    order.paymentMethod || 'cash', order.deviceId || '', orderNumber, order.staffName || '', false, order.clientOrderId
  ]);
  SpreadsheetApp.flush();
  return json_({ status: 'success', orderNumber: orderNumber });
}

function updateProduct_(ss, product) {
  if (!product || !product.id || !String(product.name || '').trim()) throw new Error('商品IDと商品名は必須です');
  const sheet = ensureMenuSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const row = [String(product.id), product.category || 'その他', String(product.name).trim(), Number(product.price) || 0,
    Math.max(0, Number(product.stock) || 0), product.imageUrl || '', stringifyToppings_(product.toppings || [])];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(product.id)) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([row]);
      return json_({ status: 'success', id: String(product.id) });
    }
  }
  sheet.appendRow(row);
  return json_({ status: 'success', id: String(product.id) });
}

function deleteProduct_(ss, id) {
  const sheet = ensureMenuSheet_(ss);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return json_({ status: 'success' });
    }
  }
  throw new Error('削除対象の商品が見つかりません');
}

function uploadImage_(data) {
  if (!data.base64) throw new Error('画像データがありません');
  const blob = Utilities.newBlob(Utilities.base64Decode(data.base64), data.mimeType || 'image/jpeg', data.filename || 'product.jpg');
  const folders = DriveApp.getFoldersByName('BunkasaiPOS_Images');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('BunkasaiPOS_Images');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return json_({ status: 'success', url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400' });
}

function nextOrderNumber_(salesSheet) {
  if (salesSheet.getLastRow() < 2) return 1;
  const nums = salesSheet.getRange(2, 6, salesSheet.getLastRow() - 1, 1).getValues();
  return nums.reduce(function(max, row) { const n = Number(row[0]); return Number.isFinite(n) ? Math.max(max, n) : max; }, 0) + 1;
}

function findOrderByClientId_(sheet, clientOrderId) {
  if (sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 6, sheet.getLastRow() - 1, 4).getValues();
  for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][3]) === String(clientOrderId)) return { orderNumber: rows[i][0] };
  return null;
}

function ensureMenuSheet_(ss) {
  let sheet = ss.getSheetByName(SHEETS.MENU);
  if (!sheet) sheet = ss.insertSheet(SHEETS.MENU);
  if (sheet.getLastRow() === 0) sheet.appendRow(['ID', 'Category', 'Name', 'Price', 'Stock', 'ImageUrl', 'Toppings']);
  return sheet;
}

function ensureSalesSheet_(ss) {
  let sheet = ss.getSheetByName(SHEETS.SALES);
  if (!sheet) sheet = ss.insertSheet(SHEETS.SALES);
  if (sheet.getLastRow() === 0) sheet.appendRow(['Date', 'Total', 'Items', 'PaymentMethod', 'Device', 'OrderNum', 'Staff', 'Canceled', 'ClientOrderId']);
  else if (sheet.getLastColumn() < 9) sheet.getRange(1, 9).setValue('ClientOrderId');
  return sheet;
}

function parseToppings_(text) {
  if (!text) return [];
  return String(text).split(',').map(function(value) {
    const parts = value.trim().split(':');
    return parts.length >= 2 ? { name: parts[0].trim(), price: Number(parts[1]) || 0 } : null;
  }).filter(function(value) { return value && value.name; });
}

function stringifyToppings_(toppings) {
  return toppings.map(function(item) { return item.name + ':' + (Number(item.price) || 0); }).join(', ');
}

function withLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('ほかの端末が処理中です。もう一度実行してください');
  try { return callback(); } finally { lock.releaseLock(); }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function error_(error) {
  return json_({ status: 'error', message: error && error.message ? error.message : String(error) });
}
