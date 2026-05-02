<?php
// ============================================================
// api.php - نقطة الوصول الرئيسية للـ API
// ============================================================

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// توجيه الطلبات
switch ($action) {

    // ── المنتجات ─────────────────────────────────────────────
    case 'get_products':
        $category = $_GET['category'] ?? '';
        $search   = $_GET['search'] ?? '';
        $sort     = $_GET['sort'] ?? 'name';

        $sql = "SELECT p.*, c.name as category_name FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1";
        $params = [];

        if ($category) {
            $sql .= " AND p.category_id = ?";
            $params[] = $category;
        }
        if ($search) {
            $sql .= " AND (p.name LIKE ? OR p.barcode = ?)";
            $params[] = "%$search%";
            $params[] = $search;
        }

        $sql .= match($sort) {
            'price_asc'  => " ORDER BY p.selling_price ASC",
            'price_desc' => " ORDER BY p.selling_price DESC",
            'popular'    => " ORDER BY p.total_sold DESC",
            'featured'   => " ORDER BY p.is_featured DESC, p.total_sold DESC",
            default      => " ORDER BY p.name ASC"
        };

        jsonResponse(true, query($sql, $params));
        break;

    case 'get_product':
        $id = (int)($_GET['id'] ?? 0);
        $product = queryOne("SELECT p.*, c.name as category_name FROM products p
                            LEFT JOIN categories c ON p.category_id = c.id
                            WHERE p.id = ?", [$id]);
        jsonResponse(true, $product);
        break;

    case 'add_product':
        if ($method !== 'POST') jsonResponse(false, null, 'Method not allowed');
        $id = execute(
            "INSERT INTO products (name, description, barcode, category_id, purchase_price, selling_price, stock, min_stock, image_url, is_featured)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                clean($body['name'] ?? ''),
                clean($body['description'] ?? ''),
                clean($body['barcode'] ?? ''),
                (int)($body['category_id'] ?? 0),
                (float)($body['purchase_price'] ?? 0),
                (float)($body['selling_price'] ?? 0),
                (int)($body['stock'] ?? 0),
                (int)($body['min_stock'] ?? 5),
                clean($body['image_url'] ?? ''),
                (bool)($body['is_featured'] ?? false),
            ]
        );
        logActivity('add_product', 'إضافة منتج: ' . ($body['name'] ?? ''));
        jsonResponse(true, ['id' => $id], 'تم إضافة المنتج بنجاح');
        break;

    case 'update_product':
        if ($method !== 'POST') jsonResponse(false, null, 'Method not allowed');
        $id = (int)($body['id'] ?? 0);
        execute(
            "UPDATE products SET name=?, description=?, barcode=?, category_id=?,
             purchase_price=?, selling_price=?, stock=?, min_stock=?, image_url=?, is_featured=?
             WHERE id=?",
            [
                clean($body['name'] ?? ''),
                clean($body['description'] ?? ''),
                clean($body['barcode'] ?? ''),
                (int)($body['category_id'] ?? 0),
                (float)($body['purchase_price'] ?? 0),
                (float)($body['selling_price'] ?? 0),
                (int)($body['stock'] ?? 0),
                (int)($body['min_stock'] ?? 5),
                clean($body['image_url'] ?? ''),
                (bool)($body['is_featured'] ?? false),
                $id,
            ]
        );
        jsonResponse(true, null, 'تم تحديث المنتج بنجاح');
        break;

    case 'delete_product':
        $id = (int)($body['id'] ?? $_GET['id'] ?? 0);
        execute("UPDATE products SET is_active = 0 WHERE id = ?", [$id]);
        jsonResponse(true, null, 'تم حذف المنتج');
        break;

    // ── الفئات ───────────────────────────────────────────────
    case 'get_categories':
        $cats = query("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC");
        jsonResponse(true, $cats);
        break;

    case 'add_category':
        $id = execute(
            "INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)",
            [clean($body['name'] ?? ''), clean($body['icon'] ?? '📦'), clean($body['color'] ?? '#6366f1')]
        );
        jsonResponse(true, ['id' => $id], 'تم إضافة الفئة');
        break;

    // ── الطلبات ──────────────────────────────────────────────
    case 'create_order':
        if ($method !== 'POST') jsonResponse(false, null, 'Method not allowed');

        $db = getDB();
        $db->beginTransaction();

        try {
            $orderNum    = generateOrderNumber();
            $items       = $body['items'] ?? [];
            $subtotal    = 0;
            $discountVal = (float)($body['discount_value'] ?? 0);
            $discountTyp = $body['discount_type'] ?? 'fixed';
            $taxRate     = (float)($body['tax_rate'] ?? TAX_RATE);

            // حساب المجاميع
            foreach ($items as &$item) {
                $product = queryOne("SELECT * FROM products WHERE id = ?", [(int)$item['id']]);
                if (!$product) continue;
                $item['purchase_price'] = $product['purchase_price'];
                $item['unit_price']     = $product['selling_price'];
                $item['total_price']    = $item['unit_price'] * $item['quantity'];
                $subtotal += $item['total_price'];
            }

            $discountAmount = $discountTyp === 'percent'
                ? $subtotal * $discountVal / 100
                : $discountVal;
            $taxAmount = ($subtotal - $discountAmount) * $taxRate / 100;
            $total     = $subtotal - $discountAmount + $taxAmount;
            $amountPaid = (float)($body['amount_paid'] ?? $total);
            $change    = $amountPaid - $total;

            // إدراج الطلب
            $orderId = execute(
                "INSERT INTO orders (order_number, customer_id, customer_name, order_type,
                 delivery_address, subtotal, discount_type, discount_value, discount_amount,
                 tax_rate, tax_amount, total, payment_method, payment_status,
                 amount_paid, change_amount, order_status, notes, cashier_name, order_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())",
                [
                    $orderNum,
                    $body['customer_id'] ?? null,
                    clean($body['customer_name'] ?? 'زبون'),
                    $body['order_type'] ?? 'dine_in',
                    clean($body['delivery_address'] ?? ''),
                    $subtotal, $discountTyp, $discountVal, $discountAmount,
                    $taxRate, $taxAmount, $total,
                    $body['payment_method'] ?? 'cash',
                    $body['payment_status'] ?? 'paid',
                    $amountPaid, max(0, $change),
                    'pending',
                    clean($body['notes'] ?? ''),
                    clean($body['cashier_name'] ?? 'admin'),
                ]
            );

            // إدراج عناصر الطلب + تحديث المخزون
            foreach ($items as $item) {
                execute(
                    "INSERT INTO order_items (order_id, product_id, product_name, quantity,
                     purchase_price, unit_price, total_price, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $orderId, (int)$item['id'], clean($item['name']),
                        (int)$item['quantity'], $item['purchase_price'],
                        $item['unit_price'], $item['total_price'],
                        clean($item['notes'] ?? ''),
                    ]
                );
                // تحديث المخزون
                execute(
                    "UPDATE products SET stock = stock - ?, total_sold = total_sold + ? WHERE id = ?",
                    [(int)$item['quantity'], (int)$item['quantity'], (int)$item['id']]
                );
            }

            // إذا كان دينًا، أضفه لجدول الديون
            if (($body['payment_status'] ?? '') === 'unpaid' || ($body['payment_method'] ?? '') === 'debt') {
                execute(
                    "INSERT INTO debts (customer_name, customer_phone, order_id, original_amount, remaining_amount, status)
                     VALUES (?, ?, ?, ?, ?, 'pending')",
                    [
                        clean($body['customer_name'] ?? 'زبون'),
                        clean($body['customer_phone'] ?? ''),
                        $orderId, $total, $total,
                    ]
                );
            }

            $db->commit();
            logActivity('create_order', "طلب #$orderNum بقيمة $total DH");
            jsonResponse(true, ['order_id' => $orderId, 'order_number' => $orderNum, 'total' => $total, 'change' => max(0, $change)], 'تم إنشاء الطلب بنجاح');

        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(false, null, 'خطأ: ' . $e->getMessage());
        }
        break;

    case 'get_orders':
        $date   = $_GET['date'] ?? date('Y-m-d');
        $period = $_GET['period'] ?? 'day';
        $status = $_GET['status'] ?? '';

        $sql = "SELECT o.*, COUNT(oi.id) as items_count
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id";
        $params = [];

        $sql .= match($period) {
            'week'  => " WHERE YEARWEEK(o.order_date) = YEARWEEK(CURDATE())",
            'month' => " WHERE MONTH(o.order_date) = MONTH(CURDATE()) AND YEAR(o.order_date) = YEAR(CURDATE())",
            default => " WHERE o.order_date = ?"
        };
        if ($period === 'day') $params[] = $date;

        if ($status) {
            $sql .= " AND o.order_status = ?";
            $params[] = $status;
        }

        $sql .= " GROUP BY o.id ORDER BY o.created_at DESC";
        jsonResponse(true, query($sql, $params));
        break;

    case 'get_order_details':
        $id = (int)($_GET['id'] ?? 0);
        $order = queryOne("SELECT * FROM orders WHERE id = ?", [$id]);
        $items = query("SELECT * FROM order_items WHERE order_id = ?", [$id]);
        jsonResponse(true, ['order' => $order, 'items' => $items]);
        break;

    case 'update_order_status':
        $id     = (int)($body['id'] ?? 0);
        $status = clean($body['status'] ?? '');
        execute("UPDATE orders SET order_status = ? WHERE id = ?", [$status, $id]);
        jsonResponse(true, null, 'تم تحديث حالة الطلب');
        break;

    case 'cancel_order':
        $id = (int)($body['id'] ?? 0);
        // استرجاع المخزون
        $items = query("SELECT * FROM order_items WHERE order_id = ?", [$id]);
        foreach ($items as $item) {
            execute("UPDATE products SET stock = stock + ? WHERE id = ?",
                [(int)$item['quantity'], (int)$item['product_id']]);
        }
        execute("UPDATE orders SET order_status = 'cancelled' WHERE id = ?", [$id]);
        jsonResponse(true, null, 'تم إلغاء الطلب واسترجاع المخزون');
        break;

    // ── الديون ───────────────────────────────────────────────
    case 'get_debts':
        $status = $_GET['status'] ?? '';
        $sql = "SELECT * FROM debts";
        $params = [];
        if ($status) { $sql .= " WHERE status = ?"; $params[] = $status; }
        $sql .= " ORDER BY created_at DESC";
        jsonResponse(true, query($sql, $params));
        break;

    case 'add_debt':
        $id = execute(
            "INSERT INTO debts (customer_name, customer_phone, original_amount, remaining_amount, due_date, notes)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                clean($body['customer_name'] ?? ''),
                clean($body['customer_phone'] ?? ''),
                (float)($body['amount'] ?? 0),
                (float)($body['amount'] ?? 0),
                $body['due_date'] ?? null,
                clean($body['notes'] ?? ''),
            ]
        );
        jsonResponse(true, ['id' => $id], 'تم تسجيل الدين');
        break;

    case 'pay_debt':
        $id     = (int)($body['id'] ?? 0);
        $amount = (float)($body['amount'] ?? 0);
        $debt   = queryOne("SELECT * FROM debts WHERE id = ?", [$id]);
        if (!$debt) jsonResponse(false, null, 'الدين غير موجود');

        $newPaid      = $debt['paid_amount'] + $amount;
        $newRemaining = $debt['original_amount'] - $newPaid;
        $status       = $newRemaining <= 0 ? 'paid' : ($newPaid > 0 ? 'partial' : 'pending');

        execute("UPDATE debts SET paid_amount=?, remaining_amount=?, status=? WHERE id=?",
            [$newPaid, max(0, $newRemaining), $status, $id]);
        execute("INSERT INTO debt_payments (debt_id, amount, notes) VALUES (?, ?, ?)",
            [$id, $amount, clean($body['notes'] ?? '')]);

        jsonResponse(true, ['remaining' => max(0, $newRemaining), 'status' => $status], 'تم تسجيل الدفع');
        break;

    // ── العملاء ──────────────────────────────────────────────
    case 'get_customers':
        $search = $_GET['search'] ?? '';
        $sql = "SELECT * FROM customers";
        $params = [];
        if ($search) { $sql .= " WHERE name LIKE ? OR phone LIKE ?"; $params = ["%$search%", "%$search%"]; }
        $sql .= " ORDER BY name ASC";
        jsonResponse(true, query($sql, $params));
        break;

    case 'add_customer':
        $id = execute(
            "INSERT INTO customers (name, phone, email, address, city, notes) VALUES (?, ?, ?, ?, ?, ?)",
            [
                clean($body['name'] ?? ''),
                clean($body['phone'] ?? ''),
                clean($body['email'] ?? ''),
                clean($body['address'] ?? ''),
                clean($body['city'] ?? ''),
                clean($body['notes'] ?? ''),
            ]
        );
        jsonResponse(true, ['id' => $id], 'تم إضافة العميل');
        break;

    // ── الإحصائيات ───────────────────────────────────────────
    case 'get_stats':
        $period = $_GET['period'] ?? 'day';

        $dateFilter = match($period) {
            'week'  => "YEARWEEK(o.order_date) = YEARWEEK(CURDATE())",
            'month' => "MONTH(o.order_date) = MONTH(CURDATE()) AND YEAR(o.order_date) = YEAR(CURDATE())",
            default => "o.order_date = CURDATE()"
        };

        // إجمالي المبيعات
        $sales = queryOne("SELECT
            COUNT(*) as orders_count,
            COALESCE(SUM(total), 0) as total_revenue,
            COALESCE(SUM(discount_amount), 0) as total_discounts
            FROM orders o WHERE $dateFilter AND order_status != 'cancelled'");

        // الربح
        $profit = queryOne("SELECT COALESCE(SUM(oi.profit), 0) as total_profit
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE $dateFilter AND o.order_status != 'cancelled'");

        // أكثر منتج مبيعاً
        $topProducts = query("SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(oi.total_price) as revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE $dateFilter AND o.order_status != 'cancelled'
            GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5");

        // الديون
        $debts = queryOne("SELECT COALESCE(SUM(remaining_amount), 0) as total_debts,
            COUNT(*) as debts_count FROM debts WHERE status != 'paid'");

        // المخزون المنخفض
        $lowStock = query("SELECT name, stock, min_stock FROM products
            WHERE stock <= min_stock AND is_active = 1 ORDER BY stock ASC");

        // مبيعات 7 أيام
        $weeklyData = query("SELECT order_date, SUM(total) as revenue, COUNT(*) as orders
            FROM orders WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            AND order_status != 'cancelled'
            GROUP BY order_date ORDER BY order_date ASC");

        jsonResponse(true, [
            'sales'       => $sales,
            'profit'      => $profit,
            'top_products' => $topProducts,
            'debts'       => $debts,
            'low_stock'   => $lowStock,
            'weekly_data' => $weeklyData,
        ]);
        break;

    // ── المصاريف ─────────────────────────────────────────────
    case 'get_expenses':
        jsonResponse(true, query("SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 50"));
        break;

    case 'add_expense':
        $id = execute(
            "INSERT INTO expenses (title, amount, category, description, expense_date) VALUES (?, ?, ?, ?, ?)",
            [
                clean($body['title'] ?? ''),
                (float)($body['amount'] ?? 0),
                clean($body['category'] ?? 'عام'),
                clean($body['description'] ?? ''),
                $body['date'] ?? date('Y-m-d'),
            ]
        );
        jsonResponse(true, ['id' => $id], 'تم إضافة المصروف');
        break;

    // ── الإعدادات ─────────────────────────────────────────────
    case 'get_settings':
        $settings = query("SELECT setting_key, setting_value FROM settings");
        $result = [];
        foreach ($settings as $s) $result[$s['setting_key']] = $s['setting_value'];
        jsonResponse(true, $result);
        break;

    case 'update_setting':
        execute(
            "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [clean($body['key'] ?? ''), clean($body['value'] ?? ''), clean($body['value'] ?? '')]
        );
        jsonResponse(true, null, 'تم حفظ الإعداد');
        break;

    // ── التحقق من كلمة السر السرية ────────────────────────────
    case 'verify_secret':
        $pass = $body['password'] ?? '';
        $stored = queryOne("SELECT setting_value FROM settings WHERE setting_key = 'secret_password'");
        if ($stored && $stored['setting_value'] === $pass) {
            jsonResponse(true, null, 'تم التحقق');
        } else {
            jsonResponse(false, null, 'كلمة السر غير صحيحة');
        }
        break;

    // ── النسخ الاحتياطي ──────────────────────────────────────
    case 'backup':
        $tables = ['categories', 'products', 'customers', 'orders', 'order_items', 'debts', 'expenses'];
        $backup = [];
        foreach ($tables as $table) {
            $backup[$table] = query("SELECT * FROM $table");
        }
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="backup_' . date('Y-m-d_H-i-s') . '.json"');
        echo json_encode($backup, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;

    default:
        jsonResponse(false, null, 'Action غير معروف: ' . $action);
}
