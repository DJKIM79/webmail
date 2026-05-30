<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OnTo mail</title>
    <meta name="description" content="OnTo.kr 메일 서비스 - 안전하고 빠른 웹 메일 클라이언트">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="cropper.min.css?v=<?php echo filemtime('cropper.min.css'); ?>">
    <link rel="stylesheet" href="app.css?v=<?php echo filemtime('app.css'); ?>">
    <link rel="icon" type="image/x-icon" href="onto.ico">
</head>
<body>
    <div class="mesh-bg"></div>

    <!-- MAIN APP CONTAINER -->
    <div id="app" class="app-container hidden">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <img src="onto.png" alt="OnTo" class="logo-image">
                    <span class="logo-text">OnTo Webmail</span>
                </div>
            </div>

            <button id="btn-compose" class="btn-compose">
                <i class="fa-solid fa-pen-fancy"></i> <span>편지 쓰기</span>
            </button>

            <nav class="sidebar-nav">
                <a href="#" class="nav-item active" data-folder="INBOX">
                    <i class="fa-solid fa-inbox"></i>
                    <span class="nav-label">받은 편지함</span>
                    <span id="badge-unread" class="badge" style="display:none;">0</span>
                </a>
                <a href="#" class="nav-item" data-folder="Starred">
                    <i class="fa-solid fa-star" style="color: var(--color-warning, #f59e0b);"></i>
                    <span class="nav-label">즐겨찾기</span>
                </a>
                <a href="#" class="nav-item" data-folder="Sent">
                    <i class="fa-solid fa-paper-plane"></i>
                    <span class="nav-label">보낸 편지함</span>
                </a>
                <a href="#" class="nav-item" data-folder="Drafts">
                    <i class="fa-solid fa-file-signature"></i>
                    <span class="nav-label">임시 보관함</span>
                </a>
                <a href="#" class="nav-item" data-folder="Trash">
                    <i class="fa-solid fa-trash-can"></i>
                    <span class="nav-label">휴지통</span>
                </a>

                <!-- Collapsible Tags Menu -->
                <div class="tags-menu-container" id="tags-menu-container" style="position: relative;">
                    <div class="nav-item" id="btn-toggle-tags">
                        <i class="fa-solid fa-box-archive"></i>
                        <span class="nav-label">개인 보관함</span>
                        <button id="btn-manage-tags" class="btn-manage-tags-inline" title="보관함 관리"><i class="fa-solid fa-gear"></i></button>
                        <i class="fa-solid fa-chevron-down arrow-icon" id="tags-menu-arrow"></i>
                    </div>
                    
                    <!-- 접힌 상태에서 개인 보관함 클릭시 뜨는 풍선도움말 팝오버 -->
                    <div id="tags-popover" class="tags-popover hidden">
                        <div class="tags-popover-arrow"></div>
                        <div id="tags-popover-list" class="tags-popover-list">
                            <!-- Dynamic loading -->
                        </div>
                    </div>
                    
                    <div id="sidebar-tags-container" class="sidebar-tags hidden">
                        <!-- Dynamic tags list -->
                    </div>
                </div>
            </nav>

            <div class="sidebar-footer">
                <div class="user-profile-row">
                    <div class="user-profile" id="user-profile-trigger" style="cursor: pointer;" title="개인 설정">
                        <div class="avatar"><i class="fa-solid fa-user"></i></div>
                        <div class="user-info">
                            <span id="profile-name" class="name">사용자</span>
                            <span id="profile-email" class="email">user@onto.kr</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button id="btn-admin" class="btn-icon-footer hidden" title="관리자 메뉴">
                            <i class="fa-solid fa-user-gear"></i>
                        </button>
                        <button id="btn-logout" class="btn-icon-footer" title="로그아웃">
                            <i class="fa-solid fa-right-from-bracket"></i>
                        </button>
                    </div>
                </div>
            </div>
        </aside>

        <div class="resizer" id="resizer-sidebar"></div>

        <!-- Main Body -->
        <main class="main-content" id="main-content">
            <!-- Mail List Pane -->
            <section class="mail-list-pane" id="mail-list-pane">
                <div class="pane-header">
                    <div class="folder-title-wrapper">
                        <h2 id="folder-title">받은 편지함</h2>
                        <button id="btn-refresh" class="btn-refresh" title="새로고침">
                            <i class="fa-solid fa-rotate"></i>
                        </button>
                        <button type="button" id="btn-empty-trash" class="btn-empty-trash hidden" title="휴지통 비우기">
                            <i class="fa-solid fa-trash-arrow-up"></i> <span>휴지통 비우기</span>
                        </button>
                    </div>
                    <div class="pane-header-right">
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="mail-search" placeholder="제목 또는 사람 검색...">
                        </div>
                    </div>
                </div>
                <div id="mail-items-container" class="mail-items-list">
                    <!-- Dynamic rendering -->
                </div>
            </section>

            <div class="resizer" id="resizer-list"></div>

            <!-- Mail Reader Pane -->
            <section class="mail-reader-pane">
                <div id="reader-empty" class="reader-empty">
                    <i class="fa-regular fa-envelope-open"></i>
                    <p>메일을 선택하여 내용을 확인하세요.</p>
                </div>
                <div id="reader-content" class="reader-content hidden">
                    <div class="reader-header">
                        <div class="reader-header-top-row">
                            <h1 id="read-subject">메일 제목</h1>
                        </div>
                        <div class="read-meta">
                            <div class="meta-row">
                                <span class="meta-label">보낸 사람:</span>
                                <span id="read-from" class="meta-value">sender@onto.kr</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">받는 사람:</span>
                                <span id="read-to" class="meta-value">recipient@onto.kr</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">날짜:</span>
                                <span id="read-date" class="meta-value">2026-05-29 09:00</span>
                            </div>
                        </div>
                        <div class="reader-actions">
                            <button id="btn-reply" class="btn-action"><i class="fa-solid fa-reply"></i> 답장</button>
                            <button id="btn-forward" class="btn-action"><i class="fa-solid fa-share"></i> 전달</button>
                            <div class="dropdown-tag-move">
                                <button id="btn-move-tag" class="btn-action"><i class="fa-solid fa-box-archive"></i> 보관함 이동 <i class="fa-solid fa-caret-down"></i></button>
                                <div id="tag-move-dropdown-list" class="dropdown-content hidden">
                                    <!-- Dynamic tag list dropdown -->
                                </div>
                            </div>
                            <button id="btn-delete-mail" class="btn-action btn-danger-action"><i class="fa-solid fa-trash"></i> 삭제</button>
                        </div>
                        <div id="read-attachments" class="read-attachments hidden">
                            <div class="read-attachments-title"><i class="fa-solid fa-paperclip"></i> 첨부 파일 (<span id="attachments-count">0</span>)</div>
                            <div id="read-attachments-list" class="read-attachments-list"></div>
                        </div>
                    </div>
                    <div class="reader-body">
                        <iframe id="mail-body-frame" sandbox="allow-same-origin" title="Mail content"></iframe>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <!-- AUTHENTICATION DIALOG -->
    <div id="auth-modal" class="auth-overlay hidden">
        <div class="auth-card">
            <div class="auth-header">
                <h2>OnTo Webmail</h2>
            </div>
            <div class="auth-tabs">
                <button id="tab-login" class="auth-tab active">로그인</button>
                <button id="tab-register" class="auth-tab">계정 신청</button>
            </div>

            <!-- Login Form -->
            <form id="form-login" class="auth-form">
                <div class="form-group">
                    <label for="login-username">아이디 (Domain: @onto.kr)</label>
                    <div class="input-icon">
                        <i class="fa-solid fa-user"></i>
                        <input type="text" id="login-username" name="username" placeholder="아이디만 입력" required autocomplete="username" inputmode="url" autocorrect="off" autocapitalize="none">
                    </div>
                </div>
                <div class="form-group">
                    <label for="login-password">암호</label>
                    <div class="input-icon">
                        <i class="fa-solid fa-lock"></i>
                        <input type="password" id="login-password" name="password" placeholder="암호 입력" required autocomplete="current-password" autocorrect="off" autocapitalize="none">
                    </div>
                </div>
                <div class="form-group keep-logged-in-wrapper">
                    <label for="login-keep">로그인 유지</label>
                    <input type="checkbox" id="login-keep" name="keep">
                </div>
                <button type="submit" class="btn-submit">로그인</button>
            </form>

            <!-- Register Form -->
            <form id="form-register" class="auth-form hidden">
                <div style="display:none;">
                    <input type="text" name="email_honeypot" id="email_honeypot" tabindex="-1" autocomplete="off">
                </div>
                <input type="hidden" name="form_load_time" id="form-load-time">

                <div class="form-row">
                    <div class="form-group">
                        <label for="reg-username">아이디</label>
                        <div class="input-icon">
                            <i class="fa-solid fa-user-plus"></i>
                            <input type="text" id="reg-username" name="username" placeholder="아이디 입력" required inputmode="url" autocorrect="off" autocapitalize="none">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="reg-password">암호</label>
                        <div class="input-icon">
                            <i class="fa-solid fa-lock"></i>
                            <input type="password" id="reg-password" name="password" placeholder="암호 입력" required autocorrect="off" autocapitalize="none">
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="reg-name">이름</label>
                        <div class="input-icon">
                            <i class="fa-solid fa-signature"></i>
                            <input type="text" id="reg-name" name="name" placeholder="실명 입력" required>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>봇 방지 코드</label>
                        <div class="captcha-row">
                            <div class="captcha-container">
                                <img id="captcha-img" src="bot_check.php" alt="Bot Check Challenge">
                                <button type="button" id="btn-reload-captcha" class="btn-reload" title="새로고침">
                                    <i class="fa-solid fa-rotate"></i>
                                </button>
                            </div>
                            <input type="number" id="reg-captcha" name="captcha" class="captcha-input-plain" placeholder="답 입력" required>
                        </div>
                    </div>
                </div>
                
                <button type="submit" class="btn-submit">가입 신청</button>
            </form>
        </div>
    </div>

    <!-- COMPOSE MODAL -->
    <div id="compose-modal" class="compose-overlay hidden">
        <div class="compose-card">
            <div class="compose-header">
                <h3><i class="fa-solid fa-pen-to-square" style="margin-right: 8px; opacity: 0.8;"></i>새 메일 작성</h3>
                <button id="btn-close-compose" class="btn-close" title="닫기"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <form id="form-compose" class="compose-form">
                <div class="compose-field">
                    <label for="mail-to">받는 사람</label>
                    <input type="email" id="mail-to" name="to" placeholder="recipient@example.com" required>
                </div>
                <div class="compose-field">
                    <label for="mail-subject">제목</label>
                    <input type="text" id="mail-subject" name="subject" placeholder="메일 제목 입력" required>
                </div>
                <div class="compose-body">
                    <textarea id="mail-body" name="body" placeholder="여기에 메일 내용을 작성하세요..." required></textarea>
                </div>
                <div class="compose-attachments-zone" id="compose-attachments-zone">
                    <div class="attachments-list" id="attachments-list"></div>
                    <div class="attachments-upload-btn-row">
                        <label for="file-attachments" class="btn-attach-label">
                            <i class="fa-solid fa-paperclip"></i> 파일 첨부
                        </label>
                        <input type="file" id="file-attachments" multiple style="display: none;">
                        <span class="drag-drop-hint">또는 파일을 여기에 끌어다 놓으세요</span>
                    </div>
                </div>
                <div class="compose-footer">
                    <button type="submit" class="btn-send"><i class="fa-solid fa-paper-plane"></i> 보내기</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ADMIN MODAL -->
    <div id="admin-modal" class="admin-overlay hidden">
        <div class="admin-card">
            <div class="admin-header">
                <h3><i class="fa-solid fa-user-gear"></i> 회원 관리</h3>
                <div class="admin-header-actions">
                    <button id="btn-open-admin-create" class="btn-admin-add-user-icon" title="신규 회원 추가">
                        <i class="fa-solid fa-user-plus"></i>
                    </button>
                    <button id="btn-open-groups" class="btn-admin-groups-icon" title="그룹 관리">
                        <i class="fa-solid fa-users-gear"></i>
                    </button>
                </div>
            </div>
            <div class="admin-body">
                <div class="table-responsive">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>아이디</th>
                                <th>이름</th>
                                <th>
                                    <div class="header-filter-wrapper">
                                        <div id="header-group-filter-dropdown" class="multi-group-dropdown header-filter-dropdown">
                                            <button class="btn-multi-group-trigger" type="button" id="btn-header-filter-trigger">
                                                <span>전체</span> <i class="fa-solid fa-caret-down"></i>
                                            </button>
                                            <div id="header-group-filter-options" class="multi-group-options hidden">
                                                <!-- Dynamic -->
                                            </div>
                                        </div>
                                    </div>
                                </th>
                                <th>신청일</th>
                                <th>상태</th>
                                <th></th>
                                </tr>
                        </thead>
                        <tbody id="admin-user-list">
                            <!-- Dynamic rendering -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- ADMIN CREATE USER MODAL -->
    <div id="admin-create-user-modal" class="admin-create-overlay hidden">
        <div class="admin-create-card">
            <div class="admin-create-header">
                <h3><i class="fa-solid fa-user-plus"></i> 신규 회원 추가</h3>
            </div>
            <form id="form-admin-create-user" class="admin-create-form-modal">
                <div class="form-group">
                    <label for="adm-username">아이디 (Domain: @onto.kr)</label>
                    <div class="input-icon">
                        <i class="fa-solid fa-user"></i>
                        <input type="text" id="adm-username" name="username" placeholder="아이디만 입력 (예: test)" required>
                    </div>
                </div>
                <div class="form-group">
                    <label for="adm-name">이름</label>
                    <div class="input-icon">
                        <i class="fa-solid fa-signature"></i>
                        <input type="text" id="adm-name" name="name" placeholder="이름 입력" required>
                    </div>
                </div>
                <div class="form-group">
                    <label for="adm-password">임시 암호</label>
                    <div class="input-icon">
                        <i class="fa-solid fa-lock"></i>
                        <input type="password" id="adm-password" name="password" placeholder="암호 입력" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>그룹 지정 (1개 이상 선택)</label>
                    <div id="adm-group-checklist" class="group-checklist-container">
                        <!-- Dynamic group list checkboxes -->
                    </div>
                </div>
                <button type="submit" class="btn-submit">회원 추가</button>
            </form>
        </div>
    </div>

    <!-- TAGS MANAGEMENT MODAL -->
    <div id="tags-modal" class="tags-overlay hidden">
        <div class="tags-card">
            <div class="tags-header">
                <h3><i class="fa-solid fa-folder-open"></i> 개인 폴더 관리</h3>
                <div class="tags-header-actions">
                    <button id="btn-open-tag-create" class="btn-tag-add-icon" title="새 폴더 추가">
                        <i class="fa-solid fa-folder-plus"></i>
                    </button>
                </div>
            </div>
            <div class="tags-body">
                <div class="tags-list-container">
                    <table class="tags-table">
                        <thead>
                            <tr>
                                <th>폴더 이름</th>
                                <th style="width: 80px; text-align: center;">작업</th>
                            </tr>
                        </thead>
                        <tbody id="tags-modal-list">
                            <!-- Dynamic tag management items -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- TAG CREATE MODAL -->
    <div id="tag-create-modal" class="tag-create-overlay hidden">
        <div class="tag-create-card">
            <div class="tag-create-header">
                <h3><i class="fa-solid fa-folder-plus"></i> 새 폴더 생성</h3>
            </div>
            <form id="form-create-tag" class="tag-create-form-modal">
                <div class="form-group">
                    <input type="text" id="new-tag-name" placeholder="폴더 이름을 입력하세요." required autocomplete="off">
                </div>
                <div class="tag-create-footer">
                    <button type="submit" class="btn-submit">생성</button>
                </div>
            </form>
        </div>
    </div>

    <!-- TAG COLOR POPOVER -->
    <div id="tag-color-popover" class="tag-color-popover hidden">
        <div class="tag-color-grid" id="tag-color-grid">
            <!-- Dynamic 10 colors -->
        </div>
    </div>

    <!-- GROUPS MANAGEMENT MODAL -->
    <div id="groups-modal" class="groups-overlay hidden">
        <div class="groups-card">
            <div class="groups-header">
                <h3><i class="fa-solid fa-users-gear"></i> 그룹 관리</h3>
            </div>
            <div class="groups-body">
                <form id="form-create-group" class="groups-create-form">
                    <div class="form-group-row">
                        <input type="text" id="new-group-name" placeholder="새 그룹 이름 입력" required>
                        <button type="submit" class="btn-add-group-submit"><i class="fa-solid fa-plus"></i> 추가</button>
                    </div>
                </form>
                <div class="groups-list-container">
                    <table class="groups-table">
                        <thead>
                            <tr>
                                <th>그룹 이름</th>
                                <th style="width: 220px; text-align: center;">작업</th>
                            </tr>
                        </thead>
                        <tbody id="groups-modal-list">
                            <!-- Dynamic groups list -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- LOCKED USER MODAL -->
    <div id="locked-modal" class="locked-overlay hidden">
        <div class="locked-card">
            <div class="locked-header">
                <h3><i class="fa-solid fa-user-lock" style="color: var(--color-danger);"></i> 계정 잠금 안내</h3>
                <button id="btn-close-locked" class="btn-close" title="닫기"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="locked-body">
                <p class="locked-msg">해당 계정은 보안 또는 관리자 정책에 의해 <strong>잠금 상태</strong>로 전환되었습니다.</p>
                <p class="locked-sub">서비스를 이용하시려면 관리자에게 잠금 해제를 요청하셔야 합니다.</p>
                <button id="btn-request-unlock" class="btn-submit btn-danger-action">
                    <i class="fa-solid fa-envelope-open-text"></i> 잠금 해제 요청하기
                </button>
            </div>
        </div>
    </div>

    <!-- SETTINGS MODAL -->
    <div id="settings-modal" class="settings-overlay hidden">
        <div class="settings-card">
            <div class="settings-header">
                <h3><i class="fa-solid fa-gear"></i> 개인 설정</h3>
            </div>
            <form id="form-settings" class="settings-form">
                <!-- 2컬럼 그리드 레이아웃 -->
                <div class="settings-grid">
                    <!-- 왼쪽 열: 프로필 -->
                    <div class="settings-col-left">
                        <div class="form-group profile-group">
                            <label>프로필</label>
                            <div class="profile-pic-container-custom">
                                <input type="file" id="profile-pic-input" accept="image/*" style="display: none;">
                                <!-- 프로필 클릭 영역 (동그란 형태) -->
                                <div class="profile-pic-clickable" id="btn-trigger-upload" title="사진 변경">
                                    <div class="profile-preview-wrapper">
                                        <img id="set-profile-preview" src="" alt="Profile Preview" class="profile-preview-img hidden">
                                        <div id="set-profile-placeholder" class="profile-preview-placeholder"><i class="fa-solid fa-user"></i></div>
                                    </div>
                                    <!-- 마우스 호버시 나타나는 사진 변경 오버레이 -->
                                    <div class="profile-overlay">
                                        <i class="fa-solid fa-camera"></i>
                                        <span>사진 변경</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 오른쪽 열: 아이디 -->
                    <div class="settings-col-right">
                        <div class="form-group">
                            <label>아이디</label>
                            <div class="input-icon">
                                <i class="fa-solid fa-envelope"></i>
                                <input type="text" id="set-username" readonly style="opacity: 0.6; cursor: not-allowed;">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="settings-grid">
                    <!-- 왼쪽 열: 이름 -->
                    <div class="settings-col-left">
                        <div class="form-group">
                            <label for="set-name">이름</label>
                            <div class="input-icon">
                                <i class="fa-solid fa-signature"></i>
                                <input type="text" id="set-name" name="name" required placeholder="이름 입력">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 오른쪽 열: 암호 -->
                    <div class="settings-col-right">
                        <div class="form-group">
                            <label for="set-password">암호</label>
                            <div class="input-icon">
                                <i class="fa-solid fa-lock"></i>
                                <input type="password" id="set-password" name="password" placeholder="암호 변경(필요시)">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 테마 설정 (전체 너비) -->
                <div class="form-group theme-group">
                    <label>테마 설정</label>
                    <div class="theme-selection-grid">
                        <button type="button" class="theme-btn red" data-theme="red" title="빨간색"></button>
                        <button type="button" class="theme-btn orange" data-theme="orange" title="주황색"></button>
                        <button type="button" class="theme-btn yellow" data-theme="yellow" title="노란색"></button>
                        <button type="button" class="theme-btn green" data-theme="green" title="초록색"></button>
                        <button type="button" class="theme-btn blue" data-theme="blue" title="파란색"></button>
                        <button type="button" class="theme-btn indigo" data-theme="indigo" title="남색"></button>
                        <button type="button" class="theme-btn violet" data-theme="violet" title="보라색"></button>
                        <button type="button" class="theme-btn white" data-theme="white" title="흰색"></button>
                        <button type="button" class="theme-btn black" data-theme="black" title="검정"></button>
                    </div>
                </div>

                <!-- 저장 버튼 (오른쪽 정렬) -->
                <div class="settings-footer">
                    <button type="submit" class="btn-submit btn-save-settings">설정 저장</button>
                </div>
            </form>
        </div>
    </div>

    <!-- PROFILE PICTURE CROP MODAL -->
    <div id="crop-modal" class="crop-overlay hidden">
        <div class="crop-card">
            <div class="crop-header">
                <h3><i class="fa-solid fa-crop"></i> 프로필 이미지 편집</h3>
                <button id="btn-close-crop" class="btn-close" title="닫기"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="crop-body">
                <div class="crop-container">
                    <img id="crop-image" src="" alt="Source Image">
                </div>
            </div>
            <div class="crop-footer">
                <button id="btn-apply-crop" class="btn-submit btn-save-settings"><i class="fa-solid fa-check"></i> 자르기 및 적용</button>
            </div>
        </div>
    </div>

    <!-- Context Menu -->
    <div id="mail-context-menu" class="context-menu hidden">
        <a class="context-item" id="ctx-reply"><i class="fa-solid fa-reply"></i> 답장</a>
        <div class="context-item has-submenu" id="ctx-move">
            <span><i class="fa-solid fa-box-archive"></i> 보관함 이동</span>
            <i class="fa-solid fa-chevron-right arrow"></i>
            <div class="context-submenu" id="ctx-move-list"></div>
        </div>
        <a class="context-item btn-danger-action" id="ctx-delete"><i class="fa-solid fa-trash"></i> 삭제</a>
    </div>

    <!-- Notifications Toast -->
    <div id="toast" class="toast hidden"></div>

    <script src="cropper.min.js?v=<?php echo filemtime('cropper.min.js'); ?>"></script>
    <script src="app.js?v=<?php echo filemtime('app.js'); ?>"></script>
    <script>
    (function() {
        var cropper = null;
        var cropModal = document.getElementById('crop-modal');
        var cropImage = document.getElementById('crop-image');
        var btnCloseCrop = document.getElementById('btn-close-crop');
        var btnApplyCrop = document.getElementById('btn-apply-crop');
        var profilePicInput = document.getElementById('profile-pic-input');
        var btnTriggerUpload = document.getElementById('btn-trigger-upload');

        // 바깥 영역 클릭 시 닫기
        if (cropModal) {
            cropModal.addEventListener('click', function(e) {
                if (e.target === cropModal) {
                    closeCropModal();
                }
            });
        }

        function closeCropModal() {
            if (cropModal) cropModal.classList.add('hidden');
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            if (profilePicInput) profilePicInput.value = '';
        }

        // 프로필 영역 클릭 → 파일 선택
        if (btnTriggerUpload && profilePicInput) {
            btnTriggerUpload.addEventListener('click', function() {
                profilePicInput.click();
            });
        }

        // 닫기 버튼
        if (btnCloseCrop) {
            btnCloseCrop.addEventListener('click', closeCropModal);
        }

        // 파일 선택 시 → 크롭 모달 열기
        if (profilePicInput) {
            profilePicInput.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;

                var url = URL.createObjectURL(file);

                // 기존 cropper 정리
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }

                // 이미지 src 설정
                cropImage.src = url;

                // 모달 표시
                cropModal.classList.remove('hidden');

                // Cropper 초기화 (ready 콜백으로 완료 보장)
                cropper = new Cropper(cropImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.85,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    background: false,
                    ready: function() {
                        // 크로퍼 준비 완료 - 이 시점에 모든 UI가 동작함
                        console.log('Cropper ready');
                    }
                });
            });
        }

        // 자르기 및 적용
        if (btnApplyCrop) {
            btnApplyCrop.addEventListener('click', function() {
                if (!cropper) return;

                var canvas = cropper.getCroppedCanvas({
                    width: 300,
                    height: 300,
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high'
                });

                if (!canvas) return;

                var quality = 0.8;
                var dataUrl = canvas.toDataURL('image/jpeg', quality);

                // 500KB 초과 시 자동 압축
                if (dataUrl.length * 0.75 > 500 * 1024) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                }
                if (dataUrl.length * 0.75 > 500 * 1024) {
                    var tiny = document.createElement('canvas');
                    tiny.width = 150; tiny.height = 150;
                    tiny.getContext('2d').drawImage(canvas, 0, 0, 150, 150);
                    dataUrl = tiny.toDataURL('image/jpeg', 0.5);
                }

                var previewImg = document.getElementById('set-profile-preview');
                var previewPlaceholder = document.getElementById('set-profile-placeholder');
                if (previewImg && previewPlaceholder) {
                    previewImg.src = dataUrl;
                    previewImg.classList.remove('hidden');
                    previewPlaceholder.classList.add('hidden');
                }

                closeCropModal();
            });
        }
    })();
    </script>
</body>
</html>
