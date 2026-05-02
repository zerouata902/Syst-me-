<?php
// ============================================================
// db.php - الاتصال بقاعدة البيانات
// ============================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');          // ← غير هذا
define('DB_PASS', '');              // ← غير هذا
define('DB_NAME', 'pos_system');
define('DB_CHARSET', 'utf8mb4');

// إعدادات النظام
define('CURRENCY', 'DH');
define('SHOP_NAME', 'كافيه النخبة');
define('TAX_RATE', 0);              // نسبة الضريبة %
define('SECRET_PASSWORD', 'secret2024'); // كلمة سر اللوحة السرية

// الاتصال بقاعدة البيانات
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode([
                'success' => false,
                'message' => 'خطأ في الاتصال بقاعدة البيانات: ' . $e->getMessage()
            ]));
        }
    }
    return $pdo;
}

// دالة مساعدة للاستعلام
function query(string $sql, array $params = []): array {
    $stmt = getDB()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

// دالة للاستعلام عن صف واحد
function queryOne(string $sql, array $params = []): ?array {
    $stmt = getDB()->prepare($sql);
    $stmt->execute($params);
    $result = $stmt->fetch();
    return $result ?: null;
}

// دالة للتعديل/الحذف/الإضافة
function execute(string $sql, array $params = []): int {
    $stmt = getDB()->prepare($sql);
    $stmt->execute($params);
    return (int) getDB()->lastInsertId() ?: $stmt->rowCount();
}

// إرجاع JSON
function jsonResponse(bool $success, $data = null, string $message = ''): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => $success,
        'data'    => $data,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// تنظيف المدخلات
function clean(string $input): string {
    return htmlspecialchars(strip_tags(trim($input)));
}

// توليد رقم طلب
function generateOrderNumber(): string {
    $date = date('Ymd');
    $count = queryOne("SELECT COUNT(*) as cnt FROM orders WHERE order_date = CURDATE()");
    $seq = ($count['cnt'] ?? 0) + 1;
    return 'ORD-' . $date . '-' . str_pad($seq, 3, '0', STR_PAD_LEFT);
}

// تسجيل العملية
function logActivity(string $action, string $details = '', int $userId = 0): void {
    execute(
        "INSERT INTO activity_logs (user_id, user_name, action, details, ip_address) VALUES (?, ?, ?, ?, ?)",
        [$userId, 'system', $action, $details, $_SERVER['REMOTE_ADDR'] ?? '']
    );
}

// السماح بالطلبات من أي مصدر (للتطوير)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
