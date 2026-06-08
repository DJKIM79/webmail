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

// Alter table to add theme column if not exists
try {
    $db->exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'gray'");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Alter table to add profile_pic column if not exists
try {
    $db->exec("ALTER TABLE users ADD COLUMN profile_pic TEXT");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Alter table to add signature columns if not exists
try {
    $db->exec("ALTER TABLE users ADD COLUMN use_signature INTEGER DEFAULT 0");
} catch (PDOException $e) {
    // Ignore error if column already exists
}
try {
    $db->exec("ALTER TABLE users ADD COLUMN signature TEXT");
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

// Create table external_mail_accounts
$db->exec("CREATE TABLE IF NOT EXISTS external_mail_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    service_type TEXT NOT NULL,
    imap_host TEXT,
    imap_port INTEGER,
    imap_ssl TEXT,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_ssl TEXT,
    mail_username TEXT,
    mail_password TEXT,
    color TEXT DEFAULT '#3b82f6',
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    smtp_auth INTEGER DEFAULT 1,
    external_images TEXT DEFAULT 'ask',
    external_links TEXT DEFAULT 'ask',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

// Migrate existing external_mail_accounts for smtp_auth
try {
    $db->exec("ALTER TABLE external_mail_accounts ADD COLUMN smtp_auth INTEGER DEFAULT 1");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Migrate existing external_mail_accounts for external_images
try {
    $db->exec("ALTER TABLE external_mail_accounts ADD COLUMN external_images TEXT DEFAULT 'ask'");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Migrate existing external_mail_accounts for external_links
try {
    $db->exec("ALTER TABLE external_mail_accounts ADD COLUMN external_links TEXT DEFAULT 'ask'");
} catch (PDOException $e) {
    // Ignore error if column already exists
}

// Create table external_folders to store folder status for external accounts
$db->exec("CREATE TABLE IF NOT EXISTS external_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    type TEXT DEFAULT 'custom',
    is_hidden INTEGER DEFAULT 0,
    UNIQUE(account_id, path)
)");

// Create table cached_emails
$db->exec("CREATE TABLE IF NOT EXISTS cached_emails (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    folder TEXT NOT NULL,
    filename TEXT NOT NULL,
    subject TEXT,
    `from` TEXT,
    `to` TEXT,
    cc TEXT,
    date TEXT,
    timestamp INTEGER,
    seen INTEGER DEFAULT 0,
    flagged INTEGER DEFAULT 0,
    snippet TEXT,
    account_id INTEGER DEFAULT 0,
    account_color TEXT,
    account_email TEXT
)");
try {
    $db->exec("CREATE INDEX IF NOT EXISTS idx_cached_emails_username_folder ON cached_emails(username, folder)");
} catch (Exception $e) {}

// Create table mail_filters
$db->exec("CREATE TABLE IF NOT EXISTS mail_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '새 필터',
    filter_from INTEGER DEFAULT 0,
    filter_subject INTEGER DEFAULT 0,
    filter_body INTEGER DEFAULT 0,
    keywords TEXT NOT NULL,
    match_all INTEGER DEFAULT 0,
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
try {
    $db->exec("ALTER TABLE mail_filters ADD COLUMN match_all INTEGER DEFAULT 0");
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

// Create table auto_senders
try {
    $db->exec("CREATE TABLE IF NOT EXISTS auto_senders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        name TEXT,
        email TEXT NOT NULL,
        UNIQUE(username, email)
    )");
} catch (Exception $e) {}

// Create table address_book
try {
    $db->exec("CREATE TABLE IF NOT EXISTS address_book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        group_name TEXT NOT NULL DEFAULT '미정',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, email)
    )");
} catch (Exception $e) {}

// Create table address_groups
try {
    $db->exec("CREATE TABLE IF NOT EXISTS address_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, name)
    )");
} catch (Exception $e) {}

try {
    $db->exec("ALTER TABLE address_groups ADD COLUMN color TEXT DEFAULT '#3b82f6'");
} catch (Exception $e) {}
try {
    $db->exec("ALTER TABLE address_groups ADD COLUMN sort_order INTEGER DEFAULT 0");
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
function sync_folder_cache(string $username, string $folder, PDO $db): void {
    $sub_paths = ($folder === 'INBOX') ? ['new', 'cur'] : ['.' . $folder . '/new', '.' . $folder . '/cur'];
    
    // 1. Get current files in directories
    $all_files = [];
    $file_sub_paths = [];
    foreach ($sub_paths as $sub_path) {
        $files = secure_list_files($username, $sub_path);
        foreach ($files as $file) {
            $all_files[] = $file;
            $file_sub_paths[$file] = $sub_path;
        }
    }
    
    // 2. Get currently cached emails for this folder
    $stmt = $db->prepare("SELECT filename, id FROM cached_emails WHERE username = :username AND folder = :folder");
    $stmt->execute([':username' => $username, ':folder' => $folder]);
    $cached = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $cached_map = [];
    foreach ($cached as $c) {
        $cached_map[$c['filename']] = $c['id'];
    }
    
    // 3. Compare to find deleted files
    $files_in_dir = array_flip($all_files);
    $to_delete = [];
    foreach ($cached_map as $filename => $id) {
        if (!isset($files_in_dir[$filename])) {
            $to_delete[] = $id;
        }
    }
    
    if (!empty($to_delete)) {
        $placeholders = implode(',', array_fill(0, count($to_delete), '?'));
        $stmt = $db->prepare("DELETE FROM cached_emails WHERE id IN ($placeholders)");
        $stmt->execute($to_delete);
    }
    
    // 4. Find new files to cache (fast placeholder insertion based on filename flags)
    $to_insert = [];
    foreach ($all_files as $file) {
        if (!isset($cached_map[$file])) {
            $seen = 0;
            $flagged = 0;
            
            $info_part = explode(':2,', $file);
            if (isset($info_part[1])) {
                if (strpos($info_part[1], 'S') !== false) {
                    $seen = 1;
                }
                if (strpos($info_part[1], 'F') !== false) {
                    $flagged = 1;
                }
            }
            
            $ts_parts = explode('.', $file);
            $timestamp = is_numeric($ts_parts[0]) ? (int)$ts_parts[0] : time();
            
            $to_insert[] = [
                'filename' => $file,
                'seen' => $seen,
                'flagged' => $flagged,
                'timestamp' => $timestamp
            ];
        }
    }
    
    if (!empty($to_insert)) {
        $stmt = $db->prepare("INSERT OR REPLACE INTO cached_emails 
            (id, username, folder, filename, subject, `from`, `to`, cc, date, timestamp, seen, flagged, snippet, account_id, account_color, account_email) 
            VALUES (:id, :username, :folder, :filename, NULL, NULL, NULL, NULL, NULL, :timestamp, :seen, :flagged, NULL, 0, '#3b82f6', '')");
        foreach ($to_insert as $em) {
            $stmt->execute([
                ':id' => $em['filename'],
                ':username' => $username,
                ':folder' => $folder,
                ':filename' => $em['filename'],
                ':timestamp' => $em['timestamp'],
                ':seen' => $em['seen'],
                ':flagged' => $em['flagged']
            ]);
        }
    }
}

function get_emails_in_folder(string $username, string $folder, PDO $db): array {
    sync_folder_cache($username, $folder, $db);
    
    // Resolve any placeholders that are missing headers
    $stmt = $db->prepare("SELECT filename FROM cached_emails WHERE username = :username AND folder = :folder AND subject IS NULL");
    $stmt->execute([':username' => $username, ':folder' => $folder]);
    $placeholders = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (!empty($placeholders)) {
        $sub_paths = ($folder === 'INBOX') ? ['new', 'cur'] : ['.' . $folder . '/new', '.' . $folder . '/cur'];
        foreach ($placeholders as $file) {
            $sub_path = (strpos($file, ':2,') !== false) ? 
                (($folder === 'INBOX') ? 'cur' : '.' . $folder . '/cur') :
                (($folder === 'INBOX') ? 'new' : '.' . $folder . '/new');
                
            $content = secure_read_file($username, $sub_path, $file);
            if ($content) {
                $header = parse_email_header_from_content($content, $file, $folder);
                if ($header) {
                    $stmtUpdate = $db->prepare("UPDATE cached_emails SET 
                        subject = :subject, `from` = :from, `to` = :to, cc = :cc, date = :date, snippet = :snippet 
                        WHERE id = :id");
                    $stmtUpdate->execute([
                        ':id' => $file,
                        ':subject' => $header['subject'],
                        ':from' => $header['from'],
                        ':to' => $header['to'],
                        ':cc' => $header['cc'],
                        ':date' => $header['date'],
                        ':snippet' => $header['snippet']
                    ]);
                }
            }
        }
    }
    
    $stmt = $db->prepare("SELECT id, subject, `from`, `to`, cc, date, timestamp, seen, flagged, snippet, folder FROM cached_emails WHERE username = :username AND folder = :folder");
    $stmt->execute([':username' => $username, ':folder' => $folder]);
    $emails = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($emails as &$em) {
        $em['seen'] = (int)$em['seen'];
        $em['flagged'] = (int)$em['flagged'];
    }
    return $emails;
}

function get_emails_in_folder_paginated(string $username, string $folder, int $offset, int $limit, PDO $db): array {
    sync_folder_cache($username, $folder, $db);
    
    // Fetch slice filenames first
    $stmt = $db->prepare("SELECT filename, subject FROM cached_emails 
                          WHERE username = :username AND folder = :folder 
                          ORDER BY timestamp DESC, id DESC LIMIT :limit OFFSET :offset");
    $stmt->bindValue(':username', $username, PDO::PARAM_STR);
    $stmt->bindValue(':folder', $folder, PDO::PARAM_STR);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $slice = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Resolve placeholders ONLY for this slice
    $sub_paths = ($folder === 'INBOX') ? ['new', 'cur'] : ['.' . $folder . '/new', '.' . $folder . '/cur'];
    foreach ($slice as $item) {
        if ($item['subject'] === null) {
            $file = $item['filename'];
            $sub_path = (strpos($file, ':2,') !== false) ? 
                (($folder === 'INBOX') ? 'cur' : '.' . $folder . '/cur') :
                (($folder === 'INBOX') ? 'new' : '.' . $folder . '/new');
                
            $content = secure_read_file($username, $sub_path, $file);
            if ($content) {
                $header = parse_email_header_from_content($content, $file, $folder);
                if ($header) {
                    $stmtUpdate = $db->prepare("UPDATE cached_emails SET 
                        subject = :subject, `from` = :from, `to` = :to, cc = :cc, date = :date, snippet = :snippet 
                        WHERE id = :id");
                    $stmtUpdate->execute([
                        ':id' => $file,
                        ':subject' => $header['subject'],
                        ':from' => $header['from'],
                        ':to' => $header['to'],
                        ':cc' => $header['cc'],
                        ':date' => $header['date'],
                        ':snippet' => $header['snippet']
                    ]);
                }
            }
        }
    }
    
    // Fetch slice with full metadata
    $stmt = $db->prepare("SELECT id, subject, `from`, `to`, cc, date, timestamp, seen, flagged, snippet, folder 
                          FROM cached_emails 
                          WHERE username = :username AND folder = :folder 
                          ORDER BY timestamp DESC, id DESC LIMIT :limit OFFSET :offset");
    $stmt->bindValue(':username', $username, PDO::PARAM_STR);
    $stmt->bindValue(':folder', $folder, PDO::PARAM_STR);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $emails = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($emails as &$em) {
        $em['seen'] = (int)$em['seen'];
        $em['flagged'] = (int)$em['flagged'];
    }
    
    // Total count of emails in folder
    $stmtCount = $db->prepare("SELECT COUNT(*) FROM cached_emails WHERE username = :username AND folder = :folder");
    $stmtCount->execute([':username' => $username, ':folder' => $folder]);
    $total = (int)$stmtCount->fetchColumn();
    
    return ['emails' => $emails, 'total' => $total];
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

/**
 * Robustly decode a MIME-encoded email header.
 * Handles:
 *  - =?UTF-8?B?...?= / =?UTF-8?Q?...?=
 *  - =?EUC-KR?B?...?= / =?ks_c_5601-1987?...?=
 *  - Raw UTF-8 text (no encoding wrapper)
 *  - Broken/mixed strings
 */
function robust_decode_header(string $value): string {
    if (trim($value) === '') return $value;

    // Check if there are any MIME encoded words at all
    if (strpos($value, '=?') === false) {
        // No MIME encoding — treat as raw text.
        // If it's valid UTF-8, return as-is.
        if (mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }
        // Try EUC-KR -> UTF-8 conversion
        $converted = @mb_convert_encoding($value, 'UTF-8', 'EUC-KR');
        return ($converted !== false && mb_check_encoding($converted, 'UTF-8')) ? $converted : $value;
    }

    // Normalize charset aliases before decoding
    $value = preg_replace_callback(
        '/=\?(ks_c_5601[-_]1987|ks_c_5601|ksc_5601[-_]1987|ksc_5601|euc-kr|euckr)\?([BbQq])\?([^?]*)\?=/i',
        function($m) {
            $encoding = strtoupper($m[2]);
            $data = $m[3];
            $decoded = ($encoding === 'B') ? base64_decode($data) : quoted_printable_decode(str_replace('_', ' ', $data));
            $utf8 = @mb_convert_encoding($decoded, 'UTF-8', 'EUC-KR');
            if ($utf8 !== false && mb_check_encoding($utf8, 'UTF-8')) {
                return '=?UTF-8?B?' . base64_encode($utf8) . '?=';
            }
            return $m[0];
        },
        $value
    );

    // Now use mb_decode_mimeheader for standard MIME words
    $decoded = mb_decode_mimeheader($value);

    // Final UTF-8 safety check
    if (!mb_check_encoding($decoded, 'UTF-8')) {
        $decoded = mb_convert_encoding($decoded, 'UTF-8', 'auto');
    }

    return $decoded;
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
                $content_id = '';
                
                if (isset($sub_headers['content-id'])) {
                    $content_id = trim($sub_headers['content-id'], '<>');
                }
                
                if (stripos($disposition, 'attachment') !== false) {
                    $is_attachment = true;
                    if (preg_match('/filename="?([^";\n\r]+)"?/i', $disposition, $fn)) {
                        $filename = robust_decode_header(trim($fn[1]));
                    }
                }
                
                if (preg_match('/name="?([^";\n\r]+)"?/i', $sub_type, $fn)) {
                    $is_attachment = true;
                    if (empty($filename)) {
                        $filename = robust_decode_header(trim($fn[1]));
                    }
                }
                
                if (!empty($content_id)) {
                    $is_attachment = true;
                }
                
                if ($is_attachment) {
                    $attachments[] = [
                        'filename' => !empty($filename) ? $filename : (!empty($content_id) ? $content_id : 'unnamed_attachment'),
                        'content_type' => explode(';', $sub_type)[0],
                        'data' => base64_encode($sub_body),
                        'size' => strlen($sub_body),
                        'content_id' => $content_id
                    ];
                } elseif (stripos($sub_type, 'multipart/') !== false) {
                    parse_multipart($sub_body, $sub_type, $html_body, $text_body, $attachments);
                } else {
                    if (preg_match('/charset="?([^";]+)"?/i', $sub_type, $cm)) {
                        $charset = trim($cm[1], "\"' \t\n\r\0\x0B");
                        if (preg_match('/^(ks_c_5601[-_]1987|ks_c_5601|ksc_5601[-_]1987|ksc_5601|euc-kr|euckr)$/i', $charset)) {
                            $charset = 'EUC-KR';
                        }
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
            $charset = trim($cm[1], "\"' \t\n\r\0\x0B");
            if (preg_match('/^(ks_c_5601[-_]1987|ks_c_5601|ksc_5601[-_]1987|ksc_5601|euc-kr|euckr)$/i', $charset)) {
                $charset = 'EUC-KR';
            }
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

    $subject = isset($headers['subject']) ? robust_decode_header($headers['subject']) : '(제목 없음)';
    $from = isset($headers['from']) ? robust_decode_header($headers['from']) : '';
    $to = isset($headers['to']) ? robust_decode_header($headers['to']) : '';
    $cc = isset($headers['cc']) ? robust_decode_header($headers['cc']) : '';
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
    
    $subject = isset($headers['subject']) ? robust_decode_header($headers['subject']) : '(제목 없음)';
    $from = isset($headers['from']) ? robust_decode_header($headers['from']) : '';
    $to = isset($headers['to']) ? robust_decode_header($headers['to']) : '';
    $cc = isset($headers['cc']) ? robust_decode_header($headers['cc']) : '';
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
            
            $match_all = isset($filter['match_all']) ? (int)$filter['match_all'] : 0;
            
            // Split keywords: if tab is present, split by tab. Otherwise split by comma/space for backward compatibility.
            $kw_str = trim($filter['keywords'], " \n\r\0\x0B");
            if (strpos($kw_str, "\t") !== false) {
                $keywords = explode("\t", $kw_str);
            } else {
                $keywords = preg_split('/[\s,]+/', $kw_str, -1, PREG_SPLIT_NO_EMPTY);
            }
            $keywords = array_filter(array_map('trim', $keywords), 'strlen');
            
            if ($match_all) {
                // AND mode: all keywords must match
                $is_matched = true;
                foreach ($keywords as $kw) {
                    if (empty($kw)) continue;
                    if (mb_stripos($match_text, $kw) === false) {
                        $is_matched = false;
                        break;
                    }
                }
            } else {
                // OR mode: any keyword can match
                $is_matched = false;
                foreach ($keywords as $kw) {
                    if (empty($kw)) continue;
                    if (mb_stripos($match_text, $kw) !== false) {
                        $is_matched = true;
                        break;
                    }
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

function apply_filter_to_inbox(string $username, array $filter, PDO $db): int {
    $applied_count = 0;
    
    // We want to scan both 'new' and 'cur' directories of INBOX
    $sub_folders = ['new', 'cur'];
    
    // Get filter details
    $filter_from = $filter['filter_from'];
    $filter_subject = $filter['filter_subject'];
    $filter_body = $filter['filter_body'];
    $match_all = isset($filter['match_all']) ? (int)$filter['match_all'] : 0;
    
    $kw_str = trim($filter['keywords'], " \n\r\0\x0B");
    if (strpos($kw_str, "\t") !== false) {
        $keywords = explode("\t", $kw_str);
    } else {
        $keywords = preg_split('/[\s,]+/', $kw_str, -1, PREG_SPLIT_NO_EMPTY);
    }
    $keywords = array_filter(array_map('trim', $keywords), 'strlen');
    
    if (empty($keywords) || (!$filter_from && !$filter_subject && !$filter_body)) {
        return 0;
    }
    
    foreach ($sub_folders as $sub) {
        $files = secure_list_files($username, $sub);
        foreach ($files as $file) {
            // Read content
            $content = secure_read_file($username, $sub, $file);
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
            
            $match_text = '';
            if ($filter_from) {
                $match_text .= ' ' . $email_from;
            }
            if ($filter_subject) {
                $match_text .= ' ' . $email_subject;
            }
            if ($filter_body) {
                $match_text .= ' ' . $email_body;
            }
            
            // Check matches
            if ($match_all) {
                $is_matched = true;
                foreach ($keywords as $kw) {
                    if (empty($kw)) continue;
                    if (mb_stripos($match_text, $kw) === false) {
                        $is_matched = false;
                        break;
                    }
                }
            } else {
                $is_matched = false;
                foreach ($keywords as $kw) {
                    if (empty($kw)) continue;
                    if (mb_stripos($match_text, $kw) !== false) {
                        $is_matched = true;
                        break;
                    }
                }
            }
            
            if ($is_matched) {
                $action = $filter['action'];
                $dest_folder = $filter['dest_folder'];
                
                if ($action === 'delete') {
                    // Move to Trash
                    if (secure_move_file($username, $sub, '.Trash/cur', $file)) {
                        $applied_count++;
                    }
                } elseif ($action === 'move' && !empty($dest_folder)) {
                    // Move to destination tag/folder
                    $dest_sub = ($dest_folder === 'INBOX') ? 'cur' : '.' . $dest_folder . '/cur';
                    // If moving from cur to INBOX/cur, it is a no-op, but let's avoid moving if it's already there
                    if ($sub === 'cur' && $dest_folder === 'INBOX') {
                        continue;
                    }
                    if (secure_move_file($username, $sub, $dest_sub, $file)) {
                        $applied_count++;
                    }
                } elseif ($action === 'copy' && !empty($dest_folder)) {
                    // Copy to destination tag/folder
                    $dest_sub = ($dest_folder === 'INBOX') ? 'cur' : '.' . $dest_folder . '/cur';
                    if ($sub === 'cur' && $dest_folder === 'INBOX') {
                        continue;
                    }
                    $new_filename = time() . '.' . uniqid() . '.onto.kr:2,';
                    if (secure_write_file($username, $dest_sub, $new_filename, $content)) {
                        $applied_count++;
                    }
                } elseif ($action === 'star') {
                    // Star (flag) the email
                    $parts = explode(':2,', $file);
                    $base_name = $parts[0];
                    $flags = $parts[1] ?? '';
                    if (strpos($flags, 'F') === false) {
                        $flags .= 'F';
                        $new_filename = $base_name . ':2,' . $flags;
                        if (secure_move_file($username, $sub, $sub, $file, $new_filename)) {
                            $applied_count++;
                        }
                    }
                }
            }
        }
    }
    
    // Clear and sync cache for affected folders
    sync_folder_cache($username, 'INBOX', $db);
    if (!empty($filter['dest_folder']) && $filter['dest_folder'] !== 'INBOX') {
        sync_folder_cache($username, $filter['dest_folder'], $db);
    }
    if ($filter['action'] === 'delete') {
        sync_folder_cache($username, 'Trash', $db);
    }
    
    return $applied_count;
}

// --- ROUTING ---


$action = $_GET['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $action = $_POST['action'];
}

switch ($action) {
    case 'get_mailjet_quota':
        check_auth();
        $MJ_KEY = '86ecb242beaa17746e9def290bd37d3b';
        $MJ_SECRET = '90008ab57a485dcfd7c42d1b5214c28e';
        
        $today = gmdate('Y-m-d\T00:00:00\Z');
        $month = gmdate('Y-m-01\T00:00:00\Z');
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, $MJ_KEY . ':' . $MJ_SECRET);
        
        // Get today's count
        curl_setopt($ch, CURLOPT_URL, "https://api.mailjet.com/v3/REST/message?Limit=1&FromTS={$today}");
        $res_today = json_decode(curl_exec($ch), true);
        $count_today = $res_today['Total'] ?? 0;
        
        // Get month's count
        curl_setopt($ch, CURLOPT_URL, "https://api.mailjet.com/v3/REST/message?Limit=1&FromTS={$month}");
        $res_month = json_decode(curl_exec($ch), true);
        $count_month = $res_month['Total'] ?? 0;
        
        curl_close($ch);
        
        respond(true, 'success', [
            'today_used' => $count_today,
            'today_limit' => 200,
            'month_used' => $count_month,
            'month_limit' => 6000
        ]);
        break;
    case 'delete_auto_sender':
        check_auth();
        $username = $_SESSION['username'];
        $email = trim($_POST['email'] ?? '');
        if ($email) {
            $stmt = $db->prepare("DELETE FROM auto_senders WHERE username = :username AND email = :email");
            $stmt->execute([':username' => $username, ':email' => $email]);
            respond(true, '삭제되었습니다.');
        }
        respond(false, '이메일 정보가 없습니다.');
        break;

    case 'mark_as_spam':
        check_auth();
        $username = $_SESSION['username'];
        $email = trim($_POST['email'] ?? '');
        if ($email) {
            // Add spam filter
            $stmt = $db->prepare("INSERT INTO mail_filters (username, filter_from, filter_subject, filter_body, keywords, action, dest_folder) VALUES (:username, 1, 0, 0, :keywords, 'move', 'Spam')");
            $stmt->execute([
                ':username' => $username,
                ':keywords' => $email
            ]);
            
            // Delete from auto_senders so they disappear from "Unregistered" tab
            $stmt = $db->prepare("DELETE FROM auto_senders WHERE username = :username AND email = :email");
            $stmt->execute([':username' => $username, ':email' => $email]);
            
            respond(true, '스팸으로 등록되었습니다.');
        }
        respond(false, '이메일 정보가 없습니다.');
        break;    case 'get_status':
        if (isset($_SESSION['username'])) {
            $stmt = $db->prepare("SELECT * FROM users WHERE username = :username");
            $stmt->execute([':username' => $_SESSION['username']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            respond(true, 'Logged in', [
                'user' => [
                    'username' => $_SESSION['username'],
                    'name' => $_SESSION['name'],
                    'role' => $_SESSION['role'],
                    'profile_pic' => $user['profile_pic'] ?? null,
                    'theme' => $user['theme'] ?? 'gray',
                    'use_signature' => intval($user['use_signature'] ?? 0),
                    'signature' => $user['signature'] ?? ''
                ]
            ]);
        } else {
            respond(false, 'Not logged in');
        }
        break;

    case 'login':
        $username = trim($_POST['username'] ?? '');
        if (preg_match('/@onto\.kr$/i', $username)) {
            $username = substr($username, 0, -8);
        }
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
                'profile_pic' => $user['profile_pic'] ?? null,
                'theme' => $user['theme'] ?? 'gray',
                'use_signature' => intval($user['use_signature'] ?? 0),
                'signature' => $user['signature'] ?? ''
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
        if (preg_match('/@onto\.kr$/i', $username)) {
            $username = substr($username, 0, -8);
        }
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

    case 'get_unread_counts':
        check_auth();
        $username = $_SESSION['username'];
        
        $counts = [];
        
        // 1. Get custom tags/folders
        $tags = [];
        $cmd = "sudo /usr/local/bin/manage_mail_files.sh list_tags " . escapeshellarg($username);
        exec($cmd, $output, $return_var);
        if ($return_var === 0) {
            foreach ($output as $line) {
                $line = trim($line);
                if ($line === '' || $line === '.' || $line === '..') continue;
                if ($line[0] === '.') {
                    $tag_name = substr($line, 1);
                    if (!in_array($tag_name, ['Sent', 'Trash', 'Drafts', 'Spam'], true)) {
                        $tags[] = $tag_name;
                    }
                }
            }
        }
        
        $folders_to_check = array_merge(['INBOX', 'Sent', 'Drafts', 'Spam', 'Trash'], $tags);
        
        $local_inbox_unread = 0;
        $starred_unread = 0;
        
        $sync_enabled = intval($_GET['sync'] ?? 0) === 1;

        foreach ($folders_to_check as $f) {
            if ($sync_enabled) {
                sync_folder_cache($username, $f, $db);
            }
            
            $stmt = $db->prepare("SELECT COUNT(*) FROM cached_emails WHERE username = :username AND folder = :folder AND seen = 0");
            $stmt->execute([':username' => $username, ':folder' => $f]);
            $unread = (int)$stmt->fetchColumn();
            
            if ($f === 'INBOX') {
                $local_inbox_unread = $unread;
            }
            
            if ($unread > 0) {
                $counts[$f] = $unread;
            }
        }
        
        $stmt = $db->prepare("SELECT COUNT(*) FROM cached_emails WHERE username = :username AND flagged = 1 AND seen = 0");
        $stmt->execute([':username' => $username]);
        $starred_unread = (int)$stmt->fetchColumn();
        if ($starred_unread > 0) {
            $counts['Starred'] = $starred_unread;
        }
        
        // 2. Check external accounts
        $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE username = :username AND is_active = 1");
        $stmt->execute([':username' => $username]);
        $active_accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $total_unified_unread = $local_inbox_unread;
        
        // Let's get all counts from cached_emails
        $stmt_cached = $db->prepare("SELECT folder, COUNT(*) as cnt FROM cached_emails WHERE username = :username AND seen = 0 GROUP BY folder");
        $stmt_cached->execute([':username' => $username]);
        $cached_counts = [];
        foreach ($stmt_cached->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $cached_counts[$row['folder']] = (int)$row['cnt'];
        }

        // Add actual external folder counts to $counts
        foreach ($active_accounts as $account) {
            if ($account['service_type'] !== 'onto') {
                $stmt_folders = $db->prepare("SELECT path FROM external_folders WHERE account_id = :account_id AND is_hidden = 0");
                $stmt_folders->execute([':account_id' => $account['id']]);
                $paths = $stmt_folders->fetchAll(PDO::FETCH_COLUMN);
                
                if (empty($paths)) {
                    $paths = ['INBOX', 'Sent', 'Drafts', 'Spam', 'Trash'];
                }

                foreach ($paths as $path) {
                    $folder_key = 'ext_' . $account['id'] . '_' . $path;
                    if (isset($cached_counts[$folder_key])) {
                        $counts[$folder_key] = $cached_counts[$folder_key];
                        if ($path === 'INBOX') {
                            $total_unified_unread += $cached_counts[$folder_key];
                        }
                    }
                }
            }
        }
        
        if ($total_unified_unread > 0) {
            $counts['unified_inbox'] = $total_unified_unread;
        }
        
        respond(true, '성공', ['unread_counts' => $counts]);
        break;

    case 'sync_account_unread':
        check_auth();
        $username = $_SESSION['username'];
        $account_id = intval($_GET['account_id'] ?? 0);
        
        $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username AND is_active = 1");
        $stmt->execute([':id' => $account_id, ':username' => $username]);
        $account = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$account) {
            respond(false, '계정을 찾을 수 없거나 비활성화되었습니다.');
        }
        
        if ($account['service_type'] === 'onto') {
            respond(true, 'OnTo 계정은 로컬에서 자동 동기화됩니다.');
            break;
        }
        
        try {
            $client = new SimpleIMAPClient();
            $client->connect($account['imap_host'], $account['imap_port'], $account['imap_ssl'], $account['mail_username'], $account['mail_password']);
            
            // Get non-hidden folders of this account
            $stmt_folders = $db->prepare("SELECT path FROM external_folders WHERE account_id = :account_id AND is_hidden = 0");
            $stmt_folders->execute([':account_id' => $account_id]);
            $paths = $stmt_folders->fetchAll(PDO::FETCH_COLUMN);
            if (empty($paths)) {
                $paths = ['INBOX', 'Sent', 'Drafts', 'Spam', 'Trash'];
            }
            
            foreach ($paths as $path) {
                $folder_key = 'ext_' . $account_id . '_' . $path;
                try {
                    $exists = $client->select($path);
                    $emails = [];
                    if ($exists > 0) {
                        // Fetch the most recent 10 headers
                        $start = max(1, $exists - 9);
                        $end = $exists;
                        $raw_emails = $client->fetch_headers_range($start, $end);
                        foreach ($raw_emails as $raw) {
                            $uid = isset($raw['uid']) ? $raw['uid'] : $raw['seq'];
                            $email_id = 'ext_' . $account_id . '_' . bin2hex($path) . '_' . $uid;
                            $emails[] = [
                                'id' => $email_id,
                                'from' => $raw['from'],
                                'to' => $raw['to'],
                                'cc' => $raw['cc'],
                                'subject' => $raw['subject'],
                                'snippet' => '외부 메일입니다. 클릭하여 내용을 확인하세요.',
                                'timestamp' => isset($raw['timestamp']) ? $raw['timestamp'] : time(),
                                'seen' => $raw['seen'],
                                'flagged' => $raw['flagged'],
                                'folder' => $folder_key,
                                'account_color' => $account['color'],
                                'account_email' => $account['email'],
                                'account_id' => $account['id']
                            ];
                        }
                    }
                    
                    // Cache in database
                    if (!empty($emails)) {
                        $stmt_ins = $db->prepare("INSERT OR REPLACE INTO cached_emails 
                            (id, username, folder, filename, subject, `from`, `to`, cc, date, timestamp, seen, flagged, snippet, account_id, account_color, account_email) 
                            VALUES (:id, :username, :folder, :filename, :subject, :from, :to, :cc, :date, :timestamp, :seen, :flagged, :snippet, :account_id, :account_color, :account_email)");
                        foreach ($emails as $em) {
                            $stmt_ins->execute([
                                ':id' => $em['id'],
                                ':username' => $username,
                                ':folder' => $folder_key,
                                ':filename' => $em['id'],
                                ':subject' => $em['subject'],
                                ':from' => $em['from'],
                                ':to' => $em['to'],
                                ':cc' => $em['cc'],
                                ':date' => date('r', $em['timestamp']),
                                ':timestamp' => $em['timestamp'],
                                ':seen' => $em['seen'] ? 1 : 0,
                                ':flagged' => $em['flagged'] ? 1 : 0,
                                ':snippet' => $em['snippet'],
                                ':account_id' => $account['id'],
                                ':account_color' => $account['color'],
                                ':account_email' => $account['email']
                            ]);
                        }
                        
                        // Clean up stale emails in the fetched range
                        $min_timestamp = min(array_column($emails, 'timestamp'));
                        $fetched_ids = array_column($emails, 'id');
                        $placeholders = implode(',', array_fill(0, count($fetched_ids), '?'));
                        $stmt_clean = $db->prepare("DELETE FROM cached_emails 
                            WHERE username = ? AND folder = ? AND timestamp >= ? AND id NOT IN ($placeholders)");
                        $params = array_merge([$username, $folder_key, $min_timestamp], $fetched_ids);
                        $stmt_clean->execute($params);
                    }
                } catch (Exception $folder_ex) {
                    // Ignore individual folder failure to continue with others
                    error_log("Folder sync error for $path: " . $folder_ex->getMessage());
                }
            }
            
            $client->close();
            respond(true, '성공');
        } catch (Exception $e) {
            respond(false, '동기화 실패: ' . $e->getMessage());
        }
        break;

    case 'list_emails':
        check_auth();
        $username = $_SESSION['username'];
        $folder = $_GET['folder'] ?? 'INBOX';
        $offset = intval($_GET['offset'] ?? 0);
        $limit = intval($_GET['limit'] ?? 30);
        
        // Apply mail filtering rules on new emails
        apply_mail_filters($username, $db);

        // 1. Check for Unified Inbox
        if ($folder === 'unified_inbox') {
            $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE username = :username AND is_active = 1 ORDER BY sort_order ASC");
            $stmt->execute([':username' => $username]);
            $active_accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Sync external accounts if needed before loading unified inbox
            foreach ($active_accounts as $account) {
                if ($account['service_type'] !== 'onto') {
                    $ext_folder = 'ext_' . $account['id'] . '_INBOX';
                    $stmt_cnt = $db->prepare("SELECT COUNT(*) FROM cached_emails WHERE username = :username AND folder = :folder");
                    $stmt_cnt->execute([':username' => $username, ':folder' => $ext_folder]);
                    $cached_count = intval($stmt_cnt->fetchColumn());
                    
                    $force_fetch = ($offset === 0);
                    $target_count = $offset + $limit;
                    if ($force_fetch || $cached_count < $target_count) {
                        try {
                            $client = new SimpleIMAPClient();
                            $client->connect($account['imap_host'], $account['imap_port'], $account['imap_ssl'], $account['mail_username'], $account['mail_password']);
                            $exists = $client->select('INBOX');
                            
                            if ($exists > 0) {
                                if ($force_fetch) {
                                    $start = max(1, $exists - $limit + 1);
                                    $end = $exists;
                                } else {
                                    $start = max(1, $exists - $target_count + 1);
                                    $end = max(1, $exists - $cached_count);
                                }
                                
                                if ($end >= $start) {
                                    $raw_emails = $client->fetch_headers_range($start, $end);
                                    $fetched_emails = [];
                                    foreach ($raw_emails as $raw) {
                                        $uid = isset($raw['uid']) ? $raw['uid'] : $raw['seq'];
                                        $email_id = 'ext_' . $account['id'] . '_' . bin2hex('INBOX') . '_' . $uid;
                                        $fetched_emails[] = [
                                            'id' => $email_id,
                                            'from' => $raw['from'],
                                            'to' => $raw['to'],
                                            'cc' => $raw['cc'],
                                            'subject' => $raw['subject'],
                                            'snippet' => '외부 메일입니다. 클릭하여 내용을 확인하세요.',
                                            'timestamp' => isset($raw['timestamp']) ? $raw['timestamp'] : time(),
                                            'seen' => $raw['seen'],
                                            'flagged' => $raw['flagged'],
                                            'folder' => $ext_folder,
                                            'account_color' => $account['color'],
                                            'account_email' => $account['email'],
                                            'account_id' => $account['id']
                                        ];
                                    }
                                    
                                    if (!empty($fetched_emails)) {
                                        $stmt_ins = $db->prepare("INSERT OR REPLACE INTO cached_emails 
                                            (id, username, folder, filename, subject, `from`, `to`, cc, date, timestamp, seen, flagged, snippet, account_id, account_color, account_email) 
                                            VALUES (:id, :username, :folder, :filename, :subject, :from, :to, :cc, :date, :timestamp, :seen, :flagged, :snippet, :account_id, :account_color, :account_email)");
                                        foreach ($fetched_emails as $em) {
                                            $stmt_ins->execute([
                                                ':id' => $em['id'],
                                                ':username' => $username,
                                                ':folder' => $em['folder'],
                                                ':filename' => $em['id'],
                                                ':subject' => $em['subject'],
                                                ':from' => $em['from'],
                                                ':to' => $em['to'],
                                                ':cc' => $em['cc'],
                                                ':date' => date('r', $em['timestamp']),
                                                ':timestamp' => $em['timestamp'],
                                                ':seen' => $em['seen'],
                                                ':flagged' => $em['flagged'],
                                                ':snippet' => $em['snippet'],
                                                ':account_id' => $em['account_id'],
                                                ':account_color' => $em['account_color'],
                                                ':account_email' => $em['account_email']
                                            ]);
                                        }
                                        
                                        // Clean up stale emails in the fetched range
                                        if ($force_fetch) {
                                            $min_timestamp = min(array_column($fetched_emails, 'timestamp'));
                                            $fetched_ids = array_column($fetched_emails, 'id');
                                            $placeholders = implode(',', array_fill(0, count($fetched_ids), '?'));
                                            $stmt_clean = $db->prepare("DELETE FROM cached_emails 
                                                WHERE username = ? AND folder = ? AND timestamp >= ? AND id NOT IN ($placeholders)");
                                            $params = array_merge([$username, $ext_folder, $min_timestamp], $fetched_ids);
                                            $stmt_clean->execute($params);
                                        }
                                    }
                                }
                            }
                            $client->close();
                        } catch (Exception $e) {
                            error_log("Failed to sync account " . $account['id'] . " for unified inbox: " . $e->getMessage());
                        }
                    }
                }
            }
            
            $emails = [];
            foreach ($active_accounts as $account) {
                if ($account['service_type'] === 'onto') {
                    // Fetch local INBOX emails using get_emails_in_folder
                    $local_emails = get_emails_in_folder($username, 'INBOX', $db);
                    foreach ($local_emails as $em) {
                        $em['account_color'] = $account['color'];
                        $em['account_email'] = $account['email'];
                        $em['account_id'] = $account['id'];
                        $emails[] = $em;
                    }
                } else {
                    $ext_folder = 'ext_' . $account['id'] . '_INBOX';
                    $stmt_ext = $db->prepare("SELECT * FROM cached_emails WHERE username = :username AND folder = :folder");
                    $stmt_ext->execute([':username' => $username, ':folder' => $ext_folder]);
                    $ext_emails = $stmt_ext->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($ext_emails as $em) {
                        $em['seen'] = (int)$em['seen'];
                        $em['flagged'] = (int)$em['flagged'];
                        $em['account_color'] = $account['color'];
                        $em['account_email'] = $account['email'];
                        $em['account_id'] = $account['id'];
                        $emails[] = $em;
                    }
                }
            }
            
            usort($emails, fn($a, $b) => $b['timestamp'] - $a['timestamp']);
            
            $slice = array_slice($emails, $offset, $limit);
            
            // Calculate total dynamically to support infinite scroll without loading all messages
            if (count($slice) === $limit) {
                $total = $offset + $limit + 1; // Indicate there is more
            } else {
                $total = $offset + count($slice); // Reached the end
            }
            
            // Save senders to auto_senders table
            $auto_senders_to_save = [];
            foreach ($slice as $em) {
                if (!empty($em['from'])) {
                    $auto_senders_to_save[$em['from']] = true;
                }
            }
            save_auto_senders_batch($username, $db, array_keys($auto_senders_to_save));
            
            respond(true, '성공', ['emails' => $slice, 'total' => $total, 'offset' => $offset, 'limit' => $limit]);
            break;
        }

        // 2. Check for individual external folder
        if (preg_match('/^ext_(\d+)_(.+)$/', $folder, $matches)) {
            $account_id = intval($matches[1]);
            $sub_folder = $matches[2];
            
            $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username AND is_active = 1");
            $stmt->execute([':id' => $account_id, ':username' => $username]);
            $account = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$account) {
                respond(false, '계정을 찾을 수 없거나 비활성화되었습니다.');
            }
            
            if ($account['service_type'] === 'onto') {
                $folder = $sub_folder; // Fallback to local files below
            } else {
                try {
                    $client = new SimpleIMAPClient();
                    $client->connect($account['imap_host'], $account['imap_port'], $account['imap_ssl'], $account['mail_username'], $account['mail_password']);
                    $exists = $client->select($sub_folder);
                    
                    $emails = [];
                    if ($exists > 0) {
                        $start = max(1, $exists - $offset - $limit + 1);
                        $end = max(1, $exists - $offset);
                        
                        if ($end >= $start) {
                            $raw_emails = $client->fetch_headers_range($start, $end);
                            foreach ($raw_emails as $raw) {
                                $uid = isset($raw['uid']) ? $raw['uid'] : $raw['seq'];
                                $email_id = 'ext_' . $account_id . '_' . bin2hex($sub_folder) . '_' . $uid;
                                
                                $emails[] = [
                                    'id' => $email_id,
                                    'from' => $raw['from'],
                                    'to' => $raw['to'],
                                    'cc' => $raw['cc'],
                                    'subject' => $raw['subject'],
                                    'snippet' => '외부 메일입니다. 클릭하여 내용을 확인하세요.',
                                    'timestamp' => isset($raw['timestamp']) ? $raw['timestamp'] : time(),
                                    'seen' => $raw['seen'],
                                    'flagged' => $raw['flagged'],
                                    'folder' => $folder,
                                    'account_color' => $account['color'],
                                    'account_email' => $account['email'],
                                    'account_id' => $account['id']
                                ];
                            }
                            
                            // Sort DESC by timestamp
                            usort($emails, fn($a, $b) => $b['timestamp'] - $a['timestamp']);
                        }
                    }
                    
                    $client->close();
                    
                    // Cache in database
                    if (!empty($emails)) {
                        $stmt_ins = $db->prepare("INSERT OR REPLACE INTO cached_emails 
                            (id, username, folder, filename, subject, `from`, `to`, cc, date, timestamp, seen, flagged, snippet, account_id, account_color, account_email) 
                            VALUES (:id, :username, :folder, :filename, :subject, :from, :to, :cc, :date, :timestamp, :seen, :flagged, :snippet, :account_id, :account_color, :account_email)");
                        
                        foreach ($emails as $em) {
                            $stmt_ins->execute([
                                ':id' => $em['id'],
                                ':username' => $username,
                                ':folder' => $folder,
                                ':filename' => $em['id'],
                                ':subject' => $em['subject'],
                                ':from' => $em['from'],
                                ':to' => $em['to'],
                                ':cc' => $em['cc'],
                                ':date' => date('r', $em['timestamp']),
                                ':timestamp' => $em['timestamp'],
                                ':seen' => $em['seen'],
                                ':flagged' => $em['flagged'],
                                ':snippet' => $em['snippet'],
                                ':account_id' => $account['id'],
                                ':account_color' => $account['color'],
                                ':account_email' => $account['email']
                            ]);
                        }
                        
                        // Clean up stale emails in the fetched range
                        if ($offset === 0) {
                            $min_timestamp = min(array_column($emails, 'timestamp'));
                            $fetched_ids = array_column($emails, 'id');
                            $placeholders = implode(',', array_fill(0, count($fetched_ids), '?'));
                            $stmt_clean = $db->prepare("DELETE FROM cached_emails 
                                WHERE username = ? AND folder = ? AND timestamp >= ? AND id NOT IN ($placeholders)");
                            $params = array_merge([$username, $folder, $min_timestamp], $fetched_ids);
                            $stmt_clean->execute($params);
                        }
                    }
                    
                    respond(true, '성공', [
                        'emails' => $emails,
                        'total' => $exists,
                        'offset' => $offset,
                        'limit' => $limit
                    ]);
                } catch (Exception $e) {
                    respond(false, '외부 메일을 불러오지 못했습니다: ' . $e->getMessage());
                }
                break;
            }
        }

        // Standard folder check
        if (!in_array($folder, ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam', 'Starred'], true) && !preg_match('/^[\p{L}\p{N}_\- ]+$/u', $folder)) {
            respond(false, '잘못된 폴더입니다.');
        }
        
        $emails = [];
        $total = 0;
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
                        if (!in_array($tag_name, ['Sent', 'Trash', 'Drafts', 'Spam'], true)) {
                            $tags[] = $tag_name;
                        }
                    }
                }
            }
            
            $all_folders = array_merge(['INBOX', 'Sent', 'Drafts', 'Spam', 'Trash'], $tags);
            foreach ($all_folders as $f) {
                sync_folder_cache($username, $f, $db);
            }
            
            $stmt = $db->prepare("SELECT id, subject, `from`, `to`, cc, date, timestamp, seen, flagged, snippet, folder FROM cached_emails WHERE username = :username AND flagged = 1");
            $stmt->execute([':username' => $username]);
            $emails = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($emails as &$em) {
                $em['seen'] = (int)$em['seen'];
                $em['flagged'] = (int)$em['flagged'];
            }
            usort($emails, fn($a, $b) => $b['timestamp'] - $a['timestamp']);
            
            $total = count($emails);
            $emails = array_slice($emails, $offset, $limit);
        } else {
            $res = get_emails_in_folder_paginated($username, $folder, $offset, $limit, $db);
            $emails = $res['emails'];
            $total = $res['total'];
        }
        
        // Save senders to auto_senders table
        $auto_senders_to_save = [];
        foreach ($emails as $em) {
            if (!empty($em['from'])) {
                $auto_senders_to_save[$em['from']] = true;
            }
        }
        save_auto_senders_batch($username, $db, array_keys($auto_senders_to_save));

        respond(true, '성공', ['emails' => $emails, 'total' => $total, 'offset' => $offset, 'limit' => $limit]);
        break;

    case 'read_email':
        check_auth();
        $username = $_SESSION['username'];
        $folder = $_GET['folder'] ?? 'INBOX';
        $email_id = $_GET['id'] ?? '';

        if (empty($email_id)) {
            respond(false, '이메일 ID가 누락되었습니다.');
        }

        // Check for actual external email ID
        if (preg_match('/^ext_(\d+)_(.+)_(\d+)$/', $email_id, $matches)) {
            $account_id = intval($matches[1]);
            $sub_folder_hex = $matches[2];
            $uid = intval($matches[3]);
            $sub_folder = hex2bin($sub_folder_hex);
            
            $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username AND is_active = 1");
            $stmt->execute([':id' => $account_id, ':username' => $username]);
            $account = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$account) {
                respond(false, '계정을 찾을 수 없거나 비활성화되었습니다.');
            }
            
            try {
                $client = new SimpleIMAPClient();
                $client->connect($account['imap_host'], $account['imap_port'], $account['imap_ssl'], $account['mail_username'], $account['mail_password']);
                $client->select($sub_folder);
                
                $raw_content = $client->fetch_body($uid);
                try {
                    $client->mark_as_seen($uid);
                } catch (Exception $store_ex) {
                    error_log("Failed to store seen flag for external mail $uid: " . $store_ex->getMessage());
                }
                $client->close();
                
                if ($raw_content) {
                    $email = parse_email_from_content($raw_content, $email_id, $folder);
                    if ($email) {
                        // Mark email as seen in database
                        $stmt_seen = $db->prepare("UPDATE cached_emails SET seen = 1 WHERE id = :id");
                        $stmt_seen->execute([':id' => $email_id]);
                        $email['seen'] = 1;
                        respond(true, '성공', ['email' => $email]);
                    } else {
                        respond(false, '이메일 분석 실패.');
                    }
                } else {
                    respond(false, '이메일을 가져오지 못했습니다.');
                }
            } catch (Exception $e) {
                respond(false, 'IMAP 메일을 읽지 못했습니다: ' . $e->getMessage());
            }
            break;
        }

        // Intercept mock emails
        if (strpos($email_id, 'mock_') === 0) {
            $parts = explode('_', $email_id);
            $account_id = intval($parts[1]);
            $mock_idx = $parts[2];
            
            $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username");
            $stmt->execute([':id' => $account_id, ':username' => $username]);
            $account = $stmt->fetch(PDO::FETCH_ASSOC);
            $service_label = $account ? ucfirst($account['service_type']) : '외부 메일';
            $account_email = $account ? $account['email'] : 'external@mail.com';
            
            if ($mock_idx === '1') {
                $email = [
                    'id' => $email_id,
                    'from' => 'support@' . ($account ? $account['service_type'] : 'external') . '.com',
                    'to' => $account_email,
                    'cc' => '',
                    'bcc' => '',
                    'subject' => '[' . $service_label . ' 연동 안내] 외부 메일 연결이 정상 작동 중입니다.',
                    'text_body' => '회원님의 ' . $service_label . ' 계정이 성공적으로 연동되었습니다. 이제 ' . $account_email . ' 메일을 OnTo에서 받아보실 수 있습니다.',
                    'html_body' => '<p>회원님의 <strong>' . $service_label . '</strong> 계정이 성공적으로 연동되었습니다.</p><p>이제 <strong>' . $account_email . '</strong> 메일을 OnTo에서 받아보실 수 있습니다.</p>',
                    'timestamp' => time() - 3600,
                    'seen' => 1,
                    'flagged' => 0,
                    'folder' => $folder,
                    'attachments' => []
                ];
            } else {
                $email = [
                    'id' => $email_id,
                    'from' => 'team@onto.kr',
                    'to' => $account_email,
                    'cc' => '',
                    'bcc' => '',
                    'subject' => '외부 메일 계정의 색상 설정 안내',
                    'text_body' => '통합 받은 편지함에서 이 이메일 옆에 표시되는 점의 색상은 회원님이 설정한 색상(' . ($account ? $account['color'] : '#3b82f6') . ')입니다. 개인 설정 > 외부 메일 설정에서 색상을 변경해보세요.',
                    'html_body' => '<p>통합 받은 편지함에서 이 이메일 옆에 표시되는 점의 색상은 회원님이 설정한 색상(<strong>' . ($account ? $account['color'] : '#3b82f6') . '</strong>)입니다.</p><p>개인 설정 &gt; 외부 메일 설정에서 색상을 변경해보세요.</p>',
                    'timestamp' => time() - 7200,
                    'seen' => 0,
                    'flagged' => 1,
                    'folder' => $folder,
                    'attachments' => []
                ];
            }
            respond(true, '성공', ['email' => $email]);
            break;
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
            $stmt = $db->prepare("DELETE FROM cached_emails WHERE id = :id");
            $stmt->execute([':id' => $email_id]);
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
        
        $is_trash = ($folder === 'Trash' || substr_compare($folder, '_Trash', -strlen('_Trash')) === 0);
        if ($is_trash) {
            if (secure_delete_file($username, $found_sub, $email_id)) {
                $stmt = $db->prepare("DELETE FROM cached_emails WHERE id = :id");
                $stmt->execute([':id' => $email_id]);
                respond(true, '이메일이 영구 삭제되었습니다.');
            } else {
                respond(false, '삭제에 실패했습니다.');
            }
        } else {
            if (secure_move_file($username, $found_sub, '.Trash/cur', $email_id)) {
                $stmt = $db->prepare("DELETE FROM cached_emails WHERE id = :id");
                $stmt->execute([':id' => $email_id]);
                respond(true, '이메일이 휴지통으로 이동되었습니다.');
            } else {
                respond(false, '휴지통 이동에 실패했습니다.');
            }
        }
        break;

    case 'send_email':
        check_auth();
        $username   = $_SESSION['username'];
        $to         = trim($_POST['to'] ?? '');
        $subject    = trim($_POST['subject'] ?? '');
        $body       = $_POST['body'] ?? '';
        $cc         = trim($_POST['cc'] ?? '');
        $is_html    = isset($_POST['is_html']) && $_POST['is_html'] == '1';
        $account_id = intval($_POST['account_id'] ?? 0);

        // Store recipients into auto_senders immediately
        $recipients_to_save = [];
        if (!empty($to)) $recipients_to_save[] = $to;
        if (!empty($cc)) $recipients_to_save[] = $cc;
        save_auto_senders_batch($username, $db, $recipients_to_save);

        if (empty($to) || empty($subject) || empty($body)) {
            respond(false, '받는 이, 제목, 내용을 모두 입력해주세요.');
        }

        // ── 공통 본문 처리 ─────────────────────────────────
        if ($is_html) {
            $plain_text = strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>'], "\n", $body));
            $plain_text = html_entity_decode($plain_text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $html_body  = $body;
        } else {
            $plain_text = $body;
            $html_body  = nl2br(htmlspecialchars($body));
        }

        // ── 첨부파일 공통 수집 ──────────────────────────────
        $attachments_data = [];
        if (isset($_FILES['attachments']) && is_array($_FILES['attachments']['name'])) {
            $file_count = count($_FILES['attachments']['name']);
            for ($i = 0; $i < $file_count; $i++) {
                if ($_FILES['attachments']['error'][$i] === UPLOAD_ERR_OK && is_uploaded_file($_FILES['attachments']['tmp_name'][$i])) {
                    $attachments_data[] = [
                        'name'    => $_FILES['attachments']['name'][$i],
                        'type'    => $_FILES['attachments']['type'][$i] ?: 'application/octet-stream',
                        'content' => file_get_contents($_FILES['attachments']['tmp_name'][$i]),
                    ];
                }
            }
        }

        // ── 계정 조회 ──────────────────────────────────────
        $send_account = null;
        if ($account_id > 0) {
            $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username");
            $stmt->execute([':id' => $account_id, ':username' => $username]);
            $send_account = $stmt->fetch(PDO::FETCH_ASSOC);
        }
        if (!$send_account) {
            $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE username = :username AND service_type = 'onto' LIMIT 1");
            $stmt->execute([':username' => $username]);
            $send_account = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        $is_onto = (!$send_account || $send_account['service_type'] === 'onto');

        if ($is_onto) {
            // ═══════════════════════════════════════════════
            // [A] onto 계정 → 받는이 도메인에 따라 분기
            //     - Outlook / iCloud → Mailjet API
            //     - 나머지           → 서버 mail()
            // ═══════════════════════════════════════════════
            $from = $username . '@onto.kr';

            // 받는이 파싱
            $to_addresses = [];
            foreach (array_filter(array_map('trim', preg_split('/[\s,;]+/', $to))) as $addr) {
                if (filter_var($addr, FILTER_VALIDATE_EMAIL)) $to_addresses[] = $addr;
            }
            if (empty($to_addresses)) respond(false, '올바른 받는 이 이메일 주소가 없습니다.');

            // Mailjet이 필요한 도메인 목록 (filter.txt에서 읽기)
            $filter_file = __DIR__ . '/filter.txt';
            $MAILJET_DOMAINS = [];
            if (is_readable($filter_file)) {
                $raw = file_get_contents($filter_file);
                // 콤마 또는 줄바꿈으로 구분, 소문자 정규화, 빈 값 제거
                $MAILJET_DOMAINS = array_values(array_filter(
                    array_map('trim', preg_split('/[\r\n,]+/', $raw))
                ));
                $MAILJET_DOMAINS = array_map('strtolower', $MAILJET_DOMAINS);
            }

            // 받는이 중 하나라도 Mailjet 도메인이면 Mailjet 사용
            $use_mailjet = false;
            foreach ($to_addresses as $addr) {
                $domain = strtolower(substr($addr, strrpos($addr, '@') + 1));
                if (in_array($domain, $MAILJET_DOMAINS, true)) {
                    $use_mailjet = true;
                    break;
                }
            }
            // CC에도 Mailjet 도메인이 있으면 Mailjet 사용
            if (!$use_mailjet && !empty($cc)) {
                foreach (array_filter(array_map('trim', preg_split('/[\s,;]+/', $cc))) as $addr) {
                    if (filter_var($addr, FILTER_VALIDATE_EMAIL)) {
                        $domain = strtolower(substr($addr, strrpos($addr, '@') + 1));
                        if (in_array($domain, $MAILJET_DOMAINS, true)) { $use_mailjet = true; break; }
                    }
                }
            }

            // MIME 공통 빌드 (보낸메일함 저장용)
            $mb   = "----=_Mx_" . md5(uniqid((string)rand(), true));
            $ab   = "----=_Al_" . md5(uniqid((string)rand(), true));
            $esub = "=?UTF-8?B?" . base64_encode($subject) . "?=";
            $hdr  = "From: $from\r\nTo: $to\r\n";
            if (!empty($cc)) $hdr .= "Cc: $cc\r\n";
            $hdr .= "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$mb\"\r\n";
            $body_raw  = "--$mb\r\nContent-Type: multipart/alternative; boundary=\"$ab\"\r\n\r\n";
            $body_raw .= "--$ab\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($plain_text)) . "\r\n";
            $body_raw .= "--$ab\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html_body)) . "\r\n";
            $body_raw .= "--$ab--\r\n\r\n--$mb--\r\n";

            if ($use_mailjet) {
                // ─── Mailjet 발송 ───────────────────────────
                $MJ_KEY    = '86ecb242beaa17746e9def290bd37d3b';
                $MJ_SECRET = '90008ab57a485dcfd7c42d1b5214c28e';

                $mj_to = array_map(fn($a) => ['Email' => $a], $to_addresses);
                $mj_msg = [
                    'From'     => ['Email' => $from, 'Name' => $username],
                    'To'       => $mj_to,
                    'Subject'  => $subject,
                    'HTMLPart' => $html_body,
                    'TextPart' => $plain_text,
                ];
                if (!empty($cc)) {
                    $cc_arr = [];
                    foreach (array_filter(array_map('trim', preg_split('/[\s,;]+/', $cc))) as $addr) {
                        if (filter_var($addr, FILTER_VALIDATE_EMAIL)) $cc_arr[] = ['Email' => $addr];
                    }
                    if (!empty($cc_arr)) $mj_msg['Cc'] = $cc_arr;
                }
                if (!empty($attachments_data)) {
                    $mj_msg['Attachments'] = array_map(fn($a) => [
                        'ContentType'   => $a['type'],
                        'Filename'      => $a['name'],
                        'Base64Content' => base64_encode($a['content']),
                    ], $attachments_data);
                }

                $ch = curl_init('https://api.mailjet.com/v3.1/send');
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST           => true,
                    CURLOPT_POSTFIELDS     => json_encode(['Messages' => [$mj_msg]]),
                    CURLOPT_USERPWD        => $MJ_KEY . ':' . $MJ_SECRET,
                    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
                    CURLOPT_TIMEOUT        => 30,
                ]);
                $mj_raw    = curl_exec($ch);
                $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curl_err  = curl_error($ch);
                curl_close($ch);

                if ($curl_err) respond(false, 'Mailjet 연결 오류: ' . $curl_err);

                $mj_res = json_decode($mj_raw, true);
                $status = $mj_res['Messages'][0]['Status'] ?? '';
                if (!($http_code === 200 && $status === 'success')) {
                    $err = $mj_res['Messages'][0]['Errors'][0]['ErrorMessage'] ?? ($mj_raw ?: '알 수 없는 오류');
                    respond(false, '메일 발송 실패 (Mailjet): ' . $err);
                }

            } else {
                // ─── 서버 mail() 발송 ──────────────────────
                $encoded_subject = $esub;
                $mail_headers  = "From: $from\r\nReply-To: $from\r\n";
                if (!empty($cc)) $mail_headers .= "Cc: $cc\r\n";
                $mail_headers .= "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$mb\"\r\n";

                $success = mail($to, $encoded_subject, $body_raw, $mail_headers, "-f $from");
                if (!$success) respond(false, '메일 발송에 실패했습니다.');
            }

            // 보낸 메일함 저장
            $fn = time() . ".M" . rand(100000, 999999) . "P" . getmypid() . "." . gethostname() . ":2,S";
            secure_write_file($username, '.Sent/cur', $fn, $hdr . "Subject: $esub\r\nDate: " . date('r') . "\r\n\r\n" . $body_raw);
            respond(true, '메일이 성공적으로 전송되었습니다.');

        } else {
            // ═══════════════════════════════════════════════
            // [B] 외부 계정 → 해당 SMTP 서버
            // ═══════════════════════════════════════════════
            $from      = $send_account['email'];
            $smtp_host = $send_account['smtp_host'];
            $smtp_port = intval($send_account['smtp_port']);
            $smtp_ssl  = $send_account['smtp_ssl'];  // 'ssl','tls',''
            $smtp_user = $send_account['mail_username'];
            $smtp_pass = $send_account['mail_password'];
            $smtp_auth = intval($send_account['smtp_auth'] ?? 1);

            $mb  = "----=_Mx_" . md5(uniqid((string)rand(), true));
            $ab  = "----=_Al_" . md5(uniqid((string)rand(), true));
            $esub = "=?UTF-8?B?" . base64_encode($subject) . "?=";

            $mime  = "--$mb\r\nContent-Type: multipart/alternative; boundary=\"$ab\"\r\n\r\n";
            $mime .= "--$ab\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($plain_text)) . "\r\n";
            $mime .= "--$ab\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html_body)) . "\r\n";
            $mime .= "--$ab--\r\n\r\n";
            foreach ($attachments_data as $att) {
                $enc_fn = "=?UTF-8?B?" . base64_encode($att['name']) . "?=";
                $mime .= "--$mb\r\nContent-Type: {$att['type']}; name=\"$enc_fn\"\r\n";
                $mime .= "Content-Disposition: attachment; filename=\"$enc_fn\"\r\n";
                $mime .= "Content-Transfer-Encoding: base64\r\n\r\n";
                $mime .= chunk_split(base64_encode($att['content'])) . "\r\n";
            }
            $mime .= "--$mb--\r\n";

            $err_str = ''; $err_no = 0;
            $sock = ($smtp_ssl === 'ssl')
                ? @fsockopen("ssl://$smtp_host", $smtp_port, $err_no, $err_str, 15)
                : @fsockopen($smtp_host, $smtp_port, $err_no, $err_str, 15);
            if (!$sock) respond(false, "SMTP 연결 실패 ({$smtp_host}:{$smtp_port}): $err_str");

            $rd = function() use ($sock) {
                $d = '';
                while ($l = fgets($sock, 512)) { $d .= $l; if ($l[3] === ' ') break; }
                return $d;
            };
            $sd = function(string $c) use ($sock, $rd) { fwrite($sock, $c . "\r\n"); return $rd(); };

            $rd();
            $ehlo = gethostname() ?: 'localhost';
            $sd("EHLO $ehlo");

            if ($smtp_ssl === 'tls') {
                $sd("STARTTLS");
                stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                $sd("EHLO $ehlo");
            }

            if ($smtp_auth && !empty($smtp_user)) {
                $sd("AUTH LOGIN");
                $sd(base64_encode($smtp_user));
                $ar = $sd(base64_encode($smtp_pass));
                if (substr(trim($ar), 0, 3) !== '235') {
                    fclose($sock);
                    respond(false, 'SMTP 인증 실패: ' . trim($ar));
                }
            }

            $sd("MAIL FROM:<$from>");
            foreach (array_filter(array_map('trim', preg_split('/[\s,;]+/', $to . (empty($cc) ? '' : ",$cc")))) as $rcpt) {
                if (filter_var($rcpt, FILTER_VALIDATE_EMAIL)) $sd("RCPT TO:<$rcpt>");
            }

            $sd("DATA");
            $hdr  = "From: $from\r\nTo: $to\r\n";
            if (!empty($cc)) $hdr .= "Cc: $cc\r\n";
            $hdr .= "Subject: $esub\r\nDate: " . date('r') . "\r\nMIME-Version: 1.0\r\n";
            $hdr .= "Content-Type: multipart/mixed; boundary=\"$mb\"\r\n\r\n";
            $dr = $sd($hdr . $mime . "\r\n.");
            $sd("QUIT");
            fclose($sock);

            if (substr(trim($dr), 0, 3) !== '250') {
                respond(false, 'SMTP 발송 실패: ' . trim($dr));
            }

            // 외부 계정 IMAP Sent 폴더에 저장 시도
            $i_host = $send_account['imap_host'];
            $i_port = intval($send_account['imap_port']);
            $i_ssl  = $send_account['imap_ssl'];
            $i_user = $send_account['mail_username'];
            $i_pass = $send_account['mail_password'];
            $sflag  = ($i_ssl === 'ssl') ? '/ssl/novalidate-cert' : '/novalidate-cert';
            $mbox   = "{{$i_host}:{$i_port}/imap{$sflag}}Sent";
            $imap   = @imap_open($mbox, $i_user, $i_pass, 0, 1);
            if ($imap) {
                @imap_append($imap, $mbox, $hdr . $mime, "\\Seen");
                imap_close($imap);
            }

            respond(true, '메일이 성공적으로 전송되었습니다.');
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
        $stmt = $db->prepare("DELETE FROM cached_emails WHERE username = :username AND folder = 'Trash'");
        $stmt->execute([':username' => $username]);
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
        
        // Sync role based on group membership (if '관리자' is present, set role = 'admin', else 'user')
        $new_role = in_array('관리자', $groups_array, true) ? 'admin' : 'user';
        
        $stmt = $db->prepare("UPDATE users SET group_name = :group_name, role = :role WHERE id = :id AND username != 'dj'");
        $stmt->execute([':group_name' => $new_group_name, ':role' => $new_role, ':id' => $id]);
        
        // Also update for 'dj' separately just in case they update dj's groups, to never lose admin role
        $stmt = $db->prepare("UPDATE users SET group_name = :group_name WHERE id = :id AND username = 'dj'");
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
                    if (!in_array($tag_name, ['Sent', 'Trash', 'Drafts', 'Spam'], true)) {
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

    case 'list_external_mails':
        check_auth();
        $username = $_SESSION['username'];
        
        // Ensure OnTo row exists
        $stmt = $db->prepare("SELECT COUNT(*) FROM external_mail_accounts WHERE username = :username AND service_type = 'onto'");
        $stmt->execute([':username' => $username]);
        if ($stmt->fetchColumn() == 0) {
            $stmt = $db->prepare("INSERT INTO external_mail_accounts (username, email, service_type, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, mail_username, mail_password, color, is_active, sort_order) VALUES (:username, :email, 'onto', 'mail.onto.kr', 993, 'ssl', 'mail.onto.kr', 465, 'ssl', :mail_username, '', '#3b82f6', 1, -1)");
            $stmt->execute([
                ':username' => $username,
                ':email' => $username . '@onto.kr',
                ':mail_username' => $username . '@onto.kr'
            ]);
        }
        
        $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE username = :username ORDER BY sort_order ASC, id ASC");
        $stmt->execute([':username' => $username]);
        $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fetch folders for each account
        $stmt_folders = $db->prepare("SELECT path, type, is_hidden FROM external_folders WHERE account_id = :account_id");
        foreach ($accounts as &$acc) {
            $stmt_folders->execute([':account_id' => $acc['id']]);
            $folders = $stmt_folders->fetchAll(PDO::FETCH_ASSOC);
            foreach ($folders as &$f) {
                $f['display_name'] = imap_utf7_to_utf8($f['path']);
            }
            $acc['folders'] = $folders;
        }
        
        respond(true, '성공', ['accounts' => $accounts]);
        break;

    case 'list_external_folders':
        check_auth();
        $username = $_SESSION['username'];
        $account_id = intval($_GET['account_id'] ?? 0);

        $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username");
        $stmt->execute([':id' => $account_id, ':username' => $username]);
        $account = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$account) {
            respond(false, '계정을 찾을 수 없습니다.');
        }

        try {
            $client = new SimpleIMAPClient();
            $client->connect($account['imap_host'], $account['imap_port'], $account['imap_ssl'], $account['mail_username'], $account['mail_password']);
            $imap_folders = $client->get_folders();
            $client->close();

            $stmt_sel = $db->prepare("SELECT * FROM external_folders WHERE account_id = :account_id");
            $stmt_sel->execute([':account_id' => $account_id]);
            $existing_rows = $stmt_sel->fetchAll(PDO::FETCH_ASSOC);
            
            $existing_map = [];
            foreach ($existing_rows as $row) {
                $existing_map[$row['path']] = $row;
            }

            $stmt_ins = $db->prepare("INSERT INTO external_folders (account_id, path, type, is_hidden) VALUES (:account_id, :path, :type, 0)");
            
            $result_folders = [];
            foreach ($imap_folders as $f) {
                if (!isset($existing_map[$f['path']])) {
                    $stmt_ins->execute([
                        ':account_id' => $account_id,
                        ':path' => $f['path'],
                        ':type' => $f['type']
                    ]);
                    $f['is_hidden'] = 0;
                } else {
                    $f['is_hidden'] = intval($existing_map[$f['path']]['is_hidden']);
                    if ($existing_map[$f['path']]['type'] !== $f['type']) {
                        $stmt_upd_type = $db->prepare("UPDATE external_folders SET type = :type WHERE account_id = :account_id AND path = :path");
                        $stmt_upd_type->execute([
                            ':type' => $f['type'],
                            ':account_id' => $account_id,
                            ':path' => $f['path']
                        ]);
                    }
                }
                $f['display_name'] = imap_utf7_to_utf8($f['path']);
                $result_folders[] = $f;
            }

            respond(true, '성공', ['folders' => $result_folders]);
        } catch (Exception $e) {
            respond(false, 'IMAP 폴더 목록을 가져오지 못했습니다: ' . $e->getMessage());
        }
        break;

    case 'update_external_folder_settings':
        check_auth();
        $username = $_SESSION['username'];
        $account_id = intval($_POST['account_id'] ?? 0);
        $folder_path = trim($_POST['folder_path'] ?? '');
        $is_hidden = intval($_POST['is_hidden'] ?? 0);

        if (empty($folder_path)) {
            respond(false, '폴더 경로가 누락되었습니다.');
        }

        $stmt = $db->prepare("SELECT COUNT(*) FROM external_mail_accounts WHERE id = :id AND username = :username");
        $stmt->execute([':id' => $account_id, ':username' => $username]);
        if ($stmt->fetchColumn() == 0) {
            respond(false, '권한이 없습니다.');
        }

        $stmt = $db->prepare("INSERT INTO external_folders (account_id, path, is_hidden) VALUES (:account_id, :path, :is_hidden)
            ON CONFLICT(account_id, path) DO UPDATE SET is_hidden = :is_hidden");
        $stmt->execute([
            ':account_id' => $account_id,
            ':path' => $folder_path,
            ':is_hidden' => $is_hidden
        ]);

        respond(true, '설정이 저장되었습니다.');
        break;

    case 'save_external_mail':
        check_auth();
        $username = $_SESSION['username'];
        $id = $_POST['id'] ?? '';
        $email = trim($_POST['email'] ?? '');
        $service_type = $_POST['service_type'] ?? 'custom';
        $imap_host = trim($_POST['imap_host'] ?? '');
        $imap_port = intval($_POST['imap_port'] ?? 993);
        $imap_ssl = $_POST['imap_ssl'] ?? 'ssl';
        $smtp_host = trim($_POST['smtp_host'] ?? '');
        $smtp_port = intval($_POST['smtp_port'] ?? 465);
        $smtp_ssl = $_POST['smtp_ssl'] ?? 'ssl';
        $mail_username = trim($_POST['mail_username'] ?? '');
        $mail_password = $_POST['mail_password'] ?? '';
        $color = $_POST['color'] ?? '#3b82f6';
        $is_active = intval($_POST['is_active'] ?? 1);
        $smtp_auth = intval($_POST['smtp_auth'] ?? 1);
        $external_images = $_POST['external_images'] ?? 'ask';
        if (!in_array($external_images, ['allow', 'ask', 'deny'])) {
            $external_images = 'ask';
        }
        $external_links = $_POST['external_links'] ?? 'ask';
        if (!in_array($external_links, ['allow', 'ask', 'deny'])) {
            $external_links = 'ask';
        }

        if (empty($email) || empty($mail_username)) {
            respond(false, '이메일 주소와 로그인 계정을 입력해주세요.');
        }

        if ($id !== '') {
            $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username");
            $stmt->execute([':id' => $id, ':username' => $username]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$existing) {
                respond(false, '해당 계정을 찾을 수 없습니다.');
            }
            if ($existing['service_type'] === 'onto') {
                $stmt = $db->prepare("UPDATE external_mail_accounts SET is_active = :is_active, color = :color, external_images = :external_images, external_links = :external_links WHERE id = :id");
                $stmt->execute([
                    ':is_active' => $is_active,
                    ':color' => $color,
                    ':external_images' => $external_images,
                    ':external_links' => $external_links,
                    ':id' => $id
                ]);
                respond(true, 'OnTo 메일 설정이 업데이트되었습니다.');
                break;
            }
        }

        if ($id === '' && empty($mail_password)) {
            respond(false, '암호를 입력해주세요.');
        }

        // Test connection before saving
        $test_password = $mail_password;
        if ($id !== '') {
            if ($test_password === '') {
                $test_password = $existing['mail_password'];
            }
        }
        
        if ($service_type !== 'onto') {
            $imap_test = test_imap_connection($imap_host, $imap_port, $imap_ssl, $mail_username, $test_password);
            if ($imap_test !== true) {
                respond(false, '수신(IMAP) 서버 로그인 실패: ' . $imap_test, ['error_type' => 'imap']);
            }
            
            $smtp_test = test_smtp_connection($smtp_host, $smtp_port, $smtp_ssl, $mail_username, $test_password, $smtp_auth);
            if ($smtp_test !== true) {
                respond(false, '송신(SMTP) 서버 로그인 실패: ' . $smtp_test, ['error_type' => 'smtp']);
            }
        }

        if ($id === '') {
            $stmt = $db->prepare("SELECT COUNT(*) FROM external_mail_accounts WHERE username = :username AND email = :email");
            $stmt->execute([':username' => $username, ':email' => $email]);
            if ($stmt->fetchColumn() > 0) {
                respond(false, '이미 등록된 이메일 주소입니다.');
            }

            $stmt = $db->prepare("SELECT MAX(sort_order) FROM external_mail_accounts WHERE username = :username");
            $stmt->execute([':username' => $username]);
            $max_order = $stmt->fetchColumn();
            $next_order = $max_order !== null ? intval($max_order) + 1 : 0;

            $stmt = $db->prepare("INSERT INTO external_mail_accounts 
                (username, email, service_type, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, mail_username, mail_password, color, is_active, sort_order, smtp_auth, external_images, external_links) 
                VALUES (:username, :email, :service_type, :imap_host, :imap_port, :imap_ssl, :smtp_host, :smtp_port, :smtp_ssl, :mail_username, :mail_password, :color, :is_active, :sort_order, :smtp_auth, :external_images, :external_links)");
            $stmt->execute([
                ':username' => $username,
                ':email' => $email,
                ':service_type' => $service_type,
                ':imap_host' => $imap_host,
                ':imap_port' => $imap_port,
                ':imap_ssl' => $imap_ssl,
                ':smtp_host' => $smtp_host,
                ':smtp_port' => $smtp_port,
                ':smtp_ssl' => $smtp_ssl,
                ':mail_username' => $mail_username,
                ':mail_password' => $mail_password,
                ':color' => $color,
                ':is_active' => $is_active,
                ':sort_order' => $next_order,
                ':smtp_auth' => $smtp_auth,
                ':external_images' => $external_images,
                ':external_links' => $external_links
            ]);
            respond(true, '외부 메일 계정이 추가되었습니다.');
        } else {
            if ($mail_password !== '') {
                $stmt = $db->prepare("UPDATE external_mail_accounts SET 
                    email = :email, service_type = :service_type, imap_host = :imap_host, imap_port = :imap_port, imap_ssl = :imap_ssl,
                    smtp_host = :smtp_host, smtp_port = :smtp_port, smtp_ssl = :smtp_ssl, mail_username = :mail_username, mail_password = :mail_password,
                    color = :color, is_active = :is_active, smtp_auth = :smtp_auth, external_images = :external_images, external_links = :external_links WHERE id = :id AND username = :username");
                $stmt->execute([
                    ':email' => $email,
                    ':service_type' => $service_type,
                    ':imap_host' => $imap_host,
                    ':imap_port' => $imap_port,
                    ':imap_ssl' => $imap_ssl,
                    ':smtp_host' => $smtp_host,
                    ':smtp_port' => $smtp_port,
                    ':smtp_ssl' => $smtp_ssl,
                    ':mail_username' => $mail_username,
                    ':mail_password' => $mail_password,
                    ':color' => $color,
                    ':is_active' => $is_active,
                    ':smtp_auth' => $smtp_auth,
                    ':external_images' => $external_images,
                    ':external_links' => $external_links,
                    ':id' => $id,
                    ':username' => $username
                ]);
            } else {
                $stmt = $db->prepare("UPDATE external_mail_accounts SET 
                    email = :email, service_type = :service_type, imap_host = :imap_host, imap_port = :imap_port, imap_ssl = :imap_ssl,
                    smtp_host = :smtp_host, smtp_port = :smtp_port, smtp_ssl = :smtp_ssl, mail_username = :mail_username,
                    color = :color, is_active = :is_active, smtp_auth = :smtp_auth, external_images = :external_images, external_links = :external_links WHERE id = :id AND username = :username");
                $stmt->execute([
                    ':email' => $email,
                    ':service_type' => $service_type,
                    ':imap_host' => $imap_host,
                    ':imap_port' => $imap_port,
                    ':imap_ssl' => $imap_ssl,
                    ':smtp_host' => $smtp_host,
                    ':smtp_port' => $smtp_port,
                    ':smtp_ssl' => $smtp_ssl,
                    ':mail_username' => $mail_username,
                    ':color' => $color,
                    ':is_active' => $is_active,
                    ':smtp_auth' => $smtp_auth,
                    ':external_images' => $external_images,
                    ':external_links' => $external_links,
                    ':id' => $id,
                    ':username' => $username
                ]);
            }
            respond(true, '외부 메일 계정 설정이 변경되었습니다.');
        }
        break;

    case 'delete_external_mail':
        check_auth();
        $username = $_SESSION['username'];
        $id = $_POST['id'] ?? '';
        if ($id === '') {
            respond(false, '계정 ID가 누락되었습니다.');
        }

        $stmtCount = $db->prepare("SELECT COUNT(*) FROM external_mail_accounts WHERE username = :username");
        $stmtCount->execute([':username' => $username]);
        $count = intval($stmtCount->fetchColumn());
        if ($count <= 1) {
            respond(false, '최소 하나의 메일 계정은 설정되어 있어야 합니다.');
        }

        $stmt = $db->prepare("SELECT * FROM external_mail_accounts WHERE id = :id AND username = :username");
        $stmt->execute([':id' => $id, ':username' => $username]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            respond(false, '해당 계정을 찾을 수 없습니다.');
        }
        if ($existing['service_type'] === 'onto') {
            respond(false, 'OnTo 기본 계정은 삭제할 수 없습니다.');
        }

        $stmt = $db->prepare("DELETE FROM external_mail_accounts WHERE id = :id AND username = :username");
        $stmt->execute([':id' => $id, ':username' => $username]);
        respond(true, '외부 메일 계정이 삭제되었습니다.');
        break;

    case 'update_external_mail_order':
        check_auth();
        $username = $_SESSION['username'];
        $order = json_decode($_POST['order'] ?? '[]', true);
        if (empty($order)) {
            respond(false, '순서 정보가 없습니다.');
        }
        
        try {
            $db->beginTransaction();
            foreach ($order as $idx => $id) {
                $stmt = $db->prepare("UPDATE external_mail_accounts SET sort_order = :idx WHERE id = :id AND username = :username");
                $stmt->execute([
                    ':idx' => $idx,
                    ':id' => $id,
                    ':username' => $username
                ]);
            }
            $db->commit();
            respond(true, '계정 순서가 저장되었습니다.');
        } catch (Exception $e) {
            $db->rollBack();
            respond(false, '순서 저장 실패: ' . $e->getMessage());
        }
        break;

    case 'create_tag':
        check_auth();
        $username = $_SESSION['username'];
        $tag_name = trim($_POST['tag_name'] ?? '');
        
        if (empty($tag_name)) {
            respond(false, '폴더 이름을 입력하세요.');
        }
        
        if (!preg_match('/^[\p{L}\p{N}_\- ]+$/u', $tag_name)) {
            respond(false, '폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-), 공백만 가능합니다.');
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
        
        if (in_array($tag_name, ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam'], true)) {
            respond(false, '기본 폴더는 삭제할 수 없습니다.');
        }
        
        if (!preg_match('/^[\p{L}\p{N}_\- ]+$/u', $tag_name)) {
            respond(false, '폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-), 공백만 가능합니다.');
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

    case 'rename_tag':
        check_auth();
        $username = $_SESSION['username'];
        $old_name = trim($_POST['old_name'] ?? '');
        $new_name = trim($_POST['new_name'] ?? '');
        
        if (empty($old_name) || empty($new_name)) {
            respond(false, '폴더 이름을 입력하세요.');
        }
        
        if (in_array($old_name, ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam'], true) || 
            in_array($new_name, ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam'], true)) {
            respond(false, '기본 폴더는 이름을 수정할 수 없습니다.');
        }
        
        if (!preg_match('/^[\p{L}\p{N}_\- ]+$/u', $new_name)) {
            respond(false, '폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-), 공백만 가능합니다.');
        }
        
        $old_path = '.' . $old_name;
        $new_path = '.' . $new_name;
        
        $cmd = "sudo /usr/local/bin/manage_mail_files.sh rename_tag " . escapeshellarg($username) . " " . escapeshellarg($old_path) . " " . escapeshellarg($new_path);
        exec($cmd, $output, $return_val);
        
        if ($return_val === 0) {
            // Update database tables
            $stmt = $db->prepare("UPDATE folder_colors SET folder_name = :new_name WHERE username = :username AND folder_name = :old_name");
            $stmt->execute([':new_name' => $new_name, ':username' => $username, ':old_name' => $old_name]);
            
            $stmt = $db->prepare("UPDATE cached_emails SET folder = :new_name WHERE username = :username AND folder = :old_name");
            $stmt->execute([':new_name' => $new_name, ':username' => $username, ':old_name' => $old_name]);
            
            $stmt = $db->prepare("UPDATE mail_filters SET dest_folder = :new_name WHERE username = :username AND dest_folder = :old_name");
            $stmt->execute([':new_name' => $new_name, ':username' => $username, ':old_name' => $old_name]);
            
            respond(true, '개인 폴더 이름이 성공적으로 변경되었습니다.');
        } else {
            respond(false, '개인 폴더 이름 변경에 실패했습니다. (동일한 이름의 폴더가 이미 존재할 수 있습니다)');
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
            $stmt = $db->prepare("DELETE FROM cached_emails WHERE id = :id");
            $stmt->execute([':id' => $email_id]);
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

    case 'update_theme':
        check_auth();
        $username = $_SESSION['username'];
        $theme = trim($_POST['theme'] ?? 'gray');
        
        $stmt = $db->prepare("UPDATE users SET theme = :theme WHERE username = :username");
        $stmt->execute([':theme' => $theme, ':username' => $username]);
        
        respond(true, '테마가 저장되었습니다.');
        break;

    case 'update_signature':
        check_auth();
        $username = $_SESSION['username'];
        $use_signature = intval($_POST['use_signature'] ?? 0);
        $signature = $_POST['signature'] ?? '';

        $stmt = $db->prepare("UPDATE users SET use_signature = :use_signature, signature = :signature WHERE username = :username");
        $stmt->execute([
            ':use_signature' => $use_signature,
            ':signature' => $signature,
            ':username' => $username
        ]);

        respond(true, '서명이 성공적으로 저장되었습니다.');
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
            $stmt = $db->prepare("DELETE FROM cached_emails WHERE id = :id");
            $stmt->execute([':id' => $email_id]);
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
        $keywords = trim($_POST['keywords'] ?? '', " \n\r\0\x0B");
        $match_all = isset($_POST['match_all']) ? (int)$_POST['match_all'] : 0;
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

        $stmt = $db->prepare("INSERT INTO mail_filters (username, title, filter_from, filter_subject, filter_body, keywords, match_all, action, dest_folder, sort_order) VALUES (:username, :title, :filter_from, :filter_subject, :filter_body, :keywords, :match_all, :action, :dest_folder, :sort_order)");
        $stmt->execute([
            ':username' => $username,
            ':title' => $title,
            ':filter_from' => $filter_from,
            ':filter_subject' => $filter_subject,
            ':filter_body' => $filter_body,
            ':keywords' => $keywords,
            ':match_all' => $match_all,
            ':action' => $action_val,
            ':dest_folder' => empty($dest_folder) ? null : $dest_folder,
            ':sort_order' => $max_order + 1
        ]);

        $new_id = (int)$db->lastInsertId();
        respond(true, '필터가 생성되었습니다.', ['filter_id' => $new_id]);
        break;

    case 'update_filter':
        check_auth();
        $username = $_SESSION['username'];
        $filter_id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $title = trim($_POST['title'] ?? '');
        $filter_from = isset($_POST['filter_from']) ? (int)$_POST['filter_from'] : 0;
        $filter_subject = isset($_POST['filter_subject']) ? (int)$_POST['filter_subject'] : 0;
        $filter_body = isset($_POST['filter_body']) ? (int)$_POST['filter_body'] : 0;
        $keywords = trim($_POST['keywords'] ?? '', " \n\r\0\x0B");
        $match_all = isset($_POST['match_all']) ? (int)$_POST['match_all'] : 0;
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

        $stmt = $db->prepare("UPDATE mail_filters SET title = :title, filter_from = :filter_from, filter_subject = :filter_subject, filter_body = :filter_body, keywords = :keywords, match_all = :match_all, action = :action, dest_folder = :dest_folder WHERE id = :id AND username = :username");
        $stmt->execute([
            ':id' => $filter_id,
            ':username' => $username,
            ':title' => $title,
            ':filter_from' => $filter_from,
            ':filter_subject' => $filter_subject,
            ':filter_body' => $filter_body,
            ':keywords' => $keywords,
            ':match_all' => $match_all,
            ':action' => $action_val,
            ':dest_folder' => empty($dest_folder) ? null : $dest_folder
        ]);

        respond(true, '필터가 수정되었습니다.', ['filter_id' => $filter_id]);
        break;

    case 'apply_filter_to_existing':
        check_auth();
        $username = $_SESSION['username'];
        $filter_id = isset($_POST['filter_id']) ? (int)$_POST['filter_id'] : 0;
        
        if ($filter_id <= 0) {
            respond(false, '잘못된 필터 ID입니다.');
        }
        
        $stmt = $db->prepare("SELECT * FROM mail_filters WHERE id = :id AND username = :username");
        $stmt->execute([':id' => $filter_id, ':username' => $username]);
        $filter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$filter) {
            respond(false, '존재하지 않는 필터입니다.');
        }
        
        $applied_count = apply_filter_to_inbox($username, $filter, $db);
        respond(true, "기존 메일 {$applied_count}통에 필터가 적용되었습니다.", ['applied_count' => $applied_count]);
        break;

    case 'rename_filter':
        check_auth();
        $username = $_SESSION['username'];
        $filter_id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $title = trim($_POST['title'] ?? '');
        
        if ($filter_id <= 0) {
            respond(false, '잘못된 필터 ID입니다.');
        }
        if (empty($title)) {
            respond(false, '필터 제목을 입력하세요.');
        }
        
        $stmt = $db->prepare("UPDATE mail_filters SET title = :title WHERE id = :id AND username = :username");
        $stmt->execute([
            ':id' => $filter_id,
            ':username' => $username,
            ':title' => $title
        ]);
        
        respond(true, '필터 이름이 성공적으로 변경되었습니다.');
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

    case 'list_address_book':
        check_auth();
        $username = $_SESSION['username'];
        $stmt = $db->prepare("SELECT * FROM address_book WHERE username = :username ORDER BY name ASC");
        $stmt->execute([':username' => $username]);
        $list = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(true, '성공', ['address_book' => $list]);
        break;

    case 'list_received_senders':
        check_auth();
        $username = $_SESSION['username'];
        $senders = get_received_senders($username, $db);
        respond(true, '성공', ['senders' => $senders]);
        break;

    case 'save_address':
        check_auth();
        $username = $_SESSION['username'];
        $email = trim($_POST['email'] ?? '');
        $name = trim($_POST['name'] ?? '');
        $group_name = trim($_POST['group_name'] ?? '미정');
        if (empty($email) || empty($name)) {
            respond(false, '이름과 이메일 주소를 입력해주세요.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(false, '유효하지 않은 이메일 주소입니다.');
        }
        $stmt = $db->prepare("INSERT INTO address_book (username, name, email, group_name) VALUES (:username, :name, :email, :group_name)
            ON CONFLICT(username, email) DO UPDATE SET name = :name, group_name = :group_name");
        $stmt->execute([
            ':username' => $username,
            ':name' => $name,
            ':email' => $email,
            ':group_name' => $group_name
        ]);
        respond(true, '주소록에 저장되었습니다.');
        break;

    case 'delete_address':
        check_auth();
        $username = $_SESSION['username'];
        $id = intval($_POST['id'] ?? 0);
        $stmt = $db->prepare("DELETE FROM address_book WHERE id = :id AND username = :username");
        $stmt->execute([':id' => $id, ':username' => $username]);
        respond(true, '주소록에서 삭제되었습니다.');
        break;

    case 'list_address_groups':
        check_auth();
        $username = $_SESSION['username'];
        check_and_seed_address_groups($username, $db);
        $stmt = $db->prepare("SELECT * FROM address_groups WHERE username = :username ORDER BY sort_order ASC, id ASC");
        $stmt->execute([':username' => $username]);
        $list = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(true, '성공', ['address_groups' => $list]);
        break;

    case 'save_address_group':
        check_auth();
        $username = $_SESSION['username'];
        $name = trim($_POST['name'] ?? '');
        if (empty($name)) {
            respond(false, '그룹 이름을 입력해주세요.');
        }
        try {
            $stmt = $db->prepare("INSERT INTO address_groups (username, name) VALUES (:username, :name)");
            $stmt->execute([':username' => $username, ':name' => $name]);
            respond(true, '그룹이 추가되었습니다.');
        } catch (PDOException $e) {
            respond(false, '이미 존재하는 그룹 이름입니다.');
        }
        break;

    case 'delete_address_group':
        check_auth();
        $username = $_SESSION['username'];
        $id = intval($_POST['id'] ?? 0);
        
        $stmtName = $db->prepare("SELECT name FROM address_groups WHERE id = :id AND username = :username");
        $stmtName->execute([':id' => $id, ':username' => $username]);
        $gname = $stmtName->fetchColumn();
        
        if (!$gname) {
            respond(false, '존재하지 않는 그룹입니다.');
        }
        if ($gname === '미정') {
            respond(false, '기본 그룹(미정)은 삭제할 수 없습니다.');
        }
        
        $stmtUpdate = $db->prepare("UPDATE address_book SET group_name = '미정' WHERE username = :username AND group_name = :group_name");
        $stmtUpdate->execute([':username' => $username, ':group_name' => $gname]);
        
        $stmtDel = $db->prepare("DELETE FROM address_groups WHERE id = :id AND username = :username");
        $stmtDel->execute([':id' => $id, ':username' => $username]);
        
        respond(true, '그룹이 삭제되었습니다.');
        break;

    case 'set_address_group_color':
        check_auth();
        $username = $_SESSION['username'];
        $id = intval($_POST['id'] ?? 0);
        $color = trim($_POST['color'] ?? '');
        if ($id <= 0 || empty($color)) {
            respond(false, '올바르지 않은 요청입니다.');
        }
        $stmt = $db->prepare("UPDATE address_groups SET color = :color WHERE id = :id AND username = :username");
        $stmt->execute([':color' => $color, ':id' => $id, ':username' => $username]);
        respond(true, '그룹 색상이 변경되었습니다.');
        break;

    case 'rename_address_group':
        check_auth();
        $username = $_SESSION['username'];
        $id = intval($_POST['id'] ?? 0);
        $new_name = trim($_POST['name'] ?? '');
        if ($id <= 0 || empty($new_name)) {
            respond(false, '그룹 이름을 입력해주세요.');
        }
        
        $stmtOld = $db->prepare("SELECT name FROM address_groups WHERE id = :id AND username = :username");
        $stmtOld->execute([':id' => $id, ':username' => $username]);
        $old_name = $stmtOld->fetchColumn();
        
        if (!$old_name) {
            respond(false, '존재하지 않는 그룹입니다.');
        }
        if ($old_name === '미정') {
            respond(false, '기본 그룹(미정)은 변경할 수 없습니다.');
        }
        if ($new_name === '미정') {
            respond(false, '그룹 이름을 "미정"으로 변경할 수 없습니다.');
        }

        try {
            $db->beginTransaction();
            
            $stmt = $db->prepare("UPDATE address_groups SET name = :new_name WHERE id = :id AND username = :username");
            $stmt->execute([':new_name' => $new_name, ':id' => $id, ':username' => $username]);
            
            $stmtBook = $db->prepare("SELECT id, group_name FROM address_book WHERE username = :username");
            $stmtBook->execute([':username' => $username]);
            $contacts = $stmtBook->fetchAll(PDO::FETCH_ASSOC);
            
            $stmtUpdateBook = $db->prepare("UPDATE address_book SET group_name = :group_name WHERE id = :id");
            foreach ($contacts as $c) {
                $groups = explode(',', $c['group_name']);
                $changed = false;
                foreach ($groups as $idx => $g) {
                    if (trim($g) === $old_name) {
                        $groups[$idx] = $new_name;
                        $changed = true;
                    }
                }
                if ($changed) {
                    $new_group_string = implode(', ', array_map('trim', $groups));
                    $stmtUpdateBook->execute([':group_name' => $new_group_string, ':id' => $c['id']]);
                }
            }
            
            $db->commit();
            respond(true, '그룹 이름이 변경되었습니다.');
        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            respond(false, '그룹 이름 변경 실패: ' . $e->getMessage());
        }
        break;

    case 'update_address_group_order':
        check_auth();
        $username = $_SESSION['username'];
        $order = json_decode($_POST['order'] ?? '[]', true);
        if (!is_array($order)) {
            respond(false, '잘못된 순서 데이터입니다.');
        }
        try {
            $db->beginTransaction();
            $stmt = $db->prepare("UPDATE address_groups SET sort_order = :sort_order WHERE id = :id AND username = :username");
            foreach ($order as $index => $id) {
                $stmt->execute([
                    ':sort_order' => $index,
                    ':id' => intval($id),
                    ':username' => $username
                ]);
            }
            $db->commit();
            respond(true, '그룹 순서가 저장되었습니다.');
        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            respond(false, '그룹 순서 저장 실패: ' . $e->getMessage());
        }
        break;

    default:

        respond(false, '잘못된 요청입니다.');
        break;
}

function save_auto_senders_batch(string $username, PDO $db, array $from_strings): void {
    if (empty($from_strings)) return;
    $db->beginTransaction();
    $stmt = $db->prepare("INSERT OR IGNORE INTO auto_senders (username, name, email) VALUES (:username, :name, :email)");
    foreach ($from_strings as $from_raw) {
        $parts = str_getcsv($from_raw, ',', '"');
        foreach ($parts as $part) {
            $part = trim($part);
            if (empty($part)) continue;
            if (preg_match('/^(.*?)<([^>]+)>/', $part, $matches)) {
                $name = trim($matches[1], " '\"");
                $email = trim($matches[2]);
            } else {
                $name = '';
                $email = trim($part);
            }
            $email_lower = strtolower($email);
            if (filter_var($email_lower, FILTER_VALIDATE_EMAIL)) {
                $stmt->execute([
                    ':username' => $username,
                    ':name' => $name ? $name : '미정',
                    ':email' => $email_lower
                ]);
            }
        }
    }
    $db->commit();
}

function check_and_seed_address_groups(string $username, PDO $db): void {
    $stmt = $db->prepare("SELECT COUNT(*) FROM address_groups WHERE username = :username");
    $stmt->execute([':username' => $username]);
    if ($stmt->fetchColumn() == 0) {
        $default_groups = ['미정', '친구', '가족', '업무'];
        $stmtInsert = $db->prepare("INSERT OR IGNORE INTO address_groups (username, name) VALUES (:username, :name)");
        foreach ($default_groups as $g) {
            $stmtInsert->execute([':username' => $username, ':name' => $g]);
        }
    }
}

function get_received_senders(string $username, PDO $db): array {
    // Sync INBOX cache first to make sure it's up to date
    sync_folder_cache($username, 'INBOX', $db);
    
    // Query cached emails from DB
    $stmt = $db->prepare("SELECT `from`, `to`, cc FROM cached_emails WHERE username = :username AND folder = 'INBOX'");
    $stmt->execute([':username' => $username]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $strings_to_save = [];
    foreach ($rows as $row) {
        if (!empty($row['from'])) $strings_to_save[] = $row['from'];
        if (!empty($row['to'])) $strings_to_save[] = $row['to'];
        if (!empty($row['cc'])) $strings_to_save[] = $row['cc'];
    }
    
    save_auto_senders_batch($username, $db, $strings_to_save);
    
    // Fetch all from auto_senders
    $stmtAuto = $db->prepare("SELECT name, email FROM auto_senders WHERE username = :username");
    $stmtAuto->execute([':username' => $username]);
    $auto_list = $stmtAuto->fetchAll(PDO::FETCH_ASSOC);

    // Filter out already registered ones
    $stmt = $db->prepare("SELECT email FROM address_book WHERE username = :username");
    $stmt->execute([':username' => $username]);
    $existing_emails = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $existing_emails_map = array_flip(array_map('strtolower', $existing_emails));

    foreach ($auto_list as $row) {
        $email_lower = strtolower($row['email']);
        if (!isset($existing_emails_map[$email_lower])) {
            $senders[$email_lower] = [
                'name' => $row['name'],
                'email' => $row['email'],
                'group_name' => '미정'
            ];
        }
    }
    
    return array_values($senders);
}

function test_smtp_connection($smtp_host, $smtp_port, $smtp_ssl, $smtp_user, $smtp_pass, $smtp_auth) {
    $err_str = ''; $err_no = 0;
    $sock = ($smtp_ssl === 'ssl')
        ? @fsockopen("ssl://$smtp_host", $smtp_port, $err_no, $err_str, 10)
        : @fsockopen($smtp_host, $smtp_port, $err_no, $err_str, 10);
    if (!$sock) {
        return "SMTP 연결 실패: $err_str ($err_no)";
    }

    $rd = function() use ($sock) {
        $d = '';
        while ($l = fgets($sock, 512)) { 
            $d .= $l; 
            if (isset($l[3]) && $l[3] === ' ') break; 
        }
        return $d;
    };
    $sd = function(string $c) use ($sock, $rd) { 
        fwrite($sock, $c . "\r\n"); 
        return $rd(); 
    };

    $rd();
    $ehlo = gethostname() ?: 'localhost';
    $r = $sd("EHLO $ehlo");

    if ($smtp_ssl === 'tls') {
        $r = $sd("STARTTLS");
        if (substr(trim($r), 0, 3) !== '220') {
            fclose($sock);
            return "SMTP STARTTLS 시작 실패: " . trim($r);
        }
        stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $r = $sd("EHLO $ehlo");
    }

    if ($smtp_auth && !empty($smtp_user)) {
        $r = $sd("AUTH LOGIN");
        if (substr(trim($r), 0, 3) !== '334') {
            fclose($sock);
            return "SMTP 인증 요청 실패: " . trim($r);
        }
        $r = $sd(base64_encode($smtp_user));
        if (substr(trim($r), 0, 3) !== '334') {
            fclose($sock);
            return "SMTP 사용자명 전송 실패: " . trim($r);
        }
        $r = $sd(base64_encode($smtp_pass));
        if (substr(trim($r), 0, 3) !== '235') {
            fclose($sock);
            return "SMTP 비밀번호 인증 실패: " . trim($r);
        }
    }

    $sd("QUIT");
    fclose($sock);
    return true;
}

function test_imap_connection($host, $port, $ssl, $user, $pass) {
    $err_str = ''; $err_no = 0;
    $sock = ($ssl === 'ssl')
        ? @fsockopen("ssl://$host", $port, $err_no, $err_str, 10)
        : @fsockopen($host, $port, $err_no, $err_str, 10);
    if (!$sock) {
        return "IMAP 연결 실패: $err_str ($err_no)";
    }

    $rd = function() use ($sock) {
        return fgets($sock, 1024);
    };

    $rd(); // greeting

    if ($ssl === 'tls') {
        fwrite($sock, "A001 STARTTLS\r\n");
        $r = $rd();
        if (strpos(strtoupper($r), 'A001 OK') === false) {
            fclose($sock);
            return "IMAP STARTTLS 실패: " . trim($r);
        }
        stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
    }

    $user_escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], $user);
    $pass_escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], $pass);
    fwrite($sock, "A002 LOGIN \"$user_escaped\" \"$pass_escaped\"\r\n");
    
    $login_ok = false;
    $error_msg = 'IMAP 로그인 실패';
    while ($line = fgets($sock, 1024)) {
        if (strpos($line, 'A002 OK') !== false) {
            $login_ok = true;
            break;
        } elseif (strpos($line, 'A002 NO') !== false || strpos($line, 'A002 BAD') !== false) {
            $error_msg = trim($line);
            break;
        }
    }

    if (!$login_ok) {
        fclose($sock);
        return $error_msg;
    }

    fwrite($sock, "A003 LOGOUT\r\n");
    fclose($sock);
    return true;
}

function imap_utf7_to_utf8($str) {
    $result = '';
    $len = strlen($str);
    for ($i = 0; $i < $len; $i++) {
        $c = $str[$i];
        if ($c === '&') {
            if ($i + 1 < $len && $str[$i + 1] === '-') {
                $result .= '&';
                $i++;
            } else {
                $end = strpos($str, '-', $i + 1);
                if ($end === false) {
                    $base64 = substr($str, $i + 1);
                    $i = $len;
                } else {
                    $base64 = substr($str, $i + 1, $end - $i - 1);
                    $i = $end;
                }
                $base64_std = str_replace(',', '/', $base64);
                $pad = strlen($base64_std) % 4;
                if ($pad) {
                    $base64_std .= str_repeat('=', 4 - $pad);
                }
                $decoded = base64_decode($base64_std);
                if ($decoded !== false) {
                    $utf8 = mb_convert_encoding($decoded, 'UTF-8', 'UTF-16BE');
                    if ($utf8 !== false) {
                        $result .= $utf8;
                    } else {
                        $utf8 = iconv('UTF-16BE', 'UTF-8', $decoded);
                        if ($utf8 !== false) {
                            $result .= $utf8;
                        }
                    }
                }
            }
        } else {
            $result .= $c;
        }
    }
    return $result;
}

class SimpleIMAPClient {
    private $sock;
    private $tag_count = 1;

    public function connect($host, $port, $ssl, $user, $pass) {
        $err_str = ''; $err_no = 0;
        $this->sock = ($ssl === 'ssl')
            ? @fsockopen("ssl://$host", $port, $err_no, $err_str, 15)
            : @fsockopen($host, $port, $err_no, $err_str, 15);
        if (!$this->sock) {
            throw new Exception("IMAP 연결 실패: $err_str ($err_no)");
        }

        fgets($this->sock, 1024); // greeting

        if ($ssl === 'tls') {
            $r = $this->send_cmd("STARTTLS");
            if (strpos(strtoupper($r), 'OK') === false) {
                throw new Exception("IMAP STARTTLS 실패: $r");
            }
            stream_socket_enable_crypto($this->sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        }

        $user_escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], $user);
        $pass_escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], $pass);
        $r = $this->send_cmd("LOGIN \"$user_escaped\" \"$pass_escaped\"");
        if (strpos(strtoupper($r), 'OK') === false) {
            throw new Exception("IMAP 로그인 실패: " . trim($r));
        }
    }

    private function send_cmd($cmd_text) {
        $tag = sprintf("A%03d", $this->tag_count++);
        fwrite($this->sock, "$tag $cmd_text\r\n");
        $response = '';
        while ($line = fgets($this->sock, 4096)) {
            $response .= $line;
            if (strpos($line, "$tag ") === 0) {
                break;
            }
        }
        return $response;
    }

    public function select($folder) {
        $folder_escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], $folder);
        $r = $this->send_cmd("SELECT \"$folder_escaped\"");
        if (strpos(strtoupper($r), 'OK') === false) {
            throw new Exception("IMAP 폴더 선택 실패: " . trim($r));
        }
        
        $exists = 0;
        if (preg_match('/\* (\d+) EXISTS/i', $r, $m)) {
            $exists = intval($m[1]);
        }
        return $exists;
    }

    public function get_folders() {
        $r = $this->send_cmd('LIST "" "*"');
        $folders = [];
        $lines = explode("\n", $r);
        foreach ($lines as $line) {
            if (preg_match('/\* LIST \((.*?)\) ".*?" (.+)$/i', $line, $m)) {
                $attrs = explode(' ', str_replace('\\', '', $m[1]));
                $path = trim($m[2], " \r\n\"");
                
                $decoded_path = imap_utf7_to_utf8($path);
                
                $type = 'custom';
                $lower_path = mb_strtolower($decoded_path, 'UTF-8');
                if ($lower_path === 'inbox') {
                    $type = 'inbox';
                } elseif ($lower_path === 'sent' || strpos($lower_path, 'sent') !== false || strpos($lower_path, '보낸') !== false) {
                    $type = 'sent';
                } elseif ($lower_path === 'trash' || strpos($lower_path, 'trash') !== false || strpos($lower_path, '휴지통') !== false || strpos($lower_path, '삭제') !== false) {
                    $type = 'trash';
                } elseif ($lower_path === 'drafts' || strpos($lower_path, 'drafts') !== false || strpos($lower_path, '임시') !== false) {
                    $type = 'drafts';
                } elseif ($lower_path === 'spam' || strpos($lower_path, 'spam') !== false || strpos($lower_path, '스팸') !== false || strpos($lower_path, 'junk') !== false) {
                    $type = 'spam';
                }

                $folders[] = [
                    'path' => $path,
                    'type' => $type,
                    'is_hidden' => 0
                ];
            }
        }
        return $folders;
    }

    public function fetch_headers_range($start, $end) {
        $tag = sprintf("A%03d", $this->tag_count++);
        fwrite($this->sock, "$tag FETCH $start:$end (FLAGS RFC822.SIZE INTERNALDATE UID BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO CC DATE)])\r\n");
        
        $emails = [];
        $current_item = null;
        $in_header = false;
        $header_data = '';
        $header_bytes_left = 0;

        while ($line = fgets($this->sock, 8192)) {
            if ($in_header) {
                $len = strlen($line);
                if ($len >= $header_bytes_left) {
                    $actual_bytes = $header_bytes_left;
                    $header_data .= substr($line, 0, $actual_bytes);
                    $in_header = false;
                    $header_bytes_left = 0;
                    
                    if ($current_item) {
                        $parsed = $this->parse_headers($header_data);
                        $current_item = array_merge($current_item, $parsed);
                        $emails[] = $current_item;
                        $current_item = null;
                    }
                    
                    $rest = substr($line, $actual_bytes);
                    if (count($emails) > 0 && preg_match('/UID (\d+)/i', $rest, $uid_m)) {
                        $emails[count($emails) - 1]['uid'] = intval($uid_m[1]);
                    }
                    
                    if (preg_match('/\* (\d+) FETCH \((.+)/i', $rest, $m)) {
                        $current_item = [
                            'seq' => intval($m[1]),
                            'uid' => intval($m[1]),
                            'seen' => (strpos(strtolower($m[2]), '\\seen') !== false) ? 1 : 0,
                            'flagged' => (strpos(strtolower($m[2]), '\\flagged') !== false) ? 1 : 0,
                        ];
                        if (preg_match('/UID (\d+)/i', $rest, $uid_m)) {
                            $current_item['uid'] = intval($uid_m[1]);
                        }
                        if (preg_match('/INTERNALDATE "([^"]+)"/i', $rest, $date_m)) {
                            $current_item['timestamp'] = strtotime($date_m[1]);
                        }
                        if (preg_match('/BODY\[HEADER\.FIELDS.*?\] \{(\d+)\}/i', $rest, $bytes_m)) {
                            $header_bytes_left = intval($bytes_m[1]);
                            $in_header = true;
                            $header_data = '';
                        }
                    }
                } else {
                    $header_data .= $line;
                    $header_bytes_left -= $len;
                }
                continue;
            }

            if (strpos($line, "$tag ") === 0) {
                break;
            }
            
            if (!$in_header && !$current_item && count($emails) > 0 && preg_match('/^\s*UID (\d+)/i', $line, $uid_m)) {
                $emails[count($emails) - 1]['uid'] = intval($uid_m[1]);
            }

            if (preg_match('/\* (\d+) FETCH \((.+)/i', $line, $m)) {
                $current_item = [
                    'seq' => intval($m[1]),
                    'uid' => intval($m[1]),
                    'seen' => (strpos(strtolower($m[2]), '\\seen') !== false) ? 1 : 0,
                    'flagged' => (strpos(strtolower($m[2]), '\\flagged') !== false) ? 1 : 0,
                ];
                if (preg_match('/UID (\d+)/i', $line, $uid_m)) {
                    $current_item['uid'] = intval($uid_m[1]);
                }
                if (preg_match('/INTERNALDATE "([^"]+)"/i', $line, $date_m)) {
                    $current_item['timestamp'] = strtotime($date_m[1]);
                }
                if (preg_match('/BODY\[HEADER\.FIELDS.*?\] \{(\d+)\}/i', $line, $bytes_m)) {
                    $header_bytes_left = intval($bytes_m[1]);
                    $in_header = true;
                    $header_data = '';
                }
            }
        }
        return $emails;
    }

    private function parse_headers($header_text) {
        $headers = [];
        $lines = explode("\n", str_replace("\r", "", $header_text));
        $current_field = '';
        foreach ($lines as $line) {
            if (empty($line)) continue;
            if ($line[0] === ' ' || $line[0] === "\t") {
                if ($current_field) {
                    $headers[$current_field] .= ' ' . trim($line);
                }
            } else {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $current_field = strtoupper(trim($parts[0]));
                    $headers[$current_field] = trim($parts[1]);
                }
            }
        }

        $decode = function($str) {
            if (!$str) return '';
            return robust_decode_header($str);
        };

        $subject = isset($headers['SUBJECT']) ? $decode($headers['SUBJECT']) : '(제목 없음)';
        $from = isset($headers['FROM']) ? $decode($headers['FROM']) : '';
        $to = isset($headers['TO']) ? $decode($headers['TO']) : '';
        $cc = isset($headers['CC']) ? $decode($headers['CC']) : '';
        $date = isset($headers['DATE']) ? $headers['DATE'] : '';

        return [
            'subject' => $subject,
            'from' => $from,
            'to' => $to,
            'cc' => $cc,
            'date' => $date
        ];
    }

    public function fetch_body($uid) {
        $tag = sprintf("A%03d", $this->tag_count++);
        // Using BODY[] instead of BODY.PEEK[] so it gets automatically marked as read on server!
        fwrite($this->sock, "$tag UID FETCH $uid BODY[]\r\n");
        $body = '';
        $bytes_left = 0;
        $in_body = false;

        while ($line = fgets($this->sock, 16384)) {
            if ($in_body) {
                $len = strlen($line);
                if ($len >= $bytes_left) {
                    $body .= substr($line, 0, $bytes_left);
                    break;
                } else {
                    $body .= $line;
                    $bytes_left -= $len;
                }
                continue;
            }
            if (preg_match('/BODY\[\] \{(\d+)\}/i', $line, $m) || preg_match('/\* \d+ FETCH \(BODY\[\] \{(\d+)\}/i', $line, $m) || preg_match('/\* \d+ FETCH \(UID \d+ BODY\[\] \{(\d+)\}/i', $line, $m)) {
                $bytes_left = intval($m[1]);
                $in_body = true;
            }
        }
        
        while ($line = fgets($this->sock, 4096)) {
            if (strpos($line, "$tag ") === 0) {
                break;
            }
        }

        return $body;
    }

    public function mark_as_seen($uid) {
        $tag = sprintf("A%03d", $this->tag_count++);
        fwrite($this->sock, "$tag UID STORE $uid +FLAGS (\\Seen)\r\n");
        $response = '';
        while ($line = fgets($this->sock, 4096)) {
            $response .= $line;
            if (strpos($line, "$tag ") === 0) {
                break;
            }
        }
        return $response;
    }

    public function close() {
        if ($this->sock) {
            $this->send_cmd("LOGOUT");
            fclose($this->sock);
            $this->sock = null;
        }
    }
}

