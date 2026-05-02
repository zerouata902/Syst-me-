-- ============================================================
-- نظام نقطة البيع المتكامل - قاعدة البيانات
-- POS System - MySQL Database
-- الإصدار: 2.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS pos_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pos_system;

-- ============================================================
-- 1. جدول المستخدمين (Users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,       -- مشفر بـ password_hash
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'worker') DEFAULT 'worker',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 2. جدول الفئات (Categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT '📦',
    color VARCHAR(20) DEFAULT '#6366f1',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 3. جدول المنتجات (Products)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    barcode VARCHAR(100) UNIQUE,
    category_id INT,
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    min_stock INT DEFAULT 5,              -- حد التنبيه
    image_url VARCHAR(500) DEFAULT '',
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    total_sold INT DEFAULT 0,             -- إجمالي المباع
    rating DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 4. جدول العملاء (Customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(200),
    address TEXT,
    city VARCHAR(100),
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 5. جدول الطلبات (Orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,  -- مثل: ORD-20240101-001
    customer_id INT,
    customer_name VARCHAR(200),                -- في حالة عميل غير مسجل
    order_type ENUM('dine_in', 'takeaway', 'delivery') DEFAULT 'dine_in',
    delivery_address TEXT,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_type ENUM('fixed', 'percent') DEFAULT 'fixed',
    discount_value DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method ENUM('cash', 'card', 'transfer', 'debt') DEFAULT 'cash',
    payment_status ENUM('paid', 'unpaid', 'partial') DEFAULT 'paid',
    amount_paid DECIMAL(10,2) DEFAULT 0,
    change_amount DECIMAL(10,2) DEFAULT 0,
    order_status ENUM('pending', 'preparing', 'ready', 'delivered', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    cashier_id INT,
    cashier_name VARCHAR(100),
    order_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 6. جدول تفاصيل الطلبات (Order Items)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT,
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    profit DECIMAL(10,2) DEFAULT 0,
    notes VARCHAR(500),                   -- ملاحظات المنتج (بدون بصل..)
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 7. جدول الديون (Debts)
-- ============================================================
CREATE TABLE IF NOT EXISTS debts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    customer_name VARCHAR(200) NOT NULL,
    customer_phone VARCHAR(20),
    order_id INT,
    original_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    remaining_amount DECIMAL(10,2) NOT NULL,
    due_date DATE,
    status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 8. جدول مدفوعات الديون (Debt Payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS debt_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    debt_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes VARCHAR(500),
    FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 9. جدول المصاريف (Expenses)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) DEFAULT 'عام',
    description TEXT,
    expense_date DATE NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 10. جدول سجل العمليات (Activity Logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    user_name VARCHAR(100),
    action VARCHAR(200) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 11. جدول الإعدادات (Settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_group VARCHAR(50) DEFAULT 'general',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 12. جدول تقييمات المنتجات (Reviews)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    customer_name VARCHAR(100) DEFAULT 'زبون',
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- البيانات الأولية (Seed Data)
-- ============================================================

-- المستخدمون (كلمة سر admin = admin123, worker = worker123)
INSERT INTO users (username, password, full_name, role) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'المدير العام', 'admin'),
('worker', '$2y$10$TKh8H1.PFbuSpgzjz0C.YeB0MYkW4jIjK.Jb8vM9T/p2a3AyMlG2', 'موظف الكاشير', 'worker');

-- الفئات
INSERT INTO categories (name, icon, color, sort_order) VALUES
('المشروبات الساخنة', '☕', '#ef4444', 1),
('المشروبات الباردة', '🧊', '#3b82f6', 2),
('الوجبات الرئيسية', '🍽️', '#f59e0b', 3),
('السندويشات', '🥪', '#10b981', 4),
('الحلويات', '🍰', '#8b5cf6', 5),
('إضافات', '✨', '#6366f1', 6);

-- المنتجات
INSERT INTO products (name, description, category_id, purchase_price, selling_price, stock, min_stock, is_featured, total_sold) VALUES
('قهوة عربية', 'قهوة عربية أصيلة بالهيل', 1, 5, 15, 100, 10, TRUE, 245),
('كابتشينو', 'كابتشينو إيطالي ممتاز', 1, 8, 22, 80, 10, TRUE, 198),
('شاي أخضر', 'شاي أخضر طبيعي', 1, 3, 12, 150, 15, FALSE, 156),
('لاتيه', 'لاتيه بالحليب الطازج', 1, 9, 25, 60, 10, TRUE, 134),
('عصير برتقال', 'عصير برتقال طبيعي طازج', 2, 6, 18, 50, 10, TRUE, 312),
('عصير فراولة', 'عصير فراولة مع آيس كريم', 2, 8, 22, 40, 8, FALSE, 187),
('موهيتو', 'موهيتو بالنعناع والليمون', 2, 7, 20, 45, 8, TRUE, 220),
('ماء معدني', 'ماء معدني 500ml', 2, 2, 5, 200, 20, FALSE, 450),
('برغر كلاسيك', 'برغر لحم مع خضروات طازجة', 3, 25, 55, 30, 5, TRUE, 89),
('دجاج مشوي', 'دجاج مشوي مع أرز وسلطة', 3, 30, 65, 25, 5, TRUE, 76),
('سلطة سيزر', 'سلطة سيزر مع دجاج مقرمش', 3, 15, 35, 20, 5, FALSE, 65),
('بيتزا مارغريتا', 'بيتزا بالجبن والطماطم', 3, 35, 75, 15, 3, TRUE, 92),
('سندويش كلوب', 'سندويش كلوب ثلاثي الطوابق', 4, 18, 40, 35, 5, FALSE, 143),
('سندويش شاورما', 'شاورما دجاج بالصوص الخاص', 4, 15, 35, 40, 5, TRUE, 267),
('كيك شوكولاتة', 'كيك شوكولاتة بلجيكي', 5, 12, 30, 20, 3, TRUE, 98),
('تشيز كيك', 'تشيز كيك كريمي بالفراولة', 5, 15, 35, 15, 3, FALSE, 72);

-- العملاء
INSERT INTO customers (name, phone, city, total_orders, total_spent) VALUES
('أحمد محمد', '0612345678', 'الدار البيضاء', 5, 450.00),
('فاطمة الزهراء', '0698765432', 'الرباط', 3, 285.00),
('محمد العمراني', '0654321098', 'مراكش', 8, 720.00),
('سارة بنالي', '0611223344', 'فاس', 2, 180.00);

-- الإعدادات
INSERT INTO settings (setting_key, setting_value, setting_group) VALUES
('shop_name', 'كافيه النخبة', 'general'),
('shop_name_en', 'Elite Cafe', 'general'),
('shop_address', 'شارع الحسن الثاني، الدار البيضاء', 'general'),
('shop_phone', '+212 600-000000', 'general'),
('shop_whatsapp', '+212600000000', 'general'),
('currency', 'DH', 'general'),
('currency_name', 'درهم مغربي', 'general'),
('tax_rate', '0', 'finance'),
('admin_password', 'admin123', 'security'),
('secret_password', 'secret2024', 'security'),
('receipt_footer', 'شكراً لزيارتكم! 🌟', 'receipt'),
('low_stock_alert', '5', 'inventory');

-- ============================================================
-- Views مفيدة
-- ============================================================

-- ملخص المبيعات اليومية
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT
    order_date,
    COUNT(*) as orders_count,
    SUM(total) as total_revenue,
    SUM(discount_amount) as total_discounts,
    SUM(tax_amount) as total_tax,
    SUM(total - discount_amount) as net_revenue
FROM orders
WHERE order_status != 'cancelled'
GROUP BY order_date
ORDER BY order_date DESC;

-- أفضل المنتجات مبيعاً
CREATE OR REPLACE VIEW top_selling_products AS
SELECT
    p.id,
    p.name,
    p.selling_price,
    p.total_sold,
    p.stock,
    c.name as category_name,
    SUM(oi.quantity) as qty_sold,
    SUM(oi.total_price) as revenue,
    SUM(oi.profit) as profit
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.order_status != 'cancelled'
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY p.id
ORDER BY qty_sold DESC;

-- ============================================================
-- Stored Procedures
-- ============================================================

DELIMITER //

-- إنشاء رقم طلب تلقائي
CREATE PROCEDURE GenerateOrderNumber(OUT order_num VARCHAR(20))
BEGIN
    DECLARE today_date VARCHAR(10);
    DECLARE seq INT;
    SET today_date = DATE_FORMAT(NOW(), '%Y%m%d');
    SELECT COUNT(*) + 1 INTO seq FROM orders WHERE order_date = CURDATE();
    SET order_num = CONCAT('ORD-', today_date, '-', LPAD(seq, 3, '0'));
END //

-- تحديث المخزون بعد الطلب
CREATE PROCEDURE UpdateStock(IN product_id INT, IN qty INT)
BEGIN
    UPDATE products
    SET stock = stock - qty, total_sold = total_sold + qty
    WHERE id = product_id AND stock >= qty;
END //

DELIMITER ;

-- ============================================================
-- Triggers
-- ============================================================

DELIMITER //

-- تسجيل الربح عند إضافة عنصر طلب
CREATE TRIGGER calculate_item_profit
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    SET NEW.profit = (NEW.unit_price - NEW.purchase_price) * NEW.quantity;
END //

DELIMITER ;
