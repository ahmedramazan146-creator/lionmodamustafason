// ============================================================
// CONFIG
// ============================================================
// ⚠️ غيّر هذا الرابط حسب عنوان الخادم بعد النشر
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : 'https://lionmoda.onrender.com/api';

const WHATSAPP_NUMBER = '905375835691';
const ADMIN_EMAIL = 'kbs@kbs.com';

// ============================================================
// STATE
// ============================================================
let cart = JSON.parse(localStorage.getItem('kbs_cart')) || [];
let currentUser = null;
let products = [];
let selectedSize = {};
let pendingImage = null;
let authToken = localStorage.getItem('kbs_token') || null;

// ============================================================
// DOM REFS
// ============================================================
const productsGrid = document.getElementById('productsGrid');
const cartBadge = document.getElementById('cartBadge');
const cartItemsDiv = document.getElementById('cartItems');
const cartFooter = document.getElementById('cartFooter');
const cartTotalPrice = document.getElementById('cartTotalPrice');
const toastContainer = document.getElementById('toastContainer');
const productCount = document.getElementById('productCount');
const imagePreview = document.getElementById('imagePreview');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutMobileLink = document.getElementById('logoutMobileLink');
const userIcon = document.getElementById('userIcon');
const navLinks = document.getElementById('navLinks');
const cartOverlay = document.getElementById('cartOverlay');

// ============================================================
// AXIOX INSTANCE
// ============================================================
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests
api.interceptors.request.use(config => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

// ============================================================
// PARTICLES BACKGROUND
// ============================================================
function createParticles() {
    const container = document.getElementById('particlesBg');
    if (!container) return;
    
    for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.width = (Math.random() * 3 + 1) + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
        particle.style.animationDelay = (Math.random() * 10) + 's';
        particle.style.opacity = Math.random() * 0.3 + 0.1;
        container.appendChild(particle);
    }
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ============================================================
// API FUNCTIONS
// ============================================================

async function loadProductsFromServer() {
    try {
        const res = await api.get('/products');
        products = res.data;
        renderProducts();
        updateProductCount();
    } catch (err) {
        console.error('Error loading products:', err);
        showToast('⚠️ فشل تحميل المنتجات', 'error');
    }
}

async function addProductToServer(productData) {
    try {
        const res = await api.post('/products', productData);
        showToast('✅ تم إضافة المنتج بنجاح!', 'success');
        return res.data;
    } catch (err) {
        showToast('⚠️ فشل إضافة المنتج: ' + (err.response?.data?.error || err.message), 'error');
        throw err;
    }
}

async function deleteProductFromServer(productId) {
    try {
        await api.delete(`/products/${productId}`);
        showToast('✅ تم حذف المنتج بنجاح', 'success');
        return true;
    } catch (err) {
        showToast('⚠️ فشل حذف المنتج: ' + (err.response?.data?.error || err.message), 'error');
        throw err;
    }
}

async function loginUser(email, password) {
    try {
        const res = await api.post('/auth/login', { email, password });
        authToken = res.data.token;
        currentUser = res.data.user;
        localStorage.setItem('kbs_token', authToken);
        localStorage.setItem('kbs_user', JSON.stringify(currentUser));
        updateUserUI(true);
        showToast(`👋 مرحباً ${currentUser.name}!`, 'success');
        return currentUser;
    } catch (err) {
        showToast('⚠️ ' + (err.response?.data?.error || 'فشل تسجيل الدخول'), 'error');
        throw err;
    }
}

async function registerUser(userData) {
    try {
        const res = await api.post('/auth/register', userData);
        authToken = res.data.token;
        currentUser = res.data.user;
        localStorage.setItem('kbs_token', authToken);
        localStorage.setItem('kbs_user', JSON.stringify(currentUser));
        updateUserUI(true);
        showToast(`✅ مرحباً ${currentUser.name}! تم إنشاء الحساب`, 'success');
        return currentUser;
    } catch (err) {
        showToast('⚠️ ' + (err.response?.data?.error || 'فشل إنشاء الحساب'), 'error');
        throw err;
    }
}

function logoutUserLocally() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('kbs_token');
    localStorage.removeItem('kbs_user');
    updateUserUI(false);
    document.getElementById('adminPanel').style.display = 'none';
    showToast('✅ تم تسجيل الخروج بنجاح', 'success');
    showSection('home');
    if (navLinks) navLinks.classList.remove('mobile-open');
    document.querySelector('.mobile-menu')?.classList.remove('active');
}

// ============================================================
// RENDER PRODUCTS
// ============================================================
function renderProducts() {
    if (!productsGrid) return;
    productsGrid.innerHTML = '';
    
    if (products.length === 0) {
        productsGrid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--gray);">
                <i class="fas fa-box-open" style="font-size:50px;margin-bottom:12px;display:block;"></i>
                <p style="font-size:20px;">لا توجد منتجات حالياً</p>
                <span style="font-size:14px;">سيتم إضافة تشكيلة جديدة قريباً</span>
            </div>
        `;
        return;
    }

    const isAdmin = currentUser && currentUser.isAdmin;

    products.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.id = `product-${p.id}`;
        card.style.animationDelay = `${index * 0.06}s`;
        
        let deleteBtnHTML = '';
        if (isAdmin) {
            deleteBtnHTML = `
                <button class="btn-delete" onclick="deleteProduct('${p._id}')" title="حذف المنتج">
                    <i class="fas fa-trash-alt"></i> حذف
                </button>
            `;
        }
        
        card.innerHTML = `
            <img class="product-img" src="${p.image}" alt="${p.name}" loading="lazy" />
            <div class="product-info">
                <h3>${p.name}</h3>
                <div class="price-row">
                    <span class="price">${p.price} ₪</span>
                </div>
                <div class="colors">🎨 ${p.colors ? p.colors.join(' • ') : 'ألوان متعددة'}</div>
                <div class="size-selector" data-product-id="${p._id}">
                    ${p.sizes.map(s => `<button onclick="selectSize('${p._id}', '${s}')">${s}</button>`).join('')}
                </div>
                <div class="product-actions">
                    <button class="btn-add" onclick="addToCart('${p._id}')">
                        <i class="fas fa-cart-plus"></i> أضف
                    </button>
                    <button class="btn-buy" onclick="buyNow('${p._id}')">
                        <i class="fab fa-whatsapp"></i> شراء
                    </button>
                    ${deleteBtnHTML}
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

// ============================================================
// DELETE PRODUCT
// ============================================================
async function deleteProduct(productId) {
    if (!currentUser || !currentUser.isAdmin) {
        showToast('⚠️ غير مصرح لك بهذه العملية', 'error');
        return;
    }

    const product = products.find(p => p._id === productId);
    if (!product) {
        showToast('⚠️ المنتج غير موجود', 'error');
        return;
    }

    if (!confirm(`⚠️ هل أنت متأكد من حذف المنتج "${product.name}"؟`)) {
        return;
    }

    try {
        await deleteProductFromServer(productId);
        products = products.filter(p => p._id !== productId);
        renderProducts();
        updateProductCount();
    } catch (err) {
        // error handled in function
    }
}

// ============================================================
// SIZE SELECTOR
// ============================================================
function selectSize(productId, size) {
    selectedSize[productId] = size;
    const container = document.querySelector(`.size-selector[data-product-id="${productId}"]`);
    if (container) {
        container.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === size);
        });
    }
}

// ============================================================
// CART FUNCTIONS
// ============================================================
function addToCart(productId) {
    if (!currentUser) {
        showToast('⚠️ يرجى تسجيل الدخول أولاً', 'error');
        window.location.href = 'login.html';
        return;
    }

    const product = products.find(p => p._id === productId);
    if (!product) return;

    const size = selectedSize[productId] || product.sizes[0];
    const existing = cart.find(item => item.id === productId && item.size === size);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id: productId, name: product.name, price: product.price, image: product.image, size, quantity: 1 });
    }

    localStorage.setItem('kbs_cart', JSON.stringify(cart));
    updateCartUI();
    showToast(`✓ تم إضافة ${product.name}`, 'success');
}

function buyNow(productId) {
    if (!currentUser) {
        showToast('⚠️ يرجى تسجيل الدخول أولاً', 'error');
        window.location.href = 'login.html';
        return;
    }

    const product = products.find(p => p._id === productId);
    if (!product) return;
    const size = selectedSize[productId] || product.sizes[0];

    cart = [{ id: productId, name: product.name, price: product.price, image: product.image, size, quantity: 1 }];
    localStorage.setItem('kbs_cart', JSON.stringify(cart));
    updateCartUI();
    handleCheckout();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('kbs_cart', JSON.stringify(cart));
    updateCartUI();
    if (cart.length === 0) {
        cartFooter.style.display = 'none';
    }
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
    cartBadge.textContent = totalItems;

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-bag"></i>
                <p>سلة التسوق فارغة</p>
                <span>أضف منتجاتك المفضلة الآن</span>
            </div>
        `;
        cartFooter.style.display = 'none';
        return;
    }

    cartFooter.style.display = 'block';
    let html = '';
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <div class="cart-item">
                <img class="cart-item-img" src="${item.image}" alt="${item.name}" />
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <div class="item-size">المقاس: ${item.size}</div>
                    <div class="item-price">${itemTotal} ₪ (${item.quantity} × ${item.price} ₪)</div>
                </div>
                <div class="cart-item-remove" onclick="removeFromCart(${index})">✕</div>
            </div>
        `;
    });

    cartItemsDiv.innerHTML = html;
    cartTotalPrice.textContent = `${total} ₪`;
}

// ============================================================
// CHECKOUT
// ============================================================
function handleCheckout() {
    if (cart.length === 0) {
        showToast('⚠️ السلة فارغة', 'error');
        return;
    }

    if (!currentUser) {
        showToast('⚠️ يرجى تسجيل الدخول أولاً', 'error');
        window.location.href = 'login.html';
        return;
    }

    let message = '🛍️ *طلب شراء جديد - KBS FASHION*%0A%0A';
    let total = 0;
    
    cart.forEach((item, i) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        message += `${i+1}. ${item.name}%0A`;
        message += `   - السعر: ${item.price} ₪%0A`;
        message += `   - المقاس: ${item.size}%0A`;
        message += `   - الكمية: ${item.quantity}%0A`;
        message += `   - المجموع: ${itemTotal} ₪%0A%0A`;
    });
    
    message += `💰 *الإجمالي الكلي: ${total} ₪*%0A%0A`;
    message += `👤 العميل: ${currentUser.name || currentUser.email || 'زائر'}%0A`;
    message += `📅 تاريخ الطلب: ${new Date().toLocaleDateString('ar-EG')}`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, '_blank');

    cart = [];
    localStorage.setItem('kbs_cart', JSON.stringify(cart));
    updateCartUI();
    toggleCart();
    showToast('✅ تم توجيهك إلى واتساب لإتمام الطلب', 'success');
}

// ============================================================
// TOGGLE CART
// ============================================================
function toggleCart() {
    const cartPage = document.getElementById('cartPage');
    const overlay = document.getElementById('cartOverlay');
    cartPage.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = cartPage.classList.contains('active') ? 'hidden' : '';
}

function handleCartClick() {
    if (!currentUser) {
        showToast('⚠️ يرجى تسجيل الدخول أولاً', 'error');
        window.location.href = 'login.html';
        return;
    }
    toggleCart();
}

// ============================================================
// AUTH SYSTEM
// ============================================================
function handleUserClick() {
    if (currentUser) {
        if (currentUser.isAdmin) {
            showAdminPanel();
        } else {
            showToast(`👋 مرحباً ${currentUser.name || currentUser.email}`, 'success');
        }
    } else {
        window.location.href = 'login.html';
    }
}

function logoutUser() {
    logoutUserLocally();
}

function checkAuthStatus() {
    const stored = localStorage.getItem('kbs_user');
    const token = localStorage.getItem('kbs_token');
    if (stored && token) {
        try {
            currentUser = JSON.parse(stored);
            authToken = token;
            updateUserUI(true);
        } catch (e) {
            localStorage.removeItem('kbs_user');
            localStorage.removeItem('kbs_token');
        }
    }
}

function updateUserUI(isLoggedIn) {
    const adminLink = document.getElementById('adminLink');
    const logoutLink = document.getElementById('logoutMobileLink');
    
    if (isLoggedIn && currentUser) {
        userNameDisplay.style.display = 'inline-block';
        userNameDisplay.textContent = currentUser.name || currentUser.email || 'مستخدم';
        userIcon.style.color = '#ffffff';
        userIcon.className = 'fas fa-user-check';
        
        if (logoutLink) logoutLink.style.display = 'inline-block';
        
        if (currentUser.isAdmin) {
            if (adminLink) adminLink.style.display = 'inline-block';
        } else {
            if (adminLink) adminLink.style.display = 'none';
        }
    } else {
        userNameDisplay.style.display = 'none';
        userIcon.style.color = '';
        userIcon.className = 'fas fa-user';
        if (logoutLink) logoutLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
    }
    
    renderProducts();
}

// ============================================================
// ADMIN PANEL
// ============================================================
function showAdminPanel() {
    if (!currentUser || !currentUser.isAdmin) {
        window.location.href = 'login.html';
        return;
    }
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('adminPanel').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function addProduct(e) {
    e.preventDefault();
    if (!currentUser || !currentUser.isAdmin) {
        showToast('⚠️ غير مصرح لك بهذه العملية', 'error');
        return;
    }

    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const colors = document.getElementById('productColors').value.split(',').map(c => c.trim()).filter(c => c);
    const sizes = document.getElementById('productSizes').value.split(',').map(s => s.trim()).filter(s => s);

    if (!name || !price || !pendingImage || colors.length === 0 || sizes.length === 0) {
        showToast('⚠️ يرجى ملء جميع الحقول واختيار صورة', 'error');
        return;
    }

    try {
        const newProduct = {
            name,
            price,
            image: pendingImage,
            colors,
            sizes
        };

        const saved = await addProductToServer(newProduct);
        products.unshift(saved);
        renderProducts();
        updateProductCount();
        
        document.getElementById('addProductForm').reset();
        imagePreview.innerHTML = '';
        pendingImage = null;
        showSection('products');
    } catch (err) {
        // error handled
    }
}

// ============================================================
// SECTION NAVIGATION
// ============================================================
function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
        if (id === 'home') target.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(id)) {
            link.classList.add('active');
        }
    });
    if (navLinks) navLinks.classList.remove('mobile-open');
    document.querySelector('.mobile-menu')?.classList.remove('active');
    document.getElementById('adminPanel').style.display = 'none';
}

// ============================================================
// MOBILE MENU
// ============================================================
function toggleMobileMenu() {
    const menu = document.getElementById('navLinks');
    const btn = document.querySelector('.mobile-menu');
    if (menu && btn) {
        menu.classList.toggle('mobile-open');
        btn.classList.toggle('active');
    }
}

// ============================================================
// INIT
// ============================================================
function updateProductCount() {
    if (productCount) {
        productCount.textContent = products.length;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('preloader').classList.add('hidden');
    }, 1200);

    createParticles();
    checkAuthStatus();
    loadProductsFromServer();
    updateCartUI();
    showSection('home');

    document.getElementById('productImageInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                pendingImage = event.target.result;
                imagePreview.innerHTML = `<img src="${pendingImage}" alt="معاينة" />`;
            };
            reader.readAsDataURL(file);
        }
    });

    window.addEventListener('scroll', () => {
        document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const menu = document.getElementById('navLinks');
            const mobileBtn = document.querySelector('.mobile-menu');
            if (menu && mobileBtn && !menu.contains(e.target) && !mobileBtn.contains(e.target)) {
                menu.classList.remove('mobile-open');
                mobileBtn.classList.remove('active');
            }
        }
    });
});

// ============================================================
// EXPOSE FUNCTIONS
// ============================================================
window.showSection = showSection;
window.handleUserClick = handleUserClick;
window.handleCartClick = handleCartClick;
window.toggleCart = toggleCart;
window.addToCart = addToCart;
window.buyNow = buyNow;
window.selectSize = selectSize;
window.removeFromCart = removeFromCart;
window.handleCheckout = handleCheckout;
window.toggleMobileMenu = toggleMobileMenu;
window.showAdminPanel = showAdminPanel;
window.addProduct = addProduct;
window.logoutUser = logoutUser;
window.deleteProduct = deleteProduct;
window.showToast = showToast;
window.loginUser = loginUser;
window.registerUser = registerUser;
