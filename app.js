// ============================================================
// app.js - المنطق البرمجي الكامل لنظام POS
// ============================================================

'use strict';

// ── الإعدادات العامة ──────────────────────────────────────
const API = 'api.php?action=';
const AUTH = 'auth.php?action=';
const CURRENCY = 'DH';
const WHATSAPP_NUM = '+212600000000'; // ← غير هذا

// ── الحالة العامة ─────────────────────────────────────────
const State = {
  user: null,
  cart: [],
  products: [],
  categories: [],
  customers: [],
  currentCategory: 0,
  currentSort: 'popular',
  orderType: 'dine_in',
  payMethod: 'cash',
  selectedCustomer: null,
  currentDebtId: null,
  chartSales: null,
  chartTop: null,
  taxRate: 0,
  settings: {},
  viewMode: 'grid', // grid | list
};

// ── بدء التطبيق ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  registerServiceWorker();
  applyDarkMode();
});

async function initApp() {
  // تحقق من تسجيل الدخول (LocalStorage كـ fallback)
  const saved = localStorage.getItem('pos_user');
  if (saved) {
    State.user = JSON.parse(saved);
    showApp();
  }
  // وإلا تبقى شاشة الدخول
}

// ══════════════════════════════════════════════════════════
// ── المصادقة ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;

  // محاكاة بدون Backend (للعمل offline)
  const users = {
    admin:  { username: 'admin',  password: 'admin123',  full_name: 'المدير العام', role: 'admin' },
    worker: { username: 'worker', password: 'worker123', full_name: 'موظف الكاشير', role: 'worker' },
  };

  const user = users[username];
  if (user && user.password === password) {
    State.user = user;
    localStorage.setItem('pos_user', JSON.stringify(user));
    showApp();
    toast('مرحباً ' + user.full_name + ' 👋', 'success');
  } else {
    // جرب API
    try {
      const res = await post(AUTH + 'login', { username, password });
      if (res.success) {
        State.user = res.data;
        localStorage.setItem('pos_user', JSON.stringify(res.data));
        showApp();
        toast('مرحباً ' + res.data.full_name + ' 👋', 'success');
      } else {
        toast('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
      }
    } catch {
      toast('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
    }
  }
}

function handleLogout() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  localStorage.removeItem('pos_user');
  State.user = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  toast('تم تسجيل الخروج', 'info');
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userBadge').textContent = State.user.role === 'admin' ? 'مدير' : 'موظف';

  // إخفاء عناصر المدير إذا كان موظفاً
  if (State.user.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }

  loadSettings();
  showPage('pos');
}

// ══════════════════════════════════════════════════════════
// ── التنقل بين الصفحات ────────────────────────────────────
// ══════════════════════════════════════════════════════════

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  // تحميل بيانات الصفحة
  switch (page) {
    case 'pos':       loadPOS(); break;
    case 'orders':    loadOrders('day'); break;
    case 'products':  loadProductsAdmin(); break;
    case 'customers': loadCustomers(); break;
    case 'debts':     loadDebts(); break;
    case 'expenses':  loadExpenses(); break;
    case 'reports':   loadReports('day'); break;
    case 'admin':     loadAdmin(); break;
  }
}

// ══════════════════════════════════════════════════════════
// ── POS الرئيسي ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadPOS() {
  await loadCategories();
  await loadProducts();
  renderCart();
  loadFromStorage();
}

async function loadCategories() {
  try {
    const res = await get('get_categories');
    State.categories = res.data || getLocalCategories();
  } catch {
    State.categories = getLocalCategories();
  }
  renderCategories();
}

function getLocalCategories() {
  return [
    { id: 1, name: 'المشروبات الساخنة', icon: '☕' },
    { id: 2, name: 'المشروبات الباردة', icon: '🧊' },
    { id: 3, name: 'الوجبات الرئيسية', icon: '🍽️' },
    { id: 4, name: 'السندويشات', icon: '🥪' },
    { id: 5, name: 'الحلويات', icon: '🍰' },
  ];
}

function renderCategories() {
  const bar = document.getElementById('categoriesBar');
  bar.innerHTML = `<button class="cat-btn active" onclick="filterCategory(0, this)">🏠 الكل</button>`;
  State.categories.forEach(c => {
    bar.innerHTML += `<button class="cat-btn" onclick="filterCategory(${c.id}, this)">${c.icon} ${c.name}</button>`;
  });
}

async function loadProducts() {
  try {
    const res = await get(`get_products&category=${State.currentCategory}&sort=${State.currentSort}`);
    State.products = res.data || getLocalProducts();
  } catch {
    State.products = getLocalProducts();
  }
  renderProducts(State.products);
}

function getLocalProducts() {
  const saved = localStorage.getItem('pos_products');
  if (saved) return JSON.parse(saved);
  return [
    { id: 1, name: 'قهوة عربية', description: 'قهوة عربية أصيلة بالهيل', category_id: 1, selling_price: 15, purchase_price: 5, stock: 100, is_featured: true, total_sold: 245, image_url: '', category_name: 'المشروبات الساخنة' },
    { id: 2, name: 'كابتشينو', description: 'كابتشينو إيطالي ممتاز', category_id: 1, selling_price: 22, purchase_price: 8, stock: 80, is_featured: true, total_sold: 198, image_url: '', category_name: 'المشروبات الساخنة' },
    { id: 3, name: 'شاي أخضر', description: 'شاي أخضر طبيعي', category_id: 1, selling_price: 12, purchase_price: 3, stock: 150, is_featured: false, total_sold: 156, image_url: '', category_name: 'المشروبات الساخنة' },
    { id: 4, name: 'لاتيه', description: 'لاتيه بالحليب الطازج', category_id: 1, selling_price: 25, purchase_price: 9, stock: 60, is_featured: true, total_sold: 134, image_url: '', category_name: 'المشروبات الساخنة' },
    { id: 5, name: 'عصير برتقال', description: 'عصير برتقال طبيعي طازج', category_id: 2, selling_price: 18, purchase_price: 6, stock: 50, is_featured: true, total_sold: 312, image_url: '', category_name: 'المشروبات الباردة' },
    { id: 6, name: 'موهيتو', description: 'موهيتو بالنعناع والليمون', category_id: 2, selling_price: 20, purchase_price: 7, stock: 45, is_featured: true, total_sold: 220, image_url: '', category_name: 'المشروبات الباردة' },
    { id: 7, name: 'عصير فراولة', description: 'عصير فراولة مع آيس كريم', category_id: 2, selling_price: 22, purchase_price: 8, stock: 40, is_featured: false, total_sold: 187, image_url: '', category_name: 'المشروبات الباردة' },
    { id: 8, name: 'ماء معدني', description: 'ماء معدني 500ml', category_id: 2, selling_price: 5, purchase_price: 2, stock: 200, is_featured: false, total_sold: 450, image_url: '', category_name: 'المشروبات الباردة' },
    { id: 9, name: 'برغر كلاسيك', description: 'برغر لحم مع خضروات طازجة', category_id: 3, selling_price: 55, purchase_price: 25, stock: 30, is_featured: true, total_sold: 89, image_url: '', category_name: 'الوجبات الرئيسية' },
    { id: 10, name: 'دجاج مشوي', description: 'دجاج مشوي مع أرز وسلطة', category_id: 3, selling_price: 65, purchase_price: 30, stock: 25, is_featured: true, total_sold: 76, image_url: '', category_name: 'الوجبات الرئيسية' },
    { id: 11, name: 'بيتزا مارغريتا', description: 'بيتزا بالجبن والطماطم', category_id: 3, selling_price: 75, purchase_price: 35, stock: 15, is_featured: true, total_sold: 92, image_url: '', category_name: 'الوجبات الرئيسية' },
    { id: 12, name: 'سندويش شاورما', description: 'شاورما دجاج بالصوص الخاص', category_id: 4, selling_price: 35, purchase_price: 15, stock: 40, is_featured: true, total_sold: 267, image_url: '', category_name: 'السندويشات' },
    { id: 13, name: 'سندويش كلوب', description: 'سندويش كلوب ثلاثي الطوابق', category_id: 4, selling_price: 40, purchase_price: 18, stock: 35, is_featured: false, total_sold: 143, image_url: '', category_name: 'السندويشات' },
    { id: 14, name: 'كيك شوكولاتة', description: 'كيك شوكولاتة بلجيكي', category_id: 5, selling_price: 30, purchase_price: 12, stock: 20, is_featured: true, total_sold: 98, image_url: '', category_name: 'الحلويات' },
    { id: 15, name: 'تشيز كيك', description: 'تشيز كيك كريمي بالفراولة', category_id: 5, selling_price: 35, purchase_price: 15, stock: 15, is_featured: false, total_sold: 72, image_url: '', category_name: 'الحلويات' },
  ];
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products.length) {
    grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text3)">لا توجد منتجات</div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const outOfStock = p.stock <= 0;
    const imgContent = p.image_url
      ? `<img src="${p.image_url}" alt="${p.name}" onerror="this.parentElement.innerHTML='${getProductEmoji(p.category_id)}'>"` 
      : getProductEmoji(p.category_id);

    return `
      <div class="product-card ${outOfStock ? 'out-of-stock' : ''}" 
           onclick="${outOfStock ? '' : `addToCart(${p.id})`}"
           data-id="${p.id}">
        ${p.is_featured ? '<span class="featured-badge">⭐ مميز</span>' : ''}
        <div class="product-img">${imgContent}</div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${p.description || ''}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="product-price">${p.selling_price} ${CURRENCY}</div>
            <div class="product-stock ${p.stock <= 5 ? 'stock-low' : 'stock-ok'}">
              ${p.stock > 0 ? `📦 ${p.stock}` : '❌ نفد'}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getProductEmoji(catId) {
  const emojis = { 1: '☕', 2: '🧃', 3: '🍽️', 4: '🥪', 5: '🍰' };
  return `<span style="font-size:2.5rem">${emojis[catId] || '📦'}</span>`;
}

function filterCategory(catId, btn) {
  State.currentCategory = catId;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadProducts();
}

function sortProducts(sort, btn) {
  State.currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadProducts();
}

function filterProducts() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  if (!q) { renderProducts(State.products); return; }
  const filtered = State.products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.description && p.description.toLowerCase().includes(q)) ||
    (p.barcode && p.barcode.includes(q))
  );
  renderProducts(filtered);
}

function toggleView() {
  State.viewMode = State.viewMode === 'grid' ? 'list' : 'grid';
  const grid = document.getElementById('productsGrid');
  const icon = document.getElementById('viewIcon');
  if (State.viewMode === 'list') {
    grid.style.gridTemplateColumns = '1fr';
    icon.className = 'fas fa-th';
  } else {
    grid.style.gridTemplateColumns = '';
    icon.className = 'fas fa-list';
  }
}

// ══════════════════════════════════════════════════════════
// ── السلة ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

function addToCart(productId) {
  const product = State.products.find(p => p.id === productId);
  if (!product) return;

  const existing = State.cart.find(i => i.id === productId);
  if (existing) {
    if (existing.quantity >= product.stock) {
      toast('لا يمكن إضافة أكثر من المخزون المتاح', 'warning'); return;
    }
    existing.quantity++;
  } else {
    State.cart.push({ ...product, quantity: 1, notes: '' });
  }

  renderCart();
  saveCartToStorage();
  playSound();
  animateCartItem(productId);
  toast(`✅ تم إضافة ${product.name}`, 'success');
}

function removeFromCart(productId) {
  State.cart = State.cart.filter(i => i.id !== productId);
  renderCart();
  saveCartToStorage();
}

function changeQty(productId, delta) {
  const item = State.cart.find(i => i.id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) { removeFromCart(productId); return; }
  const product = State.products.find(p => p.id === productId);
  if (product && item.quantity > product.stock) {
    item.quantity = product.stock;
    toast('وصلت للحد الأقصى من المخزون', 'warning');
  }
  renderCart();
  saveCartToStorage();
}

function clearCart() {
  if (!State.cart.length) return;
  if (!confirm('هل تريد إفراغ السلة؟')) return;
  State.cart = [];
  State.selectedCustomer = null;
  document.getElementById('cartCustomer').style.display = 'none';
  document.getElementById('discountValue').value = 0;
  document.getElementById('orderNotes').value = '';
  document.getElementById('amountPaid').value = '';
  renderCart();
  saveCartToStorage();
}

function renderCart() {
  const container = document.getElementById('cartItems');

  if (!State.cart.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <i class="fas fa-shopping-cart"></i>
        <p>السلة فارغة</p>
        <small>اضغط على منتج لإضافته</small>
      </div>`;
    updateTotals();
    return;
  }

  container.innerHTML = State.cart.map(item => `
    <div class="cart-item" id="cart-item-${item.id}">
      <div style="flex:1">
        <div class="cart-item-name">${item.name}</div>
        <input type="text" value="${item.notes}" placeholder="ملاحظة..." 
               class="cart-item-note" style="border:none;background:none;font-family:var(--font);width:100%;font-size:0.75rem;color:var(--text3)"
               onchange="updateItemNote(${item.id}, this.value)">
      </div>
      <div class="qty-controls">
        <button class="qty-btn minus" onclick="changeQty(${item.id}, -1)">−</button>
        <span class="qty-num">${item.quantity}</span>
        <button class="qty-btn plus" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <div class="cart-item-price">${(item.selling_price * item.quantity).toFixed(2)} ${CURRENCY}</div>
      <button class="cart-item-del" onclick="removeFromCart(${item.id})">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
  `).join('');

  updateTotals();
}

function updateItemNote(productId, note) {
  const item = State.cart.find(i => i.id === productId);
  if (item) item.notes = note;
  saveCartToStorage();
}

function updateTotals() {
  const subtotal = State.cart.reduce((sum, i) => sum + (i.selling_price * i.quantity), 0);
  const discType = document.getElementById('discountType')?.value || 'fixed';
  const discVal  = parseFloat(document.getElementById('discountValue')?.value) || 0;
  const discAmt  = discType === 'percent' ? subtotal * discVal / 100 : discVal;
  const taxable  = subtotal - discAmt;
  const taxAmt   = taxable * (State.taxRate / 100);
  const total    = taxable + taxAmt;

  document.getElementById('subtotalVal').textContent = subtotal.toFixed(2) + ' ' + CURRENCY;
  document.getElementById('discountVal').textContent = '-' + discAmt.toFixed(2) + ' ' + CURRENCY;
  document.getElementById('taxVal').textContent = taxAmt.toFixed(2) + ' ' + CURRENCY;
  document.getElementById('totalVal').textContent = total.toFixed(2) + ' ' + CURRENCY;
  if (State.taxRate > 0) document.getElementById('taxRow').style.display = '';

  calcChange();
}

function calcChange() {
  const total = parseFloat(document.getElementById('totalVal')?.textContent) || 0;
  const paid  = parseFloat(document.getElementById('amountPaid')?.value) || 0;
  const changeDisplay = document.getElementById('changeDisplay');
  const changeAmount  = document.getElementById('changeAmount');

  if (paid > 0 && State.payMethod === 'cash') {
    const change = paid - total;
    changeDisplay.style.display = 'block';
    changeAmount.textContent = change.toFixed(2);
    changeAmount.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
  } else {
    changeDisplay.style.display = 'none';
  }
}

function setOrderType(type, btn) {
  State.orderType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setPayMethod(method, btn) {
  State.payMethod = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cashRow = document.getElementById('cashRow');
  cashRow.style.display = method === 'cash' ? 'flex' : 'none';
}

// ══════════════════════════════════════════════════════════
// ── الدفع والطلبات ────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function checkout() {
  if (!State.cart.length) { toast('السلة فارغة!', 'warning'); return; }

  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...';

  const total   = parseFloat(document.getElementById('totalVal').textContent) || 0;
  const discVal = parseFloat(document.getElementById('discountValue').value) || 0;
  const discTyp = document.getElementById('discountType').value;
  const subtotal = State.cart.reduce((s, i) => s + i.selling_price * i.quantity, 0);
  const discAmt  = discTyp === 'percent' ? subtotal * discVal / 100 : discVal;
  const taxAmt   = (subtotal - discAmt) * (State.taxRate / 100);
  const amtPaid  = parseFloat(document.getElementById('amountPaid').value) || total;

  const orderData = {
    items: State.cart.map(i => ({
      id: i.id, name: i.name, quantity: i.quantity,
      notes: i.notes || '', unit_price: i.selling_price,
    })),
    customer_id:      State.selectedCustomer?.id || null,
    customer_name:    State.selectedCustomer?.name || 'زبون',
    customer_phone:   State.selectedCustomer?.phone || '',
    order_type:       State.orderType,
    subtotal, discount_type: discTyp, discount_value: discVal,
    discount_amount: discAmt, tax_rate: State.taxRate, tax_amount: taxAmt,
    total, payment_method: State.payMethod,
    payment_status:   State.payMethod === 'debt' ? 'unpaid' : 'paid',
    amount_paid: amtPaid,
    notes: document.getElementById('orderNotes').value,
    cashier_name: State.user?.full_name || 'admin',
  };

  try {
    // حفظ محلياً أولاً
    const orderNum = saveOrderLocally(orderData);

    // محاولة API
    try {
      const res = await post('create_order', orderData);
      if (res.success) {
        showOrderSuccess(res.data.order_number || orderNum, total, res.data.change || 0);
      } else {
        showOrderSuccess(orderNum, total, amtPaid - total);
      }
    } catch {
      showOrderSuccess(orderNum, total, amtPaid - total);
    }

    // إعادة تعيين السلة
    State.cart = [];
    State.selectedCustomer = null;
    document.getElementById('cartCustomer').style.display = 'none';
    document.getElementById('orderNotes').value = '';
    document.getElementById('discountValue').value = 0;
    document.getElementById('amountPaid').value = '';
    renderCart();
    saveCartToStorage();

    // تحديث المنتجات (المخزون)
    orderData.items.forEach(item => {
      const p = State.products.find(p => p.id === item.id);
      if (p) { p.stock = Math.max(0, p.stock - item.quantity); p.total_sold += item.quantity; }
    });
    renderProducts(State.products);
    updateBadges();

  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد الطلب';
  }
}

function saveOrderLocally(orderData) {
  const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
  const num = 'ORD-' + Date.now();
  const order = {
    ...orderData,
    id: Date.now(),
    order_number: num,
    order_status: 'pending',
    order_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    items_count: orderData.items.length,
  };
  orders.unshift(order);
  localStorage.setItem('pos_orders', JSON.stringify(orders.slice(0, 200)));

  // تحديث إحصائيات اليوم
  const today = new Date().toDateString();
  const dailyStats = JSON.parse(localStorage.getItem('pos_daily') || '{}');
  if (!dailyStats[today]) dailyStats[today] = { orders: 0, revenue: 0, profit: 0, topProducts: {} };
  dailyStats[today].orders++;
  dailyStats[today].revenue += orderData.total;
  const profit = orderData.items.reduce((s, i) => {
    const p = State.products.find(pr => pr.id === i.id);
    return s + ((p ? p.selling_price - p.purchase_price : 0) * i.quantity);
  }, 0);
  dailyStats[today].profit += profit;
  orderData.items.forEach(i => {
    if (!dailyStats[today].topProducts[i.name]) dailyStats[today].topProducts[i.name] = 0;
    dailyStats[today].topProducts[i.name] += i.quantity;
  });
  localStorage.setItem('pos_daily', JSON.stringify(dailyStats));

  return num;
}

function showOrderSuccess(orderNum, total, change) {
  playSound();
  const msg = `
    <div style="text-align:center;padding:1.5rem">
      <div style="font-size:4rem;margin-bottom:1rem">✅</div>
      <h2 style="color:var(--success);margin-bottom:0.5rem">تم تأكيد الطلب!</h2>
      <p style="font-size:1.2rem;font-weight:700">${orderNum}</p>
      <p style="color:var(--text2);margin-top:0.5rem">المجموع: ${total.toFixed(2)} ${CURRENCY}</p>
      ${change > 0 ? `<p style="color:var(--success);font-weight:700;font-size:1.1rem">الباقي: ${change.toFixed(2)} ${CURRENCY}</p>` : ''}
    </div>
  `;
  showTempModal(msg, 2500);
  toast(`✅ طلب ${orderNum} تم بنجاح`, 'success');
}

// ══════════════════════════════════════════════════════════
// ── الطلبات (صفحة) ────────────────────────────────────────
// ══════════════════════════════════════════════════════════

let currentOrderPeriod = 'day';

async function loadOrders(period, btn) {
  if (period) {
    currentOrderPeriod = period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  const status = document.getElementById('statusFilter')?.value || '';
  let orders = [];

  try {
    const res = await get(`get_orders&period=${currentOrderPeriod}&status=${status}`);
    orders = res.data || [];
  } catch {
    orders = getLocalOrders(currentOrderPeriod, status);
  }

  renderOrders(orders);
  updateBadges();
}

function getLocalOrders(period, status) {
  const all = JSON.parse(localStorage.getItem('pos_orders') || '[]');
  const now = new Date();
  return all.filter(o => {
    const oDate = new Date(o.created_at);
    if (period === 'day' && oDate.toDateString() !== now.toDateString()) return false;
    if (period === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      if (oDate < weekAgo) return false;
    }
    if (period === 'month' && (oDate.getMonth() !== now.getMonth() || oDate.getFullYear() !== now.getFullYear())) return false;
    if (status && o.order_status !== status) return false;
    return true;
  });
}

function renderOrders(orders) {
  const container = document.getElementById('ordersList');
  if (!orders.length) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text3)">لا توجد طلبات</div>';
    return;
  }
  container.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-card-header">
        <span class="order-num">${o.order_number}</span>
        <span class="order-customer"><i class="fas fa-user"></i> ${o.customer_name || 'زبون'}</span>
        <span class="order-status status-${o.order_status}">${statusLabel(o.order_status)}</span>
        <span class="order-total">${parseFloat(o.total || 0).toFixed(2)} ${CURRENCY}</span>
        <small style="color:var(--text3)">${formatDate(o.created_at)}</small>
      </div>
      <div style="color:var(--text2);font-size:0.85rem;margin-bottom:0.7rem">
        ${o.items_count || 0} منتج | ${orderTypeLabel(o.order_type)} | ${paymentLabel(o.payment_method)}
        ${o.payment_status === 'unpaid' ? '<span style="color:var(--danger);font-weight:700"> ⚠️ غير مدفوع</span>' : ''}
      </div>
      <div class="order-card-actions">
        <select onchange="updateOrderStatus(${o.id}, this.value)">
          <option value="pending" ${o.order_status==='pending'?'selected':''}>⏳ قيد التحضير</option>
          <option value="preparing" ${o.order_status==='preparing'?'selected':''}>👨‍🍳 يُحضَّر</option>
          <option value="ready" ${o.order_status==='ready'?'selected':''}>✅ جاهز</option>
          <option value="delivered" ${o.order_status==='delivered'?'selected':''}>🏠 تم التسليم</option>
          <option value="cancelled" ${o.order_status==='cancelled'?'selected':''}>❌ ملغي</option>
        </select>
        <button class="btn-secondary" onclick="showInvoice(${JSON.stringify(o).replace(/"/g,'&quot;')})">
          <i class="fas fa-file-invoice"></i> فاتورة
        </button>
        <button class="btn-secondary" onclick="sendOrderWhatsApp(${JSON.stringify(o).replace(/"/g,'&quot;')})">
          <i class="fab fa-whatsapp"></i>
        </button>
      </div>
    </div>
  `).join('');
}

async function updateOrderStatus(orderId, status) {
  try {
    await post('update_order_status', { id: orderId, status });
  } catch {}
  // تحديث محلياً
  const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) { orders[idx].order_status = status; localStorage.setItem('pos_orders', JSON.stringify(orders)); }
  toast('تم تحديث حالة الطلب', 'success');
  updateBadges();
}

// ══════════════════════════════════════════════════════════
// ── الفاتورة ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

function showInvoice(order) {
  const items = order.items || [];
  const shopName = State.settings.shop_name || 'كافيه النخبة';
  const shopPhone = State.settings.shop_phone || '';
  const footer = State.settings.receipt_footer || 'شكراً لزيارتكم! 🌟';

  document.getElementById('invoiceContent').innerHTML = `
    <div class="invoice-content" id="printArea">
      <div class="invoice-header">
        <h2>☕ ${shopName}</h2>
        <p>${State.settings.shop_address || ''}</p>
        <p>${shopPhone}</p>
        <hr class="invoice-divider">
        <div style="display:flex;justify-content:space-between;font-size:0.85rem">
          <span>رقم الطلب: <strong>${order.order_number}</strong></span>
          <span>${formatDate(order.created_at)}</span>
        </div>
        <div style="font-size:0.85rem">العميل: ${order.customer_name || 'زبون'}</div>
      </div>
      <hr class="invoice-divider">
      <table class="invoice-table">
        <thead>
          <tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr>
        </thead>
        <tbody>
          ${(items.length ? items : (order.items_count ? [{product_name: 'المنتجات', quantity: order.items_count, unit_price: '', total_price: order.subtotal}] : [])).map(i => `
            <tr>
              <td>${i.product_name || i.name}</td>
              <td style="text-align:center">${i.quantity}</td>
              <td>${i.unit_price ? i.unit_price + ' ' + CURRENCY : ''}</td>
              <td>${parseFloat(i.total_price || 0).toFixed(2)} ${CURRENCY}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <hr class="invoice-divider">
      <div class="invoice-totals">
        <div class="invoice-total-line"><span>المجموع الفرعي</span><span>${parseFloat(order.subtotal || 0).toFixed(2)} ${CURRENCY}</span></div>
        ${parseFloat(order.discount_amount || 0) > 0 ? `<div class="invoice-total-line"><span>الخصم</span><span>-${parseFloat(order.discount_amount).toFixed(2)} ${CURRENCY}</span></div>` : ''}
        ${parseFloat(order.tax_amount || 0) > 0 ? `<div class="invoice-total-line"><span>الضريبة</span><span>${parseFloat(order.tax_amount).toFixed(2)} ${CURRENCY}</span></div>` : ''}
        <div class="invoice-total-line final"><span>المجموع الإجمالي</span><span>${parseFloat(order.total || 0).toFixed(2)} ${CURRENCY}</span></div>
        <div class="invoice-total-line"><span>طريقة الدفع</span><span>${paymentLabel(order.payment_method)}</span></div>
        ${parseFloat(order.change_amount || 0) > 0 ? `<div class="invoice-total-line"><span>الباقي</span><span>${parseFloat(order.change_amount).toFixed(2)} ${CURRENCY}</span></div>` : ''}
      </div>
      <hr class="invoice-divider">
      <div class="invoice-footer">${footer}</div>
    </div>
  `;
  openModal('invoiceModal');
  window._currentOrder = order;
}

function printInvoice() { window.print(); }

function sendInvoiceWhatsApp() {
  const o = window._currentOrder;
  if (!o) return;
  sendOrderWhatsApp(o);
}

function sendOrderWhatsApp(order) {
  const items = (order.items || []).map(i => `• ${i.product_name || i.name} x${i.quantity} = ${parseFloat(i.total_price || 0).toFixed(2)} ${CURRENCY}`).join('\n');
  const msg = `*${State.settings.shop_name || 'كافيه النخبة'}*\n`
    + `────────────\n`
    + `🧾 طلب: ${order.order_number}\n`
    + `👤 العميل: ${order.customer_name || 'زبون'}\n`
    + `────────────\n`
    + `${items || '(تفاصيل الطلب)'}\n`
    + `────────────\n`
    + `💰 المجموع: *${parseFloat(order.total || 0).toFixed(2)} ${CURRENCY}*\n`
    + `📅 ${formatDate(order.created_at)}\n`
    + `شكراً لكم! 🌟`;
  window.open('https://wa.me/' + WHATSAPP_NUM.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg));
}

function sendWhatsApp() {
  if (!State.cart.length) { toast('السلة فارغة', 'warning'); return; }
  const total = document.getElementById('totalVal').textContent;
  const items = State.cart.map(i => `• ${i.name} x${i.quantity} = ${(i.selling_price * i.quantity).toFixed(2)} ${CURRENCY}`).join('\n');
  const msg = `*${State.settings.shop_name || 'كافيه النخبة'}*\n────────────\n${items}\n────────────\n💰 المجموع: *${total}*\nشكراً لكم! 🌟`;
  window.open('https://wa.me/' + WHATSAPP_NUM.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg));
}

function printQuickReceipt() {
  if (!State.cart.length) { toast('السلة فارغة', 'warning'); return; }
  const fakeOrder = {
    order_number: 'DRAFT-' + Date.now(),
    customer_name: State.selectedCustomer?.name || 'زبون',
    created_at: new Date().toISOString(),
    items: State.cart.map(i => ({ product_name: i.name, quantity: i.quantity, unit_price: i.selling_price, total_price: i.selling_price * i.quantity })),
    subtotal: State.cart.reduce((s, i) => s + i.selling_price * i.quantity, 0),
    discount_amount: 0, tax_amount: 0,
    total: parseFloat(document.getElementById('totalVal').textContent) || 0,
    payment_method: State.payMethod, change_amount: 0,
  };
  showInvoice(fakeOrder);
  setTimeout(() => window.print(), 300);
}

// ══════════════════════════════════════════════════════════
// ── المنتجات (إدارة) ──────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadProductsAdmin() {
  const products = State.products.length ? State.products : getLocalProducts();
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${p.name}</strong><br><small style="color:var(--text3)">${p.description || ''}</small></td>
      <td>${p.category_name || '-'}</td>
      <td>${p.purchase_price} ${CURRENCY}</td>
      <td>${p.selling_price} ${CURRENCY} <span class="profit-badge">+${(p.selling_price - p.purchase_price).toFixed(2)}</span></td>
      <td class="${p.stock <= (p.min_stock || 5) ? 'stock-low' : 'stock-ok'}">${p.stock}</td>
      <td>${p.total_sold || 0}</td>
      <td>
        <button class="btn-icon" onclick="editProduct(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>
        <button class="btn-icon danger" onclick="deleteProduct(${p.id})" title="حذف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');

  // تحميل الفئات للمودال
  const catSelect = document.getElementById('prodCategory');
  if (catSelect) {
    catSelect.innerHTML = State.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  }
}

function openProductModal(product = null) {
  document.getElementById('productModalTitle').textContent = product ? 'تعديل منتج' : 'إضافة منتج';
  document.getElementById('prodId').value = product?.id || '';
  document.getElementById('prodName').value = product?.name || '';
  document.getElementById('prodDesc').value = product?.description || '';
  document.getElementById('prodBarcode').value = product?.barcode || '';
  document.getElementById('prodPurchase').value = product?.purchase_price || '';
  document.getElementById('prodSelling').value = product?.selling_price || '';
  document.getElementById('prodStock').value = product?.stock || 0;
  document.getElementById('prodMinStock').value = product?.min_stock || 5;
  document.getElementById('prodImage').value = product?.image_url || '';
  document.getElementById('prodFeatured').value = product?.is_featured ? '1' : '0';
  if (product?.category_id) document.getElementById('prodCategory').value = product.category_id;
  openModal('productModal');
}

function editProduct(id) {
  const p = State.products.find(p => p.id === id) || getLocalProducts().find(p => p.id === id);
  if (p) openProductModal(p);
}

async function saveProduct() {
  const id = document.getElementById('prodId').value;
  const data = {
    id: id ? parseInt(id) : undefined,
    name:           document.getElementById('prodName').value,
    description:    document.getElementById('prodDesc').value,
    barcode:        document.getElementById('prodBarcode').value,
    category_id:    parseInt(document.getElementById('prodCategory').value),
    purchase_price: parseFloat(document.getElementById('prodPurchase').value) || 0,
    selling_price:  parseFloat(document.getElementById('prodSelling').value) || 0,
    stock:          parseInt(document.getElementById('prodStock').value) || 0,
    min_stock:      parseInt(document.getElementById('prodMinStock').value) || 5,
    image_url:      document.getElementById('prodImage').value,
    is_featured:    document.getElementById('prodFeatured').value === '1',
  };

  if (!data.name) { toast('أدخل اسم المنتج', 'warning'); return; }

  try {
    const action = id ? 'update_product' : 'add_product';
    await post(action, data);
  } catch {}

  // حفظ محلياً
  const products = getLocalProducts();
  if (id) {
    const idx = products.findIndex(p => p.id === parseInt(id));
    if (idx !== -1) products[idx] = { ...products[idx], ...data };
  } else {
    data.id = Date.now();
    data.total_sold = 0;
    data.category_name = State.categories.find(c => c.id === data.category_id)?.name || '';
    products.push(data);
    State.products.push(data);
  }
  localStorage.setItem('pos_products', JSON.stringify(products));
  State.products = products;

  closeModal('productModal');
  loadProductsAdmin();
  toast(id ? 'تم تحديث المنتج ✅' : 'تم إضافة المنتج ✅', 'success');
}

async function deleteProduct(id) {
  if (!confirm('هل تريد حذف هذا المنتج؟')) return;
  try { await post('delete_product', { id }); } catch {}
  State.products = State.products.filter(p => p.id !== id);
  const local = getLocalProducts().filter(p => p.id !== id);
  localStorage.setItem('pos_products', JSON.stringify(local));
  loadProductsAdmin();
  toast('تم حذف المنتج', 'info');
}

// ══════════════════════════════════════════════════════════
// ── العملاء ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadCustomers(search = '') {
  try {
    const res = await get('get_customers&search=' + search);
    State.customers = res.data || [];
  } catch {
    State.customers = JSON.parse(localStorage.getItem('pos_customers') || '[]');
  }
  renderCustomers(search ? State.customers.filter(c => c.name.includes(search) || c.phone?.includes(search)) : State.customers);
}

function renderCustomers(customers) {
  const container = document.getElementById('customersList');
  if (!customers.length) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text3)">لا يوجد عملاء</div>';
    return;
  }
  container.innerHTML = customers.map(c => `
    <div class="customer-card">
      <div class="customer-avatar">${c.name.charAt(0)}</div>
      <div class="customer-name">${c.name}</div>
      <div class="customer-phone"><i class="fas fa-phone"></i> ${c.phone || '-'}</div>
      <div class="customer-phone" style="font-size:0.8rem">${c.city || ''}</div>
      <div class="customer-stats">
        <div><div class="customer-stat-val">${c.total_orders || 0}</div><div class="customer-stat-label">طلب</div></div>
        <div><div class="customer-stat-val">${parseFloat(c.total_spent || 0).toFixed(0)}</div><div class="customer-stat-label">${CURRENCY}</div></div>
      </div>
    </div>
  `).join('');
}

function searchCustomers(q) { loadCustomers(q); }

function openCustomerModal() { openModal('customerModal'); }

async function saveCustomer() {
  const data = {
    name:  document.getElementById('custName').value,
    phone: document.getElementById('custPhone').value,
    city:  document.getElementById('custCity').value,
    notes: document.getElementById('custNotes').value,
  };
  if (!data.name) { toast('أدخل اسم العميل', 'warning'); return; }

  try { await post('add_customer', data); } catch {}

  const customers = JSON.parse(localStorage.getItem('pos_customers') || '[]');
  data.id = Date.now(); data.total_orders = 0; data.total_spent = 0;
  customers.push(data);
  localStorage.setItem('pos_customers', JSON.stringify(customers));
  State.customers = customers;

  closeModal('customerModal');
  loadCustomers();
  toast('تم إضافة العميل ✅', 'success');

  // مسح الحقول
  ['custName','custPhone','custCity','custNotes'].forEach(id => document.getElementById(id).value = '');
}

function showCustomerPicker() {
  renderCustomerPicker('');
  openModal('customerPickerModal');
}

function renderCustomerPicker(q) {
  const customers = State.customers.filter(c => !q || c.name.includes(q) || c.phone?.includes(q));
  document.getElementById('customerPickerList').innerHTML = customers.map(c => `
    <div class="picker-item" onclick="selectCustomer(${c.id})">
      <div style="font-weight:700">${c.name}</div>
      <div style="font-size:0.8rem;opacity:.8">${c.phone || ''}</div>
    </div>
  `).join('') || '<div style="text-align:center;color:var(--text3);padding:1rem">لا يوجد عملاء</div>';
}

function searchCustomerPicker(q) { renderCustomerPicker(q); }

function selectCustomer(id) {
  State.selectedCustomer = State.customers.find(c => c.id === id);
  if (State.selectedCustomer) {
    document.getElementById('cartCustomer').style.display = 'flex';
    document.getElementById('cartCustomerName').textContent = State.selectedCustomer.name;
  }
  closeModal('customerPickerModal');
}

function removeCartCustomer() {
  State.selectedCustomer = null;
  document.getElementById('cartCustomer').style.display = 'none';
}

function quickAddCustomer() {
  closeModal('customerPickerModal');
  openModal('customerModal');
}

// ══════════════════════════════════════════════════════════
// ── الديون ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadDebts(status = '', btn) {
  if (btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  let debts = [];
  try {
    const res = await get('get_debts&status=' + status);
    debts = res.data || [];
  } catch {
    debts = JSON.parse(localStorage.getItem('pos_debts') || '[]');
    if (status) debts = debts.filter(d => d.status === status);
  }

  // ملخص
  const total = debts.reduce((s, d) => s + parseFloat(d.remaining_amount || 0), 0);
  const count = debts.filter(d => d.status !== 'paid').length;
  document.getElementById('debtsSummary').innerHTML = `
    <div class="stat-card red"><div class="stat-icon">💰</div><div class="stat-value">${total.toFixed(2)} ${CURRENCY}</div><div class="stat-label">إجمالي الديون</div></div>
    <div class="stat-card orange"><div class="stat-icon">👤</div><div class="stat-value">${count}</div><div class="stat-label">مدين نشط</div></div>
    <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-value">${debts.filter(d=>d.status==='paid').length}</div><div class="stat-label">ديون مسددة</div></div>
  `;

  document.getElementById('debtsList').innerHTML = debts.map(d => {
    const pct = d.original_amount > 0 ? (d.paid_amount / d.original_amount * 100) : 0;
    return `
      <div class="debt-card">
        <div class="debt-card-header">
          <div>
            <div class="debt-name">${d.customer_name}</div>
            <div class="debt-phone"><i class="fas fa-phone"></i> ${d.customer_phone || '-'}</div>
          </div>
          <div class="debt-amount">${parseFloat(d.remaining_amount || 0).toFixed(2)} ${CURRENCY}</div>
          <span class="debt-status ${d.status}">${debtStatusLabel(d.status)}</span>
        </div>
        <div class="debt-progress">
          <div class="debt-progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="debt-info">
          الأصلي: ${parseFloat(d.original_amount || 0).toFixed(2)} ${CURRENCY} | 
          مدفوع: ${parseFloat(d.paid_amount || 0).toFixed(2)} ${CURRENCY}
          ${d.due_date ? ` | موعد: ${d.due_date}` : ''}
          ${d.notes ? `<br>📝 ${d.notes}` : ''}
        </div>
        <div class="debt-actions">
          ${d.status !== 'paid' ? `<button class="btn-primary" onclick="openPayDebt(${d.id}, ${d.remaining_amount})">💳 تسديد</button>` : ''}
          ${d.customer_phone ? `<button class="btn-secondary" onclick="remindDebt('${d.customer_phone}', '${d.customer_name}', ${d.remaining_amount})"><i class="fab fa-whatsapp"></i> تذكير</button>` : ''}
        </div>
      </div>
    `;
  }).join('') || '<div style="text-align:center;padding:2rem;color:var(--text3)">لا توجد ديون</div>';

  updateBadges();
}

function openDebtModal() { openModal('debtModal'); }

async function saveDebt() {
  const data = {
    customer_name:  document.getElementById('debtCustomer').value,
    customer_phone: document.getElementById('debtPhone').value,
    amount:         parseFloat(document.getElementById('debtAmount').value) || 0,
    due_date:       document.getElementById('debtDue').value,
    notes:          document.getElementById('debtNotes').value,
  };
  if (!data.customer_name || !data.amount) { toast('أدخل الاسم والمبلغ', 'warning'); return; }

  try { await post('add_debt', data); } catch {}

  const debts = JSON.parse(localStorage.getItem('pos_debts') || '[]');
  debts.push({ ...data, id: Date.now(), original_amount: data.amount, paid_amount: 0, remaining_amount: data.amount, status: 'pending', created_at: new Date().toISOString() });
  localStorage.setItem('pos_debts', JSON.stringify(debts));

  closeModal('debtModal');
  loadDebts();
  toast('تم تسجيل الدين ✅', 'success');
  ['debtCustomer','debtPhone','debtAmount','debtDue','debtNotes'].forEach(id => document.getElementById(id).value = '');
}

function openPayDebt(id, remaining) {
  State.currentDebtId = id;
  document.getElementById('debtRemaining').textContent = parseFloat(remaining).toFixed(2);
  document.getElementById('payDebtAmount').value = parseFloat(remaining).toFixed(2);
  openModal('payDebtModal');
}

async function confirmPayDebt() {
  const amount = parseFloat(document.getElementById('payDebtAmount').value) || 0;
  const notes  = document.getElementById('payDebtNotes').value;
  if (!amount) { toast('أدخل المبلغ', 'warning'); return; }

  try { await post('pay_debt', { id: State.currentDebtId, amount, notes }); } catch {}

  // تحديث محلياً
  const debts = JSON.parse(localStorage.getItem('pos_debts') || '[]');
  const idx = debts.findIndex(d => d.id === State.currentDebtId);
  if (idx !== -1) {
    debts[idx].paid_amount = (debts[idx].paid_amount || 0) + amount;
    debts[idx].remaining_amount = debts[idx].original_amount - debts[idx].paid_amount;
    debts[idx].status = debts[idx].remaining_amount <= 0 ? 'paid' : 'partial';
    localStorage.setItem('pos_debts', JSON.stringify(debts));
  }

  closeModal('payDebtModal');
  loadDebts();
  playSound();
  toast('✅ تم تسجيل الدفع', 'success');
}

function remindDebt(phone, name, amount) {
  const msg = `مرحباً ${name}،\nنذكركم بأن لديكم دين بمبلغ *${parseFloat(amount).toFixed(2)} ${CURRENCY}*\nيرجى التسديد في أقرب وقت.\nشكراً لكم 🌟`;
  window.open('https://wa.me/' + phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg));
}

// ══════════════════════════════════════════════════════════
// ── المصاريف ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadExpenses() {
  let expenses = [];
  try {
    const res = await get('get_expenses');
    expenses = res.data || [];
  } catch {
    expenses = JSON.parse(localStorage.getItem('pos_expenses') || '[]');
  }

  const catIcons = { 'إيجار': '🏠', 'مشتريات': '🛒', 'رواتب': '👤', 'كهرباء وماء': '💡', 'صيانة': '🔧', 'أخرى': '📝' };
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  document.getElementById('expensesList').innerHTML = `
    <div style="background:var(--danger);color:white;border-radius:var(--radius);padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:0.9rem">إجمالي المصاريف</span>
      <strong style="font-size:1.3rem">${total.toFixed(2)} ${CURRENCY}</strong>
    </div>
    ${expenses.map(e => `
      <div class="expense-card">
        <div class="expense-icon">${catIcons[e.category] || '📝'}</div>
        <div class="expense-info">
          <div class="expense-title">${e.title}</div>
          <div class="expense-category">${e.category || 'عام'}</div>
        </div>
        <div>
          <div class="expense-amount">-${parseFloat(e.amount || 0).toFixed(2)} ${CURRENCY}</div>
          <div class="expense-date">${e.expense_date || formatDate(e.created_at)}</div>
        </div>
      </div>
    `).join('') || '<div style="text-align:center;padding:2rem;color:var(--text3)">لا توجد مصاريف</div>'}
  `;
}

function openExpenseModal() {
  document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
  openModal('expenseModal');
}

async function saveExpense() {
  const data = {
    title:    document.getElementById('expTitle').value,
    amount:   parseFloat(document.getElementById('expAmount').value) || 0,
    category: document.getElementById('expCategory').value,
    date:     document.getElementById('expDate').value,
  };
  if (!data.title || !data.amount) { toast('أدخل العنوان والمبلغ', 'warning'); return; }

  try { await post('add_expense', data); } catch {}

  const expenses = JSON.parse(localStorage.getItem('pos_expenses') || '[]');
  expenses.unshift({ ...data, id: Date.now(), expense_date: data.date, created_at: new Date().toISOString() });
  localStorage.setItem('pos_expenses', JSON.stringify(expenses));

  closeModal('expenseModal');
  loadExpenses();
  toast('تم إضافة المصروف ✅', 'success');
}

// ══════════════════════════════════════════════════════════
// ── التقارير ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadReports(period, btn) {
  if (btn) {
    document.querySelectorAll('#page-reports .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  let stats;
  try {
    const res = await get('get_stats&period=' + period);
    stats = res.data;
  } catch {
    stats = getLocalStats(period);
  }

  renderStats(stats);
  renderCharts(stats);
  renderLowStock(stats.low_stock || []);
}

function getLocalStats(period) {
  const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
  const now = new Date();
  const filtered = orders.filter(o => {
    const d = new Date(o.created_at);
    if (o.order_status === 'cancelled') return false;
    if (period === 'day') return d.toDateString() === now.toDateString();
    if (period === 'week') return (now - d) < 7 * 24 * 60 * 60 * 1000;
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

  const revenue = filtered.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const products = getLocalProducts();
  let profit = 0;
  const productCounts = {};
  filtered.forEach(o => (o.items || []).forEach(i => {
    const p = products.find(pr => pr.id === i.id);
    profit += ((p ? p.selling_price - p.purchase_price : 0) * (i.quantity || 1));
    productCounts[i.name || i.product_name] = (productCounts[i.name || i.product_name] || 0) + (i.quantity || 1);
  }));

  const topProducts = Object.entries(productCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name, qty]) => ({ product_name: name, qty }));
  const debts = JSON.parse(localStorage.getItem('pos_debts') || '[]');
  const totalDebts = debts.filter(d => d.status !== 'paid').reduce((s,d) => s + parseFloat(d.remaining_amount||0), 0);
  const lowStock = products.filter(p => p.stock <= (p.min_stock || 5));

  // Weekly data
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const dayOrders = orders.filter(o => new Date(o.created_at).toDateString() === d.toDateString() && o.order_status !== 'cancelled');
    weeklyData.push({ order_date: d.toLocaleDateString('ar'), revenue: dayOrders.reduce((s,o)=>s+parseFloat(o.total||0),0), orders: dayOrders.length });
  }

  return {
    sales: { orders_count: filtered.length, total_revenue: revenue, total_discounts: 0 },
    profit: { total_profit: profit },
    top_products: topProducts,
    debts: { total_debts: totalDebts, debts_count: debts.filter(d=>d.status!=='paid').length },
    low_stock: lowStock,
    weekly_data: weeklyData,
  };
}

function renderStats(stats) {
  const s = stats.sales || {};
  const p = stats.profit || {};
  const d = stats.debts || {};
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card blue"><div class="stat-icon">📦</div><div class="stat-value">${s.orders_count || 0}</div><div class="stat-label">عدد الطلبات</div></div>
    <div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-value">${parseFloat(s.total_revenue||0).toFixed(2)} ${CURRENCY}</div><div class="stat-label">إجمالي المبيعات</div></div>
    <div class="stat-card purple"><div class="stat-icon">📈</div><div class="stat-value">${parseFloat(p.total_profit||0).toFixed(2)} ${CURRENCY}</div><div class="stat-label">صافي الربح</div></div>
    <div class="stat-card red"><div class="stat-icon">💳</div><div class="stat-value">${parseFloat(d.total_debts||0).toFixed(2)} ${CURRENCY}</div><div class="stat-label">الديون المتبقية</div></div>
    <div class="stat-card orange"><div class="stat-icon">🏆</div><div class="stat-value">${stats.top_products?.[0]?.product_name || '-'}</div><div class="stat-label">أكثر منتج مبيعاً</div></div>
  `;
}

function renderCharts(stats) {
  const weekly = stats.weekly_data || [];
  const labels = weekly.map(d => d.order_date);
  const revenues = weekly.map(d => parseFloat(d.revenue || 0));

  if (State.chartSales) State.chartSales.destroy();
  const ctx1 = document.getElementById('salesChart').getContext('2d');
  State.chartSales = new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'المبيعات', data: revenues, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.4, fill: true }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  const top = stats.top_products || [];
  if (State.chartTop) State.chartTop.destroy();
  const ctx2 = document.getElementById('topChart').getContext('2d');
  State.chartTop = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: top.map(p => p.product_name),
      datasets: [{ label: 'الكمية', data: top.map(p => p.qty || p.qty_sold || 0), backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6'] }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderLowStock(items) {
  const section = document.getElementById('lowStockSection');
  if (!items.length) { section.innerHTML = ''; return; }
  section.innerHTML = `
    <div class="low-stock-section">
      <h3>⚠️ تنبيه: مخزون منخفض (${items.length} منتج)</h3>
      <div class="low-stock-list">
        ${items.map(p => `
          <div class="low-stock-item">
            <span>${p.name}</span>
            <span class="stock-low">المتبقي: ${p.stock}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════
// ── الإدارة ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function loadAdmin() {
  await loadSettings();
  renderSettingsForm();
  loadUsers();

  const qrBtn = document.getElementById('qrContainer');
  if (qrBtn) qrBtn.innerHTML = '';
}

function renderSettingsForm() {
  const s = State.settings;
  document.getElementById('settingsForm').innerHTML = `
    <div class="form-group"><label>اسم المحل</label><input type="text" id="set_shop_name" value="${s.shop_name||''}"></div>
    <div class="form-group"><label>العنوان</label><input type="text" id="set_shop_address" value="${s.shop_address||''}"></div>
    <div class="form-group"><label>الهاتف</label><input type="text" id="set_shop_phone" value="${s.shop_phone||''}"></div>
    <div class="form-group"><label>WhatsApp</label><input type="text" id="set_shop_whatsapp" value="${s.shop_whatsapp||''}"></div>
    <div class="form-group"><label>نسبة الضريبة %</label><input type="number" id="set_tax_rate" value="${s.tax_rate||0}" min="0" max="100"></div>
    <div class="form-group"><label>كلمة سر الكاشير (لوحة سرية)</label><input type="password" id="set_secret_password" value="${s.secret_password||'secret2024'}"></div>
    <div class="form-group"><label>نص أسفل الفاتورة</label><input type="text" id="set_receipt_footer" value="${s.receipt_footer||''}"></div>
  `;
}

async function loadSettings() {
  try {
    const res = await get('get_settings');
    State.settings = res.data || {};
  } catch {
    State.settings = JSON.parse(localStorage.getItem('pos_settings') || '{}');
  }
  State.taxRate = parseFloat(State.settings.tax_rate || 0);
  if (State.settings.shop_name) document.getElementById('shopName').textContent = State.settings.shop_name;
}

async function saveSettings() {
  const keys = ['shop_name','shop_address','shop_phone','shop_whatsapp','tax_rate','secret_password','receipt_footer'];
  const settings = {};
  for (const key of keys) {
    const el = document.getElementById('set_' + key);
    if (el) { settings[key] = el.value; try { await post('update_setting', { key, value: el.value }); } catch {} }
  }
  Object.assign(State.settings, settings);
  localStorage.setItem('pos_settings', JSON.stringify(State.settings));
  State.taxRate = parseFloat(settings.tax_rate || 0);
  if (settings.shop_name) document.getElementById('shopName').textContent = settings.shop_name;
  toast('تم حفظ الإعدادات ✅', 'success');
}

async function loadUsers() {
  const container = document.getElementById('usersList');
  if (!container) return;
  const defaultUsers = [
    { username: 'admin', full_name: 'المدير العام', role: 'admin', last_login: new Date().toISOString() },
    { username: 'worker', full_name: 'موظف الكاشير', role: 'worker', last_login: null },
  ];
  try {
    const res = await get(AUTH.replace('api.php?action=','') + 'get_users');
    renderUsers(res.data || defaultUsers);
  } catch { renderUsers(defaultUsers); }
}

function renderUsers(users) {
  document.getElementById('usersList').innerHTML = users.map(u => `
    <div style="display:flex;align-items:center;gap:0.7rem;padding:0.6rem;background:var(--bg3);border-radius:var(--radius-sm);margin-bottom:0.4rem">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:white;font-weight:700">
        ${u.full_name.charAt(0)}
      </div>
      <div style="flex:1">
        <div style="font-weight:700">${u.full_name}</div>
        <div style="font-size:0.8rem;color:var(--text3)">${u.username} • ${u.role === 'admin' ? '👑 مدير' : '👷 موظف'}</div>
      </div>
    </div>
  `).join('');
}

// ── QR Code ────────────────────────────────────────────────
function generateQR() {
  const container = document.getElementById('qrContainer');
  container.innerHTML = '';
  const url = window.location.href.replace('index.html', 'menu.html');
  new QRCode(container, { text: url, width: 150, height: 150 });
  toast('تم توليد QR Code ✅', 'success');
}

// ── النسخ الاحتياطي ────────────────────────────────────────
function backupData() {
  const data = {
    products:  JSON.parse(localStorage.getItem('pos_products') || '[]'),
    orders:    JSON.parse(localStorage.getItem('pos_orders') || '[]'),
    customers: JSON.parse(localStorage.getItem('pos_customers') || '[]'),
    debts:     JSON.parse(localStorage.getItem('pos_debts') || '[]'),
    expenses:  JSON.parse(localStorage.getItem('pos_expenses') || '[]'),
    settings:  JSON.parse(localStorage.getItem('pos_settings') || '{}'),
    backup_date: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pos_backup_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  toast('تم تنزيل النسخة الاحتياطية ✅', 'success');
}

function restoreData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.products)  localStorage.setItem('pos_products', JSON.stringify(data.products));
      if (data.orders)    localStorage.setItem('pos_orders', JSON.stringify(data.orders));
      if (data.customers) localStorage.setItem('pos_customers', JSON.stringify(data.customers));
      if (data.debts)     localStorage.setItem('pos_debts', JSON.stringify(data.debts));
      if (data.expenses)  localStorage.setItem('pos_expenses', JSON.stringify(data.expenses));
      if (data.settings)  localStorage.setItem('pos_settings', JSON.stringify(data.settings));
      toast('تم استرجاع البيانات ✅', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch { toast('خطأ في قراءة الملف', 'error'); }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════
// ── اللوحة السرية ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════

function openSecretPanel() { document.getElementById('secretPanel').classList.remove('hidden'); }
function closeSecretPanel() {
  document.getElementById('secretPanel').classList.add('hidden');
  document.getElementById('secretLock').style.display = 'block';
  document.getElementById('secretData').classList.add('hidden');
  document.getElementById('secretPassInput').value = '';
}

async function verifySecret() {
  const pass = document.getElementById('secretPassInput').value;
  const correctPass = State.settings.secret_password || 'secret2024';

  let ok = pass === correctPass;
  if (!ok) {
    try {
      const res = await post('verify_secret', { password: pass });
      ok = res.success;
    } catch {}
  }

  if (ok) {
    document.getElementById('secretLock').style.display = 'none';
    document.getElementById('secretData').classList.remove('hidden');
    loadSecretData();
  } else {
    toast('كلمة السر غير صحيحة ❌', 'error');
    document.getElementById('secretPassInput').value = '';
  }
}

function loadSecretData() {
  const stats = getLocalStats('day');
  const topProduct = stats.top_products?.[0]?.product_name || '-';
  document.getElementById('secretOrders').textContent  = stats.sales.orders_count;
  document.getElementById('secretRevenue').textContent = parseFloat(stats.sales.total_revenue).toFixed(2) + ' ' + CURRENCY;
  document.getElementById('secretProfit').textContent  = parseFloat(stats.profit.total_profit).toFixed(2) + ' ' + CURRENCY;
  document.getElementById('secretTop').textContent     = topProduct;
}

// ══════════════════════════════════════════════════════════
// ── المساعدات ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

// HTTP
async function get(action) {
  const res = await fetch(API + action);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function post(action, data) {
  const url = action.startsWith('auth') ? action.replace('auth', AUTH) : API + action;
  const res = await fetch(API + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// مودالات
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) closeModal(e.target.id);
});

// Toast
function toast(msg, type = 'success', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span> <span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// صوت
function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

// تنسيق التاريخ
function formatDate(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleString('ar-MA'); } catch { return dateStr; }
}

// تسميات
function statusLabel(s) { return { pending:'⏳ انتظار', preparing:'👨‍🍳 يحضر', ready:'✅ جاهز', delivered:'🏠 سُلِّم', cancelled:'❌ ملغي' }[s] || s; }
function orderTypeLabel(t) { return { dine_in:'🍽️ داخل', takeaway:'🛍️ خارج', delivery:'🛵 توصيل' }[t] || t; }
function paymentLabel(m) { return { cash:'💵 نقدي', card:'💳 بطاقة', transfer:'📱 تحويل', debt:'📝 دين' }[m] || m; }
function debtStatusLabel(s) { return { pending:'غير مدفوع', partial:'جزئي', paid:'مدفوع' }[s] || s; }

// Dark mode
function toggleDark() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('pos_dark', isDark);
  document.getElementById('darkIcon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  document.getElementById('darkText').textContent = isDark ? 'وضع نهاري' : 'وضع ليلي';
}
function applyDarkMode() {
  if (localStorage.getItem('pos_dark') === 'true') {
    document.body.classList.add('dark');
    document.getElementById('darkIcon').className = 'fas fa-sun';
    document.getElementById('darkText').textContent = 'وضع نهاري';
  }
}

// Sidebar
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

// Storage
function saveCartToStorage() { localStorage.setItem('pos_cart', JSON.stringify(State.cart)); }
function loadFromStorage() {
  const cart = JSON.parse(localStorage.getItem('pos_cart') || '[]');
  if (cart.length) { State.cart = cart; renderCart(); }
}

// Badges
function updateBadges() {
  const orders = JSON.parse(localStorage.getItem('pos_orders') || '[]');
  const pending = orders.filter(o => o.order_status === 'pending' && new Date(o.created_at).toDateString() === new Date().toDateString()).length;
  document.getElementById('pendingBadge').textContent = pending;
  document.getElementById('pendingBadge').style.display = pending ? '' : 'none';

  const debts = JSON.parse(localStorage.getItem('pos_debts') || '[]');
  const unpaid = debts.filter(d => d.status !== 'paid').length;
  document.getElementById('debtsBadge').textContent = unpaid;
  document.getElementById('debtsBadge').style.display = unpaid ? '' : 'none';
}

// مودال مؤقت
function showTempModal(html, duration = 2000) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:999';
  div.innerHTML = `<div style="background:var(--bg2);border-radius:20px;max-width:350px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">${html}</div>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), duration);
}

// أنيميشن إضافة السلة
function animateCartItem(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) { card.style.transform = 'scale(0.95)'; setTimeout(() => card.style.transform = '', 150); }
}

// Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
