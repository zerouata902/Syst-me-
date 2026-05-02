// ============================================================
// app.js v3.0 - نظام POS محسّن وكامل
// إصلاحات: الأسعار، الديون التلقائية، الطباعة، صلاحيات الموظف
// ============================================================
'use strict';

const API      = 'api.php?action=';
const CURRENCY = 'DH';
const WHATSAPP = '+212600000000';

const State = {
  user: null, cart: [], products: [], categories: [], customers: [],
  orderType: 'dine_in', payMethod: 'cash', selectedCustomer: null,
  currentDebtId: null, chartSales: null, chartTop: null,
  taxRate: 0, settings: {}, currentSort: 'popular', currentCategory: 0,
};

document.addEventListener('DOMContentLoaded', () => {
  applyDarkMode();
  const saved = localStorage.getItem('pos_user');
  if (saved) { State.user = JSON.parse(saved); showApp(); }
});

// ── المصادقة ──────────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const USERS = {
    admin:  {username:'admin', password:'admin123', full_name:'المدير العام',  role:'admin'},
    worker: {username:'worker',password:'worker123',full_name:'موظف الكاشير',role:'worker'},
  };
  const u = USERS[username];
  if (u && u.password === password) {
    State.user = u;
    localStorage.setItem('pos_user', JSON.stringify(u));
    showApp();
    toast('مرحباً ' + u.full_name + ' 👋');
  } else {
    toast('كلمة المرور أو اسم المستخدم خاطئ','error');
  }
}

function handleLogout() {
  if (!confirm('هل تريد الخروج؟')) return;
  localStorage.removeItem('pos_user');
  location.reload();
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userBadge').textContent = State.user.role === 'admin' ? '👑 مدير' : '👷 موظف';
  applyRolePermissions();
  loadSettings();
  showPage('pos');
  updateBadges();
}

// ── صلاحيات الأدوار ───────────────────────────────────────
function applyRolePermissions() {
  const isWorker = State.user.role === 'worker';
  ['products','customers','debts','expenses','reports','admin'].forEach(page => {
    const n = document.querySelector(`[data-page="${page}"]`);
    if (n) n.style.display = isWorker ? 'none' : '';
  });
}

// ── التنقل ────────────────────────────────────────────────
function showPage(page) {
  const adminOnly = ['products','customers','debts','expenses','reports','admin'];
  if (State.user?.role === 'worker' && adminOnly.includes(page)) {
    toast('ليس لديك صلاحية','error'); return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  switch (page) {
    case 'pos':       loadPOS();           break;
    case 'orders':    loadOrders('day');   break;
    case 'products':  loadProductsAdmin(); break;
    case 'customers': loadCustomers();     break;
    case 'debts':     loadDebts();         break;
    case 'expenses':  loadExpenses();      break;
    case 'reports':   loadReports('day'); break;
    case 'admin':     loadAdmin();         break;
  }
}

// ── POS الرئيسي ───────────────────────────────────────────
async function loadPOS() {
  await loadCategories();
  await loadProducts();
  loadCartFromStorage();
}

async function loadCategories() {
  try { const r = await apiGet('get_categories'); State.categories = r.data||[]; }
  catch { State.categories = getDefaultCategories(); }
  renderCategories();
}

async function loadProducts() {
  try { const r = await apiGet(`get_products&category=${State.currentCategory}&sort=${State.currentSort}`); State.products = r.data||[]; }
  catch { State.products = getDefaultProducts(); }
  renderProducts(State.products);
}

function getDefaultCategories() {
  return [{id:1,name:'المشروبات الساخنة',icon:'☕'},{id:2,name:'المشروبات الباردة',icon:'🧊'},{id:3,name:'الوجبات الرئيسية',icon:'🍽️'},{id:4,name:'السندويشات',icon:'🥪'},{id:5,name:'الحلويات',icon:'🍰'}];
}

function getDefaultProducts() {
  const s = localStorage.getItem('pos_products');
  if (s) return JSON.parse(s);
  return [
    {id:1,name:'قهوة عربية',description:'قهوة أصيلة بالهيل',category_id:1,selling_price:15,purchase_price:5,stock:100,total_sold:245,is_featured:true,category_name:'المشروبات الساخنة'},
    {id:2,name:'كابتشينو',description:'كابتشينو إيطالي',category_id:1,selling_price:22,purchase_price:8,stock:80,total_sold:198,is_featured:true,category_name:'المشروبات الساخنة'},
    {id:3,name:'شاي أخضر',description:'شاي أخضر طبيعي',category_id:1,selling_price:12,purchase_price:3,stock:150,total_sold:156,is_featured:false,category_name:'المشروبات الساخنة'},
    {id:4,name:'لاتيه',description:'لاتيه بالحليب الطازج',category_id:1,selling_price:25,purchase_price:9,stock:60,total_sold:134,is_featured:true,category_name:'المشروبات الساخنة'},
    {id:5,name:'عصير برتقال',description:'برتقال طبيعي طازج',category_id:2,selling_price:18,purchase_price:6,stock:50,total_sold:312,is_featured:true,category_name:'المشروبات الباردة'},
    {id:6,name:'موهيتو',description:'موهيتو نعناع وليمون',category_id:2,selling_price:20,purchase_price:7,stock:45,total_sold:220,is_featured:true,category_name:'المشروبات الباردة'},
    {id:7,name:'عصير فراولة',description:'فراولة مع آيس كريم',category_id:2,selling_price:22,purchase_price:8,stock:40,total_sold:187,is_featured:false,category_name:'المشروبات الباردة'},
    {id:8,name:'ماء معدني',description:'ماء معدني 500ml',category_id:2,selling_price:5,purchase_price:2,stock:200,total_sold:450,is_featured:false,category_name:'المشروبات الباردة'},
    {id:9,name:'برغر كلاسيك',description:'برغر لحم مع خضروات',category_id:3,selling_price:55,purchase_price:25,stock:30,total_sold:89,is_featured:true,category_name:'الوجبات الرئيسية'},
    {id:10,name:'دجاج مشوي',description:'دجاج مع أرز وسلطة',category_id:3,selling_price:65,purchase_price:30,stock:25,total_sold:76,is_featured:true,category_name:'الوجبات الرئيسية'},
    {id:11,name:'بيتزا مارغريتا',description:'بيتزا جبن وطماطم',category_id:3,selling_price:75,purchase_price:35,stock:15,total_sold:92,is_featured:true,category_name:'الوجبات الرئيسية'},
    {id:12,name:'شاورما دجاج',description:'شاورما بالصوص الخاص',category_id:4,selling_price:35,purchase_price:15,stock:40,total_sold:267,is_featured:true,category_name:'السندويشات'},
    {id:13,name:'سندويش كلوب',description:'كلوب ثلاثي الطوابق',category_id:4,selling_price:40,purchase_price:18,stock:35,total_sold:143,is_featured:false,category_name:'السندويشات'},
    {id:14,name:'كيك شوكولاتة',description:'كيك شوكولاتة بلجيكي',category_id:5,selling_price:30,purchase_price:12,stock:20,total_sold:98,is_featured:true,category_name:'الحلويات'},
    {id:15,name:'تشيز كيك',description:'تشيز كيك كريمي فراولة',category_id:5,selling_price:35,purchase_price:15,stock:15,total_sold:72,is_featured:false,category_name:'الحلويات'},
  ];
}

function renderCategories() {
  const bar = document.getElementById('categoriesBar');
  bar.innerHTML = `<button class="cat-btn active" onclick="filterCategory(0,this)">🏠 الكل</button>`;
  State.categories.forEach(c => { bar.innerHTML += `<button class="cat-btn" onclick="filterCategory(${c.id},this)">${c.icon} ${c.name}</button>`; });
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products||!products.length) { grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3)">لا توجد منتجات</div>'; return; }
  grid.innerHTML = products.map(p => {
    const oos = parseInt(p.stock)<=0;
    const emoji = {1:'☕',2:'🧃',3:'🍽️',4:'🥪',5:'🍰'}[p.category_id]||'📦';
    const img = p.image_url ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=font-size:2.5rem>${emoji}</span>'">` : `<span style="font-size:2.5rem">${emoji}</span>`;
    return `<div class="product-card ${oos?'out-of-stock':''}" onclick="${oos?'':'addToCart('+p.id+')'}" data-id="${p.id}">
      ${p.is_featured?'<span class="featured-badge">⭐</span>':''}
      <div class="product-img">${img}</div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.description||''}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.3rem">
          <div class="product-price">${parseFloat(p.selling_price).toFixed(2)} ${CURRENCY}</div>
          <div class="${parseInt(p.stock)<=5?'stock-low':'stock-ok'}" style="font-size:.75rem">${parseInt(p.stock)>0?'📦 '+p.stock:'❌ نفد'}</div>
        </div>
      </div></div>`;
  }).join('');
}

function filterCategory(id, btn) {
  State.currentCategory = id;
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts(id ? State.products.filter(p=>p.category_id==id) : State.products);
}

function sortProducts(sort, btn) {
  State.currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  let s=[...State.products];
  if(sort==='price_asc')  s.sort((a,b)=>a.selling_price-b.selling_price);
  if(sort==='price_desc') s.sort((a,b)=>b.selling_price-a.selling_price);
  if(sort==='popular')    s.sort((a,b)=>b.total_sold-a.total_sold);
  if(sort==='featured')   s.sort((a,b)=>b.is_featured-a.is_featured);
  renderProducts(s);
}

function filterProducts() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  if (!q) { renderProducts(State.products); return; }
  renderProducts(State.products.filter(p=>p.name.toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)));
}

// ── السلة ─────────────────────────────────────────────────
function addToCart(productId) {
  const product = State.products.find(p=>p.id==productId);
  if (!product) return;
  const existing = State.cart.find(i=>i.id==productId);
  if (existing) {
    if (existing.quantity >= parseInt(product.stock)) { toast('لا يمكن إضافة أكثر من المخزون','warning'); return; }
    existing.quantity++;
  } else {
    State.cart.push({id:product.id,name:product.name,selling_price:parseFloat(product.selling_price),purchase_price:parseFloat(product.purchase_price),stock:parseInt(product.stock),quantity:1,notes:''});
  }
  renderCart(); saveCartToStorage(); playBeep();
  const card = document.querySelector(`[data-id="${productId}"]`);
  if (card) { card.style.transform='scale(0.96)'; setTimeout(()=>card.style.transform='',150); }
  toast(`✅ ${product.name}`,'success',1200);
}

function removeFromCart(id) { State.cart=State.cart.filter(i=>i.id!=id); renderCart(); saveCartToStorage(); }

function changeQty(id, delta) {
  const item = State.cart.find(i=>i.id==id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity<=0) { removeFromCart(id); return; }
  if (item.quantity>item.stock) { item.quantity=item.stock; toast('حد المخزون','warning'); }
  renderCart(); saveCartToStorage();
}

function clearCart() {
  if (!State.cart.length) return;
  if (!confirm('إفراغ السلة؟')) return;
  State.cart=[]; State.selectedCustomer=null;
  document.getElementById('cartCustomer').style.display='none';
  document.getElementById('orderNotes').value='';
  document.getElementById('discountValue').value=0;
  document.getElementById('amountPaid').value='';
  renderCart(); saveCartToStorage();
}

function renderCart() {
  const c = document.getElementById('cartItems');
  if (!State.cart.length) { c.innerHTML=`<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>السلة فارغة</p><small>اضغط على منتج</small></div>`; updateTotals(); return; }
  c.innerHTML = State.cart.map(item=>{
    const lineTotal=(parseFloat(item.selling_price)*parseInt(item.quantity)).toFixed(2);
    return `<div class="cart-item">
      <div style="flex:1;min-width:0">
        <div class="cart-item-name">${item.name}</div>
        <div style="font-size:.78rem;color:var(--text3)">${parseFloat(item.selling_price).toFixed(2)} ${CURRENCY} / وحدة</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn minus" onclick="changeQty(${item.id},-1)">−</button>
        <span class="qty-num">${item.quantity}</span>
        <button class="qty-btn plus" onclick="changeQty(${item.id},1)">+</button>
      </div>
      <div class="cart-item-price">${lineTotal} ${CURRENCY}</div>
      <button class="cart-item-del" onclick="removeFromCart(${item.id})"><i class="fas fa-trash-alt"></i></button>
    </div>`;
  }).join('');
  updateTotals();
}

function updateTotals() {
  const subtotal = State.cart.reduce((s,i)=>s+(parseFloat(i.selling_price)*parseInt(i.quantity)),0);
  const discType = document.getElementById('discountType')?.value||'fixed';
  const discVal  = parseFloat(document.getElementById('discountValue')?.value)||0;
  const discAmt  = discType==='percent'? subtotal*discVal/100 : Math.min(discVal,subtotal);
  const taxAmt   = (subtotal-discAmt)*(State.taxRate/100);
  const total    = subtotal-discAmt+taxAmt;
  const fmt = n=>parseFloat(n).toFixed(2)+' '+CURRENCY;
  document.getElementById('subtotalVal').textContent = fmt(subtotal);
  document.getElementById('discountVal').textContent = '-'+fmt(discAmt);
  document.getElementById('taxVal').textContent      = fmt(taxAmt);
  document.getElementById('totalVal').textContent    = fmt(total);
  if (State.taxRate>0) document.getElementById('taxRow').style.display='';
  calcChange();
}

function calcChange() {
  const total = parseFloat((document.getElementById('totalVal')?.textContent||'0').replace(/[^0-9.]/g,''))||0;
  const paid  = parseFloat(document.getElementById('amountPaid')?.value)||0;
  const cd=document.getElementById('changeDisplay'), ca=document.getElementById('changeAmount');
  if (paid>0&&State.payMethod==='cash') { const ch=paid-total; cd.style.display='block'; ca.textContent=ch.toFixed(2); ca.style.color=ch>=0?'var(--success)':'var(--danger)'; }
  else cd.style.display='none';
}

function setOrderType(type,btn) { State.orderType=type; document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
function setPayMethod(method,btn) {
  State.payMethod=method;
  document.querySelectorAll('.pay-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('cashRow').style.display=method==='cash'?'flex':'none';
  if (method==='debt') toast('⚠️ تذكر: اختر عميلاً لتسجيل الدين','warning',2000);
}

// ── الدفع والطلبات ────────────────────────────────────────
function checkout() {
  if (!State.cart.length) { toast('السلة فارغة!','warning'); return; }
  if (State.payMethod==='debt'&&!State.selectedCustomer) { toast('⚠️ اختر عميلاً لتسجيل الدين!','warning'); showCustomerPicker(); return; }

  const btn=document.getElementById('checkoutBtn');
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> جاري...';

  const total    = parseFloat((document.getElementById('totalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const subtotal = parseFloat((document.getElementById('subtotalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const discAmt  = parseFloat((document.getElementById('discountVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const amtPaid  = parseFloat(document.getElementById('amountPaid').value)||total;
  const orderNum = 'ORD-'+Date.now();

  const orderData = {
    id: Date.now(), order_number: orderNum,
    customer_id:    State.selectedCustomer?.id||null,
    customer_name:  State.selectedCustomer?.name||'زبون',
    customer_phone: State.selectedCustomer?.phone||'',
    order_type:     State.orderType,
    items: State.cart.map(i=>({
      id:i.id, product_name:i.name, quantity:parseInt(i.quantity),
      unit_price:parseFloat(i.selling_price), purchase_price:parseFloat(i.purchase_price),
      total_price:parseFloat(i.selling_price)*parseInt(i.quantity),
      profit:(parseFloat(i.selling_price)-parseFloat(i.purchase_price))*parseInt(i.quantity),
    })),
    subtotal, discount_amount:discAmt, tax_amount:subtotal*State.taxRate/100,
    total, payment_method:State.payMethod,
    payment_status: State.payMethod==='debt'?'unpaid':'paid',
    amount_paid:    State.payMethod==='debt'?0:amtPaid,
    change_amount:  State.payMethod==='cash'?Math.max(0,amtPaid-total):0,
    order_status:   'pending',
    notes:          document.getElementById('orderNotes').value,
    cashier_name:   State.user?.full_name||'كاشير',
    order_date:     new Date().toISOString().split('T')[0],
    created_at:     new Date().toISOString(),
    items_count:    State.cart.length,
  };

  // حفظ الطلب
  const orders = JSON.parse(localStorage.getItem('pos_orders')||'[]');
  orders.unshift(orderData);
  localStorage.setItem('pos_orders', JSON.stringify(orders.slice(0,300)));

  // تسجيل الدين تلقائياً
  if (State.payMethod==='debt') {
    const debts = JSON.parse(localStorage.getItem('pos_debts')||'[]');
    debts.unshift({
      id:Date.now()+1,
      customer_id:    State.selectedCustomer?.id||null,
      customer_name:  State.selectedCustomer?.name||'زبون',
      customer_phone: State.selectedCustomer?.phone||'',
      order_id:       orderData.id,
      order_number:   orderNum,
      original_amount:total, paid_amount:0, remaining_amount:total,
      status:'pending',
      notes:'دين من طلب '+orderNum,
      created_at:new Date().toISOString(),
    });
    localStorage.setItem('pos_debts', JSON.stringify(debts));
  }

  // إحصائيات اليوم
  const today = new Date().toDateString();
  const dailyStats = JSON.parse(localStorage.getItem('pos_daily')||'{}');
  if (!dailyStats[today]) dailyStats[today]={orders:0,revenue:0,profit:0,products:{}};
  dailyStats[today].orders++;
  dailyStats[today].revenue += total;
  orderData.items.forEach(i=>{
    dailyStats[today].profit += (i.profit||0);
    dailyStats[today].products[i.product_name]=(dailyStats[today].products[i.product_name]||0)+i.quantity;
  });
  localStorage.setItem('pos_daily', JSON.stringify(dailyStats));

  // تحديث المخزون
  orderData.items.forEach(item=>{
    const p=State.products.find(pr=>pr.id==item.id);
    if(p){p.stock=Math.max(0,p.stock-item.quantity);p.total_sold=(p.total_sold||0)+item.quantity;}
  });
  localStorage.setItem('pos_products', JSON.stringify(State.products));

  // تحديث العميل
  if (State.selectedCustomer) {
    const customers=JSON.parse(localStorage.getItem('pos_customers')||'[]');
    const idx=customers.findIndex(c=>c.id==State.selectedCustomer.id);
    if(idx!==-1){customers[idx].total_orders=(customers[idx].total_orders||0)+1;customers[idx].total_spent=(parseFloat(customers[idx].total_spent)||0)+total;localStorage.setItem('pos_customers',JSON.stringify(customers));}
  }

  setTimeout(()=>{
    btn.disabled=false; btn.innerHTML='<i class="fas fa-check-circle"></i> تأكيد الطلب';
    playBeep(); showSuccessModal(orderData); updateBadges();
    State.cart=[]; State.selectedCustomer=null;
    document.getElementById('cartCustomer').style.display='none';
    document.getElementById('orderNotes').value='';
    document.getElementById('discountValue').value=0;
    document.getElementById('amountPaid').value='';
    renderCart(); renderProducts(State.products);
  },500);
}

function showSuccessModal(order) {
  const isDebt = order.payment_method==='debt';
  const div=document.createElement('div');
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999';
  div.innerHTML=`<div style="background:var(--bg2);border-radius:20px;padding:2rem;text-align:center;max-width:340px;width:90%;animation:slideUp .3s ease">
    <div style="font-size:4rem">${isDebt?'📝':'✅'}</div>
    <h2 style="color:${isDebt?'var(--warning)':'var(--success)'};margin:.5rem 0">تم تأكيد الطلب!</h2>
    <p style="font-weight:700;font-size:1.1rem">${order.order_number}</p>
    <p style="color:var(--text2)">المجموع: <strong>${order.total.toFixed(2)} ${CURRENCY}</strong></p>
    ${order.change_amount>0?`<p style="color:var(--success);font-weight:700">الباقي: ${order.change_amount.toFixed(2)} ${CURRENCY}</p>`:''}
    ${isDebt?`<p style="color:var(--warning);font-weight:700;font-size:.9rem;margin-top:.5rem">⚠️ تم تسجيل الدين باسم: ${order.customer_name}</p>`:''}
    <div style="display:flex;gap:.5rem;margin-top:1rem;justify-content:center">
      <button onclick='printOrderReceipt(${JSON.stringify(order).replace(/'/g,"\\'")})'
        style="padding:.5rem 1rem;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-family:var(--font)">🖨️ طباعة</button>
      <button onclick="this.closest('[style*=fixed]').remove()"
        style="padding:.5rem 1rem;background:var(--bg3);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:var(--font)">إغلاق</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),6000);
}

// ── الطباعة (بون - صفحة واحدة) ───────────────────────────
function printOrderReceipt(order) {
  if (typeof order==='string') order=JSON.parse(order);
  const shopName = State.settings.shop_name||'كافيه النخبة';
  const footer   = State.settings.receipt_footer||'شكراً لزيارتكم! 🌟';
  const items    = order.items||[];
  const html=`<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>بون</title>
<style>
  @page{size:80mm auto;margin:5mm}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;color:#000;background:#fff;width:72mm}
  .c{text-align:center}.b{font-weight:bold}.l{font-size:15px}
  .d{border-top:1px dashed #000;margin:5px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:3px 1px;font-size:11px}
  .tr{font-weight:bold;font-size:13px}
</style></head><body>
  <div class="c b l">${shopName}</div>
  <div class="c" style="font-size:10px">${State.settings.shop_address||''}</div>
  <div class="d"></div>
  <div>رقم: <b>${order.order_number}</b></div>
  <div>التاريخ: ${new Date(order.created_at||Date.now()).toLocaleString('ar-MA')}</div>
  <div>الكاشير: ${order.cashier_name||'كاشير'}</div>
  <div>العميل: ${order.customer_name||'زبون'}</div>
  <div class="d"></div>
  <table>
    <tr><td class="b">الصنف</td><td class="b" align="center">ك</td><td class="b" align="right">الثمن</td></tr>
    <tr><td colspan="3"><div class="d"></div></td></tr>
    ${items.map(i=>`<tr><td>${i.product_name||i.name}</td><td align="center">${i.quantity}</td><td align="right">${parseFloat(i.total_price||0).toFixed(2)}</td></tr>`).join('')}
  </table>
  <div class="d"></div>
  <table>
    ${parseFloat(order.discount_amount||0)>0?`<tr><td>الخصم:</td><td align="right">-${parseFloat(order.discount_amount).toFixed(2)} ${CURRENCY}</td></tr>`:''}
    <tr class="tr"><td>المجموع:</td><td align="right">${parseFloat(order.total||0).toFixed(2)} ${CURRENCY}</td></tr>
    <tr><td>الدفع:</td><td align="right">${{cash:'نقدي',card:'بطاقة',transfer:'تحويل',debt:'دين'}[order.payment_method]||'-'}</td></tr>
    ${parseFloat(order.change_amount||0)>0?`<tr><td>الباقي:</td><td align="right">${parseFloat(order.change_amount).toFixed(2)} ${CURRENCY}</td></tr>`:''}
    ${order.payment_method==='debt'?`<tr><td colspan="2" style="color:red;font-weight:bold;text-align:center">⚠️ مسجل كدين</td></tr>`:''}
  </table>
  <div class="d"></div>
  ${order.notes?`<div>ملاحظة: ${order.notes}</div><div class="d"></div>`:''}
  <div class="c b">${footer}</div>
</body></html>`;
  const w=window.open('','_blank','width=350,height=650');
  w.document.write(html); w.document.close();
  w.onload=()=>{w.print();w.close();};
}

function printQuickReceipt() {
  if (!State.cart.length) { toast('السلة فارغة','warning'); return; }
  const total    = parseFloat((document.getElementById('totalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const subtotal = parseFloat((document.getElementById('subtotalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const discAmt  = parseFloat((document.getElementById('discountVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  printOrderReceipt({
    order_number:'DRAFT-'+Date.now(), customer_name:State.selectedCustomer?.name||'زبون',
    cashier_name:State.user?.full_name||'كاشير', created_at:new Date().toISOString(),
    order_type:State.orderType,
    items:State.cart.map(i=>({product_name:i.name,quantity:i.quantity,unit_price:i.selling_price,total_price:i.selling_price*i.quantity})),
    subtotal, discount_amount:discAmt, tax_amount:0, total,
    payment_method:State.payMethod, change_amount:0,
    notes:document.getElementById('orderNotes').value,
  });
}

// ── الفاتورة الشهرية الاحترافية ───────────────────────────
function printMonthlyInvoice() {
  const orders  = JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const now     = new Date();
  const mnOrders= orders.filter(o=>{const d=new Date(o.created_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&o.order_status!=='cancelled';});
  const expenses = JSON.parse(localStorage.getItem('pos_expenses')||'[]').filter(e=>{const d=new Date(e.created_at||e.expense_date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});

  const totalRev  = mnOrders.reduce((s,o)=>s+parseFloat(o.total||0),0);
  const totalProf = mnOrders.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>ss+(i.profit||0),0),0);
  const totalExp  = expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const capital   = parseFloat(localStorage.getItem('pos_capital')||'0');
  const netProfit = totalProf - totalExp;
  const balance   = capital + totalRev - totalExp;

  const prodStats={};
  mnOrders.forEach(o=>(o.items||[]).forEach(i=>{
    const k=i.product_name||i.name;
    if(!prodStats[k])prodStats[k]={qty:0,revenue:0};
    prodStats[k].qty+=i.quantity;prodStats[k].revenue+=parseFloat(i.total_price||0);
  }));
  const topProds = Object.entries(prodStats).sort((a,b)=>b[1].qty-a[1].qty);

  const byDay={};
  mnOrders.forEach(o=>{const d=o.order_date||new Date(o.created_at).toISOString().split('T')[0];if(!byDay[d])byDay[d]={orders:0,revenue:0};byDay[d].orders++;byDay[d].revenue+=parseFloat(o.total||0);});
  const monthName = now.toLocaleString('ar-MA',{month:'long',year:'numeric'});
  const shopName  = State.settings.shop_name||'كافيه النخبة';

  const html=`<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>الفاتورة الشهرية</title>
<style>
  @page{margin:15mm;size:A4}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px}
  .header{background:linear-gradient(135deg,#1e1b4b,#4f46e5);color:white;padding:30px;border-radius:12px;margin-bottom:25px;text-align:center}
  .header h1{font-size:28px;margin-bottom:5px}
  .month{font-size:18px;font-weight:700;margin-top:10px;background:rgba(255,255,255,.2);padding:5px 20px;border-radius:20px;display:inline-block}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
  .card{border-radius:12px;padding:16px;text-align:center;color:white}
  .card.blue{background:linear-gradient(135deg,#3b82f6,#1d4ed8)}
  .card.green{background:linear-gradient(135deg,#10b981,#059669)}
  .card.purple{background:linear-gradient(135deg,#8b5cf6,#6d28d9)}
  .card.red{background:linear-gradient(135deg,#ef4444,#dc2626)}
  .card.gold{background:linear-gradient(135deg,#f59e0b,#d97706)}
  .card.teal{background:linear-gradient(135deg,#14b8a6,#0f766e)}
  .card .val{font-size:20px;font-weight:900;margin:6px 0}
  .card .lbl{font-size:11px;opacity:.9}
  .net{border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;background:${netProfit>=0?'linear-gradient(135deg,#d1fae5,#a7f3d0)':'linear-gradient(135deg,#fee2e2,#fca5a5)'}}
  .net .val{font-size:30px;font-weight:900;color:${netProfit>=0?'#065f46':'#991b1b'}}
  section{margin-bottom:22px}
  section h2{font-size:15px;font-weight:700;padding:9px 14px;background:#f1f5f9;border-right:4px solid #6366f1;border-radius:6px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)}
  thead tr{background:#6366f1;color:white}
  th{padding:9px 11px;text-align:right;font-size:11px}
  td{padding:8px 11px;border-bottom:1px solid #f1f5f9;font-size:11px}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{text-align:center;padding:15px;border-top:1px dashed #e2e8f0;color:#64748b;font-size:11px;margin-top:15px}
  .medal{font-size:14px}
</style>
</head><body>
<div class="header">
  <h1>☕ ${shopName}</h1>
  <p>${State.settings.shop_address||''} | ${State.settings.shop_phone||''}</p>
  <div class="month">📅 الفاتورة الشهرية — ${monthName}</div>
</div>

<div class="grid4">
  <div class="card blue"><div class="lbl">عدد الطلبات</div><div class="val">${mnOrders.length}</div></div>
  <div class="card green"><div class="lbl">إجمالي المبيعات</div><div class="val">${totalRev.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card purple"><div class="lbl">الربح الإجمالي</div><div class="val">${totalProf.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card red"><div class="lbl">إجمالي المصاريف</div><div class="val">${totalExp.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
</div>

<div class="grid3">
  <div class="card gold"><div class="lbl">رأس المال</div><div class="val">${capital.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card ${balance>=0?'teal':'red'}"><div class="lbl">الرصيد الحالي</div><div class="val">${balance.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card ${netProfit>=0?'green':'red'}"><div class="lbl">صافي الربح</div><div class="val">${netProfit>=0?'+':''}${netProfit.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
</div>

<div class="net">
  <p style="color:#374151;font-size:14px">صافي الربح الفعلي بعد المصاريف</p>
  <div class="val">${netProfit>=0?'+':''}${netProfit.toFixed(2)} ${CURRENCY}</div>
  <p style="color:#374151;margin-top:5px">${netProfit>=0?'📈 المحل في ربح الحمد لله ✅':'📉 المحل في خسارة هذا الشهر ⚠️'}</p>
</div>

<section>
  <h2>🏆 أفضل المنتجات مبيعاً</h2>
  <table>
    <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيراد</th><th></th></tr></thead>
    <tbody>${topProds.slice(0,10).map(([name,s],i)=>`
      <tr><td><strong>${i+1}</strong></td><td>${name}</td>
      <td>${s.qty} وحدة</td>
      <td><strong>${s.revenue.toFixed(2)} ${CURRENCY}</strong></td>
      <td class="medal">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'⭐'}</td></tr>`).join('')}
    </tbody>
  </table>
</section>

<section>
  <h2>📅 المبيعات اليومية</h2>
  <table>
    <thead><tr><th>التاريخ</th><th>الطلبات</th><th>الإيراد</th><th>المتوسط</th></tr></thead>
    <tbody>
      ${Object.entries(byDay).sort().map(([date,d])=>`
        <tr><td>${date}</td><td>${d.orders}</td><td>${d.revenue.toFixed(2)} ${CURRENCY}</td>
        <td>${(d.revenue/d.orders).toFixed(2)} ${CURRENCY}</td></tr>`).join('')}
      <tr style="background:#e0e7ff;font-weight:700">
        <td>الإجمالي</td><td>${mnOrders.length}</td>
        <td>${totalRev.toFixed(2)} ${CURRENCY}</td>
        <td>${mnOrders.length?(totalRev/mnOrders.length).toFixed(2):0} ${CURRENCY}</td>
      </tr>
    </tbody>
  </table>
</section>

${expenses.length?`<section>
  <h2>💸 تفاصيل المصاريف</h2>
  <table>
    <thead><tr><th>البيان</th><th>الفئة</th><th>التاريخ</th><th>المبلغ</th></tr></thead>
    <tbody>
      ${expenses.map(e=>`<tr><td>${e.title}</td><td>${e.category||'عام'}</td><td>${e.expense_date||''}</td><td style="color:#ef4444;font-weight:700">${parseFloat(e.amount).toFixed(2)} ${CURRENCY}</td></tr>`).join('')}
      <tr style="background:#fee2e2;font-weight:700"><td colspan="3">إجمالي المصاريف</td><td style="color:#ef4444">${totalExp.toFixed(2)} ${CURRENCY}</td></tr>
    </tbody>
  </table>
</section>`:''}

<div class="footer">
  <p>تم إنشاؤه بتاريخ: ${new Date().toLocaleString('ar-MA')} | ${shopName} © ${now.getFullYear()}</p>
</div>
</body></html>`;
  const w=window.open('','_blank','width=950,height=750');
  w.document.write(html); w.document.close();
  w.onload=()=>w.print();
}

// ── الطلبات ───────────────────────────────────────────────
let _orderPeriod='day';
function loadOrders(period,btn) {
  if(period){_orderPeriod=period;document.querySelectorAll('#page-orders .period-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');}
  const status=document.getElementById('statusFilter')?.value||'';
  const orders=JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const now=new Date();
  const filtered=orders.filter(o=>{
    const d=new Date(o.created_at);
    if(_orderPeriod==='day'&&d.toDateString()!==now.toDateString())return false;
    if(_orderPeriod==='week'&&(now-d)>7*86400000)return false;
    if(_orderPeriod==='month'&&(d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear()))return false;
    if(status&&o.order_status!==status)return false;
    return true;
  });
  renderOrders(filtered);
}

function renderOrders(orders) {
  const c=document.getElementById('ordersList');
  if(!orders.length){c.innerHTML='<div style="text-align:center;padding:3rem;color:var(--text3)">لا توجد طلبات</div>';return;}
  c.innerHTML=orders.map(o=>`
    <div class="order-card">
      <div class="order-card-header">
        <span class="order-num">${o.order_number}</span>
        <span class="order-customer"><i class="fas fa-user"></i> ${o.customer_name||'زبون'}</span>
        <span class="order-status status-${o.order_status}">${statusLabel(o.order_status)}</span>
        <span class="order-total">${parseFloat(o.total||0).toFixed(2)} ${CURRENCY}</span>
        <small style="color:var(--text3)">${formatDate(o.created_at)}</small>
      </div>
      <div style="color:var(--text2);font-size:.85rem;margin-bottom:.7rem">
        ${o.items_count||0} منتج | ${orderTypeLabel(o.order_type)} | ${payLabel(o.payment_method)}
        ${o.payment_status==='unpaid'?'<span style="color:var(--danger);font-weight:700"> ⚠️ دين غير مدفوع</span>':''}
        ${o.notes?`<br>📝 ${o.notes}`:''}
      </div>
      <div class="order-card-actions">
        <select onchange="updateOrderStatus(${o.id},this.value)">
          <option value="pending" ${o.order_status==='pending'?'selected':''}>⏳ انتظار</option>
          <option value="preparing" ${o.order_status==='preparing'?'selected':''}>👨‍🍳 يحضر</option>
          <option value="ready" ${o.order_status==='ready'?'selected':''}>✅ جاهز</option>
          <option value="delivered" ${o.order_status==='delivered'?'selected':''}>🏠 سُلِّم</option>
          <option value="cancelled" ${o.order_status==='cancelled'?'selected':''}>❌ ملغي</option>
        </select>
        <button class="btn-secondary" onclick='printOrderReceipt(${JSON.stringify(o).replace(/'/g,"\\'")})'><i class="fas fa-print"></i> بون</button>
        <button class="btn-secondary" onclick='sendOrderWhatsApp(${JSON.stringify(o).replace(/'/g,"\\'")})'><i class="fab fa-whatsapp"></i></button>
      </div>
    </div>`).join('');
}

function updateOrderStatus(id,status) {
  const orders=JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const idx=orders.findIndex(o=>o.id==id);
  if(idx!==-1){orders[idx].order_status=status;localStorage.setItem('pos_orders',JSON.stringify(orders));}
  toast('تم تحديث الحالة ✅'); updateBadges();
}

function sendOrderWhatsApp(order) {
  if(typeof order==='string')order=JSON.parse(order);
  const items=(order.items||[]).map(i=>`• ${i.product_name} x${i.quantity} = ${parseFloat(i.total_price||0).toFixed(2)} ${CURRENCY}`).join('\n');
  const msg=`*${State.settings.shop_name||'المحل'}*\n────────\n🧾 ${order.order_number}\n👤 ${order.customer_name||'زبون'}\n────────\n${items}\n────────\n💰 *${parseFloat(order.total||0).toFixed(2)} ${CURRENCY}*\n🌟 شكراً!`;
  window.open('https://wa.me/'+WHATSAPP.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));
}

function sendWhatsApp() {
  if(!State.cart.length){toast('السلة فارغة','warning');return;}
  const total=document.getElementById('totalVal').textContent;
  const items=State.cart.map(i=>`• ${i.name} x${i.quantity} = ${(i.selling_price*i.quantity).toFixed(2)} ${CURRENCY}`).join('\n');
  const msg=`*${State.settings.shop_name||'المحل'}*\n────────\n${items}\n────────\n💰 *${total}*\n🌟 شكراً!`;
  window.open('https://wa.me/'+WHATSAPP.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));
}

// ── المنتجات (إدارة) ──────────────────────────────────────
function loadProductsAdmin() {
  const products=State.products.length?State.products:getDefaultProducts();
  const catSel=document.getElementById('prodCategory');
  if(catSel)catSel.innerHTML=State.categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  document.getElementById('productsTableBody').innerHTML=products.map(p=>{
    const profit=(parseFloat(p.selling_price)-parseFloat(p.purchase_price)).toFixed(2);
    const isLow=parseInt(p.stock)<=(p.min_stock||5);
    return `<tr>
      <td><strong>${p.name}</strong><br><small style="color:var(--text3)">${p.description||''}</small></td>
      <td>${p.category_name||'-'}</td>
      <td>${parseFloat(p.purchase_price).toFixed(2)} ${CURRENCY}</td>
      <td>${parseFloat(p.selling_price).toFixed(2)} ${CURRENCY} <span class="profit-badge">+${profit}</span></td>
      <td class="${isLow?'stock-low':'stock-ok'}">${p.stock}${isLow?' ⚠️':''}</td>
      <td>${p.total_sold||0}</td>
      <td><button class="btn-icon" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  }).join('');
}

function openProductModal(p=null) {
  document.getElementById('productModalTitle').textContent=p?'تعديل منتج':'إضافة منتج';
  ['prodId','prodName','prodDesc','prodBarcode','prodPurchase','prodSelling','prodStock','prodMinStock','prodImage'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    const key={prodId:'id',prodName:'name',prodDesc:'description',prodBarcode:'barcode',prodPurchase:'purchase_price',prodSelling:'selling_price',prodStock:'stock',prodMinStock:'min_stock',prodImage:'image_url'}[id];
    el.value=p?.(p[key]??''):id==='prodStock'?0:id==='prodMinStock'?5:'';
  });
  document.getElementById('prodFeatured').value=p?.is_featured?'1':'0';
  if(p?.category_id)document.getElementById('prodCategory').value=p.category_id;
  openModal('productModal');
}

function editProduct(id) { const p=State.products.find(p=>p.id==id)||getDefaultProducts().find(p=>p.id==id); if(p)openProductModal(p); }

function saveProduct() {
  const id=document.getElementById('prodId').value;
  const data={
    name:document.getElementById('prodName').value,
    description:document.getElementById('prodDesc').value,
    barcode:document.getElementById('prodBarcode').value,
    category_id:parseInt(document.getElementById('prodCategory').value),
    purchase_price:parseFloat(document.getElementById('prodPurchase').value)||0,
    selling_price:parseFloat(document.getElementById('prodSelling').value)||0,
    stock:parseInt(document.getElementById('prodStock').value)||0,
    min_stock:parseInt(document.getElementById('prodMinStock').value)||5,
    image_url:document.getElementById('prodImage').value,
    is_featured:document.getElementById('prodFeatured').value==='1',
    category_name:State.categories.find(c=>c.id==document.getElementById('prodCategory').value)?.name||'',
  };
  if(!data.name){toast('أدخل اسم المنتج','warning');return;}
  const products=getDefaultProducts();
  if(id){const idx=products.findIndex(p=>p.id==id);if(idx!==-1)products[idx]={...products[idx],...data};}
  else{data.id=Date.now();data.total_sold=0;products.push(data);State.products.push(data);}
  localStorage.setItem('pos_products',JSON.stringify(products));
  State.products=products;
  closeModal('productModal');loadProductsAdmin();toast(id?'تم التحديث ✅':'تم الإضافة ✅');
}

function deleteProduct(id) {
  if(!confirm('حذف هذا المنتج؟'))return;
  State.products=State.products.filter(p=>p.id!=id);
  localStorage.setItem('pos_products',JSON.stringify(State.products));
  loadProductsAdmin();toast('تم الحذف','info');
}

// ── العملاء ───────────────────────────────────────────────
function loadCustomers(q='') {
  let customers=JSON.parse(localStorage.getItem('pos_customers')||'[]');
  if(!customers.length){
    customers=[
      {id:1,name:'أحمد محمد',phone:'0612345678',city:'الدار البيضاء',total_orders:5,total_spent:450},
      {id:2,name:'فاطمة الزهراء',phone:'0698765432',city:'الرباط',total_orders:3,total_spent:285},
      {id:3,name:'محمد العمراني',phone:'0654321098',city:'مراكش',total_orders:8,total_spent:720},
    ];
    localStorage.setItem('pos_customers',JSON.stringify(customers));
  }
  State.customers=customers;
  if(q)customers=customers.filter(c=>c.name.includes(q)||(c.phone||'').includes(q));
  renderCustomers(customers);
}

function searchCustomers(q){loadCustomers(q);}

function renderCustomers(customers) {
  const c=document.getElementById('customersList');
  if(!customers.length){c.innerHTML='<div style="text-align:center;padding:2rem;color:var(--text3)">لا يوجد عملاء</div>';return;}
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  c.innerHTML=customers.map(cu=>{
    const custDebts=debts.filter(d=>d.customer_id==cu.id&&d.status!=='paid');
    const debtTotal=custDebts.reduce((s,d)=>s+parseFloat(d.remaining_amount||0),0);
    return `<div class="customer-card">
      <div class="customer-avatar">${cu.name.charAt(0)}</div>
      <div class="customer-name">${cu.name}</div>
      <div class="customer-phone"><i class="fas fa-phone"></i> ${cu.phone||'-'}</div>
      <div style="font-size:.8rem;color:var(--text3)">${cu.city||''}</div>
      ${debtTotal>0?`<div style="color:var(--danger);font-size:.82rem;font-weight:700;margin-top:.3rem">⚠️ دين: ${debtTotal.toFixed(2)} ${CURRENCY}</div>`:''}
      <div class="customer-stats">
        <div><div class="customer-stat-val">${cu.total_orders||0}</div><div class="customer-stat-label">طلب</div></div>
        <div><div class="customer-stat-val">${parseFloat(cu.total_spent||0).toFixed(0)}</div><div class="customer-stat-label">${CURRENCY}</div></div>
      </div>
    </div>`;
  }).join('');
}

function openCustomerModal(){openModal('customerModal');}
function saveCustomer() {
  const data={id:Date.now(),name:document.getElementById('custName').value.trim(),phone:document.getElementById('custPhone').value.trim(),city:document.getElementById('custCity').value.trim(),notes:document.getElementById('custNotes').value.trim(),total_orders:0,total_spent:0,created_at:new Date().toISOString()};
  if(!data.name){toast('أدخل اسم العميل','warning');return;}
  const customers=JSON.parse(localStorage.getItem('pos_customers')||'[]');
  customers.push(data); localStorage.setItem('pos_customers',JSON.stringify(customers)); State.customers=customers;
  closeModal('customerModal'); loadCustomers(); toast('تم إضافة العميل ✅');
  ['custName','custPhone','custCity','custNotes'].forEach(id=>document.getElementById(id).value='');
}

function showCustomerPicker() {
  if(!State.customers.length)loadCustomers();
  renderCustomerPicker(''); openModal('customerPickerModal');
}
function renderCustomerPicker(q) {
  const list=State.customers.filter(c=>!q||c.name.includes(q)||(c.phone||'').includes(q));
  document.getElementById('customerPickerList').innerHTML=list.map(c=>`<div class="picker-item" onclick="selectCustomer(${c.id})"><div><div style="font-weight:700">${c.name}</div><div style="font-size:.8rem;opacity:.7">${c.phone||''} ${c.city?'• '+c.city:''}</div></div></div>`).join('')||'<div style="text-align:center;color:var(--text3);padding:1rem">لا يوجد عملاء</div>';
}
function searchCustomerPicker(q){renderCustomerPicker(q);}
function selectCustomer(id) {
  State.selectedCustomer=State.customers.find(c=>c.id==id);
  if(State.selectedCustomer){document.getElementById('cartCustomer').style.display='flex';document.getElementById('cartCustomerName').textContent=State.selectedCustomer.name;}
  closeModal('customerPickerModal');
}
function removeCartCustomer(){State.selectedCustomer=null;document.getElementById('cartCustomer').style.display='none';}
function quickAddCustomer(){closeModal('customerPickerModal');openModal('customerModal');}

// ── الديون ────────────────────────────────────────────────
function loadDebts(status='',btn,filterCustId=null) {
  if(btn){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  let debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  if(status)debts=debts.filter(d=>d.status===status);
  if(filterCustId)debts=debts.filter(d=>d.customer_id==filterCustId);

  const totalDebt=debts.filter(d=>d.status!=='paid').reduce((s,d)=>s+parseFloat(d.remaining_amount||0),0);
  document.getElementById('debtsSummary').innerHTML=`
    <div class="stat-card red"><div class="stat-icon">💰</div><div class="stat-value">${totalDebt.toFixed(2)} ${CURRENCY}</div><div class="stat-label">إجمالي الديون</div></div>
    <div class="stat-card orange"><div class="stat-icon">👤</div><div class="stat-value">${debts.filter(d=>d.status!=='paid').length}</div><div class="stat-label">مدين نشط</div></div>
    <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-value">${debts.filter(d=>d.status==='paid').length}</div><div class="stat-label">مسددة</div></div>`;

  document.getElementById('debtsList').innerHTML=debts.map(d=>{
    const pct=d.original_amount>0?Math.min(100,(d.paid_amount/d.original_amount*100)):0;
    return `<div class="debt-card">
      <div class="debt-card-header">
        <div>
          <div class="debt-name">${d.customer_name}</div>
          <div class="debt-phone"><i class="fas fa-phone"></i> ${d.customer_phone||'-'}</div>
          ${d.order_number?`<div style="font-size:.78rem;color:var(--text3)">طلب: ${d.order_number}</div>`:''}
        </div>
        <div class="debt-amount">${parseFloat(d.remaining_amount||0).toFixed(2)} ${CURRENCY}</div>
        <span class="debt-status ${d.status}">${debtStatusLabel(d.status)}</span>
      </div>
      <div class="debt-progress"><div class="debt-progress-bar" style="width:${pct}%"></div></div>
      <div class="debt-info">
        الأصلي: ${parseFloat(d.original_amount||0).toFixed(2)} | مدفوع: <strong style="color:var(--success)">${parseFloat(d.paid_amount||0).toFixed(2)}</strong> ${CURRENCY}
        ${d.due_date?` | ⏰ ${d.due_date}`:''}
        ${d.notes?`<br>📝 ${d.notes}`:''}
        <br><small>${formatDate(d.created_at)}</small>
      </div>
      <div class="debt-actions">
        ${d.status!=='paid'?`<button class="btn-primary" onclick="openPayDebt(${d.id},${d.remaining_amount})">💳 تسديد</button>`:''}
        ${d.customer_phone?`<button class="btn-secondary" onclick="remindDebt('${d.customer_phone}','${d.customer_name}',${d.remaining_amount})"><i class='fab fa-whatsapp'></i> تذكير</button>`:''}
      </div>
    </div>`;
  }).join('')||'<div style="text-align:center;padding:2rem;color:var(--text3)">لا توجد ديون</div>';
  updateBadges();
}

function openDebtModal(){openModal('debtModal');}
function saveDebt() {
  const data={id:Date.now(),customer_name:document.getElementById('debtCustomer').value.trim(),customer_phone:document.getElementById('debtPhone').value.trim(),original_amount:parseFloat(document.getElementById('debtAmount').value)||0,paid_amount:0,remaining_amount:parseFloat(document.getElementById('debtAmount').value)||0,due_date:document.getElementById('debtDue').value,notes:document.getElementById('debtNotes').value,status:'pending',created_at:new Date().toISOString()};
  if(!data.customer_name||!data.original_amount){toast('أدخل الاسم والمبلغ','warning');return;}
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  debts.unshift(data);localStorage.setItem('pos_debts',JSON.stringify(debts));
  closeModal('debtModal');loadDebts();toast('تم تسجيل الدين ✅');
  ['debtCustomer','debtPhone','debtAmount','debtDue','debtNotes'].forEach(id=>document.getElementById(id).value='');
}

function openPayDebt(id,remaining) {
  State.currentDebtId=id;
  document.getElementById('debtRemaining').textContent=parseFloat(remaining).toFixed(2);
  document.getElementById('payDebtAmount').value=parseFloat(remaining).toFixed(2);
  openModal('payDebtModal');
}
function confirmPayDebt() {
  const amount=parseFloat(document.getElementById('payDebtAmount').value)||0;
  if(!amount){toast('أدخل المبلغ','warning');return;}
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  const idx=debts.findIndex(d=>d.id==State.currentDebtId);
  if(idx!==-1){
    debts[idx].paid_amount=(parseFloat(debts[idx].paid_amount)||0)+amount;
    debts[idx].remaining_amount=Math.max(0,parseFloat(debts[idx].original_amount)-debts[idx].paid_amount);
    debts[idx].status=debts[idx].remaining_amount<=0?'paid':'partial';
    localStorage.setItem('pos_debts',JSON.stringify(debts));
  }
  closeModal('payDebtModal');loadDebts();playBeep();toast('✅ تم تسجيل الدفع');
}
function remindDebt(phone,name,amount) {
  const msg=`مرحباً ${name}،\nنذكركم بدين بمبلغ *${parseFloat(amount).toFixed(2)} ${CURRENCY}*\nيرجى التسديد في أقرب وقت.\n${State.settings.shop_name||'المحل'} 🌟`;
  window.open('https://wa.me/'+phone.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));
}

// ── المصاريف ──────────────────────────────────────────────
function loadExpenses() {
  const expenses=JSON.parse(localStorage.getItem('pos_expenses')||'[]');
  const orders=JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const totalIn=orders.filter(o=>o.payment_status!=='cancelled').reduce((s,o)=>s+parseFloat(o.total||0),0);
  const totalOut=expenses.reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const capital=parseFloat(localStorage.getItem('pos_capital')||'0');
  const balance=capital+totalIn-totalOut;
  const catIcons={'إيجار':'🏠','مشتريات':'🛒','رواتب':'👤','كهرباء وماء':'💡','صيانة':'🔧','أخرى':'📝'};
  document.getElementById('expensesList').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
      <div class="stat-card blue"><div class="stat-icon">🏦</div><div class="stat-value">${capital.toFixed(2)} ${CURRENCY}</div><div class="stat-label">رأس المال الأولي</div>
        <button onclick="updateCapital()" style="margin-top:.5rem;padding:.3rem .8rem;background:white;color:var(--info);border:none;border-radius:8px;cursor:pointer;font-family:var(--font);font-size:.8rem">تعديل</button></div>
      <div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-value">${totalIn.toFixed(2)} ${CURRENCY}</div><div class="stat-label">إجمالي الإيرادات</div></div>
      <div class="stat-card ${balance>=0?'purple':'red'}"><div class="stat-icon">${balance>=0?'💎':'⚠️'}</div><div class="stat-value">${balance.toFixed(2)} ${CURRENCY}</div><div class="stat-label">الرصيد الحالي في المطعم</div></div>
    </div>
    <div style="background:var(--danger);color:white;border-radius:var(--radius);padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
      <span>إجمالي المصاريف</span><strong style="font-size:1.3rem">${totalOut.toFixed(2)} ${CURRENCY}</strong>
    </div>
    ${expenses.map(e=>`<div class="expense-card">
      <div class="expense-icon">${catIcons[e.category]||'📝'}</div>
      <div class="expense-info"><div class="expense-title">${e.title}</div><div class="expense-category">${e.category||'عام'}</div></div>
      <div><div class="expense-amount">-${parseFloat(e.amount||0).toFixed(2)} ${CURRENCY}</div><div class="expense-date">${e.expense_date||''}</div></div>
      <button onclick="deleteExpense(${e.id})" style="background:none;border:none;color:var(--danger);cursor:pointer"><i class="fas fa-trash"></i></button>
    </div>`).join('')||'<div style="text-align:center;padding:2rem;color:var(--text3)">لا توجد مصاريف</div>'}`;
}

function updateCapital() {
  const v=prompt('أدخل رأس المال (بالدرهم):',localStorage.getItem('pos_capital')||'0');
  if(v!==null&&!isNaN(parseFloat(v))){localStorage.setItem('pos_capital',parseFloat(v));loadExpenses();toast('تم تحديث رأس المال ✅');}
}
function openExpenseModal(){document.getElementById('expDate').value=new Date().toISOString().split('T')[0];openModal('expenseModal');}
function saveExpense() {
  const data={id:Date.now(),title:document.getElementById('expTitle').value,amount:parseFloat(document.getElementById('expAmount').value)||0,category:document.getElementById('expCategory').value,expense_date:document.getElementById('expDate').value,created_at:new Date().toISOString()};
  if(!data.title||!data.amount){toast('أدخل البيان والمبلغ','warning');return;}
  const expenses=JSON.parse(localStorage.getItem('pos_expenses')||'[]');
  expenses.unshift(data);localStorage.setItem('pos_expenses',JSON.stringify(expenses));
  closeModal('expenseModal');loadExpenses();toast('تم الإضافة ✅');
}
function deleteExpense(id) {
  if(!confirm('حذف هذا المصروف؟'))return;
  localStorage.setItem('pos_expenses',JSON.stringify(JSON.parse(localStorage.getItem('pos_expenses')||'[]').filter(e=>e.id!=id)));
  loadExpenses();toast('تم الحذف','info');
}

// ── التقارير ──────────────────────────────────────────────
function loadReports(period,btn) {
  if(btn){document.querySelectorAll('#page-reports .period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const stats=getLocalStats(period);
  renderStats(stats);renderCharts(stats);renderLowStock(stats.low_stock||[]);
  let mb=document.getElementById('monthlyInvoiceBtn');
  if(!mb){mb=document.createElement('button');mb.id='monthlyInvoiceBtn';mb.className='btn-secondary';mb.innerHTML='🖨️ الفاتورة الشهرية';mb.onclick=printMonthlyInvoice;document.querySelector('#page-reports .page-header').appendChild(mb);}
}

function getLocalStats(period) {
  const orders=JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const now=new Date();
  const filtered=orders.filter(o=>{
    if(o.order_status==='cancelled')return false;
    const d=new Date(o.created_at);
    if(period==='day'&&d.toDateString()!==now.toDateString())return false;
    if(period==='week'&&(now-d)>7*86400000)return false;
    if(period==='month'&&(d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear()))return false;
    return true;
  });
  const revenue=filtered.reduce((s,o)=>s+parseFloat(o.total||0),0);
  let profit=0;const pc={};
  filtered.forEach(o=>(o.items||[]).forEach(i=>{profit+=(i.profit||0);pc[i.product_name||i.name]=(pc[i.product_name||i.name]||0)+i.quantity;}));
  const topProducts=Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,qty])=>({product_name:name,qty}));
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  const totalDebts=debts.filter(d=>d.status!=='paid').reduce((s,d)=>s+parseFloat(d.remaining_amount||0),0);
  const products=State.products.length?State.products:getDefaultProducts();
  const lowStock=products.filter(p=>parseInt(p.stock)<=(p.min_stock||5));
  const weeklyData=[];
  for(let i=6;i>=0;i--){const d=new Date(now-i*86400000);const dO=orders.filter(o=>new Date(o.created_at).toDateString()===d.toDateString()&&o.order_status!=='cancelled');weeklyData.push({order_date:d.toLocaleDateString('ar-MA',{weekday:'short',day:'numeric'}),revenue:dO.reduce((s,o)=>s+parseFloat(o.total||0),0),orders:dO.length});}
  return{sales:{orders_count:filtered.length,total_revenue:revenue},profit:{total_profit:profit},top_products:topProducts,debts:{total_debts:totalDebts,debts_count:debts.filter(d=>d.status!=='paid').length},low_stock:lowStock,weekly_data:weeklyData};
}

function renderStats(stats) {
  const s=stats.sales||{},p=stats.profit||{},d=stats.debts||{};
  document.getElementById('statsGrid').innerHTML=`
    <div class="stat-card blue"><div class="stat-icon">📦</div><div class="stat-value">${s.orders_count||0}</div><div class="stat-label">عدد الطلبات</div></div>
    <div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-value">${parseFloat(s.total_revenue||0).toFixed(2)}</div><div class="stat-label">المبيعات (${CURRENCY})</div></div>
    <div class="stat-card purple"><div class="stat-icon">📈</div><div class="stat-value">${parseFloat(p.total_profit||0).toFixed(2)}</div><div class="stat-label">الربح (${CURRENCY})</div></div>
    <div class="stat-card red"><div class="stat-icon">💳</div><div class="stat-value">${parseFloat(d.total_debts||0).toFixed(2)}</div><div class="stat-label">الديون (${CURRENCY})</div></div>
    <div class="stat-card orange"><div class="stat-icon">🏆</div><div class="stat-value" style="font-size:.95rem">${stats.top_products?.[0]?.product_name||'-'}</div><div class="stat-label">أكثر مبيعاً</div></div>`;
}
function renderCharts(stats) {
  const w=stats.weekly_data||[];
  if(State.chartSales)State.chartSales.destroy();
  State.chartSales=new Chart(document.getElementById('salesChart').getContext('2d'),{type:'line',data:{labels:w.map(d=>d.order_date),datasets:[{label:'المبيعات',data:w.map(d=>d.revenue),borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.1)',tension:.4,fill:true}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
  const top=stats.top_products||[];
  if(State.chartTop)State.chartTop.destroy();
  State.chartTop=new Chart(document.getElementById('topChart').getContext('2d'),{type:'bar',data:{labels:top.map(p=>p.product_name),datasets:[{data:top.map(p=>p.qty),backgroundColor:['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6']}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
}
function renderLowStock(items) {
  const s=document.getElementById('lowStockSection');
  if(!items.length){s.innerHTML='';return;}
  s.innerHTML=`<div class="low-stock-section"><h3>⚠️ مخزون منخفض (${items.length})</h3><div class="low-stock-list">${items.map(p=>`<div class="low-stock-item"><span>${p.name}</span><span class="stock-low">متبقي: ${p.stock}</span></div>`).join('')}</div></div>`;
}

// ── الإدارة ───────────────────────────────────────────────
function loadAdmin(){loadSettings();renderSettingsForm();document.getElementById('usersList').innerHTML=`<div class="picker-item"><i class="fas fa-user-shield"></i><div><div style="font-weight:700">admin — المدير العام</div><div style="font-size:.8rem;opacity:.7">admin123</div></div></div><div class="picker-item"><i class="fas fa-user"></i><div><div style="font-weight:700">worker — موظف الكاشير</div><div style="font-size:.8rem;opacity:.7">worker123</div></div></div>`;}
function renderSettingsForm() {
  const s=State.settings;
  document.getElementById('settingsForm').innerHTML=`
    <div class="form-group"><label>اسم المحل</label><input type="text" id="set_shop_name" value="${s.shop_name||'كافيه النخبة'}"></div>
    <div class="form-group"><label>العنوان</label><input type="text" id="set_shop_address" value="${s.shop_address||''}"></div>
    <div class="form-group"><label>الهاتف</label><input type="text" id="set_shop_phone" value="${s.shop_phone||''}"></div>
    <div class="form-group"><label>WhatsApp</label><input type="text" id="set_shop_whatsapp" value="${s.shop_whatsapp||WHATSAPP}"></div>
    <div class="form-group"><label>نسبة الضريبة %</label><input type="number" id="set_tax_rate" value="${s.tax_rate||0}"></div>
    <div class="form-group"><label>كلمة سر اللوحة السرية</label><input type="password" id="set_secret_password" value="${s.secret_password||'secret2024'}"></div>
    <div class="form-group"><label>نص أسفل الفاتورة</label><input type="text" id="set_receipt_footer" value="${s.receipt_footer||'شكراً لزيارتكم! 🌟'}"></div>`;
}
function loadSettings(){const s=localStorage.getItem('pos_settings');if(s)State.settings=JSON.parse(s);State.taxRate=parseFloat(State.settings.tax_rate||0);const sn=document.getElementById('shopName');if(sn&&State.settings.shop_name)sn.textContent=State.settings.shop_name;}
function saveSettings(){const keys=['shop_name','shop_address','shop_phone','shop_whatsapp','tax_rate','secret_password','receipt_footer'];keys.forEach(k=>{const el=document.getElementById('set_'+k);if(el)State.settings[k]=el.value;});localStorage.setItem('pos_settings',JSON.stringify(State.settings));State.taxRate=parseFloat(State.settings.tax_rate||0);const sn=document.getElementById('shopName');if(sn&&State.settings.shop_name)sn.textContent=State.settings.shop_name;toast('تم حفظ الإعدادات ✅');}
function generateQR(){const c=document.getElementById('qrContainer');c.innerHTML='';new QRCode(c,{text:window.location.href,width:150,height:150});toast('تم توليد QR Code ✅');}
function backupData(){const data={products:JSON.parse(localStorage.getItem('pos_products')||'[]'),orders:JSON.parse(localStorage.getItem('pos_orders')||'[]'),customers:JSON.parse(localStorage.getItem('pos_customers')||'[]'),debts:JSON.parse(localStorage.getItem('pos_debts')||'[]'),expenses:JSON.parse(localStorage.getItem('pos_expenses')||'[]'),settings:JSON.parse(localStorage.getItem('pos_settings')||'{}'),backup_date:new Date().toISOString()};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='pos_backup_'+new Date().toISOString().split('T')[0]+'.json';a.click();toast('تم تنزيل النسخة ✅');}
function restoreData(e){const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.products)localStorage.setItem('pos_products',JSON.stringify(d.products));if(d.orders)localStorage.setItem('pos_orders',JSON.stringify(d.orders));if(d.customers)localStorage.setItem('pos_customers',JSON.stringify(d.customers));if(d.debts)localStorage.setItem('pos_debts',JSON.stringify(d.debts));if(d.expenses)localStorage.setItem('pos_expenses',JSON.stringify(d.expenses));if(d.settings)localStorage.setItem('pos_settings',JSON.stringify(d.settings));toast('تم الاسترجاع ✅');setTimeout(()=>location.reload(),1000);}catch{toast('ملف خاطئ','error');}};r.readAsText(e.target.files[0]);}

// ── اللوحة السرية ─────────────────────────────────────────
function openSecretPanel(){document.getElementById('secretPanel').classList.remove('hidden');}
function closeSecretPanel(){document.getElementById('secretPanel').classList.add('hidden');document.getElementById('secretLock').style.display='block';document.getElementById('secretData').classList.add('hidden');document.getElementById('secretPassInput').value='';}
function verifySecret(){
  const pass=document.getElementById('secretPassInput').value;
  if(pass===(State.settings.secret_password||'secret2024')){
    document.getElementById('secretLock').style.display='none';document.getElementById('secretData').classList.remove('hidden');
    const stats=getLocalStats('day');
    document.getElementById('secretOrders').textContent=stats.sales.orders_count;
    document.getElementById('secretRevenue').textContent=parseFloat(stats.sales.total_revenue).toFixed(2)+' '+CURRENCY;
    document.getElementById('secretProfit').textContent=parseFloat(stats.profit.total_profit).toFixed(2)+' '+CURRENCY;
    document.getElementById('secretTop').textContent=stats.top_products?.[0]?.product_name||'-';
  }else{toast('كلمة السر خاطئة ❌','error');document.getElementById('secretPassInput').value='';}
}

// ── مساعدات ───────────────────────────────────────────────
async function apiGet(a){const r=await fetch(API+a);if(!r.ok)throw new Error(r.status);return r.json();}
function openModal(id){document.getElementById(id).classList.remove('hidden');}
function closeModal(id){document.getElementById(id).classList.add('hidden');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal'))closeModal(e.target.id);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));});

function toast(msg,type='success',dur=3000){
  const c=document.getElementById('toastContainer');
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=`<span>${icons[type]||'✅'}</span><span>${msg}</span>`;c.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300);},dur);
}
function playBeep(){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(880,ctx.currentTime);g.gain.setValueAtTime(0.2,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);o.start();o.stop(ctx.currentTime+0.15);}catch{}}
function formatDate(d){if(!d)return'';try{return new Date(d).toLocaleString('ar-MA');}catch{return d;}}
function statusLabel(s){return{pending:'⏳ انتظار',preparing:'👨‍🍳 يحضر',ready:'✅ جاهز',delivered:'🏠 سُلِّم',cancelled:'❌ ملغي'}[s]||s;}
function orderTypeLabel(t){return{dine_in:'🍽️ داخل',takeaway:'🛍️ خارج',delivery:'🛵 توصيل'}[t]||t;}
function payLabel(m){return{cash:'💵 نقدي',card:'💳 بطاقة',transfer:'📱 تحويل',debt:'📝 دين'}[m]||m;}
function debtStatusLabel(s){return{pending:'غير مدفوع',partial:'جزئي',paid:'✅ مدفوع'}[s]||s;}
function toggleDark(){document.body.classList.toggle('dark');const d=document.body.classList.contains('dark');localStorage.setItem('pos_dark',d);document.getElementById('darkIcon').className=d?'fas fa-sun':'fas fa-moon';document.getElementById('darkText').textContent=d?'وضع نهاري':'وضع ليلي';}
function applyDarkMode(){if(localStorage.getItem('pos_dark')==='true'){document.body.classList.add('dark');const i=document.getElementById('darkIcon');if(i){i.className='fas fa-sun';document.getElementById('darkText').textContent='وضع نهاري';}}}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('collapsed');}
function saveCartToStorage(){localStorage.setItem('pos_cart',JSON.stringify(State.cart));}
function loadCartFromStorage(){const c=JSON.parse(localStorage.getItem('pos_cart')||'[]');if(c.length){State.cart=c;renderCart();}}
function updateBadges(){
  const orders=JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const pending=orders.filter(o=>o.order_status==='pending'&&new Date(o.created_at).toDateString()===new Date().toDateString()).length;
  const pb=document.getElementById('pendingBadge');if(pb){pb.textContent=pending;pb.style.display=pending?'':'none';}
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  const unpaid=debts.filter(d=>d.status!=='paid').length;
  const db=document.getElementById('debtsBadge');if(db){db.textContent=unpaid;db.style.display=unpaid?'':'none';}
}
