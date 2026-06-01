<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OnTo Webmail</title>
    <meta name="description" content="OnTo.kr 메일 서비스 - 안전하고 빠른 웹 메일 클라이언트">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="cropper.min.css?v=<?php echo filemtime('cropper.min.css'); ?>">
    <link rel="stylesheet" href="app.css?v=<?php echo filemtime('app.css'); ?>">
    <link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>
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
                    <span class="logo-text">OnTo</span>
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
                    <span class="badge" style="display:none;">0</span>
                </a>
                <a href="#" class="nav-item" data-folder="Sent">
                    <i class="fa-solid fa-paper-plane"></i>
                    <span class="nav-label">보낸 편지함</span>
                    <span class="badge" style="display:none;">0</span>
                </a>
                <a href="#" class="nav-item" data-folder="Drafts">
                    <i class="fa-solid fa-file-signature"></i>
                    <span class="nav-label">임시 보관함</span>
                    <span class="badge" style="display:none;">0</span>
                </a>
                <a href="#" class="nav-item" data-folder="Spam">
                    <i class="fa-solid fa-ban"></i>
                    <span class="nav-label">스팸 메일함</span>
                    <span class="badge" style="display:none;">0</span>
                </a>
                <a href="#" class="nav-item" data-folder="Trash">
                    <i class="fa-solid fa-trash-can"></i>
                    <span class="nav-label">휴지통</span>
                    <span class="badge" style="display:none;">0</span>
                </a>

                <!-- Collapsible Tags Menu -->
                <div class="tags-menu-container" id="tags-menu-container" style="position: relative;">
                    <div class="nav-item" id="btn-toggle-tags">
                        <i class="fa-solid fa-box-archive"></i>
                        <span class="nav-label">개인 보관함</span>
                        <i class="fa-solid fa-caret-down arrow-icon" id="tags-menu-arrow"></i>
                        <span class="badge" id="badge-tags-combined" style="display:none;">0</span>
                    </div>
                    
                    <!-- 접힌 상태에서 개인 보관함 클릭시 뜨는 풍선도움말 팝오버 -->
                    <div id="tags-popover" class="tags-popover hidden">
                        <div class="tags-popover-arrow"></div>
                        <div id="tags-popover-list" class="tags-popover-list">
                            <!-- Dynamic loading -->
                        </div>
                    </div>
                    
                    <div id="sidebar-tags-wrapper" class="sidebar-tags-wrapper">
                        <div id="sidebar-tags-container" class="sidebar-tags">
                            <!-- Dynamic tags list -->
                        </div>
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
                        <button type="button" id="btn-empty-trash" class="btn-empty-trash hidden" title="휴지통 비우기" disabled>
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
                                <button id="btn-move-tag" class="btn-action"><i class="fa-solid fa-box-archive"></i> 이동 <i class="fa-solid fa-caret-down"></i></button>
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
                <img src="onto.png" alt="OnTo Logo" class="auth-logo">
                <h2>OnTo Webmail</h2>
            </div>
            <div class="auth-tabs">
                <button id="tab-login" class="auth-tab active">로그인</button>
                <button id="tab-register" class="auth-tab">계정 신청</button>
            </div>

            <!-- Login Form -->
            <form id="form-login" class="auth-form">
                <div class="form-group">
                    <label for="login-username">아이디</label>
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
                    <label for="mail-to-input">받는 이</label>
                    <div style="display: flex; gap: 8px; flex-grow: 1; align-items: center; position: relative;">
                        <div class="email-tag-container" id="mail-to-container">
                            <input type="text" id="mail-to-input" name="to" placeholder="받은 사람의 이메일 주소를 입력하세요." style="flex-grow: 1; height: 26px; box-sizing: border-box;">
                        </div>
                        <button type="button" id="btn-addressbook-popup" tabindex="-1" title="주소록 선택" style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; white-space: nowrap; width: 30px; height: 30px; box-sizing: border-box;">
                            <i class="fa-solid fa-address-book"></i>
                        </button>
                        <div id="autocomplete-list" class="autocomplete-items hidden" style="position: absolute; top: 32px; left: 0; width: 320px; max-width: 100%; background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
                    </div>
                </div>
                <div class="compose-field">
                    <label for="mail-cc-input">참조</label>
                    <div style="display: flex; gap: 8px; flex-grow: 1; align-items: center; position: relative;">
                        <div class="email-tag-container" id="mail-cc-container">
                            <input type="text" id="mail-cc-input" name="cc" placeholder="참조할 사람의 이메일 주소를 입력하세요." style="flex-grow: 1; height: 26px; box-sizing: border-box;">
                        </div>
                    </div>
                </div>
                <div class="compose-field">
                    <label for="mail-subject">제목</label>
                    <input type="text" id="mail-subject" name="subject" placeholder="메일 제목 입력" required style="height: 26px;">
                </div>
                <div class="compose-body" style="display: flex; flex-direction: column; position: relative; padding: 0;">
                    <textarea id="mail-body" name="body" class="hidden"></textarea>
                    <div id="quill-container" style="flex-grow: 1; display: flex; flex-direction: column; border-radius: 0; overflow: visible; height: 100%;">
                        <!-- Custom Formatting Toolbar Container -->
                        <div class="custom-toolbar-container">
                            <button type="button" class="custom-toolbar-nav-btn nav-left hidden" id="custom-toolbar-nav-left" title="왼쪽 스크롤">
                                <i class="fa-solid fa-angle-left"></i>
                            </button>
                            <div id="custom-editor-toolbar" class="custom-toolbar">
                            <!-- Font select -->
                            <div class="toolbar-dropdown-wrapper" id="dropdown-font-wrapper">
                                <button type="button" class="toolbar-dropdown-trigger" id="btn-toolbar-font">
                                    <span class="trigger-label">맑은 고딕</span>
                                    <i class="fa-solid fa-chevron-down caret-icon"></i>
                                </button>
                                <div class="toolbar-dropdown-menu font-menu hidden">
                                    <button type="button" class="font-item active" data-font="" style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">맑은 고딕</button>
                                    <button type="button" class="font-item" data-font="dotum" style="font-family: 'Dotum', '돋움', sans-serif;">돋움</button>
                                    <button type="button" class="font-item" data-font="gulim" style="font-family: 'Gulim', '굴림', sans-serif;">굴림</button>
                                    <button type="button" class="font-item" data-font="batang" style="font-family: 'Batang', '바탕', serif;">바탕</button>
                                    <button type="button" class="font-item" data-font="gungsuh" style="font-family: 'Gungsuh', '궁서', serif;">궁서</button>
                                </div>
                            </div>

                            <!-- Size select -->
                            <div class="toolbar-dropdown-wrapper" id="dropdown-size-wrapper">
                                <button type="button" class="toolbar-dropdown-trigger" id="btn-toolbar-size">
                                    <span class="trigger-label">11pt</span>
                                    <i class="fa-solid fa-chevron-down caret-icon"></i>
                                </button>
                                <div class="toolbar-dropdown-menu size-menu hidden">
                                    <button type="button" class="size-item" data-size="8pt" style="font-size: 8pt;">8pt</button>
                                    <button type="button" class="size-item" data-size="9pt" style="font-size: 9pt;">9pt</button>
                                    <button type="button" class="size-item" data-size="10pt" style="font-size: 10pt;">10pt</button>
                                    <button type="button" class="size-item active" data-size="11pt" style="font-size: 11pt;">11pt</button>
                                    <button type="button" class="size-item" data-size="12pt" style="font-size: 12pt;">12pt</button>
                                    <button type="button" class="size-item" data-size="14pt" style="font-size: 14pt;">14pt</button>
                                    <button type="button" class="size-item" data-size="16pt" style="font-size: 16pt;">16pt</button>
                                    <button type="button" class="size-item" data-size="20pt" style="font-size: 20pt;">20pt</button>
                                </div>
                            </div>

                            <div class="toolbar-separator"></div>

                            <!-- Text Styles -->
                            <div class="toolbar-btn-group">
                                <button type="button" class="toolbar-btn" data-format="bold" title="굵게 (Ctrl+B)">
                                    <i class="fa-solid fa-bold"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-format="italic" title="기울임 (Ctrl+I)">
                                    <i class="fa-solid fa-italic"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-format="underline" title="밑줄 (Ctrl+U)">
                                    <i class="fa-solid fa-underline"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-format="strike" title="취소선">
                                    <i class="fa-solid fa-strikethrough"></i>
                                </button>
                            </div>

                            <div class="toolbar-separator"></div>

                            <!-- Colors -->
                            <div class="toolbar-btn-group">
                                <!-- Text Color -->
                                <div class="toolbar-dropdown-wrapper" id="dropdown-color-wrapper">
                                    <button type="button" class="toolbar-btn has-indicator" id="btn-toolbar-color" title="글자 색상">
                                        <i class="fa-solid fa-font"></i>
                                        <span class="color-indicator text-indicator" id="indicator-text-color"></span>
                                    </button>
                                    <div class="toolbar-dropdown-menu color-menu hidden">
                                        <div class="color-palette-title">글자 색상</div>
                                        <div class="color-palette-grid">
                                            <button type="button" class="color-dot active" data-color="#f3f4f6" style="background-color: #f3f4f6;" title="기본"></button>
                                            <button type="button" class="color-dot" data-color="#111827" style="background-color: #111827;" title="검정"></button>
                                            <button type="button" class="color-dot" data-color="#ef4444" style="background-color: #ef4444;" title="빨강"></button>
                                            <button type="button" class="color-dot" data-color="#f97316" style="background-color: #f97316;" title="주황"></button>
                                            <button type="button" class="color-dot" data-color="#f59e0b" style="background-color: #f59e0b;" title="노랑"></button>
                                            <button type="button" class="color-dot" data-color="#10b981" style="background-color: #10b981;" title="초록"></button>
                                            <button type="button" class="color-dot" data-color="#3b82f6" style="background-color: #3b82f6;" title="파랑"></button>
                                            <button type="button" class="color-dot" data-color="#6366f1" style="background-color: #6366f1;" title="남색"></button>
                                            <button type="button" class="color-dot" data-color="#8b5cf6" style="background-color: #8b5cf6;" title="보라"></button>
                                            <button type="button" class="color-dot" data-color="#ec4899" style="background-color: #ec4899;" title="분홍"></button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Background/Highlight Color -->
                                <div class="toolbar-dropdown-wrapper" id="dropdown-bg-wrapper">
                                    <button type="button" class="toolbar-btn has-indicator" id="btn-toolbar-bg" title="배경 형광펜">
                                        <i class="fa-solid fa-highlighter"></i>
                                        <span class="color-indicator bg-indicator" id="indicator-bg-color"></span>
                                    </button>
                                    <div class="toolbar-dropdown-menu color-menu hidden">
                                        <div class="color-palette-title">형광펜 배경</div>
                                        <div class="color-palette-grid">
                                            <button type="button" class="color-dot active transparent-dot" data-bg="transparent" title="없음">
                                                <i class="fa-solid fa-ban"></i>
                                            </button>
                                            <button type="button" class="color-dot" data-bg="#ffcccc" style="background-color: #ffcccc;" title="연빨강"></button>
                                            <button type="button" class="color-dot" data-bg="#ffe6cc" style="background-color: #ffe6cc;" title="연주황"></button>
                                            <button type="button" class="color-dot" data-bg="#ffffcc" style="background-color: #ffffcc;" title="연노랑"></button>
                                            <button type="button" class="color-dot" data-bg="#ccffdd" style="background-color: #ccffdd;" title="연초록"></button>
                                            <button type="button" class="color-dot" data-bg="#cce6ff" style="background-color: #cce6ff;" title="연파랑"></button>
                                            <button type="button" class="color-dot" data-bg="#d9e6ff" style="background-color: #d9e6ff;" title="연남색"></button>
                                            <button type="button" class="color-dot" data-bg="#ece0ff" style="background-color: #ece0ff;" title="연보라"></button>
                                            <button type="button" class="color-dot" data-bg="#ffebff" style="background-color: #ffebff;" title="연분홍"></button>
                                            <button type="button" class="color-dot" data-bg="#f3f4f6" style="background-color: #f3f4f6;" title="회색"></button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="toolbar-separator"></div>

                            <!-- Alignment -->
                            <div class="toolbar-btn-group">
                                <button type="button" class="toolbar-btn" data-align="" title="왼쪽 정렬">
                                    <i class="fa-solid fa-align-left"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-align="center" title="가운데 정렬">
                                    <i class="fa-solid fa-align-center"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-align="right" title="오른쪽 정렬">
                                    <i class="fa-solid fa-align-right"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-align="justify" title="양쪽 정렬">
                                    <i class="fa-solid fa-align-justify"></i>
                                </button>
                            </div>

                            <div class="toolbar-separator"></div>

                            <!-- Lists -->
                            <div class="toolbar-btn-group">
                                <button type="button" class="toolbar-btn" data-list="bullet" title="글머리 기호">
                                    <i class="fa-solid fa-list-ul"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-list="ordered" title="번호 매기기">
                                    <i class="fa-solid fa-list-ol"></i>
                                </button>
                            </div>

                            <div class="toolbar-separator"></div>

                            <!-- Inserts -->
                            <div class="toolbar-btn-group">
                                <button type="button" class="toolbar-btn" data-insert="link" title="링크 삽입">
                                    <i class="fa-solid fa-link"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-insert="image" title="이미지 삽입">
                                    <i class="fa-solid fa-image"></i>
                                </button>
                                <div class="toolbar-dropdown-wrapper" id="dropdown-table-wrapper">
                                    <button type="button" class="toolbar-btn" data-insert="table" title="표 삽입">
                                        <i class="fa-solid fa-table"></i>
                                    </button>
                                    <div class="toolbar-dropdown-menu table-menu hidden">
                                        <div class="table-selector-title">표 삽입</div>
                                        <div class="table-selector-grid" id="table-selector-grid"></div>
                                        <div class="table-selector-info" id="table-selector-info">0 x 0</div>
                                    </div>
                                </div>
                                <button type="button" class="toolbar-btn" data-insert="blockquote" title="인용구">
                                    <i class="fa-solid fa-quote-left"></i>
                                </button>
                                <button type="button" class="toolbar-btn" data-insert="code-block" title="코드 블록">
                                    <i class="fa-solid fa-code"></i>
                                </button>
                            </div>

                            <div class="toolbar-separator"></div>

                            <!-- Clear -->
                            <button type="button" class="toolbar-btn" id="btn-toolbar-clean" title="서식 지우기">
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                            </div>
                            <button type="button" class="custom-toolbar-nav-btn nav-right hidden" id="custom-toolbar-nav-right" title="오른쪽 스크롤">
                                <i class="fa-solid fa-angle-right"></i>
                            </button>
                        </div>

                        <!-- Quill Editor -->
                        <div id="quill-editor" style="flex-grow: 1; min-height: 200px;"></div>
                    </div>
                </div>
                <div class="compose-attachments-zone" id="compose-attachments-zone">
                    <div class="attachments-list" id="attachments-list" style="display: none;"></div>
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

    <!-- COMPOSE CONFIRM MODAL -->
    <div id="compose-confirm-modal" class="compose-overlay hidden" style="z-index: 105;">
        <div class="auth-card" style="padding: 24px; width: 380px; align-items: stretch; justify-content: center;">
            <div style="font-size: 14px; color: var(--text-primary); margin-bottom: 24px;">
                메일 작성을 취소하면 작성 중인 내용도 삭제됩니다.
            </div>
            <div style="display: flex; justify-content: flex-end;">
                <button id="btn-compose-confirm-delete" class="btn-submit btn-danger-action" style="margin: 0; min-width: auto; padding: 8px 16px;">작성 취소</button>
            </div>
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
                                <th class="sortable" data-sort="username" style="width: 90px;">아이디 <i class="fa-solid fa-sort"></i></th>
                                <th class="sortable" data-sort="name" style="width: 90px;">이름 <i class="fa-solid fa-sort"></i></th>
                                <th class="col-group" style="width: 110px;">
                                    <div class="header-filter-wrapper">
                                        <div id="header-group-filter-dropdown" class="multi-group-dropdown header-filter-dropdown">
                                            <button class="btn-multi-group-trigger" type="button" id="btn-header-filter-trigger">
                                                <span>그룹</span> <i class="fa-solid fa-caret-down"></i>
                                            </button>
                                            <div id="header-group-filter-options" class="multi-group-options hidden">
                                                <!-- Dynamic -->
                                            </div>
                                        </div>
                                    </div>
                                </th>
                                <th class="sortable" data-sort="last_login" style="width: 110px;">마지막 로그인 <i class="fa-solid fa-sort"></i></th>
                                <th class="col-status" style="width: 90px;">
                                    <div class="header-filter-wrapper">
                                        <div id="header-status-filter-dropdown" class="multi-group-dropdown header-filter-dropdown">
                                            <button class="btn-multi-group-trigger" type="button" id="btn-header-status-filter-trigger">
                                                <span>상태</span> <i class="fa-solid fa-caret-down"></i>
                                            </button>
                                            <div id="header-status-filter-options" class="multi-group-options hidden">
                                                <label class="multi-group-option-label filter-all-label">
                                                    <input type="checkbox" id="chk-filter-status-all" value="all" checked>
                                                    <span>전체</span>
                                                </label>
                                                <label class="multi-group-option-label">
                                                    <input type="checkbox" class="chk-filter-status-item" value="approved" checked>
                                                    <span>활성화</span>
                                                </label>
                                                <label class="multi-group-option-label">
                                                    <input type="checkbox" class="chk-filter-status-item" value="locked" checked>
                                                    <span>잠금 중</span>
                                                </label>
                                                <label class="multi-group-option-label">
                                                    <input type="checkbox" class="chk-filter-status-item" value="pending" checked>
                                                    <span>승인 요청</span>
                                                </label>
                                                <label class="multi-group-option-label">
                                                    <input type="checkbox" class="chk-filter-status-item" value="rejected" checked>
                                                    <span>승인 거부</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </th>
                                <th style="width: 110px;"></th>
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
                    <div id="adm-group-dropdown" class="multi-group-dropdown full-width">
                        <button class="btn-multi-group-trigger" type="button" id="btn-adm-group-trigger">
                            <span>그룹을 선택하세요</span> <i class="fa-solid fa-caret-down"></i>
                        </button>
                        <div id="adm-group-options" class="multi-group-options hidden">
                            <!-- Dynamic group list checkboxes -->
                        </div>
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

    <!-- FILTERS MANAGEMENT MODAL -->
    <div id="filters-modal" class="tags-overlay hidden">
        <div class="tags-card">
            <div class="tags-header">
                <h3><i class="fa-solid fa-filter"></i> 메일 필터링 관리</h3>
                <div class="tags-header-actions">
                    <button id="btn-open-filter-create" class="btn-tag-add-icon" title="새 필터 추가">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
            <div class="tags-body">
                <div class="tags-list-container">
                    <table class="tags-table">
                        <thead>
                            <tr>
                                <th>필터 조건 및 동작</th>
                                <th style="width: 80px; text-align: center;">작업</th>
                            </tr>
                        </thead>
                        <tbody id="filters-modal-list">
                            <!-- Dynamic filter management items -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- FILTER CREATE MODAL -->
    <div id="filter-create-modal" class="tags-overlay hidden" style="z-index: 210;">
        <div class="tags-card" style="max-width: 450px; max-height: none;">
            <div class="tags-header">
                <h3 id="filter-modal-title"><i class="fa-solid fa-plus"></i> 새 필터 추가</h3>
            </div>
            <form id="form-create-filter" style="padding: 20px; display: flex; flex-direction: column; gap: 15px;">
                <input type="hidden" id="filter-id" name="id" value="">
                
                <div class="form-group-filter">
                    <label for="filter-title" style="font-weight: bold; margin-bottom: 5px; display: block; color: var(--text-primary);">필터 제목</label>
                    <input type="text" id="filter-title" name="title" placeholder="필터 이름을 입력하세요." required autocomplete="off"
                           style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background-color: var(--bg-secondary); color: var(--text-primary); outline: none;">
                </div>

                <div class="form-group-filter">
                    <label style="font-weight: bold; margin-bottom: 5px; display: block; color: var(--text-primary);">1. 대상 선택 (중복 가능)</label>
                    <div style="display: flex; gap: 15px; margin-top: 5px;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-primary); font-size: 14px;">
                            <input type="checkbox" id="chk-filter-from" name="filter_from" value="1"> 보낸이
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-primary); font-size: 14px;">
                            <input type="checkbox" id="chk-filter-subject" name="filter_subject" value="1"> 제목
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-primary); font-size: 14px;">
                            <input type="checkbox" id="chk-filter-body" name="filter_body" value="1"> 내용
                        </label>
                    </div>
                </div>

                <div class="form-group-filter">
                    <label for="filter-keywords" style="font-weight: bold; margin-bottom: 5px; display: block; color: var(--text-primary);">2. 키워드 입력 (쉼표 또는 공백 구분)</label>
                    <input type="text" id="filter-keywords" name="keywords" placeholder="예: 광고, 스팸, 회의" required autocomplete="off"
                           style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background-color: var(--bg-secondary); color: var(--text-primary); outline: none;">
                </div>

                <div class="form-group-filter">
                    <label for="filter-action" style="font-weight: bold; margin-bottom: 5px; display: block; color: var(--text-primary);">3. 실행할 작업</label>
                    <div class="custom-select-wrapper" style="margin-bottom: 10px;">
                        <select id="filter-action" name="action_val" required>
                            <option value="delete">삭제 (휴지통)</option>
                            <option value="move">이동 (보관함)</option>
                            <option value="copy">복사 (보관함)</option>
                            <option value="star">즐겨찾기</option>
                        </select>
                    </div>

                    <div id="filter-dest-folder-container" class="hidden">
                        <label for="filter-dest-folder" id="lbl-filter-dest-folder" style="font-weight: bold; margin-bottom: 5px; display: block; color: var(--text-primary); font-size: 13px;">이동/복사할 폴더 선택</label>
                        <div class="custom-select-wrapper">
                            <select id="filter-dest-folder" name="dest_folder">
                                <!-- Dynamic folder list options -->
                            </select>
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                    <button type="submit" id="btn-submit-filter" class="btn-submit">추가</button>
                </div>
            </form>
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
                                <th style="width: 140px; text-align: left;"></th>
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

    <!-- GROUP RENAME MODAL -->
    <div id="group-rename-modal" class="tag-create-overlay hidden">
        <div class="tag-create-card">
            <div class="tag-create-header">
                <h3><i class="fa-solid fa-pen-to-square"></i> 그룹 이름 변경</h3>
            </div>
            <form id="form-rename-group" class="tag-create-form-modal">
                <input type="hidden" id="rename-group-old-name">
                <div class="form-group">
                    <input type="text" id="rename-group-new-name" placeholder="새 이름을 입력하세요." required autocomplete="off">
                </div>
                <div class="tag-create-footer">
                    <button type="submit" class="btn-submit">변경</button>
                </div>
            </form>
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

    <!-- EXTERNAL MAIL SETTINGS MODAL -->
    <div id="external-mail-modal" class="tags-overlay hidden">
        <div class="tags-card external-mail-card" style="width: 600px; max-height: 85vh; height: 595px;">
            <div class="tags-header" style="flex-shrink: 0;">
                <h3><i class="fa-solid fa-at"></i> 외부 메일 설정</h3>
            </div>
            <div class="external-mail-body" style="display: flex; height: calc(100% - 53px); overflow: hidden;">
                <!-- 왼쪽 계정 목록 -->
                <div class="external-mail-list-pane" style="width: 200px; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.02); flex-shrink: 0;">
                    <div class="pane-action-bar" style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <span style="font-weight: bold; font-size: 13px; color: var(--text-primary);">계정 목록</span>
                        <button type="button" id="btn-add-external-mail" class="btn-submit" style="margin: 0; padding: 0; font-size: 11px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; min-width: 24px; flex-shrink: 0; align-self: auto;" title="계정 추가">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <div class="external-mail-accounts-list no-scrollbar" id="external-mail-accounts-list" style="padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex-grow: 1;">
                        <!-- Dynamic list of external mail accounts -->
                    </div>
                </div>
                
                <!-- 오른쪽 상세 설정 -->
                <div class="external-mail-detail-pane no-scrollbar" id="external-mail-detail-pane" style="flex-grow: 1; display: flex; flex-direction: column; background: rgba(0, 0, 0, 0.05); overflow-y: auto; padding: 20px;">
                    <div class="detail-placeholder" style="margin: auto; text-align: center; color: var(--text-muted); opacity: 0.6;">
                        <i class="fa-solid fa-envelope-open-text" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>
                        <span>메일 계정을 선택하거나 새 계정을 추가하세요.</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- SETTINGS MODAL -->
    <div id="settings-modal" class="settings-overlay hidden">
        <div class="settings-card">
            <div class="settings-header">
                <h3><i class="fa-solid fa-gear"></i> 개인 설정</h3>
                <div class="settings-header-actions" style="display:flex; align-items:center; gap:10px;">
                    <div id="mj-quota-container" style="display:none; align-items:center; gap:6px; cursor:pointer;" title="클릭하여 할당량 갱신">
                        <div id="mj-quota-days-left" style="border:1px solid var(--border-color); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; color:var(--text-secondary); transition:all 0.2s; min-width:35px; text-align:center;">...</div>
                        <div id="mj-quota-daily" style="border:1px solid var(--border-color); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; color:var(--text-secondary); transition:all 0.2s; min-width:40px; text-align:center;">...</div>
                        <div id="mj-quota-monthly" style="border:1px solid var(--border-color); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; color:var(--text-secondary); transition:all 0.2s; min-width:45px; text-align:center;">...</div>
                    </div>
                    <button type="button" id="btn-logout" class="btn-icon-settings btn-logout-settings" style="color:var(--color-primary);" title="로그아웃">
                        <span class="logout-icon-wrapper">
                            <span class="logout-bracket"></span>
                            <i class="fa-solid fa-arrow-right logout-arrow"></i>
                        </span>
                    </button>
                </div>
            </div>
            <form id="form-settings" class="settings-form">
                <div class="settings-grid-main">
                    <!-- 왼쪽 열: 프로필 사진 -->
                    <div class="settings-profile-col">
                        <div class="profile-pic-container-custom">
                            <input type="file" id="profile-pic-input" accept="image/*" style="display: none;">
                            <div class="profile-pic-clickable" id="btn-trigger-upload" title="사진 변경">
                                <div class="profile-preview-wrapper">
                                    <img id="set-profile-preview" src="" alt="Profile Preview" class="profile-preview-img hidden">
                                    <div id="set-profile-placeholder" class="profile-preview-placeholder"><i class="fa-solid fa-user"></i></div>
                                </div>
                                <div class="profile-overlay">
                                    <i class="fa-solid fa-camera"></i>
                                    <span>사진 변경</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 오른쪽 열: 입력 필드들 -->
                    <div class="settings-info-col">
                        <div class="form-group">
                            <label>아이디</label>
                            <div class="input-icon">
                                <i class="fa-solid fa-envelope"></i>
                                <input type="text" id="set-username" readonly>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="set-name">이름</label>
                            <div class="input-icon">
                                <i class="fa-solid fa-user"></i>
                                <input type="text" id="set-name" name="name" required placeholder="이름 입력">
                            </div>
                        </div>
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
                        <button type="button" class="theme-btn gray" data-theme="gray" title="회색"></button>
                        <button type="button" class="theme-btn black" data-theme="black" title="검정"></button>
                    </div>
                </div>

                <!-- 기타 설정 -->
                <div class="form-group etc-group" style="margin-top: 20px;">
                    <label>기타 설정</label>
                    <div class="etc-settings-row" style="display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; width: 100%;">
                        <button type="button" id="btn-manage-tags" class="btn-etc-settings" title="폴더 관리" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 13px; transition: all 0.2s; height: 32px;">
                            <i class="fa-solid fa-folder-tree" style="color: var(--color-primary);"></i>
                        </button>
                        <button type="button" id="btn-manage-filters" class="btn-etc-settings" title="메일 필터링" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 13px; transition: all 0.2s; height: 32px;">
                            <i class="fa-solid fa-filter" style="color: var(--color-primary);"></i>
                        </button>
                        <button type="button" id="btn-manage-signature" class="btn-etc-settings" title="서명 설정" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 13px; transition: all 0.2s; height: 32px;">
                            <i class="fa-solid fa-signature" style="color: var(--color-primary);"></i>
                        </button>
                        <button type="button" id="btn-manage-addressbook" class="btn-etc-settings" title="주소록" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 13px; transition: all 0.2s; height: 32px;">
                            <i class="fa-solid fa-address-book" style="color: var(--color-primary);"></i>
                        </button>
                        <button type="button" id="btn-manage-external-mail" class="btn-etc-settings" title="메일 설정" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 13px; transition: all 0.2s; height: 32px;">
                            <i class="fa-solid fa-at" style="color: var(--color-primary);"></i>
                        </button>
                        <button type="button" id="btn-admin" class="btn-etc-settings hidden" title="회원 관리" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 13px; transition: all 0.2s; height: 32px;">
                            <i class="fa-solid fa-user-gear" style="color: var(--color-primary);"></i>
                        </button>
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

    <!-- SIGNATURE SETTINGS MODAL -->
    <div id="signature-modal" class="tags-overlay hidden" style="z-index: 200;">
        <div class="tags-card" style="width: 480px; max-height: 80vh;">
            <div class="tags-header">
                <h3><i class="fa-solid fa-signature"></i> 서명 설정</h3>
            </div>
            <div class="tags-body" style="padding: 20px;">
                <form id="form-signature">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-primary); user-select: none;">
                            <input type="checkbox" id="sig-use" name="use_signature" style="width: 16px; height: 16px; margin: 0; padding: 0;">
                            <span>메일 발송 시 서명 사용</span>
                        </label>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="sig-content" style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">서명 내용 (HTML 코드 및 이미지 태그 지원)</label>
                        <textarea id="sig-content" name="signature_content" placeholder="메일 끝에 자동으로 추가될 서명을 입력하세요..."></textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">서명 미리보기</label>
                        <div id="sig-preview"></div>
                    </div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button type="submit" class="btn-submit" style="margin: 0; min-width: auto; padding: 8px 20px;">서명 저장</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ADDRESS BOOK MODAL -->
    <div id="addressbook-modal" class="tags-overlay hidden" style="z-index: 200;">
        <div class="tags-card" style="width: 500px; max-height: 85vh; height: 600px; display: flex; flex-direction: column;">
            <div class="tags-header" style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color);">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-address-book"></i> 주소록</h3>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" id="btn-add-address" class="btn-icon-settings" title="새 연락처 추가">
                        <i class="fa-solid fa-user-plus"></i>
                    </button>
                    <button type="button" id="btn-manage-addr-groups" class="btn-icon-settings" title="주소록 그룹 관리"><i class="fa-solid fa-users-gear"></i></button>
                </div>
            </div>
            
            <!-- 주소록 탭 (카테고리 2개) -->
            <div class="addressbook-tabs" style="display: flex; border-bottom: 1px solid var(--border-color); flex-shrink: 0; background: var(--bg-secondary);">
                <button type="button" class="addr-tab-btn active" data-tab="my" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid var(--color-primary); color: var(--text-primary); font-weight: bold; cursor: pointer; text-align: center; font-size: 14px;">내 주소록</button>
                <button type="button" class="addr-tab-btn" data-tab="received" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer; text-align: center; font-size: 14px;">미등록</button>
            </div>

            <!-- 주소록 상단 액션 바 -->
            <div class="addressbook-actions" style="padding: 12px 20px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <input type="text" id="addr-search" placeholder="이름 또는 이메일 검색..." style="flex-grow: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px; height: 32px; box-sizing: border-box; min-width: 0;">
                <div class="custom-dropdown hidden" id="addr-filter-group-dropdown" style="position: relative; width: 120px; flex-shrink: 0; display: none;">
                    <button type="button" id="addr-filter-group-trigger" style="width: 100%; padding: 0 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 13px; box-sizing: border-box; height: 32px;">
                        <span id="addr-filter-group-label" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">모든 그룹</span>
                        <i class="fa-solid fa-caret-down" style="color: var(--text-secondary); font-size: 12px;"></i>
                    </button>
                    <div id="addr-filter-group-options" class="hidden" style="position: absolute; top: 100%; right: 0; width: 180px; background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 250px; overflow-y: auto; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.15); margin-top: 4px; padding: 8px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">
                        <!-- Dynamic checkboxes for groups -->
                    </div>
                </div>
            </div>

            <!-- 주소록 목록 영역 -->
            <div class="addressbook-body-wrapper" style="flex-grow: 1; overflow-y: auto; padding: 12px 20px;">
                <table class="addressbook-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; color: var(--text-primary); table-layout: fixed;">
                    <thead id="addressbook-thead">
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
                            <th style="padding: 8px; width: 80px;">이름</th>
                            <th style="padding: 8px;">이메일</th>
                            <th style="padding: 8px; width: 55px;">그룹</th>
                            <th style="padding: 8px; width: 110px; text-align: right;"></th>
                        </tr>
                    </thead>
                    <tbody id="addressbook-list">
                        <!-- 연락처 목록 동적 렌더링 -->
                    </tbody>
                </table>
            </div>
            <!-- 주소록 footer (선택 모드일 때만 표시) -->
            <div id="addressbook-footer" class="hidden" style="padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; flex-shrink: 0; background: var(--bg-secondary);">
                <button type="button" id="btn-addressbook-confirm" class="btn-submit" style="margin: 0; padding: 8px 20px;">확인</button>
            </div>
        </div>
    </div>

    <!-- ADDRESS ADD/EDIT FORM MODAL -->
    <div id="address-form-modal" class="tags-overlay hidden" style="z-index: 210;">
        <div class="tags-card" style="width: 280px; padding: 20px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3); overflow: visible;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 id="addr-form-title" style="margin: 0;"><i class="fa-solid fa-address-card"></i> 연락처 편집</h3>
            </div>
            <form id="form-address">
                <input type="hidden" id="addr-id">
                <div class="form-group" style="margin-bottom: 12px;">
                    <label for="addr-name" style="display: block; margin-bottom: 6px; font-size: 13px; color: var(--text-secondary);">이름</label>
                    <input type="text" id="addr-name" required placeholder="이름 입력" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                    <label for="addr-email" style="display: block; margin-bottom: 6px; font-size: 13px; color: var(--text-secondary);">이메일 주소</label>
                    <input type="email" id="addr-email" required placeholder="example@onto.kr" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-size: 13px; color: var(--text-secondary);">그룹</label>
                    <div class="custom-dropdown" id="addr-group-dropdown" style="position: relative; width: 100%;">
                        <button type="button" id="addr-group-trigger" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 13px; box-sizing: border-box; height: 38px;">
                            <span id="addr-group-label" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">미정</span>
                            <i class="fa-solid fa-caret-down" style="color: var(--text-secondary); font-size: 12px;"></i>
                        </button>
                        <div id="addr-group-options" class="hidden" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface-solid); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.15); margin-top: 4px; padding: 4px 0; box-sizing: border-box;">
                            <!-- Dynamic options -->
                        </div>
                        <input type="hidden" id="addr-group" name="group_name" value="미정">
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
                    <button type="submit" class="btn-submit" style="margin: 0; min-width: auto; padding: 8px 20px;">저장</button>
                </div>
            </form>
        </div>
    </div>

    <!-- ADDRESS GROUP MANAGE MODAL -->
    <div id="address-groups-modal" class="tags-overlay hidden" style="z-index: 215;">
        <div class="tags-card" style="width: 320px; padding: 20px; box-sizing: border-box; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; width: 100%; box-sizing: border-box;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-users-gear"></i> 주소록 그룹 관리</h3>
            </div>
            <form id="form-add-addr-group" style="display: flex; gap: 8px; margin-bottom: 16px; width: 100%; box-sizing: border-box;">
                <input type="text" id="new-addr-group-name" required placeholder="새 그룹 이름 입력" style="flex-grow: 1; min-width: 0; height: 32px; padding: 0 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
                <button type="submit" class="btn-submit" style="margin: 0; padding: 0 12px; min-width: auto; font-size: 12px; height: 32px; box-sizing: border-box; white-space: nowrap;">추가</button>
            </form>
            <div style="border: 1px solid var(--border-color); border-radius: 4px; max-height: 250px; overflow-y: auto; background: rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; table-layout: fixed;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary); background: var(--bg-secondary);">
                            <th style="padding: 8px 12px;">그룹 이름</th>
                            <th style="padding: 8px 12px; width: 60px; text-align: right;"></th>
                        </tr>
                    </thead>
                    <tbody id="addr-groups-list">
                        <!-- 동적 로드 -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- ADDRESS GROUP RENAME MODAL -->
    <div id="address-group-rename-modal" class="tag-create-overlay hidden" style="z-index: 220;">
        <div class="tag-create-card" style="width: 320px; padding: 20px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);">
            <div class="tag-create-header" style="margin-bottom: 16px;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-pen-to-square"></i> 그룹 이름 변경</h3>
            </div>
            <form id="form-rename-address-group" class="tag-create-form-modal" style="display: flex; flex-direction: column; gap: 12px;">
                <input type="hidden" id="rename-address-group-id">
                <div class="form-group" style="margin: 0;">
                    <input type="text" id="rename-address-group-new-name" placeholder="새 이름을 입력하세요." required autocomplete="off" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
                </div>
                <div class="tag-create-footer" style="display: flex; justify-content: flex-end; margin-top: 4px;">
                    <button type="submit" class="btn-submit" style="margin: 0; padding: 8px 16px;">변경</button>
                </div>
            </form>
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
