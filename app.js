// ============================================================
// app.js v4.0 - المنطق البرمجي الكامل
// ============================================================
'use strict';

const CURRENCY = 'DH';
const WHATSAPP = '+212600000000';

const State = {
  user: null, cart: [], products: [], categories: [], customers: [],
  orderType: 'dine_in', payMethod: 'cash', selectedCustomer: null,
  currentDebtId: null, chartSales: null, chartTop: null,
  taxRate: 0, settings: {}, currentSort: 'popular', currentCategory: 0,
  gridCols: 3, logoBase64: '',
};

// ══ بدء التطبيق ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  applyDarkMode();
  loadSettingsFromStorage();
  const saved = localStorage.getItem('pos_user');
  if (saved) { State.user = JSON.parse(saved); showApp(); }
});

function loadSettingsFromStorage() {
  const s = JSON.parse(localStorage.getItem('pos_settings') || '{}');
  State.settings = s;
  State.taxRate = parseFloat(s.tax_rate || 0);
  State.logoBase64 = s.logo_base64 || '';
  if (s.shop_name) {
    const sn = document.getElementById('shopName');
    const ln = document.getElementById('loginShopName');
    if (sn) sn.textContent = s.shop_name;
    if (ln) ln.textContent = s.shop_name;
  }
  applyLogo(s.logo_base64 || '');
}

function applyLogo(base64) {
  if (!base64) return;
  const ids = ['sidebarLogo','currentLogo','loginLogo'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.src = base64; el.style.display = 'block'; }
  });
  const emojis = ['sidebarEmoji','loginEmoji'];
  emojis.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

// ══ المصادقة ═════════════════════════════════════════════
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const USERS = {
    admin:  { username:'admin',  password:'admin123',  full_name:'المدير العام',  role:'admin'  },
    worker: { username:'worker', password:'worker123', full_name:'موظف الكاشير', role:'worker' },
  };
  // تحقق من كلمة المرور المخصصة
  const customUsers = JSON.parse(localStorage.getItem('pos_users') || '[]');
  const customUser = customUsers.find(u => u.username === username && u.password === password);
  const u = customUser || USERS[username];
  if (u && (customUser || u.password === password)) {
    State.user = { username: u.username, full_name: u.full_name, role: u.role };
    localStorage.setItem('pos_user', JSON.stringify(State.user));
    showApp();
    toast('مرحباً ' + u.full_name + ' 👋');
  } else {
    toast('اسم المستخدم أو كلمة المرور خاطئة', 'error');
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
  showPage('pos');
  updateBadges();
}

function applyRolePermissions() {
  const isWorker = State.user.role === 'worker';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isWorker ? 'none' : '';
  });
}

// ══ التنقل ═══════════════════════════════════════════════
function showPage(page) {
  const adminOnly = ['products','customers','debts','cash','reports','admin'];
  if (State.user?.role === 'worker' && adminOnly.includes(page)) {
    toast('ليس لديك صلاحية', 'error'); return;
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
    case 'cash':      loadCash();          break;
    case 'reports':   loadReports('day');  break;
    case 'admin':     loadAdmin();         break;
  }
}

// ══ POS ══════════════════════════════════════════════════
async function loadPOS() {
  State.categories = getDefaultCategories();
  State.products = getDefaultProducts();
  renderCategories();
  renderProducts(State.products);
  loadCartFromStorage();
}

function getDefaultCategories() {
  return [
    {id:1,name:'المشروبات الساخنة',icon:'☕'},
    {id:2,name:'المشروبات الباردة',icon:'🧊'},
    {id:3,name:'الوجبات الرئيسية',icon:'🍽️'},
    {id:4,name:'السندويشات',icon:'🥪'},
    {id:5,name:'الحلويات',icon:'🍰'},
  ];
}

function getDefaultProducts() {
  const s = localStorage.getItem('pos_products');
  if (s) return JSON.parse(s);
  return [
    {id:1,name:'قهوة عربية',description:'قهوة أصيلة بالهيل',category_id:1,selling_price:15,purchase_price:5,stock:100,min_stock:10,total_sold:245,is_featured:true,image_path:'',category_name:'المشروبات الساخنة'},
    {id:2,name:'كابتشينو',description:'كابتشينو إيطالي',category_id:1,selling_price:22,purchase_price:8,stock:80,min_stock:10,total_sold:198,is_featured:true,image_path:'',category_name:'المشروبات الساخنة'},
    {id:3,name:'شاي أخضر',description:'شاي أخضر طبيعي',category_id:1,selling_price:12,purchase_price:3,stock:150,min_stock:15,total_sold:156,is_featured:false,image_path:'',category_name:'المشروبات الساخنة'},
    {id:4,name:'لاتيه',description:'لاتيه بالحليب الطازج',category_id:1,selling_price:25,purchase_price:9,stock:60,min_stock:10,total_sold:134,is_featured:true,image_path:'',category_name:'المشروبات الساخنة'},
    {id:5,name:'عصير برتقال',description:'برتقال طبيعي طازج',category_id:2,selling_price:18,purchase_price:6,stock:50,min_stock:8,total_sold:312,is_featured:true,image_path:'',category_name:'المشروبات الباردة'},
    {id:6,name:'موهيتو',description:'موهيتو نعناع وليمون',category_id:2,selling_price:20,purchase_price:7,stock:45,min_stock:8,total_sold:220,is_featured:true,image_path:'',category_name:'المشروبات الباردة'},
    {id:7,name:'عصير فراولة',description:'فراولة مع آيس كريم',category_id:2,selling_price:22,purchase_price:8,stock:40,min_stock:8,total_sold:187,is_featured:false,image_path:'',category_name:'المشروبات الباردة'},
    {id:8,name:'ماء معدني',description:'ماء معدني 500ml',category_id:2,selling_price:5,purchase_price:2,stock:200,min_stock:20,total_sold:450,is_featured:false,image_path:'',category_name:'المشروبات الباردة'},
    {id:9,name:'برغر كلاسيك',description:'برغر لحم مع خضروات',category_id:3,selling_price:55,purchase_price:25,stock:30,min_stock:5,total_sold:89,is_featured:true,image_path:'',category_name:'الوجبات الرئيسية'},
    {id:10,name:'دجاج مشوي',description:'دجاج مع أرز وسلطة',category_id:3,selling_price:65,purchase_price:30,stock:25,min_stock:5,total_sold:76,is_featured:true,image_path:'',category_name:'الوجبات الرئيسية'},
    {id:11,name:'بيتزا مارغريتا',description:'بيتزا جبن وطماطم',category_id:3,selling_price:75,purchase_price:35,stock:15,min_stock:3,total_sold:92,is_featured:true,image_path:'',category_name:'الوجبات الرئيسية'},
    {id:12,name:'شاورما دجاج',description:'شاورما بالصوص الخاص',category_id:4,selling_price:35,purchase_price:15,stock:40,min_stock:5,total_sold:267,is_featured:true,image_path:'',category_name:'السندويشات'},
    {id:13,name:'سندويش كلوب',description:'كلوب ثلاثي الطوابق',category_id:4,selling_price:40,purchase_price:18,stock:35,min_stock:5,total_sold:143,is_featured:false,image_path:'',category_name:'السندويشات'},
    {id:14,name:'كيك شوكولاتة',description:'كيك شوكولاتة بلجيكي',category_id:5,selling_price:30,purchase_price:12,stock:20,min_stock:3,total_sold:98,is_featured:true,image_path:'',category_name:'الحلويات'},
    {id:15,name:'تشيز كيك',description:'تشيز كيك كريمي فراولة',category_id:5,selling_price:35,purchase_price:15,stock:15,min_stock:3,total_sold:72,is_featured:false,image_path:'',category_name:'الحلويات'},
  ];
}

function renderCategories() {
  const bar = document.getElementById('categoriesBar');
  bar.innerHTML = `<button class="cat-btn active" onclick="filterCategory(0,this)">🏠 الكل</button>`;
  State.categories.forEach(c => {
    bar.innerHTML += `<button class="cat-btn" onclick="filterCategory(${c.id},this)">${c.icon} ${c.name}</button>`;
  });
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products || !products.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3)">لا توجد منتجات</div>';
    return;
  }
  const emojis = {1:'☕',2:'🧃',3:'🍽️',4:'🥪',5:'🍰'};
  grid.innerHTML = products.map(p => {
    const oos = parseInt(p.stock) <= 0;
    const emoji = emojis[p.category_id] || '📦';
    // الصورة: base64 مخزنة محلياً أو مسار أو إيموجي
    const imgSrc = p.image_base64 || p.image_path || '';
    const imgHtml = imgSrc
      ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=font-size:2.5rem>${emoji}</span>'">`
      : `<span style="font-size:2.5rem">${emoji}</span>`;
    return `
      <div class="product-card ${oos?'out-of-stock':''}" onclick="${oos?'':'addToCart('+p.id+')'}" data-id="${p.id}">
        ${p.is_featured?'<span class="featured-badge">⭐</span>':''}
        <div class="product-img">${imgHtml}</div>
        <div class="product-info">
          <div class="product-name" title="${p.name}">${p.name}</div>
          <div class="product-desc">${p.description||''}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.3rem">
            <div class="product-price">${parseFloat(p.selling_price).toFixed(2)} ${CURRENCY}</div>
            <div class="${parseInt(p.stock)<=parseInt(p.min_stock||5)?'stock-low':'stock-ok'}" style="font-size:.75rem">
              ${parseInt(p.stock)>0?'📦 '+p.stock:'❌ نفد'}
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function filterCategory(id, btn) {
  State.currentCategory = id;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts(id ? State.products.filter(p => p.category_id == id) : State.products);
}

function sortP(sort, btn) {
  State.currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  let s = [...State.products];
  if (sort==='price_asc')  s.sort((a,b) => a.selling_price - b.selling_price);
  if (sort==='price_desc') s.sort((a,b) => b.selling_price - a.selling_price);
  if (sort==='popular')    s.sort((a,b) => b.total_sold - a.total_sold);
  if (sort==='featured')   s.sort((a,b) => b.is_featured - a.is_featured);
  renderProducts(s);
}

function filterProducts() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderProducts(q ? State.products.filter(p => p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q)) : State.products);
}

function toggleGridCols() {
  const grid = document.getElementById('productsGrid');
  const icon = document.getElementById('gridIcon');
  State.gridCols = State.gridCols === 3 ? 2 : 3;
  grid.style.gridTemplateColumns = `repeat(auto-fill,minmax(${State.gridCols===2?'200px':'155px'},1fr))`;
  icon.className = State.gridCols === 2 ? 'fas fa-th-large' : 'fas fa-th';
}

// ══ السلة ════════════════════════════════════════════════
function addToCart(productId) {
  const product = State.products.find(p => p.id == productId);
  if (!product) return;
  const existing = State.cart.find(i => i.id == productId);
  if (existing) {
    if (existing.quantity >= parseInt(product.stock)) { toast('لا يمكن إضافة أكثر من المخزون','warning'); return; }
    existing.quantity++;
  } else {
    State.cart.push({
      id:product.id, name:product.name,
      selling_price:parseFloat(product.selling_price),
      purchase_price:parseFloat(product.purchase_price),
      stock:parseInt(product.stock), quantity:1, notes:'',
    });
  }
  renderCart(); saveCartToStorage(); playBeep();
  const card = document.querySelector(`[data-id="${productId}"]`);
  if (card) { card.style.transform='scale(0.95)'; setTimeout(()=>card.style.transform='',150); }
  toast(`✅ ${product.name}`,'success',1200);
}

function removeFromCart(id) { State.cart=State.cart.filter(i=>i.id!=id); renderCart(); saveCartToStorage(); }

function changeQty(id, delta) {
  const item = State.cart.find(i=>i.id==id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) { removeFromCart(id); return; }
  if (item.quantity > item.stock) { item.quantity=item.stock; toast('حد المخزون','warning'); }
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
  if (!State.cart.length) {
    c.innerHTML=`<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>السلة فارغة</p><small>اضغط على منتج لإضافته</small></div>`;
    updateTotals(); return;
  }
  c.innerHTML = State.cart.map(item => {
    const lineTotal = (parseFloat(item.selling_price)*parseInt(item.quantity)).toFixed(2);
    return `
      <div class="cart-item">
        <div style="flex:1;min-width:0">
          <div class="cart-item-name">${item.name}</div>
          <div style="font-size:.75rem;color:var(--text3)">${parseFloat(item.selling_price).toFixed(2)} ${CURRENCY}/وحدة</div>
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
  const fmt = n => parseFloat(n).toFixed(2)+' '+CURRENCY;
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
  if (paid>0&&State.payMethod==='cash') {
    const ch=paid-total; cd.style.display='block';
    ca.textContent=ch.toFixed(2); ca.style.color=ch>=0?'var(--success)':'var(--danger)';
  } else cd.style.display='none';
}

function setOrderType(type,btn) {
  State.orderType=type;
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function setPayMethod(method,btn) {
  State.payMethod=method;
  document.querySelectorAll('.pay-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('cashRow').style.display=method==='cash'?'flex':'none';
  if (method==='debt') toast('⚠️ اختر عميلاً لتسجيل الدين','warning',2500);
}

// ══ الدفع ════════════════════════════════════════════════
function checkout() {
  if (!State.cart.length) { toast('السلة فارغة!','warning'); return; }
  if (State.payMethod==='debt'&&!State.selectedCustomer) {
    toast('⚠️ اختر عميلاً لتسجيل الدين!','warning');
    showCustomerPicker(); return;
  }
  const btn=document.getElementById('checkoutBtn');
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> جاري...';

  const total    = parseFloat((document.getElementById('totalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const subtotal = parseFloat((document.getElementById('subtotalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const discAmt  = parseFloat((document.getElementById('discountVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const taxAmt   = subtotal*State.taxRate/100;
  const amtPaid  = parseFloat(document.getElementById('amountPaid').value)||total;
  const orderNum = 'ORD-'+new Date().toISOString().split('T')[0].replace(/-/g,'')+'-'+String(Date.now()).slice(-4);

  const orderData = {
    id:Date.now(), order_number:orderNum,
    customer_id:   State.selectedCustomer?.id||null,
    customer_name: State.selectedCustomer?.name||'زبون',
    customer_phone:State.selectedCustomer?.phone||'',
    order_type:    State.orderType,
    items: State.cart.map(i=>({
      id:i.id, product_name:i.name, quantity:parseInt(i.quantity),
      unit_price:parseFloat(i.selling_price), purchase_price:parseFloat(i.purchase_price),
      total_price:parseFloat(i.selling_price)*parseInt(i.quantity),
      profit:(parseFloat(i.selling_price)-parseFloat(i.purchase_price))*parseInt(i.quantity),
    })),
    subtotal, discount_amount:discAmt, tax_amount:taxAmt, total,
    payment_method: State.payMethod,
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
  localStorage.setItem('pos_orders', JSON.stringify(orders.slice(0,500)));

  // ── تسجيل الدين تلقائياً إذا كان الدفع بالدين ──
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

  // تحديث الصندوق (مبيعات نقدية وبطاقة فقط)
  if (State.payMethod !== 'debt') {
    updateCashRegister(total, 'in', 'مبيعات - طلب '+orderNum);
  }

  // إحصائيات اليوم
  const today = new Date().toDateString();
  const daily = JSON.parse(localStorage.getItem('pos_daily')||'{}');
  if (!daily[today]) daily[today]={orders:0,revenue:0,profit:0,products:{}};
  daily[today].orders++;
  daily[today].revenue+=total;
  orderData.items.forEach(i=>{daily[today].profit+=(i.profit||0);daily[today].products[i.product_name]=(daily[today].products[i.product_name]||0)+i.quantity;});
  localStorage.setItem('pos_daily', JSON.stringify(daily));

  // تحديث المخزون
  orderData.items.forEach(item=>{
    const p=State.products.find(pr=>pr.id==item.id);
    if(p){p.stock=Math.max(0,p.stock-item.quantity);p.total_sold=(p.total_sold||0)+item.quantity;}
  });
  localStorage.setItem('pos_products', JSON.stringify(State.products));

  // تحديث العميل
  if (State.selectedCustomer) {
    const custs=JSON.parse(localStorage.getItem('pos_customers')||'[]');
    const idx=custs.findIndex(c=>c.id==State.selectedCustomer.id);
    if(idx!==-1){custs[idx].total_orders=(custs[idx].total_orders||0)+1;custs[idx].total_spent=(parseFloat(custs[idx].total_spent)||0)+total;localStorage.setItem('pos_customers',JSON.stringify(custs));}
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
  },400);
}

function updateCashRegister(amount, type, note='') {
  const reg = JSON.parse(localStorage.getItem('pos_cash_register')||'{"balance":0,"initial_capital":0}');
  if (type==='in')  reg.balance += amount;
  if (type==='out') reg.balance -= amount;
  reg.last_update = new Date().toISOString();
  localStorage.setItem('pos_cash_register', JSON.stringify(reg));
}

function showSuccessModal(order) {
  const isDebt = order.payment_method==='debt';
  const div=document.createElement('div');
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999';
  div.innerHTML=`
    <div style="background:var(--bg2);border-radius:20px;padding:2rem;text-align:center;max-width:340px;width:90%;animation:slideUp .3s ease">
      <div style="font-size:4rem">${isDebt?'📝':'✅'}</div>
      <h2 style="color:${isDebt?'var(--warning)':'var(--success)'};margin:.5rem 0">تم تأكيد الطلب!</h2>
      <p style="font-weight:700;font-size:1.1rem">${order.order_number}</p>
      <p style="color:var(--text2)">المجموع: <strong>${order.total.toFixed(2)} ${CURRENCY}</strong></p>
      ${order.change_amount>0?`<p style="color:var(--success);font-weight:700;font-size:1.1rem">الباقي: ${order.change_amount.toFixed(2)} ${CURRENCY}</p>`:''}
      ${isDebt?`<div style="background:#fef3c7;border-radius:10px;padding:.8rem;margin-top:.5rem"><p style="color:#92400e;font-weight:700;font-size:.9rem">⚠️ تم تسجيل الدين باسم: ${order.customer_name}</p></div>`:''}
      <div style="display:flex;gap:.5rem;margin-top:1.2rem;justify-content:center">
        <button onclick='printBon(${JSON.stringify(order).replace(/'/g,"\\'")})' style="padding:.6rem 1rem;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-family:var(--font);font-weight:600">🖨️ طباعة البون</button>
        <button onclick="this.closest('[style*=fixed]').remove()" style="padding:.6rem 1rem;background:var(--bg3);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:var(--font)">إغلاق</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(()=>{ if(document.body.contains(div)) div.remove(); },7000);
}

// ══ الطباعة (بون - صفحة واحدة فقط مع الشعار) ═══════════
function printBon(order) {
  if (typeof order==='string') order=JSON.parse(order);
  const shopName  = State.settings.shop_name||'كافيه النخبة';
  const address   = State.settings.shop_address||'';
  const phone     = State.settings.shop_phone||'';
  const footer    = State.settings.receipt_footer||'شكراً لزيارتكم! 🌟';
  const items     = order.items||[];
  const logoB64   = State.logoBase64||State.settings.logo_base64||'';
  const logoHtml  = logoB64
    ? `<img src="${logoB64}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:2px solid #e2e8f0">`
    : `<div style="width:70px;height:70px;border-radius:50%;background:#6366f1;color:white;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 8px">☕</div>`;

  const html=`<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>بون - ${order.order_number}</title>
<style>
  @page{size:80mm auto;margin:4mm}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;color:#000;background:#fff;width:72mm}
  .center{text-align:center}.bold{font-weight:bold}.large{font-size:15px}
  .dashed{border-top:1px dashed #000;margin:5px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:2px 1px;font-size:11px;vertical-align:top}
  .tr{font-weight:bold;font-size:13px}
  .debt-warn{background:#fff3cd;border:1px solid #ffc107;padding:4px;text-align:center;font-weight:bold;margin:4px 0}
</style></head><body>
  ${logoHtml}
  <div class="center bold large">${shopName}</div>
  ${address?`<div class="center" style="font-size:10px">${address}</div>`:''}
  ${phone?`<div class="center" style="font-size:10px">${phone}</div>`:''}
  <div class="dashed"></div>
  <div>رقم: <b>${order.order_number}</b></div>
  <div>التاريخ: ${new Date(order.created_at||Date.now()).toLocaleString('ar-MA')}</div>
  <div>الكاشير: ${order.cashier_name||'كاشير'}</div>
  <div>العميل: ${order.customer_name||'زبون'}</div>
  <div>النوع: ${{dine_in:'داخل المحل',takeaway:'خارج',delivery:'توصيل'}[order.order_type]||''}</div>
  <div class="dashed"></div>
  <table>
    <tr><td class="bold" style="width:50%">الصنف</td><td class="bold" align="center" style="width:15%">ك</td><td class="bold" align="center" style="width:15%">سعر</td><td class="bold" align="right" style="width:20%">مجموع</td></tr>
    <tr><td colspan="4"><div class="dashed"></div></td></tr>
    ${items.map(i=>`<tr>
      <td>${i.product_name||i.name}</td>
      <td align="center">${i.quantity}</td>
      <td align="center">${parseFloat(i.unit_price||0).toFixed(0)}</td>
      <td align="right">${parseFloat(i.total_price||0).toFixed(2)}</td>
    </tr>`).join('')}
  </table>
  <div class="dashed"></div>
  <table>
    <tr><td>المجموع الفرعي:</td><td align="right">${parseFloat(order.subtotal||0).toFixed(2)} ${CURRENCY}</td></tr>
    ${parseFloat(order.discount_amount||0)>0?`<tr><td>الخصم:</td><td align="right">-${parseFloat(order.discount_amount).toFixed(2)} ${CURRENCY}</td></tr>`:''}
    ${parseFloat(order.tax_amount||0)>0?`<tr><td>الضريبة:</td><td align="right">${parseFloat(order.tax_amount).toFixed(2)} ${CURRENCY}</td></tr>`:''}
    <tr class="tr"><td>المجموع الإجمالي:</td><td align="right">${parseFloat(order.total||0).toFixed(2)} ${CURRENCY}</td></tr>
    <tr><td>طريقة الدفع:</td><td align="right">${{cash:'نقدي 💵',card:'بطاقة 💳',transfer:'تحويل 📱',debt:'دين 📝'}[order.payment_method]||''}</td></tr>
    ${parseFloat(order.change_amount||0)>0?`<tr><td>الباقي للعميل:</td><td align="right"><b>${parseFloat(order.change_amount).toFixed(2)} ${CURRENCY}</b></td></tr>`:''}
  </table>
  ${order.payment_method==='debt'?`<div class="debt-warn">⚠️ مسجل كدين على: ${order.customer_name}</div>`:''}
  <div class="dashed"></div>
  ${order.notes?`<div>ملاحظة: ${order.notes}</div><div class="dashed"></div>`:''}
  <div class="center bold" style="font-size:13px">${footer}</div>
</body></html>`;

  const w=window.open('','_blank','width=350,height=700,left=100,top=50');
  if (!w) { toast('يرجى السماح بالنوافذ المنبثقة','warning'); return; }
  w.document.write(html); w.document.close();
  w.onload=()=>{ w.print(); };
}

function printQuickReceipt() {
  if (!State.cart.length) { toast('السلة فارغة','warning'); return; }
  const total   = parseFloat((document.getElementById('totalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const sub     = parseFloat((document.getElementById('subtotalVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const disc    = parseFloat((document.getElementById('discountVal').textContent||'0').replace(/[^0-9.]/g,''))||0;
  const amtPaid = parseFloat(document.getElementById('amountPaid').value)||total;
  printBon({
    order_number:'DRAFT-'+Date.now(), customer_name:State.selectedCustomer?.name||'زبون',
    cashier_name:State.user?.full_name||'كاشير', created_at:new Date().toISOString(),
    order_type:State.orderType,
    items:State.cart.map(i=>({product_name:i.name,quantity:i.quantity,unit_price:i.selling_price,total_price:i.selling_price*i.quantity})),
    subtotal:sub, discount_amount:disc, tax_amount:0, total,
    payment_method:State.payMethod, change_amount:Math.max(0,amtPaid-total),
    notes:document.getElementById('orderNotes').value,
  });
}

// ══ رفع صور المنتجات والشعار (محلي - بدون Backend) ═══════
function previewProductImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.match('image.*')) { toast('اختر ملف صورة (JPG, PNG)','error'); return; }
  if (file.size > 5*1024*1024) { toast('حجم الصورة كبير جداً (أقصى 5MB)','error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('prodImagePreview');
    const placeholder = document.getElementById('prodImagePlaceholder');
    preview.src = e.target.result;
    preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    // حفظ base64 مؤقتاً
    State._tempImageBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.match('image.*')) { toast('اختر ملف صورة (JPG, PNG)','error'); return; }
  if (file.size > 3*1024*1024) { toast('حجم الصورة كبير جداً (أقصى 3MB)','error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const base64 = e.target.result;
    // حفظ الشعار
    State.logoBase64 = base64;
    State.settings.logo_base64 = base64;
    localStorage.setItem('pos_settings', JSON.stringify(State.settings));
    applyLogo(base64);
    toast('✅ تم رفع الشعار بنجاح');
  };
  reader.readAsDataURL(file);
}

// ══ الطلبات ══════════════════════════════════════════════
let _orderPeriod = 'day';
function loadOrders(period, btn) {
  if (period) {
    _orderPeriod = period;
    document.querySelectorAll('#page-orders .period-btn').forEach(b=>b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  const status = document.getElementById('statusFilter')?.value||'';
  const orders = JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const now = new Date();
  const filtered = orders.filter(o=>{
    const d=new Date(o.created_at);
    if (_orderPeriod==='day'   && d.toDateString()!==now.toDateString()) return false;
    if (_orderPeriod==='week'  && (now-d)>7*86400000) return false;
    if (_orderPeriod==='month' && (d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear())) return false;
    if (status && o.order_status!==status) return false;
    return true;
  });
  const container = document.getElementById('ordersList');
  if (!filtered.length) { container.innerHTML='<div style="text-align:center;padding:3rem;color:var(--text3)">لا توجد طلبات</div>'; return; }
  container.innerHTML = filtered.map(o=>`
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
          <option value="pending"   ${o.order_status==='pending'   ?'selected':''}>⏳ انتظار</option>
          <option value="preparing" ${o.order_status==='preparing' ?'selected':''}>👨‍🍳 يحضر</option>
          <option value="ready"     ${o.order_status==='ready'     ?'selected':''}>✅ جاهز</option>
          <option value="delivered" ${o.order_status==='delivered' ?'selected':''}>🏠 سُلِّم</option>
          <option value="cancelled" ${o.order_status==='cancelled' ?'selected':''}>❌ ملغي</option>
        </select>
        <button class="btn-secondary" onclick='printBon(${JSON.stringify(o).replace(/'/g,"\\'")})'><i class="fas fa-print"></i> بون</button>
        <button class="btn-secondary" onclick='sendOrderWhatsApp(${JSON.stringify(o).replace(/'/g,"\\'")})'><i class="fab fa-whatsapp"></i></button>
      </div>
    </div>`).join('');
}

function updateOrderStatus(id, status) {
  const orders=JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const idx=orders.findIndex(o=>o.id==id);
  if(idx!==-1){orders[idx].order_status=status;localStorage.setItem('pos_orders',JSON.stringify(orders));}
  toast('تم تحديث الحالة ✅'); updateBadges();
}

function sendOrderWhatsApp(order) {
  if(typeof order==='string')order=JSON.parse(order);
  const items=(order.items||[]).map(i=>`• ${i.product_name} x${i.quantity} = ${parseFloat(i.total_price||0).toFixed(2)} ${CURRENCY}`).join('\n');
  const msg=`*${State.settings.shop_name||'المحل'}*\n────────────\n🧾 ${order.order_number}\n👤 ${order.customer_name||'زبون'}\n────────────\n${items||'---'}\n────────────\n💰 *${parseFloat(order.total||0).toFixed(2)} ${CURRENCY}*\n🌟 شكراً لكم!`;
  window.open('https://wa.me/'+(State.settings.shop_whatsapp||WHATSAPP).replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));
}

function sendWhatsApp() {
  if(!State.cart.length){toast('السلة فارغة','warning');return;}
  const total=document.getElementById('totalVal').textContent;
  const items=State.cart.map(i=>`• ${i.name} x${i.quantity} = ${(i.selling_price*i.quantity).toFixed(2)} ${CURRENCY}`).join('\n');
  const msg=`*${State.settings.shop_name||'المحل'}*\n────────────\n${items}\n────────────\n💰 *${total}*\n🌟 شكراً لكم!`;
  window.open('https://wa.me/'+(State.settings.shop_whatsapp||WHATSAPP).replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));
}

// ══ المنتجات (إدارة) ══════════════════════════════════════
function loadProductsAdmin() {
  const products = State.products.length ? State.products : getDefaultProducts();
  const catSel = document.getElementById('prodCategory');
  if (catSel) catSel.innerHTML = State.categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  document.getElementById('productsTableBody').innerHTML = products.map(p=>{
    const profit=(parseFloat(p.selling_price)-parseFloat(p.purchase_price)).toFixed(2);
    const isLow=parseInt(p.stock)<=parseInt(p.min_stock||5);
    const imgSrc = p.image_base64||p.image_path||'';
    const thumb = imgSrc
      ? `<img src="${imgSrc}" class="prod-thumb" onerror="this.outerHTML='<div class=prod-thumb-placeholder>${{1:'☕',2:'🧃',3:'🍽️',4:'🥪',5:'🍰'}[p.category_id]||'📦'}</div>'">`
      : `<div class="prod-thumb-placeholder">${{1:'☕',2:'🧃',3:'🍽️',4:'🥪',5:'🍰'}[p.category_id]||'📦'}</div>`;
    return `<tr>
      <td>${thumb}</td>
      <td><strong>${p.name}</strong><br><small style="color:var(--text3)">${p.description||''}</small></td>
      <td>${p.category_name||'-'}</td>
      <td>${parseFloat(p.purchase_price).toFixed(2)} ${CURRENCY}</td>
      <td>${parseFloat(p.selling_price).toFixed(2)} ${CURRENCY}</td>
      <td><span class="profit-badge">+${profit}</span></td>
      <td class="${isLow?'stock-low':'stock-ok'}">${p.stock}${isLow?' ⚠️':''}</td>
      <td>${p.total_sold||0}</td>
      <td>
        <button class="btn-icon" onclick="editProduct(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>
        <button class="btn-icon danger" onclick="deleteProduct(${p.id})" title="حذف"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function openProductModal(p=null) {
  document.getElementById('productModalTitle').textContent = p?'تعديل منتج':'إضافة منتج';
  document.getElementById('prodId').value         = p?.id||'';
  document.getElementById('prodName').value       = p?.name||'';
  document.getElementById('prodDesc').value       = p?.description||'';
  document.getElementById('prodBarcode').value    = p?.barcode||'';
  document.getElementById('prodPurchase').value   = p?.purchase_price||'';
  document.getElementById('prodSelling').value    = p?.selling_price||'';
  document.getElementById('prodStock').value      = p?.stock||0;
  document.getElementById('prodMinStock').value   = p?.min_stock||5;
  document.getElementById('prodFeatured').value   = p?.is_featured?'1':'0';
  if (p?.category_id) document.getElementById('prodCategory').value = p.category_id;
  // معاينة الصورة
  const preview = document.getElementById('prodImagePreview');
  const ph = document.getElementById('prodImagePlaceholder');
  const imgSrc = p?.image_base64||p?.image_path||'';
  if (imgSrc) { preview.src=imgSrc; preview.style.display='block'; if(ph)ph.style.display='none'; }
  else { preview.style.display='none'; if(ph)ph.style.display='flex'; }
  State._tempImageBase64 = imgSrc||'';
  openModal('productModal');
}

function editProduct(id) {
  const p = State.products.find(p=>p.id==id)||getDefaultProducts().find(p=>p.id==id);
  if (p) openProductModal(p);
}

function saveProduct() {
  if (!document.getElementById('prodName').value) { toast('أدخل اسم المنتج','warning'); return; }
  const id = document.getElementById('prodId').value;
  const catId = parseInt(document.getElementById('prodCategory').value);
  const data = {
    name:           document.getElementById('prodName').value,
    description:    document.getElementById('prodDesc').value,
    barcode:        document.getElementById('prodBarcode').value,
    category_id:    catId,
    purchase_price: parseFloat(document.getElementById('prodPurchase').value)||0,
    selling_price:  parseFloat(document.getElementById('prodSelling').value)||0,
    stock:          parseInt(document.getElementById('prodStock').value)||0,
    min_stock:      parseInt(document.getElementById('prodMinStock').value)||5,
    is_featured:    document.getElementById('prodFeatured').value==='1',
    category_name:  State.categories.find(c=>c.id==catId)?.name||'',
    image_base64:   State._tempImageBase64||'',
    image_path:     '',
  };
  const products = getDefaultProducts();
  if (id) {
    const idx=products.findIndex(p=>p.id==id);
    if(idx!==-1) products[idx]={...products[idx],...data};
  } else {
    data.id=Date.now(); data.total_sold=0;
    products.push(data); State.products.push(data);
  }
  localStorage.setItem('pos_products', JSON.stringify(products));
  State.products = products;
  State._tempImageBase64 = '';
  closeModal('productModal'); loadProductsAdmin();
  toast(id?'تم التحديث ✅':'تم إضافة المنتج ✅');
}

function deleteProduct(id) {
  if(!confirm('حذف هذا المنتج؟'))return;
  State.products=State.products.filter(p=>p.id!=id);
  localStorage.setItem('pos_products',JSON.stringify(State.products));
  loadProductsAdmin(); toast('تم الحذف','info');
}

// ══ العملاء ══════════════════════════════════════════════
function loadCustomers(q='') {
  let customers = JSON.parse(localStorage.getItem('pos_customers')||'[]');
  if (!customers.length) {
    customers=[
      {id:1,name:'أحمد محمد',phone:'0612345678',city:'الدار البيضاء',total_orders:5,total_spent:450},
      {id:2,name:'فاطمة الزهراء',phone:'0698765432',city:'الرباط',total_orders:3,total_spent:285},
      {id:3,name:'محمد العمراني',phone:'0654321098',city:'مراكش',total_orders:8,total_spent:720},
    ];
    localStorage.setItem('pos_customers',JSON.stringify(customers));
  }
  State.customers=customers;
  const list = q ? customers.filter(c=>c.name.includes(q)||(c.phone||'').includes(q)) : customers;
  const debts = JSON.parse(localStorage.getItem('pos_debts')||'[]');
  const c = document.getElementById('customersList');
  if (!list.length) { c.innerHTML='<div style="text-align:center;padding:2rem;color:var(--text3)">لا يوجد عملاء</div>'; return; }
  c.innerHTML = list.map(cu=>{
    const cd=debts.filter(d=>d.customer_id==cu.id&&d.status!=='paid');
    const dt=cd.reduce((s,d)=>s+parseFloat(d.remaining_amount||0),0);
    return `<div class="customer-card">
      <div class="customer-avatar">${cu.name.charAt(0)}</div>
      <div class="customer-name">${cu.name}</div>
      <div class="customer-phone"><i class="fas fa-phone"></i> ${cu.phone||'-'}</div>
      <div style="font-size:.8rem;color:var(--text3)">${cu.city||''}</div>
      ${dt>0?`<div style="color:var(--danger);font-size:.82rem;font-weight:700;margin:.3rem 0">⚠️ دين: ${dt.toFixed(2)} ${CURRENCY}</div>`:''}
      <div class="customer-stats">
        <div><div class="customer-stat-val">${cu.total_orders||0}</div><div class="customer-stat-label">طلب</div></div>
        <div><div class="customer-stat-val">${parseFloat(cu.total_spent||0).toFixed(0)}</div><div class="customer-stat-label">${CURRENCY}</div></div>
      </div>
      ${cu.phone?`<div style="margin-top:.6rem"><button class="btn-secondary" style="padding:.3rem .7rem;font-size:.8rem;width:100%" onclick="window.open('https://wa.me/${(cu.phone||'').replace(/[^0-9]/g,'')}')"><i class='fab fa-whatsapp'></i> واتساب</button></div>`:''}
    </div>`;
  }).join('');
}

function searchCustomers(q){loadCustomers(q);}
function openCustomerModal(){openModal('customerModal');}
function saveCustomer() {
  const data={id:Date.now(),name:document.getElementById('custName').value.trim(),phone:document.getElementById('custPhone').value.trim(),city:document.getElementById('custCity').value.trim(),notes:document.getElementById('custNotes').value.trim(),total_orders:0,total_spent:0,created_at:new Date().toISOString()};
  if(!data.name){toast('أدخل اسم العميل','warning');return;}
  const customers=JSON.parse(localStorage.getItem('pos_customers')||'[]');
  customers.push(data);localStorage.setItem('pos_customers',JSON.stringify(customers));State.customers=customers;
  closeModal('customerModal');loadCustomers();toast('تم إضافة العميل ✅');
  ['custName','custPhone','custCity','custNotes'].forEach(id=>document.getElementById(id).value='');
}
function showCustomerPicker(){if(!State.customers.length)loadCustomers();renderCustomerPicker('');openModal('customerPickerModal');}
function renderCustomerPicker(q){
  const list=State.customers.filter(c=>!q||c.name.includes(q)||(c.phone||'').includes(q));
  document.getElementById('customerPickerList').innerHTML=list.map(c=>`<div class="picker-item" onclick="selectCustomer(${c.id})"><div><div style="font-weight:700">${c.name}</div><div style="font-size:.8rem;opacity:.7">${c.phone||''} ${c.city?'• '+c.city:''}</div></div></div>`).join('')||'<div style="text-align:center;color:var(--text3);padding:1rem">لا يوجد عملاء</div>';
}
function searchCustomerPicker(q){renderCustomerPicker(q);}
function selectCustomer(id){
  State.selectedCustomer=State.customers.find(c=>c.id==id);
  if(State.selectedCustomer){document.getElementById('cartCustomer').style.display='flex';document.getElementById('cartCustomerName').textContent=State.selectedCustomer.name;}
  closeModal('customerPickerModal');
}
function removeCartCustomer(){State.selectedCustomer=null;document.getElementById('cartCustomer').style.display='none';}
function quickAddCustomer(){closeModal('customerPickerModal');openModal('customerModal');}

// ══ الديون ═══════════════════════════════════════════════
function loadDebts(status='',btn) {
  if(btn){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  let debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  if(status)debts=debts.filter(d=>d.status===status);
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
        الأصلي: ${parseFloat(d.original_amount||0).toFixed(2)} | مدفوع: <b style="color:var(--success)">${parseFloat(d.paid_amount||0).toFixed(2)}</b> ${CURRENCY}
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
function saveDebt(){
  const data={id:Date.now(),customer_name:document.getElementById('debtCustomer').value.trim(),customer_phone:document.getElementById('debtPhone').value.trim(),original_amount:parseFloat(document.getElementById('debtAmount').value)||0,paid_amount:0,remaining_amount:parseFloat(document.getElementById('debtAmount').value)||0,due_date:document.getElementById('debtDue').value,notes:document.getElementById('debtNotes').value,status:'pending',created_at:new Date().toISOString()};
  if(!data.customer_name||!data.original_amount){toast('أدخل الاسم والمبلغ','warning');return;}
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  debts.unshift(data);localStorage.setItem('pos_debts',JSON.stringify(debts));
  closeModal('debtModal');loadDebts();toast('تم تسجيل الدين ✅');
  ['debtCustomer','debtPhone','debtAmount','debtDue','debtNotes'].forEach(id=>document.getElementById(id).value='');
}
function openPayDebt(id,remaining){
  State.currentDebtId=id;
  document.getElementById('debtRemaining').textContent=parseFloat(remaining).toFixed(2);
  document.getElementById('payDebtAmount').value=parseFloat(remaining).toFixed(2);
  openModal('payDebtModal');
}
function confirmPayDebt(){
  const amount=parseFloat(document.getElementById('payDebtAmount').value)||0;
  if(!amount){toast('أدخل المبلغ','warning');return;}
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  const idx=debts.findIndex(d=>d.id==State.currentDebtId);
  if(idx!==-1){
    debts[idx].paid_amount=(parseFloat(debts[idx].paid_amount)||0)+amount;
    debts[idx].remaining_amount=Math.max(0,parseFloat(debts[idx].original_amount)-debts[idx].paid_amount);
    debts[idx].status=debts[idx].remaining_amount<=0?'paid':'partial';
    localStorage.setItem('pos_debts',JSON.stringify(debts));
    // تحديث الصندوق بالمبلغ المدفوع من الدين
    updateCashRegister(amount,'in','تسديد دين - '+debts[idx].customer_name);
  }
  closeModal('payDebtModal');loadDebts();playBeep();toast('✅ تم تسجيل الدفع');
}
function remindDebt(phone,name,amount){
  const msg=`مرحباً ${name}،\nنذكركم بدين بمبلغ *${parseFloat(amount).toFixed(2)} ${CURRENCY}*\nيرجى التسديد في أقرب وقت.\n${State.settings.shop_name||'المحل'} 🌟`;
  window.open('https://wa.me/'+phone.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));
}

// ══ الصندوق ══════════════════════════════════════════════
function loadCash(type='',btn) {
  if(btn){document.querySelectorAll('.debt-filter .filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const reg = JSON.parse(localStorage.getItem('pos_cash_register')||'{"balance":0,"initial_capital":0}');
  const orders = JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const totalSales = orders.filter(o=>o.payment_method!=='debt'&&o.payment_status!=='unpaid').reduce((s,o)=>s+parseFloat(o.total||0),0);
  const expenses = JSON.parse(localStorage.getItem('pos_expenses')||'[]');
  const totalOut = expenses.filter(e=>e.type==='out').reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const totalIn  = expenses.filter(e=>e.type==='in').reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const debtsPaid= JSON.parse(localStorage.getItem('pos_debts')||'[]').filter(d=>d.status!=='pending').reduce((s,d)=>s+parseFloat(d.paid_amount||0),0);

  document.getElementById('cashDashboard').innerHTML=`
    <div class="stats-grid" style="margin-bottom:0">
      <div class="stat-card teal">
        <div class="stat-icon">🏦</div>
        <div class="stat-value">${parseFloat(reg.initial_capital||0).toFixed(2)} ${CURRENCY}</div>
        <div class="stat-label">رأس المال الأولي</div>
        <button onclick="setCapital()" style="margin-top:.5rem;padding:.3rem .8rem;background:white;color:var(--primary);border:none;border-radius:8px;cursor:pointer;font-size:.8rem;font-family:var(--font)">تعديل</button>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">💰</div>
        <div class="stat-value">${totalSales.toFixed(2)} ${CURRENCY}</div>
        <div class="stat-label">إجمالي المبيعات</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">💳</div>
        <div class="stat-value">${debtsPaid.toFixed(2)} ${CURRENCY}</div>
        <div class="stat-label">ديون مسددة</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">💸</div>
        <div class="stat-value">${totalOut.toFixed(2)} ${CURRENCY}</div>
        <div class="stat-label">إجمالي المصاريف</div>
      </div>
      <div class="stat-card ${reg.balance>=0?'purple':'red'}" style="grid-column:1/-1">
        <div class="stat-icon">${reg.balance>=0?'💎':'⚠️'}</div>
        <div class="stat-value" style="font-size:2rem">${parseFloat(reg.balance||0).toFixed(2)} ${CURRENCY}</div>
        <div class="stat-label">الرصيد الحالي في الصندوق</div>
      </div>
    </div>`;

  let list = expenses;
  if (type) list = expenses.filter(e=>e.type===type);
  const catIcons={'إيجار':'🏠','مشتريات مواد':'🛒','رواتب':'👤','كهرباء وماء':'💡','صيانة':'🔧','توصيل':'🛵','أخرى':'📝'};
  document.getElementById('cashList').innerHTML = list.map(e=>`
    <div class="cash-item ${e.type}">
      <div class="cash-item-icon">${catIcons[e.category]||'📝'}</div>
      <div class="cash-item-info">
        <div class="cash-item-title">${e.title}</div>
        <div class="cash-item-cat">${e.category||''} ${e.type==='in'?'↑ إيداع':'↓ مصروف'}</div>
        <div class="cash-item-date">${e.expense_date||''}</div>
      </div>
      <div>
        <div class="cash-item-amount">${e.type==='in'?'+':'-'}${parseFloat(e.amount||0).toFixed(2)} ${CURRENCY}</div>
        <button onclick="deleteExpense(${e.id})" style="background:none;border:none;color:var(--danger);cursor:pointer;margin-top:.2rem"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('')||'<div style="text-align:center;padding:2rem;color:var(--text3)">لا توجد حركات</div>';
}

function setCapital(){
  const reg=JSON.parse(localStorage.getItem('pos_cash_register')||'{"balance":0,"initial_capital":0}');
  const v=prompt('أدخل رأس المال الأولي (DH):',reg.initial_capital||0);
  if(v!==null&&!isNaN(parseFloat(v))){
    reg.initial_capital=parseFloat(v);
    reg.balance=parseFloat(v);
    localStorage.setItem('pos_cash_register',JSON.stringify(reg));
    loadCash();toast('تم تعيين رأس المال ✅');
  }
}

function openExpenseModal(type='out'){
  document.getElementById('expenseType').value=type;
  document.getElementById('expenseModalTitle').textContent=type==='out'?'إضافة مصروف':'إيداع في الصندوق';
  document.getElementById('expenseSubmitBtn').textContent=type==='out'?'💾 تسجيل المصروف':'💾 تسجيل الإيداع';
  document.getElementById('expDate').value=new Date().toISOString().split('T')[0];
  openModal('expenseModal');
}
function saveExpense(){
  const type=document.getElementById('expenseType').value;
  const amount=parseFloat(document.getElementById('expAmount').value)||0;
  if(!document.getElementById('expTitle').value||!amount){toast('أدخل البيان والمبلغ','warning');return;}
  const data={id:Date.now(),title:document.getElementById('expTitle').value,amount,type,category:document.getElementById('expCategory').value,description:document.getElementById('expDesc').value,expense_date:document.getElementById('expDate').value,created_at:new Date().toISOString()};
  const expenses=JSON.parse(localStorage.getItem('pos_expenses')||'[]');
  expenses.unshift(data);localStorage.setItem('pos_expenses',JSON.stringify(expenses));
  // تحديث الصندوق
  updateCashRegister(amount,type,data.title);
  closeModal('expenseModal');loadCash();
  toast(type==='out'?'تم تسجيل المصروف ✅':'تم تسجيل الإيداع ✅');
  ['expTitle','expAmount','expDesc'].forEach(id=>document.getElementById(id).value='');
}
function deleteExpense(id){
  if(!confirm('حذف هذه العملية؟'))return;
  const expenses=JSON.parse(localStorage.getItem('pos_expenses')||'[]');
  const exp=expenses.find(e=>e.id==id);
  if(exp){
    // إرجاع المبلغ للصندوق عند الحذف
    updateCashRegister(exp.amount,exp.type==='out'?'in':'out','حذف: '+exp.title);
  }
  localStorage.setItem('pos_expenses',JSON.stringify(expenses.filter(e=>e.id!=id)));
  loadCash();toast('تم الحذف','info');
}

// ══ التقارير ═════════════════════════════════════════════
function loadReports(period,btn) {
  if(btn){document.querySelectorAll('#page-reports .period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const stats=getLocalStats(period);
  renderStatsGrid(stats);
  renderCharts(stats);
  renderWeakDays(stats.weakDays);
  renderMonthlyAnalysis(stats.monthly);
  renderLowStock(stats.lowStock);
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
  let profit=0; const pc={};
  filtered.forEach(o=>(o.items||[]).forEach(i=>{profit+=(i.profit||0);pc[i.product_name||i.name]=(pc[i.product_name||i.name]||0)+i.quantity;}));
  const topProducts=Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,qty])=>({product_name:name,qty}));
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  const products=State.products.length?State.products:getDefaultProducts();
  const lowStock=products.filter(p=>parseInt(p.stock)<=parseInt(p.min_stock||5));

  // بيانات 30 يوم
  const weekly=[];
  for(let i=29;i>=0;i--){
    const d=new Date(now-i*86400000);
    const dO=orders.filter(o=>new Date(o.created_at).toDateString()===d.toDateString()&&o.order_status!=='cancelled');
    weekly.push({order_date:d.toLocaleDateString('ar-MA',{day:'numeric',month:'short'}),revenue:dO.reduce((s,o)=>s+parseFloat(o.total||0),0),count:dO.length});
  }

  // الأيام الضعيفة (أقل مبيعات)
  const dayMap={};
  orders.filter(o=>o.order_status!=='cancelled').forEach(o=>{
    const d=o.order_date||new Date(o.created_at).toISOString().split('T')[0];
    if(!dayMap[d])dayMap[d]={date:d,revenue:0,orders:0};
    dayMap[d].revenue+=parseFloat(o.total||0);
    dayMap[d].orders++;
  });
  const weakDays=Object.values(dayMap).sort((a,b)=>a.revenue-b.revenue).slice(0,7);

  // تحليل شهري
  const monthMap={};
  orders.filter(o=>o.order_status!=='cancelled').forEach(o=>{
    const d=new Date(o.created_at);
    const k=d.toLocaleDateString('ar-MA',{month:'long',year:'numeric'});
    if(!monthMap[k])monthMap[k]={month:k,revenue:0,orders:0,profit:0};
    monthMap[k].revenue+=parseFloat(o.total||0);
    monthMap[k].orders++;
    (o.items||[]).forEach(i=>monthMap[k].profit+=(i.profit||0));
  });
  const monthly=Object.values(monthMap).reverse().slice(0,12);

  const reg=JSON.parse(localStorage.getItem('pos_cash_register')||'{"balance":0}');
  return{orders:filtered.length,revenue,profit,debts:debts.filter(d=>d.status!=='paid').reduce((s,d)=>s+parseFloat(d.remaining_amount||0),0),debtsCount:debts.filter(d=>d.status!=='paid').length,topProducts,weekly,weakDays,monthly,lowStock,cashBalance:reg.balance};
}

function renderStatsGrid(stats){
  document.getElementById('statsGrid').innerHTML=`
    <div class="stat-card blue"><div class="stat-icon">📦</div><div class="stat-value">${stats.orders}</div><div class="stat-label">عدد الطلبات</div></div>
    <div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-value">${parseFloat(stats.revenue).toFixed(2)}</div><div class="stat-label">المبيعات (${CURRENCY})</div></div>
    <div class="stat-card purple"><div class="stat-icon">📈</div><div class="stat-value">${parseFloat(stats.profit).toFixed(2)}</div><div class="stat-label">الربح (${CURRENCY})</div></div>
    <div class="stat-card red"><div class="stat-icon">💳</div><div class="stat-value">${parseFloat(stats.debts).toFixed(2)}</div><div class="stat-label">الديون (${CURRENCY})</div></div>
    <div class="stat-card orange"><div class="stat-icon">🏆</div><div class="stat-value" style="font-size:.95rem">${stats.topProducts?.[0]?.product_name||'-'}</div><div class="stat-label">أكثر مبيعاً</div></div>
    <div class="stat-card teal"><div class="stat-icon">💎</div><div class="stat-value">${parseFloat(stats.cashBalance||0).toFixed(2)}</div><div class="stat-label">رصيد الصندوق (${CURRENCY})</div></div>`;
}

function renderCharts(stats){
  const w=stats.weekly||[];
  if(State.chartSales)State.chartSales.destroy();
  State.chartSales=new Chart(document.getElementById('salesChart').getContext('2d'),{
    type:'line',
    data:{labels:w.map(d=>d.order_date),datasets:[{label:'المبيعات',data:w.map(d=>d.revenue),borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.12)',tension:.4,fill:true,pointRadius:2}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
  });
  const top=stats.topProducts||[];
  if(State.chartTop)State.chartTop.destroy();
  State.chartTop=new Chart(document.getElementById('topChart').getContext('2d'),{
    type:'bar',
    data:{labels:top.map(p=>p.product_name),datasets:[{data:top.map(p=>p.qty),backgroundColor:['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6'],borderRadius:6}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
  });
}

function renderWeakDays(weakDays){
  const s=document.getElementById('weakDaysSection');
  if(!weakDays||!weakDays.length){s.innerHTML='';return;}
  const max=weakDays.reduce((m,d)=>Math.max(m,d.revenue),0)||1;
  s.innerHTML=`
    <div class="weak-section">
      <h3>📉 الأيام الأضعف مبيعات (فرصة للتحسين)</h3>
      ${weakDays.map((d,i)=>`
        <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.6rem">
          <span style="width:20px;font-weight:700;color:var(--text3)">${i+1}</span>
          <span style="min-width:100px;font-size:.85rem">${d.date}</span>
          <div style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">
            <div style="height:100%;background:${d.revenue<max*0.3?'var(--danger)':d.revenue<max*0.6?'var(--warning)':'var(--info)'};width:${(d.revenue/max*100).toFixed(0)}%;transition:width .5s"></div>
          </div>
          <span style="min-width:90px;text-align:left;font-weight:700;font-size:.85rem">${d.revenue.toFixed(2)} ${CURRENCY}</span>
          <span style="color:var(--text3);font-size:.8rem">${d.orders} طلب</span>
        </div>`).join('')}
    </div>`;
}

function renderMonthlyAnalysis(monthly){
  const s=document.getElementById('monthlySection');
  if(!monthly||!monthly.length){s.innerHTML='';return;}
  const maxR=monthly.reduce((m,d)=>Math.max(m,d.revenue),0)||1;
  s.innerHTML=`
    <div class="monthly-section">
      <h3>📅 تحليل الأشهر</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead><tr style="background:var(--primary);color:white">
            <th style="padding:.6rem;text-align:right">الشهر</th>
            <th style="padding:.6rem;text-align:center">الطلبات</th>
            <th style="padding:.6rem;text-align:center">المبيعات</th>
            <th style="padding:.6rem;text-align:center">الربح</th>
            <th style="padding:.6rem;text-align:center">متوسط الطلب</th>
            <th style="padding:.6rem;text-align:center">الأداء</th>
          </tr></thead>
          <tbody>
          ${monthly.map(m=>{
            const avg=m.orders?m.revenue/m.orders:0;
            const perf=m.revenue/maxR;
            const perfIcon=perf>0.8?'🔥':perf>0.5?'✅':perf>0.3?'⚠️':'📉';
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:.6rem;font-weight:700">${m.month}</td>
              <td style="padding:.6rem;text-align:center">${m.orders}</td>
              <td style="padding:.6rem;text-align:center;font-weight:700;color:var(--success)">${m.revenue.toFixed(2)} ${CURRENCY}</td>
              <td style="padding:.6rem;text-align:center;color:var(--primary)">${m.profit.toFixed(2)} ${CURRENCY}</td>
              <td style="padding:.6rem;text-align:center">${avg.toFixed(2)} ${CURRENCY}</td>
              <td style="padding:.6rem;text-align:center;font-size:1.2rem">${perfIcon}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderLowStock(items){
  const s=document.getElementById('lowStockSection');
  if(!items||!items.length){s.innerHTML='';return;}
  s.innerHTML=`<div class="low-stock-section"><h3>⚠️ مخزون منخفض (${items.length} منتج)</h3>${items.map(p=>`<div class="low-stock-item"><span>${p.name}</span><span class="stock-low">متبقي: ${p.stock} / الحد: ${p.min_stock||5}</span></div>`).join('')}</div>`;
}

// ══ الفاتورة الشهرية الاحترافية ═════════════════════════
function printMonthlyInvoice() {
  const orders=JSON.parse(localStorage.getItem('pos_orders')||'[]');
  const expenses=JSON.parse(localStorage.getItem('pos_expenses')||'[]');
  const now=new Date();
  const mnOrders=orders.filter(o=>{const d=new Date(o.created_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&o.order_status!=='cancelled';});
  const mnExp=expenses.filter(e=>{const d=new Date(e.created_at||e.expense_date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const totalRev=mnOrders.reduce((s,o)=>s+parseFloat(o.total||0),0);
  const totalProf=mnOrders.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>ss+(i.profit||0),0),0);
  const totalOut=mnExp.filter(e=>e.type==='out').reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const totalIn=mnExp.filter(e=>e.type==='in').reduce((s,e)=>s+parseFloat(e.amount||0),0);
  const reg=JSON.parse(localStorage.getItem('pos_cash_register')||'{"balance":0,"initial_capital":0}');
  const netProfit=totalProf-totalOut;
  const shopName=State.settings.shop_name||'كافيه النخبة';
  const monthName=now.toLocaleString('ar-MA',{month:'long',year:'numeric'});
  const logoB64=State.logoBase64||State.settings.logo_base64||'';

  const pc={};mnOrders.forEach(o=>(o.items||[]).forEach(i=>{const k=i.product_name||i.name;if(!pc[k])pc[k]={qty:0,rev:0};pc[k].qty+=i.quantity;pc[k].rev+=parseFloat(i.total_price||0);}));
  const topProds=Object.entries(pc).sort((a,b)=>b[1].qty-a[1].qty);
  const byDay={};mnOrders.forEach(o=>{const d=o.order_date||new Date(o.created_at).toISOString().split('T')[0];if(!byDay[d])byDay[d]={orders:0,revenue:0};byDay[d].orders++;byDay[d].revenue+=parseFloat(o.total||0);});

  const logoHtml=logoB64
    ?`<img src="${logoB64}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.4);display:block;margin:0 auto 12px">`
    :`<div style="width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:3rem;margin:0 auto 12px">☕</div>`;

  const html=`<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>فاتورة شهرية - ${monthName}</title>
<style>
  @page{margin:12mm;size:A4}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px}
  .header{background:linear-gradient(135deg,#1e1b4b,#4f46e5);color:white;padding:28px;border-radius:14px;margin-bottom:22px;text-align:center}
  .header h1{font-size:26px;margin-bottom:4px}
  .header p{opacity:.85;font-size:13px}
  .month-badge{font-size:17px;font-weight:700;margin-top:10px;background:rgba(255,255,255,.2);padding:6px 20px;border-radius:20px;display:inline-block}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
  .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
  .card{border-radius:12px;padding:15px;text-align:center;color:white}
  .blue{background:linear-gradient(135deg,#3b82f6,#1d4ed8)}
  .green{background:linear-gradient(135deg,#10b981,#059669)}
  .purple{background:linear-gradient(135deg,#8b5cf6,#6d28d9)}
  .red{background:linear-gradient(135deg,#ef4444,#dc2626)}
  .gold{background:linear-gradient(135deg,#f59e0b,#d97706)}
  .teal{background:linear-gradient(135deg,#14b8a6,#0f766e)}
  .card .val{font-size:19px;font-weight:900;margin:6px 0}
  .card .lbl{font-size:11px;opacity:.9}
  .net{border-radius:12px;padding:18px;text-align:center;margin-bottom:18px;background:${netProfit>=0?'linear-gradient(135deg,#d1fae5,#a7f3d0)':'linear-gradient(135deg,#fee2e2,#fca5a5)'}}
  .net .val{font-size:28px;font-weight:900;color:${netProfit>=0?'#065f46':'#991b1b'}}
  section{margin-bottom:20px}
  section h2{font-size:14px;font-weight:700;padding:8px 13px;background:#f1f5f9;border-right:4px solid #6366f1;border-radius:6px;margin-bottom:10px;color:#1e293b}
  table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.07)}
  thead tr{background:#6366f1;color:white}
  th{padding:9px 10px;text-align:right;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{text-align:center;padding:14px;border-top:1px dashed #e2e8f0;color:#64748b;font-size:11px;margin-top:14px}
</style></head><body>
<div class="header">
  ${logoHtml}
  <h1>${shopName}</h1>
  <p>${State.settings.shop_address||''} ${State.settings.shop_phone?'| '+State.settings.shop_phone:''}</p>
  <div class="month-badge">📅 الفاتورة الشهرية — ${monthName}</div>
</div>

<div class="g4">
  <div class="card blue"><div class="lbl">عدد الطلبات</div><div class="val">${mnOrders.length}</div></div>
  <div class="card green"><div class="lbl">إجمالي المبيعات</div><div class="val">${totalRev.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card purple"><div class="lbl">الربح الإجمالي</div><div class="val">${totalProf.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card red"><div class="lbl">إجمالي المصاريف</div><div class="val">${totalOut.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
</div>
<div class="g3">
  <div class="card gold"><div class="lbl">رأس المال</div><div class="val">${parseFloat(reg.initial_capital||0).toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card teal"><div class="lbl">إيداعات</div><div class="val">${totalIn.toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
  <div class="card ${reg.balance>=0?'green':'red'}"><div class="lbl">رصيد الصندوق</div><div class="val">${parseFloat(reg.balance||0).toFixed(2)}</div><div class="lbl">${CURRENCY}</div></div>
</div>
<div class="net">
  <p style="color:#374151;font-size:14px;margin-bottom:6px">صافي الربح الفعلي (بعد المصاريف)</p>
  <div class="val">${netProfit>=0?'+':''}${netProfit.toFixed(2)} ${CURRENCY}</div>
  <p style="color:#374151;margin-top:6px;font-size:13px">${netProfit>=0?'📈 المحل في ربح الحمد لله ✅':'📉 المحل في خسارة هذا الشهر ⚠️'}</p>
</div>

<section>
  <h2>🏆 أفضل المنتجات مبيعاً</h2>
  <table>
    <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيراد</th><th></th></tr></thead>
    <tbody>${topProds.slice(0,10).map(([name,s],i)=>`<tr>
      <td><b>${i+1}</b></td><td>${name}</td>
      <td>${s.qty} وحدة</td>
      <td><b>${s.rev.toFixed(2)} ${CURRENCY}</b></td>
      <td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':'⭐'}</td>
    </tr>`).join('')}</tbody>
  </table>
</section>

<section>
  <h2>📅 المبيعات اليومية</h2>
  <table>
    <thead><tr><th>التاريخ</th><th>الطلبات</th><th>الإيراد</th><th>المتوسط/طلب</th></tr></thead>
    <tbody>
      ${Object.entries(byDay).sort().map(([date,d])=>`<tr>
        <td>${date}</td><td>${d.orders}</td>
        <td>${d.revenue.toFixed(2)} ${CURRENCY}</td>
        <td>${(d.revenue/d.orders).toFixed(2)} ${CURRENCY}</td>
      </tr>`).join('')}
      <tr style="background:#e0e7ff;font-weight:700">
        <td>الإجمالي</td><td>${mnOrders.length}</td>
        <td>${totalRev.toFixed(2)} ${CURRENCY}</td>
        <td>${mnOrders.length?(totalRev/mnOrders.length).toFixed(2):0} ${CURRENCY}</td>
      </tr>
    </tbody>
  </table>
</section>

${mnExp.length?`<section>
  <h2>💸 تفاصيل الحركات المالية</h2>
  <table>
    <thead><tr><th>البيان</th><th>النوع</th><th>الفئة</th><th>التاريخ</th><th>المبلغ</th></tr></thead>
    <tbody>${mnExp.map(e=>`<tr>
      <td>${e.title}</td>
      <td style="color:${e.type==='out'?'#ef4444':'#10b981'};font-weight:700">${e.type==='out'?'↓ مصروف':'↑ إيداع'}</td>
      <td>${e.category||'عام'}</td>
      <td>${e.expense_date||''}</td>
      <td style="color:${e.type==='out'?'#ef4444':'#10b981'};font-weight:700">${e.type==='out'?'-':'+'}${parseFloat(e.amount).toFixed(2)} ${CURRENCY}</td>
    </tr>`).join('')}
    <tr style="background:#fee2e2;font-weight:700">
      <td colspan="4">إجمالي المصاريف</td><td style="color:#ef4444">-${totalOut.toFixed(2)} ${CURRENCY}</td>
    </tr></tbody>
  </table>
</section>`:''}

<div class="footer">
  <p>تم إنشاؤه بتاريخ: ${new Date().toLocaleString('ar-MA')} | ${shopName} © ${now.getFullYear()}</p>
</div>
</body></html>`;

  const w=window.open('','_blank','width=950,height=750');
  if(!w){toast('يرجى السماح بالنوافذ المنبثقة','warning');return;}
  w.document.write(html);w.document.close();w.onload=()=>w.print();
}

// ══ الإدارة ══════════════════════════════════════════════
function loadAdmin() {
  loadSettingsFromStorage();
  renderSettingsForm();
  loadUsersList();
  // عرض الشعار الحالي
  const logo=State.logoBase64||State.settings.logo_base64||'';
  if(logo){
    const el=document.getElementById('currentLogo');
    if(el){el.src=logo;el.style.display='block';}
    const ph=document.getElementById('logoPlaceholder');
    if(ph)ph.style.display='none';
  }
}

function renderSettingsForm(){
  const s=State.settings;
  document.getElementById('settingsForm').innerHTML=`
    <div class="form-group"><label>اسم المحل</label><input type="text" id="set_shop_name" value="${s.shop_name||''}"></div>
    <div class="form-group"><label>العنوان</label><input type="text" id="set_shop_address" value="${s.shop_address||''}"></div>
    <div class="form-group"><label>الهاتف</label><input type="text" id="set_shop_phone" value="${s.shop_phone||''}"></div>
    <div class="form-group"><label>WhatsApp</label><input type="text" id="set_shop_whatsapp" value="${s.shop_whatsapp||WHATSAPP}"></div>
    <div class="form-group"><label>نسبة الضريبة %</label><input type="number" id="set_tax_rate" value="${s.tax_rate||0}" min="0" max="100"></div>
    <div class="form-group"><label>كلمة سر اللوحة السرية</label><input type="password" id="set_secret_password" value="${s.secret_password||'secret2024'}"></div>
    <div class="form-group"><label>نص أسفل الفاتورة</label><input type="text" id="set_receipt_footer" value="${s.receipt_footer||'شكراً لزيارتكم! 🌟'}"></div>`;
}

function saveSettings(){
  const keys=['shop_name','shop_address','shop_phone','shop_whatsapp','tax_rate','secret_password','receipt_footer'];
  keys.forEach(k=>{const el=document.getElementById('set_'+k);if(el)State.settings[k]=el.value;});
  localStorage.setItem('pos_settings',JSON.stringify(State.settings));
  State.taxRate=parseFloat(State.settings.tax_rate||0);
  const sn=document.getElementById('shopName');
  if(sn&&State.settings.shop_name)sn.textContent=State.settings.shop_name;
  const ln=document.getElementById('loginShopName');
  if(ln&&State.settings.shop_name)ln.textContent=State.settings.shop_name;
  toast('تم حفظ الإعدادات ✅');
}

function loadUsersList(){
  const defaultUsers=[{username:'admin',full_name:'المدير العام',role:'admin'},{username:'worker',full_name:'موظف الكاشير',role:'worker'}];
  const custom=JSON.parse(localStorage.getItem('pos_users')||'[]');
  const all=[...defaultUsers,...custom];
  document.getElementById('usersList').innerHTML=all.map(u=>`
    <div class="picker-item" style="margin-bottom:.4rem">
      <i class="fas ${u.role==='admin'?'fa-user-shield':'fa-user'}" style="color:${u.role==='admin'?'var(--primary)':'var(--success)'}"></i>
      <div><div style="font-weight:700">${u.full_name}</div><div style="font-size:.8rem;opacity:.7">${u.username} • ${u.role==='admin'?'مدير':'موظف'}</div></div>
    </div>`).join('');
}

function openUserModal(){openModal('userModal');}
function saveUser(){
  const data={username:document.getElementById('newUsername').value.trim(),full_name:document.getElementById('newFullName').value.trim(),password:document.getElementById('newPassword').value,role:document.getElementById('newRole').value};
  if(!data.username||!data.full_name||!data.password){toast('أكمل جميع الحقول','warning');return;}
  const users=JSON.parse(localStorage.getItem('pos_users')||'[]');
  users.push(data);localStorage.setItem('pos_users',JSON.stringify(users));
  closeModal('userModal');loadUsersList();toast('تم إضافة المستخدم ✅');
  ['newUsername','newFullName','newPassword'].forEach(id=>document.getElementById(id).value='');
}

function generateQR(){const c=document.getElementById('qrContainer');c.innerHTML='';new QRCode(c,{text:window.location.href,width:150,height:150});toast('تم توليد QR Code ✅');}
function backupData(){
  const data={products:JSON.parse(localStorage.getItem('pos_products')||'[]'),orders:JSON.parse(localStorage.getItem('pos_orders')||'[]'),customers:JSON.parse(localStorage.getItem('pos_customers')||'[]'),debts:JSON.parse(localStorage.getItem('pos_debts')||'[]'),expenses:JSON.parse(localStorage.getItem('pos_expenses')||'[]'),settings:JSON.parse(localStorage.getItem('pos_settings')||'{}'),cash_register:JSON.parse(localStorage.getItem('pos_cash_register')||'{}'),backup_date:new Date().toISOString()};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='pos_backup_'+new Date().toISOString().split('T')[0]+'.json';a.click();toast('تم تنزيل النسخة ✅');
}
function restoreData(e){
  const r=new FileReader();r.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      if(d.products)localStorage.setItem('pos_products',JSON.stringify(d.products));
      if(d.orders)localStorage.setItem('pos_orders',JSON.stringify(d.orders));
      if(d.customers)localStorage.setItem('pos_customers',JSON.stringify(d.customers));
      if(d.debts)localStorage.setItem('pos_debts',JSON.stringify(d.debts));
      if(d.expenses)localStorage.setItem('pos_expenses',JSON.stringify(d.expenses));
      if(d.settings)localStorage.setItem('pos_settings',JSON.stringify(d.settings));
      if(d.cash_register)localStorage.setItem('pos_cash_register',JSON.stringify(d.cash_register));
      toast('تم الاسترجاع ✅');setTimeout(()=>location.reload(),1000);
    }catch{toast('ملف خاطئ','error');}
  };r.readAsText(e.target.files[0]);
}

// ══ اللوحة السرية ════════════════════════════════════════
function openSecretPanel(){document.getElementById('secretPanel').classList.remove('hidden');}
function closeSecretPanel(){document.getElementById('secretPanel').classList.add('hidden');document.getElementById('secretLock').style.display='block';document.getElementById('secretData').classList.add('hidden');document.getElementById('secretPassInput').value='';}
function verifySecret(){
  const pass=document.getElementById('secretPassInput').value;
  if(pass===(State.settings.secret_password||'secret2024')){
    document.getElementById('secretLock').style.display='none';document.getElementById('secretData').classList.remove('hidden');
    const stats=getLocalStats('day');
    const reg=JSON.parse(localStorage.getItem('pos_cash_register')||'{"balance":0}');
    const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
    const totalD=debts.filter(d=>d.status!=='paid').reduce((s,d)=>s+parseFloat(d.remaining_amount||0),0);
    document.getElementById('secretOrders').textContent=stats.orders;
    document.getElementById('secretRevenue').textContent=parseFloat(stats.revenue).toFixed(2)+' '+CURRENCY;
    document.getElementById('secretProfit').textContent=parseFloat(stats.profit).toFixed(2)+' '+CURRENCY;
    document.getElementById('secretTop').textContent=stats.topProducts?.[0]?.product_name||'-';
    document.getElementById('secretBalance').textContent=parseFloat(reg.balance||0).toFixed(2)+' '+CURRENCY;
    document.getElementById('secretDebts').textContent=totalD.toFixed(2)+' '+CURRENCY;
  }else{toast('كلمة السر خاطئة ❌','error');document.getElementById('secretPassInput').value='';}
}

// ══ مساعدات ══════════════════════════════════════════════
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
function playBeep(){try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(880,ctx.currentTime);g.gain.setValueAtTime(0.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);o.start();o.stop(ctx.currentTime+0.15);}catch{}}
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
  const pend=orders.filter(o=>o.order_status==='pending'&&new Date(o.created_at).toDateString()===new Date().toDateString()).length;
  const pb=document.getElementById('pendingBadge');if(pb){pb.textContent=pend;pb.style.display=pend?'':'none';}
  const debts=JSON.parse(localStorage.getItem('pos_debts')||'[]');
  const unpaid=debts.filter(d=>d.status!=='paid').length;
  const db=document.getElementById('debtsBadge');if(db){db.textContent=unpaid;db.style.display=unpaid?'':'none';}
}

// Service Worker
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
