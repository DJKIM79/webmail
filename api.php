<?php
declare(strict_types=1);
session_start();

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');


// --- DATABASE INITIALIZATION ---
$db_dir = __DIR__ . '/data';
if (!is_dir($db_dir)) {
    mkdir($db_dir, 0770, true);
}

$db_file = $db_dir . '/mail_app.db';
$db = new PDO("sqlite:" . $db_file);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Create table users
$db->exec("CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

// Pre-seed admin user dj / kdjkss
$stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE username = 'dj'");
$stmt->execute();
if ($stmt->fetchColumn() == 0) {
    $hash = password_hash('kdjkss', PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (username, name, password_hash, status, role, group_name) VALUES ('dj', '관리자', :hash, 'approved', 'admin', '기본')");
    $stmt->execute([':hash' => $hash]);
}

// Alter table to add group_name column if not exists
try {
    $db->exec("ALTER TABLE users ADD COLUMN group_name TEXT DEFAULT '기본'");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Alter table to add last_login column if not exists
try {
    $db->exec("ALTER TABLE users ADD COLUMN last_login DATETIME");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Alter table to add profile_pic column if not exists
try {
    $db->exec("ALTER TABLE users ADD COLUMN profile_pic TEXT");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Create table groups
$db->exec("CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

// Migrate existing groups if columns are missing
try {
    $db->exec("ALTER TABLE groups ADD COLUMN color TEXT DEFAULT '#3b82f6'");
} catch (Exception $e) {}
try {
    $db->exec("ALTER TABLE groups ADD COLUMN sort_order INTEGER DEFAULT 0");
} catch (Exception $e) {}
try {
    $db->exec("ALTER TABLE groups ADD COLUMN status TEXT DEFAULT 'approved'");
} catch (Exception $e) {}

// Create table folder_colors to store custom colors and order for folders
$db->exec("CREATE TABLE IF NOT EXISTS folder_colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    folder_name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(username, folder_name)
)");

// Create table mail_filters
$db->exec("CREATE TABLE IF NOT EXISTS mail_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '새 필터',
    filter_from INTEGER DEFAULT 0,
    filter_subject INTEGER DEFAULT 0,
    filter_body INTEGER DEFAULT 0,
    keywords TEXT NOT NULL,
    action TEXT NOT NULL,
    dest_folder TEXT DEFAULT NULL,
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

// Migrate existing mail_filters if title, color, or sort_order are missing
try {
    $db->exec("ALTER TABLE mail_filters ADD COLUMN title TEXT DEFAULT '새 필터'");
} catch (Exception $e) {}
try {
    $db->exec("ALTER TABLE mail_filters ADD COLUMN color TEXT DEFAULT '#3b82f6'");
} catch (Exception $e) {}
try {
    $db->exec("ALTER TABLE mail_filters ADD COLUMN sort_order INTEGER DEFAULT 0");
} catch (Exception $e) {}

// Migrate existing folder_colors if sort_order column is missing
try {
    $db->exec("ALTER TABLE folder_colors ADD COLUMN sort_order INTEGER DEFAULT 0");
} catch (Exception $e) {}

// Insert default system groups
try {
    $db->exec("INSERT OR IGNORE INTO groups (name, color, sort_order) VALUES ('관리자', '#ffffff', -1)");
    $db->exec("INSERT OR IGNORE INTO groups (name, color, sort_order) VALUES ('기본', '#3b82f6', 0)");
    // Force 'dj' into '관리자' group and role 'admin'
    $db->exec("UPDATE users SET group_name = '관리자', role = 'admin' WHERE username = 'dj'");
} catch (Exception $e) {}

// --- HELPER FUNCTIONS ---

function respond(bool $success, string $message, array $data = []): void {
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
    exit;
}

function check_auth(): void {
    if (!isset($_SESSION['username'])) {
        respond(false, '로그인이 필요합니다.');
    }
}

function check_admin(): void {
    check_auth();
    if (($_SESSION['role'] ?? 'user') !== 'admin') {
        respond(false, '관리자 권한이 필요합니다.');
    }
}

// --- SECURE MAIL HELPER SYSTEM (USING SUDO WRAPPER) ---

function secure_list_files(string $username, string $folder_path): array {
    $cmd = "sudo /usr/local/bin/manage_mail_files.sh list " . escapeshellarg($username) . " " . escapeshellarg($folder_path);
    exec($cmd, $output, $return_var);
    if ($return_var !== 0) {
        return [];
    }
    return array_filter(array_map('trim', $output));
}

function secure_read_file(string $username, string $folder, string $filename): ?string {
    $cmd = "sudo /usr/local/bin/manage_mail_files.sh read " . escapeshellarg($username) . " " . escapeshellarg($folder) . " " . escapeshellarg($filename);
    
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];
    $process = proc_open($cmd, $descriptors, $pipes);
    if (is_resource($process)) {
        fclose($pipes[0]);
        $content = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
        return $content;
    }
    return null;
}

function secure_delete_file(string $username, string $folder, string $filename): bool {
    $cmd = "sudo /usr/local/bin/manage_mail_files.sh delete " . escapeshellarg($username) . " " . escapeshellarg($folder) . " " . escapeshellarg($filename);
    exec($cmd, $output, $return_var);
    return $return_var === 0;
}

function secure_move_file(string $username, string $src_folder, string $dest_folder, string $filename, string $dest_filename = ''): bool {
    $cmd = "sudo /usr/local/bin/manage_mail_files.sh move " . escapeshellarg($username) . " " . escapeshellarg($src_folder) . " " . escapeshellarg($dest_folder) . " " . escapeshellarg($filename);
    if ($dest_filename !== '') {
        $cmd .= " " . escapeshellarg($dest_filename);
    }
    exec($cmd, $output, $return_var);
    return $return_var === 0;
}

function secure_write_file(string $username, string $folder, string $filename, string $content): bool {
    $cmd = "sudo /usr/local/bin/manage_mail_files.sh write " . escapeshellarg($username) . " " . escapeshellarg($folder) . " " . escapeshellarg($filename);
    
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];
    
    $process = proc_open($cmd, $descriptors, $pipes);
    if (is_resource($process)) {
        fwrite($pipes[0], $content);
        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $return_var = proc_close($process);
        return $return_var === 0;
    }
    return false;
}

function find_email_path(string $username, string $folder, string $email_id): ?array {
    $sub_paths = [];
    if ($folder === 'INBOX') {
        $sub_paths = ['cur', 'new'];
    } else {
        $sub_paths = ['.' . $folder . '/cur', '.' . $folder . '/new'];
    }
    
    // 1. Try exact match first
    foreach ($sub_paths as $sub) {
        $files = secure_list_files($username, $sub);
        if (in_array($email_id, $files, true)) {
            return ['sub' => $sub, 'id' => $email_id];
        }
    }
    
    // 2. Try base ID match (robustness against renames/flag changes)
    $base_id = explode(':2,', $email_id)[0];
    foreach ($sub_paths as $sub) {
        $files = secure_list_files($username, $sub);
        foreach ($files as $file) {
            if (explode(':2,', $file)[0] === $base_id) {
                return ['sub' => $sub, 'id' => $file];
            }
        }
    }
    
    return null;
}

// Mail Parsing Helpers
function parse_headers(string $header_raw): array {
    $headers = [];
    $lines = explode("\n", $header_raw);
    $current_key = null;
    foreach ($lines as $line) {
        if (preg_match('/^\s+(.*)$/', $line, $matches) && $current_key !== null) {
            $headers[$current_key] .= " " . trim($matches[1]);
        } else {
            $parts = explode(":", $line, 2);
            if (count($parts) === 2) {
                $current_key = strtolower(trim($parts[0]));
                $headers[$current_key] = trim($parts[1]);
            }
        }
    }
    return $headers;
}

function parse_multipart(string $body, string $content_type, string &$html_body, string &$text_body, array &$attachments = []): void {
    if (stripos($content_type, 'multipart/') !== false) {
        if (preg_match('/boundary="?([^";]+)"?/i', $content_type, $m)) {
            $boundary = $m[1];
            $body_parts = explode('--' . $boundary, $body);
            foreach ($body_parts as $part) {
                if (trim($part) === '' || trim($part) === '--') continue;
                
                $sub_parts = explode("\n\n", str_replace("\r", "", $part), 2);
                $sub_header_raw = $sub_parts[0] ?? '';
                $sub_body_raw = $sub_parts[1] ?? '';
                
                $sub_headers = parse_headers($sub_header_raw);
                $sub_type = $sub_headers['content-type'] ?? 'text/plain';
                $sub_encoding = isset($sub_headers['content-transfer-encoding']) ? strtolower($sub_headers['content-transfer-encoding']) : '';
                
                $sub_body = $sub_body_raw;
                if ($sub_encoding === 'base64') {
                    $sub_body = base64_decode($sub_body);
                } elseif ($sub_encoding === 'quoted-printable') {
                    $sub_body = quoted_printable_decode($sub_body);
                }
                
                $disposition = $sub_headers['content-disposition'] ?? '';
                $is_attachment = false;
                $filename = '';
                
                if (stripos($disposition, 'attachment') !== false) {
                    $is_attachment = true;
                    if (preg_match('/filename="?([^";\n\r]+)"?/i', $disposition, $fn)) {
                        $filename = mb_decode_mimeheader(trim($fn[1]));
                    }
                }
                
                if (preg_match('/name="?([^";\n\r]+)"?/i', $sub_type, $fn)) {
                    $is_attachment = true;
                    if (empty($filename)) {
                        $filename = mb_decode_mimeheader(trim($fn[1]));
                    }
                }
                
                if ($is_attachment) {
                    $attachments[] = [
                        'filename' => !empty($filename) ? $filename : 'unnamed_attachment',
                        'content_type' => explode(';', $sub_type)[0],
                        'data' => base64_encode($sub_body),
                        'size' => strlen($sub_body)
                    ];
                } elseif (stripos($sub_type, 'multipart/') !== false) {
                    parse_multipart($sub_body, $sub_type, $html_body, $text_body, $attachments);
                } else {
                    if (preg_match('/charset="?([^";]+)"?/i', $sub_type, $cm)) {
                        $charset = $cm[1];
                        if (strcasecmp($charset, 'utf-8') !== 0) {
                            $converted = @mb_convert_encoding($sub_body, 'UTF-8', $charset);
                            if ($converted !== false) {
                                $sub_body = $converted;
                            }
                        }
                    }
                    
                    if (stripos($sub_type, 'text/html') !== false) {
                        $html_body = $sub_body;
                    } elseif (stripos($sub_type, 'text/plain') !== false) {
                        if (empty($text_body)) {
                            $text_body = $sub_body;
                        }
                    }
                }
            }
        }
    } else {
        if (preg_match('/charset="?([^";]+)"?/i', $content_type, $cm)) {
            $charset = $cm[1];
            if (strcasecmp($charset, 'utf-8') !== 0) {
                $converted = @mb_convert_encoding($body, 'UTF-8', $charset);
                if ($converted !== false) {
                    $body = $converted;
                }
            }
        }
        
        if (stripos($content_type, 'text/html') !== false) {
            $html_body = $body;
        } else {
            $text_body = $body;
        }
    }
}

function parse_email_header_from_content(string $content, string $filename, string $folder): ?array {
    // Split header and body
    $parts = explode("\n\n", str_replace("\r", "", $content), 2);
    $header_raw = $parts[0] ?? '';
    $body_raw = $parts[1] ?? '';

    $headers = parse_headers($header_raw);

    $subject = isset($headers['subject']) ? mb_decode_mimeheader($headers['subject']) : '(제목 없음)';
    $from = isset($headers['from']) ? mb_decode_mimeheader($headers['from']) : '';
    $to = isset($headers['to']) ? mb_decode_mimeheader($headers['to']) : '';
    $cc = isset($headers['cc']) ? mb_decode_mimeheader($headers['cc']) : '';
    $date = isset($headers['date']) ? $headers['date'] : '';
    
    $seen = false;
    $flagged = false;
    // Seen detection based on suffix
    $info_part = explode(':2,', $filename);
    if (isset($info_part[1])) {
        if (strpos($info_part[1], 'S') !== false) {
            $seen = true;
        }
        if (strpos($info_part[1], 'F') !== false) {
            $flagged = true;
        }
    }
    
    $ts_parts = explode('.', $filename);
    $timestamp = is_numeric($ts_parts[0]) ? (int)$ts_parts[0] : time();
    
    // Quick snippet extraction (handling encoding and multiparts)
    $content_type = $headers['content-type'] ?? 'text/plain';
    $encoding = isset($headers['content-transfer-encoding']) ? strtolower($headers['content-transfer-encoding']) : '';
    
    $body = $body_raw;
    if ($encoding === 'base64') {
        $body = base64_decode($body);
    } elseif ($encoding === 'quoted-printable') {
        $body = quoted_printable_decode($body);
    }
    
    $html_body = '';
    $text_body = '';
    $attachments = [];
    parse_multipart($body, $content_type, $html_body, $text_body, $attachments);
    
    $snippet_text = !empty($text_body) ? $text_body : strip_tags($html_body);
    $snippet_text = html_entity_decode($snippet_text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $snippet_text = preg_replace('/\s+/', ' ', $snippet_text);
    $snippet = mb_substr(trim($snippet_text), 0, 80, 'UTF-8');
    
    return [
        'id' => $filename,
        'subject' => $subject,
        'from' => $from,
        'to' => $to,
        'cc' => $cc,
        'date' => $date,
        'timestamp' => $timestamp,
        'seen' => $seen,
        'flagged' => $flagged,
        'snippet' => $snippet,
        'folder' => $folder
    ];
}

function parse_email_from_content(string $content, string $filename, string $folder): ?array {
    $parts = explode("\n\n", str_replace("\r", "", $content), 2);
    $header_raw = $parts[0] ?? '';
    $body_raw = $parts[1] ?? '';
    
    $headers = parse_headers($header_raw);
    
    $subject = isset($headers['subject']) ? mb_decode_mimeheader($headers['subject']) : '(제목 없음)';
    $from = isset($headers['from']) ? mb_decode_mimeheader($headers['from']) : '';
    $to = isset($headers['to']) ? mb_decode_mimeheader($headers['to']) : '';
    $cc = isset($headers['cc']) ? mb_decode_mimeheader($headers['cc']) : '';
    $date = isset($headers['date']) ? $headers['date'] : '';
    
    $seen = false;
    $flagged = false;
    $info_part = explode(':2,', $filename);
    if (isset($info_part[1])) {
        if (strpos($info_part[1], 'S') !== false) {
            $seen = true;
        }
        if (strpos($info_part[1], 'F') !== false) {
            $flagged = true;
        }
    }
    
    $ts_parts = explode('.', $filename);
    $timestamp = is_numeric($ts_parts[0]) ? (int)$ts_parts[0] : time();
    
    $content_type = $headers['content-type'] ?? 'text/plain';
    $encoding = isset($headers['content-transfer-encoding']) ? strtolower($headers['content-transfer-encoding']) : '';
    
    $body = $body_raw;
    if ($encoding === 'base64') {
        $body = base64_decode($body);
    } elseif ($encoding === 'quoted-printable') {
        $body = quoted_printable_decode($body);
    }
    
    $html_body = '';
    $text_body = '';
    $attachments = [];
    
    parse_multipart($body, $content_type, $html_body, $text_body, $attachments);
    
    $display_body = !empty($html_body) ? $html_body : nl2br(htmlspecialchars($text_body));
    
    return [
        'id' => $filename,
        'subject' => $subject,
        'from' => $from,
        'to' => $to,
        'cc' => $cc,
        'date' => $date,
        'timestamp' => $timestamp,
        'seen' => $seen,
        'flagged' => $flagged,
        'body' => $display_body,
        'text_body' => $text_body,
        'html_body' => $html_body,
        'attachments' => $attachments,
        'folder' => $folder
    ];
}

function apply_mail_filters(string $username, PDO $db): void {
    // 1. Get user's filters
    $stmt = $db->prepare("SELECT * FROM mail_filters WHERE username = :username ORDER BY id ASC");
    $stmt->execute([':username' => $username]);
    $filters = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($filters)) {
        return;
    }
    
    // 2. Scan for new files
    $new_files = secure_list_files($username, 'new');
    if (empty($new_files)) {
        return;
    }
    
    foreach ($new_files as $file) {
        $content = secure_read_file($username, 'new', $file);
        if (!$content) {
            continue;
        }
        
        $email = parse_email_from_content($content, $file, 'INBOX');
        if (!$email) {
            continue;
        }
        
        $email_from = $email['from'];
        $email_subject = $email['subject'];
        $email_body = !empty($email['text_body']) ? $email['text_body'] : strip_tags($email['html_body']);
        
        foreach ($filters as $filter) {
            $match_text = '';
            if ($filter['filter_from']) {
                $match_text .= ' ' . $email_from;
            }
            if ($filter['filter_subject']) {
                $match_text .= ' ' . $email_subject;
            }
            if ($filter['filter_body']) {
                $match_text .= ' ' . $email_body;
            }
            
            // Split keywords by comma or space
            $keywords = preg_split('/[\s,]+/', trim($filter['keywords']), -1, PREG_SPLIT_NO_EMPTY);
            $is_matched = false;
            
            foreach ($keywords as $kw) {
                if (empty($kw)) continue;
                if (mb_stripos($match_text, $kw) !== false) {
                    $is_matched = true;
                    break;
                }
            }
            
            if ($is_matched) {
                $action = $filter['action'];
                $dest_folder = $filter['dest_folder'];
                
                if ($action === 'delete') {
                    // Delete (move to Trash)
                    secure_move_file($username, 'new', '.Trash/cur', $file);
                } elseif ($action === 'move' && !empty($dest_folder)) {
                    // Move to destination tag/folder
                    $dest_sub = ($dest_folder === 'INBOX') ? 'cur' : '.' . $dest_folder . '/cur';
                    secure_move_file($username, 'new', $dest_sub, $file);
                } elseif ($action === 'copy' && !empty($dest_folder)) {
                    // Copy to destination tag/folder
                    $dest_sub = ($dest_folder === 'INBOX') ? 'cur' : '.' . $dest_folder . '/cur';
                    $new_filename = time() . '.' . uniqid() . '.onto.kr:2,';
                    secure_write_file($username, $dest_sub, $new_filename, $content);
                    
                    // Keep original in INBOX/cur with proper Maildir suffix
                    $parts = explode(':2,', $file);
                    $orig_dest_name = $parts[0] . ':2,';
                    secure_move_file($username, 'new', 'cur', $file, $orig_dest_name);
                } elseif ($action === 'star') {
                    // Star (flag) the email and move to INBOX/cur
                    $parts = explode(':2,', $file);
                    $base_name = $parts[0];
                    $flags = $parts[1] ?? '';
                    if (strpos($flags, 'F') === false) {
                        $flags .= 'F';
                    }
                    $new_filename = $base_name . ':2,' . $flags;
                    secure_move_file($username, 'new', 'cur', $file, $new_filename);
                }
                
                // Mail processed, break from filter check for this file
                break;
            }
        }
    }
}

// --- ROUTING ---


$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_status':
        if (isset($_SESSION['username'])) {
            $stmt = $db->prepare("SELECT * FROM users WHERE username = :username");
            $stmt->execute([':username' => $_SESSION['username']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            respond(true, 'Logged in', [
                'user' => [
                    'username' => $_SESSION['username'],
                    'name' => $_SESSION['name'],
                    'role' => $_SESSION['role'],
                    'profile_pic' => $user['profile_pic'] ?? null
                ]
            ]);
        } else {
            respond(false, 'Not logged in');
        }
        break;

    case 'login':
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $keep = !empty($_POST['keep']);
        
        if (empty($username) || empty($password)) {
            respond(false, '아이디와 암호를 입력해주세요.');
        }
        
        $stmt = $db->prepare("SELECT * FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(false, '아이디 또는 암호가 잘못되었습니다.');
        }
        
        if ($user['status'] === 'pending') {
            respond(false, '이미 승인 요청 중입니다.');
        } elseif ($user['status'] === 'rejected') {
            respond(false, '승인이 거절된 상태입니다. 관리자에게 문의하여 주십시오.');
        } elseif ($user['status'] === 'locked') {
            respond(false, 'locked');
        }
        
        $_SESSION['username'] = $user['username'];
        $_SESSION['name'] = $user['name'];
        $_SESSION['role'] = $user['role'];

        // Update last login
        try {
            $stmtUpdate = $db->prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = :id");
            $stmtUpdate->execute([':id' => $user['id']]);
        } catch (PDOException $e) {
            // Ignore error
        }

        if ($keep) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                session_id(),
                time() + 86400 * 30, // 30 days
                $params['path'],
                $params['domain'],
                $params['secure'] ?? true,
                $params['httponly'] ?? true
            );
        }
        
        respond(true, '로그인 성공', [
            'user' => [
                'username' => $user['username'],
                'name' => $user['name'],
                'role' => $user['role'],
                'profile_pic' => $user['profile_pic'] ?? null
            ]
        ]);
        break;

    case 'logout':
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"] ?? true,
                $params["httponly"] ?? true
            );
        }
        session_destroy();
        respond(true, '로그아웃 되었습니다.');
        break;

    case 'register':
        $username = trim($_POST['username'] ?? '');
        $name = trim($_POST['name'] ?? '');
        $password = $_POST['password'] ?? '';
        $captcha = trim($_POST['captcha'] ?? '');
        
        // Bot check
        if (!isset($_SESSION['captcha_answer']) || (int)$captcha !== (int)$_SESSION['captcha_answer']) {
            respond(false, '봇 방지 질문의 답이 올바르지 않습니다.');
        }
        
        if (!empty($_POST['email_honeypot'] ?? '')) {
            respond(false, '봇 탐지됨.');
        }
        
        $load_time = (int)($_POST['form_load_time'] ?? 0);
        if (time() - $load_time < 2) {
            respond(false, '너무 빠른 전송입니다. 잠시 후 다시 시도하세요.');
        }
        
        if (empty($username) || empty($name) || empty($password)) {
            respond(false, '모든 필수 항목을 입력해주세요.');
        }
        
        if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $username)) {
            respond(false, '아이디는 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능합니다.');
        }
        
        $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        if ($stmt->fetchColumn() > 0) {
            respond(false, '이미 존재하는 아이디입니다.');
        }
        
        $hash = password_hash($password, PASSWORD_BCRYPT);
        
        $stmt = $db->prepare("INSERT INTO users (username, name, password_hash, status, role) VALUES (:username, :name, :hash, 'pending', 'user')");
        $stmt->execute([
            ':username' => $username,
            ':name' => $name,
            ':hash' => $hash
        ]);
        
        // Mail notification
        $admin_email = 'dj@onto.kr';
        $subject = "🆕 회원 가입 승인 요청: $username";
        $email_body = "새로운 사용자가 가입 승인을 요청했습니다.\n\n" .
                      "아이디: {$username}@onto.kr\n" .
                      "이름: {$name}\n\n" .
                      "메일 클라이언트 관리자 모드에서 승인할 수 있습니다.\n" .
                      "https://mail.onto.kr/\n";
        
        $headers = "From: webmaster@onto.kr\r\nContent-Type: text/plain; charset=UTF-8\r\n";
        mail($admin_email, "=?UTF-8?B?" . base64_encode($subject) . "?=", $email_body, $headers, "-f webmaster@onto.kr");
        
        respond(true, '가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.');
        break;

    case 'list_emails':
        check_auth();
        $username = $_SESSION['username'];
        $folder = $_GET['folder'] ?? 'INBOX';
        
        // Apply mail filtering rules on new emails
        apply_mail_filters($username, $db);

        
        if (!in_array($folder, ['INBOX', 'Sent', 'Drafts', 'Trash', 'Starred'], true) && !preg_match('/^[a-zA-Z0-9_\-\x{ac00}-\x{d7a3}\x{3130}-\x{318f}]+$/u', $folder)) {
            respond(false, '잘못된 폴더입니다.');
        }
        
        $emails = [];
        if ($folder === 'Starred') {
            // Aggregate all flagged/starred emails from all folders
            $tags = [];
            $cmd = "sudo /usr/local/bin/manage_mail_files.sh list_tags " . escapeshellarg($username);
            exec($cmd, $output, $return_var);
            if ($return_var === 0) {
                foreach ($output as $line) {
                    $line = trim($line);
                    if ($line === '' || $line === '.' || $line === '..') continue;
                    if ($line[0] === '.') {
                        $tag_name = substr($line, 1);
                        if (!in_array($tag_name, ['Sent', 'Trash', 'Drafts'], true)) {
                            $tags[] = $tag_name;
                        }
                    }
                }
            }
            
            $all_folders = array_merge(['INBOX', 'Sent', 'Drafts', 'Trash'], $tags);
            foreach ($all_folders as $f) {
                $sub_paths = ($f === 'INBOX') ? ['new', 'cur'] : ['.' . $f . '/new', '.' . $f . '/cur'];
                foreach ($sub_paths as $sub_path) {
                    $files = secure_list_files($username, $sub_path);
                    foreach ($files as $file) {
                        $is_flagged = false;
                        $parts = explode(':2,', $file);
                        if (count($parts) > 1 && strpos($parts[1], 'F') !== false) {
                            $is_flagged = true;
                        }
                        if ($is_flagged) {
                            $content = secure_read_file($username, $sub_path, $file);
                            if ($content) {
                                $header = parse_email_header_from_content($content, $file, $f);
                                if ($header) {
                                    $emails[] = $header;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            $sub_paths = ($folder === 'INBOX') ? ['new', 'cur'] : ['.' . $folder . '/new', '.' . $folder . '/cur'];
            foreach ($sub_paths as $sub_path) {
                $files = secure_list_files($username, $sub_path);
                foreach ($files as $file) {
                    $content = secure_read_file($username, $sub_path, $file);
                    if ($content) {
                        $header = parse_email_header_from_content($content, $file, $folder);
                        if ($header) {
                            $emails[] = $header;
                        }
                    }
                }
            }
        }
        
        usort($emails, fn($a, $b) => $b['timestamp'] - $a['timestamp']);
        respond(true, '성공', ['emails' => $emails]);
        break;

    case 'read_email':
        check_auth();
        $username = $_SESSION['username'];
        $folder = $_GET['folder'] ?? 'INBOX';
        $email_id = $_GET['id'] ?? '';

        if (empty($email_id)) {
            respond(false, '이메일 ID가 누락되었습니다.');
        }

        $path_info = find_email_path($username, $folder, $email_id);
        if (!$path_info) {
            respond(false, '이메일을 찾을 수 없습니다.');
        }

        $src_sub = $path_info['sub'];
        $email_id = $path_info['id'];
        $in_new = (strpos($src_sub, '/new') !== false || $src_sub === 'new');
        $content = secure_read_file($username, $src_sub, $email_id);

        if ($content === null || trim($content) === 'File not found') {
            respond(false, '이메일을 읽을 수 없습니다.');
        }

        $new_id = $email_id;
        $dest_sub = ($folder === 'INBOX') ? 'cur' : '.' . $folder . '/cur';
        $need_rename = false;
        
        if ($in_new) {
            $need_rename = true;
            if (strpos($email_id, ':2,') === false) {
                $new_id .= ':2,S';
            } else {
                $parts = explode(':2,', $email_id);
                if (strpos($parts[1], 'S') === false) {
                    $new_id = $parts[0] . ':2,' . $parts[1] . 'S';
                }
            }
        } else {
            if (strpos($email_id, ':2,') === false) {
                $need_rename = true;
                $new_id .= ':2,S';
            } else {
                $parts = explode(':2,', $email_id);
                if (strpos($parts[1], 'S') === false) {
                    $need_rename = true;
                    $new_id = $parts[0] . ':2,' . $parts[1] . 'S';
                }
            }
        }
        
        if ($need_rename) {
            secure_move_file($username, $src_sub, $dest_sub, $email_id, $new_id);
            $content = secure_read_file($username, $dest_sub, $new_id);
        }
        
        if ($content) {
            $email = parse_email_from_content($content, $new_id, $folder);
            if ($email) {
                respond(true, '성공', ['email' => $email]);
            } else {
                respond(false, '이메일 분석 실패.');
            }
        } else {
            respond(false, '이메일을 찾을 수 없습니다.');
        }
        break;

    case 'delete_email':
        check_auth();
        $username = $_SESSION['username'];
        $folder = $_POST['folder'] ?? 'INBOX';
        $email_id = $_POST['id'] ?? '';
        
        if (empty($email_id)) {
            respond(false, '이메일 ID가 누락되었습니다.');
        }
        
        $path_info = find_email_path($username, $folder, $email_id);
        if (!$path_info) {
            respond(false, '이메일을 찾을 수 없습니다.');
        }
        
        $found_sub = $path_info['sub'];
        $email_id = $path_info['id'];
        
        if ($folder === 'Trash') {
            if (secure_delete_file($username, $found_sub, $email_id)) {
                respond(true, '이메일이 영구 삭제되었습니다.');
            } else {
                respond(false, '삭제에 실패했습니다.');
            }
        } else {
            if (secure_move_file($username, $found_sub, '.Trash/cur', $email_id)) {
                respond(true, '이메일이 휴지통으로 이동되었습니다.');
            } else {
                respond(false, '휴지통 이동에 실패했습니다.');
            }
        }
        break;

    case 'send_email':
        check_auth();
        $username = $_SESSION['username'];
        $to = trim($_POST['to'] ?? '');
        $subject = trim($_POST['subject'] ?? '');
        $body = $_POST['body'] ?? '';
        
        if (empty($to) || empty($subject) || empty($body)) {
            respond(false, '받는 사람, 제목, 내용을 모두 입력해주세요.');
        }
        
        $from = $username . '@onto.kr';
        
        $mixed_boundary = "----=_Mixed_Part_" . md5(uniqid((string)rand(), true));
        $alt_boundary = "----=_Alt_Part_" . md5(uniqid((string)rand(), true));
        
        $headers = "From: $from\r\n";
        $headers .= "Reply-To: $from\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: multipart/mixed; boundary=\"$mixed_boundary\"\r\n";
        
        $encoded_subject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
        
        $message = "--$mixed_boundary\r\n";
        $message .= "Content-Type: multipart/alternative; boundary=\"$alt_boundary\"\r\n\r\n";
        
        $message .= "--$alt_boundary\r\n";
        $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode($body)) . "\r\n";
        
        $html_body = nl2br(htmlspecialchars($body));
        $message .= "--$alt_boundary\r\n";
        $message .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $message .= chunk_split(base64_encode($html_body)) . "\r\n";
        
        $message .= "--$alt_boundary--\r\n\r\n";
        
        if (isset($_FILES['attachments']) && is_array($_FILES['attachments']['name'])) {
            $file_count = count($_FILES['attachments']['name']);
            for ($i = 0; $i < $file_count; $i++) {
                if ($_FILES['attachments']['error'][$i] === UPLOAD_ERR_OK) {
                    $tmp_name = $_FILES['attachments']['tmp_name'][$i];
                    $file_name = $_FILES['attachments']['name'][$i];
                    $file_size = $_FILES['attachments']['size'][$i];
                    $file_type = $_FILES['attachments']['type'][$i];
                    
                    if (is_uploaded_file($tmp_name)) {
                        $file_content = file_get_contents($tmp_name);
                        $encoded_content = chunk_split(base64_encode($file_content));
                        $encoded_filename = "=?UTF-8?B?" . base64_encode($file_name) . "?=";
                        
                        $message .= "--$mixed_boundary\r\n";
                        $message .= "Content-Type: $file_type; name=\"$encoded_filename\"\r\n";
                        $message .= "Content-Disposition: attachment; filename=\"$encoded_filename\"\r\n";
                        $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
                        $message .= $encoded_content . "\r\n";
                    }
                }
            }
        }
        
        $message .= "--$mixed_boundary--\r\n";
        
        $success = mail($to, $encoded_subject, $message, $headers, "-f $from");
        
        if ($success) {
            $filename = time() . ".M" . rand(100000, 999999) . "P" . getmypid() . "." . gethostname() . ":2,S";
            $full_email_content = "From: $from\r\nTo: $to\r\nSubject: $encoded_subject\r\nDate: " . date('r') . "\r\n" . $headers . "\r\n" . $message;
            
            secure_write_file($username, '.Sent/cur', $filename, $full_email_content);
            respond(true, '메일이 성공적으로 전송되었습니다.');
        } else {
            respond(false, '메일 발송에 실패했습니다.');
        }
        break;

    case 'empty_trash':
        check_auth();
        $username = $_SESSION['username'];
        
        $sub_paths = ['.Trash/cur', '.Trash/new'];
        $success_count = 0;
        $failed_count = 0;
        foreach ($sub_paths as $sub) {
            $files = secure_list_files($username, $sub);
            foreach ($files as $file) {
                if (secure_delete_file($username, $sub, $file)) {
                    $success_count++;
                } else {
                    $failed_count++;
                }
            }
        }
        respond(true, '휴지통을 성공적으로 비웠습니다.');
        break;

    // --- ADMIN ACTIONS ---
    
    case 'admin_list_users':
        check_admin();
        $stmt = $db->query("SELECT id, username, name, status, role, group_name, last_login FROM users ORDER BY id ASC");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(true, '성공', ['users' => $users]);
        break;

    case 'admin_list_groups':
        check_admin();
        $stmt = $db->query("SELECT * FROM groups ORDER BY CASE WHEN name = '관리자' THEN 0 WHEN name = '기본' THEN 1 ELSE 2 END, sort_order ASC, name ASC");
        $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(true, '성공', ['groups' => $groups]);
        break;

    case 'admin_rename_group':
        check_admin();
        $old_name = trim($_POST['old_name'] ?? '');
        $new_name = trim($_POST['new_name'] ?? '');
        if (empty($old_name) || empty($new_name)) {
            respond(false, '이름이 필요합니다.');
        }
        if ($old_name === '관리자') {
            respond(false, '관리자 그룹 이름은 변경할 수 없습니다.');
        }
        if (!preg_match('/^[a-zA-Z0-9_\-가-힣\s]+$/u', $new_name)) {
            respond(false, '그룹 이름은 영문, 숫자, 한글, 밑줄(_), 하이픈(-)만 사용 가능합니다.');
        }

        try {
            $db->beginTransaction();
            
            // Update users group names
            $stmt = $db->query("SELECT id, group_name FROM users");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($users as $u) {
                $groups = array_filter(array_map('trim', explode(',', $u['group_name'] ?? '')));
                if (($key = array_search($old_name, $groups)) !== false) {
                    $groups[$key] = $new_name;
                    $new_group_name_str = implode(', ', $groups);
                    $stmt2 = $db->prepare("UPDATE users SET group_name = :group_name WHERE id = :id");
                    $stmt2->execute([':group_name' => $new_group_name_str, ':id' => $u['id']]);
                }
            }

            // Update group name in groups table
            $stmt = $db->prepare("UPDATE groups SET name = :new_name WHERE name = :old_name");
            $stmt->execute([':new_name' => $new_name, ':old_name' => $old_name]);
            
            $db->commit();
            respond(true, '그룹 이름이 변경되었습니다.');
        } catch (Exception $e) {
            $db->rollBack();
            respond(false, '이미 존재하는 그룹 이름이거나 변경에 실패했습니다.');
        }
        break;

    case 'admin_set_group_color':
        check_admin();
        $name = trim($_POST['name'] ?? '');
        $color = trim($_POST['color'] ?? '');
        if (empty($name) || empty($color)) {
            respond(false, '필수 항목 누락');
        }
        $stmt = $db->prepare("UPDATE groups SET color = :color WHERE name = :name");
        $stmt->execute([':color' => $color, ':name' => $name]);
        respond(true, '색상이 변경되었습니다.');
        break;

    case 'admin_update_group_order':
        check_admin();
        $order = json_decode($_POST['order'] ?? '[]', true);
        if (empty($order)) {
            respond(false, '순서 정보가 없습니다.');
        }
        
        try {
            $db->beginTransaction();
            $stmt = $db->prepare("UPDATE groups SET sort_order = :idx WHERE name = :name");
            foreach ($order as $idx => $name) {
                $stmt->execute([':idx' => $idx, ':name' => $name]);
            }
            $db->commit();
            respond(true, '순서가 저장되었습니다.');
        } catch (Exception $e) {
            $db->rollBack();
            respond(false, '순서 저장 실패');
        }
        break;

    case 'admin_create_group':
        check_admin();
        $name = trim($_POST['name'] ?? '');
        if (empty($name)) {
            respond(false, '그룹 이름을 입력해주세요.');
        }
        if (!preg_match('/^[a-zA-Z0-9_\-가-힣\s]+$/u', $name)) {
            respond(false, '그룹 이름은 영문, 숫자, 한글, 밑줄(_), 하이픈(-)만 사용 가능합니다.');
        }
        
        try {
            $stmt = $db->prepare("INSERT INTO groups (name) VALUES (:name)");
            $stmt->execute([':name' => $name]);
            respond(true, '그룹이 추가되었습니다.');
        } catch (PDOException $e) {
            respond(false, '이미 존재하는 그룹 이름입니다.');
        }
        break;

    case 'admin_delete_group':
        check_admin();
        $name = trim($_POST['name'] ?? '');
        if ($name === '기본' || $name === '관리자') {
            respond(false, '기본 또는 관리자 그룹은 삭제할 수 없습니다.');
        }
        
        // Update users in this group: remove the deleted group name from their comma-separated list
        $stmt = $db->query("SELECT id, group_name FROM users");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($users as $u) {
            $groups = array_filter(array_map('trim', explode(',', $u['group_name'] ?? '')));
            if (($key = array_search($name, $groups)) !== false) {
                unset($groups[$key]);
                if (empty($groups)) {
                    $groups[] = '기본';
                }
                $new_group_name = implode(', ', $groups);
                $stmt2 = $db->prepare("UPDATE users SET group_name = :group_name WHERE id = :id");
                $stmt2->execute([':group_name' => $new_group_name, ':id' => $u['id']]);
            }
        }
        
        // Delete group
        $stmt = $db->prepare("DELETE FROM groups WHERE name = :name");
        $stmt->execute([':name' => $name]);
        
        respond(true, '그룹이 삭제되었으며 소속 회원들의 해당 그룹 정보가 해제되었습니다.');
        break;

    case 'admin_lock_group':
        check_admin();
        $name = trim($_POST['name'] ?? '');
        if (empty($name)) {
            respond(false, '그룹 이름이 필요합니다.');
        }
        if ($name === '관리자') {
            respond(false, '관리자 그룹은 잠글 수 없습니다.');
        }

        try {
            $db->beginTransaction();
            
            // 1. Update group status
            $stmt = $db->prepare("UPDATE groups SET status = 'locked' WHERE name = :name");
            $stmt->execute([':name' => $name]);

            // 2. Get all approved users in this group (except admins)
            $stmt = $db->prepare("SELECT username FROM users WHERE INSTR(', ' || group_name || ', ', ', ' || :name || ', ') > 0 AND status = 'approved' AND role != 'admin' AND username != 'dj'");
            $stmt->execute([':name' => $name]);
            $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            foreach ($users as $uname) {
                $email = $uname . '@onto.kr';
                $cmd = "sudo /usr/local/bin/manage_mail_user.sh lock " . escapeshellarg($email);
                exec($cmd);
            }
            
            // 3. Update their status to locked
            $stmt = $db->prepare("UPDATE users SET status = 'locked' WHERE INSTR(', ' || group_name || ', ', ', ' || :name || ', ') > 0 AND status = 'approved' AND role != 'admin' AND username != 'dj'");
            $stmt->execute([':name' => $name]);
            
            $db->commit();
            respond(true, '그룹 상태가 잠금으로 변경되었으며, 해당 그룹 내 일반 회원들의 계정이 잠금 처리되었습니다.');
        } catch (Exception $e) {
            $db->rollBack();
            respond(false, '잠금 처리 중 오류가 발생했습니다.');
        }
        break;

    case 'admin_unlock_group':
        check_admin();
        $name = trim($_POST['name'] ?? '');
        if (empty($name)) {
            respond(false, '그룹 이름이 필요합니다.');
        }

        try {
            $db->beginTransaction();
            
            // 1. Update group status to approved
            $stmt = $db->prepare("UPDATE groups SET status = 'approved' WHERE name = :name");
            $stmt->execute([':name' => $name]);

            // 2. Find all locked users in this group (except admins)
            $stmt = $db->prepare("SELECT id, username, group_name FROM users WHERE INSTR(', ' || group_name || ', ', ', ' || :name || ', ') > 0 AND status = 'locked' AND role != 'admin' AND username != 'dj'");
            $stmt->execute([':name' => $name]);
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 3. For each user, check if they belong to ANY OTHER locked group
            $all_groups_stmt = $db->query("SELECT name FROM groups WHERE status = 'locked'");
            $locked_groups = $all_groups_stmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($users as $user) {
                $u_groups = array_filter(array_map('trim', explode(',', $user['group_name'] ?? '')));
                $still_locked = false;
                foreach ($u_groups as $ug) {
                    if ($ug === $name) continue; // Skip current group
                    if (in_array($ug, $locked_groups)) {
                        $still_locked = true;
                        break;
                    }
                }

                if (!$still_locked) {
                    // Unlock only if no other groups are locked
                    $email = $user['username'] . '@onto.kr';
                    $cmd = "sudo /usr/local/bin/manage_mail_user.sh unlock " . escapeshellarg($email);
                    exec($cmd);

                    $stmt_upd = $db->prepare("UPDATE users SET status = 'approved' WHERE id = :id");
                    $stmt_upd->execute([':id' => $user['id']]);
                }
            }
            
            $db->commit();
            respond(true, '그룹 상태가 해제되었으며, 다른 잠긴 그룹에 속하지 않은 회원들의 계정이 활성화되었습니다.');
        } catch (Exception $e) {
            $db->rollBack();
            respond(false, '해제 처리 중 오류가 발생했습니다.');
        }
        break;

    case 'admin_update_user_group':
        check_admin();
        $id = (int)($_POST['id'] ?? 0);
        $group_names_str = trim($_POST['group_names'] ?? $_POST['group_name'] ?? '');
        
        if (empty($group_names_str)) {
            respond(false, '그룹 이름이 필요합니다.');
        }
        
        $groups_array = array_filter(array_map('trim', explode(',', $group_names_str)));
        if (empty($groups_array)) {
            respond(false, '최소 하나의 그룹을 지정해야 합니다.');
        }
        
        // Verify all groups exist
        foreach ($groups_array as $gname) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM groups WHERE name = :name");
            $stmt->execute([':name' => $gname]);
            if ($stmt->fetchColumn() == 0) {
                respond(false, '존재하지 않는 그룹이 포함되어 있습니다: ' . $gname);
            }
        }
        
        $new_group_name = implode(', ', $groups_array);
        $stmt = $db->prepare("UPDATE users SET group_name = :group_name WHERE id = :id");
        $stmt->execute([':group_name' => $new_group_name, ':id' => $id]);
        
        respond(true, '회원의 그룹이 변경되었습니다.');
        break;

    case 'request_unlock':
        $username = trim($_POST['username'] ?? '');
        if (empty($username)) {
            respond(false, '아이디가 누락되었습니다.');
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            respond(false, '존재하지 않는 사용자입니다.');
        }

        if ($user['status'] !== 'locked') {
            respond(false, '잠금 상태인 계정만 해제 요청이 가능합니다.');
        }

        // Update status to pending so admin sees it as an approval request
        $stmt = $db->prepare("UPDATE users SET status = 'pending', status_updated_at = CURRENT_TIMESTAMP WHERE username = :username");
        $stmt->execute([':username' => $username]);

        // Mail notification to admin
        $admin_email = 'dj@onto.kr';
        $subject = "🔓 계정 잠금 해제 요청: $username";
        $email_body = "다음 사용자가 계정 잠금 해제를 요청했습니다.\n\n" .
                      "아이디: {$username}@onto.kr\n" .
                      "이름: {$user['name']}\n\n" .
                      "메일 클라이언트 관리자 모드에서 승인하여 잠금을 해제할 수 있습니다.\n" .
                      "https://mail.onto.kr/\n";

        $headers = "From: webmaster@onto.kr\r\nReply-To: webmaster@onto.kr\r\nContent-Type: text/plain; charset=UTF-8\r\n";
        mail($admin_email, "=?UTF-8?B?" . base64_encode($subject) . "?=", $email_body, $headers, "-f webmaster@onto.kr");

        respond(true, '잠금 해제 요청이 접수되어 관리자에게 전송되었습니다.');
        break;

    case 'admin_approve':
        check_admin();
        $id = (int)($_POST['id'] ?? 0);

        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            respond(false, '사용자를 찾을 수 없습니다.');
        }

        if ($user['status'] === 'approved') {
            respond(false, '이미 승인된 사용자입니다.');
        }

        $email = $user['username'] . '@onto.kr';
        $cmd = "sudo /usr/local/bin/manage_mail_user.sh add " . escapeshellarg($email) . " " . escapeshellarg($user['password_hash']);

        exec($cmd, $output, $return_val);
        if ($return_val !== 0) {
            respond(false, '메일 시스템 설정 실패: ' . implode("\n", $output));
        }

        $stmt = $db->prepare("UPDATE users SET status = 'approved', status_updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $stmt->execute([':id' => $id]);

        respond(true, '사용자가 승인되었습니다. 메일 계정이 활성화되었습니다.');
        break;

    case 'admin_reject':
        check_admin();
        $id = (int)($_POST['id'] ?? 0);

        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            respond(false, '사용자를 찾을 수 없습니다.');
        }

        if ($user['username'] === 'dj') {
            respond(false, '관리자 계정은 거절할 수 없습니다.');
        }

        $stmt = $db->prepare("UPDATE users SET status = 'rejected', status_updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $stmt->execute([':id' => $id]);

        respond(true, '사용자 승인이 거부되었습니다.');
        break;

    case 'admin_lock':
        check_admin();
        $id = (int)($_POST['id'] ?? 0);
        
        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            respond(false, '사용자를 찾을 수 없습니다.');
        }
        
        if ($user['username'] === 'dj') {
            respond(false, '관리자 본인 계정은 잠글 수 없습니다.');
        }
        
        $email = $user['username'] . '@onto.kr';
        $cmd = "sudo /usr/local/bin/manage_mail_user.sh lock " . escapeshellarg($email);
        
        exec($cmd, $output, $return_val);
        
        $stmt = $db->prepare("UPDATE users SET status = 'locked' WHERE id = :id");
        $stmt->execute([':id' => $id]);
        
        respond(true, '사용자 계정이 잠금 처리되었습니다.');
        break;

    case 'admin_unlock':
        check_admin();
        $id = (int)($_POST['id'] ?? 0);
        
        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            respond(false, '사용자를 찾을 수 없습니다.');
        }
        
        $email = $user['username'] . '@onto.kr';
        $cmd = "sudo /usr/local/bin/manage_mail_user.sh unlock " . escapeshellarg($email);
        
        exec($cmd, $output, $return_val);
        
        $stmt = $db->prepare("UPDATE users SET status = 'approved' WHERE id = :id");
        $stmt->execute([':id' => $id]);
        
        respond(true, '사용자 계정 잠금이 해제되었습니다.');
        break;

    case 'admin_delete':
        check_admin();
        $id = (int)($_POST['id'] ?? 0);
        
        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            respond(false, '사용자를 찾을 수 없습니다.');
        }
        
        if ($user['username'] === 'dj') {
            respond(false, '관리자 본인 계정은 삭제할 수 없습니다.');
        }
        
        // 1. Delete physical mail data and server settings via shell script
        $email = $user['username'] . '@onto.kr';
        $cmd = "sudo /usr/local/bin/manage_mail_user.sh delete " . escapeshellarg($email);
        
        $output = [];
        $return_val = 0;
        exec($cmd, $output, $return_val);
        
        // 2. Delete user record from database (includes profile_pic Base64)
        $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        
        if ($return_val === 0) {
            respond(true, '사용자 계정 및 모든 관련 데이터(메일, 폴더 등)가 영구 삭제되었습니다.');
        } else {
            respond(true, '사용자 계정은 삭제되었으나, 일부 물리 데이터 삭제 중 오류가 발생했을 수 있습니다. 관리자에게 문의하세요.');
        }
        break;

    case 'admin_create_user':
        check_admin();
        $username = trim($_POST['username'] ?? '');
        $name = trim($_POST['name'] ?? '');
        $password = $_POST['password'] ?? '';
        $group_names_str = trim($_POST['group_name'] ?? '기본');
        
        if (empty($username) || empty($name) || empty($password)) {
            respond(false, '모든 필수 항목을 입력해주세요.');
        }
        
        if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $username)) {
            respond(false, '아이디는 영문, 숫자, 밑줄(_), 하이픈(-)만 사용 가능합니다.');
        }
        
        $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        if ($stmt->fetchColumn() > 0) {
            respond(false, '이미 존재하는 아이디입니다.');
        }
        
        // Validate group names
        $groups_array = array_filter(array_map('trim', explode(',', $group_names_str)));
        if (empty($groups_array)) {
            $groups_array = ['기본'];
        }
        foreach ($groups_array as $gname) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM groups WHERE name = :name");
            $stmt->execute([':name' => $gname]);
            if ($stmt->fetchColumn() == 0) {
                respond(false, '존재하지 않는 그룹이 포함되어 있습니다: ' . $gname);
            }
        }
        $group_name_final = implode(', ', $groups_array);
        
        $hash = password_hash($password, PASSWORD_BCRYPT);
        
        $stmt = $db->prepare("INSERT INTO users (username, name, password_hash, status, role, group_name) VALUES (:username, :name, :hash, 'approved', 'user', :group_name)");
        $stmt->execute([
            ':username' => $username,
            ':name' => $name,
            ':hash' => $hash,
            ':group_name' => $group_name_final
        ]);
        
        $email = $username . '@onto.kr';
        $cmd = "sudo /usr/local/bin/manage_mail_user.sh add " . escapeshellarg($email) . " " . escapeshellarg($hash);
        exec($cmd, $output, $return_val);
        if ($return_val !== 0) {
            respond(false, '사용자는 등록되었으나 메일 시스템 설정에 실패했습니다.');
        }
        
        respond(true, '사용자가 성공적으로 추가 및 활성화되었습니다.');
        break;

    case 'list_tags':
        check_auth();
        $username = $_SESSION['username'];
        $cmd = "sudo /usr/local/bin/manage_mail_files.sh list_tags " . escapeshellarg($username);
        exec($cmd, $output, $return_var);
        $tags = [];
        
        // Fetch saved colors and order from database
        $stmt = $db->prepare("SELECT folder_name, color, sort_order FROM folder_colors WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $folder_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $colors = [];
        $orders = [];
        foreach ($folder_data as $row) {
            $colors[$row['folder_name']] = $row['color'];
            $orders[$row['folder_name']] = $row['sort_order'];
        }
        
        if ($return_var === 0) {
            foreach ($output as $line) {
                $line = trim($line);
                if ($line === '' || $line === '.' || $line === '..') continue;
                if ($line[0] === '.') {
                    $tag_name = substr($line, 1);
                    if (!in_array($tag_name, ['Sent', 'Trash', 'Drafts'], true)) {
                        $tags[] = [
                            'name' => $tag_name,
                            'color' => $colors[$tag_name] ?? null,
                            'sort_order' => $orders[$tag_name] ?? 9999
                        ];
                    }
                }
            }
        }
        
        // Sort tags based on sort_order and name
        usort($tags, function($a, $b) {
            if ($a['sort_order'] !== $b['sort_order']) {
                return $a['sort_order'] - $b['sort_order'];
            }
            return strcmp($a['name'], $b['name']);
        });
        
        respond(true, '성공', ['tags' => $tags]);
        break;

    case 'update_tag_order':
        check_auth();
        $username = $_SESSION['username'];
        $order = json_decode($_POST['order'] ?? '[]', true);
        if (empty($order)) {
            respond(false, '순서 정보가 없습니다.');
        }
        
        try {
            $db->beginTransaction();
            foreach ($order as $idx => $tag_name) {
                $stmt = $db->prepare("INSERT INTO folder_colors (username, folder_name, color, sort_order) 
                                     VALUES (:username, :folder_name, '#3b82f6', :idx) 
                                     ON CONFLICT(username, folder_name) DO UPDATE SET sort_order = EXCLUDED.sort_order");
                $stmt->execute([
                    ':username' => $username,
                    ':folder_name' => $tag_name,
                    ':idx' => $idx
                ]);
            }
            $db->commit();
            respond(true, '순서가 저장되었습니다.');
        } catch (Exception $e) {
            $db->rollBack();
            respond(false, '순서 저장 실패: ' . $e->getMessage());
        }
        break;

    case 'set_folder_color':
        check_auth();
        $username = $_SESSION['username'];
        $folder_name = trim($_POST['folder_name'] ?? '');
        $color = trim($_POST['color'] ?? '');
        
        if (empty($folder_name) || empty($color)) {
            respond(false, '필수 항목이 누락되었습니다.');
        }
        
        $stmt = $db->prepare("INSERT INTO folder_colors (username, folder_name, color) VALUES (:username, :folder_name, :color) 
                             ON CONFLICT(username, folder_name) DO UPDATE SET color = EXCLUDED.color");
        $stmt->execute([
            ':username' => $username,
            ':folder_name' => $folder_name,
            ':color' => $color
        ]);
        
        respond(true, '폴더 색상이 저장되었습니다.');
        break;

    case 'create_tag':
        check_auth();
        $username = $_SESSION['username'];
        $tag_name = trim($_POST['tag_name'] ?? '');
        
        if (empty($tag_name)) {
            respond(false, '폴더 이름을 입력하세요.');
        }
        
        if (!preg_match('/^[\p{L}\p{N}_\-]+$/u', $tag_name)) {
            respond(false, '폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-)만 가능합니다.');
        }
        
        $folder_path = '.' . $tag_name;
        $cmd = "sudo /usr/local/bin/manage_mail_files.sh create " . escapeshellarg($username) . " " . escapeshellarg($folder_path);
        exec($cmd, $output, $return_val);
        
        if ($return_val === 0) {
            respond(true, '개인 폴더가 성공적으로 생성되었습니다.');
        } else {
            respond(false, '개인 폴더 생성에 실패했습니다.');
        }
        break;
 
    case 'delete_tag':
        check_auth();
        $username = $_SESSION['username'];
        $tag_name = trim($_POST['tag_name'] ?? '');
        
        if (empty($tag_name)) {
            respond(false, '폴더 이름을 입력하세요.');
        }
        
        if (in_array($tag_name, ['INBOX', 'Sent', 'Drafts', 'Trash'], true)) {
            respond(false, '기본 폴더는 삭제할 수 없습니다.');
        }
        
        if (!preg_match('/^[\p{L}\p{N}_\-]+$/u', $tag_name)) {
            respond(false, '폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-)만 가능합니다.');
        }
        
        $folder_path = '.' . $tag_name;
        $cmd = "sudo /usr/local/bin/manage_mail_files.sh delete_tag " . escapeshellarg($username) . " " . escapeshellarg($folder_path);
        exec($cmd, $output, $return_val);
        
        if ($return_val === 0) {
            respond(true, '개인 폴더가 삭제되었습니다.');
        } else {
            respond(false, '개인 폴더 삭제에 실패했습니다.');
        }
        break;

    case 'move_email':
        check_auth();
        $username = $_SESSION['username'];
        $email_id = $_POST['id'] ?? '';
        $src_folder = $_POST['folder'] ?? 'INBOX';
        $dest_folder = $_POST['dest_folder'] ?? '';

        if (empty($email_id) || empty($dest_folder)) {
            respond(false, '필수 인자가 누락되었습니다.');
        }

        $path_info = find_email_path($username, $src_folder, $email_id);
        if (!$path_info) {
            respond(false, '이메일을 찾을 수 없습니다.');
        }

        $src_sub = $path_info['sub'];
        $email_id = $path_info['id'];
        $dest_sub = ($dest_folder === 'INBOX') ? 'cur' : '.' . $dest_folder . '/cur';

        if (secure_move_file($username, $src_sub, $dest_sub, $email_id)) {
            respond(true, '이메일이 성공적으로 이동되었습니다.');
        } else {
            respond(false, '이메일 이동에 실패했습니다.');
        }
        break;

    case 'update_profile':
        check_auth();
        $username = $_SESSION['username'];
        $name = trim($_POST['name'] ?? '');
        $password = $_POST['password'] ?? '';
        $profile_pic = $_POST['profile_pic'] ?? null;
        
        if (empty($name)) {
            respond(false, '이름을 입력해주세요.');
        }
        
        $sql = "UPDATE users SET name = :name";
        $params = [':name' => $name, ':username' => $username];
        
        if ($profile_pic !== null) {
            $sql .= ", profile_pic = :profile_pic";
            $params[':profile_pic'] = $profile_pic;
        }
        
        if (!empty($password)) {
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $sql .= ", password_hash = :hash";
            $params[':hash'] = $hash;
            
            $email = $username . '@onto.kr';
            $cmd = "sudo /usr/local/bin/manage_mail_user.sh passwd " . escapeshellarg($email) . " " . escapeshellarg($hash);
            exec($cmd);
        }
        
        $sql .= " WHERE username = :username";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        $_SESSION['name'] = $name;
        
        respond(true, '개인 설정이 성공적으로 저장되었습니다.', [
            'profile_pic' => $profile_pic
        ]);
        break;

    case 'toggle_flag':
        check_auth();
        $username = $_SESSION['username'];
        $folder = $_POST['folder'] ?? 'INBOX';
        $email_id = $_POST['id'] ?? '';

        if (empty($email_id)) {
            respond(false, '이메일 ID가 누락되었습니다.');
        }

        $path_info = find_email_path($username, $folder, $email_id);
        if (!$path_info) {
            respond(false, '이메일을 찾을 수 없습니다.');
        }

        $found_sub = $path_info['sub'];
        $email_id = $path_info['id'];

        $parts = explode(':2,', $email_id);
        $base_name = $parts[0];
        $flags = $parts[1] ?? '';

        $is_flagged = (strpos($flags, 'F') !== false);
        if ($is_flagged) {
            $new_flags = str_replace('F', '', $flags);
        } else {
            $new_flags = $flags . 'F';
        }

        $new_id = $base_name . ':2,' . $new_flags;

        if (secure_move_file($username, $found_sub, $found_sub, $email_id, $new_id)) {
            respond(true, '성공', ['new_id' => $new_id, 'flagged' => !$is_flagged]);
        } else {
            respond(false, '플래그 변경에 실패했습니다.');
        }
        break;

    case 'list_filters':
        check_auth();
        $username = $_SESSION['username'];
        $stmt = $db->prepare("SELECT * FROM mail_filters WHERE username = :username ORDER BY sort_order ASC, id ASC");
        $stmt->execute([':username' => $username]);
        $filters = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(true, '성공', ['filters' => $filters]);
        break;

    case 'create_filter':
        check_auth();
        $username = $_SESSION['username'];
        $title = trim($_POST['title'] ?? '');
        $filter_from = isset($_POST['filter_from']) ? (int)$_POST['filter_from'] : 0;
        $filter_subject = isset($_POST['filter_subject']) ? (int)$_POST['filter_subject'] : 0;
        $filter_body = isset($_POST['filter_body']) ? (int)$_POST['filter_body'] : 0;
        $keywords = trim($_POST['keywords'] ?? '');
        $action_val = trim($_POST['action_val'] ?? '');
        $dest_folder = trim($_POST['dest_folder'] ?? '');

        if (empty($title)) {
            respond(false, '필터 제목을 입력하세요.');
        }
        if ($filter_from === 0 && $filter_subject === 0 && $filter_body === 0) {
            respond(false, '검색 대상(보낸이, 제목, 내용)을 최소 하나 이상 선택해야 합니다.');
        }
        if (empty($keywords)) {
            respond(false, '검색할 키워드를 입력하세요.');
        }
        if (empty($action_val) || !in_array($action_val, ['delete', 'move', 'copy', 'star'], true)) {
            respond(false, '올바른 작업을 선택하세요.');
        }
        if (($action_val === 'move' || $action_val === 'copy') && empty($dest_folder)) {
            respond(false, '이동 또는 복사할 보관함을 선택하세요.');
        }

        // Get max sort_order
        $stmt = $db->prepare("SELECT MAX(sort_order) FROM mail_filters WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $max_order = (int)$stmt->fetchColumn();

        $stmt = $db->prepare("INSERT INTO mail_filters (username, title, filter_from, filter_subject, filter_body, keywords, action, dest_folder, sort_order) VALUES (:username, :title, :filter_from, :filter_subject, :filter_body, :keywords, :action, :dest_folder, :sort_order)");
        $stmt->execute([
            ':username' => $username,
            ':title' => $title,
            ':filter_from' => $filter_from,
            ':filter_subject' => $filter_subject,
            ':filter_body' => $filter_body,
            ':keywords' => $keywords,
            ':action' => $action_val,
            ':dest_folder' => empty($dest_folder) ? null : $dest_folder,
            ':sort_order' => $max_order + 1
        ]);

        respond(true, '필터가 생성되었습니다.');
        break;

    case 'update_filter':
        check_auth();
        $username = $_SESSION['username'];
        $filter_id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $title = trim($_POST['title'] ?? '');
        $filter_from = isset($_POST['filter_from']) ? (int)$_POST['filter_from'] : 0;
        $filter_subject = isset($_POST['filter_subject']) ? (int)$_POST['filter_subject'] : 0;
        $filter_body = isset($_POST['filter_body']) ? (int)$_POST['filter_body'] : 0;
        $keywords = trim($_POST['keywords'] ?? '');
        $action_val = trim($_POST['action_val'] ?? '');
        $dest_folder = trim($_POST['dest_folder'] ?? '');

        if ($filter_id <= 0) {
            respond(false, '잘못된 필터 ID입니다.');
        }
        if (empty($title)) {
            respond(false, '필터 제목을 입력하세요.');
        }
        if ($filter_from === 0 && $filter_subject === 0 && $filter_body === 0) {
            respond(false, '검색 대상(보낸이, 제목, 내용)을 최소 하나 이상 선택해야 합니다.');
        }
        if (empty($keywords)) {
            respond(false, '검색할 키워드를 입력하세요.');
        }
        if (empty($action_val) || !in_array($action_val, ['delete', 'move', 'copy', 'star'], true)) {
            respond(false, '올바른 작업을 선택하세요.');
        }
        if (($action_val === 'move' || $action_val === 'copy') && empty($dest_folder)) {
            respond(false, '이동 또는 복사할 보관함을 선택하세요.');
        }

        $stmt = $db->prepare("UPDATE mail_filters SET title = :title, filter_from = :filter_from, filter_subject = :filter_subject, filter_body = :filter_body, keywords = :keywords, action = :action, dest_folder = :dest_folder WHERE id = :id AND username = :username");
        $stmt->execute([
            ':id' => $filter_id,
            ':username' => $username,
            ':title' => $title,
            ':filter_from' => $filter_from,
            ':filter_subject' => $filter_subject,
            ':filter_body' => $filter_body,
            ':keywords' => $keywords,
            ':action' => $action_val,
            ':dest_folder' => empty($dest_folder) ? null : $dest_folder
        ]);

        respond(true, '필터가 수정되었습니다.');
        break;

    case 'update_filter_order':
        check_auth();
        $username = $_SESSION['username'];
        $order_json = $_POST['order'] ?? '';
        $order = json_decode($order_json, true);

        if (!is_array($order)) {
            respond(false, '올바르지 않은 정렬 데이터입니다.');
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare("UPDATE mail_filters SET sort_order = :sort_order WHERE id = :id AND username = :username");
            foreach ($order as $index => $id) {
                $stmt->execute([
                    ':sort_order' => $index,
                    ':id' => (int)$id,
                    ':username' => $username
                ]);
            }
            $db->commit();
            respond(true, '정렬이 변경되었습니다.');
        } catch (Exception $e) {
            $db->rollBack();
            respond(false, '정렬 변경에 실패했습니다: ' . $e->getMessage());
        }
        break;

    case 'set_filter_color':
        check_auth();
        $username = $_SESSION['username'];
        $filter_id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $color = trim($_POST['color'] ?? '');

        if ($filter_id <= 0 || empty($color)) {
            respond(false, '올바르지 않은 요청입니다.');
        }

        $stmt = $db->prepare("UPDATE mail_filters SET color = :color WHERE id = :id AND username = :username");
        $stmt->execute([
            ':color' => $color,
            ':id' => $filter_id,
            ':username' => $username
        ]);

        respond(true, '필터 색상이 변경되었습니다.');
        break;

    case 'delete_filter':
        check_auth();
        $username = $_SESSION['username'];
        $filter_id = isset($_POST['id']) ? (int)$_POST['id'] : 0;

        if ($filter_id <= 0) {
            respond(false, '잘못된 필터 ID입니다.');
        }

        $stmt = $db->prepare("DELETE FROM mail_filters WHERE id = :id AND username = :username");
        $stmt->execute([
            ':id' => $filter_id,
            ':username' => $username
        ]);

        respond(true, '필터가 삭제되었습니다.');
        break;

    default:

        respond(false, '잘못된 요청입니다.');
        break;
}
