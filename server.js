// ============================================================
// SERVER - KBS FASHION BACKEND
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================
// SERVE STATIC FILES
// ============================================================
app.use(express.static(path.join(__dirname, '/')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// MONGODB CONNECTION
// ============================================================
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================================
// SCHEMAS
// ============================================================

// Product Schema
// Product Schema - مع دعم الفيديو المحلي
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    images: { type: [String], required: true },
    coverImage: { type: String, required: true },
    video: { type: String, default: '' },        // Base64 للفيديو
    hasVideo: { type: Boolean, default: false },
    videoType: { type: String, default: '' },     // نوع الفيديو (MP4, WebM, إلخ)
    colors: { type: [String], required: true },
    sizes: { type: [String], required: true },
    createdAt: { type: Number, default: Date.now }
});

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Number, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);
const User = mongoose.model('User', userSchema);

// ============================================================
// JWT HELPERS
// ============================================================
function generateToken(user) {
    return jwt.sign(
        { id: user._id, email: user.email, isAdmin: user.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'غير مصرح' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'رمز غير صالح' });
    }
}

function isAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'غير مصرح - مشرف فقط' });
    }
    next();
}

// ============================================================
// INIT ADMIN USER
// ============================================================
async function initAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL || 'kbs@kbs.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'kbs';
    
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
        const hashed = await bcrypt.hash(adminPassword, 10);
        await User.create({
            name: 'المشرف',
            email: adminEmail,
            password: hashed,
            isAdmin: true
        });
        console.log('✅ Admin user created');
    }
}
initAdmin();

// ============================================================
// API ROUTES
// ============================================================

// ---------- PRODUCTS ----------

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', verifyToken, isAdmin, async (req, res) => {
    try {
        const { name, price, images, coverImage, video, hasVideo, videoType, colors, sizes } = req.body;
        
        if (!name || !price || !images || images.length === 0 || !coverImage || !colors || !sizes) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة بما في ذلك صورة واحدة على الأقل' });
        }
        
        const product = await Product.create({
            name,
            price,
            images,
            coverImage,
            video: video || '',
            hasVideo: hasVideo || false,
            videoType: videoType || '',
            colors,
            sizes,
            createdAt: Date.now()
        });
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }
        res.json({ message: 'تم الحذف بنجاح' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- AUTH ----------

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        
        if (email === process.env.ADMIN_EMAIL) {
            return res.status(400).json({ error: 'هذا البريد محجوز للإدارة' });
        }
        
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: 'البريد مسجل مسبقاً' });
        }
        
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            phone: phone || '',
            password: hashed
        });
        
        const token = generateToken(user);
        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                isAdmin: user.isAdmin
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'المستخدم غير موجود' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ error: 'كلمة السر غير صحيحة' });
        }
        
        const token = generateToken(user);
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                isAdmin: user.isAdmin
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
