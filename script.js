// ============================================================
// CONFIG
// ============================================================
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
let pendingImages = [];
let pendingVideoFile = null;   // ملف الفيديو كـ File object
let pendingVideoData = null;   // الفيديو كـ Base64
let authToken = localStorage.getItem('kbs_token') || null;
let sliderIntervals = {};

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
const videoPreview = document.getElementById('videoPreview');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutMobileLink = document.getElementById('logoutMobileLink');
const userIcon = document.getElementById('userIcon');
const navLinks = document.getElementById('navLinks');
const cartOverlay = document.getElementById('cartOverlay');

// ============================================================
// AXIOS INSTANCE
// ============================================================
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(config => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            logoutUserLocally();
            window.location.href = 'login.html';
        }
        return Promise.reject(error);
    }
);

// ============================================================
// PARTICLES BACKGROUND
// ============================================================
function createParticles() {
    const container = document.getElementById('particlesBg');
    if (!container) return;
    
    for (let i = 0; i < 60; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        const size = Math.random() * 4 + 1;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.animationDuration = (Math.random() * 20 + 10) + 's';
        particle.style.animationDelay = (Math.random() * 15) + 's';
        particle.style.opacity = Math.random() * 0.4 + 0.05;
        
        const colors = ['#ff6a00', '#ff2d75', '#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e', '#eab308'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
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
    
    Object.keys(sliderIntervals).forEach(key => {
        clearInterval(sliderIntervals[key]);
        delete sliderIntervals[key];
    });
}

// ============================================================
// VIDEO UPLOAD - رفع فيديو محلي (الكود الذي أرسلته)
// ============================================================
document.getElementById('productVideoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const previewDiv = document.getElementById('videoPreview');
    previewDiv.innerHTML = '';
    pendingVideoFile = null;
    pendingVideoData = null;

    if (!file) {
        previewDiv.innerHTML = `<span style="color:#888;font-size:14px;">📹 لم يتم اختيار فيديو</span>`;
        return;
    }

    // التحقق من نوع الفيديو
    const validTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(file.type)) {
        previewDiv.innerHTML = `<span style="color:#ef4444;font-size:14px;">⚠️ يرجى اختيار ملف فيديو صحيح (MP4, WebM, AVI)</span>`;
        return;
    }

    // التحقق من حجم الفيديو (حد أقصى 100MB)
    if (file.size > 100 * 1024 * 1024) {
        previewDiv.innerHTML = `<span style="color:#ef4444;font-size:14px;">⚠️ حجم الفيديو كبير جداً (الحد الأقصى 100MB)</span>`;
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        pendingVideoData = event.target.result; // Base64
        pendingVideoFile = file;
        
        // عرض معاينة الفيديو
        previewDiv.innerHTML = `
            <div style="position:relative;padding-bottom:56.25%;height:0;border-radius:10px;overflow:hidden;border:2px solid #ff6a00;background:#000;">
                <video controls style="position:absolute;top:0;left:0;width:100%;height:100%;">
                    <source src="${pendingVideoData}" type="${file.type}">
                    متصفحك لا يدعم تشغيل الفيديو
                </video>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;">
                <span style="color:#22c55e;font-size:13px;">✅ ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button onclick="clearVideo()" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px;">
                    <i class="fas fa-times"></i> إزالة
                </button>
            </div>
        `;
        showToast(`✅ تم تحميل الفيديو: ${file.name}`, 'success');
    };
    reader.readAsDataURL(file);
});

// ============================================================
// CLEAR VIDEO - إزالة الفيديو المرفوع
// ============================================================
function clearVideo() {
    document.getElementById('productVideoInput').value = '';
    document.getElementById('videoPreview').innerHTML = `<span style="color:#888;font-size:14px;">📹 لم يتم اختيار فيديو</span>`;
    pendingVideoFile = null;
    pendingVideoData = null;
    showToast('🗑️ تم إزالة الفيديو', 'success');
}

// ============================================================
// PRODUCT SLIDER FUNCTIONS
// ============================================================

function initSlider(productId, totalSlides, hasVideo = false) {
    if (sliderIntervals[productId]) {
        clearInterval(sliderIntervals[productId]);
        delete sliderIntervals[productId];
    }

    const slideCount = totalSlides + (hasVideo ? 1 : 0);
    if (slideCount <= 1) return;

    let currentSlide = 0;
    const slider = document.getElementById(`slider-${productId}`);
    const dots = document.querySelectorAll(`#slider-${productId} .slider-dot`);
    const prevBtn = document.getElementById(`prev-${productId}`);
    const nextBtn = document.getElementById(`next-${productId}`);

    function goToSlide(index) {
        if (!slider) return;
        const slides = slider.querySelectorAll('.product-slide');
        if (slides.length === 0) return;
        
        if (index >= slides.length) index = 0;
        if (index < 0) index = slides.length - 1;
        currentSlide = index;
        
        slider.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); prevSlide(); };
    if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); nextSlide(); };
    
    dots.forEach((dot, i) => {
        dot.onclick = (e) => { e.stopPropagation(); goToSlide(i); };
    });

    sliderIntervals[productId] = setInterval(nextSlide, 4000);

    const container = document.getElementById(`slider-container-${productId}`);
    if (container) {
        container.addEventListener('mouseenter', () => {
            clearInterval(sliderIntervals[productId]);
        });
        container.addEventListener('mouseleave', () => {
            clearInterval(sliderIntervals[productId]);
            sliderIntervals[productId] = setInterval(nextSlide, 4000);
        });
    }
}

// ============================================================
// RENDER PRODUCTS
// ============================================================
function renderProducts() {
    if (!productsGrid) return;
    productsGrid.innerHTML = '';
    
    Object.keys(sliderIntervals).forEach(key => {
        clearInterval(sliderIntervals[key]);
        delete sliderIntervals[key];
    });
    
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
        card.id = `product-${p._id}`;
        card.style.animationDelay = `${index * 0.06}s`;
        
        let deleteBtnHTML = '';
        if (isAdmin) {
            deleteBtnHTML = `
                <button class="btn-delete" onclick="deleteProduct('${p._id}')" title="حذف المنتج">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
        }

        let slidesHTML = '';
        const images = p.images || [p.image || p.coverImage];
        
        // عرض الفيديو المحلي إذا كان موجوداً
        if (p.hasVideo && p.video) {
            slidesHTML += `
                <div class="product-slide">
                    <div style="width:100%;height:100%;position:relative;background:#000;">
                        <video controls style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;">
                            <source src="${p.video}" type="${p.videoType || 'video/mp4'}">
                            متصفحك لا يدعم تشغيل الفيديو
                        </video>
                        <div class="video-overlay" onclick="event.stopPropagation();this.style.display='none';this.parentElement.querySelector('video').play();" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;background:rgba(255,106,0,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(255,106,0,0.3);z-index:2;">
                            <i class="fas fa-play" style="color:#fff;font-size:24px;margin-left:4px;"></i>
                        </div>
                    </div>
                </div>
            `;
        }

        images.forEach(img => {
            slidesHTML += `
                <div class="product-slide">
                    <img src="${img}" alt="${p.name}" loading="lazy" />
                </div>
            `;
        });

        const totalSlides = images.length + (p.hasVideo && p.video ? 1 : 0);
        let dotsHTML = '';
        for (let i = 0; i < totalSlides; i++) {
            dotsHTML += `<button class="slider-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></button>`;
        }

        card.innerHTML = `
            <div class="product-slider-container" id="slider-container-${p._id}">
                <div class="product-slider" id="slider-${p._id}">
                    ${slidesHTML}
                </div>
                ${totalSlides > 1 ? `
                    <button class="slider-arrow prev" id="prev-${p._id}">‹</button>
                    <button class="slider-arrow next" id="next-${p._id}">›</button>
                    <div class="slider-dots">${dotsHTML}</div>
                ` : ''}
            </div>
            <div class="product-info">
                <h3>${p.name}</h3>
                <div class="price-row">
                    <span class="price">${p.price} TRY</span>
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

        setTimeout(() => {
            if (totalSlides > 1) {
                initSlider(p._id, images.length, p.hasVideo && p.video);
            }
        }, 100);
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

    const size = selectedSize[productId] || (product.sizes && product.sizes[0]) || 'M';
    const existing = cart.find(item => item.id === productId && item.size === size);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ 
            id: productId, 
            name: product.name, 
            price: product.price, 
            image: (product.images && product.images[0]) || product.image || product.coverImage,
            size, 
            quantity: 1 
        });
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
    const size = selectedSize[productId] || (product.sizes && product.sizes[0]) || 'M';

    cart = [{ 
        id: productId, 
        name: product.name, 
        price: product.price, 
        image: (product.images && product.images[0]) || product.image || product.coverImage,
        size, 
        quantity: 1 
    }];
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
                    <div class="item-price">${itemTotal} TRY (${item.quantity} × ${item.price} TRY)</div>
                </div>
                <div class="cart-item-remove" onclick="removeFromCart(${index})">✕</div>
            </div>
        `;
    });

    cartItemsDiv.innerHTML = html;
    cartTotalPrice.textContent = `${total} TRY`;
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
        message += `   - المقاس: ${item.size}%0A`;
        message += `   - الكمية: ${item.quantity}%0A`;
        message += `   - المجموع: ${itemTotal} TRY%0A%0A`;
    });
    
    message += `💰 *الإجمالي الكلي: ${total} TRY*%0A%0A`;
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
        userIcon.style.color = '#ff6a00';
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

// ============================================================
// ADD PRODUCT - مع دعم الفيديو المحلي
// ============================================================
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

    if (!name || !price || pendingImages.length === 0 || colors.length === 0 || sizes.length === 0) {
        showToast('⚠️ يرجى ملء جميع الحقول واختيار صورة واحدة على الأقل', 'error');
        return;
    }

    try {
        const newProduct = {
            name,
            price,
            images: pendingImages,
            coverImage: pendingImages[0],
            video: pendingVideoData || '',      // ← الفيديو كـ Base64
            hasVideo: !!pendingVideoData,
            videoType: pendingVideoFile ? pendingVideoFile.type : '',
            colors,
            sizes
        };

        const saved = await addProductToServer(newProduct);
        products.unshift(saved);
        renderProducts();
        updateProductCount();
        
        document.getElementById('addProductForm').reset();
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('videoPreview').innerHTML = `<span style="color:#888;font-size:14px;">📹 لم يتم اختيار فيديو</span>`;
        pendingImages = [];
        pendingVideoFile = null;
        pendingVideoData = null;
        showToast(`✅ تم إضافة المنتج بنجاح`, 'success');
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

    // Image upload handler - multiple images
    document.getElementById('productImagesInput').addEventListener('change', function(e) {
        const files = e.target.files;
        const previewDiv = document.getElementById('imagePreview');
        previewDiv.innerHTML = '';
        pendingImages = [];

        if (files.length === 0) {
            showToast('⚠️ يرجى اختيار صورة واحدة على الأقل', 'error');
            return;
        }

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(event) {
                pendingImages.push(event.target.result);
                const img = document.createElement('img');
                img.src = event.target.result;
                previewDiv.appendChild(img);
                
                if (pendingImages.length === files.length) {
                    showToast(`✅ تم تحميل ${pendingImages.length} صور بنجاح`, 'success');
                }
            };
            reader.readAsDataURL(file);
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
    });

    // Close mobile menu on outside click
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
window.clearVideo = clearVideo;
