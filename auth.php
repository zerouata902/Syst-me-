<?php
// ============================================================
// auth.php - نظام تسجيل الدخول
// ============================================================

session_start();
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    case 'login':
        $username = clean($_POST['username'] ?? $body['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $body     = json_decode(file_get_contents('php://input'), true) ?? [];
        $username = clean($body['username'] ?? $username);
        $password = $body['password'] ?? $password;

        $user = queryOne("SELECT * FROM users WHERE username = ? AND is_active = 1", [$username]);

        if ($user && password_verify($password, $user['password'])) {
            // تحديث آخر دخول
            execute("UPDATE users SET last_login = NOW() WHERE id = ?", [$user['id']]);

            $_SESSION['user_id']   = $user['id'];
            $_SESSION['username']  = $user['username'];
            $_SESSION['full_name'] = $user['full_name'];
            $_SESSION['role']      = $user['role'];

            logActivity('login', 'تسجيل دخول ناجح', $user['id']);

            jsonResponse(true, [
                'id'        => $user['id'],
                'username'  => $user['username'],
                'full_name' => $user['full_name'],
                'role'      => $user['role'],
            ], 'مرحباً ' . $user['full_name']);
        } else {
            logActivity('login_failed', "محاولة دخول فاشلة: $username");
            jsonResponse(false, null, 'اسم المستخدم أو كلمة المرور غير صحيحة');
        }
        break;

    case 'logout':
        session_destroy();
        jsonResponse(true, null, 'تم تسجيل الخروج');
        break;

    case 'check':
        if (isset($_SESSION['user_id'])) {
            jsonResponse(true, [
                'id'        => $_SESSION['user_id'],
                'username'  => $_SESSION['username'],
                'full_name' => $_SESSION['full_name'],
                'role'      => $_SESSION['role'],
            ]);
        } else {
            jsonResponse(false, null, 'غير مسجل الدخول');
        }
        break;

    case 'change_password':
        $body    = json_decode(file_get_contents('php://input'), true) ?? [];
        $old     = $body['old_password'] ?? '';
        $new     = $body['new_password'] ?? '';
        $userId  = $_SESSION['user_id'] ?? 0;

        $user = queryOne("SELECT * FROM users WHERE id = ?", [$userId]);
        if ($user && password_verify($old, $user['password'])) {
            $hashed = password_hash($new, PASSWORD_DEFAULT);
            execute("UPDATE users SET password = ? WHERE id = ?", [$hashed, $userId]);
            jsonResponse(true, null, 'تم تغيير كلمة المرور بنجاح');
        } else {
            jsonResponse(false, null, 'كلمة المرور القديمة غير صحيحة');
        }
        break;

    case 'add_user':
        // للمدير فقط
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $hashed = password_hash($body['password'] ?? 'user123', PASSWORD_DEFAULT);
        $id = execute(
            "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
            [
                clean($body['username'] ?? ''),
                $hashed,
                clean($body['full_name'] ?? ''),
                $body['role'] ?? 'worker',
            ]
        );
        jsonResponse(true, ['id' => $id], 'تم إضافة المستخدم');
        break;

    case 'get_users':
        jsonResponse(true, query("SELECT id, username, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC"));
        break;

    default:
        jsonResponse(false, null, 'Action غير معروف');
}
