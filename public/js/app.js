/* ---------- State & helpers ---------- */
const API = '/api';
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  cart: JSON.parse(localStorage.getItem('cart') || '[]'), // [{product,name,price,image,stock,qty}]
};
const $app = document.getElementById('app');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const saveCart = () => localStorage.setItem('cart', JSON.stringify(state.cart));

function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => (t.className = 'toast'), 2500);
}

async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token) logout(true);
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function setAuth(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
}

function logout(silent) {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (!silent) toast('Logged out');
  location.hash = '#/login';
  renderNav();
}

/* ---------- Navbar ---------- */
function renderNav() {
  const count = state.cart.reduce((n, i) => n + i.qty, 0);
  let html = `<a href="#/">Shop</a><a href="#/cart">Cart (${count})</a>`;
  if (state.user) {
    html += `<a href="#/orders">My Orders</a>`;
    if (state.user.role === 'admin') html += `<a href="#/admin">Admin</a>`;
    html += `<span>Hi, ${esc(state.user.name)}</span><button class="link" id="logoutBtn">Logout</button>`;
  } else {
    html += `<a href="#/login">Login</a><a href="#/register">Register</a>`;
  }
  document.getElementById('navLinks').innerHTML = html;
  const lb = document.getElementById('logoutBtn');
  if (lb) lb.onclick = () => logout();
}

/* ---------- Router ---------- */
function router() {
  const route = (location.hash || '#/').slice(1);
  renderNav();
  if (route === '/') return viewShop();
  if (route === '/cart') return viewCart();
  if (route === '/checkout') return viewCheckout();
  if (route === '/orders') return viewOrders();
  if (route === '/login') return viewLogin();
  if (route === '/register') return viewRegister();
  if (route === '/admin') return viewAdmin();
  $app.innerHTML = '<p class="empty">Page not found</p>';
}
window.addEventListener('hashchange', router);

/* ---------- Shop (catalog) ---------- */
async function viewShop() {
  $app.innerHTML = `
    <h2>Product Catalog</h2>
    <div class="toolbar">
      <input id="q" placeholder="Search products..." />
      <select id="cat"><option value="">All categories</option></select>
    </div>
    <div id="grid" class="grid"><p class="empty">Loading...</p></div>`;

  let all = [];
  try { all = await api('/products'); } catch (e) { return ($app.innerHTML = `<p class="empty">${esc(e.message)}</p>`); }

  const cats = [...new Set(all.map((p) => p.category))].sort();
  const catSel = document.getElementById('cat');
  cats.forEach((c) => catSel.insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`));

  function draw() {
    const q = document.getElementById('q').value.toLowerCase();
    const c = catSel.value;
    const list = all.filter((p) => p.name.toLowerCase().includes(q) && (!c || p.category === c));
    document.getElementById('grid').innerHTML = list.length
      ? list.map((p) => `
        <div class="card">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.visibility='hidden'" />
          <div class="body">
            <span class="cat">${esc(p.category)}</span>
            <strong>${esc(p.name)}</strong>
            <span>${esc(p.description)}</span>
            <span class="price">${money(p.price)}</span>
            <span class="stock ${p.stock ? '' : 'out'}">${p.stock ? p.stock + ' in stock' : 'Out of stock'}</span>
            <button data-id="${p._id}" ${p.stock ? '' : 'disabled'}>Add to Cart</button>
          </div>
        </div>`).join('')
      : '<p class="empty">No products found</p>';

    document.querySelectorAll('#grid button[data-id]').forEach((b) => {
      b.onclick = () => addToCart(all.find((p) => p._id === b.dataset.id));
    });
  }
  document.getElementById('q').oninput = draw;
  catSel.onchange = draw;
  draw();
}

/* ---------- Cart ---------- */
function addToCart(p) {
  const item = state.cart.find((i) => i.product === p._id);
  if (item) {
    if (item.qty >= p.stock) return toast('No more stock available', true);
    item.qty++;
    item.stock = p.stock;
  } else {
    state.cart.push({ product: p._id, name: p.name, price: p.price, image: p.image, stock: p.stock, qty: 1 });
  }
  saveCart();
  renderNav();
  toast('Added to cart');
}

function viewCart() {
  if (!state.cart.length) {
    $app.innerHTML = '<h2>Your Cart</h2><p class="empty">Your cart is empty. <a href="#/" style="color:#2563eb">Start shopping</a></p>';
    return;
  }
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  $app.innerHTML = `
    <h2>Your Cart</h2>
    <div class="table-wrap"><table>
      <tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr>
      ${state.cart.map((i, idx) => `
        <tr>
          <td>${esc(i.name)}</td>
          <td>${money(i.price)}</td>
          <td>
            <button class="sm secondary" data-dec="${idx}">-</button>
            ${i.qty}
            <button class="sm secondary" data-inc="${idx}">+</button>
          </td>
          <td>${money(i.price * i.qty)}</td>
          <td><button class="sm danger" data-rm="${idx}">Remove</button></td>
        </tr>`).join('')}
    </table></div>
    <div class="total">Total: ${money(total)}</div>
    <div style="text-align:right"><a class="btn" href="#/checkout">Proceed to Checkout</a></div>`;

  document.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => {
    const i = state.cart[b.dataset.inc];
    if (i.qty >= i.stock) return toast('Stock limit reached', true);
    i.qty++; saveCart(); viewCart(); renderNav();
  }));
  document.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => {
    const i = state.cart[b.dataset.dec];
    i.qty--;
    if (i.qty <= 0) state.cart.splice(b.dataset.dec, 1);
    saveCart(); viewCart(); renderNav();
  }));
  document.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => {
    state.cart.splice(b.dataset.rm, 1); saveCart(); viewCart(); renderNav();
  }));
}

/* ---------- Checkout ---------- */
function viewCheckout() {
  if (!state.user) { toast('Please login to checkout', true); location.hash = '#/login'; return; }
  if (!state.cart.length) { location.hash = '#/cart'; return; }
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  $app.innerHTML = `
    <h2>Checkout</h2>
    <div class="panel">
      ${state.cart.map((i) => `<div class="order-head"><span>${esc(i.name)} x ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
      <div class="total">Total: ${money(total)}</div>
      <label>Shipping address</label>
      <textarea id="addr" rows="3" placeholder="House no, street, city, pincode"></textarea>
      <label>Payment method</label>
      <select id="pay"><option>Cash on Delivery</option><option>UPI (demo)</option><option>Card (demo)</option></select>
      <br /><br />
      <button id="placeBtn">Place Order</button>
    </div>`;
  document.getElementById('placeBtn').onclick = async () => {
    const shippingAddress = document.getElementById('addr').value;
    if (!shippingAddress.trim()) return toast('Enter shipping address', true);
    try {
      await api('/orders', 'POST', {
        items: state.cart.map((i) => ({ product: i.product, qty: i.qty })),
        shippingAddress,
        paymentMethod: document.getElementById('pay').value,
      });
      state.cart = []; saveCart(); renderNav();
      toast('Order placed successfully!');
      location.hash = '#/orders';
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- My Orders (tracking) ---------- */
async function viewOrders() {
  if (!state.user) { location.hash = '#/login'; return; }
  $app.innerHTML = '<h2>My Orders</h2><p class="empty">Loading...</p>';
  try {
    const orders = await api('/orders/mine');
    if (!orders.length) { $app.innerHTML = '<h2>My Orders</h2><p class="empty">No orders yet</p>'; return; }
    $app.innerHTML = '<h2>My Orders</h2>' + orders.map((o) => `
      <div class="order-box">
        <div class="order-head">
          <strong>Order #${o._id.slice(-6).toUpperCase()}</strong>
          <span class="badge ${o.status}">${o.status}</span>
        </div>
        <small>${new Date(o.createdAt).toLocaleString()} | ${esc(o.paymentMethod)}</small>
        <ul style="margin:10px 0 10px 18px">${o.items.map((i) => `<li>${esc(i.name)} x ${i.qty} - ${money(i.price * i.qty)}</li>`).join('')}</ul>
        <div class="order-head">
          <span>Ship to: ${esc(o.shippingAddress)}</span>
          <strong>Total: ${money(o.total)}</strong>
        </div>
        ${o.status === 'Pending' ? `<button class="sm danger" data-cancel="${o._id}">Cancel Order</button>` : ''}
      </div>`).join('');
    document.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Cancel this order?')) return;
      try { await api(`/orders/${b.dataset.cancel}/cancel`, 'PUT'); toast('Order cancelled'); viewOrders(); }
      catch (e) { toast(e.message, true); }
    }));
  } catch (e) { toast(e.message, true); }
}

/* ---------- Login / Register ---------- */
function viewLogin() {
  $app.innerHTML = `
    <div class="panel form-box">
      <h2>Login</h2>
      <label>Email</label><input id="email" type="email" />
      <label>Password</label><input id="pass" type="password" />
      <button id="go">Login</button>
      <p class="muted">No account? <a href="#/register">Register</a></p>
      <p class="muted">Demo admin: admin@store.com / admin123<br/>Demo user: user@store.com / user123</p>
    </div>`;
  document.getElementById('go').onclick = async () => {
    try {
      setAuth(await api('/auth/login', 'POST', { email: email.value, password: pass.value }));
      toast('Welcome back!');
      location.hash = state.user.role === 'admin' ? '#/admin' : '#/';
    } catch (e) { toast(e.message, true); }
  };
}

function viewRegister() {
  $app.innerHTML = `
    <div class="panel form-box">
      <h2>Create Account</h2>
      <label>Name</label><input id="name" />
      <label>Email</label><input id="email" type="email" />
      <label>Password (min 6 characters)</label><input id="pass" type="password" />
      <button id="go">Register</button>
      <p class="muted">Already registered? <a href="#/login">Login</a></p>
    </div>`;
  document.getElementById('go').onclick = async () => {
    try {
      setAuth(await api('/auth/register', 'POST', { name: name.value, email: email.value, password: pass.value }));
      toast('Account created!');
      location.hash = '#/';
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- Admin dashboard ---------- */
function viewAdmin() {
  if (!state.user || state.user.role !== 'admin') { toast('Admins only', true); location.hash = '#/'; return; }
  $app.innerHTML = `
    <h2>Admin Dashboard</h2>
    <div class="tabs">
      <button id="tabP" class="active">Products</button>
      <button id="tabO">Orders</button>
    </div>
    <div id="adminBody"></div>`;
  const tp = document.getElementById('tabP'), to = document.getElementById('tabO');
  tp.onclick = () => { tp.className = 'active'; to.className = ''; adminProducts(); };
  to.onclick = () => { to.className = 'active'; tp.className = ''; adminOrders(); };
  adminProducts();
}

async function adminProducts() {
  const body = document.getElementById('adminBody');
  body.innerHTML = '<p class="empty">Loading...</p>';
  const products = await api('/products');
  body.innerHTML = `
    <div class="panel">
      <h3 id="formTitle">Add Product</h3>
      <input type="hidden" id="pid" />
      <div class="row">
        <div><label>Name</label><input id="pname" /></div>
        <div><label>Category</label><input id="pcat" /></div>
        <div><label>Price (₹)</label><input id="pprice" type="number" min="0" /></div>
        <div><label>Stock</label><input id="pstock" type="number" min="0" /></div>
      </div>
      <label>Image URL</label><input id="pimg" />
      <label>Description</label><textarea id="pdesc" rows="2"></textarea>
      <br />
      <button id="saveP">Save Product</button>
      <button class="secondary" id="clearP">Clear</button>
    </div>
    <div class="table-wrap"><table>
      <tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
      ${products.map((p) => `
        <tr>
          <td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock}</td>
          <td>
            <button class="sm" data-edit="${p._id}">Edit</button>
            <button class="sm danger" data-del="${p._id}">Delete</button>
          </td>
        </tr>`).join('')}
    </table></div>`;

  const f = (id) => document.getElementById(id);
  const clear = () => {
    ['pid', 'pname', 'pcat', 'pprice', 'pstock', 'pimg', 'pdesc'].forEach((id) => (f(id).value = ''));
    f('formTitle').textContent = 'Add Product';
  };
  f('clearP').onclick = clear;
  f('saveP').onclick = async () => {
    const data = {
      name: f('pname').value, category: f('pcat').value || 'General',
      price: Number(f('pprice').value), stock: Number(f('pstock').value),
      image: f('pimg').value, description: f('pdesc').value,
    };
    if (!data.name || isNaN(data.price) || isNaN(data.stock)) return toast('Name, price and stock are required', true);
    try {
      const id = f('pid').value;
      await api(id ? `/products/${id}` : '/products', id ? 'PUT' : 'POST', data);
      toast(id ? 'Product updated' : 'Product added');
      adminProducts();
    } catch (e) { toast(e.message, true); }
  };
  body.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
    const p = products.find((x) => x._id === b.dataset.edit);
    f('pid').value = p._id; f('pname').value = p.name; f('pcat').value = p.category;
    f('pprice').value = p.price; f('pstock').value = p.stock; f('pimg').value = p.image; f('pdesc').value = p.description;
    f('formTitle').textContent = 'Edit Product';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this product?')) return;
    try { await api(`/products/${b.dataset.del}`, 'DELETE'); toast('Product deleted'); adminProducts(); }
    catch (e) { toast(e.message, true); }
  }));
}

async function adminOrders() {
  const body = document.getElementById('adminBody');
  body.innerHTML = '<p class="empty">Loading...</p>';
  const orders = await api('/orders');
  if (!orders.length) { body.innerHTML = '<p class="empty">No orders yet</p>'; return; }
  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  body.innerHTML = `<div class="table-wrap"><table>
    <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
    ${orders.map((o) => `
      <tr>
        <td>#${o._id.slice(-6).toUpperCase()}<br/><small>${new Date(o.createdAt).toLocaleDateString()}</small></td>
        <td>${esc(o.user ? o.user.name : 'Deleted user')}<br/><small>${esc(o.user ? o.user.email : '')}</small></td>
        <td>${o.items.map((i) => `${esc(i.name)} x ${i.qty}`).join('<br/>')}</td>
        <td>${money(o.total)}</td>
        <td>
          <select data-status="${o._id}" ${o.status === 'Cancelled' ? 'disabled' : ''}>
            ${statuses.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('')}
  </table></div>`;
  body.querySelectorAll('[data-status]').forEach((sel) => (sel.onchange = async () => {
    try { await api(`/orders/${sel.dataset.status}/status`, 'PUT', { status: sel.value }); toast('Status updated'); adminOrders(); }
    catch (e) { toast(e.message, true); adminOrders(); }
  }));
}

/* ---------- Start ---------- */
router();
