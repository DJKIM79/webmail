/**
 * ONTO.KR MAIL SPA CORE
 */

document.addEventListener('DOMContentLoaded', () => {
    // Current state
    let state = {
        user: null,
        currentFolder: 'INBOX',
        emails: [],
        selectedEmailId: null,
        unreadCount: 0,
        folderCache: {}, // Cache for flicker-free folder switching
        tagColors: {}, // Custom colors for personal folders
        externalMails: [],
        sidebarCollapsedGroups: JSON.parse(localStorage.getItem('mail-sidebar-collapsed-groups') || '{}'),
        personalFolderExpanded: localStorage.getItem('mail-personal-folder-expanded') === 'true',
        showFlaggedOnly: false,
        addressBookSelectMode: false,
        addressBookListMy: [],
        addressBookListReceived: [],
        addressBookCurrentTab: 'my',
        addressGroups: [],
        addressGroupColors: {},
        addressBookFilterGroups: []
    };

    function getBaseId(id) {
        if (!id) return '';
        return id.split(':2,')[0];
    }

    function applyFolderVisibility() {
        if (!state.user) return;
        const key = 'mail-hidden-folders-' + state.user.username;
        const hiddenFolders = JSON.parse(localStorage.getItem(key) || '{}');
        
        const ontoAcc = (state.externalMails || []).find(a => a.service_type === 'onto');
        const ontoId = ontoAcc ? ontoAcc.id : null;

        // 1. Starred, Sent, Drafts, Spam, Trash
        const systemFolders = ['Starred', 'Sent', 'Drafts', 'Spam', 'Trash'];
        systemFolders.forEach(folder => {
            const isHidden = !!hiddenFolders[folder];
            let selector = `.sidebar-nav [data-folder="${folder}"]`;
            if (ontoId) {
                selector += `, .sidebar-nav [data-folder="ext_${ontoId}_${folder}"]`;
            }
            document.querySelectorAll(selector).forEach(el => {
                if (isHidden) {
                    el.style.setProperty('display', 'none', 'important');
                } else {
                    el.style.removeProperty('display');
                }
            });
        });

        // 2. 개인 보관함 (custom-tags)
        const isTagsHidden = !!hiddenFolders['custom-tags'];
        const tagsContainers = document.querySelectorAll('#tags-menu-container, [id="tags-menu-container"]');
        tagsContainers.forEach(tagsContainer => {
            if (isTagsHidden) {
                tagsContainer.style.setProperty('display', 'none', 'important');
            } else {
                tagsContainer.style.removeProperty('display');
            }
        });

        // 3. Custom tags/folders
        document.querySelectorAll('#sidebar-tags-container .tag-item, #tags-popover-list .tag-item, #tags-popover-list .tags-popover-item').forEach(el => {
            const folderName = el.dataset.folder || el.dataset.tag;
            if (folderName && !systemFolders.includes(folderName) && folderName !== 'custom-tags' && folderName !== 'INBOX') {
                const isHidden = !!hiddenFolders[folderName];
                if (isHidden) {
                    el.style.setProperty('display', 'none', 'important');
                } else {
                    el.style.removeProperty('display');
                }
            }
        });
        
        // 4. If current folder is hidden, switch to default folder
        let isCurrentHidden = false;
        if (hiddenFolders[state.currentFolder]) {
            isCurrentHidden = true;
        } else if (state.currentFolder.startsWith('ext_')) {
            const matches = state.currentFolder.match(/^ext_(\d+)_(.+)$/);
            if (matches) {
                const accId = parseInt(matches[1]);
                const sub = matches[2];
                const acc = (state.externalMails || []).find(a => a.id === accId);
                if (acc) {
                    if (acc.service_type === 'onto') {
                        if (hiddenFolders[sub]) isCurrentHidden = true;
                    } else if (acc.folders) {
                        const f = acc.folders.find(cf => cf.path === sub);
                        if (f && f.is_hidden) isCurrentHidden = true;
                    }
                }
            }
        }
        
        if (isCurrentHidden) {
            const activeAccounts = (state.externalMails || []).filter(a => a.is_active === 1);
            const defaultFolder = activeAccounts.length > 1 ? 'unified_inbox' : 'INBOX';
            if (state.currentFolder !== defaultFolder) {
                setCookie('currentFolder', defaultFolder);
                state.currentFolder = defaultFolder;
                syncActiveFolderUI();
                loadEmails(defaultFolder);
            }
        }
    }

    function toggleFolderVisibility(folderId, btnEl) {
        if (!state.user) return;
        const key = 'mail-hidden-folders-' + state.user.username;
        const hiddenFolders = JSON.parse(localStorage.getItem(key) || '{}');
        
        let isHidden = false;
        if (hiddenFolders[folderId]) {
            delete hiddenFolders[folderId];
            isHidden = false;
        } else {
            hiddenFolders[folderId] = true;
            isHidden = true;
        }
        localStorage.setItem(key, JSON.stringify(hiddenFolders));
        
        if (btnEl) {
            btnEl.classList.toggle('hidden-state', isHidden);
            btnEl.innerHTML = isHidden ? '<i class="fa-solid fa-eye"></i> 표시' : '<i class="fa-solid fa-eye-slash"></i> 숨김';
        }
        
        // Apply changes
        applyFolderVisibility();
    }

    // --------------------------------------------------
    // FOLDER COLOR HELPER (Hash-based colors)
    // --------------------------------------------------
    function getFolderColor(folderName) {
        if (!folderName) return 'var(--text-secondary)';
        
        // Custom color from state
        if (state.tagColors && state.tagColors[folderName]) {
            return state.tagColors[folderName];
        }

        // Default system folders
        if (folderName === 'INBOX') return '#3b82f6'; // Blue
        if (folderName === 'Sent') return '#10b981'; // Green
        if (folderName === 'Drafts') return '#6b7280'; // Gray
        if (folderName === 'Trash') return '#ef4444'; // Red
        if (folderName === 'Starred') return '#f59e0b'; // Amber
        
        // Consistent hash code generation
        let hash = 0;
        for (let i = 0; i < folderName.length; i++) {
            hash = folderName.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Premium color palette for personal folders (matches the 10 theme colors)
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6',
            '#6366f1', '#8b5cf6', '#ffffff', '#71717a', '#000000'
        ];
        
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    // --------------------------------------------------
    // COOKIE HELPERS
    // --------------------------------------------------
    function setCookie(name, value, days = 30) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "; expires=" + date.toUTCString();
        document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict; Secure";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i=0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

    // DOM Elements
    const appContainer = document.getElementById('app');
    const authModal = document.getElementById('auth-modal');
    const composeModal = document.getElementById('compose-modal');
    const adminModal = document.getElementById('admin-modal');
    
    // Auth Forms
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formLoadTimeInput = document.getElementById('form-load-time');
    const captchaImg = document.getElementById('captcha-img');
    const btnReloadCaptcha = document.getElementById('btn-reload-captcha');
    
    // Nav Items
    const navItems = document.querySelectorAll('.nav-item');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    
    // Controls
    const btnCompose = document.getElementById('btn-compose');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnMobileSearchToggle = document.getElementById('btn-mobile-search-toggle');
    const btnLogout = document.getElementById('btn-logout');
    
    if (btnMobileSearchToggle) {
        btnMobileSearchToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const searchBox = document.querySelector('.search-box');
            if (searchBox) {
                searchBox.classList.toggle('active');
                if (searchBox.classList.contains('active')) {
                    const input = searchBox.querySelector('input');
                    if (input) {
                        input.focus();
                        
                        // 엔터키 입력 시 검색창 닫기 (실시간 검색은 이미 작동 중)
                        if (!input.dataset.enterHandlerAdded) {
                            input.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    searchBox.classList.remove('active');
                                    input.blur();
                                }
                            });
                            input.dataset.enterHandlerAdded = 'true';
                        }
                    }
                }
            }
        });
    }

    // Close mobile search when clicking outside
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('is-mobile-phone')) {
            const searchBox = document.querySelector('.search-box');
            const toggleBtn = document.getElementById('btn-mobile-search-toggle');
            if (searchBox && searchBox.classList.contains('active')) {
                if (!searchBox.contains(e.target) && !toggleBtn.contains(e.target)) {
                    searchBox.classList.remove('active');
                }
            }
        }
    });

    // --- 영문 입력 유도 및 제한 로직 추가 ---
    const englishOnlyFields = ['login-username', 'reg-username'];
    englishOnlyFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('input', function() {
                // 영문, 숫자, 특수기호 일부(._-)만 허용하고 나머지는 제거 (특히 한글 방지)
                this.value = this.value.replace(/[^a-zA-Z0-9._-]/g, '');
            });
        }
    });
    const btnAdmin = document.getElementById('btn-admin');
    const btnSettings = document.getElementById('user-profile-trigger');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const formSettings = document.getElementById('form-settings');

    // --- 모달 바깥 영역 클릭 시 닫기 기능 추가 ---
    function setupClickOutside(modalEl) {
        if (!modalEl) return;
        modalEl.addEventListener('click', (e) => {
            // 클릭된 대상이 모달 배경(카드 외부)인 경우에만 닫음
            if (e.target === modalEl) {
                // 인증 모달은 로그인 상태가 아닐 때는 닫히지 않도록 예외 처리
                if (modalEl === authModal && !state.user) {
                    return;
                }
                if (modalEl === composeModal) {
                    attemptCloseCompose();
                    return;
                }
                modalEl.classList.add('hidden');
            }
        });
    }

    // 대상 모달들에 기능 적용
    setupClickOutside(authModal);
    // setupClickOutside(composeModal); // 외부 영역을 클릭하면 안닫히게 설정
    setupClickOutside(adminModal);
    setupClickOutside(settingsModal);
    setupClickOutside(document.getElementById('tags-modal'));
    setupClickOutside(document.getElementById('filters-modal'));
    setupClickOutside(document.getElementById('filter-create-modal'));
    setupClickOutside(document.getElementById('groups-modal'));
    setupClickOutside(document.getElementById('admin-create-user-modal'));
    setupClickOutside(document.getElementById('locked-modal'));
    setupClickOutside(document.getElementById('group-rename-modal'));
    setupClickOutside(document.getElementById('external-mail-modal'));

    // Global ESC Key Listener to close modals/popovers one by one (Sequential)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // 1. Check for popovers first (highest priority)
            const popovers = ['tag-color-popover', 'tags-popover'];
            for (const id of popovers) {
                const el = document.getElementById(id);
                if (el && !el.classList.contains('hidden')) {
                    el.classList.add('hidden');
                    return; // Close only one and exit
                }
            }

            // 2. Check for mobile search
            if (document.body.classList.contains('is-mobile-phone')) {
                const searchBox = document.querySelector('.search-box');
                if (searchBox && searchBox.classList.contains('active')) {
                    searchBox.classList.remove('active');
                    return;
                }
            }

            // 3. Check for modals/overlays (Strict Z-index order priority)
            const overlays = [
                'tag-create-modal', 'group-rename-modal', // z-index 3000
                'filter-create-modal',                    // z-index 210
                'groups-modal',                           // z-index 210
                'filters-modal',                          // z-index 200
                'tags-modal',                             // z-index 200
                'external-mail-modal',                    // z-index 200
                'admin-create-user-modal',                 // z-index 140
                'admin-modal',                            // z-index 130
                'settings-modal',                         // z-index 120
                'compose-confirm-modal',                  // z-index 105
                'compose-modal', 'auth-modal', 'locked-modal' // z-index 100
            ];
            
            for (const id of overlays) {
                const el = document.getElementById(id);
                if (el && !el.classList.contains('hidden')) {
                    if (id === 'compose-modal') {
                        attemptCloseCompose();
                    } else {
                        el.classList.add('hidden');
                    }
                    return; // Close only the topmost and exit
                }
            }
        }
    });

    function attemptCloseCompose() {
        const to = formCompose.to.value.trim();
        const subject = formCompose.subject.value.trim();
        const body = quillEditor ? quillEditor.getText().trim() : formCompose.body.value.trim();
        
        // Ignore <p><br></p> or empty spaces as content
        const isBodyEmpty = body.length === 0 && (!quillEditor || !quillEditor.root.innerHTML.includes('<img'));
        
        // Also check if the fields are unmodified from their initial state
        const currentBodyHtml = quillEditor ? quillEditor.root.innerHTML : '';
        const isUnmodified = to === (composeInitialState ? composeInitialState.to : '') &&
                             subject === (composeInitialState ? composeInitialState.subject : '') &&
                             currentBodyHtml === (composeInitialState ? composeInitialState.bodyHtml : '') &&
                             uploadedFiles.length === 0;
                             
        const isFieldsEmpty = !to && !subject && isBodyEmpty && uploadedFiles.length === 0;
        
        if (isFieldsEmpty || isUnmodified) {
            composeModal.classList.add('hidden');
        } else {
            document.getElementById('compose-confirm-modal').classList.remove('hidden');
        }
    }

    
    function syncActiveFolderUI() {
        const folder = state.currentFolder;
        const isBuiltIn = ['INBOX', 'Starred', 'Sent', 'Drafts', 'Spam', 'Trash'].includes(folder);
        
        if (!isBuiltIn && !folder.startsWith('ext_') && folder !== 'unified_inbox') {
            const sidebarTagsWrapper = document.getElementById('sidebar-tags-wrapper');
            const tagsMenuArrow = document.getElementById('tags-menu-arrow');
            if (sidebarTagsWrapper) sidebarTagsWrapper.classList.add('expanded');
            if (tagsMenuArrow) tagsMenuArrow.classList.add('rotated');
        }
        
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
            if (el.id === 'btn-toggle-tags') {
                if (!isBuiltIn && !folder.startsWith('ext_') && folder !== 'unified_inbox') {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            } else {
                if (el.dataset.folder === folder) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
        });
        
        document.querySelectorAll('.tag-item').forEach(el => {
            if (el.dataset.folder === folder) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        
        document.querySelectorAll('.tags-popover-item').forEach(el => {
            if (el.dataset.folder === folder) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }
    
    // Mail List & Reader
    const folderTitle = document.getElementById('folder-title');
    const mailSearch = document.getElementById('mail-search');
    const mailContainer = document.getElementById('mail-items-container');
    const readerEmpty = document.getElementById('reader-empty');
    const readerContent = document.getElementById('reader-content');
    const readSubject = document.getElementById('read-subject');
    const readFrom = document.getElementById('read-from');
    const readTo = document.getElementById('read-to');
    const readDate = document.getElementById('read-date');
    const mailBodyFrame = document.getElementById('mail-body-frame');
    const externalImageBanner = document.getElementById('external-image-banner');
    const btnShowExternalImages = document.getElementById('btn-show-external-images');
    
    // Compose Form
    const formCompose = document.getElementById('form-compose');
    const btnCloseCompose = document.getElementById('btn-close-compose');
    
    // Admin Pane
    const btnCloseAdmin = document.getElementById('btn-close-admin');
    const adminUserList = document.getElementById('admin-user-list');

    // Action buttons inside reader
    const btnReply = document.getElementById('btn-reply');
    const btnForward = document.getElementById('btn-forward');
    const btnDeleteMail = document.getElementById('btn-delete-mail');

    // --------------------------------------------------
    // TOAST NOTIFICATIONS
    // --------------------------------------------------
    function showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    }

    function showPersonalFolderTooltip() {
        const existing = document.getElementById('personal-folder-tooltip');
        if (existing) {
            existing.remove();
        }

        const btn = document.getElementById('btn-toggle-tags');
        if (!btn) return;

        const sidebar = document.getElementById('sidebar');
        const isCollapsed = sidebar && sidebar.classList.contains('collapsed');
        const rect = btn.getBoundingClientRect();
        
        const tooltip = document.createElement('div');
        tooltip.id = 'personal-folder-tooltip';
        
        // Colors & Shape
        tooltip.style.position = 'fixed';
        tooltip.style.backgroundColor = '#ef4444'; // Red
        tooltip.style.color = '#ffffff';
        tooltip.style.padding = '8px 14px';
        tooltip.style.borderRadius = '8px';
        tooltip.style.fontSize = '12px';
        tooltip.style.fontWeight = '500';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.zIndex = '9999';
        tooltip.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        tooltip.style.opacity = '0';

        // Arrow element
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.width = '0';
        arrow.style.height = '0';
        
        if (isCollapsed) {
            // Position to the right when collapsed
            tooltip.style.top = `${rect.top + (rect.height / 2)}px`;
            tooltip.style.left = `${rect.right + 12}px`;
            tooltip.style.transform = 'translateY(-50%) translateX(5px)';
            
            arrow.style.top = '50%';
            arrow.style.left = '-6px';
            arrow.style.transform = 'translateY(-50%)';
            arrow.style.borderTop = '6px solid transparent';
            arrow.style.borderBottom = '6px solid transparent';
            arrow.style.borderRight = '6px solid #ef4444';
        } else {
            // Position below when expanded
            tooltip.style.top = `${rect.bottom + 8}px`;
            tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
            tooltip.style.transform = 'translateX(-50%) translateY(5px)';
            
            arrow.style.top = '-6px';
            arrow.style.left = '50%';
            arrow.style.transform = 'translateX(-50%)';
            arrow.style.borderLeft = '6px solid transparent';
            arrow.style.borderRight = '6px solid transparent';
            arrow.style.borderBottom = '6px solid #ef4444';
        }
        
        tooltip.appendChild(arrow);
        
        const textSpan = document.createElement('span');
        textSpan.textContent = '개인 폴더가 없습니다';
        tooltip.appendChild(textSpan);

        document.body.appendChild(tooltip);

        // Force reflow
        tooltip.offsetHeight;

        // Animate in
        tooltip.style.opacity = '1';
        if (isCollapsed) {
            tooltip.style.transform = 'translateY(-50%) translateX(0)';
        } else {
            tooltip.style.transform = 'translateX(-50%) translateY(0)';
        }

        // Hide on scroll
        const handleScroll = () => {
            tooltip.remove();
            window.removeEventListener('scroll', handleScroll, true);
        };
        window.addEventListener('scroll', handleScroll, true);

        // Auto hide after 2.5 seconds
        setTimeout(() => {
            if (document.body.contains(tooltip)) {
                tooltip.style.opacity = '0';
                if (isCollapsed) {
                    tooltip.style.transform = 'translateY(-50%) translateX(-5px)';
                } else {
                    tooltip.style.transform = 'translateX(-50%) translateY(-5px)';
                }
                setTimeout(() => tooltip.remove(), 200);
            }
            window.removeEventListener('scroll', handleScroll, true);
        }, 2500);
    }

    // --------------------------------------------------
    // CUSTOM CONFIRM DIALOG
    // --------------------------------------------------
    function customConfirm(message, iconClass = 'fa-solid fa-circle-question', okText = '확인', cancelText = '취소') {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'confirm-overlay';
            
            const card = document.createElement('div');
            card.className = 'confirm-card';
            
            card.innerHTML = `
                <div class="confirm-body">
                    <i class="${iconClass} confirm-icon"></i>
                    <p class="confirm-message"></p>
                </div>
                <div class="confirm-footer">
                    <button type="button" class="btn-confirm-cancel">${cancelText}</button>
                    <button type="button" class="btn-confirm-ok">${okText}</button>
                </div>
            `;
            
            const msgEl = card.querySelector('.confirm-message');
            if (message.includes('\n')) {
                msgEl.innerHTML = message.replace(/\n/g, '<br>');
            } else {
                msgEl.textContent = message;
            }
            backdrop.appendChild(card);
            document.body.appendChild(backdrop);
            
            setTimeout(() => {
                backdrop.classList.add('active');
            }, 10);
            
            const close = (result) => {
                backdrop.classList.remove('active');
                setTimeout(() => {
                    backdrop.remove();
                    resolve(result);
                }, 200);
            };
            
            card.querySelector('.btn-confirm-cancel').onclick = () => close(false);
            card.querySelector('.btn-confirm-ok').onclick = () => close(true);
            
            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', handleKeyDown);
                    close(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    document.removeEventListener('keydown', handleKeyDown);
                    close(false);
                }
            };
            document.addEventListener('keydown', handleKeyDown);
        });
    }

    // --------------------------------------------------
    // API CALLS (HELPER)
    // --------------------------------------------------
    async function apiRequest(action, method = 'GET', data = null) {
        let url = `api.php?action=${action}&_t=${Date.now()}`;
        let options = { method };
        
        if (data) {
            if (method === 'POST') {
                if (data instanceof FormData) {
                    options.body = data;
                } else {
                    const formData = new FormData();
                    for (const key in data) {
                        formData.append(key, data[key]);
                    }
                    options.body = formData;
                }
            } else {
                const params = new URLSearchParams(data).toString();
                url += `&${params}`;
            }
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error('Network response error');
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showToast('네트워크 통신 오류가 발생했습니다.');
            return { success: false, message: '네트워크 통신 오류' };
        }
    }

    // --------------------------------------------------
    // INITIALIZATION & CHECK LOGIN
    // --------------------------------------------------
    async function initApp() {
        // Load and apply theme
        let savedTheme = localStorage.getItem('mail-theme') || 'gray';
        applyTheme(savedTheme);

        formLoadTimeInput.value = Math.floor(Date.now() / 1000).toString();
        const res = await apiRequest('get_status');
        if (res.success && res.user) {
            loginUser(res.user);
        } else {
            showAuth(true);
        }
    }

    function loginUser(user) {
        state.user = user;
        if (user.theme) {
            localStorage.setItem('mail-theme', user.theme);
            applyTheme(user.theme);
        }
        profileName.textContent = user.name;
        profileEmail.textContent = `${user.username}@onto.kr`;
        
        // Show profile picture
        const avatarEl = document.querySelector('.user-profile .avatar');
        if (avatarEl) {
            if (user.profile_pic) {
                avatarEl.innerHTML = `<img src="${user.profile_pic}" alt="Avatar" class="avatar-img" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
            }
        }

        if (user.role === 'admin') {
            btnAdmin.classList.remove('hidden');
        } else {
            btnAdmin.classList.add('hidden');
        }

        authModal.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Load layout config from cookies (forced to INBOX for initial connection)
        const savedFolder = 'INBOX';
        state.currentFolder = savedFolder;
        syncActiveFolderUI();
        
        const savedSidebarWidth = getCookie('sidebarWidth');
        if (savedSidebarWidth) {
            sidebarWidth = parseInt(savedSidebarWidth);
            sidebar.style.width = `${sidebarWidth}px`;
        }
        
        // 휴대폰(안드로이드폰, 아이폰)인 경우 기본적으로 접힌 상태로 설정 (태블릿 제외)
        const isMobilePhone = /Android.*Mobi|iPhone/i.test(navigator.userAgent);
        document.body.classList.toggle('is-mobile-phone', isMobilePhone);
        
        const mailSearch = document.getElementById('mail-search');
        if (isMobilePhone && mailSearch) {
            mailSearch.placeholder = '검색';
        }
        
        const savedSidebarCollapsed = getCookie('sidebarCollapsed');
        
        if (savedSidebarCollapsed === 'true' || (isMobilePhone && savedSidebarCollapsed === null)) {
            sidebarCollapsed = true;
            sidebar.classList.add('collapsed');
            sidebar.style.width = '92px';
        } else {
            sidebarCollapsed = false;
            sidebar.classList.remove('collapsed');
        }
        
        const savedListHeight = getCookie('listHeight');
        if (savedListHeight) {
            listHeight = parseInt(savedListHeight);
            mailListPane.style.height = `${listHeight}px`;
        }
        
        loadExternalMailsAndRenderSidebar(state.currentFolder).then(() => {
            updateGlobalUnreadCount(true);
            triggerBackgroundSync();
        });
        
        // Start polling (every 30 seconds)
        if (window.mailPoller) clearInterval(window.mailPoller);
        window.mailPoller = setInterval(() => {
            loadEmails(state.currentFolder, false);
            updateGlobalUnreadCount();
        }, 30000);
    }

    function logoutUser() {
        state.user = null;
        if (window.mailPoller) clearInterval(window.mailPoller);
        appContainer.classList.add('hidden');
        showAuth(true);
    }

    function showAuth(isLogin = true) {
        authModal.classList.remove('hidden');
        if (isLogin) {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            formLogin.classList.remove('hidden');
            formRegister.classList.add('hidden');
            setTimeout(() => {
                const loginUserField = document.getElementById('login-username');
                if (loginUserField) loginUserField.focus();
            }, 50);
        } else {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            formRegister.classList.remove('hidden');
            formLogin.classList.add('hidden');
            reloadCaptcha();
            setTimeout(() => {
                const regUserField = document.getElementById('reg-username');
                if (regUserField) regUserField.focus();
            }, 50);
        }
    }

    function reloadCaptcha() {
        captchaImg.src = 'bot_check.php?r=' + Math.random();
        document.getElementById('reg-captcha').value = '';
    }

    // --------------------------------------------------
    // AUTH ACTIONS
    // --------------------------------------------------
    tabLogin.addEventListener('click', () => showAuth(true));
    tabRegister.addEventListener('click', () => showAuth(false));
    btnReloadCaptcha.addEventListener('click', reloadCaptcha);

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        let username = formLogin.username.value.trim();
        if (username.toLowerCase().endsWith('@onto.kr')) {
            username = username.slice(0, -8);
        }
        const password = formLogin.password.value;
        const keep = document.getElementById('login-keep')?.checked ? 1 : 0;
        
        const res = await apiRequest('login', 'POST', { username, password, keep });
        if (res.success) {
            formLogin.reset();
            loginUser(res.user);
        } else {
            if (res.message === 'locked') {
                openLockedModal(username);
            } else {
                showToast(res.message);
            }
        }
    });

    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        let username = formRegister.username.value.trim();
        if (username.toLowerCase().endsWith('@onto.kr')) {
            username = username.slice(0, -8);
        }
        const name = formRegister.name.value;
        const password = formRegister.password.value;
        const captcha = formRegister.captcha.value;
        const honeypot = document.getElementById('email_honeypot').value;
        const formLoadTime = formLoadTimeInput.value;

        const res = await apiRequest('register', 'POST', {
            username, name, password, captcha,
            email_honeypot: honeypot,
            form_load_time: formLoadTime
        });

        if (res.success) {
            formRegister.reset();
            showToast(res.message);
            showAuth(true);
        } else {
            showToast(res.message);
            reloadCaptcha();
        }
    });

    btnLogout.addEventListener('click', async () => {
        const res = await apiRequest('logout');
        if (res.success) {
            // 로그아웃 시 페이지를 완전히 새로고침하여 잔여 세션 및 상태를 완벽히 제거
            location.reload();
        }
    });

    // --------------------------------------------------
    // MAIL ACTIONS (LIST, READ, DELETE, SEND)
    // --------------------------------------------------
    async function loadEmails(folder, showLoading = true) {
        const activeAccounts = (state.externalMails || []).filter(a => a.is_active === 1);
        if (state.externalMails && activeAccounts.length === 0) {
            state.currentFolder = folder;
            syncActiveFolderUI();
            folderTitle.innerHTML = `<span style="margin-right:16px; opacity:0.8;">${getFolderIcon(folder)}</span>${getFolderDisplayName(folder)}`;

            if (btnRefresh) {
                btnRefresh.classList.remove('refreshing');
            }
            state.emails = [];
            renderMailList();
            
            const existingOverlay = mailContainer.querySelector('.mail-list-empty-overlay');
            if (existingOverlay) {
                existingOverlay.innerHTML = `
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning, #f59e0b); font-size: 32px; margin-bottom: 8px;"></i>
                    <span style="font-weight: 500; font-size: 15px; color: var(--text-primary); display: block;">활성화된 메일 계정이 없습니다.</span>
                    <span style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; display: block;">메일 서비스 이용을 위해 메일을 설정해 주세요.</span>
                `;
            }
            
            if (readerContent) readerContent.classList.add('hidden');
            if (readerEmpty) readerEmpty.classList.remove('hidden');
            updateGlobalUnreadCount();
            return;
        }

        const isSameFolder = (state.currentFolder === folder);
        state.currentFolder = folder;
        syncActiveFolderUI();
        folderTitle.innerHTML = `<span style="margin-right:16px; opacity:0.8;">${getFolderIcon(folder)}</span>${getFolderDisplayName(folder)}`;

        // Reset pagination parameters
        state.offset = 0;
        state.hasMore = true;
        state.isLoadingMore = false;
        state.totalEmails = 0;

        // Apply global saved height
        const globalSavedHeight = getCookie('listHeight');
        listHeight = globalSavedHeight ? parseInt(globalSavedHeight) : 320;
        mailListPane.style.height = `${listHeight}px`;
        
        const btnEmptyTrash = document.getElementById('btn-empty-trash');
        if (btnEmptyTrash) {
            if (folder === 'Trash') {
                btnEmptyTrash.classList.remove('hidden');
                btnEmptyTrash.disabled = true;
            } else {
                btnEmptyTrash.classList.add('hidden');
            }
        }
        
        const startTime = Date.now();
        if (btnRefresh) {
            btnRefresh.classList.add('refreshing');
            btnRefresh.classList.remove('error');
        }

        // Immediately reset selection and reader when switching folders
        if (!isSameFolder) {
            state.selectedEmailId = null;
            if (readerContent) readerContent.classList.add('hidden');
            if (readerEmpty) readerEmpty.classList.remove('hidden');
        }

        // --- Flicker-free logic ---
        const hasExistingList = mailContainer.querySelector('.mail-list-table') !== null;
        
        // Use cache if available for this folder
        if (!isSameFolder && state.folderCache[folder]) {
            state.emails = state.folderCache[folder];
            renderMailList();
            
            if (folder === 'Trash' && btnEmptyTrash) {
                btnEmptyTrash.disabled = (state.emails.length === 0);
            }

            // Don't show full loading overlay if we have cached content to show
            showLoading = false;
        } else if (!isSameFolder) {
            // No cache & switching folder: immediately empty the state and show loading row spinner
            state.emails = [];
            renderMailList();
            
            const emptyOverlay = mailContainer.querySelector('.mail-list-empty-overlay');
            if (emptyOverlay) {
                emptyOverlay.remove();
            }
            
            const tbody = mailContainer.querySelector('#mail-list-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px 0; color: var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>메일을 불러오는 중입니다...</td></tr>`;
            }
        }

        // Fetch emails from the server with pagination
        const res = await apiRequest('list_emails', 'GET', { folder, offset: 0, limit: 10 });
        
        const elapsed = Date.now() - startTime;
        const minDuration = 800; // Matches CSS animation duration for a full 180deg cycle
        const delay = Math.max(0, minDuration - elapsed);
        
        setTimeout(() => {
            if (btnRefresh) {
                btnRefresh.classList.remove('refreshing');
            }
        }, delay);

        if (res.success) {
            const nextEmails = res.emails || [];
            state.totalEmails = res.total || nextEmails.length;
            state.hasMore = (nextEmails.length < state.totalEmails);
            state.folderCache[folder] = nextEmails; // Update cache
            
            if (folder === 'Trash' && btnEmptyTrash) {
                btnEmptyTrash.disabled = (nextEmails.length === 0);
            }

            const tbody = mailContainer.querySelector('#mail-list-tbody');
            
            // If we're still on the same folder we requested, update UI
            if (state.currentFolder === folder) {
                const canDoPartialUpdate = hasExistingList && tbody && isSameFolder;
                
                if (canDoPartialUpdate) {
                    // Calculate simple email addition
                    const oldEmailIds = new Set(state.emails.map(e => e.id));
                    const newEmails = nextEmails.filter(e => !oldEmailIds.has(e.id));
                    
                    const oldEmailsStillExist = state.emails.every(e => nextEmails.some(ne => ne.id === e.id));
                    const isSimpleAddition = newEmails.length > 0 && oldEmailsStillExist && (newEmails.length + state.emails.length === nextEmails.length);
                    
                    if (isSimpleAddition) {
                        // Prepend new emails with slide animation
                        for (let i = newEmails.length - 1; i >= 0; i--) {
                            const email = newEmails[i];
                            const tr = document.createElement('tr');
                            const isSelected = getBaseId(email.id) === getBaseId(state.selectedEmailId);
                            const isSeen = email.seen || isSelected;

                            tr.className = `mail-item ${isSeen ? '' : 'unread'} ${isSelected ? 'selected' : ''}`;
                            tr.dataset.id = email.id;
                            tr.style.setProperty('--account-color', getEmailAccountColor(email));

                            const dateStr = formatDate(email.timestamp);
                            const cleanFrom = escapeHtml(email.from);
                            tr.innerHTML = `
                                <td class="col-chk" onclick="event.stopPropagation();">
                                    <input type="checkbox" class="mail-item-chk" data-id="${email.id}" data-from="${escapeHtml(email.from)}" data-folder="${email.folder}">
                                </td>
                                <td class="col-flag" onclick="event.stopPropagation();">
                                    <button type="button" class="star-btn ${email.flagged ? 'flagged' : ''}" data-id="${email.id}">
                                        <i class="${email.flagged ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                                    </button>
                                </td>
                                <td class="col-sender">${cleanFrom}</td>
                                <td class="col-subject">
                                    <i class="mail-status-icon ${isSeen ? 'fa-regular fa-envelope-open' : 'fa-solid fa-envelope'} ${isSeen ? 'mail-icon-read' : 'mail-icon-unread'}" style="margin-right:8px; font-size: 13px;"></i>
                                    ${escapeHtml(email.subject)}
                                </td>
                                <td class="col-snippet">${escapeHtml(email.snippet || '')}</td>
                                <td class="col-date">${dateStr}</td>
                                <td class="col-filler"></td>
                            `;

                            tr.addEventListener('click', () => selectEmail(email.id));
                            const chk = tr.querySelector('.mail-item-chk');
                            if (chk) {
                                chk.addEventListener('change', (e) => {
                                    tr.classList.toggle('checked', e.target.checked);
                                });
                            }
                            tr.addEventListener('contextmenu', (e) => {
                                e.preventDefault();
                                highlightEmail(email.id);
                                showMailContextMenu(e, email.id);
                            });

                            const starBtn = tr.querySelector('.star-btn');
                            if (starBtn) {
                                starBtn.addEventListener('click', async (evt) => {
                                    evt.stopPropagation();
                                    const emailId = starBtn.dataset.id;
                                    const res = await apiRequest('toggle_flag', 'POST', { folder: email.folder, id: emailId });
                                    if (res.success) {
                                        const flagged = res.flagged;
                                        starBtn.classList.toggle('flagged', flagged);
                                        const icon = starBtn.querySelector('i');
                                        icon.className = flagged ? 'fa-solid fa-star' : 'fa-regular fa-star';

                                        const emailInState = state.emails.find(e => e.id === emailId);
                                        if (emailInState) {
                                            emailInState.flagged = flagged;
                                            emailInState.id = res.new_id;
                                        }
                                        starBtn.dataset.id = res.new_id;
                                        tr.dataset.id = res.new_id;
                                        tr.querySelector('.mail-item-chk').dataset.id = res.new_id;
                                        if (state.selectedEmailId === emailId) {
                                            state.selectedEmailId = res.new_id;
                                        }
                                    }
                                });
                            }

                            tbody.insertBefore(tr, tbody.firstChild);
                            }
                        
                        state.emails = nextEmails;
                        updateGlobalUnreadCount();
                    } else {
                        // Full render but without visible flicker/fading
                        // Check if anything actually changed (IDs, seen status, flagged status, etc.)
                        const isIdentical = state.emails.length === nextEmails.length && 
                                            state.emails.every((e, i) => 
                                                e.id === nextEmails[i].id && 
                                                e.seen === nextEmails[i].seen && 
                                                e.flagged === nextEmails[i].flagged &&
                                                e.subject === nextEmails[i].subject &&
                                                e.timestamp === nextEmails[i].timestamp
                                            );

                        if (!isIdentical) {
                            state.emails = nextEmails;
                            if (showLoading) {
                                state.selectedEmailId = null;
                                if (readerContent) readerContent.classList.add('hidden');
                                if (readerEmpty) readerEmpty.classList.remove('hidden');
                            }
                            renderMailList();
                        } else {
                            // If the 'no active accounts' warning is visible, force refresh even if email count (0) is identical.
                            const emptyOverlay = mailContainer.querySelector('.mail-list-empty-overlay');
                            if (emptyOverlay && emptyOverlay.textContent.includes('활성화된 메일 계정')) {
                                renderMailList();
                            }
                        }
                        updateGlobalUnreadCount();
                    }
                } else {
                    state.emails = nextEmails;
                    if (showLoading) {
                        state.selectedEmailId = null;
                        if (readerContent) readerContent.classList.add('hidden');
                        if (readerEmpty) readerEmpty.classList.remove('hidden');
                    }
                    renderMailList();
                    updateGlobalUnreadCount();
                }
            }
            
            if (mailContainer.classList.contains('loading')) {
                mailContainer.offsetHeight;
                mailContainer.classList.remove('loading');
            }
            if (tbody && tbody.classList.contains('loading-fade')) {
                tbody.classList.remove('loading-fade');
            }
        } else {
            showToast(res.message);
            mailContainer.classList.remove('loading');
            const tbody = mailContainer.querySelector('#mail-list-tbody');
            if (tbody && tbody.classList.contains('loading-fade')) {
                tbody.classList.remove('loading-fade');
            }
            if (btnRefresh) {
                btnRefresh.classList.add('error');
            }
        }
    }

    async function loadMoreEmails() {
        if (state.isLoadingMore || !state.hasMore) return;
        state.isLoadingMore = true;
        
        let tbody = mailContainer.querySelector('#mail-list-tbody');
        let loadingRow = null;
        if (tbody) {
            loadingRow = document.createElement('tr');
            loadingRow.id = 'mail-list-loading-row';
            loadingRow.innerHTML = `<td colspan="7" style="text-align: center; padding: 16px 0; color: var(--text-secondary); background: rgba(255, 255, 255, 0.05);"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>추가 메일을 불러오는 중입니다...</td>`;
            tbody.appendChild(loadingRow);
        }
        
        const folder = state.currentFolder;
        const nextOffset = state.emails.length;
        
        const res = await apiRequest('list_emails', 'GET', { folder, offset: nextOffset, limit: 10 });
        
        if (loadingRow) {
            loadingRow.remove();
        }
        
        if (res.success && state.currentFolder === folder) {
            const nextEmails = res.emails || [];
            if (nextEmails.length > 0) {
                state.emails = state.emails.concat(nextEmails);
                state.folderCache[folder] = state.emails;
                renderMailList();
            }
            state.totalEmails = res.total || state.emails.length;
            state.hasMore = (state.emails.length < state.totalEmails);
        }
        
        state.isLoadingMore = false;
    }

    // Attach scroll listener to mail container for infinite scroll
    if (mailContainer) {
        mailContainer.addEventListener('scroll', () => {
            const threshold = 100; // pixels from bottom
            const isNearBottom = mailContainer.scrollTop + mailContainer.clientHeight >= mailContainer.scrollHeight - threshold;
            if (isNearBottom && state.hasMore && !state.isLoadingMore) {
                loadMoreEmails();
            }
        });
    }

    function getFolderIcon(folder) {
        if (folder === 'unified_inbox') {
            return '<i class="fa-solid fa-envelopes-bulk" style="color: var(--color-primary);"></i>';
        }
        if (folder.startsWith('ext_')) {
            const matches = folder.match(/^ext_(\d+)_(.+)$/);
            const sub = matches ? matches[2] : folder;
            switch (sub) {
                case 'INBOX': return '<i class="fa-solid fa-inbox"></i>';
                case 'Sent': return '<i class="fa-solid fa-paper-plane"></i>';
                case 'Drafts': return '<i class="fa-solid fa-file-signature"></i>';
                case 'Trash': return '<i class="fa-solid fa-trash-can"></i>';
                default: return '<i class="fa-solid fa-folder-open"></i>';
            }
        }
        switch (folder) {
            case 'INBOX': return '<i class="fa-solid fa-inbox"></i>';
            case 'Starred': return '<i class="fa-solid fa-star" style="color: var(--color-warning);"></i>';
            case 'Sent': return '<i class="fa-solid fa-paper-plane"></i>';
            case 'Drafts': return '<i class="fa-solid fa-file-signature"></i>';
            case 'Spam': return '<i class="fa-solid fa-ban"></i>';
            case 'Trash': return '<i class="fa-solid fa-trash-can"></i>';
            default: return '<i class="fa-solid fa-folder-open"></i>';
        }
    }

    function getFolderDisplayName(folder) {
        if (folder === 'unified_inbox') {
            return '전체 받은 편지함';
        }
        if (folder.startsWith('ext_')) {
            const matches = folder.match(/^ext_(\d+)_(.+)$/);
            if (matches) {
                const accId = parseInt(matches[1]);
                const sub = matches[2];
                const acc = (state.externalMails || []).find(a => a.id === accId);
                const emailLabel = acc ? acc.email : '외부 계정';
                let subLabel = sub;
                if (acc && acc.folders) {
                    const foundFolder = acc.folders.find(f => f.path === sub);
                    if (foundFolder && foundFolder.display_name) {
                        subLabel = foundFolder.display_name;
                    }
                }
                switch (subLabel) {
                    case 'INBOX': subLabel = '받은 편지함'; break;
                    case 'Sent': subLabel = '보낸 편지함'; break;
                    case 'Drafts': subLabel = '임시 보관함'; break;
                    case 'Spam': subLabel = '스팸 보관함'; break;
                    case 'Trash': subLabel = '휴지통'; break;
                }
                return `${subLabel} (${emailLabel})`;
            }
        }
        switch (folder) {
            case 'INBOX': return '받은 편지함';
            case 'Starred': return '즐겨찾기';
            case 'Sent': return '보낸 편지함';
            case 'Drafts': return '임시 보관함';
            case 'Spam': return '스팸 보관함';
            case 'Trash': return '휴지통';
            default: return folder;
        }
    }

    function renderMailList() {
        const query = mailSearch.value.trim().toLowerCase();
        const filtered = state.emails.filter(email => {
            const s = (email.subject || "").toLowerCase();
            const f = (email.from || "").toLowerCase();
            const t = (email.to || "").toLowerCase();
            const c = (email.cc || "").toLowerCase();
            const matchesQuery = s.includes(query) || f.includes(query) || t.includes(query) || c.includes(query);
            const matchesFlagged = !state.showFlaggedOnly || email.flagged;
            return matchesQuery && matchesFlagged;
        });

        const mainContent = document.getElementById('main-content');
        if (filtered.length === 0) {
            if (readerContent) readerContent.classList.add('hidden');
            if (readerEmpty) readerEmpty.classList.remove('hidden');
            state.selectedEmailId = null;
            if (state.emails.length === 0 && mainContent) {
                mainContent.classList.add('empty-mailbox');
            }
        } else {
            if (mainContent) {
                mainContent.classList.remove('empty-mailbox');
            }
        }

        const colWidths = {
            sender: getCookie('colWidth_sender') || '140',
            subject: getCookie('colWidth_subject') || '280',
            snippet: getCookie('colWidth_snippet') || '200',
            date: getCookie('colWidth_date') || '100'
        };

        let table = mailContainer.querySelector('.mail-list-table');
        let tbody;
        let isNewTable = false;

        if (!table) {
            isNewTable = true;
            table = document.createElement('table');
            table.className = 'mail-list-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th class="col-chk"><input type="checkbox" id="chk-all-emails"></th>
                        <th class="col-starred-filter">
                            <button type="button" id="btn-flagged-filter" class="flagged-filter-btn" title="즐겨찾기만 보기">
                                <i class="fa-regular fa-star"></i>
                            </button>
                        </th>
                        <th class="col-sender" style="width: ${colWidths.sender}px;">보낸사람</th>
                        <th class="col-subject" style="width: ${colWidths.subject}px;">제목</th>
                        <th class="col-snippet" style="width: ${colWidths.snippet}px;">내용</th>
                        <th class="col-date" style="width: ${colWidths.date}px;">시간</th>
                        <th class="col-filler" style="width: auto;"></th>
                    </tr>
                </thead>
                <tbody id="mail-list-tbody"></tbody>
            `;
            tbody = table.querySelector('#mail-list-tbody');
        } else {
            tbody = table.querySelector('#mail-list-tbody');
            tbody.innerHTML = '';
            
            // Clean up any existing empty overlay
            const existingOverlay = mailContainer.querySelector('.mail-list-empty-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
        }

        // Update flagged filter button state in existing or new header
        const flaggedFilterBtn = table.querySelector('#btn-flagged-filter');
        if (flaggedFilterBtn) {
            flaggedFilterBtn.className = `flagged-filter-btn ${state.showFlaggedOnly ? 'active' : ''}`;
            flaggedFilterBtn.title = state.showFlaggedOnly ? '모든 메일 보기' : '즐겨찾기만 보기';
            const starIcon = flaggedFilterBtn.querySelector('i');
            if (starIcon) {
                starIcon.className = `${state.showFlaggedOnly ? 'fa-solid' : 'fa-regular'} fa-star`;
            }
        }

        // Reset check-all checkbox
        const chkAll = table.querySelector('#chk-all-emails');
        if (chkAll) {
            chkAll.checked = false;
        }
        
        filtered.forEach((email, index) => {
            const tr = document.createElement('tr');
            const isSelected = getBaseId(email.id) === getBaseId(state.selectedEmailId);
            const isSeen = email.seen || isSelected;
            tr.className = `mail-item ${isSeen ? '' : 'unread'} ${isSelected ? 'selected' : ''}`;
            tr.dataset.id = email.id;
            tr.style.setProperty('--account-color', getEmailAccountColor(email));

            const dateStr = formatDate(email.timestamp);
            const cleanFrom = escapeHtml(email.from);
            tr.innerHTML = `
                <td class="col-chk" onclick="event.stopPropagation();">
                    <input type="checkbox" class="mail-item-chk" data-id="${email.id}" data-from="${escapeHtml(email.from)}" data-folder="${email.folder}">
                </td>
                <td class="col-flag" onclick="event.stopPropagation();">
                    <button type="button" class="star-btn ${email.flagged ? 'flagged' : ''}" data-id="${email.id}">
                        <i class="${email.flagged ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                    </button>
                </td>
                <td class="col-sender">${cleanFrom}</td>
                <td class="col-subject">
                    <i class="mail-status-icon ${isSeen ? 'fa-regular fa-envelope-open' : 'fa-solid fa-envelope'} ${isSeen ? 'mail-icon-read' : 'mail-icon-unread'}" style="margin-right:8px; font-size: 13px;"></i>
                    ${(state.currentFolder === 'unified_inbox' && email.account_color) ? `<span class="unified-mail-badge" style="background-color: ${email.account_color};" title="${escapeHtml(email.account_email)}"></span>` : ''}
                    ${escapeHtml(email.subject)}
                </td>
                <td class="col-snippet">${escapeHtml(email.snippet || '')}</td>
                <td class="col-date">${dateStr}</td>
                <td class="col-filler"></td>
            `;

            tr.addEventListener('click', () => selectEmail(email.id));

            const chk = tr.querySelector('.mail-item-chk');
            if (chk) {
                chk.addEventListener('change', (e) => {
                    tr.classList.toggle('checked', e.target.checked);
                });
            }
            tr.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                highlightEmail(email.id);
                showMailContextMenu(e, email.id);
            });
            
            const starBtn = tr.querySelector('.star-btn');
            if (starBtn) {
                starBtn.addEventListener('click', async (evt) => {
                    evt.stopPropagation();
                    const emailId = starBtn.dataset.id;
                    const res = await apiRequest('toggle_flag', 'POST', { folder: email.folder, id: emailId });
                    if (res.success) {
                        const flagged = res.flagged;
                        starBtn.classList.toggle('flagged', flagged);
                        const icon = starBtn.querySelector('i');
                        if (flagged) {
                            icon.className = 'fa-solid fa-star';
                        } else {
                            icon.className = 'fa-regular fa-star';
                        }
                        
                        const emailInState = state.emails.find(e => e.id === emailId);
                        if (emailInState) {
                            emailInState.flagged = flagged;
                            emailInState.id = res.new_id;
                        }
                        starBtn.dataset.id = res.new_id;
                        tr.dataset.id = res.new_id;
                        tr.querySelector('.mail-item-chk').dataset.id = res.new_id;
                        
                        if (state.selectedEmailId === emailId) {
                            state.selectedEmailId = res.new_id;
                        }
                    }
                });
            }
            
            tbody.appendChild(tr);
        });

        if (isNewTable) {
            mailContainer.innerHTML = '';
            mailContainer.appendChild(table);

            makeTableColumnsResizable(table);

            const chkAllElement = table.querySelector('#chk-all-emails');
            if (chkAllElement) {
                chkAllElement.addEventListener('change', (e) => {
                    const checked = e.target.checked;
                    table.querySelectorAll('.mail-item-chk').forEach(chk => {
                        chk.checked = checked;
                        const row = chk.closest('tr');
                        if (row) {
                            row.classList.toggle('checked', checked);
                        }
                    });
                });
            }

            const flaggedFilterBtnElement = table.querySelector('#btn-flagged-filter');
            if (flaggedFilterBtnElement) {
                flaggedFilterBtnElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    state.showFlaggedOnly = !state.showFlaggedOnly;
                    renderMailList();
                });
            }
        }

        // 결과가 0개인 경우 테이블 하단에 중앙 정렬 빈 메시지 표시
        if (filtered.length === 0) {
            const emptyOverlay = document.createElement('div');
            if (state.showFlaggedOnly) {
                emptyOverlay.className = 'mail-list-empty-overlay starred-empty';
                emptyOverlay.innerHTML = `
                    <i class="fa-regular fa-star"></i>
                    <span>즐겨찾기한 메일이 없습니다.</span>
                `;
            } else {
                emptyOverlay.className = 'mail-list-empty-overlay';
                emptyOverlay.innerHTML = `
                    <i class="fa-solid fa-inbox"></i>
                    <span>이메일이 없습니다.</span>
                `;
            }
            mailContainer.appendChild(emptyOverlay);
        }

        // --- First Visit Auto-Fit Logic ---
        // Automatically set listHeight to double-click auto-fit target if no cookie exists
        if (!getCookie('listHeight') && state.emails.length > 0) {
            const trs = tbody.querySelectorAll('tr.mail-item');
            if (trs.length > 0) {
                const headerHeight = 71; 
                const theadHeight = 39;  
                const minHeaderOnlyHeight = headerHeight + theadHeight; 
                
                const count = Math.min(trs.length, 5);
                const itemsHeight = count * 35;
                let targetHeight = minHeaderOnlyHeight + itemsHeight + 8;
                if (targetHeight < minHeaderOnlyHeight) targetHeight = minHeaderOnlyHeight;
                
                listHeight = targetHeight;
                mailListPane.style.height = `${targetHeight}px`;
                setCookie('listHeight', listHeight);
            }
        }

        // Automatically set column widths to double-click natural size if no cookie exists
        if (!getCookie('colWidth_subject') && state.emails.length > 0) {
            const headers = table.querySelectorAll('thead th');
            const oldTableLayout = table.style.tableLayout;
            const oldTableWidth = table.style.width;

            table.classList.add('resizing');
            table.style.tableLayout = 'auto';
            table.style.width = 'auto';

            headers.forEach(th => {
                const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
                if (!colClass || colClass === 'col-chk' || colClass === 'col-starred-filter' || colClass === 'col-flag' || colClass === 'col-filler') return;
                
                th.style.width = 'auto';
                let autoWidth = th.offsetWidth;
                autoWidth = Math.ceil(autoWidth) + 4;
                if (autoWidth < 60) autoWidth = 60;
                if (autoWidth > 800) autoWidth = 800;
                
                const colName = colClass.replace('col-', '');
                setCookie('colWidth_' + colName, autoWidth);
                th.style.width = autoWidth + 'px';
            });

            table.style.tableLayout = oldTableLayout || 'fixed';
            table.style.width = oldTableWidth || '100%';
            table.offsetHeight; // Force layout sync
            table.classList.remove('resizing');
            
            // Re-calculate minWidth after updating columns
            let total = 0;
            headers.forEach(h => {
                if (!h.classList.contains('col-filler')) {
                    total += parseFloat(h.style.width) || h.offsetWidth;
                }
            });
            table.style.minWidth = `max(100%, ${total + 20}px)`;
            table.style.width = '100%';
        }
    }

    async function updateGlobalUnreadCount(sync = false) {
        if (state.user === null) return;
        
        try {
            const res = await apiRequest('get_unread_counts', 'GET', { sync: sync ? 1 : 0 });
            if (res.success && res.unread_counts) {
                const counts = res.unread_counts;
                
                // 1. Update all nav item badges (INBOX, Starred, Sent, Drafts, Trash, Custom Tags, Ext folders)
                const navItems = document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-tags .nav-item');
                navItems.forEach(item => {
                    const folder = item.dataset.folder;
                    if (!folder) return;
                    
                    const badge = item.querySelector('.badge');
                    if (!badge) return;
                    
                    let unread = counts[folder] || 0;
                    if (state.currentFolder === folder) {
                        const selBase = getBaseId(state.selectedEmailId);
                        unread = state.emails.filter(e => !e.seen && getBaseId(e.id) !== selBase).length;
                        // Keep server cache in sync locally
                        counts[folder] = unread;
                    }
                    
                    if (unread > 0) {
                        badge.textContent = unread;
                        badge.style.display = 'inline-flex';
                    } else {
                        badge.style.display = 'none';
                    }
                });
                
                // 2. Calculate and update combined unread count for custom tags (personal folders)
                const badgeTagsCombined = document.getElementById('badge-tags-combined');
                if (badgeTagsCombined) {
                    let tagsSum = 0;
                    Object.keys(counts).forEach(key => {
                        // Sum up unread counts of folders that are not built-in and not external
                        if (key !== 'INBOX' && key !== 'Sent' && key !== 'Drafts' && key !== 'Spam' && key !== 'Trash' && key !== 'unified_inbox' && !key.startsWith('ext_')) {
                            tagsSum += counts[key];
                        }
                    });
                    
                    if (tagsSum > 0) {
                        badgeTagsCombined.textContent = tagsSum;
                        badgeTagsCombined.style.display = 'inline-flex';
                    } else {
                        badgeTagsCombined.style.display = 'none';
                    }
                }
            }
        } catch (err) {
            console.error('Error updating unread count:', err);
        }
    }

    async function triggerBackgroundSync() {
        const activeAccounts = (state.externalMails || []).filter(a => a.is_active === 1 && a.service_type !== 'onto');
        if (activeAccounts.length === 0) return;
        
        console.log("Triggering parallel background sync for active external accounts:", activeAccounts.map(a => a.email));
        
        const promises = activeAccounts.map(async (acc) => {
            try {
                const res = await apiRequest('sync_account_unread', 'GET', { account_id: acc.id });
                if (res.success) {
                    console.log(`Sync success for account: ${acc.email}`);
                }
            } catch (err) {
                console.error(`Sync failed for account: ${acc.email}`, err);
            }
        });
        
        await Promise.all(promises);
        updateGlobalUnreadCount();
    }

    async function loadTags() {
        const sidebarTagsContainer = document.getElementById('sidebar-tags-container');
        if (!sidebarTagsContainer) return;
        
        try {
            const res = await apiRequest('list_tags');
            if (res.success) {
                const tags = res.tags || [];
                
                // Update tagColors state
                state.tagColors = {};
                tags.forEach(t => {
                    if (t.color) state.tagColors[t.name] = t.color;
                });

                sidebarTagsContainer.innerHTML = '';
                
                // When no personal folders exist, do not display anything continuously
                if (tags.length === 0) {
                    sidebarTagsContainer.innerHTML = '<div style="padding: 10px 16px; color: var(--text-secondary); font-size: 12px; text-align: center;">생성된 폴더가 없습니다.</div>';
                    return;
                }
                
                tags.forEach(t => {
                    const tag = t.name;
                    const a = document.createElement('a');
                    a.href = '#';
                    a.className = `tag-item nav-item ${tag === state.currentFolder ? 'active' : ''}`;
                    a.dataset.folder = tag;
                    const folderColor = getFolderColor(tag);
                    a.innerHTML = `
                        <i class="fa-solid fa-folder" style="color: ${folderColor};"></i>
                        <span class="nav-label">${escapeHtml(tag)}</span>
                        <span class="badge" style="display:none;">0</span>
                    `;
                    a.addEventListener('click', (e) => {
                        e.preventDefault();
                        
                        // Reset reader
                        readerEmpty.classList.remove('hidden');
                        readerContent.classList.add('hidden');
                        state.selectedEmailId = null;

                        setCookie('currentFolder', tag);
                        loadEmails(tag);
                    });
                    sidebarTagsContainer.appendChild(a);
                });

                // Restore personal folder expanded state from localStorage
                const sidebarTagsWrapper = document.getElementById('sidebar-tags-wrapper');
                const tagsMenuArrow = document.getElementById('tags-menu-arrow');
                if (sidebarTagsWrapper && state.personalFolderExpanded && !sidebar.classList.contains('collapsed')) {
                    sidebarTagsWrapper.classList.add('expanded');
                    if (tagsMenuArrow) tagsMenuArrow.classList.add('rotated');
                }
                
                // Keep UI classes synchronized
                syncActiveFolderUI();
                renderTagsPopoverList(tags);
                applyFolderVisibility();
            } else {
                console.error('Failed to load tags:', res.message);
            }
        } catch (err) {
            console.error('Error loading tags:', err);
        }
    }

    function highlightEmail(id) {
        state.selectedEmailId = id;
        const targetBase = getBaseId(id);

        document.querySelectorAll('.mail-item').forEach(el => {
            if (getBaseId(el.dataset.id) === targetBase) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
    }

    async function selectEmail(id) {
        console.log("selectEmail started. id:", id);
        try {
            state.selectedEmailId = id;
            const targetBase = getBaseId(id);

            // Hide iframe and clear any pending onload immediately to prevent showing old mail or flashing during fetch
            if (mailBodyFrame) {
                mailBodyFrame.onload = null;
                mailBodyFrame.style.opacity = '0';
            }

            document.querySelectorAll('.mail-item').forEach(el => {
                if (getBaseId(el.dataset.id) === targetBase) {
                    el.classList.add('selected');
                    el.classList.remove('unread');
                    // Change mail icon to read state
                    const mailIcon = el.querySelector('.mail-status-icon');
                    if (mailIcon) {
                        mailIcon.classList.remove('fa-solid', 'fa-envelope', 'mail-icon-unread');
                        mailIcon.classList.add('fa-regular', 'fa-envelope-open', 'mail-icon-read');
                    }
                } else {
                    el.classList.remove('selected');
                }
            });

            readerEmpty.classList.add('hidden');
            readerContent.classList.remove('hidden');

            // Populate tag move dropdown
            const tagMoveDropdownList = document.getElementById('tag-move-dropdown-list');
            if (tagMoveDropdownList) {
                tagMoveDropdownList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 12px;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</div>';
                const resTags = await apiRequest('list_tags');
                tagMoveDropdownList.innerHTML = '';
                if (resTags.success) {
                    const emailInState = state.emails.find(e => e.id === id);
                    const emailAcc = emailInState ? (state.externalMails || []).find(a => a.id == emailInState.account_id || (a.service_type === 'onto' && !emailInState.account_id)) : null;
                    const activeAccs = (state.externalMails || []).filter(a => a.is_active === 1);
                    const accountLabel = emailAcc ? (emailAcc.service_type === 'onto' ? 'OnTo' : (emailAcc.service_type === 'naver' ? 'Naver' : (emailAcc.service_type === 'gmail' ? 'Gmail' : (emailAcc.service_type === 'daum' ? 'Daum' : (emailAcc.service_type === 'kakao' ? 'Kakao' : emailAcc.email))))) : '';

                    const allDestinations = ['INBOX', 'Sent', 'Drafts', 'Spam', ...(resTags.tags || [])];
                    let addedCount = 0;
                    allDestinations.forEach(dest => {
                        let destName = '';
                        let destColor = '';
                        if (typeof dest === 'string') {
                            destName = dest;
                            destColor = getFolderColor(dest);
                        } else if (dest && typeof dest === 'object') {
                            destName = dest.name;
                            destColor = dest.color || getFolderColor(destName);
                        }

                        if (destName === state.currentFolder) return;

                        const a = document.createElement('a');
                        a.href = '#';

                        // Unify folder color with email account color if possible
                        const folderColor = emailAcc ? emailAcc.color : destColor;

                        // Display format: e.g., '받은 편지함 (OnTo)' or just '받은 편지함'
                        let displayLabel = getFolderDisplayName(destName);
                        if (activeAccs.length > 1 && accountLabel) {
                            displayLabel = `${displayLabel} (${accountLabel})`;
                        }

                        a.innerHTML = `
                            <i class="fa-solid fa-folder" style="color: ${folderColor}; margin-right: 8px;"></i>
                            <span>${escapeHtml(displayLabel)}</span>
                        `;
                        a.addEventListener('click', async (evt) => {
                            evt.preventDefault();
                            showToast('메일을 이동 중입니다...');
                            const rMove = await apiRequest('move_email', 'POST', {
                                id: id,
                                folder: state.currentFolder,
                                dest_folder: destName
                            });
                            showToast(rMove.message);
                            if (rMove.success) {
                                readerEmpty.classList.remove('hidden');
                                readerContent.classList.add('hidden');
                                state.selectedEmailId = null;
                                loadEmails(state.currentFolder);
                            }
                        });
                        tagMoveDropdownList.appendChild(a);
                        addedCount++;
                    });
                    if (addedCount === 0) {
                        tagMoveDropdownList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 12px; text-align: center;">이동할 수 있는 다른 폴더가 없습니다.</div>';
                    }
                }
            }

            // Fetch full email (resolve actual folder for virtual folder support)
            let actualFolder = state.currentFolder;
            const emailInState = state.emails.find(e => e.id === id);
            if (emailInState && emailInState.folder) {
                actualFolder = emailInState.folder;
            }
            console.log("Requesting read_email. actualFolder:", actualFolder, "id:", id);
            const res = await apiRequest('read_email', 'GET', { folder: actualFolder, id });
            console.log("read_email response:", res);

            if (res.success && res.email) {
                const email = res.email;

                // If the ID has changed (e.g., marked as seen and renamed), update it in the DOM
                if (email.id !== id) {
                    const tr = document.querySelector(`.mail-item[data-id="${id}"]`);
                    if (tr) {
                        tr.dataset.id = email.id;
                        const chk = tr.querySelector('.mail-item-chk');
                        if (chk) chk.dataset.id = email.id;
                        const star = tr.querySelector('.star-btn');
                        if (star) star.dataset.id = email.id;
                    }
                    if (state.selectedEmailId === id) state.selectedEmailId = email.id;
                    const emailInState2 = state.emails.find(e => e.id === id);
                    if (emailInState2) emailInState2.id = email.id;
                }

                readSubject.innerHTML = `<i class="fa-regular fa-envelope" style="margin-right: 12px; opacity: 0.5; font-size: 0.9em;"></i>${escapeHtml(email.subject)}`;
                readFrom.textContent = email.from;
                readTo.textContent = email.to;
                readDate.textContent = email.date;

                // Clear previous state of external image banner
                if (externalImageBanner) {
                    externalImageBanner.classList.add('hidden');
                }

                // Determine image loading policy for this account
                const emailAcc = (state.externalMails || []).find(a => a.id == email.account_id || (a.service_type === 'onto' && !email.account_id));
                const imagePolicy = emailAcc ? (emailAcc.external_images || 'ask') : 'ask';
                const linkPolicy = emailAcc ? (emailAcc.external_links || 'ask') : 'ask';

                let originalBody = email.body || '(내용 없음)';
                
                // Resolve inline cid: attachments
                const inlineAttachments = email.attachments || [];
                inlineAttachments.forEach(att => {
                    if (att.content_id) {
                        const cid1 = `cid:${att.content_id}`;
                        const cid2 = `cid:<${att.content_id}>`;
                        const dataUri = `data:${att.content_type};base64,${att.data}`;
                        originalBody = originalBody.split(cid1).join(dataUri);
                        originalBody = originalBody.split(cid2).join(dataUri);
                    }
                });

                let blockedBody = originalBody;
                let hasExternalImages = false;

                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(originalBody, 'text/html');
                    const imgs = doc.querySelectorAll('img');
                    imgs.forEach(img => {
                        const src = img.getAttribute('src');
                        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                            hasExternalImages = true;
                            img.setAttribute('data-blocked-src', src);
                            img.removeAttribute('src');
                        }
                    });
                    blockedBody = doc.body.innerHTML;
                } catch (e) {
                    console.error('Error preprocessing email body images:', e);
                }

                if (hasExternalImages && imagePolicy === 'ask') {
                    if (externalImageBanner) {
                        externalImageBanner.classList.remove('hidden');
                    }
                }

                // Requirements 3.1: 다크 테마 배경 투명 및 글자색 연동
                let bodyBg = '#161621'; // Solid dark theme bg
                let bodyColor = '#f3f4f6';
                let linkColor = '#c084fc';
                
                const isWhiteTheme = document.body.classList.contains('theme-white');
                if (isWhiteTheme) {
                    bodyBg = '#ffffff';
                    bodyColor = '#333333';
                    linkColor = '#4f46e5';
                } else if (document.body.classList.contains('theme-gray')) {
                    bodyBg = '#18181b'; // zinc-900
                    bodyColor = '#f4f4f5'; // zinc-100
                    linkColor = '#cbd5e1'; // zinc-300
                } else if (document.body.classList.contains('theme-black')) {
                    bodyBg = '#000000';
                    bodyColor = '#e2e8f0';
                    linkColor = '#ffffff';
                }
                
                // Generate theme override CSS if dark mode is active
                const themeOverrideCss = !isWhiteTheme ? `
                    html, body {
                        background-color: ${bodyBg} !important;
                        color: ${bodyColor} !important;
                    }
                    div, table, td, tr, p, span, section, article, header, footer, h1, h2, h3, h4, h5, h6, font {
                        background-color: transparent !important;
                        color: inherit !important;
                    }
                    a, a * {
                        color: ${linkColor} !important;
                    }
                ` : `
                    html, body {
                        background-color: ${bodyBg};
                        color: ${bodyColor};
                    }
                `;
                
                const makeIframeContent = (bodyText) => `
                    <html style="background-color: ${bodyBg}; color: ${bodyColor};">
                    <head>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                font-size: 14px;
                                line-height: 1.6;
                                padding: 24px;
                                margin: 0;
                                background-color: ${bodyBg} !important;
                                color: ${bodyColor} !important;
                            }
                            a { color: ${linkColor}; }
                            ${themeOverrideCss}
                        </style>
                    </head>
                    <body style="background-color: ${bodyBg}; color: ${bodyColor};">
                        ${bodyText}
                    </body>
                    </html>
                `;

                const blockedContent = makeIframeContent(blockedBody);
                const unblockedContent = makeIframeContent(originalBody);

                state.currentEmailUnfilteredContent = unblockedContent;

                let content = unblockedContent;
                if (hasExternalImages && (imagePolicy === 'ask' || imagePolicy === 'deny')) {
                    content = blockedContent;
                }
                
                // Hide iframe to avoid white load flash
                mailBodyFrame.style.opacity = '0';

                // Register load listener BEFORE assigning srcdoc to catch it reliably and overwrite any previous listeners
                mailBodyFrame.onload = () => {
                    // Hide scrollbar inside iframe for aesthetic reasons while keeping scrolling functional
                    try {
                        const iframeDoc = mailBodyFrame.contentDocument || mailBodyFrame.contentWindow.document;
                        if (iframeDoc) {
                            const style = iframeDoc.createElement('style');
                            style.textContent = `
                                html::-webkit-scrollbar, body::-webkit-scrollbar {
                                    display: none !important;
                                }
                                html, body {
                                    -ms-overflow-style: none !important;
                                    scrollbar-width: none !important;
                                }
                            `;
                            if (iframeDoc.head) {
                                iframeDoc.head.appendChild(style);
                            } else {
                                iframeDoc.documentElement.appendChild(style);
                            }
                        }
                    } catch (err) {
                        console.error('Cannot inject scrollbar style into iframe:', err);
                    }

                    // Defer showing iframe slightly to ensure layout and first paint are completed
                    setTimeout(() => {
                        mailBodyFrame.style.opacity = '1';
                    }, 50);

                    // Auto-adjust iframe height on mobile devices to allow unified scrolling
                    const isMobile = document.body.classList.contains('is-mobile-phone') || window.innerWidth <= 768;
                    if (isMobile) {
                        const adjustIframeHeight = () => {
                            try {
                                const iframeDoc = mailBodyFrame.contentDocument || mailBodyFrame.contentWindow.document;
                                if (iframeDoc) {
                                    iframeDoc.documentElement.style.overflow = 'hidden';
                                    iframeDoc.body.style.overflow = 'hidden';
                                    
                                    const height = Math.max(
                                        iframeDoc.documentElement.scrollHeight,
                                        iframeDoc.body.scrollHeight,
                                        iframeDoc.documentElement.offsetHeight,
                                        iframeDoc.body.offsetHeight
                                    );
                                    mailBodyFrame.style.height = (height + 15) + 'px'; // add small padding safety
                                }
                            } catch (err) {
                                console.error('Error auto-resizing iframe:', err);
                            }
                        };
                        
                        adjustIframeHeight();
                        setTimeout(adjustIframeHeight, 150);
                        setTimeout(adjustIframeHeight, 450);
                        setTimeout(adjustIframeHeight, 900);
                        
                        try {
                            const iframeDoc = mailBodyFrame.contentDocument || mailBodyFrame.contentWindow.document;
                            if (iframeDoc && window.MutationObserver) {
                                const observer = new MutationObserver(adjustIframeHeight);
                                observer.observe(iframeDoc.body, { childList: true, subtree: true, attributes: true });
                            }
                        } catch (err) {
                            console.warn('Could not attach MutationObserver to iframe:', err);
                        }
                    } else {
                        mailBodyFrame.style.height = '100%';
                    }

                    try {
                        const iframeDoc = mailBodyFrame.contentDocument || mailBodyFrame.contentWindow.document;
                        iframeDoc.addEventListener('click', function(e) {
                            const a = e.target.closest('a');
                            if (a && a.href) {
                                e.preventDefault();
                                const url = a.href;
                                if (url.startsWith('http://') || url.startsWith('https://')) {
                                    if (linkPolicy === 'deny') {
                                        showToast('외부 링크 이동이 제한되어 있습니다.');
                                    } else if (linkPolicy === 'allow') {
                                        window.open(url, '_blank');
                                    } else { // 'ask'
                                        const escapedUrl = escapeHtml(url);
                                        customConfirm(`외부 링크로 이동하시겠습니까?\n\n<span class="confirm-url" title="${escapedUrl}">${escapedUrl}</span>`, 'fa-solid fa-link', '진행').then(confirmed => {
                                            if (confirmed) {
                                                window.open(url, '_blank');
                                            }
                                        });
                                    }
                                } else if (url.startsWith('mailto:')) {
                                    window.open(url, '_top');
                                }
                            }
                        });
                    } catch (err) {
                        console.error('Cannot attach link listener to iframe:', err);
                    }
                };

                // Render email body inside sandboxed iframe using srcdoc for modern browser support and security compliance
                mailBodyFrame.srcdoc = content;
                console.log("mailBodyFrame srcdoc successfully assigned.");

                // Display attachments dropdown if present in the email
                const dropdownAttachments = document.getElementById('dropdown-attachments');
                const readerAttachmentsBadge = document.getElementById('reader-attachments-badge');
                const readerAttachmentsDropdownList = document.getElementById('reader-attachments-dropdown-list');
                
                if (dropdownAttachments && readerAttachmentsBadge && readerAttachmentsDropdownList) {
                    const attachments = email.attachments || [];
                    if (attachments.length > 0) {
                        dropdownAttachments.classList.remove('hidden');
                        readerAttachmentsBadge.textContent = attachments.length;
                        readerAttachmentsDropdownList.innerHTML = '';
                        
                        // "모두 받기" (Download All) option
                        const downloadAllLink = document.createElement('a');
                        downloadAllLink.href = '#';
                        downloadAllLink.style.fontWeight = '600';
                        downloadAllLink.style.borderBottom = '1px solid var(--border-color)';
                        downloadAllLink.style.display = 'flex';
                        downloadAllLink.style.alignItems = 'center';
                        downloadAllLink.style.gap = '8px';
                        downloadAllLink.style.color = 'var(--color-primary)';
                        downloadAllLink.innerHTML = `<i class="fa-solid fa-download"></i> <span>모두 받기</span>`;
                        downloadAllLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            attachments.forEach(att => {
                                const tempLink = document.createElement('a');
                                tempLink.href = `data:${att.content_type};base64,${att.data}`;
                                tempLink.download = att.filename;
                                document.body.appendChild(tempLink);
                                tempLink.click();
                                document.body.removeChild(tempLink);
                            });
                        });
                        readerAttachmentsDropdownList.appendChild(downloadAllLink);
                        
                        attachments.forEach(att => {
                            const a = document.createElement('a');
                            a.href = `data:${att.content_type};base64,${att.data}`;
                            a.download = att.filename;
                            a.style.display = 'flex';
                            a.style.alignItems = 'center';
                            a.style.justifyContent = 'space-between';
                            a.style.gap = '12px';
                            a.style.padding = '10px 16px';
                            
                            const sizeKB = (att.size / 1024).toFixed(1);
                            
                            a.innerHTML = `
                                <span style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 185px;">
                                    <i class="fa-solid fa-file-arrow-down" style="color: var(--text-secondary); font-size: 13px;"></i>
                                    <span title="${escapeHtml(att.filename)}">${escapeHtml(att.filename)}</span>
                                </span>
                                <span style="font-size: 11px; color: var(--text-secondary); white-space: nowrap;">(${sizeKB} KB)</span>
                            `;
                            readerAttachmentsDropdownList.appendChild(a);
                        });
                    } else {
                        dropdownAttachments.classList.add('hidden');
                    }
                }

                // Setup reply / forward actions based on selected mail
                btnReply.onclick = () => openCompose(email.from, `Re: ${email.subject}`, `\n\n--- Original Message ---\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\n\n${email.text_body || ''}`);
                btnForward.onclick = () => openCompose('', `Fwd: ${email.subject}`, `\n\n--- Original Message ---\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\n\n${email.text_body || ''}`);
                btnDeleteMail.onclick = () => deleteEmail(id);

                // Mark locally as seen, update ID to the server's new ID, and update badge
                const targetBase2 = getBaseId(id);
                const emailInState2 = state.emails.find(e => getBaseId(e.id) === targetBase2);
                if (emailInState2) {
                    emailInState2.seen = true;
                    emailInState2.id = res.email.id; // Update to the new ID with flags
                }
                
                // Synchronize the DOM element's dataset.id to the new ID
                const el = document.querySelector(`.mail-item[data-id="${id}"]`);
                if (el) {
                    el.dataset.id = res.email.id;
                }
                
                // Update selected ID to the new ID
                state.selectedEmailId = res.email.id;
                
                updateGlobalUnreadCount();
            } else {
                showToast("이메일 불러오기 실패: " + (res.message || "알 수 없는 오류"));
            }
        } catch (err) {
            console.error("selectEmail runtime error:", err);
            alert("JS Error in selectEmail: " + err.message + "\nStack: " + err.stack);
            showToast("이메일 처리 중 오류 발생: " + err.message);
        }
    }

    async function deleteEmail(id) {
        let actualFolder = state.currentFolder;
        const emailInState = state.emails.find(e => e.id === id);
        if (emailInState && emailInState.folder) {
            actualFolder = emailInState.folder;
        }

        const needsConfirm = actualFolder === 'Trash' || actualFolder.endsWith('_Trash');
        if (needsConfirm) {
            let msg = '1개의 메일을 영구 삭제하시겠습니까?\n삭제된 이후에는 복구할 수 없습니다.';
            if (!await customConfirm(msg, 'fa-solid fa-triangle-exclamation')) return;
        }
        
        const res = await apiRequest('delete_email', 'POST', { folder: actualFolder, id });
        if (res.success) {
            showToast(res.message);
            // Hide reader
            readerEmpty.classList.remove('hidden');
            readerContent.classList.add('hidden');
            state.selectedEmailId = null;
            // Reload folder
            loadEmails(state.currentFolder);
        } else {
            showToast(res.message);
        }
    }

    let uploadedFiles = []; // Track attachment Files

    function updateAttachmentsList() {
        const attachmentsList = document.getElementById('attachments-list');
        if (!attachmentsList) return;
        attachmentsList.innerHTML = '';
        
        if (uploadedFiles.length === 0) {
            attachmentsList.style.display = 'none';
        } else {
            attachmentsList.style.display = 'flex';
        }

        uploadedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'attachment-item';
            
            const sizeKB = (file.size / 1024).toFixed(1);
            
            item.innerHTML = `
                <i class="fa-solid fa-file"></i>
                <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <span class="file-size">(${sizeKB} KB)</span>
                <button type="button" class="btn-remove-attachment" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
            `;
            
            item.querySelector('.btn-remove-attachment').addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                uploadedFiles.splice(idx, 1);
                updateAttachmentsList();
            });
            
            attachmentsList.appendChild(item);
        });
    }

    const fileInput = document.getElementById('file-attachments');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files) {
                Array.from(e.target.files).forEach(file => {
                    uploadedFiles.push(file);
                });
                updateAttachmentsList();
            }
            fileInput.value = ''; // reset
        });
    }

    // Drag-and-drop handlers for composition attachments
    const composeCard = document.querySelector('.compose-card');
    const attachmentsZone = document.getElementById('compose-attachments-zone');
    if (composeCard && attachmentsZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            composeCard.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                attachmentsZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            composeCard.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                attachmentsZone.classList.remove('dragover');
            }, false);
        });

        composeCard.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                Array.from(files).forEach(file => {
                    uploadedFiles.push(file);
                });
                updateAttachmentsList();
            }
        }, false);
    }

    let quillEditor = null;
    let composeInitialState = {
        to: '',
        subject: '',
        bodyHtml: ''
    };

    function initCustomToolbar(editor) {
        const toolbar = document.getElementById('custom-editor-toolbar');
        if (!toolbar) return;

        // Skip toolbar buttons in tab sequence to allow Tab key to jump from Subject to Body directly
        document.querySelectorAll('.custom-toolbar-container button, .custom-toolbar-container input, .custom-toolbar-container select').forEach(el => el.setAttribute('tabindex', '-1'));

        // Custom Toolbar horizontal scrolling with arrows
        const leftBtn = document.getElementById('custom-toolbar-nav-left');
        const rightBtn = document.getElementById('custom-toolbar-nav-right');

        if (leftBtn && rightBtn) {
            const updateArrows = () => {
                const scrollLeft = toolbar.scrollLeft;
                const scrollWidth = toolbar.scrollWidth;
                const clientWidth = toolbar.clientWidth;

                if (scrollLeft > 2) {
                    leftBtn.classList.remove('hidden');
                } else {
                    leftBtn.classList.add('hidden');
                }

                if (scrollWidth > clientWidth && scrollLeft < (scrollWidth - clientWidth - 2)) {
                    rightBtn.classList.remove('hidden');
                } else {
                    rightBtn.classList.add('hidden');
                }
            };

            const scrollAmount = 150;
            leftBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toolbar.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
            rightBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toolbar.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });

            toolbar.addEventListener('scroll', updateArrows);
            window.addEventListener('resize', updateArrows);
            toolbar.addEventListener('refresh-arrows', updateArrows);

            setTimeout(updateArrows, 200);
        }

        // Toggle dropdown open/close
        const dropdowns = toolbar.querySelectorAll('.toolbar-dropdown-wrapper');
        
        const closeAllDropdowns = () => {
            dropdowns.forEach(wrapper => {
                wrapper.classList.remove('open');
                const menu = wrapper.querySelector('.toolbar-dropdown-menu');
                if (menu) menu.classList.add('hidden');
            });
        };

        dropdowns.forEach(wrapper => {
            const trigger = wrapper.querySelector('.toolbar-dropdown-trigger, .toolbar-btn');
            const menu = wrapper.querySelector('.toolbar-dropdown-menu');
            if (trigger && menu) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    const isAlreadyOpen = wrapper.classList.contains('open');
                    
                    // Close all other dropdowns first
                    closeAllDropdowns();
                    
                    if (!isAlreadyOpen) {
                        wrapper.classList.add('open');
                        menu.classList.remove('hidden');
                        
                        // Dynamically position the dropdown with position: fixed to bypass overflow clipping
                        const rect = trigger.getBoundingClientRect();
                        menu.style.position = 'fixed';
                        menu.style.top = `${rect.bottom + 6}px`;
                        // Align dropdown left edge with trigger button left edge
                        menu.style.left = `${rect.left}px`;
                        // Ensure it fits within the viewport width
                        const menuRect = menu.getBoundingClientRect();
                        if (rect.left + menuRect.width > window.innerWidth) {
                            menu.style.left = `${window.innerWidth - menuRect.width - 12}px`;
                        }
                    }
                });
            }
        });

        // Close dropdowns on scroll or resize to prevent misalignment
        toolbar.addEventListener('scroll', closeAllDropdowns);
        window.addEventListener('resize', closeAllDropdowns);
        window.addEventListener('scroll', closeAllDropdowns, true); // capture scroll

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            closeAllDropdowns();
        });

        // Prevent editor loss of focus when clicking custom toolbar elements
        toolbar.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        // Font selection handler
        const fontItems = toolbar.querySelectorAll('.font-item');
        fontItems.forEach(item => {
            item.addEventListener('click', () => {
                const fontVal = item.getAttribute('data-font');
                editor.format('font', fontVal);
                
                fontItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                const label = toolbar.querySelector('#btn-toolbar-font .trigger-label');
                if (label) label.textContent = item.textContent;
            });
        });

        // Size selection handler
        const sizeItems = toolbar.querySelectorAll('.size-item');
        sizeItems.forEach(item => {
            item.addEventListener('click', () => {
                const sizeVal = item.getAttribute('data-size');
                editor.format('size', sizeVal);

                sizeItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const label = toolbar.querySelector('#btn-toolbar-size .trigger-label');
                if (label) label.textContent = item.textContent;
            });
        });

        // Standard Style buttons (Bold, Italic, Underline, Strike)
        const formatBtns = toolbar.querySelectorAll('.toolbar-btn[data-format]');
        formatBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.getAttribute('data-format');
                const currentFormats = editor.getFormat();
                
                if (format === 'bold') editor.format('bold', !currentFormats.bold);
                else if (format === 'italic') editor.format('italic', !currentFormats.italic);
                else if (format === 'underline') editor.format('underline', !currentFormats.underline);
                else if (format === 'strike') editor.format('strike', !currentFormats.strike);
                
                updateToolbarState();
            });
        });

        // Text Color palette handler
        const colorDots = toolbar.querySelectorAll('.color-dot[data-color]');
        colorDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const color = dot.getAttribute('data-color');
                editor.format('color', color);
                
                colorDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                
                const indicator = toolbar.querySelector('#indicator-text-color');
                if (indicator) indicator.style.backgroundColor = color;
                
                updateToolbarState();
            });
        });

        // Highlight/Background Color palette handler
        const bgDots = toolbar.querySelectorAll('.color-dot[data-bg]');
        bgDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const bg = dot.getAttribute('data-bg');
                editor.format('background', bg === 'transparent' ? false : bg);

                bgDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');

                const indicator = toolbar.querySelector('#indicator-bg-color');
                if (indicator) {
                    indicator.style.backgroundColor = bg === 'transparent' ? 'transparent' : bg;
                }
                
                updateToolbarState();
            });
        });

        // Alignment handler
        const alignBtns = toolbar.querySelectorAll('.toolbar-btn[data-align]');
        alignBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const alignVal = btn.getAttribute('data-align');
                editor.format('align', alignVal || false);
                updateToolbarState();
            });
        });

        // List handler
        const listBtns = toolbar.querySelectorAll('.toolbar-btn[data-list]');
        listBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const listVal = btn.getAttribute('data-list');
                const currentFormats = editor.getFormat();
                editor.format('list', currentFormats.list === listVal ? false : listVal);
                updateToolbarState();
            });
        });

        // Insert Link handler
        const insertLinkBtn = toolbar.querySelector('.toolbar-btn[data-insert="link"]');
        if (insertLinkBtn) {
            insertLinkBtn.addEventListener('click', () => {
                const range = editor.getSelection();
                const url = prompt('연결할 URL 링크를 입력하세요:', 'https://');
                if (url) {
                    if (range && range.length > 0) {
                        editor.format('link', url);
                    } else {
                        const index = range ? range.index : editor.getLength() - 1;
                        editor.insertText(index, url, 'link', url);
                    }
                }
            });
        }

        // Insert Image handler
        const insertImgBtn = toolbar.querySelector('.toolbar-btn[data-insert="image"]');
        if (insertImgBtn) {
            insertImgBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                input.click();
                input.onchange = () => {
                    const file = input.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const range = editor.getSelection();
                            const index = range ? range.index : editor.getLength() - 1;
                            editor.insertEmbed(index, 'image', e.target.result);
                        };
                        reader.readAsDataURL(file);
                    }
                };
            });
        }

        // Insert Table handler (Custom Grid Selector)
        const tableGrid = toolbar.querySelector('#table-selector-grid');
        const tableInfo = toolbar.querySelector('#table-selector-info');
        if (tableGrid) {
            // Generate 10x10 Grid
            for (let r = 1; r <= 10; r++) {
                for (let c = 1; c <= 10; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'table-selector-cell';
                    cell.setAttribute('data-row', r);
                    cell.setAttribute('data-col', c);
                    tableGrid.appendChild(cell);
                }
            }

            const cells = tableGrid.querySelectorAll('.table-selector-cell');

            tableGrid.addEventListener('mousemove', (e) => {
                const target = e.target.closest('.table-selector-cell');
                if (target) {
                    const maxRow = parseInt(target.getAttribute('data-row'), 10);
                    const maxCol = parseInt(target.getAttribute('data-col'), 10);

                    cells.forEach(cell => {
                        const r = parseInt(cell.getAttribute('data-row'), 10);
                        const c = parseInt(cell.getAttribute('data-col'), 10);
                        if (r <= maxRow && c <= maxCol) {
                            cell.classList.add('highlighted');
                        } else {
                            cell.classList.remove('highlighted');
                        }
                    });

                    if (tableInfo) {
                        tableInfo.textContent = `${maxCol} x ${maxRow}`;
                    }
                }
            });

            tableGrid.addEventListener('mouseleave', () => {
                cells.forEach(cell => cell.classList.remove('highlighted'));
                if (tableInfo) {
                    tableInfo.textContent = '0 x 0';
                }
            });

            tableGrid.addEventListener('click', (e) => {
                const target = e.target.closest('.table-selector-cell');
                if (target) {
                    const row = parseInt(target.getAttribute('data-row'), 10);
                    const col = parseInt(target.getAttribute('data-col'), 10);
                    const tableModule = editor.getModule('table');
                    if (tableModule) {
                        tableModule.insertTable(row, col);
                    } else {
                        console.error('Table module not enabled in Quill');
                    }
                    closeAllDropdowns();
                }
            });
        }

        // Blockquote handler
        const quoteBtn = toolbar.querySelector('.toolbar-btn[data-insert="blockquote"]');
        if (quoteBtn) {
            quoteBtn.addEventListener('click', () => {
                const currentFormats = editor.getFormat();
                editor.format('blockquote', !currentFormats.blockquote);
                updateToolbarState();
            });
        }

        // Code-block handler
        const codeBtn = toolbar.querySelector('.toolbar-btn[data-insert="code-block"]');
        if (codeBtn) {
            codeBtn.addEventListener('click', () => {
                const currentFormats = editor.getFormat();
                const hasCode = currentFormats['code-block'];
                editor.format('code-block', !hasCode);
                updateToolbarState();
            });
        }

        // Clean formatter handler
        const cleanBtn = toolbar.querySelector('#btn-toolbar-clean');
        if (cleanBtn) {
            cleanBtn.addEventListener('click', () => {
                const range = editor.getSelection();
                if (range) {
                    editor.removeFormat(range.index, range.length);
                }
            });
        }

        // Watch for editor selection/content change to update active state
        const updateToolbarState = () => {
            const range = editor.getSelection();
            const formats = range ? editor.getFormat(range) : editor.getFormat();

            // Style buttons active states
            const boldBtn = toolbar.querySelector('.toolbar-btn[data-format="bold"]');
            if (boldBtn) boldBtn.classList.toggle('active', !!formats.bold);
            
            const italicBtn = toolbar.querySelector('.toolbar-btn[data-format="italic"]');
            if (italicBtn) italicBtn.classList.toggle('active', !!formats.italic);
            
            const underlineBtn = toolbar.querySelector('.toolbar-btn[data-format="underline"]');
            if (underlineBtn) underlineBtn.classList.toggle('active', !!formats.underline);
            
            const strikeBtn = toolbar.querySelector('.toolbar-btn[data-format="strike"]');
            if (strikeBtn) strikeBtn.classList.toggle('active', !!formats.strike);
            
            const quote = toolbar.querySelector('.toolbar-btn[data-insert="blockquote"]');
            if (quote) quote.classList.toggle('active', !!formats.blockquote);
            
            const code = toolbar.querySelector('.toolbar-btn[data-insert="code-block"]');
            if (code) code.classList.toggle('active', !!formats['code-block']);

            // Lists
            const bulletBtn = toolbar.querySelector('.toolbar-btn[data-list="bullet"]');
            if (bulletBtn) bulletBtn.classList.toggle('active', formats.list === 'bullet');
            
            const orderedBtn = toolbar.querySelector('.toolbar-btn[data-list="ordered"]');
            if (orderedBtn) orderedBtn.classList.toggle('active', formats.list === 'ordered');

            // Alignment buttons
            const alignVal = formats.align || '';
            alignBtns.forEach(btn => {
                const val = btn.getAttribute('data-align') || '';
                btn.classList.toggle('active', val === alignVal);
            });

            // Update Font dropdown label & active class
            const currentFont = formats.font || '';
            const fontLabel = toolbar.querySelector('#btn-toolbar-font .trigger-label');
            if (fontLabel) {
                const activeFontItem = toolbar.querySelector(`.font-item[data-font="${currentFont}"]`);
                fontItems.forEach(i => i.classList.remove('active'));
                if (activeFontItem) {
                    activeFontItem.classList.add('active');
                    fontLabel.textContent = activeFontItem.textContent;
                } else {
                    fontLabel.textContent = '맑은 고딕';
                }
            }

            // Update Size dropdown label & active class
            const currentSize = formats.size || '11pt';
            const sizeLabel = toolbar.querySelector('#btn-toolbar-size .trigger-label');
            if (sizeLabel) {
                const activeSizeItem = toolbar.querySelector(`.size-item[data-size="${currentSize}"]`);
                sizeItems.forEach(i => i.classList.remove('active'));
                if (activeSizeItem) {
                    activeSizeItem.classList.add('active');
                    sizeLabel.textContent = activeSizeItem.textContent;
                } else {
                    sizeLabel.textContent = currentSize;
                }
            }

            // Update color dots active states & indicator
            const defaultColor = document.body.classList.contains('theme-white') ? '#111827' : '#f3f4f6';
            const currentColor = formats.color || defaultColor;
            colorDots.forEach(dot => {
                const dotColor = dot.getAttribute('data-color');
                dot.classList.toggle('active', dotColor === currentColor);
            });
            const textIndicator = toolbar.querySelector('#indicator-text-color');
            if (textIndicator) textIndicator.style.backgroundColor = currentColor;

            // Update bg dots active states & indicator
            const currentBg = formats.background || 'transparent';
            bgDots.forEach(dot => {
                const dotBg = dot.getAttribute('data-bg');
                dot.classList.toggle('active', dotBg === currentBg);
            });
            const bgIndicator = toolbar.querySelector('#indicator-bg-color');
            if (bgIndicator) {
                bgIndicator.style.backgroundColor = currentBg === 'transparent' ? 'transparent' : currentBg;
            }
        };

        editor.on('selection-change', (range) => {
            if (range) {
                updateToolbarState();
            }
        });
        editor.on('text-change', () => {
            updateToolbarState();
        });
        
        // Initial run
        updateToolbarState();
    }

    function openCompose(to = '', subject = '', body = '', cc = '') {
        // Clear existing tags
        if (mailToContainer) {
            mailToContainer.querySelectorAll('.email-tag').forEach(t => t.remove());
            updatePlaceholder(mailToContainer);
        }
        if (mailCcContainer) {
            mailCcContainer.querySelectorAll('.email-tag').forEach(t => t.remove());
            updatePlaceholder(mailCcContainer);
        }

        if (to) {
            to.split(',').forEach(email => {
                const trimmed = email.trim();
                if (trimmed) addEmailTag(mailToContainer, trimmed);
            });
        }
        if (cc) {
            cc.split(',').forEach(email => {
                const trimmed = email.trim();
                if (trimmed) addEmailTag(mailCcContainer, trimmed);
            });
        }

        formCompose.to.value = ''; // Clear text input
        formCompose.cc.value = ''; // Clear text input
        formCompose.subject.value = subject;
        formCompose.body.value = body; // used as fallback or internal state
        uploadedFiles = [];
        updateAttachmentsList();
        composeModal.classList.remove('hidden');

        if (!quillEditor) {
            const Font = Quill.import('formats/font');
            Font.whitelist = ['', 'dotum', 'gulim', 'batang', 'gungsuh'];
            Quill.register(Font, true);

            // Register numeric point sizes for Quill
            const Size = Quill.import('formats/size');
            Size.whitelist = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '20pt'];
            Quill.register(Size, true);

            quillEditor = new Quill('#quill-editor', {
                theme: 'snow',
                modules: {
                    table: true,
                    toolbar: false // Disable Quill default toolbar
                },
                placeholder: '여기에 메일 내용을 작성하세요...'
            });

            // Initialize custom toolbar event handlers
            initCustomToolbar(quillEditor);
        }
        
        // Construct body with signature if enabled
        let signatureHtml = '';
        if (state.user && state.user.use_signature && state.user.signature) {
            const rawSig = state.user.signature;
            // If signature looks like HTML (has < and >), use it as is; otherwise convert \n to <br>
            const formattedSig = (rawSig.includes('<') && rawSig.includes('>')) ? rawSig : rawSig.replace(/\n/g, '<br>');
            signatureHtml = `<br><br>--<br>${formattedSig}`;
        }

        let htmlBody = '';
        if (body) {
            if (body.startsWith('\n\n')) {
                htmlBody = '<br><br>' + signatureHtml + body.substring(2).replace(/\n/g, '<br>');
            } else {
                htmlBody = body.replace(/\n/g, '<br>');
                if (signatureHtml && (!state.user.signature || !body.includes(state.user.signature))) {
                    htmlBody += signatureHtml;
                }
            }
        } else {
            htmlBody = signatureHtml;
        }
        quillEditor.root.innerHTML = htmlBody;
        
        // Autofocus the recipient input field
        setTimeout(() => {
            if (formCompose.to) {
                formCompose.to.focus();
            }
        }, 50);

        // Refresh custom toolbar scroll navigation arrows
        setTimeout(() => {
            const toolbar = document.getElementById('custom-editor-toolbar');
            if (toolbar) {
                toolbar.dispatchEvent(new Event('refresh-arrows'));
            }
        }, 150);

        // Save initial state to check if modified when closing
        composeInitialState = {
            to: formCompose.to.value.trim(),
            subject: formCompose.subject.value.trim(),
            bodyHtml: quillEditor ? quillEditor.root.innerHTML : ''
        };
    }

    formCompose.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Collect tags from containers
        const toEmails = Array.from(mailToContainer.querySelectorAll('.email-tag')).map(t => t.dataset.email);
        const ccEmails = Array.from(mailCcContainer.querySelectorAll('.email-tag')).map(t => t.dataset.email);
        
        // Also check if there's an untagged email in the input
        const toInputVal = mailToInput.value.trim();
        if (toInputVal && validateEmail(toInputVal)) toEmails.push(toInputVal);
        
        const ccInputVal = mailCcInput.value.trim();
        if (ccInputVal && validateEmail(ccInputVal)) ccEmails.push(ccInputVal);

        if (toEmails.length === 0) {
            showToast('받는 이 이메일 주소를 입력해주세요.');
            mailToInput.focus();
            return;
        }

        const to = toEmails.join(', ');
        const cc = ccEmails.join(', ');
        const subject = formCompose.subject.value;
        let body = '';
        
        if (quillEditor) {
            body = quillEditor.root.innerHTML;
            if (quillEditor.getText().trim().length === 0 && !body.includes('<img')) {
                showToast('내용을 입력해주세요.');
                return;
            }
        }

        showToast('메일을 발송 중입니다...');

        const formData = new FormData();
        formData.append('to', to);
        if (cc) formData.append('cc', cc);
        formData.append('subject', subject);
        formData.append('body', body);
        formData.append('is_html', 1); // Always send as HTML

        // 현재 폴더에서 외부 계정 ID 추출 (ext_{id}_... 형식)
        const folderMatch = state.currentFolder ? state.currentFolder.match(/^ext_(\d+)_/) : null;
        if (folderMatch) formData.append('account_id', folderMatch[1]);

        uploadedFiles.forEach(file => {
            formData.append('attachments[]', file);
        });

        const res = await apiRequest('send_email', 'POST', formData);
        if (res.success) {
            showToast(res.message);
            composeModal.classList.add('hidden');
            formCompose.reset();
            uploadedFiles = [];
            updateAttachmentsList();
            // If we are currently viewing Sent folder, reload it
            if (state.currentFolder === 'Sent') {
                loadEmails('Sent');
            }
        } else {
            showToast(res.message);
        }
    });

    // --------------------------------------------------
    // ADMIN ACTIONS
    // --------------------------------------------------
    let allAdminUsers = []; // Cache list for client-side filtering
    let adminGroupsList = [];

    async function loadAdminUsers(refreshOnly = false) {
        if (!refreshOnly) {
            adminUserList.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 회원 목록 불러오는 중...</td></tr>';
        }
        
        const groupsRes = await apiRequest('admin_list_groups');
        adminGroupsList = groupsRes.success ? (groupsRes.groups || []) : [];

        const res = await apiRequest('admin_list_users');
        if (res.success) {
            allAdminUsers = res.users || [];
            
            // Build Group Filter Dropdown
            const groupFilterOptions = document.getElementById('header-group-filter-options');
            const groupFilterTrigger = document.getElementById('btn-header-filter-trigger');
            
            if (groupFilterOptions && groupFilterTrigger) {
                groupFilterOptions.innerHTML = '';
                const allLabel = document.createElement('label');
                allLabel.className = 'multi-group-option-label filter-all-label';
                allLabel.innerHTML = `<input type="checkbox" id="chk-filter-all" value="all" checked><span>전체</span>`;
                groupFilterOptions.appendChild(allLabel);

                adminGroupsList.forEach(g => {
                    const label = document.createElement('label');
                    label.className = 'multi-group-option-label';
                    label.innerHTML = `<input type="checkbox" class="chk-filter-group-item" value="${escapeHtml(g.name)}" checked><span>${escapeHtml(g.name)}</span>`;
                    groupFilterOptions.appendChild(label);
                });

                groupFilterTrigger.onclick = (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.multi-group-options').forEach(opt => { if (opt !== groupFilterOptions) opt.classList.add('hidden'); });
                    groupFilterOptions.classList.toggle('hidden');
                    if (!groupFilterOptions.classList.contains('hidden')) positionDropdown(groupFilterTrigger, groupFilterOptions);
                };

                const chkAll = document.getElementById('chk-filter-all');
                const chkItems = groupFilterOptions.querySelectorAll('.chk-filter-group-item');
                chkAll.onchange = () => { chkItems.forEach(c => c.checked = chkAll.checked); updateFilterUI(); };
                chkItems.forEach(chk => { chk.onchange = () => {
                    const allChecked = Array.from(chkItems).every(c => c.checked);
                    const noneChecked = Array.from(chkItems).every(c => !c.checked);
                    chkAll.checked = allChecked; chkAll.indeterminate = !allChecked && !noneChecked;
                    updateFilterUI();
                }; });
            }

            // Build Status Filter Dropdown
            const statusFilterOptions = document.getElementById('header-status-filter-options');
            const statusFilterTrigger = document.getElementById('btn-header-status-filter-trigger');
            if (statusFilterOptions && statusFilterTrigger) {
                statusFilterTrigger.onclick = (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.multi-group-options').forEach(opt => { if (opt !== statusFilterOptions) opt.classList.add('hidden'); });
                    statusFilterOptions.classList.toggle('hidden');
                    if (!statusFilterOptions.classList.contains('hidden')) positionDropdown(statusFilterTrigger, statusFilterOptions);
                };
                const chkStatusAll = document.getElementById('chk-filter-status-all');
                const chkStatusItems = statusFilterOptions.querySelectorAll('.chk-filter-status-item');
                chkStatusAll.onchange = () => { chkStatusItems.forEach(c => c.checked = chkStatusAll.checked); updateFilterUI(); };
                chkStatusItems.forEach(chk => { chk.onchange = () => {
                    const allChecked = Array.from(chkStatusItems).every(c => c.checked);
                    const noneChecked = Array.from(chkStatusItems).every(c => !c.checked);
                    chkStatusAll.checked = allChecked; chkStatusAll.indeterminate = !allChecked && !noneChecked;
                    updateFilterUI();
                }; });
            }

            function positionDropdown(trigger, options) {
                const rect = trigger.getBoundingClientRect();
                options.style.position = 'fixed';
                options.style.left = `${rect.left}px`;
                options.style.top = `${rect.bottom + 4}px`;
                options.style.width = 'auto';
                options.style.minWidth = `${rect.width}px`;
                options.style.maxWidth = '300px';
                
                // Adjustment for right-side overflow
                setTimeout(() => {
                    const optionsRect = options.getBoundingClientRect();
                    if (optionsRect.right > window.innerWidth - 20) {
                        options.style.left = 'auto';
                        options.style.right = `${window.innerWidth - rect.right}px`;
                    }
                }, 0);
            }

            function updateFilterUI() {
                const groupTriggerSpan = groupFilterTrigger.querySelector('span');
                const groupItems = groupFilterOptions.querySelectorAll('.chk-filter-group-item');
                const selGroups = Array.from(groupItems).filter(c => c.checked).length;
                if (document.getElementById('chk-filter-all').checked || selGroups === adminGroupsList.length) groupTriggerSpan.textContent = '그룹';
                else if (selGroups === 0) groupTriggerSpan.textContent = '그룹 (0)';
                else groupTriggerSpan.textContent = selGroups === 1 ? Array.from(groupItems).find(c => c.checked).value : `그룹 (${selGroups})`;

                const statusTriggerSpan = statusFilterTrigger.querySelector('span');
                const statusItems = statusFilterOptions.querySelectorAll('.chk-filter-status-item');
                const selStatus = Array.from(statusItems).filter(c => c.checked).length;
                if (document.getElementById('chk-filter-status-all').checked || selStatus === 3) statusTriggerSpan.textContent = '상태';
                else if (selStatus === 0) statusTriggerSpan.textContent = '상태 (0)';
                else statusTriggerSpan.textContent = selStatus === 1 ? getStatusLabel(Array.from(statusItems).find(c => c.checked).value) : `상태 (${selStatus})`;

                renderAdminUsersTable();
            }

            function getStatusLabel(s) {
                if (s === 'pending') return '승인 요청';
                if (s === 'approved') return '활성화';
                if (s === 'locked') return '잠금 중';
                return s;
            }

            // Setup sorting
            const headers = document.querySelectorAll('.admin-table th.sortable');
            headers.forEach(h => {
                h.onclick = () => {
                    const sortKey = h.dataset.sort;
                    if (state.adminSortKey === sortKey) {
                        state.adminSortOrder = state.adminSortOrder === 'asc' ? 'desc' : 'asc';
                    } else {
                        state.adminSortKey = sortKey;
                        state.adminSortOrder = 'asc';
                    }
                    headers.forEach(th => th.classList.remove('active'));
                    h.classList.add('active');
                    const icon = h.querySelector('i');
                    headers.forEach(th => { const i = th.querySelector('i'); if (i) i.className = 'fa-solid fa-sort'; });
                    icon.className = state.adminSortOrder === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                    renderAdminUsersTable();
                };
            });

            updateFilterUI();
        } else {
            showToast(res.message);
        }
    }

    function renderAdminUsersTable(highlightId = null) {
        adminUserList.innerHTML = '';
        
        const groupItems = document.querySelectorAll('.chk-filter-group-item');
        const chkAllGroup = document.getElementById('chk-filter-all');
        const selectedGroups = chkAllGroup.checked ? 'all' : Array.from(groupItems).filter(c => c.checked).map(c => c.value);

        const statusItems = document.querySelectorAll('.chk-filter-status-item');
        const chkAllStatus = document.getElementById('chk-filter-status-all');
        const selectedStatus = chkAllStatus.checked ? 'all' : Array.from(statusItems).filter(c => c.checked).map(c => c.value);

        let filteredUsers = allAdminUsers.filter(user => {
            // Group Filter
            let groupMatch = selectedGroups === 'all';
            if (!groupMatch) {
                const uGroups = (user.group_name || '기본').split(',').map(s => s.trim());
                groupMatch = uGroups.some(g => selectedGroups.includes(g));
            }
            // Status Filter
            let statusMatch = selectedStatus === 'all';
            if (!statusMatch) {
                statusMatch = selectedStatus.includes(user.status);
            }
            return groupMatch && statusMatch;
        });

        // Apply Sorting
        if (state.adminSortKey) {
            filteredUsers.sort((a, b) => {
                let valA = a[state.adminSortKey] || '';
                let valB = b[state.adminSortKey] || '';
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                
                if (valA < valB) return state.adminSortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return state.adminSortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        }

        if (filteredUsers.length === 0) {
            adminUserList.innerHTML = '<tr><td colspan="6" style="text-align: center;">조건에 맞는 회원이 존재하지 않습니다.</td></tr>';
            return;
        }

        filteredUsers.forEach(user => {
            const tr = document.createElement('tr');
            if (highlightId && user.id == highlightId) tr.classList.add('new-row-highlight');
            
            let statusBadge = '';
            let actionButtons = '';
            if (user.status === 'pending') {
                statusBadge = '<span class="status-badge pending">승인 요청</span>';
                actionButtons = `<button class="btn-admin-action approve" data-id="${user.id}"><i class="fa-solid fa-check"></i> 승인</button>
                                 <button class="btn-admin-action reject" data-id="${user.id}"><i class="fa-solid fa-xmark"></i> 거절</button>`;
            } else if (user.status === 'approved') {
                if (user.role === 'admin') {
                    statusBadge = '<span class="status-badge admin">관리자</span>';
                } else {
                    statusBadge = '<span class="status-badge approved">활성화</span>';
                }
                const lockButton = user.role !== 'admin' ? `<button class="btn-admin-action lock" data-id="${user.id}"><i class="fa-solid fa-lock"></i> 잠금</button>` : '';
                const deleteButton = user.username !== 'dj' ? `<button class="btn-admin-action delete" data-id="${user.id}"><i class="fa-solid fa-trash"></i> 삭제</button>` : '';
                actionButtons = lockButton || deleteButton ? `${lockButton} ${deleteButton}` : '<span style="color: var(--text-muted); font-size: 11px;">보호된 회원</span>';
            } else if (user.status === 'locked') {
                statusBadge = '<span class="status-badge locked">잠금 중</span>';
                actionButtons = `<button class="btn-admin-action approve" data-id="${user.id}"><i class="fa-solid fa-lock-open"></i> 해제</button>
                                 <button class="btn-admin-action delete" data-id="${user.id}"><i class="fa-solid fa-trash"></i> 삭제</button>`;
            } else if (user.status === 'rejected') {
                statusBadge = '<span class="status-badge rejected">승인 거부</span>';
                actionButtons = `<button class="btn-admin-action approve" data-id="${user.id}"><i class="fa-solid fa-check"></i> 승인</button>
                                 <button class="btn-admin-action delete" data-id="${user.id}"><i class="fa-solid fa-trash"></i> 삭제</button>`;
            }

            const uGroups = (user.group_name || '기본').split(',').map(s => s.trim());
            let groupSelectHtml = `<div class="multi-group-dropdown" data-id="${user.id}"><button class="btn-multi-group-trigger" type="button"><span>${escapeHtml(uGroups.join(', '))}</span> <i class="fa-solid fa-caret-down"></i></button><div class="multi-group-options hidden">`;
            adminGroupsList.forEach(g => {
                const isChecked = uGroups.includes(g.name) ? 'checked' : '';
                groupSelectHtml += `<label class="multi-group-option-label"><input type="checkbox" class="chk-user-group-item" data-id="${user.id}" value="${escapeHtml(g.name)}" ${isChecked}><span>${escapeHtml(g.name)}</span></label>`;
            });
            groupSelectHtml += `</div></div>`;

            tr.innerHTML = `
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.name)}</td>
                <td class="col-group">${groupSelectHtml}</td>
                <td>${user.last_login || '-'}</td>
                <td class="col-status">${statusBadge}</td>
                <td>
                    <div class="admin-actions-cell">
                        ${actionButtons}
                    </div>
                </td>
            `;
            adminUserList.appendChild(tr);
        });

        // Re-bind actions (simplified from original for brevity, maintaining logic)
        adminUserList.querySelectorAll('.btn-multi-group-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const options = btn.nextElementSibling;
                document.querySelectorAll('.multi-group-options').forEach(opt => { if (opt !== options) opt.classList.add('hidden'); });
                options.classList.toggle('hidden');
                if (!options.classList.contains('hidden')) {
                    const rect = btn.getBoundingClientRect();
                    options.style.position = 'fixed'; 
                    options.style.left = `${rect.left}px`; 
                    options.style.width = 'auto'; 
                    options.style.minWidth = `${rect.width}px`;
                    options.style.maxWidth = '300px';
                    
                    const h = options.offsetHeight || 150;
                    if (rect.bottom + h > window.innerHeight - 20) { 
                        options.style.top = 'auto'; 
                        options.style.bottom = `${window.innerHeight - rect.top + 4}px`; 
                    } else { 
                        options.style.bottom = 'auto'; 
                        options.style.top = `${rect.bottom + 4}px`; 
                    }
                    
                    // Right side overflow check
                    setTimeout(() => {
                        const oRect = options.getBoundingClientRect();
                        if (oRect.right > window.innerWidth - 20) {
                            options.style.left = 'auto';
                            options.style.right = `${window.innerWidth - rect.right}px`;
                        }
                    }, 0);
                }
            });
        });

        adminUserList.querySelectorAll('.chk-user-group-item').forEach(chk => {
            chk.addEventListener('change', async (evt) => {
                const id = evt.target.dataset.id;
                const dropdown = evt.target.closest('.multi-group-dropdown');
                const checkedGroups = Array.from(dropdown.querySelectorAll('.chk-user-group-item:checked')).map(c => c.value);
                if (checkedGroups.length === 0) { evt.target.checked = true; showToast('회원은 최소 1개 이상의 그룹에 속해야 합니다.'); return; }
                const group_names_str = checkedGroups.join(', ');
                showToast('그룹 변경 중...');
                const r = await apiRequest('admin_update_user_group', 'POST', { id, group_name: group_names_str });
                showToast(r.message);
                if (r.success) {
                    const u = allAdminUsers.find(user => user.id == id);
                    if (u) u.group_name = group_names_str;
                    dropdown.querySelector('.btn-multi-group-trigger span').textContent = group_names_str;
                } else { evt.target.checked = !evt.target.checked; }
            });
        });

        adminUserList.querySelectorAll('.btn-admin-action').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                let act = '';
                if (btn.classList.contains('approve')) act = btn.textContent.includes('해제') ? 'admin_unlock' : 'admin_approve';
                else if (btn.classList.contains('lock')) act = 'admin_lock';
                else if (btn.classList.contains('reject')) {
                    if (!await customConfirm('이 사용자의 승인을 거절하시겠습니까?', 'fa-solid fa-triangle-exclamation')) return;
                    act = 'admin_reject';
                }
                else if (btn.classList.contains('delete')) {
                    if (!await customConfirm('이 계정을 삭제하시겠습니까?', 'fa-solid fa-triangle-exclamation')) return;
                    act = 'admin_delete';
                }
                showToast('처리 중...');
                const r = await apiRequest(act, 'POST', { id });
                showToast(r.message);
                if (r.success) loadAdminUsers(true);
            };
        });
    }

    // --------------------------------------------------
    // EVENT LISTENERS
    // --------------------------------------------------
    btnCompose.addEventListener('click', () => openCompose());
    if (btnCloseCompose) btnCloseCompose.addEventListener('click', attemptCloseCompose);
    
    const btnComposeConfirmDelete = document.getElementById('btn-compose-confirm-delete');
    if (btnComposeConfirmDelete) {
        btnComposeConfirmDelete.addEventListener('click', () => {
            document.getElementById('compose-confirm-modal').classList.add('hidden');
            composeModal.classList.add('hidden');
            formCompose.reset();
            if (quillEditor) {
                quillEditor.root.innerHTML = '';
            }
        });
    }
    
    const btnComposeConfirmCancel = document.getElementById('btn-compose-confirm-cancel');
    if (btnComposeConfirmCancel) {
        btnComposeConfirmCancel.addEventListener('click', () => {
            document.getElementById('compose-confirm-modal').classList.add('hidden');
        });
    }

    setupClickOutside(document.getElementById('compose-confirm-modal'));
    
    btnRefresh.addEventListener('click', () => {
        loadEmails(state.currentFolder, false);
        updateGlobalUnreadCount(true);
        triggerBackgroundSync();
    });

    if (btnShowExternalImages) {
        btnShowExternalImages.addEventListener('click', () => {
            try {
                if (state.currentEmailUnfilteredContent) {
                    mailBodyFrame.srcdoc = state.currentEmailUnfilteredContent;
                }
            } catch (err) {
                console.error('Error showing external images:', err);
            }
            if (externalImageBanner) {
                externalImageBanner.classList.add('hidden');
            }
        });
    }
    
    const btnEmptyTrash = document.getElementById('btn-empty-trash');
    if (btnEmptyTrash) {
        btnEmptyTrash.addEventListener('click', async () => {
            if (await customConfirm('휴지통의 모든 메일을 영구 삭제하시겠습니까?\n삭제된 이후에는 복구할 수 없습니다.', 'fa-solid fa-triangle-exclamation')) {
                showToast('휴지통을 비우는 중입니다...');
                const res = await apiRequest('empty_trash', 'POST');
                showToast(res.message);
                if (res.success) {
                    loadEmails('Trash');
                    readerEmpty.classList.remove('hidden');
                    readerContent.classList.add('hidden');
                    state.selectedEmailId = null;
                }
            }
        });
    }

    mailSearch.addEventListener('input', renderMailList);
    
    btnAdmin.addEventListener('click', () => {
        adminModal.classList.remove('hidden');
        loadAdminUsers();
    });
    if (btnCloseAdmin) btnCloseAdmin.addEventListener('click', () => adminModal.classList.add('hidden'));

    // Close multi-group dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.multi-group-options').forEach(options => {
            const dropdown = options.closest('.multi-group-dropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                options.classList.add('hidden');
            }
        });
    });

    // Close multi-group dropdowns when scrolling inside the admin body
    const adminBody = document.querySelector('.admin-body');
    if (adminBody) {
        adminBody.addEventListener('scroll', () => {
            document.querySelectorAll('.multi-group-options').forEach(options => {
                options.classList.add('hidden');
            });
        });
    }

    // Collapsible Tags Menu Toggle
    const btnToggleTags = document.getElementById('btn-toggle-tags');
    const sidebarTagsContainer = document.getElementById('sidebar-tags-container');
    const sidebarTagsWrapper = document.getElementById('sidebar-tags-wrapper');
    const tagsMenuArrow = document.getElementById('tags-menu-arrow');
    
    function renderTagsPopoverList(tags) {
        const popoverList = document.getElementById('tags-popover-list');
        if (!popoverList) return;

        if (tags.length === 0) {
            popoverList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 12px; text-align: center;">생성된 폴더가 없습니다.</div>';
            return;
        }

        popoverList.innerHTML = '';
        tags.forEach(t => {
            const tag = t.name;
            const a = document.createElement('a');
            a.href = '#';
            a.className = `tags-popover-item ${tag === state.currentFolder ? 'active' : ''}`;
            a.dataset.folder = tag;
            const folderColor = getFolderColor(tag);
            a.innerHTML = `<i class="fa-solid fa-folder" style="color: ${folderColor};"></i><span>${escapeHtml(tag)}</span>`;
            
            a.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                setCookie('currentFolder', tag);
                loadEmails(tag);
                document.getElementById('tags-popover').classList.add('hidden');
            });
            popoverList.appendChild(a);
        });
    }

    async function loadTagsPopoverList() {
        const popoverList = document.getElementById('tags-popover-list');
        if (!popoverList) return;
        
        popoverList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 12px; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</div>';
        
        try {
            const res = await apiRequest('list_tags');
            if (res.success) {
                renderTagsPopoverList(res.tags || []);
            } else {
                popoverList.innerHTML = `<div style="padding: 10px; color: var(--text-secondary); font-size: 12px; text-align: center;">로딩 실패: ${escapeHtml(res.message)}</div>`;
            }
        } catch (err) {
            popoverList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 12px; text-align: center;">에러가 발생했습니다.</div>';
        }
    }
    
    if (btnToggleTags && sidebarTagsContainer && sidebarTagsWrapper) {
        btnToggleTags.addEventListener('click', async (e) => {
            if (e.target.closest('#btn-manage-tags')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            
            const tagsPopover = document.getElementById('tags-popover');
            
            if (sidebar.classList.contains('collapsed') && tagsPopover && !tagsPopover.classList.contains('hidden')) {
                tagsPopover.classList.add('hidden');
                return;
            }
            
            // 펼침/접힘 상태 전환 (애니메이션 적용)
            if (!sidebar.classList.contains('collapsed') && sidebarTagsWrapper.classList.contains('expanded')) {
                sidebarTagsWrapper.classList.remove('expanded');
                if (tagsMenuArrow) tagsMenuArrow.classList.remove('rotated');
                return;
            }
            
            try {
                const res = await apiRequest('list_tags');
                const tags = res.success ? (res.tags || []) : [];
                
                if (tags.length === 0) {
                    if (tagsMenuArrow) {
                        tagsMenuArrow.classList.add('rotated');
                        setTimeout(() => {
                            tagsMenuArrow.classList.remove('rotated');
                        }, 300);
                    }
                    showPersonalFolderTooltip();
                    if (tagsPopover) tagsPopover.classList.add('hidden');
                    sidebarTagsWrapper.classList.remove('expanded');
                    return;
                }
                
                if (sidebar.classList.contains('collapsed')) {
                    if (tagsPopover) {
                        renderTagsPopoverList(tags);
                        tagsPopover.classList.remove('hidden');
                    }
                } else {
                    if (tagsPopover) tagsPopover.classList.add('hidden');
                    sidebarTagsContainer.innerHTML = '';
                    tags.forEach(t => {
                        const tag = t.name;
                        const a = document.createElement('a');
                        a.href = '#';
                        a.className = `tag-item ${tag === state.currentFolder ? 'active' : ''}`;
                        a.dataset.folder = tag;
                        const folderColor = getFolderColor(tag);
                        a.innerHTML = `<i class="fa-solid fa-folder" style="color: ${folderColor};"></i><span class="nav-label">${escapeHtml(tag)}</span>`;
                        a.addEventListener('click', (e) => {
                            e.preventDefault();
                            setCookie('currentFolder', tag);
                            loadEmails(tag);
                        });
                        sidebarTagsContainer.appendChild(a);
                    });
                    sidebarTagsWrapper.classList.add('expanded');
                    if (tagsMenuArrow) tagsMenuArrow.classList.add('rotated');
                }
            } catch (err) {
                console.error('Error toggling tags:', err);
            }
        });
    }

    // 팝오버 바깥 영역 클릭시 팝오버 닫기
    document.addEventListener('click', (e) => {
        const tagsPopover = document.getElementById('tags-popover');
        if (tagsPopover && !tagsPopover.classList.contains('hidden')) {
            if (!e.target.closest('#tags-popover') && !e.target.closest('#btn-toggle-tags')) {
                tagsPopover.classList.add('hidden');
            }
        }
    });

    // Tags Management Modal
    const tagsModal = document.getElementById('tags-modal');
    const btnManageTags = document.getElementById('btn-manage-tags');
    const tagsModalList = document.getElementById('tags-modal-list');
    const btnOpenTagCreate = document.getElementById('btn-open-tag-create');
    const tagCreateModal = document.getElementById('tag-create-modal');
    const formCreateTag = document.getElementById('form-create-tag');
    const newTagNameInput = document.getElementById('new-tag-name');
    const tagColorPopover = document.getElementById('tag-color-popover');
    const tagColorGrid = document.getElementById('tag-color-grid');

    if (btnManageTags && tagsModal) {
        btnManageTags.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Populate and show/hide the account select dropdown
            const selectContainer = document.getElementById('tags-account-select-container');
            const selectEl = document.getElementById('tags-account-select');
            const activeAccounts = (state.externalMails || []).filter(a => a.is_active === 1);
            
            if (activeAccounts.length > 1) {
                if (selectContainer) selectContainer.classList.remove('hidden');
                if (selectEl) {
                    selectEl.innerHTML = '';
                    activeAccounts.forEach(acc => {
                        const option = document.createElement('option');
                        option.value = acc.id;
                        const label = acc.service_type === 'onto' ? 'OnTo Mail (기본)' : `${acc.service_type.charAt(0).toUpperCase() + acc.service_type.slice(1)} (${acc.email})`;
                        option.textContent = label;
                        selectEl.appendChild(option);
                    });
                    
                    // Bind change event to reload list
                    const newSelectEl = selectEl.cloneNode(true);
                    selectEl.parentNode.replaceChild(newSelectEl, selectEl);
                    newSelectEl.addEventListener('change', () => {
                        loadTagsModalList();
                    });
                }
            } else {
                if (selectContainer) selectContainer.classList.add('hidden');
            }

            tagsModal.classList.remove('hidden');
            loadTagsModalList();
        });
    }

    if (btnOpenTagCreate && tagCreateModal) {
        btnOpenTagCreate.addEventListener('click', () => {
            tagCreateModal.classList.remove('hidden');
            setTimeout(() => newTagNameInput.focus(), 100);
        });
    }

    setupClickOutside(tagCreateModal);

    async function loadTagsModalList(refreshOnly = false) {
        if (!tagsModalList) return;
        if (!refreshOnly) {
            tagsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
        }

        const selectEl = document.getElementById('tags-account-select');
        const activeAccounts = (state.externalMails || []).filter(a => a.is_active === 1);
        
        let selectedAccId = null;
        if (selectEl && activeAccounts.length > 1 && selectEl.value) {
            selectedAccId = parseInt(selectEl.value);
        } else {
            const onto = activeAccounts.find(a => a.service_type === 'onto');
            if (onto) selectedAccId = onto.id;
        }

        const selectedAcc = activeAccounts.find(a => a.id === selectedAccId);
        const isOnto = selectedAcc ? (selectedAcc.service_type === 'onto') : true;

        const btnOpenTagCreate = document.getElementById('btn-open-tag-create');
        if (btnOpenTagCreate) {
            if (isOnto) {
                btnOpenTagCreate.classList.remove('hidden');
            } else {
                btnOpenTagCreate.classList.add('hidden');
            }
        }

        if (isOnto) {
            const res = await apiRequest('list_tags');
            if (res.success) {
                const tags = res.tags || [];
                tagsModalList.innerHTML = '';
                
                const systemFolders = [
                    { id: 'Starred', name: '즐겨찾기', icon: 'fa-star', color: '#f59e0b' },
                    { id: 'Sent', name: '보낸 편지함', icon: 'fa-paper-plane', color: '#10b981' },
                    { id: 'Drafts', name: '임시 보관함', icon: 'fa-file-signature', color: '#6b7280' },
                    { id: 'Spam', name: '스팸 보관함', icon: 'fa-ban', color: '#ef4444' },
                    { id: 'Trash', name: '휴지통', icon: 'fa-trash-can', color: '#ef4444' },
                    { id: 'custom-tags', name: '개인 보관함', icon: 'fa-box-archive', color: 'var(--text-secondary)' }
                ];
                
                const key = 'mail-hidden-folders-' + (state.user ? state.user.username : '');
                const hiddenFolders = JSON.parse(localStorage.getItem(key) || '{}');
                
                systemFolders.forEach(sys => {
                    const isHidden = !!hiddenFolders[sys.id];
                    const tr = document.createElement('tr');
                    tr.className = 'system-folder-row';
                    
                    tr.innerHTML = `
                        <td>
                            <i class="fa-solid ${sys.icon}" style="color: ${sys.color}; margin-right: 8px;"></i>
                            <span class="system-folder-name-label" style="font-weight: 500;">${sys.name}</span>
                        </td>
                        <td style="text-align: center; white-space: nowrap;">
                            <button class="btn-tag-visibility ${isHidden ? 'hidden-state' : ''}" data-folder="${sys.id}">
                                ${isHidden ? '<i class="fa-solid fa-eye"></i> 표시' : '<i class="fa-solid fa-eye-slash"></i> 숨김'}
                            </button>
                        </td>
                    `;
                    
                    tr.querySelector('.btn-tag-visibility').addEventListener('click', (e) => {
                        const btn = e.currentTarget;
                        const folderId = btn.dataset.folder;
                        toggleFolderVisibility(folderId, btn);
                    });
                    
                    tagsModalList.appendChild(tr);
                });
                
                tags.forEach(t => {
                    const tag = t.name;
                    const isHidden = !!hiddenFolders[tag];
                    const tr = document.createElement('tr');
                    tr.draggable = true;
                    tr.dataset.tag = tag;
                    tr.className = 'tag-drag-item';
                    tr.style.cursor = 'pointer';
                    
                    const folderColor = getFolderColor(tag);
                    tr.innerHTML = `
                        <td>
                            <i class="fa-solid fa-folder tag-folder-icon-clickable" style="color: ${folderColor}; margin-right: 8px; cursor: pointer;" data-tag="${escapeHtml(tag)}"></i> 
                            <span class="tag-name-label" style="cursor: pointer; border-bottom: 1px dashed var(--text-secondary);" title="클릭하여 이름 수정">${escapeHtml(tag)}</span>
                        </td>
                        <td style="text-align: center; white-space: nowrap;">
                            <button class="btn-tag-visibility ${isHidden ? 'hidden-state' : ''}" data-folder="${escapeHtml(tag)}">
                                ${isHidden ? '<i class="fa-solid fa-eye"></i> 표시' : '<i class="fa-solid fa-eye-slash"></i> 숨김'}
                            </button>
                            <button class="btn-tag-delete btn-danger-action" data-tag="${escapeHtml(tag)}"><i class="fa-solid fa-trash-can"></i> 삭제</button>
                        </td>
                    `;
                    
                    tr.querySelector('.btn-tag-visibility').addEventListener('click', (e) => {
                        const btn = e.currentTarget;
                        const folderId = btn.dataset.folder;
                        toggleFolderVisibility(folderId, btn);
                    });

                    const label = tr.querySelector('.tag-name-label');
                    label.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = tag;
                        input.className = 'tag-name-edit-input';
                        input.style.cssText = 'padding: 2px 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 13px; width: 150px;';
                        
                        label.replaceWith(input);
                        input.focus();
                        input.select();
                        
                        let finished = false;
                        
                        const finishEdit = async () => {
                            if (finished) return;
                            finished = true;
                            
                            const newName = input.value.trim();
                            if (!newName || newName === tag) {
                                input.replaceWith(label);
                                return;
                            }
                            
                            if (!/^[\p{L}\p{N}_\- ]+$/u.test(newName)) {
                                showToast('폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-), 공백만 가능합니다.');
                                input.replaceWith(label);
                                return;
                            }
                            
                            showToast('폴더 이름 변경 중...');
                            const r = await apiRequest('rename_tag', 'POST', { old_name: tag, new_name: newName });
                            showToast(r.message);
                            if (r.success) {
                                if (state.currentFolder === tag) {
                                    setCookie('currentFolder', newName);
                                    state.currentFolder = newName;
                                }
                                loadTags();
                                loadTagsModalList(true);
                            } else {
                                input.replaceWith(label);
                            }
                        };
                        
                        input.addEventListener('blur', finishEdit);
                        input.addEventListener('keydown', (evt) => {
                            if (evt.key === 'Enter') finishEdit();
                            if (evt.key === 'Escape') {
                                finished = true;
                                input.replaceWith(label);
                            }
                        });
                    });

                    // Drag and Drop
                    tr.addEventListener('dragstart', (e) => {
                        tr.classList.add('dragging');
                        e.dataTransfer.setData('text/plain', tag);
                    });

                    tr.addEventListener('dragend', () => {
                        tr.classList.remove('dragging');
                        saveTagOrder();
                    });

                    tr.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        const draggingItem = tagsModalList.querySelector('.dragging');
                        if (draggingItem && draggingItem !== tr) {
                            const bounding = tr.getBoundingClientRect();
                            const offset = e.clientY - bounding.top;
                            if (offset > bounding.height / 2) {
                                tr.after(draggingItem);
                            } else {
                                tr.before(draggingItem);
                            }
                        }
                    });

                    tr.querySelector('.btn-tag-delete').addEventListener('click', async (evt) => {
                        const tName = evt.currentTarget.dataset.tag;
                        if (!await customConfirm(`'${tName}' 개인 폴더를 삭제하시겠습니까?\n폴더 내부의 모든 메일은 '휴지통'으로 이동됩니다.`, 'fa-solid fa-triangle-exclamation')) return;
                        
                        showToast('폴더 삭제 중...');
                        const r = await apiRequest('delete_tag', 'POST', { tag_name: tName });
                        showToast(r.message);
                        if (r.success) {
                            loadTagsModalList(true);
                            loadTags();
                            updateGlobalUnreadCount();
                            if (state.currentFolder === tName) {
                                setCookie('currentFolder', 'INBOX');
                                loadEmails('INBOX');
                            }
                        }
                    });

                    // Color picker click handler
                    tr.querySelector('.tag-folder-icon-clickable').addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        const tagVal = evt.currentTarget.dataset.tag;
                        const rect = evt.currentTarget.getBoundingClientRect();
                        
                        tagColorPopover.classList.remove('hidden');
                        tagColorPopover.style.top = `${rect.bottom + 5}px`;
                        tagColorPopover.style.left = `${rect.left}px`;
                        
                        renderColorPicker(tagVal);
                    });
                    
                    tagsModalList.appendChild(tr);
                });
            } else {
                showToast(res.message);
            }
        } else {
            // Load external account's folders via list_external_folders API
            try {
                const res = await apiRequest('list_external_folders', 'GET', { account_id: selectedAccId });
                if (res.success) {
                    const folders = res.folders || [];
                    tagsModalList.innerHTML = '';
                    
                    if (folders.length === 0) {
                        tagsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-secondary); padding: 20px;">불러올 폴더가 없습니다.</td></tr>';
                    } else {
                        folders.forEach(f => {
                            const tr = document.createElement('tr');
                            tr.className = 'external-folder-row';
                            
                            const isHidden = !!f.is_hidden;
                            const isSystem = f.type !== 'custom';
                            const iconClass = f.type === 'inbox' ? 'fa-inbox' : (f.type === 'custom' ? 'fa-folder' : 'fa-folder-open');
                            
                            tr.innerHTML = `
                                <td>
                                    <i class="fa-solid ${iconClass}" style="opacity: 0.6; margin-right: 8px;"></i>
                                    <span style="font-weight: 500;">${escapeHtml(f.display_name || f.path)}</span>
                                    ${isSystem ? '<span style="font-size: 10px; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary); margin-left: 8px;">시스템</span>' : ''}
                                </td>
                                <td style="text-align: center; white-space: nowrap;">
                                    <button class="btn-tag-visibility ${isHidden ? 'hidden-state' : ''}" data-path="${escapeHtml(f.path)}">
                                        ${isHidden ? '<i class="fa-solid fa-eye"></i> 표시' : '<i class="fa-solid fa-eye-slash"></i> 숨김'}
                                    </button>
                                </td>
                            `;
                            
                            const btn = tr.querySelector('.btn-tag-visibility');
                            btn.addEventListener('click', async () => {
                                const nextHidden = isHidden ? 0 : 1;
                                showToast('설정 변경 중...');
                                try {
                                    const updateRes = await apiRequest('update_external_folder_settings', 'POST', {
                                        account_id: selectedAccId,
                                        folder_path: f.path,
                                        is_hidden: nextHidden
                                    });
                                    showToast(updateRes.message);
                                    if (updateRes.success) {
                                        // Update state cache
                                        const cachedAcc = state.externalMails.find(a => a.id === selectedAccId);
                                        if (cachedAcc) {
                                            if (!cachedAcc.folders) cachedAcc.folders = [];
                                            const cachedF = cachedAcc.folders.find(cf => cf.path === f.path);
                                            if (cachedF) {
                                                cachedF.is_hidden = nextHidden;
                                            } else {
                                                cachedAcc.folders.push({ path: f.path, type: f.type, is_hidden: nextHidden });
                                            }
                                        }
                                        loadTagsModalList(true);
                                        renderSidebar(state.currentFolder);
                                    }
                                } catch (e) {
                                    console.error('Error toggling external folder visibility:', e);
                                    showToast('연동 폴더 설정을 변경하지 못했습니다.');
                                }
                            });
                            
                            tagsModalList.appendChild(tr);
                        });
                    }
                } else {
                    tagsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-danger); padding: 20px;">' + escapeHtml(res.message) + '</td></tr>';
                }
            } catch (err) {
                console.error('Error fetching external folders:', err);
                tagsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-danger); padding: 20px;">폴더 목록을 불러오지 못했습니다.</td></tr>';
            }
        }
    }

    async function saveTagOrder() {
        const order = [];
        tagsModalList.querySelectorAll('.tag-drag-item').forEach(tr => {
            order.push(tr.dataset.tag);
        });
        const res = await apiRequest('update_tag_order', 'POST', { order: JSON.stringify(order) });
        if (res.success) {
            loadTags(); // Sidebar refresh
        } else {
            showToast(res.message);
        }
    }

    function renderColorPicker(targetName, isFilter = false) {
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6',
            '#6366f1', '#8b5cf6', '#ffffff', '#71717a', '#000000'
        ];
        
        tagColorGrid.innerHTML = '';
        colors.forEach(color => {
            const item = document.createElement('div');
            item.className = 'tag-color-item';
            item.style.backgroundColor = color;
            item.addEventListener('click', async () => {
                if (isFilter) {
                    const res = await apiRequest('set_filter_color', 'POST', { id: targetName, color: color });
                    if (res.success) {
                        loadFiltersModalList();
                        tagColorPopover.classList.add('hidden');
                    }
                } else {
                    const res = await apiRequest('set_folder_color', 'POST', { folder_name: targetName, color: color });
                    if (res.success) {
                        state.tagColors[targetName] = color;
                        loadTagsModalList(true);
                        loadTags();
                        tagColorPopover.classList.add('hidden');
                    }
                }
            });
            tagColorGrid.appendChild(item);
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tag-color-popover') && !e.target.closest('.tag-folder-icon-clickable') && !e.target.closest('.filter-icon-clickable') && !e.target.closest('.group-icon-clickable') && !e.target.closest('.address-group-icon-clickable')) {
            tagColorPopover.classList.add('hidden');
        }
    });

    // Filters Management Modal
    const filtersModal = document.getElementById('filters-modal');
    const btnManageFilters = document.getElementById('btn-manage-filters');
    const filtersModalList = document.getElementById('filters-modal-list');
    const btnOpenFilterCreate = document.getElementById('btn-open-filter-create');
    const filterCreateModal = document.getElementById('filter-create-modal');
    const formCreateFilter = document.getElementById('form-create-filter');
    const filterActionSelect = document.getElementById('filter-action');
    const filterDestFolderContainer = document.getElementById('filter-dest-folder-container');
    const filterDestFolderSelect = document.getElementById('filter-dest-folder');

    const filterIdInput = document.getElementById('filter-id');
    const filterTitleInput = document.getElementById('filter-title');
    const filterModalTitle = document.getElementById('filter-modal-title');
    const btnSubmitFilter = document.getElementById('btn-submit-filter');

    // Filter Keywords Tagging Logic
    const filterKeywordsContainer = document.getElementById('filter-keywords-container');
    const filterKeywordsInput = document.getElementById('filter-keywords-input');
    const filterKeywordsHidden = document.getElementById('filter-keywords');

    function updateFilterKeywordsHidden() {
        if (!filterKeywordsContainer || !filterKeywordsHidden) return;
        const tags = Array.from(filterKeywordsContainer.querySelectorAll('.email-tag')).map(t => t.dataset.keyword);
        // We always end with a tab character to clearly flag it as the new format
        filterKeywordsHidden.value = tags.length > 0 ? tags.join('\t') + '\t' : '';
        
        // Update placeholder
        if (filterKeywordsInput) {
            const hasTags = tags.length > 0;
            if (hasTags) {
                if (!filterKeywordsInput.dataset.placeholder) {
                    filterKeywordsInput.dataset.placeholder = filterKeywordsInput.placeholder;
                }
                filterKeywordsInput.placeholder = '';
            } else {
                if (filterKeywordsInput.dataset.placeholder) {
                    filterKeywordsInput.placeholder = filterKeywordsInput.dataset.placeholder;
                }
            }
        }
    }

    function addFilterKeywordTag(keyword) {
        if (!filterKeywordsContainer) return false;
        keyword = keyword.trim();
        if (!keyword) return false;

        // Prevent duplicates
        const existingTags = Array.from(filterKeywordsContainer.querySelectorAll('.email-tag')).map(t => t.dataset.keyword);
        if (existingTags.includes(keyword)) return true;

        const tag = document.createElement('div');
        tag.className = 'email-tag';
        tag.dataset.keyword = keyword;
        tag.innerHTML = `
            <span>${escapeHtml(keyword)}</span>
            <span class="tag-remove" title="삭제"><i class="fa-solid fa-xmark"></i></span>
        `;

        tag.querySelector('.tag-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            tag.remove();
            updateFilterKeywordsHidden();
        });

        if (filterKeywordsInput) {
            filterKeywordsContainer.insertBefore(tag, filterKeywordsInput);
        } else {
            filterKeywordsContainer.appendChild(tag);
        }
        updateFilterKeywordsHidden();
        return true;
    }

    function clearFilterKeywordsTags() {
        if (!filterKeywordsContainer) return;
        filterKeywordsContainer.querySelectorAll('.email-tag').forEach(t => t.remove());
        if (filterKeywordsHidden) filterKeywordsHidden.value = '';
        if (filterKeywordsInput) {
            filterKeywordsInput.value = '';
            if (filterKeywordsInput.dataset.placeholder) {
                filterKeywordsInput.placeholder = filterKeywordsInput.dataset.placeholder;
            }
        }
    }

    window.clearFilterKeywordsTags = clearFilterKeywordsTags; // Expose to window/global if needed, but local is fine.

    function loadFilterKeywordsTags(keywordStr) {
        clearFilterKeywordsTags();
        keywordStr = (keywordStr || '').trim();
        if (!keywordStr) return;

        let keywordsArray = [];
        if (keywordStr.includes('\t')) {
            keywordsArray = keywordStr.split('\t');
        } else {
            // Fallback for older filters created with comma/space
            keywordsArray = keywordStr.split(/[,\s]+/).filter(Boolean);
        }

        keywordsArray.forEach(kw => {
            addFilterKeywordTag(kw);
        });
    }

    window.loadFilterKeywordsTags = loadFilterKeywordsTags;

    // Initialize events for keyword container click and input keydowns
    if (filterKeywordsContainer && filterKeywordsInput) {
        filterKeywordsContainer.addEventListener('click', () => {
            filterKeywordsInput.focus();
        });

        filterKeywordsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.key === 'Enter') {
                const val = filterKeywordsInput.value.trim();
                if (val) {
                    if (addFilterKeywordTag(val)) {
                        e.preventDefault();
                        filterKeywordsInput.value = '';
                    }
                } else {
                    // If Tab is pressed but input is empty, let it focus the next element
                    if (e.key === 'Tab') {
                        // Allow normal focus behavior
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                    }
                }
            } else if (e.key === 'Backspace' && !filterKeywordsInput.value) {
                const tags = filterKeywordsContainer.querySelectorAll('.email-tag');
                if (tags.length > 0) {
                    tags[tags.length - 1].remove();
                    updateFilterKeywordsHidden();
                }
            }
        });
        
        filterKeywordsInput.addEventListener('input', (e) => {
            let value = e.target.value;
            // If it contains tabs, handle them immediately (e.g. on paste)
            if (value.includes('\t')) {
                const parts = value.split('\t');
                const last = parts.pop();
                parts.forEach(p => {
                    addFilterKeywordTag(p);
                });
                e.target.value = last;
            }
        });

        filterKeywordsInput.addEventListener('focus', () => {
            filterKeywordsContainer.style.borderColor = 'var(--color-primary)';
            filterKeywordsContainer.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
        });

        filterKeywordsInput.addEventListener('blur', () => {
            filterKeywordsContainer.style.borderColor = 'var(--border-color)';
            filterKeywordsContainer.style.boxShadow = 'none';
        });
    }

    let stateFilters = [];

    if (btnManageFilters && filtersModal) {
        btnManageFilters.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            filtersModal.classList.remove('hidden');
            loadFiltersModalList();
        });
    }

    async function loadFilterDestFolders() {
        filterDestFolderSelect.innerHTML = '';
        
        const draftOpt = document.createElement('option');
        draftOpt.value = 'Drafts';
        draftOpt.textContent = '임시 보관함';
        filterDestFolderSelect.appendChild(draftOpt);
        
        try {
            const res = await apiRequest('list_tags');
            if (res.success) {
                const tags = res.tags || [];
                if (tags.length > 0) {
                    const customGroup = document.createElement('optgroup');
                    customGroup.label = '개인 폴더';
                    tags.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.name;
                        opt.textContent = t.name;
                        customGroup.appendChild(opt);
                    });
                    filterDestFolderSelect.appendChild(customGroup);
                }
            }
        } catch (err) {
            console.error('Error loading tags for filter:', err);
        }
    }

    if (btnOpenFilterCreate && filterCreateModal) {
        btnOpenFilterCreate.addEventListener('click', async () => {
            if (filterIdInput) filterIdInput.value = '';
            if (formCreateFilter) formCreateFilter.reset();
            clearFilterKeywordsTags();
            if (filterModalTitle) filterModalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> 새 필터 추가';
            if (btnSubmitFilter) btnSubmitFilter.textContent = '추가';
            if (filterDestFolderContainer) filterDestFolderContainer.classList.add('hidden');
            
            await loadFilterDestFolders();
            filterCreateModal.classList.remove('hidden');
        });
    }

    if (filterActionSelect && filterDestFolderContainer) {
        filterActionSelect.addEventListener('change', () => {
            const val = filterActionSelect.value;
            const lbl = document.getElementById('lbl-filter-dest-folder');
            
            if (val === 'move' || val === 'copy') {
                filterDestFolderContainer.classList.remove('hidden');
                filterDestFolderSelect.setAttribute('required', 'required');
                
                if (lbl) {
                    lbl.textContent = (val === 'move') ? '이동할 폴더 선택' : '복사할 폴더 선택';
                }
            } else {
                filterDestFolderContainer.classList.add('hidden');
                filterDestFolderSelect.removeAttribute('required');
            }
        });
    }

    if (formCreateFilter) {
        formCreateFilter.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Commit any pending keyword text in the input field
            const kwInput = document.getElementById('filter-keywords-input');
            if (kwInput && kwInput.value.trim()) {
                addFilterKeywordTag(kwInput.value.trim());
                kwInput.value = '';
            }

            const filterId = filterIdInput ? filterIdInput.value : '';
            const title = filterTitleInput ? filterTitleInput.value.trim() : '';
            const chkFrom = document.getElementById('chk-filter-from').checked;
            const chkSubject = document.getElementById('chk-filter-subject').checked;
            const chkBody = document.getElementById('chk-filter-body').checked;
            const keywords = document.getElementById('filter-keywords').value;
            const chkMatchAll = document.getElementById('chk-filter-match-all').checked;
            const actionVal = filterActionSelect.value;
            const destFolder = filterDestFolderSelect.value;

            if (!chkFrom && !chkSubject && !chkBody) {
                showToast('1. 대상 선택에서 최소 하나 이상 선택해야 합니다.');
                return;
            }

            if (!keywords) {
                showToast('2. 키워드를 입력해 주세요.');
                return;
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('filter_from', chkFrom ? '1' : '0');
            formData.append('filter_subject', chkSubject ? '1' : '0');
            formData.append('filter_body', chkBody ? '1' : '0');
            formData.append('keywords', keywords);
            formData.append('match_all', chkMatchAll ? '1' : '0');
            formData.append('action_val', actionVal);
            if (actionVal === 'move' || actionVal === 'copy') {
                formData.append('dest_folder', destFolder);
            }

            let actionName = 'create_filter';
            if (filterId) {
                actionName = 'update_filter';
                formData.append('id', filterId);
            }

            showToast(filterId ? '필터 수정 중...' : '필터 생성 중...');
            const res = await apiRequest(actionName, 'POST', formData);
            showToast(res.message);
            if (res.success) {
                filterCreateModal.classList.add('hidden');
                formCreateFilter.reset();
                if (filterDestFolderContainer) filterDestFolderContainer.classList.add('hidden');
                loadFiltersModalList();

                const createdFilterId = res.filter_id;
                if (createdFilterId) {
                    setTimeout(async () => {
                        const confirmApply = await customConfirm(
                            '이미 받은 메일에도 필터링을 적용할까요?', 
                            'fa-solid fa-circle-question', 
                            '적용', 
                            '안함'
                        );
                        if (confirmApply) {
                            showToast('기존 메일에 필터 적용 중...');
                            const applyRes = await apiRequest('apply_filter_to_existing', 'POST', {
                                filter_id: createdFilterId
                            });
                            showToast(applyRes.message);
                            if (typeof loadEmails === 'function') {
                                loadEmails(state.currentFolder);
                            }
                        }
                    }, 300);
                }
            }
        });
    }

    async function saveFilterOrder() {
        const order = [];
        filtersModalList.querySelectorAll('.tag-drag-item').forEach(tr => {
            order.push(tr.dataset.id);
        });
        const res = await apiRequest('update_filter_order', 'POST', { order: JSON.stringify(order) });
        if (!res.success) {
            showToast(res.message);
        }
    }

    async function loadFiltersModalList() {
        if (!filtersModalList) return;
        filtersModalList.innerHTML = '<tr><td colspan="2" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</td></tr>';

        const res = await apiRequest('list_filters');
        if (res.success) {
            const filters = res.filters || [];
            stateFilters = filters;
            filtersModalList.innerHTML = '';

            if (filters.length === 0) {
                filtersModalList.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-secondary);">설정된 필터가 없습니다.</td></tr>';
                return;
            }

            filters.forEach(f => {
                const tr = document.createElement('tr');
                tr.className = 'tag-drag-item';
                tr.draggable = true;
                tr.dataset.id = f.id;

                const targets = [];
                if (f.filter_from) targets.push('보낸이');
                if (f.filter_subject) targets.push('제목');
                if (f.filter_body) targets.push('내용');

                const keywordsText = f.keywords;

                let actionBadgeHtml = '';
                const getFolderDisplayName = (folderName) => {
                    const map = {
                        'INBOX': '받은 편지함',
                        'Sent': '보낸 편지함',
                        'Drafts': '임시 보관함',
                        'Spam': '스팸 보관함',
                        'Trash': '휴지통'
                    };
                    return map[folderName] || folderName;
                };

                if (f.action === 'delete') {
                    actionBadgeHtml = '<span class="status-badge locked" style="font-size: 11px; width: auto; padding: 2px 6px; display: inline-block; vertical-align: middle;">삭제</span>';
                } else if (f.action === 'move') {
                    actionBadgeHtml = `<span class="status-badge pending" style="font-size: 11px; width: auto; padding: 2px 6px; display: inline-block; vertical-align: middle;">이동</span> <strong>(${getFolderDisplayName(f.dest_folder)})</strong>`;
                } else if (f.action === 'copy') {
                    actionBadgeHtml = `<span class="status-badge approved" style="font-size: 11px; width: auto; padding: 2px 6px; display: inline-block; vertical-align: middle;">복사</span> <strong>(${getFolderDisplayName(f.dest_folder)})</strong>`;
                } else if (f.action === 'star') {
                    actionBadgeHtml = '<span class="status-badge admin" style="font-size: 11px; width: auto; padding: 2px 6px; display: inline-block; vertical-align: middle; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">즐겨찾기</span>';
                }
                tr.innerHTML = `
                    <td style="padding: 12px; display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <span class="filter-icon-clickable" data-id="${f.id}" style="color: ${f.color || '#3b82f6'}; cursor: pointer;"><i class="fa-solid fa-filter"></i></span>
                        <div style="flex: 1; min-width: 0; text-align: left;">
                            <span style="font-weight: bold; color: var(--text-primary); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(f.title)}</span>
                        </div>
                    </td>
                    <td style="text-align: center; padding: 12px; vertical-align: middle; width: 140px;">
                        <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                            <button class="btn-filter-action-edit" data-id="${f.id}" title="필터 수정">
                                <i class="fa-solid fa-pen-to-square"></i> 수정
                            </button>
                            <button class="btn-filter-action-delete" data-id="${f.id}" title="필터 삭제">
                                <i class="fa-solid fa-trash-can"></i> 삭제
                            </button>
                        </div>
                    </td>
                `;

                tr.addEventListener('dragstart', (e) => {
                    tr.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', f.id);
                });

                tr.addEventListener('dragend', () => {
                    tr.classList.remove('dragging');
                    saveFilterOrder();
                });

                tr.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const draggingItem = filtersModalList.querySelector('.dragging');
                    if (draggingItem && draggingItem !== tr) {
                        const bounding = tr.getBoundingClientRect();
                        const offset = e.clientY - bounding.top;
                        if (offset > bounding.height / 2) {
                            tr.after(draggingItem);
                        } else {
                            tr.before(draggingItem);
                        }
                    }
                });

                tr.querySelector('.filter-icon-clickable').addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    const filterId = evt.currentTarget.dataset.id;
                    const rect = evt.currentTarget.getBoundingClientRect();
                    
                    tagColorPopover.classList.remove('hidden');
                    tagColorPopover.style.top = `${rect.bottom + 5}px`;
                    tagColorPopover.style.left = `${rect.left}px`;
                    
                    renderColorPicker(filterId, true);
                });

                tr.querySelector('.btn-filter-action-edit').addEventListener('click', async (evt) => {
                    evt.stopPropagation();
                    const filterId = parseInt(evt.currentTarget.dataset.id, 10);
                    const filterObj = stateFilters.find(x => x.id === filterId);
                    if (!filterObj) return;

                    if (filterIdInput) filterIdInput.value = filterObj.id;
                    if (filterTitleInput) filterTitleInput.value = filterObj.title;
                    document.getElementById('chk-filter-from').checked = (filterObj.filter_from === 1);
                    document.getElementById('chk-filter-subject').checked = (filterObj.filter_subject === 1);
                    document.getElementById('chk-filter-body').checked = (filterObj.filter_body === 1);
                    document.getElementById('filter-keywords').value = filterObj.keywords;
                    loadFilterKeywordsTags(filterObj.keywords || '');
                    const chkMatchAllEl = document.getElementById('chk-filter-match-all');
                    if (chkMatchAllEl) chkMatchAllEl.checked = (filterObj.match_all === 1);
                    filterActionSelect.value = filterObj.action;

                    await loadFilterDestFolders();

                    if (filterObj.action === 'move' || filterObj.action === 'copy') {
                        filterDestFolderSelect.value = filterObj.dest_folder || '';
                    }

                    if (filterModalTitle) filterModalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> 필터 수정';
                    if (btnSubmitFilter) btnSubmitFilter.textContent = '저장';

                    filterActionSelect.dispatchEvent(new Event('change'));

                    filterCreateModal.classList.remove('hidden');
                });

                tr.querySelector('.btn-filter-action-delete').addEventListener('click', async (evt) => {
                    evt.stopPropagation();
                    const filterId = evt.currentTarget.dataset.id;
                    if (!await customConfirm('이 필터 규칙을 삭제하시겠습니까?', 'fa-solid fa-triangle-exclamation')) return;

                    showToast('필터 삭제 중...');
                    const r = await apiRequest('delete_filter', 'POST', { id: filterId });
                    showToast(r.message);
                    if (r.success) {
                        loadFiltersModalList();
                    }
                });

                filtersModalList.appendChild(tr);
            });
        } else {
            showToast(res.message);
        }
    }


    if (formCreateTag) {
        formCreateTag.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tagName = newTagNameInput.value.trim();
            if (!tagName) return;
            
            if (!/^[\p{L}\p{N}_\- ]+$/u.test(tagName)) {
                showToast('폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-), 공백만 가능합니다.');
                return;
            }
            
            showToast('폴더 생성 중...');
            const res = await apiRequest('create_tag', 'POST', { tag_name: tagName });
            showToast(res.message);
            if (res.success) {
                newTagNameInput.value = '';
                tagCreateModal.classList.add('hidden');
                loadTagsModalList(true);
                loadTags();
            }
        });
    }

    // Tag Move Dropdown Click Toggle
    // Tag Move Dropdown Click Toggle
    const btnMoveTag = document.getElementById('btn-move-tag');
    const tagMoveDropdownList = document.getElementById('tag-move-dropdown-list');
    const btnReaderAttachments = document.getElementById('btn-reader-attachments');
    const readerAttachmentsDropdownList = document.getElementById('reader-attachments-dropdown-list');

    if (btnMoveTag && tagMoveDropdownList) {
        btnMoveTag.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (readerAttachmentsDropdownList) readerAttachmentsDropdownList.classList.add('hidden');
            tagMoveDropdownList.classList.toggle('hidden');
        });
        document.addEventListener('click', () => {
            tagMoveDropdownList.classList.add('hidden');
        });
    }

    if (btnReaderAttachments && readerAttachmentsDropdownList) {
        btnReaderAttachments.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (tagMoveDropdownList) tagMoveDropdownList.classList.add('hidden');
            readerAttachmentsDropdownList.classList.toggle('hidden');
        });
        document.addEventListener('click', () => {
            readerAttachmentsDropdownList.classList.add('hidden');
        });
    }



    // --------------------------------------------------
    // SIDEBAR MULTI-ACCOUNT RENDER SYSTEM
    // --------------------------------------------------
    async function loadExternalMailsAndRenderSidebar(folderToLoad = null) {
        try {
            const res = await apiRequest('list_external_mails');
            if (res.success) {
                state.externalMails = res.accounts || [];
                const activeAccs = (state.externalMails || []).filter(a => a.is_active === 1);
                
                // Adjust folder if current folder is no longer valid or if multi/single status changed
                let targetFolder = folderToLoad || state.currentFolder || 'INBOX';
                if (activeAccs.length === 0) {
                    targetFolder = 'INBOX';
                } else if (activeAccs.length > 1 && (targetFolder === 'INBOX' || (!targetFolder.startsWith('ext_') && targetFolder !== 'unified_inbox'))) {
                    if (['INBOX', 'Starred', 'Sent', 'Drafts', 'Spam', 'Trash'].includes(targetFolder)) {
                        targetFolder = 'unified_inbox';
                    }
                } else if (activeAccs.length === 1 && (targetFolder === 'unified_inbox' || targetFolder.startsWith('ext_'))) {
                    targetFolder = 'INBOX';
                }
                
                await renderSidebar(targetFolder);
                loadEmails(targetFolder);
            }
        } catch (err) {
            console.error('Error listing external mails:', err);
        }
    }

    async function renderSidebar(folderToLoad = null) {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav) return;

        const activeAccounts = (state.externalMails || []).filter(a => a.is_active === 1);

        const btnCompose = document.getElementById('btn-compose');
        if (btnCompose) {
            if (activeAccounts.length === 0) {
                btnCompose.classList.add('hidden');
            } else {
                btnCompose.classList.remove('hidden');
            }
        }

        if (activeAccounts.length === 0) {
            // Render no active accounts warning inside sidebar
            sidebarNav.innerHTML = `
                <div class="sidebar-no-accounts" style="padding: 24px 16px; text-align: center; color: var(--text-secondary); margin: 10px; border: 1px dashed var(--border-color); border-radius: 8px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 12px; color: var(--color-warning, #f59e0b); display: block;"></i>
                    <p style="font-size: 13px; margin: 0 0 16px 0; line-height: 1.5; font-weight: 500;">활성화된 메일 계정이 없습니다.</p>
                    <button type="button" id="btn-sidebar-setup-mail" class="btn-submit" style="width: 100%; font-size: 12px; padding: 8px; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--color-primary); color: var(--color-primary-text); border: none; cursor: pointer; font-weight: 600; transition: background-color 0.2s;">
                        <i class="fa-solid fa-gear"></i> 메일 설정하기
                    </button>
                </div>
            `;
            
            const btnSidebarSetupMail = document.getElementById('btn-sidebar-setup-mail');
            if (btnSidebarSetupMail) {
                btnSidebarSetupMail.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const externalMailModal = document.getElementById('external-mail-modal');
                    if (externalMailModal) {
                        externalMailModal.classList.remove('hidden');
                        loadExternalMailSettingsList();
                    }
                });
            }
        } else if (activeAccounts.length === 1) {
            // Render single account (standard) sidebar
            sidebarNav.innerHTML = `
                <a href="#" class="nav-item" data-folder="INBOX">
                    <i class="fa-solid fa-inbox"></i>
                    <span class="nav-label">받은 편지함</span>
                    <span class="badge" style="display:none;">0</span>
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
                    <span class="nav-label">스팸 보관함</span>
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
                    
                    <div id="tags-popover" class="tags-popover hidden">
                        <div class="tags-popover-arrow"></div>
                        <div id="tags-popover-list" class="tags-popover-list"></div>
                    </div>
                    
                    <div id="sidebar-tags-wrapper" class="sidebar-tags-wrapper">
                        <div id="sidebar-tags-container" class="sidebar-tags"></div>
                    </div>
                </div>
            `;
            
            bindSidebarListeners();
            await loadTags();
        } else {
            // Render multi-account sidebar
            let html = `
                <a href="#" class="nav-item" data-folder="unified_inbox">
                    <i class="fa-solid fa-envelopes-bulk" style="color: var(--color-primary);"></i>
                    <span class="nav-label">전체 받은 편지함</span>
                    <span class="badge" style="display:none;">0</span>
                </a>
            `;

            activeAccounts.forEach(acc => {
                const isCollapsed = state.sidebarCollapsedGroups[acc.id] === true;
                const serviceType = acc.service_type;
                // Icon selection based on service type
                const iconMap = {
                    'onto': 'fa-envelope',
                    'naver': 'fa-envelope-circle-check',
                    'gmail': 'fa-envelope-open',
                    'daum': 'fa-paper-plane',
                    'kakao': 'fa-comments',
                    'custom': 'fa-server'
                };
                const serviceIcon = iconMap[serviceType] || 'fa-envelope';
                const serviceLabel = serviceType === 'onto' ? 'OnTo' : (serviceType === 'custom' ? acc.email : `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} (${acc.email})`);
                
                html += `
                    <div class="sidebar-group-header ${isCollapsed ? 'collapsed' : ''}" data-group-id="${acc.id}">
                        <div class="group-title">
                            <i class="fa-solid ${serviceIcon} group-mail-icon" style="color: ${acc.color};"></i>
                            <span class="group-label">${escapeHtml(serviceLabel)}</span>
                        </div>
                        <i class="fa-solid fa-caret-down group-arrow"></i>
                    </div>
                    <div class="sidebar-group-submenu ${isCollapsed ? 'collapsed' : ''}" id="submenu_${acc.id}">
                        <div class="submenu-inner">
                `;
                const folders = acc.folders && acc.folders.length > 0 ? acc.folders : [
                    { path: 'INBOX', type: 'inbox', is_hidden: 0 },
                    { path: 'Sent', type: 'sent', is_hidden: 0 },
                    { path: 'Drafts', type: 'drafts', is_hidden: 0 },
                    { path: 'Spam', type: 'spam', is_hidden: 0 },
                    { path: 'Trash', type: 'trash', is_hidden: 0 }
                ];

                const sortedFolders = [...folders].sort((a, b) => {
                    const typeOrder = {
                        'inbox': 1,
                        'sent': 2,
                        'drafts': 3,
                        'spam': 4,
                        'trash': 5,
                        'custom': 6
                    };
                    const orderA = typeOrder[a.type] || 6;
                    const orderB = typeOrder[b.type] || 6;
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }
                    const nameA = (a.display_name || a.path || '').toLowerCase();
                    const nameB = (b.display_name || b.path || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                sortedFolders.forEach(f => {
                    if (f.is_hidden) return;
                    
                    const iconMap = {
                        'inbox': 'fa-inbox',
                        'sent': 'fa-paper-plane',
                        'drafts': 'fa-file-signature',
                        'spam': 'fa-ban',
                        'trash': 'fa-trash-can'
                    };
                    const icon = iconMap[f.type] || 'fa-folder';
                    
                    let label = f.display_name || f.path;
                    if (f.type === 'inbox') label = '받은 편지함';
                    else if (f.type === 'sent') label = '보낸 편지함';
                    else if (f.type === 'drafts') label = '임시 보관함';
                    else if (f.type === 'spam') label = '스팸 보관함';
                    else if (f.type === 'trash') label = '휴지통';

                    html += `
                        <a href="#" class="nav-item" data-folder="ext_${acc.id}_${escapeHtml(f.path)}">
                            <i class="fa-solid ${icon}"></i>
                            <span class="nav-label">${escapeHtml(label)}</span>
                            <span class="badge" style="display:none;">0</span>
                        </a>
                    `;
                });

                if (acc.service_type === 'onto') {
                    html += `
                        <!-- Collapsible Tags Menu inside OnTo -->
                        <div class="tags-menu-container" id="tags-menu-container" style="position: relative; margin-top: 4px;">
                            <div class="nav-item" id="btn-toggle-tags" style="padding-left: 12px !important;">
                                <i class="fa-solid fa-box-archive"></i>
                                <span class="nav-label">개인 보관함</span>
                                <i class="fa-solid fa-caret-down arrow-icon" id="tags-menu-arrow"></i>
                                <span class="badge" id="badge-tags-combined" style="display:none;">0</span>
                            </div>
                            
                            <div id="tags-popover" class="tags-popover hidden">
                                <div class="tags-popover-arrow"></div>
                                <div id="tags-popover-list" class="tags-popover-list"></div>
                            </div>
                            
                            <div id="sidebar-tags-wrapper" class="sidebar-tags-wrapper">
                                <div id="sidebar-tags-container" class="sidebar-tags"></div>
                            </div>
                        </div>
                    `;
                }

                html += `</div></div>`; // close submenu-inner + sidebar-group-submenu
            });

            sidebarNav.innerHTML = html;

            bindSidebarListeners();
            bindMultiAccountGroupListeners();

            const ontoActive = activeAccounts.some(a => a.service_type === 'onto');
            if (ontoActive) {
                await loadTags();
            }
        }

        if (folderToLoad) {
            state.currentFolder = folderToLoad;
        }
        syncActiveFolderUI();
        applyFolderVisibility();
    }

    function bindSidebarListeners() {
        const items = document.querySelectorAll('.sidebar-nav .nav-item');
        items.forEach(item => {
            if (item.id === 'btn-toggle-tags' || item.classList.contains('sidebar-group-header')) return;
            
            // Re-bind click listener safely
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                
                readerEmpty.classList.remove('hidden');
                readerContent.classList.add('hidden');
                state.selectedEmailId = null;

                const folder = newItem.dataset.folder;
                setCookie('currentFolder', folder);
                loadEmails(folder);
            });
        });

        // Re-bind tags toggle
        const btnToggleTags = document.getElementById('btn-toggle-tags');
        const sidebarTagsContainer = document.getElementById('sidebar-tags-container');
        const sidebarTagsWrapper = document.getElementById('sidebar-tags-wrapper');
        const tagsMenuArrow = document.getElementById('tags-menu-arrow');
        
        if (btnToggleTags && sidebarTagsContainer && sidebarTagsWrapper) {
            btnToggleTags.addEventListener('click', async (e) => {
                if (e.target.closest('#btn-manage-tags')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                
                const tagsPopover = document.getElementById('tags-popover');
                
                if (sidebar.classList.contains('collapsed') && tagsPopover && !tagsPopover.classList.contains('hidden')) {
                    tagsPopover.classList.add('hidden');
                    return;
                }
                
                if (!sidebar.classList.contains('collapsed') && sidebarTagsWrapper.classList.contains('expanded')) {
                    sidebarTagsWrapper.classList.remove('expanded');
                    if (tagsMenuArrow) tagsMenuArrow.classList.remove('rotated');
                    state.personalFolderExpanded = false;
                    localStorage.setItem('mail-personal-folder-expanded', 'false');
                    return;
                }
                
                try {
                    const res = await apiRequest('list_tags');
                    const tags = res.success ? (res.tags || []) : [];
                    
                    if (tags.length === 0) {
                        if (tagsMenuArrow) {
                            tagsMenuArrow.classList.add('rotated');
                            setTimeout(() => {
                                tagsMenuArrow.classList.remove('rotated');
                            }, 300);
                        }
                        showPersonalFolderTooltip();
                        if (tagsPopover) tagsPopover.classList.add('hidden');
                        sidebarTagsWrapper.classList.remove('expanded');
                        return;
                    }
                    
                    if (sidebar.classList.contains('collapsed')) {
                        if (tagsPopover) {
                            renderTagsPopoverList(tags);
                            tagsPopover.classList.remove('hidden');
                        }
                    } else {
                        if (tagsPopover) tagsPopover.classList.add('hidden');
                        sidebarTagsContainer.innerHTML = '';
                        tags.forEach(t => {
                            const tag = t.name;
                            const a = document.createElement('a');
                            a.href = '#';
                            a.className = `tag-item ${tag === state.currentFolder ? 'active' : ''}`;
                            a.dataset.folder = tag;
                            const folderColor = getFolderColor(tag);
                            a.innerHTML = `<i class="fa-solid fa-folder" style="color: ${folderColor};"></i><span class="nav-label">${escapeHtml(tag)}</span>`;
                            a.addEventListener('click', (e) => {
                                e.preventDefault();
                                
                                readerEmpty.classList.remove('hidden');
                                readerContent.classList.add('hidden');
                                state.selectedEmailId = null;

                                setCookie('currentFolder', tag);
                                loadEmails(tag);
                            });
                            sidebarTagsContainer.appendChild(a);
                        });
                        sidebarTagsWrapper.classList.add('expanded');
                        if (tagsMenuArrow) tagsMenuArrow.classList.add('rotated');
                        state.personalFolderExpanded = true;
                        localStorage.setItem('mail-personal-folder-expanded', 'true');
                    }
                } catch (err) {
                    console.error('Error toggling tags:', err);
                }
            });
        }
    }

    function bindMultiAccountGroupListeners() {
        const headers = document.querySelectorAll('.sidebar-group-header');
        headers.forEach(header => {
            header.addEventListener('click', (e) => {
                const id = header.dataset.groupId;
                const submenu = document.getElementById(`submenu_${id}`);
                if (!submenu) return;
                
                const isCollapsed = submenu.classList.contains('collapsed');
                if (isCollapsed) {
                    submenu.classList.remove('collapsed');
                    header.classList.remove('collapsed');
                    state.sidebarCollapsedGroups[id] = false;
                } else {
                    submenu.classList.add('collapsed');
                    header.classList.add('collapsed');
                    state.sidebarCollapsedGroups[id] = true;
                }
                localStorage.setItem('mail-sidebar-collapsed-groups', JSON.stringify(state.sidebarCollapsedGroups));
            });
        });
    }

    // --------------------------------------------------
    // SIGNATURE SETTINGS MODAL UI
    // --------------------------------------------------
    const signatureModal = document.getElementById('signature-modal');
    const btnManageSignature = document.getElementById('btn-manage-signature');
    const btnCloseSignature = document.getElementById('btn-close-signature');
    const formSignature = document.getElementById('form-signature');
    const sigUseCheckbox = document.getElementById('sig-use');
    const sigContentTextarea = document.getElementById('sig-content');
    const sigPreviewDiv = document.getElementById('sig-preview');

    function updateSigPreview() {
        if (!sigPreviewDiv) return;
        const useSig = sigUseCheckbox.checked;
        const text = sigContentTextarea.value;

        if (sigContentTextarea) {
            sigContentTextarea.disabled = !useSig;
        }

        if (!useSig) {
            sigPreviewDiv.style.opacity = '0.5';
            sigPreviewDiv.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">서명 사용이 비활성화되었습니다.</span>';
            return;
        }

        sigPreviewDiv.style.opacity = '1';
        if (!text.trim()) {
            sigPreviewDiv.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">작성된 서명이 없습니다. 내용을 입력하세요.</span>';
        } else {
            // Check if HTML or plain text
            const formatted = (text.includes('<') && text.includes('>')) ? text : text.replace(/\n/g, '<br>');
            sigPreviewDiv.innerHTML = formatted;
        }
    }

    if (sigContentTextarea) {
        sigContentTextarea.addEventListener('input', updateSigPreview);
    }
    if (sigUseCheckbox) {
        sigUseCheckbox.addEventListener('change', updateSigPreview);
    }

    if (btnManageSignature && signatureModal) {
        btnManageSignature.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (state.user) {
                sigUseCheckbox.checked = !!state.user.use_signature;
                sigContentTextarea.value = state.user.signature || '';
            }
            updateSigPreview();
            signatureModal.classList.remove('hidden');
        });
    }

    if (btnCloseSignature && signatureModal) {
        btnCloseSignature.addEventListener('click', () => {
            signatureModal.classList.add('hidden');
        });
    }

    if (formSignature && signatureModal) {
        formSignature.addEventListener('submit', async (e) => {
            e.preventDefault();
            const use_signature = sigUseCheckbox.checked ? 1 : 0;
            const signature = sigContentTextarea.value;

            showToast('서명을 저장하는 중...');
            const res = await apiRequest('update_signature', 'POST', { use_signature, signature });
            showToast(res.message);
            if (res.success) {
                if (state.user) {
                    state.user.use_signature = use_signature;
                    state.user.signature = signature;
                }
                signatureModal.classList.add('hidden');
            }
        });
    }

    setupClickOutside(signatureModal);

    // --------------------------------------------------
    // EXTERNAL MAIL CONFIGURATION SCREEN UI
    // --------------------------------------------------
    const btnManageExternalMail = document.getElementById('btn-manage-external-mail');
    const externalMailModal = document.getElementById('external-mail-modal');
    const btnCloseExternalMail = document.getElementById('btn-close-external-mail');
    const btnAddExternalMail = document.getElementById('btn-add-external-mail');
    const externalMailAccountsList = document.getElementById('external-mail-accounts-list');
    const externalMailDetailPane = document.getElementById('external-mail-detail-pane');

    if (btnManageExternalMail && externalMailModal) {
        btnManageExternalMail.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            externalMailModal.classList.remove('hidden');
            loadExternalMailSettingsList();
        });
    }

    if (btnCloseExternalMail && externalMailModal) {
        btnCloseExternalMail.addEventListener('click', () => {
            externalMailModal.classList.add('hidden');
        });
    }

    async function loadExternalMailSettingsList(selectedAccountId = null) {
        if (!externalMailAccountsList) return;
        externalMailAccountsList.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 20px 0;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</div>';
        
        try {
            const res = await apiRequest('list_external_mails');
            if (res.success) {
                state.externalMails = res.accounts || [];
                renderExternalMailAccountsList(selectedAccountId);
            } else {
                showToast(res.message);
            }
        } catch (err) {
            console.error('Error loading external mail accounts:', err);
        }
    }

    function renderExternalMailAccountsList(selectedAccountId = null) {
        if (!externalMailAccountsList) return;
        externalMailAccountsList.innerHTML = '';
        
        if (state.externalMails.length === 0) {
            externalMailAccountsList.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 20px 0; font-size:12px;">등록된 메일 계정이 없습니다.</div>';
            return;
        }

        state.externalMails.forEach(acc => {
            const item = document.createElement('div');
            item.className = `external-mail-account-item ${acc.is_active ? '' : 'inactive'} ${selectedAccountId == acc.id ? 'active' : ''}`;
            item.dataset.id = acc.id;
            item.draggable = acc.service_type !== 'onto';
            
            const serviceIcon = getServiceIcon(acc.service_type);
            const serviceLabel = acc.service_type === 'onto' ? 'OnTo Mail (기본)' : getServiceLabel(acc.service_type);
            
            item.innerHTML = `
                <span class="service-icon" style="color: ${acc.color};">${serviceIcon}</span>
                <div class="account-info">
                    <span class="account-name">${escapeHtml(serviceLabel)}</span>
                    <span class="account-email">${escapeHtml(acc.email)}</span>
                </div>
            `;
            
            if (acc.service_type !== 'onto') {
                item.addEventListener('dragstart', (e) => {
                    item.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', acc.id);
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    saveExternalMailOrder();
                });

                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const draggingItem = externalMailAccountsList.querySelector('.dragging');
                    if (draggingItem && draggingItem !== item) {
                        const bounding = item.getBoundingClientRect();
                        const offset = e.clientY - bounding.top;
                        const prev = item.previousElementSibling;
                        if (prev && prev.dataset.id && prev.classList.contains('external-mail-account-item')) {
                            if (offset > bounding.height / 2) {
                                item.after(draggingItem);
                            } else {
                                item.before(draggingItem);
                            }
                        } else {
                            item.after(draggingItem);
                        }
                    }
                });
            }

            item.addEventListener('click', () => {
                externalMailAccountsList.querySelectorAll('.external-mail-account-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                renderExternalMailDetail(acc);
            });

            externalMailAccountsList.appendChild(item);
        });

        if (selectedAccountId) {
            const activeItem = externalMailAccountsList.querySelector(`.external-mail-account-item[data-id="${selectedAccountId}"]`);
            if (activeItem) activeItem.click();
        } else if (state.externalMails.length > 0) {
            const firstItem = externalMailAccountsList.querySelector('.external-mail-account-item');
            if (firstItem) firstItem.click();
        }
    }

    async function saveExternalMailOrder() {
        const items = externalMailAccountsList.querySelectorAll('.external-mail-account-item');
        const order = [];
        items.forEach(item => {
            const id = parseInt(item.dataset.id);
            if (id) order.push(id);
        });

        try {
            const res = await apiRequest('update_external_mail_order', 'POST', { order: JSON.stringify(order) });
            if (res.success) {
                loadExternalMailsAndRenderSidebar(state.currentFolder);
            } else {
                showToast(res.message);
            }
        } catch (err) {
            console.error('Error saving external mail order:', err);
        }
    }

    function getServiceIcon(type) {
        switch (type) {
            case 'onto': return '<i class="fa-regular fa-envelope"></i>';
            case 'gmail': return '<i class="fa-brands fa-google"></i>';
            case 'outlook': return '<i class="fa-brands fa-microsoft"></i>';
            case 'icloud': return '<i class="fa-solid fa-cloud"></i>';
            case 'naver': return '<i class="fa-solid fa-n"></i>';
            case 'daum': return '<i class="fa-solid fa-k"></i>';
            default: return '<i class="fa-regular fa-envelope-open"></i>';
        }
    }

    function getServiceLabel(type) {
        switch (type) {
            case 'onto': return 'OnTo';
            case 'gmail': return 'Google Gmail';
            case 'outlook': return 'Outlook';
            case 'icloud': return 'Apple iCloud';
            case 'naver': return 'Naver 메일';
            case 'daum': return 'Daum / Kakao 메일';
            default: return '기타 사용자 IMAP';
        }
    }

    if (btnAddExternalMail) {
        btnAddExternalMail.addEventListener('click', () => {
            if (externalMailAccountsList) {
                externalMailAccountsList.querySelectorAll('.external-mail-account-item').forEach(el => el.classList.remove('active'));
            }
            renderExternalMailDetail(null);
        });
    }

    function renderExternalMailDetail(acc) {
        if (!externalMailDetailPane) return;
        
        // Scroll right detailed view to top
        externalMailDetailPane.scrollTop = 0;
        
        const isNew = !acc;
        const isOnto = acc && acc.service_type === 'onto';
        
        const dispUsername = isOnto ? (acc.mail_username.includes('@') ? acc.mail_username.split('@')[0] : acc.mail_username) : (acc ? acc.mail_username : '');
        
        let headerTitle = isNew ? '새 메일 계정 추가' : `${escapeHtml(getServiceLabel(acc.service_type))} 설정`;
        if (isOnto) headerTitle = 'OnTo 기본 메일 설정';

        // 10 theme colors
        const colorList = [
            '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6',
            '#6366f1', '#8b5cf6', '#ffffff', '#71717a', '#000000'
        ];
        let colorHtml = '';
        const activeColor = acc ? acc.color : '#3b82f6';
        
        colorList.forEach(c => {
            colorHtml += `
                <div class="color-palette-btn ${activeColor === c ? 'selected' : ''}" 
                     style="background-color: ${c};" 
                     data-color="${c}">
                </div>
            `;
        });

        const serviceSelectHtml = `
            <div class="custom-select-wrapper" style="width: 100%;">
                <select id="detail-service-type" ${isOnto ? 'disabled' : ''}>
                    <option value="gmail" ${acc && acc.service_type === 'gmail' ? 'selected' : ''}>Google Gmail</option>
                    <option value="outlook" ${acc && acc.service_type === 'outlook' ? 'selected' : ''}>Outlook / Hotmail</option>
                    <option value="icloud" ${acc && acc.service_type === 'icloud' ? 'selected' : ''}>Apple iCloud</option>
                    <option value="naver" ${acc && acc.service_type === 'naver' ? 'selected' : ''}>Naver 메일</option>
                    <option value="daum" ${acc && acc.service_type === 'daum' ? 'selected' : ''}>Daum / Kakao 메일</option>
                    <option value="custom" ${isNew || (acc && acc.service_type === 'custom') ? 'selected' : ''}>(직접 입력)</option>
                </select>
            </div>
        `;

        let html = `
            <form id="form-external-mail-detail" class="settings-form-section" novalidate>
                <input type="hidden" id="detail-id" value="${acc ? acc.id : ''}">
                <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 8px;">
                    <h4 style="font-size: 15px; font-weight: bold; display: flex; align-items: center; gap: 8px; color: var(--text-primary);">
                        ${isNew ? '<i class="fa-solid fa-circle-plus" style="color:var(--color-primary);"></i>' : '<i class="fa-solid fa-circle-info" style="color:var(--color-primary);"></i>'}
                        ${headerTitle}
                    </h4>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <div style="display:flex; flex-direction:column; gap: 2px;">
                        <span style="font-size: 13px; font-weight: bold; color: var(--text-primary);">계정 활성화 상태</span>
                        <span style="font-size: 11px; color: var(--text-secondary);">해당 계정을 메일함 목록에 노출하고 동기화합니다.</span>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="detail-is-active" ${(!acc || acc.is_active) ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="form-group">
                    <label>메일 구분 색상</label>
                    <div class="color-palette-selector">
                        ${colorHtml}
                        <input type="hidden" id="detail-color" value="${activeColor}">
                    </div>
                </div>

                <div class="input-grid-2x2" style="margin-bottom: 15px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="detail-external-images">외부 이미지 표시</label>
                        <div class="custom-select-wrapper" style="width: 100%;">
                            <select id="detail-external-images">
                                <option value="allow" ${acc && acc.external_images === 'allow' ? 'selected' : ''}>항상 허용</option>
                                <option value="ask" ${!acc || acc.external_images === 'ask' || !acc.external_images ? 'selected' : ''}>묻기</option>
                                <option value="deny" ${acc && acc.external_images === 'deny' ? 'selected' : ''}>거부</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="detail-external-links">외부 링크 허용</label>
                        <div class="custom-select-wrapper" style="width: 100%;">
                            <select id="detail-external-links">
                                <option value="allow" ${acc && acc.external_links === 'allow' ? 'selected' : ''}>항상 허용</option>
                                <option value="ask" ${!acc || acc.external_links === 'ask' || !acc.external_links ? 'selected' : ''}>묻기</option>
                                <option value="deny" ${acc && acc.external_links === 'deny' ? 'selected' : ''}>거부</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${isOnto ? `
                    <div class="input-grid-2x2">
                        <div class="form-group">
                            <label for="detail-email">이메일 이름</label>
                            <input type="email" id="detail-email" value="${acc ? escapeHtml(acc.email) : ''}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="detail-mail-username">로그인 아이디</label>
                            <input type="text" id="detail-mail-username" value="${dispUsername}" readonly>
                        </div>
                    </div>
                ` : `
                    <div class="input-grid-2x2">
                        <div class="form-group">
                            <label for="detail-service-type">서비스 유형</label>
                            ${serviceSelectHtml}
                        </div>
                        <div class="form-group">
                            <label for="detail-email">이메일 이름</label>
                            <input type="email" id="detail-email" placeholder="이메일 이름" value="${acc ? escapeHtml(acc.email) : ''}">
                        </div>
                        <div class="form-group">
                            <label for="detail-mail-username">로그인 아이디</label>
                            <input type="text" id="detail-mail-username" placeholder="아이디 입력" value="${acc ? escapeHtml(acc.mail_username) : ''}">
                        </div>
                        <div class="form-group">
                            <label for="detail-mail-password">암호</label>
                            <input type="password" id="detail-mail-password" placeholder="${isNew ? '암호 입력' : '변경할 때만 입력'}">
                        </div>
                    </div>
                    <p style="font-size: 11px; color: var(--text-muted); margin-top: -6px; margin-bottom: 4px; line-height: 1.3;">
                        <i class="fa-solid fa-circle-question"></i> 구글, 네이버 등은 2단계 인증 후 <strong>앱 비밀번호</strong>를 생성해 입력하세요.
                    </p>
                `}

                ${isOnto ? `
                    <div style="background: rgba(59,130,246,0.06); padding: 16px; border: 1px dashed rgba(59,130,246,0.3); border-radius: var(--radius-sm); margin-top: 10px; display:flex; flex-direction:column; gap:12px;">
                        <h5 style="font-size:12px; font-weight:bold; color: var(--color-primary); display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-circle-nodes"></i> 외부 클라이언트 연동 정보 (IMAP / SMTP)
                        </h5>
                        <p style="font-size:11px; line-height:1.4; color: var(--text-secondary);">
                            스마트폰 메일 앱이나 아웃룩 등 외부 메일 프로그램에서 OnTo 계정 메일을 받아보려면 아래 정보를 입력하세요.
                        </p>
                        <div class="server-settings-grid" style="font-size:12px; grid-template-columns: 1.5fr 1fr 1fr; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px; gap:8px;">
                            <div>
                                <strong style="color:var(--text-primary); display:block; margin-bottom:2px;">수신 서버 (IMAP)</strong>
                                <span style="color:var(--text-secondary);">mail.onto.kr</span>
                            </div>
                            <div>
                                <strong style="color:var(--text-primary); display:block; margin-bottom:2px;">포트번호</strong>
                                <span style="color:var(--text-secondary);">993 (SSL)</span>
                            </div>
                            <div>
                                <strong style="color:var(--text-primary); display:block; margin-bottom:2px;">보안타입</strong>
                                <span style="color:var(--text-secondary);">SSL / TLS</span>
                            </div>
                        </div>
                        <div class="server-settings-grid" style="font-size:12px; grid-template-columns: 1.5fr 1fr 1fr; gap:8px;">
                            <div>
                                <strong style="color:var(--text-primary); display:block; margin-bottom:2px;">송신 서버 (SMTP)</strong>
                                <span style="color:var(--text-secondary);">mail.onto.kr</span>
                            </div>
                            <div>
                                <strong style="color:var(--text-primary); display:block; margin-bottom:2px;">포트번호</strong>
                                <span style="color:var(--text-secondary);">465 (SSL)</span>
                            </div>
                            <div>
                                <strong style="color:var(--text-primary); display:block; margin-bottom:2px;">보안타입</strong>
                                <span style="color:var(--text-secondary);">SSL / TLS</span>
                            </div>
                        </div>
                    </div>
                ` : ''}

                ${isOnto ? '' : `
                    <div id="custom-server-settings" class="hidden" style="background: rgba(255,255,255,0.02); padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-top: 10px; display:flex; flex-direction:column; gap:12px;">
                        <h5 style="font-size:12px; font-weight:bold; color:var(--text-primary);"><i class="fa-solid fa-server"></i> 서버 수동 설정</h5>
                        <div class="server-settings-grid">
                            <div class="form-group">
                                <label for="detail-imap-host">IMAP 서버 호스트</label>
                                <input type="text" id="detail-imap-host" placeholder="imap.domain.com" value="${acc ? escapeHtml(acc.imap_host || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label for="detail-imap-port">IMAP 포트</label>
                                <input type="text" id="detail-imap-port" value="${acc ? acc.imap_port : '993'}">
                            </div>
                            <div class="form-group">
                                <label for="detail-imap-ssl">IMAP 보안</label>
                                <select id="detail-imap-ssl">
                                    <option value="ssl" ${acc && acc.imap_ssl === 'ssl' ? 'selected' : ''}>SSL</option>
                                    <option value="tls" ${acc && acc.imap_ssl === 'tls' ? 'selected' : ''}>TLS</option>
                                    <option value="none" ${acc && acc.imap_ssl === 'none' ? 'selected' : ''}>없음</option>
                                </select>
                            </div>
                        </div>
                        <div class="server-settings-grid">
                            <div class="form-group">
                                <label for="detail-smtp-host">SMTP 서버 호스트</label>
                                <input type="text" id="detail-smtp-host" placeholder="smtp.domain.com" value="${acc ? escapeHtml(acc.smtp_host || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label for="detail-smtp-port">SMTP 포트</label>
                                <input type="text" id="detail-smtp-port" value="${acc ? acc.smtp_port : '465'}">
                            </div>
                            <div class="form-group">
                                <label for="detail-smtp-ssl">SMTP 보안</label>
                                <select id="detail-smtp-ssl">
                                    <option value="ssl" ${acc && acc.smtp_ssl === 'ssl' ? 'selected' : ''}>SSL</option>
                                    <option value="tls" ${acc && acc.smtp_ssl === 'tls' ? 'selected' : ''}>TLS</option>
                                    <option value="none" ${acc && acc.smtp_ssl === 'none' ? 'selected' : ''}>없음</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group" style="flex-direction:row; align-items:center; gap:8px;">
                            <input type="checkbox" id="detail-smtp-auth" ${(!acc || acc.smtp_auth) ? 'checked' : ''} style="width:auto; cursor:pointer;">
                            <label for="detail-smtp-auth" style="font-weight:normal; cursor:pointer; user-select:none;">SMTP 서버 로그인 인증 필요</label>
                        </div>
                    </div>
                `}

                ${isOnto ? '' : `
                <div class="btn-row">
                    <div>
                        ${(!isNew && !isOnto) ? `
                            <button type="button" id="btn-delete-external-mail" class="btn-submit btn-danger-action" style="padding: 10px 16px;">
                                <i class="fa-solid fa-trash-can"></i> 계정 삭제
                            </button>
                        ` : ''}
                    </div>
                    <button type="submit" class="btn-submit" style="padding: 10px 24px;">
                        <i class="fa-solid fa-check"></i> ${isNew ? '추가 완료' : '설정 저장'}
                    </button>
                </div>
                `}
            </form>
        `;

        externalMailDetailPane.innerHTML = html;
        const formDetail = externalMailDetailPane.querySelector('#form-external-mail-detail');
        externalMailDetailPane.scrollTop = 0;
        setTimeout(() => {
            externalMailDetailPane.scrollTop = 0;
        }, 50);

        const colorBtns = externalMailDetailPane.querySelectorAll('.color-palette-btn');
        const colorInput = externalMailDetailPane.querySelector('#detail-color');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                if (colorInput) {
                    colorInput.value = btn.dataset.color;
                    // OnTo Mail saves color immediately
                    if (isOnto && formDetail) {
                        formDetail.requestSubmit();
                    }
                }
            });
        });

        // Immediate activation toggle save
        const toggleActive = externalMailDetailPane.querySelector('#detail-is-active');
        if (toggleActive && !isNew) {
            toggleActive.addEventListener('change', () => {
                if (formDetail) formDetail.requestSubmit();
            });
        }

        // Immediate image display option change save
        const toggleImages = externalMailDetailPane.querySelector('#detail-external-images');
        if (toggleImages && !isNew) {
            toggleImages.addEventListener('change', () => {
                if (formDetail) formDetail.requestSubmit();
            });
        }

        const toggleLinks = externalMailDetailPane.querySelector('#detail-external-links');
        if (toggleLinks && !isNew) {
            toggleLinks.addEventListener('change', () => {
                if (formDetail) formDetail.requestSubmit();
            });
        }

        const serviceSelect = externalMailDetailPane.querySelector('#detail-service-type');
        const customServerSettings = externalMailDetailPane.querySelector('#custom-server-settings');
        
        function checkServiceType() {
            if (!serviceSelect || !customServerSettings) return;
            if (serviceSelect.value === 'custom') {
                customServerSettings.classList.remove('hidden');
            } else {
                customServerSettings.classList.add('hidden');
            }
        }
        
        if (serviceSelect) {
            serviceSelect.addEventListener('change', checkServiceType);
            checkServiceType();
        }

        const btnDeleteAcc = externalMailDetailPane.querySelector('#btn-delete-external-mail');
        if (btnDeleteAcc && acc) {
            btnDeleteAcc.addEventListener('click', async () => {
                if (state.externalMails && state.externalMails.length <= 1) {
                    showToast('최소 하나의 메일 계정은 설정되어 있어야 합니다.');
                    return;
                }
                if (!await customConfirm(`'${acc.email}' 계정 연동을 완전히 해제하고 삭제하시겠습니까?`, 'fa-solid fa-triangle-exclamation')) return;
                
                showToast('계정 연동 해제 중...');
                try {
                    const res = await apiRequest('delete_external_mail', 'POST', { id: acc.id });
                    showToast(res.message);
                    if (res.success) {
                        externalMailDetailPane.innerHTML = `
                            <div class="detail-placeholder" style="margin: auto; text-align: center; color: var(--text-muted); opacity: 0.6;">
                                <i class="fa-solid fa-envelope-open-text" style="font-size: 48px; margin-bottom: 12px; display: block;"></i>
                                <span>메일 계정이 성공적으로 삭제되었습니다.</span>
                            </div>
                        `;
                        loadExternalMailSettingsList();
                        loadExternalMailsAndRenderSidebar(state.currentFolder);
                    }
                } catch (err) {
                    console.error('Error deleting account:', err);
                }
            });
        }

        if (formDetail) {
            formDetail.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Clear previous validation errors
                externalMailDetailPane.querySelectorAll('.validation-error').forEach(el => el.classList.remove('validation-error'));
                externalMailDetailPane.querySelectorAll('.validation-error-balloon').forEach(el => el.remove());
                
                let isValid = true;
                function showError(inputId, message) {
                    const input = document.getElementById(inputId);
                    if (input) {
                        input.classList.add('validation-error');
                        const container = input.parentNode;
                        container.style.position = 'relative'; // Ensure relative positioning
                        
                        const balloon = document.createElement('div');
                        balloon.className = 'validation-error-balloon';
                        balloon.innerText = message;
                        container.appendChild(balloon);
                        
                        input.addEventListener('input', () => {
                            input.classList.remove('validation-error');
                            balloon.remove();
                        }, { once: true });
                    }
                    isValid = false;
                }

                const id = document.getElementById('detail-id').value;
                const email = isOnto ? acc.email : document.getElementById('detail-email').value.trim();
                const mail_username = isOnto ? acc.mail_username : document.getElementById('detail-mail-username').value.trim();
                const is_active = document.getElementById('detail-is-active').checked ? 1 : 0;
                const color = colorInput.value;
                
                // Email format check
                if (!isOnto) {
                    if (!email) {
                        showError('detail-email', '이메일 이름을 입력해주세요.');
                    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        showError('detail-email', '올바른 이메일 형식이 아닙니다.');
                    }
                    
                    if (!mail_username) {
                        showError('detail-mail-username', '로그인 아이디를 입력해주세요.');
                    }
                }

                const data = {
                    id,
                    email,
                    mail_username,
                    is_active,
                    color,
                    external_images: document.getElementById('detail-external-images').value,
                    external_links: document.getElementById('detail-external-links').value
                };

                if (!isOnto) {
                    const service_type = serviceSelect.value;
                    const mail_password = document.getElementById('detail-mail-password').value;
                    const smtp_auth = document.getElementById('detail-smtp-auth') && document.getElementById('detail-smtp-auth').checked ? 1 : 0;
                    
                    if (isNew && !mail_password) {
                        showError('detail-mail-password', '암호를 입력해주세요.');
                    }

                    data.service_type = service_type;
                    data.mail_password = mail_password;
                    data.smtp_auth = smtp_auth;

                    if (service_type === 'custom') {
                        const imap_host = document.getElementById('detail-imap-host').value.trim();
                        const imap_port = document.getElementById('detail-imap-port').value.trim();
                        const imap_ssl = document.getElementById('detail-imap-ssl').value;
                        const smtp_host = document.getElementById('detail-smtp-host').value.trim();
                        const smtp_port = document.getElementById('detail-smtp-port').value.trim();
                        const smtp_ssl = document.getElementById('detail-smtp-ssl').value;

                        if (!imap_host) {
                            showError('detail-imap-host', 'IMAP 호스트를 입력해주세요.');
                        }
                        if (!imap_port) {
                            showError('detail-imap-port', 'IMAP 포트를 입력해주세요.');
                        } else if (!/^\d+$/.test(imap_port)) {
                            showError('detail-imap-port', '포트는 숫자만 입력해야 합니다.');
                        }

                        if (!smtp_host) {
                            showError('detail-smtp-host', 'SMTP 호스트를 입력해주세요.');
                        }
                        if (!smtp_port) {
                            showError('detail-smtp-port', 'SMTP 포트를 입력해주세요.');
                        } else if (!/^\d+$/.test(smtp_port)) {
                            showError('detail-smtp-port', '포트는 숫자만 입력해야 합니다.');
                        }

                        data.imap_host = imap_host;
                        data.imap_port = parseInt(imap_port) || 993;
                        data.imap_ssl = imap_ssl;
                        data.smtp_host = smtp_host;
                        data.smtp_port = parseInt(smtp_port) || 465;
                        data.smtp_ssl = smtp_ssl;
                    } else {
                        const defaults = getServiceDefaults(service_type);
                        Object.assign(data, defaults);
                    }
                } else {
                    data.service_type = 'onto';
                }

                if (!isValid) {
                    const firstError = externalMailDetailPane.querySelector('.validation-error');
                    if (firstError) {
                        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        firstError.focus();
                    }
                    return;
                }

                showToast('설정을 저장하는 중...');
                try {
                    const res = await apiRequest('save_external_mail', 'POST', data);
                    if (res.success) {
                        showToast(res.message);
                        loadExternalMailSettingsList(id || null);
                        loadExternalMailsAndRenderSidebar(state.currentFolder);
                    } else {
                        showToast(res.message);
                        if (res.error_type === 'imap') {
                            ['detail-imap-host', 'detail-imap-port', 'detail-mail-username', 'detail-mail-password'].forEach(fieldId => {
                                const input = document.getElementById(fieldId);
                                if (input) {
                                    input.classList.add('validation-error');
                                    let balloonTargetId = 'detail-imap-host';
                                    if (document.getElementById('detail-service-type') && document.getElementById('detail-service-type').value !== 'custom') {
                                        balloonTargetId = 'detail-mail-password';
                                    }
                                    if (fieldId === balloonTargetId) {
                                        const balloon = document.createElement('div');
                                        balloon.className = 'validation-error-balloon';
                                        balloon.textContent = res.message;
                                        input.parentNode.appendChild(balloon);
                                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                }
                            });
                        } else if (res.error_type === 'smtp') {
                            ['detail-smtp-host', 'detail-smtp-port', 'detail-mail-username', 'detail-mail-password'].forEach(fieldId => {
                                const input = document.getElementById(fieldId);
                                if (input) {
                                    input.classList.add('validation-error');
                                    let balloonTargetId = 'detail-smtp-host';
                                    if (document.getElementById('detail-service-type') && document.getElementById('detail-service-type').value !== 'custom') {
                                        balloonTargetId = 'detail-mail-password';
                                    }
                                    if (fieldId === balloonTargetId) {
                                        const balloon = document.createElement('div');
                                        balloon.className = 'validation-error-balloon';
                                        balloon.textContent = res.message;
                                        input.parentNode.appendChild(balloon);
                                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.error('Error saving external mail account:', err);
                }
            });
        }

    }

    function getServiceDefaults(service) {
        switch (service) {
            case 'gmail':
                return {
                    imap_host: 'imap.gmail.com', imap_port: 993, imap_ssl: 'ssl',
                    smtp_host: 'smtp.gmail.com', smtp_port: 465, smtp_ssl: 'ssl'
                };
            case 'outlook':
                return {
                    imap_host: 'outlook.office365.com', imap_port: 993, imap_ssl: 'ssl',
                    smtp_host: 'smtp.office365.com', smtp_port: 587, smtp_ssl: 'tls'
                };
            case 'icloud':
                return {
                    imap_host: 'imap.mail.me.com', imap_port: 993, imap_ssl: 'ssl',
                    smtp_host: 'smtp.mail.me.com', smtp_port: 587, smtp_ssl: 'tls'
                };
            case 'naver':
                return {
                    imap_host: 'imap.naver.com', imap_port: 993, imap_ssl: 'ssl',
                    smtp_host: 'smtp.naver.com', smtp_port: 465, smtp_ssl: 'ssl'
                };
            case 'daum':
                return {
                    imap_host: 'imap.daum.net', imap_port: 993, imap_ssl: 'ssl',
                    smtp_host: 'smtp.daum.net', smtp_port: 465, smtp_ssl: 'ssl'
                };
            default:
                return {};
        }
    }



    // Personal Settings Modal 연동
    if (btnSettings && settingsModal) {
        btnSettings.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.user) {
                document.getElementById('set-username').value = `${state.user.username}@onto.kr`;
                document.getElementById('set-name').value = state.user.name;
                document.getElementById('set-password').value = '';
                
                // Show profile pic in settings preview
                const previewImg = document.getElementById('set-profile-preview');
                const previewPlaceholder = document.getElementById('set-profile-placeholder');
                if (state.user.profile_pic) {
                    previewImg.src = state.user.profile_pic;
                    previewImg.classList.remove('hidden');
                    previewPlaceholder.classList.add('hidden');
                } else {
                    previewImg.src = '';
                    previewImg.classList.add('hidden');
                    previewPlaceholder.classList.remove('hidden');
                }

                // Select active theme in settings modal
                const currentTheme = localStorage.getItem('mail-theme') || 'gray';
                settingsModal.querySelectorAll('.theme-btn').forEach(btn => {
                    if (btn.dataset.theme === currentTheme) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                const quotaDaily = document.getElementById('mj-quota-daily');
                const quotaMonthly = document.getElementById('mj-quota-monthly');
                const quotaDaysLeft = document.getElementById('mj-quota-days-left');
                const quotaContainer = document.getElementById('mj-quota-container');
                let mjLoadingInterval = null;
                
                function updateDaysLeft() {
                    if (!quotaDaysLeft) return;
                    const now = new Date();
                    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    const daysLeft = endOfMonth.getDate() - now.getDate();
                    
                    if (!quotaDaysLeft.dataset.loading) {
                        quotaDaysLeft.textContent = `D-${daysLeft}`;
                    }
                    
                    let color = 'var(--color-success, #10b981)'; // 0~5일 남음 (녹색)
                    if (daysLeft >= 16) {
                        color = '#8b5cf6'; // 16~30일 남음 (보라색)
                    } else if (daysLeft >= 6) {
                        color = '#3730a3'; // 6~15일 남음 (남색)
                    }
                    
                    quotaDaysLeft.style.color = color;
                    quotaDaysLeft.style.borderColor = color;
                    quotaDaysLeft.style.backgroundColor = `color-mix(in srgb, ${color} 10%, transparent)`;
                }
                
                function applyColorToBadge(el, used, limit) {
                    if (!el) return;
                    if (!el.dataset.loading) {
                        el.textContent = `${limit - used}`;
                    }
                    
                    const ratio = limit > 0 ? (used / limit) : 0;
                    let color = 'var(--color-success, #10b981)';
                    if (ratio >= 0.9) {
                        color = 'var(--color-danger, #ef4444)';
                    } else if (ratio >= 0.7) {
                        color = 'var(--color-warning, #f59e0b)';
                    }
                    
                    el.style.color = color;
                    el.style.borderColor = color;
                    el.style.backgroundColor = `color-mix(in srgb, ${color} 10%, transparent)`;
                }

                async function loadQuota(force = false) {
                    updateDaysLeft();
                    const todayStr = new Date().toISOString().split('T')[0];
                    const cachedStr = localStorage.getItem('mj-quota-data');
                    const cachedDate = localStorage.getItem('mj-quota-date');
                    
                    if (!force && cachedDate === todayStr && cachedStr) {
                        try {
                            const data = JSON.parse(cachedStr);
                            applyColorToBadge(quotaDaily, data.today_used, data.today_limit);
                            applyColorToBadge(quotaMonthly, data.month_used, data.month_limit);
                            return;
                        } catch (e) {}
                    }
                    
                    // Start Loading Animation
                    const badges = [quotaDaysLeft, quotaDaily, quotaMonthly].filter(Boolean);
                    badges.forEach(el => {
                        el.dataset.loading = 'true';
                        el.textContent = '.';
                    });
                    
                    if (mjLoadingInterval) clearInterval(mjLoadingInterval);
                    let dotCount = 1;
                    mjLoadingInterval = setInterval(() => {
                        dotCount = (dotCount % 3) + 1;
                        badges.forEach(el => { el.textContent = '.'.repeat(dotCount); });
                    }, 300);
                    
                    try {
                        const res = await fetch('api.php?action=get_mailjet_quota');
                        const data = await res.json();
                        
                        clearInterval(mjLoadingInterval);
                        badges.forEach(el => { delete el.dataset.loading; });
                        
                        if (data.success) {
                            updateDaysLeft(); // recalculate D-day without loading flag
                            applyColorToBadge(quotaDaily, data.today_used, data.today_limit);
                            applyColorToBadge(quotaMonthly, data.month_used, data.month_limit);
                            
                            localStorage.setItem('mj-quota-data', JSON.stringify({
                                today_used: data.today_used,
                                today_limit: data.today_limit,
                                month_used: data.month_used,
                                month_limit: data.month_limit
                            }));
                            localStorage.setItem('mj-quota-date', todayStr);
                        } else {
                            if (quotaDaily) quotaDaily.textContent = '실패';
                            if (quotaMonthly) quotaMonthly.textContent = '실패';
                        }
                    } catch (err) {
                        clearInterval(mjLoadingInterval);
                        badges.forEach(el => { delete el.dataset.loading; });
                        if (quotaDaily) quotaDaily.textContent = '오류';
                        if (quotaMonthly) quotaMonthly.textContent = '오류';
                    }
                }
                
                if (state.user && state.user.role === 'admin') {
                    if (quotaContainer) quotaContainer.style.display = 'flex';
                    loadQuota(false);
                } else {
                    if (quotaContainer) quotaContainer.style.display = 'none';
                }
                
                if (quotaContainer && !quotaContainer.dataset.bound) {
                    quotaContainer.dataset.bound = 'true';
                    quotaContainer.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (quotaDaily && quotaDaily.dataset.loading) return; // Prevent double click
                        loadQuota(true);
                    });
                }
                settingsModal.classList.remove('hidden');
            }
        });
    }

    if (btnCloseSettings && settingsModal) {
        btnCloseSettings.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }



    // Settings Form Submit Action
    if (formSettings) {
        formSettings.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('set-name').value.trim();
            const password = document.getElementById('set-password').value;
            const previewImg = document.getElementById('set-profile-preview');
            const profile_pic = previewImg && !previewImg.classList.contains('hidden') ? previewImg.src : '';
            
            showToast('설정을 저장하는 중...');
            const res = await apiRequest('update_profile', 'POST', { name, password, profile_pic });
            showToast(res.message);
            if (res.success) {
                state.user.name = name;
                state.user.profile_pic = profile_pic;
                profileName.textContent = name;
                
                // Update avatar in sidebar
                const avatarEl = document.querySelector('.user-profile .avatar');
                if (avatarEl) {
                    if (profile_pic) {
                        avatarEl.innerHTML = `<img src="${profile_pic}" alt="Avatar" class="avatar-img" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                    } else {
                        avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
                    }
                }
                
                settingsModal.classList.add('hidden');
            }
        });
    }

    // Theme Selection buttons inside settings modal
    if (settingsModal) {
        settingsModal.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedTheme = btn.dataset.theme;
                applyTheme(selectedTheme);
                localStorage.setItem('mail-theme', selectedTheme);
                apiRequest('update_theme', 'POST', { theme: selectedTheme });
                
                // Update active states
                settingsModal.querySelectorAll('.theme-btn').forEach(b => {
                    if (b.dataset.theme === selectedTheme) {
                        b.classList.add('active');
                    } else {
                        b.classList.remove('active');
                    }
                });
            });
        });
    }

    function applyTheme(themeName) {
        // Clear all theme- classes from body
        document.body.className = document.body.className.replace(/\btheme-\S+/g, '');
        // Add new theme class
        document.body.classList.add(`theme-${themeName}`);
        
        // Also sync state inside popovers/modal settings if matching
        if (settingsModal) {
            settingsModal.querySelectorAll('.theme-btn').forEach(btn => {
                if (btn.dataset.theme === themeName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    // Folder Navigation
    navItems.forEach(item => {
        if (item.id === 'btn-toggle-tags') return;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Reset reader
            readerEmpty.classList.remove('hidden');
            readerContent.classList.add('hidden');
            state.selectedEmailId = null;

            setCookie('currentFolder', item.dataset.folder);
            loadEmails(item.dataset.folder);
        });
    });

    // --------------------------------------------------
    // TEXT UTILS
    // --------------------------------------------------
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const str = String(text);
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
    }

    function formatDate(timestamp) {
        const d = new Date(timestamp * 1000);
        const now = new Date();
        
        const pad = n => n.toString().padStart(2, '0');
        
        // If today, show time
        if (d.toDateString() === now.toDateString()) {
            return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        
        // Otherwise, show MM-DD
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
 
    function getEmailAccountColor(email) {
        if (email.account_color) {
            return email.account_color;
        }
        if (email.account_id && state.externalMails) {
            const acc = state.externalMails.find(a => a.id == email.account_id);
            if (acc) return acc.color;
        }
        if (state.externalMails) {
            const ontoAcc = state.externalMails.find(a => a.service_type === 'onto');
            if (ontoAcc) return ontoAcc.color;
        }
        return '#3b82f6';
    }

    // --------------------------------------------------
    // RESIZER LOGIC
    // --------------------------------------------------
    const sidebar = document.getElementById('sidebar');
    const mailListPane = document.getElementById('mail-list-pane');
    const resizerSidebar = document.getElementById('resizer-sidebar');
    const resizerList = document.getElementById('resizer-list');
    
    let sidebarWidth = 240;
    let listHeight = 290;
    let sidebarCollapsed = false;

    // Track taps for double click/tap detection
    let lastSidebarTapTime = 0;
    let lastSidebarTapX = 0;
    let lastSidebarTapY = 0;

    // Resizing Sidebar
    resizerSidebar.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        const now = Date.now();
        const dist = Math.hypot(e.clientX - lastSidebarTapX, e.clientY - lastSidebarTapY);
        
        if (now - lastSidebarTapTime < 300 && dist < 20) {
            sidebarCollapsed = false;
            sidebar.classList.remove('collapsed');
            
            const activeAccs = (state.externalMails || []).filter(a => a.is_active === 1);
            sidebarWidth = activeAccs.length >= 2 ? 270 : 240;
            
            sidebar.style.width = `${sidebarWidth}px`;
            
            const tagsPopover = document.getElementById('tags-popover');
            if (tagsPopover) tagsPopover.classList.add('hidden');
            
            setCookie('sidebarWidth', sidebarWidth);
            setCookie('sidebarCollapsed', sidebarCollapsed);
            
            lastSidebarTapTime = 0;
            if (e.cancelable) e.preventDefault();
            return;
        }
        
        lastSidebarTapTime = now;
        lastSidebarTapX = e.clientX;
        lastSidebarTapY = e.clientY;

        if (e.cancelable) e.preventDefault();
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('resizing');
        resizerSidebar.classList.add('dragging');
        sidebar.classList.add('resizing');
        
        let ticking = false;
        let lastClientX = 0;
        
        function onPointerMove(event) {
            lastClientX = event.clientX;
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    let width = lastClientX;
                    if (width < 130) {
                        sidebarCollapsed = true;
                        sidebar.classList.add('collapsed');
                        sidebar.style.width = '92px';
                        const tagsPopover = document.getElementById('tags-popover');
                        if (tagsPopover) tagsPopover.classList.add('hidden');
                    } else {
                        sidebarCollapsed = false;
                        sidebar.classList.remove('collapsed');
                        if (width > 500) width = 500;
                        sidebarWidth = width;
                        sidebar.style.width = `${width}px`;
                        const tagsPopover = document.getElementById('tags-popover');
                        if (tagsPopover) tagsPopover.classList.add('hidden');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }
        
        function onPointerUp() {
            document.body.style.cursor = '';
            document.body.classList.remove('resizing');
            resizerSidebar.classList.remove('dragging');
            sidebar.classList.remove('resizing');
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            setCookie('sidebarWidth', sidebarWidth);
            setCookie('sidebarCollapsed', sidebarCollapsed);
        }
        
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
    });

    let lastListTapTime = 0;
    let lastListTapX = 0;
    let lastListTapY = 0;

    // Resizing Mail List (Vertical Row Resize)
    resizerList.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        
        const now = Date.now();
        const dist = Math.hypot(e.clientX - lastListTapX, e.clientY - lastListTapY);
        
        if (now - lastListTapTime < 300 && dist < 20) {
            const trs = mailListPane.querySelectorAll('.mail-list-table tbody tr.mail-item');
            
            const headerHeight = 71; // .pane-header (70px height + 1px border)
            const theadHeight = 39;  // table thead
            const minHeaderOnlyHeight = headerHeight + theadHeight; // Title headers height (110px)
            
            let targetHeight = 320;
            if (trs.length > 0) {
                const count = Math.min(trs.length, 5);
                const itemsHeight = count * 35;
                targetHeight = minHeaderOnlyHeight + itemsHeight + 8;
            } else {
                targetHeight = minHeaderOnlyHeight + 4;
            }
            
            if (targetHeight < minHeaderOnlyHeight) targetHeight = minHeaderOnlyHeight;
            
            listHeight = targetHeight;
            mailListPane.style.height = `${targetHeight}px`;
            setCookie('listHeight', listHeight);
            
            lastListTapTime = 0;
            if (e.cancelable) e.preventDefault();
            return;
        }
        
        lastListTapTime = now;
        lastListTapX = e.clientX;
        lastListTapY = e.clientY;

        if (e.cancelable) e.preventDefault();
        document.body.style.cursor = 'row-resize';
        document.body.classList.add('resizing');
        document.getElementById('app').classList.add('resizing');
        resizerList.classList.add('dragging');
        mailListPane.classList.add('resizing');
        
        const mainContent = document.getElementById('main-content');
        const mainContentRect = mainContent.getBoundingClientRect();
        
        let ticking = false;
        let lastClientY = 0;
        
        function onPointerMove(event) {
            lastClientY = event.clientY;
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    let height = lastClientY - mainContentRect.top;
                    const minHeight = 70; // keeps header visible
                    const maxHeight = mainContentRect.height - 100; // leaves room for reader
                    
                    if (height < minHeight) height = minHeight;
                    if (height > maxHeight) height = maxHeight;
                    
                    listHeight = height;
                    mailListPane.style.height = `${height}px`;
                    ticking = false;
                });
                ticking = true;
            }
        }
        
        function onPointerUp() {
            document.body.style.cursor = '';
            document.body.classList.remove('resizing');
            document.getElementById('app').classList.remove('resizing');
            resizerList.classList.remove('dragging');
            mailListPane.classList.remove('resizing');
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            setCookie('listHeight', listHeight);
        }
        
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
    });

    // --------------------------------------------------
    // ADMIN USER CREATION POPUP MODAL
    // --------------------------------------------------
    const adminCreateUserModal = document.getElementById('admin-create-user-modal');
    const btnOpenAdminCreate = document.getElementById('btn-open-admin-create');
    const btnCloseAdminCreate = document.getElementById('btn-close-admin-create');
    const formAdminCreateUser = document.getElementById('form-admin-create-user');
    const admGroupOptions = document.getElementById('adm-group-options');
    const btnAdmGroupTrigger = document.getElementById('btn-adm-group-trigger');

    if (btnAdmGroupTrigger && admGroupOptions) {
        btnAdmGroupTrigger.onclick = (e) => {
            e.stopPropagation();
            // Close other open ones first
            document.querySelectorAll('.multi-group-options').forEach(opt => {
                if (opt !== admGroupOptions) opt.classList.add('hidden');
            });
            admGroupOptions.classList.toggle('hidden');
            if (!admGroupOptions.classList.contains('hidden')) {
                const rect = btnAdmGroupTrigger.getBoundingClientRect();
                admGroupOptions.style.position = 'fixed';
                admGroupOptions.style.left = `${rect.left}px`;
                admGroupOptions.style.top = `${rect.bottom + 4}px`;
                admGroupOptions.style.width = 'auto';
                admGroupOptions.style.minWidth = `${rect.width}px`;
                admGroupOptions.style.maxWidth = '300px';
                admGroupOptions.style.zIndex = '9999';

                // Right side overflow check
                setTimeout(() => {
                    const oRect = admGroupOptions.getBoundingClientRect();
                    if (oRect.right > window.innerWidth - 20) {
                        admGroupOptions.style.left = 'auto';
                        admGroupOptions.style.right = `${window.innerWidth - rect.right}px`;
                    }
                }, 0);
            }
        };
    }

    function updateAdmGroupTriggerLabel() {
        if (!admGroupOptions || !btnAdmGroupTrigger) return;
        const chks = admGroupOptions.querySelectorAll('input[type="checkbox"]:checked');
        const span = btnAdmGroupTrigger.querySelector('span');
        if (chks.length === 0) {
            span.textContent = '그룹을 선택하세요';
        } else if (chks.length === 1) {
            span.textContent = chks[0].closest('label').querySelector('span').textContent;
        } else {
            span.textContent = `선택된 그룹: ${chks.length}개`;
        }
    }

    btnOpenAdminCreate.addEventListener('click', async () => {
        if (admGroupOptions) {
            admGroupOptions.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 13px;">로딩 중...</div>';
            const groupsRes = await apiRequest('admin_list_groups');
            if (groupsRes.success) {
                admGroupOptions.innerHTML = '';
                const groups = groupsRes.groups || [];
                groups.forEach(g => {
                    const label = document.createElement('label');
                    label.className = 'multi-group-option-label';

                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.value = g.name;
                    if (g.name === '기본') chk.checked = true;

                    chk.addEventListener('change', updateAdmGroupTriggerLabel);

                    const span = document.createElement('span');
                    span.textContent = g.name;

                    label.appendChild(chk);
                    label.appendChild(span);
                    admGroupOptions.appendChild(label);
                });
                updateAdmGroupTriggerLabel();
            } else {
                admGroupOptions.innerHTML = `
                    <label class="multi-group-option-label">
                        <input type="checkbox" value="기본" checked>
                        <span>기본</span>
                    </label>
                `;
                updateAdmGroupTriggerLabel();
            }
        }
        adminCreateUserModal.classList.remove('hidden');
    });

    if (btnCloseAdminCreate) btnCloseAdminCreate.addEventListener('click', () => {
        adminCreateUserModal.classList.add('hidden');
    });

    formAdminCreateUser.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = formAdminCreateUser.username.value;
        const name = formAdminCreateUser.name.value;
        const password = formAdminCreateUser.password.value;

        const checkedGroupNodes = admGroupOptions ? admGroupOptions.querySelectorAll('input[type="checkbox"]:checked') : [];
        const checkedGroups = Array.from(checkedGroupNodes).map(chk => chk.value);
        if (checkedGroups.length === 0) {
            showToast('그룹을 최소 1개 이상 지정해주세요.');
            return;
        }
        const group_name = checkedGroups.join(', ');
        
        showToast('신규 회원을 등록 중입니다...');
        const res = await apiRequest('admin_create_user', 'POST', { username, name, password, group_name });
        showToast(res.message);
        
        if (res.success) {
            formAdminCreateUser.reset();
            adminCreateUserModal.classList.add('hidden');
            loadAdminUsers(true);
        }
    });

    // --------------------------------------------------
    // GROUPS MANAGEMENT MODAL
    // --------------------------------------------------
    const groupsModal = document.getElementById('groups-modal');
    const btnOpenGroups = document.getElementById('btn-open-groups');
    const btnCloseGroupsModal = document.getElementById('btn-close-groups-modal');
    const formCreateGroup = document.getElementById('form-create-group');
    const newGroupNameInput = document.getElementById('new-group-name');
    const groupsModalList = document.getElementById('groups-modal-list');

    if (btnOpenGroups && groupsModal) {
        btnOpenGroups.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            groupsModal.classList.remove('hidden');
            loadGroupsModalList();
        });
    }

    if (btnCloseGroupsModal && groupsModal) {
        btnCloseGroupsModal.addEventListener('click', () => {
            groupsModal.classList.add('hidden');
        });
    }

    // Rename Logic
    const groupRenameModal = document.getElementById('group-rename-modal');
    const formRenameGroup = document.getElementById('form-rename-group');
    const renameOldNameInput = document.getElementById('rename-group-old-name');
    const renameNewNameInput = document.getElementById('rename-group-new-name');

    if (formRenameGroup) {
        formRenameGroup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldName = renameOldNameInput.value;
            const newName = renameNewNameInput.value.trim();
            if (!newName || newName === oldName) {
                groupRenameModal.classList.add('hidden');
                return;
            }
            const r = await apiRequest('admin_rename_group', 'POST', { old_name: oldName, new_name: newName });
            showToast(r.message);
            if (r.success) {
                groupRenameModal.classList.add('hidden');
                loadGroupsModalList(true);
                loadAdminUsers(true);
            }
        });
    }

    async function loadGroupsModalList(refreshOnly = false) {
        if (!groupsModalList) return;
        if (!refreshOnly) {
            groupsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
        }

        const res = await apiRequest('admin_list_groups');
        if (res.success) {
            const groups = res.groups || [];
            groupsModalList.innerHTML = '';

            groups.forEach(group => {
                const tr = document.createElement('tr');
                tr.dataset.name = group.name;

                const isDefaultGroup = group.name === '기본';
                const isAdminGroup = group.name === '관리자';
                const isProtectedGroup = isAdminGroup; // Only Admin is fully protected
                const isSystemGroup = isDefaultGroup || isAdminGroup;
                
                if (!isSystemGroup) {
                    tr.draggable = true;
                    tr.className = 'group-drag-item';
                } else {
                    tr.className = 'group-static-item';
                }

                const groupColor = group.color || '#3b82f6';

                const isLocked = group.status === 'locked';
                const lockToggleBtn = isLocked 
                    ? `<button class="btn-group-unlock btn-admin-action approve" data-group="${escapeHtml(group.name)}"><i class="fa-solid fa-lock-open"></i> 해제</button>`
                    : `<button class="btn-group-lock btn-admin-action lock" data-group="${escapeHtml(group.name)}"><i class="fa-solid fa-lock"></i> 잠금</button>`;

                const actionsHtml = !isAdminGroup ? `
                    ${lockToggleBtn}
                    ${!isDefaultGroup && !isAdminGroup ? `<button class="btn-group-delete btn-danger-action btn-admin-action delete" data-group="${escapeHtml(group.name)}"><i class="fa-solid fa-trash-can"></i> 삭제</button>` : ''}
                ` : '<span style="color: var(--text-muted); font-size: 11px;">보호된 그룹</span>';

                tr.innerHTML = `
                    <td class="col-group-name">
                        <div class="group-name-content">
                            ${!isSystemGroup ? `<i class="fa-solid fa-grip-vertical drag-handle" style="margin-right: 8px; color: var(--text-muted); cursor: grab; font-size: 14px;"></i>` : `<i class="fa-solid fa-lock" style="margin-right: 8px; color: var(--text-muted); opacity: 0.5; font-size: 12px; width: 14px; text-align: center;" title="이동 불가"></i>`}
                            <i class="fa-solid fa-users group-icon-clickable" style="color: ${groupColor}; margin-right: 8px; cursor: pointer; font-size: 16px;" data-name="${escapeHtml(group.name)}"></i> 
                            <span class="group-name-text">${escapeHtml(group.name)}</span>
                            ${!isAdminGroup ? `<button class="btn-group-rename" data-name="${escapeHtml(group.name)}">변경</button>` : ''}
                        </div>
                    </td>
                    <td class="admin-actions-cell" style="justify-content: flex-start;">
                        ${actionsHtml}
                    </td>
                `;

                // Drag and Drop Event Listeners (Only for non-system groups)
                if (!isSystemGroup) {
                    tr.addEventListener('dragstart', (e) => {
                        tr.classList.add('dragging');
                        e.dataTransfer.setData('text/plain', group.name);
                        e.dataTransfer.effectAllowed = 'move';
                    });

                    tr.addEventListener('dragend', () => {
                        tr.classList.remove('dragging');
                        // Save new order
                        saveGroupOrder();
                    });

                    tr.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const draggingItem = groupsModalList.querySelector('.dragging');
                        if (draggingItem && draggingItem !== tr) {
                            const bounding = tr.getBoundingClientRect();
                            const offset = e.clientY - bounding.top;
                            if (offset > bounding.height / 2) {
                                tr.after(draggingItem);
                            } else {
                                tr.before(draggingItem);
                            }
                        }
                    });
                }

                // Rename Logic
                const renameBtn = tr.querySelector('.btn-group-rename');
                if (renameBtn) {
                    renameBtn.addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        renameOldNameInput.value = group.name;
                        renameNewNameInput.value = group.name;
                        groupRenameModal.classList.remove('hidden');
                        setTimeout(() => renameNewNameInput.focus(), 100);
                    });
                }

                // Color Picker Logic for Group
                tr.querySelector('.group-icon-clickable').addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    const gName = evt.currentTarget.dataset.name;
                    const rect = evt.currentTarget.getBoundingClientRect();

                    const tagColorPopover = document.getElementById('tag-color-popover');
                    tagColorPopover.classList.remove('hidden');
                    tagColorPopover.style.top = `${rect.bottom + 5}px`;
                    tagColorPopover.style.left = `${rect.left}px`;

                    renderGroupColorPicker(gName);
                });

                const btnLock = tr.querySelector('.btn-group-lock');
                if (btnLock) {
                    btnLock.addEventListener('click', async (evt) => {
                        const gName = evt.currentTarget.dataset.group;
                        if (!await customConfirm(`'${gName}' 그룹의 모든 회원을 일괄 잠금 처리하시겠습니까?`)) return;
                        showToast('그룹 일괄 잠금 중...');
                        const r = await apiRequest('admin_lock_group', 'POST', { name: gName });
                        showToast(r.message);
                        if (r.success) loadAdminUsers(true);
                    });
                }

                const btnUnlock = tr.querySelector('.btn-group-unlock');
                if (btnUnlock) {
                    btnUnlock.addEventListener('click', async (evt) => {
                        const gName = evt.currentTarget.dataset.group;
                        if (!await customConfirm(`'${gName}' 그룹의 모든 회원의 잠금을 일괄 해제하시겠습니까?`)) return;
                        showToast('그룹 일괄 잠금 해제 중...');
                        const r = await apiRequest('admin_unlock_group', 'POST', { name: gName });
                        showToast(r.message);
                        if (r.success) loadAdminUsers(true);
                    });
                }

                const delBtn = tr.querySelector('.btn-group-delete');
                if (delBtn) {
                    delBtn.addEventListener('click', async (evt) => {
                        const gName = evt.currentTarget.dataset.group;
                        if (!await customConfirm(`'${gName}' 그룹을 삭제하시겠습니까?\n소속 회원들의 그룹 정보는 '기본'으로 변경됩니다.`, 'fa-solid fa-triangle-exclamation')) return;

                        showToast('그룹 삭제 중...');
                        const r = await apiRequest('admin_delete_group', 'POST', { name: gName });
                        showToast(r.message);
                        if (r.success) {
                            loadGroupsModalList(true);
                            loadAdminUsers(true);
                        }
                    });
                }

                groupsModalList.appendChild(tr);
            });
        } else {
            showToast(res.message);
        }
    }

    async function saveGroupOrder() {
        const order = [];
        groupsModalList.querySelectorAll('.group-drag-item').forEach(tr => {
            order.push(tr.dataset.name);
        });
        const res = await apiRequest('admin_update_group_order', 'POST', { order: JSON.stringify(order) });
        if (!res.success) showToast(res.message);
    }

    function renderGroupColorPicker(groupName) {
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6',
            '#6366f1', '#8b5cf6', '#ffffff', '#71717a', '#000000'
        ];

        const tagColorGrid = document.getElementById('tag-color-grid');
        const tagColorPopover = document.getElementById('tag-color-popover');

        tagColorGrid.innerHTML = '';
        colors.forEach(color => {
            const item = document.createElement('div');
            item.className = 'tag-color-item';
            item.style.backgroundColor = color;
            item.addEventListener('click', async () => {
                const res = await apiRequest('admin_set_group_color', 'POST', { name: groupName, color: color });
                if (res.success) {
                    loadGroupsModalList(true);
                    tagColorPopover.classList.add('hidden');
                }
            });
            tagColorGrid.appendChild(item);
        });
    }

    if (formCreateGroup) {
        formCreateGroup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const gName = newGroupNameInput.value.trim();
            if (!gName) return;

            if (!/^[a-zA-Z0-9_\-가-힣\s]+$/u.test(gName)) {
                showToast('그룹 이름은 영문, 숫자, 한글, 밑줄(_), 하이픈(-)만 가능합니다.');
                return;
            }

            showToast('그룹 생성 중...');
            const res = await apiRequest('admin_create_group', 'POST', { name: gName });
            showToast(res.message);
            if (res.success) {
                newGroupNameInput.value = '';
                loadGroupsModalList(true);
                // Also refresh main admin user list to update group filter
                loadAdminUsers(true);
            }
        });
    }

    // --------------------------------------------------
    // LOCKED USER INTERACTION MODAL
    // --------------------------------------------------
    const lockedModal = document.getElementById('locked-modal');
    const btnCloseLocked = document.getElementById('btn-close-locked');
    const btnRequestUnlock = document.getElementById('btn-request-unlock');
    
    function openLockedModal(username) {
        if (!lockedModal) return;
        lockedModal.classList.remove('hidden');
        
        btnRequestUnlock.onclick = async () => {
            showToast('잠금 해제 요청 중...');
            const r = await apiRequest('request_unlock', 'POST', { username });
            showToast(r.message);
            if (r.success) {
                lockedModal.classList.add('hidden');
            }
        };
    }
    
    if (btnCloseLocked && lockedModal) {
        btnCloseLocked.addEventListener('click', () => {
            lockedModal.classList.add('hidden');
        });
    }

    // --------------------------------------------------
    // CONTEXT MENU LOGIC
    // --------------------------------------------------
    const ctxMenu = document.getElementById('mail-context-menu');
    let targetEmailId = null;

    function getTargetEmails() {
        const chks = document.querySelectorAll('.mail-item-chk:checked');
        const selected = [];
        
        if (chks.length > 0) {
            Array.from(chks).forEach(chk => {
                selected.push({
                    id: chk.dataset.id,
                    from: chk.dataset.from,
                    folder: chk.dataset.folder
                });
            });
        }
        
        // Ensure right-clicked target is also included
        if (targetEmailId) {
            const targetBase = getBaseId(targetEmailId);
            const isIncluded = selected.some(s => getBaseId(s.id) === targetBase);
            if (!isIncluded) {
                const targetEmail = state.emails.find(e => getBaseId(e.id) === targetBase);
                if (targetEmail) {
                    selected.push({
                        id: targetEmailId,
                        from: targetEmail.from,
                        folder: targetEmail.folder || state.currentFolder
                    });
                } else {
                    selected.push({
                        id: targetEmailId,
                        from: '',
                        folder: state.currentFolder
                    });
                }
            }
        }
        
        return selected;
    }

    async function showMailContextMenu(e, emailId) {
        targetEmailId = emailId;

        const moveList = document.getElementById('ctx-move-list');
        if (moveList) {
            moveList.innerHTML = '<div style="padding: 6px 12px; color: var(--text-muted); font-size: 11px;">로딩 중...</div>';
            
            const resTags = await apiRequest('list_tags');
            if (resTags.success) {
                // Determine account info for labels
                const targetBase = getBaseId(emailId);
                const emailInState = state.emails.find(mail => getBaseId(mail.id) === targetBase);
                const emailAcc = emailInState ? (state.externalMails || []).find(a => a.id == emailInState.account_id || (a.service_type === 'onto' && !emailInState.account_id)) : null;
                const activeAccs = (state.externalMails || []).filter(a => a.is_active === 1);
                
                let accountLabel = '';
                if (emailAcc) {
                    if (emailAcc.service_type === 'onto') {
                        accountLabel = 'OnTo';
                    } else {
                        const serviceType = emailAcc.service_type;
                        accountLabel = serviceType === 'naver' ? 'Naver' : 
                                       serviceType === 'gmail' ? 'Gmail' : 
                                       serviceType === 'daum' ? 'Daum' : 
                                       serviceType === 'kakao' ? 'Kakao' : 
                                       (emailAcc.email ? emailAcc.email.split('@')[0] : serviceType);
                    }
                }

                const dests = ['INBOX', 'Sent', 'Drafts', 'Spam', ...(resTags.tags || [])];
                moveList.innerHTML = '';
                let destCount = 0;
                
                dests.forEach(dest => {
                    let destName = typeof dest === 'string' ? dest : dest.name;
                    if (destName === state.currentFolder) return;
                    
                    const div = document.createElement('div');
                    div.className = 'context-submenu-item';
                    
                    let displayLabel = getFolderDisplayName(destName);
                    if (activeAccs.length > 1 && accountLabel) {
                        displayLabel = `${displayLabel} (${accountLabel})`;
                    }
                    div.textContent = displayLabel;
                    
                    div.addEventListener('click', async (evt) => {
                        evt.stopPropagation();
                        ctxMenu.classList.add('hidden');
                        
                        const targets = getTargetEmails();
                        showToast(`${targets.length}개의 메일을 이동 중입니다...`);
                        
                        let successCount = 0;
                        for (const t of targets) {
                            const rMove = await apiRequest('move_email', 'POST', {
                                id: t.id,
                                folder: t.folder,
                                dest_folder: destName
                            });
                            if (rMove.success) successCount++;
                        }
                        
                        showToast(`${successCount}개의 메일이 이동되었습니다.`);
                        loadEmails(state.currentFolder);
                        readerEmpty.classList.remove('hidden');
                        readerContent.classList.add('hidden');
                        state.selectedEmailId = null;
                    });
                    
                    moveList.appendChild(div);
                    destCount++;
                });
                
                if (destCount === 0) {
                    moveList.innerHTML = '<div style="padding: 6px 12px; color: var(--text-muted); font-size: 11px;">이동 가능한 폴더 없음</div>';
                }
            }
        }

        ctxMenu.style.left = `${e.clientX}px`;
        ctxMenu.style.top = `${e.clientY}px`;
        ctxMenu.classList.remove('hidden');
        
        const rect = ctxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            ctxMenu.style.left = `${e.clientX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            ctxMenu.style.top = `${e.clientY - rect.height}px`;
        }
    }

    document.addEventListener('click', () => {
        if (ctxMenu) ctxMenu.classList.add('hidden');
    });

    document.getElementById('ctx-reply')?.addEventListener('click', () => {
        const targets = getTargetEmails();
        const emails = targets.map(t => {
            const match = t.from.match(/<([^>]+)>/);
            return match ? match[1] : t.from;
        });
        const uniqueEmails = [...new Set(emails)].join(', ');
        
        if (targets.length === 1) {
            const email = state.emails.find(e => e.id === targets[0].id);
            if (email) {
                openCompose(uniqueEmails, `Re: ${email.subject}`, `\n\n--- Original Message ---\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\n\n`);
            } else {
                openCompose(uniqueEmails, 'Re: ', '');
            }
        } else {
            openCompose(uniqueEmails, 'Re: [Multiple Emails]', `\n\n--- Replying to ${targets.length} emails ---`);
        }
    });

    document.getElementById('ctx-delete')?.addEventListener('click', async () => {
        const targets = getTargetEmails();
        if (targets.length === 0) return;

        const needsConfirm = state.currentFolder === 'Trash' || state.currentFolder.endsWith('_Trash');
        if (needsConfirm) {
            let msg = `${targets.length}개의 메일을 영구 삭제하시겠습니까?\n삭제된 이후에는 복구할 수 없습니다.`;
            if (!await customConfirm(msg, 'fa-solid fa-triangle-exclamation')) return;
        }

        showToast('메일을 삭제 중입니다...');
        let successCount = 0;
        for (const t of targets) {
            const res = await apiRequest('delete_email', 'POST', { folder: t.folder, id: t.id });
            if (res.success) successCount++;
        }

        if (needsConfirm) {
            showToast(`${successCount}개의 메일이 영구 삭제되었습니다.`);
        } else {
            showToast(`${successCount}개의 메일이 휴지통으로 이동하였습니다.`);
        }
        loadEmails(state.currentFolder);
        readerEmpty.classList.remove('hidden');
        readerContent.classList.add('hidden');
        state.selectedEmailId = null;
    });

    // --------------------------------------------------
    // TABLE COLUMN RESIZING LOGIC
    // --------------------------------------------------
    function makeTableColumnsResizable(table) {
        const headers = table.querySelectorAll('thead th');
        
        // 1. Ensure all columns have an initial explicit pixel width (except filler)
        headers.forEach(th => {
            if (th.classList.contains('col-filler')) return;
            if (!th.style.width) {
                th.style.width = th.offsetWidth + 'px';
            }
        });
        
        // 2. Dynamically update table min-width based on sum of explicit columns
        const updateTableMinWidth = () => {
            let total = 0;
            headers.forEach(h => {
                if (!h.classList.contains('col-filler')) {
                    total += parseFloat(h.style.width) || h.offsetWidth;
                }
            });
            // Give 20px padding for safety, let it naturally fill 100% otherwise
            table.style.minWidth = `max(100%, ${total + 20}px)`;
            table.style.width = '100%';
        };
        updateTableMinWidth();

        headers.forEach((th) => {
            const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
            if (!colClass || colClass === 'col-chk' || colClass === 'col-starred-filter' || colClass === 'col-flag' || colClass === 'col-filler') {
                return;
            }

            const colName = colClass.replace('col-', '');
            
            if (!th.querySelector('.col-resizer')) {
                const resizer = document.createElement('div');
                resizer.className = 'col-resizer';
                th.appendChild(resizer);

                resizer.addEventListener('pointerdown', (e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    
                    const now = Date.now();
                    const lastTapTime = resizer.lastTapTime || 0;
                    const lastTapX = resizer.lastTapX || 0;
                    const lastTapY = resizer.lastTapY || 0;
                    const dist = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);
                    
                    if (now - lastTapTime < 300 && dist < 20) {
                        // Browser-native auto-fit calculation with transition handling
                        const oldTableLayout = table.style.tableLayout;
                        const oldTableWidth = table.style.width;
                        const oldThWidth = th.style.width;

                        // Disable transitions temporarily during measurement using the existing resizing class
                        table.classList.add('resizing');

                        table.style.tableLayout = 'auto';
                        table.style.width = 'auto';
                        th.style.width = 'auto';

                        // Force browser reflow to get the natural un-truncated content width
                        let autoWidth = th.offsetWidth;

                        // Restore table styles
                        table.style.tableLayout = oldTableLayout || 'fixed';
                        table.style.width = oldTableWidth || '100%';
                        th.style.width = oldThWidth;

                        // Force layout sync to apply the restored width before re-enabling transitions
                        table.offsetHeight;

                        // Re-enable transitions
                        table.classList.remove('resizing');

                        // Add a small safety padding (4px) to prevent rounding-related truncation
                        autoWidth = Math.ceil(autoWidth) + 4;

                        if (autoWidth < 60) autoWidth = 60;
                        if (autoWidth > 800) autoWidth = 800; // Limit maximum

                        // Apply the new width, which will trigger the CSS transition
                        th.style.width = autoWidth + 'px';
                        updateTableMinWidth();

                        setCookie('colWidth_' + colName, autoWidth);
                        
                        resizer.lastTapTime = 0;
                        if (e.cancelable) e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    
                    resizer.lastTapTime = now;
                    resizer.lastTapX = e.clientX;
                    resizer.lastTapY = e.clientY;

                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    
                    const startX = e.clientX;
                    const startWidth = parseFloat(th.style.width) || th.offsetWidth;
                    
                    document.body.style.cursor = 'col-resize';
                    resizer.classList.add('dragging');
                    table.classList.add('resizing');
                    
                    function onPointerMove(event) {
                        const delta = event.clientX - startX;
                        const width = startWidth + delta;
                        const minWidth = 60; 
                        if (width >= minWidth) {
                            th.style.width = width + 'px';
                            updateTableMinWidth();
                        }
                    }
                    
                    function onPointerUp() {
                        document.body.style.cursor = '';
                        resizer.classList.remove('dragging');
                        table.classList.remove('resizing');
                        document.removeEventListener('pointermove', onPointerMove);
                        document.removeEventListener('pointerup', onPointerUp);
                        document.removeEventListener('pointercancel', onPointerUp);
                        
                        setCookie('colWidth_' + colName, parseFloat(th.style.width));
                    }
                    
                    document.addEventListener('pointermove', onPointerMove);
                    document.addEventListener('pointerup', onPointerUp);
                    document.addEventListener('pointercancel', onPointerUp);
                });
            }
        });
    }

    // --------------------------------------------------
    // ADDRESS BOOK SYSTEM (주소록 시스템)
    // --------------------------------------------------
    const addressBookModal = document.getElementById('addressbook-modal');
    const addressFormModal = document.getElementById('address-form-modal');
    const btnManageAddressbook = document.getElementById('btn-manage-addressbook');
    const btnAddAddress = document.getElementById('btn-add-address');
    const formAddress = document.getElementById('form-address');
    const addrSearchInput = document.getElementById('addr-search');
    const addressbookList = document.getElementById('addressbook-list');
    const addrTabBtns = document.querySelectorAll('.addr-tab-btn');
    
    const btnAddressbookPopup = document.getElementById('btn-addressbook-popup');
    const mailToInput = document.getElementById('mail-to-input');
    const mailCcInput = document.getElementById('mail-cc-input');
    const mailToContainer = document.getElementById('mail-to-container');
    const mailCcContainer = document.getElementById('mail-cc-container');
    const autocompleteList = document.getElementById('autocomplete-list');

    // Email Tagging Helper Functions
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function updatePlaceholder(container) {
        if (!container) return;
        const input = container.querySelector('input');
        if (!input) return;
        
        const hasTags = container.querySelectorAll('.email-tag').length > 0;
        if (hasTags) {
            if (!input.dataset.placeholder) {
                input.dataset.placeholder = input.placeholder;
            }
            input.placeholder = '';
        } else {
            if (input.dataset.placeholder) {
                input.placeholder = input.dataset.placeholder;
            }
        }
    }

    function addEmailTag(container, email) {
        email = email.trim();
        if (!email || !validateEmail(email)) return false;
        
        // Prevent duplicates
        const existingTags = Array.from(container.querySelectorAll('.email-tag')).map(t => t.dataset.email);
        if (existingTags.includes(email)) return true; // Already exists, considered "handled"

        const tag = document.createElement('div');
        tag.className = 'email-tag';
        tag.dataset.email = email;
        tag.innerHTML = `
            <span>${email}</span>
            <span class="tag-remove" title="삭제"><i class="fa-solid fa-xmark"></i></span>
        `;
        
        tag.querySelector('.tag-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            tag.remove();
            updatePlaceholder(container);
        });
        
        const input = container.querySelector('input');
        container.insertBefore(tag, input);
        updatePlaceholder(container);
        return true;
    }

    const btnManageAddrGroups = document.getElementById('btn-manage-addr-groups');
    const addressGroupsModal = document.getElementById('address-groups-modal');
    const formAddAddrGroup = document.getElementById('form-add-addr-group');
    const newAddrGroupName = document.getElementById('new-addr-group-name');
    const addrGroupsList = document.getElementById('addr-groups-list');

    // 주소록 모달 열기
    function openAddressBook(selectMode = false) {
        state.addressBookSelectMode = selectMode;
        
        const footer = document.getElementById('addressbook-footer');
        if (footer) {
            if (selectMode) {
                footer.classList.remove('hidden');
            } else {
                footer.classList.add('hidden');
            }
        }

        const filterDropdown = document.getElementById('addr-filter-group-dropdown');
        if (filterDropdown) {
            if (selectMode) {
                filterDropdown.style.display = 'block';
                filterDropdown.classList.remove('hidden');
            } else {
                filterDropdown.style.display = 'none';
                filterDropdown.classList.add('hidden');
            }
        }

        if (addressBookModal) {
            addressBookModal.classList.remove('hidden');
            // 검색 필드 초기화
            if (addrSearchInput) addrSearchInput.value = '';
            // 내 주소록 탭을 기본 활성화
            switchAddressBookTab('my');
        }
    }

    // 주소록 선택 완료 (확인) 버튼 바인딩
    const btnAddressbookConfirm = document.getElementById('btn-addressbook-confirm');
    if (btnAddressbookConfirm) {
        btnAddressbookConfirm.addEventListener('click', () => {
            const checked = Array.from(addressbookList ? addressbookList.querySelectorAll('.chk-addr-select:checked') : []).map(chk => chk.dataset.email);
            if (mailToInput && mailToContainer) {
                checked.forEach(email => addEmailTag(mailToContainer, email));
                mailToInput.focus();
            }
            if (addressBookModal) addressBookModal.classList.add('hidden');
        });
    }

    // 설정 페이지의 주소록 버튼 클릭 시
    if (btnManageAddressbook) {
        btnManageAddressbook.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddressBook(false);
        });
    }

    // 작성 페이지의 주소록 팝업 버튼 클릭 시
    if (btnAddressbookPopup) {
        btnAddressbookPopup.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddressBook(true);
        });
    }

    // 주소록 탭 전환 함수
    function switchAddressBookTab(tabName) {
        state.addressBookCurrentTab = tabName;
        addrTabBtns.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
                btn.style.borderBottom = '2px solid var(--color-primary)';
                btn.style.color = 'var(--text-primary)';
                btn.style.fontWeight = 'bold';
            } else {
                btn.classList.remove('active');
                btn.style.borderBottom = '2px solid transparent';
                btn.style.color = 'var(--text-secondary)';
                btn.style.fontWeight = 'normal';
            }
        });
        loadAddressBookData();
    }

    // 탭 버튼 클릭 이벤트 바인딩
    addrTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchAddressBookTab(btn.dataset.tab);
        });
    });

    // 주소록 데이터 API 로드 및 렌더링
    async function loadAddressBookData() {
        if (!addressbookList) return;
        addressbookList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
        
        try {
            // 그룹 정보 로드하여 색상 맵핑 캐싱
            const groupsRes = await apiRequest('list_address_groups');
            if (groupsRes.success) {
                state.addressGroups = groupsRes.address_groups || [];
                state.addressGroupColors = {};
                state.addressGroups.forEach(g => {
                    state.addressGroupColors[g.name] = g.color || '#3b82f6';
                });
                initAddressBookFilterGroups();
            }

            // 두 목록을 모두 미리 받아와서 검색 및 자동완성에 대비
            const myRes = await apiRequest('list_address_book');
            if (myRes.success) {
                state.addressBookListMy = myRes.address_book || [];
            }
            
            const recvRes = await apiRequest('list_received_senders');
            if (recvRes.success) {
                state.addressBookListReceived = recvRes.senders || [];
            }

            renderAddressBookList();
        } catch (err) {
            console.error('Error loading address book:', err);
            addressbookList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--color-danger);">데이터 로드 실패</td></tr>';
        }
    }

    // 목록 렌더링 (검색 필터링 포함)
    function renderAddressBookList() {
        if (!addressbookList) return;
        const search = (addrSearchInput ? addrSearchInput.value : '').toLowerCase().trim();
        const tab = state.addressBookCurrentTab;
        const dataList = (tab === 'my') ? state.addressBookListMy : state.addressBookListReceived;

        // 검색 필터링 & 그룹 필터링
        const filtered = dataList.filter(item => {
            const name = (item.name || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const matchesSearch = name.includes(search) || email.includes(search);

            let matchesGroup = true;
            if (state.addressBookSelectMode) {
                const itemGroups = (item.group_name || '미정').split(',').map(s => s.trim()).filter(Boolean);
                matchesGroup = itemGroups.some(g => state.addressBookFilterGroups.includes(g));
            }

            return matchesSearch && matchesGroup;
        });

        // thead 동적 설정
        const thead = document.getElementById('addressbook-thead');
        if (thead) {
            if (state.addressBookSelectMode) {
                thead.innerHTML = `
                    <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
                        <th style="padding: 8px; width: 30px; text-align: center;"><input type="checkbox" id="chk-addr-all-select"></th>
                        <th style="padding: 8px; width: 80px;">이름</th>
                        <th style="padding: 8px;">이메일</th>
                        <th style="padding: 8px; width: 55px;">그룹</th>
                    </tr>
                `;
                const chkAll = document.getElementById('chk-addr-all-select');
                if (chkAll) {
                    chkAll.addEventListener('change', () => {
                        const checkboxes = addressbookList.querySelectorAll('.chk-addr-select');
                        checkboxes.forEach(c => {
                            c.checked = chkAll.checked;
                            const row = c.closest('tr');
                            if (row) {
                                if (chkAll.checked) {
                                    row.style.background = 'var(--bg-active)';
                                } else {
                                    row.style.background = 'transparent';
                                }
                            }
                        });
                    });
                }
            } else {
                thead.innerHTML = `
                    <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
                        <th style="padding: 8px; width: 80px;">이름</th>
                        <th style="padding: 8px;">이메일</th>
                        <th style="padding: 8px; width: 55px;">그룹</th>
                        <th style="padding: 8px; width: 150px; text-align: right;"></th>
                    </tr>
                `;
            }
        }

        if (filtered.length === 0) {
            addressbookList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-secondary);">검색 결과가 없습니다.</td></tr>';
            return;
        }

        addressbookList.innerHTML = '';
        filtered.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            if (state.addressBookSelectMode) {
                tr.style.cursor = 'pointer';
            }
            
            // Checkbox (Only in selectMode)
            let chk = null;
            if (state.addressBookSelectMode) {
                const tdChk = document.createElement('td');
                tdChk.style.padding = '8px';
                tdChk.style.textAlign = 'center';
                
                chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'chk-addr-select';
                chk.dataset.email = item.email;
                
                // Pre-check if already in mailToInput
                const mailToVal = document.getElementById('mail-to')?.value || '';
                const existingEmails = mailToVal.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                if (existingEmails.includes(item.email.toLowerCase().trim())) {
                    chk.checked = true;
                    tr.style.background = 'var(--bg-active)';
                }

                tdChk.appendChild(chk);
                tr.appendChild(tdChk);

                // Row click toggles selection
                tr.addEventListener('click', (e) => {
                    if (e.target !== chk) {
                        chk.checked = !chk.checked;
                    }
                    if (chk.checked) {
                        tr.style.background = 'var(--bg-active)';
                    } else {
                        tr.style.background = 'transparent';
                    }
                    
                    const allSelect = document.getElementById('chk-addr-all-select');
                    if (allSelect) {
                        const total = addressbookList.querySelectorAll('.chk-addr-select').length;
                        const checkedCount = addressbookList.querySelectorAll('.chk-addr-select:checked').length;
                        allSelect.checked = total === checkedCount;
                        allSelect.indeterminate = checkedCount > 0 && checkedCount < total;
                    }
                });
            }

            // 이름
            const tdName = document.createElement('td');
            tdName.style.padding = '8px';
            tdName.innerText = item.name || '미정';
            tdName.style.whiteSpace = 'nowrap';
            tdName.style.overflow = 'hidden';
            tdName.style.textOverflow = 'ellipsis';
            tr.appendChild(tdName);

            // 이메일
            const tdEmail = document.createElement('td');
            tdEmail.style.padding = '8px';
            tdEmail.innerText = item.email;
            tdEmail.style.whiteSpace = 'nowrap';
            tdEmail.style.overflow = 'hidden';
            tdEmail.style.textOverflow = 'ellipsis';
            tr.appendChild(tdEmail);

            // 그룹
            const tdGroup = document.createElement('td');
            tdGroup.style.padding = '8px';
            
            const gNames = (item.group_name || '미정').split(',').map(s => s.trim()).filter(Boolean);
            tdGroup.innerHTML = '';
            gNames.forEach(name => {
                const color = state.addressGroupColors[name] || '#3b82f6';
                const badge = document.createElement('span');
                badge.style.display = 'inline-block';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '4px';
                badge.style.fontSize = '11px';
                badge.style.fontWeight = '500';
                badge.style.marginRight = '4px';
                badge.style.backgroundColor = color + '22'; // 13% opacity background
                badge.style.color = color;
                badge.style.border = `1px solid ${color}`;
                badge.style.maxWidth = '100%';
                badge.style.overflow = 'hidden';
                badge.style.textOverflow = 'ellipsis';
                badge.style.whiteSpace = 'nowrap';
                badge.style.boxSizing = 'border-box';
                badge.innerText = name;
                tdGroup.appendChild(badge);
            });
            tr.appendChild(tdGroup);

            // 관리/액션 (Only when selectMode is false)
            if (!state.addressBookSelectMode) {
                const tdAction = document.createElement('td');
                tdAction.style.padding = '8px';
                tdAction.style.textAlign = 'right';
                tdAction.style.display = 'flex';
                tdAction.style.justifyContent = 'flex-end';
                tdAction.style.gap = '6px';

                if (tab === 'my') {
                    // 내 주소록에서는 편집과 삭제 가능
                    const btnEdit = document.createElement('button');
                    btnEdit.type = 'button';
                    btnEdit.className = 'btn-admin-action approve';
                    btnEdit.style.margin = '0';
                    btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i> 수정';
                    btnEdit.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openAddressForm(item);
                    });
                    tdAction.appendChild(btnEdit);

                    const btnDel = document.createElement('button');
                    btnDel.type = 'button';
                    btnDel.className = 'btn-admin-action delete';
                    btnDel.style.margin = '0';
                    btnDel.innerHTML = '<i class="fa-solid fa-trash"></i> 삭제';
                    btnDel.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (await customConfirm(`'${item.name || item.email}' 연락처를 삭제하시겠습니까?`, 'fa-solid fa-triangle-exclamation')) {
                            deleteAddressBook(item.id);
                        }
                    });
                    tdAction.appendChild(btnDel);
                } else {
                    // 미등록 목록에서는 등록, 삭제, 스팸 가능
                    const btnEdit = document.createElement('button');
                    btnEdit.type = 'button';
                    btnEdit.className = 'btn-admin-action approve';
                    btnEdit.style.margin = '0';
                    btnEdit.innerHTML = '<i class="fa-solid fa-user-plus"></i> 등록';
                    btnEdit.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openAddressForm(item);
                    });
                    tdAction.appendChild(btnEdit);

                    const btnDel = document.createElement('button');
                    btnDel.type = 'button';
                    btnDel.className = 'btn-admin-action delete';
                    btnDel.style.margin = '0';
                    btnDel.innerHTML = '<i class="fa-solid fa-trash"></i> 삭제';
                    btnDel.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (await customConfirm(`'${item.email}' 목록에서 삭제하시겠습니까?`, 'fa-solid fa-triangle-exclamation')) {
                            const formData = new FormData();
                            formData.append('action', 'delete_auto_sender');
                            formData.append('email', item.email);
                            try {
                                const res = await fetch('api.php', { method: 'POST', body: formData });
                                const data = await res.json();
                                if (data.success) {
                                    showToast(data.message);
                                    await loadAddressBookData();
                                } else {
                                    showToast(data.message || '삭제 실패', true);
                                }
                            } catch (err) {
                                showToast('오류 발생', true);
                            }
                        }
                    });
                    tdAction.appendChild(btnDel);

                    const btnSpam = document.createElement('button');
                    btnSpam.type = 'button';
                    btnSpam.className = 'btn-admin-action reject';
                    btnSpam.style.margin = '0';
                    btnSpam.innerHTML = '<i class="fa-solid fa-ban"></i> 스팸';
                    btnSpam.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (await customConfirm(`'${item.email}' 스팸으로 등록하시겠습니까?\n이후 해당 메일은 스팸함으로 이동됩니다.`, 'fa-solid fa-ban')) {
                            const formData = new FormData();
                            formData.append('action', 'mark_as_spam');
                            formData.append('email', item.email);
                            try {
                                const res = await fetch('api.php', { method: 'POST', body: formData });
                                const data = await res.json();
                                if (data.success) {
                                    showToast(data.message);
                                    await loadAddressBookData();
                                } else {
                                    showToast(data.message || '스팸 등록 실패', true);
                                }
                            } catch (err) {
                                showToast('오류 발생', true);
                            }
                        }
                    });
                    tdAction.appendChild(btnSpam);
                }
                tr.appendChild(tdAction);
            }
            
            addressbookList.appendChild(tr);
        });
    }

    // 검색 입력 시 실시간 필터링
    if (addrSearchInput) {
        addrSearchInput.addEventListener('input', renderAddressBookList);
    }

    // 주소록 그룹 필터 드롭다운 관련 바인딩 및 함수
    const filterGroupTrigger = document.getElementById('addr-filter-group-trigger');
    const filterGroupOptions = document.getElementById('addr-filter-group-options');
    
    if (filterGroupTrigger && filterGroupOptions) {
        filterGroupTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            filterGroupOptions.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', (e) => {
        if (filterGroupOptions && !filterGroupOptions.classList.contains('hidden')) {
            if (!filterGroupTrigger.contains(e.target) && !filterGroupOptions.contains(e.target)) {
                filterGroupOptions.classList.add('hidden');
            }
        }
    });

    function initAddressBookFilterGroups() {
        state.addressBookFilterGroups = state.addressGroups.map(g => g.name);
        buildFilterGroupDropdown();
        updateFilterGroupLabel();
    }

    function updateFilterGroupLabel() {
        const label = document.getElementById('addr-filter-group-label');
        if (!label) return;
        const total = state.addressGroups.length;
        const checked = state.addressBookFilterGroups.length;
        if (checked === total) {
            label.innerText = '모든 그룹';
        } else if (checked === 0) {
            label.innerText = '선택 없음';
        } else if (checked === 1) {
            label.innerText = state.addressBookFilterGroups[0];
        } else {
            label.innerText = `${state.addressBookFilterGroups[0]} 외 ${checked - 1}`;
        }
    }

    function buildFilterGroupDropdown() {
        if (!filterGroupOptions) return;
        filterGroupOptions.innerHTML = '';

        // 1. "전체" (Select All) 체크박스 생성
        const allLabel = document.createElement('label');
        allLabel.style.display = 'flex';
        allLabel.style.alignItems = 'center';
        allLabel.style.gap = '8px';
        allLabel.style.fontSize = '12px';
        allLabel.style.fontWeight = 'bold';
        allLabel.style.color = 'var(--text-primary)';
        allLabel.style.cursor = 'pointer';
        allLabel.style.padding = '4px 6px';
        allLabel.style.borderRadius = '4px';
        allLabel.style.transition = 'background 0.15s';
        allLabel.addEventListener('mouseenter', () => allLabel.style.background = 'var(--bg-hover)');
        allLabel.addEventListener('mouseleave', () => allLabel.style.background = 'transparent');

        const allChk = document.createElement('input');
        allChk.type = 'checkbox';
        allChk.style.cursor = 'pointer';
        
        const totalGroups = state.addressGroups.length;
        const checkedCount = state.addressBookFilterGroups.length;
        allChk.checked = totalGroups === checkedCount && totalGroups > 0;
        allChk.indeterminate = checkedCount > 0 && checkedCount < totalGroups;

        allChk.addEventListener('change', () => {
            if (allChk.checked) {
                state.addressBookFilterGroups = state.addressGroups.map(g => g.name);
                updateFilterGroupLabel();
                
                // 하위 체크박스 동기화
                const checkboxes = filterGroupOptions.querySelectorAll('.addr-filter-group-chk');
                checkboxes.forEach(chk => {
                    chk.checked = true;
                });
                renderAddressBookList();
            } else {
                // 최소 1개 선택 의무화: 전체 취소 방지
                allChk.checked = true;
                showToast('최소 하나의 그룹은 선택해야 합니다.');
            }
        });

        const allSpan = document.createElement('span');
        allSpan.innerText = '전체';

        allLabel.appendChild(allChk);
        allLabel.appendChild(allSpan);
        filterGroupOptions.appendChild(allLabel);

        // 2. 구분선 추가
        const divider = document.createElement('div');
        divider.style.borderBottom = '1px solid var(--border-color)';
        divider.style.margin = '4px 0';
        filterGroupOptions.appendChild(divider);

        // 3. 하위 그룹 체크박스들 생성
        state.addressGroups.forEach(g => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.style.fontSize = '12px';
            label.style.color = 'var(--text-primary)';
            label.style.cursor = 'pointer';
            label.style.padding = '4px 6px';
            label.style.borderRadius = '4px';
            label.style.transition = 'background 0.15s';
            label.addEventListener('mouseenter', () => label.style.background = 'var(--bg-hover)');
            label.addEventListener('mouseleave', () => label.style.background = 'transparent');

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = g.name;
            chk.className = 'addr-filter-group-chk';
            chk.checked = state.addressBookFilterGroups.includes(g.name);
            chk.style.cursor = 'pointer';
            chk.addEventListener('change', () => {
                if (chk.checked) {
                    if (!state.addressBookFilterGroups.includes(g.name)) {
                        state.addressBookFilterGroups.push(g.name);
                    }
                } else {
                    if (state.addressBookFilterGroups.length <= 1) {
                        chk.checked = true;
                        showToast('최소 하나의 그룹은 선택해야 합니다.');
                        return;
                    }
                    state.addressBookFilterGroups = state.addressBookFilterGroups.filter(x => x !== g.name);
                }

                // 전체 체크박스 상태 갱신
                const curChecked = state.addressBookFilterGroups.length;
                allChk.checked = totalGroups === curChecked;
                allChk.indeterminate = curChecked > 0 && curChecked < totalGroups;

                updateFilterGroupLabel();
                renderAddressBookList();
            });

            const span = document.createElement('span');
            span.innerText = g.name;

            label.appendChild(chk);
            label.appendChild(span);
            filterGroupOptions.appendChild(label);
        });
    }

    // 새 연락처 추가 버튼 클릭 시
    if (btnAddAddress) {
        btnAddAddress.addEventListener('click', () => {
            openAddressForm();
        });
    }

    // 주소록 그룹 드롭다운 리스트 채우기 (단일 선택 드롭다운 방식)
    async function loadAddressGroupOptions(selectedValue = '미정') {
        const optionsDiv = document.getElementById('addr-group-options');
        const labelSpan = document.getElementById('addr-group-label');
        const hiddenInput = document.getElementById('addr-group');
        
        if (!optionsDiv || !labelSpan || !hiddenInput) return;
        optionsDiv.innerHTML = '<div style="padding: 8px 12px; color: var(--text-secondary); font-size: 13px;">로딩 중...</div>';
        
        try {
            const res = await apiRequest('list_address_groups');
            if (res.success) {
                const groups = res.address_groups || [];
                optionsDiv.innerHTML = '';
                
                let selectedGroup = (selectedValue || '미정').trim();
                hiddenInput.value = selectedGroup;
                labelSpan.innerText = selectedGroup;

                const renderOptionItem = (gName, gColor) => {
                    const opt = document.createElement('div');
                    opt.style.display = 'flex';
                    opt.style.alignItems = 'center';
                    opt.style.gap = '10px';
                    opt.style.cursor = 'pointer';
                    opt.style.fontSize = '13px';
                    opt.style.padding = '8px 12px';
                    opt.style.transition = 'background 0.2s';
                    opt.style.userSelect = 'none';

                    opt.addEventListener('mouseenter', () => {
                        opt.style.background = 'var(--bg-hover)';
                    });
                    opt.addEventListener('mouseleave', () => {
                        opt.style.background = 'transparent';
                    });

                    if (gName === selectedGroup) {
                        opt.style.fontWeight = 'bold';
                        opt.style.color = 'var(--color-primary)';
                        opt.style.background = 'rgba(59, 130, 246, 0.08)';
                    }

                    const color = gColor || '#3b82f6';
                    const colorIcon = document.createElement('i');
                    colorIcon.className = 'fa-solid fa-circle';
                    colorIcon.style.color = color;
                    colorIcon.style.fontSize = '8px';

                    const textSpan = document.createElement('span');
                    textSpan.innerText = gName;
                    textSpan.style.flexGrow = '1';

                    opt.appendChild(colorIcon);
                    opt.appendChild(textSpan);

                    if (gName === selectedGroup) {
                        const checkIcon = document.createElement('i');
                        checkIcon.className = 'fa-solid fa-check';
                        checkIcon.style.fontSize = '12px';
                        checkIcon.style.color = 'var(--color-primary)';
                        opt.appendChild(checkIcon);
                    }

                    opt.addEventListener('click', (e) => {
                        e.stopPropagation();
                        hiddenInput.value = gName;
                        labelSpan.innerText = gName;
                        optionsDiv.classList.add('hidden');
                    });

                    optionsDiv.appendChild(opt);
                };

                groups.forEach(g => {
                    renderOptionItem(g.name, g.color);
                });
            } else {
                optionsDiv.innerHTML = '<div style="padding: 8px 12px; color: var(--color-danger); font-size: 13px;">로드 실패</div>';
            }
        } catch (err) {
            console.error('Error loading address group options:', err);
            optionsDiv.innerHTML = '<div style="padding: 8px 12px; color: var(--color-danger); font-size: 13px;">에러 발생</div>';
        }
    }

    // 커스텀 드롭다운 토글 리스너 및 닫기 등록
    const addrGroupTrigger = document.getElementById('addr-group-trigger');
    const addrGroupOptions = document.getElementById('addr-group-options');
    
    if (addrGroupTrigger && addrGroupOptions) {
        addrGroupTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            addrGroupOptions.classList.toggle('hidden');
        });
    }
    
    // 바깥 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
        if (addrGroupOptions && !addrGroupOptions.classList.contains('hidden')) {
            if (!addrGroupTrigger.contains(e.target) && !addrGroupOptions.contains(e.target)) {
                addrGroupOptions.classList.add('hidden');
            }
        }
    });

    // 연락처 작성/수정 폼 열기
    async function openAddressForm(item = null) {
        if (!addressFormModal) return;
        const formTitle = document.getElementById('addr-form-title');
        const inputId = document.getElementById('addr-id');
        const inputName = document.getElementById('addr-name');
        const inputEmail = document.getElementById('addr-email');

        addressFormModal.classList.remove('hidden');

        // 그룹 드롭다운 로딩 및 매칭값 선택
        await loadAddressGroupOptions(item ? item.group_name : '미정');

        if (item) {
            if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-address-card"></i> 연락처 편집';
            if (inputId) inputId.value = item.id || '';
            if (inputName) inputName.value = item.name || '';
            if (inputEmail) inputEmail.value = item.email || '';
            if (inputEmail) inputEmail.readOnly = false;
        } else {
            if (formTitle) formTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> 새 연락처 추가';
            if (inputId) inputId.value = '';
            if (inputName) inputName.value = '';
            if (inputEmail) inputEmail.value = '';
            if (inputEmail) inputEmail.readOnly = false;
        }
    }

    // 연락처 폼 닫기
    function closeAddressForm() {
        if (addressFormModal) addressFormModal.classList.add('hidden');
    }

    // 연락처 저장 submit
    if (formAddress) {
        formAddress.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('addr-id').value;
            const name = document.getElementById('addr-name').value.trim();
            const email = document.getElementById('addr-email').value.trim();
            const group_name = document.getElementById('addr-group').value || '미정';

            if (!name || !email) {
                showToast('이름과 이메일을 입력해 주세요.');
                return;
            }

            showToast('주소록을 저장하는 중...');
            const res = await apiRequest('save_address', 'POST', { name, email, group_name });
            showToast(res.message);
            
            if (res.success) {
                closeAddressForm();
                loadAddressBookData(); // 주소록 재로드
            }
        });
    }

    // 연락처 삭제
    async function deleteAddressBook(id) {
        showToast('연락처를 삭제하는 중...');
        const res = await apiRequest('delete_address', 'POST', { id });
        showToast(res.message);
        if (res.success) {
            loadAddressBookData();
        }
    }

    // 주소록 그룹 관리 모달 버튼 바인딩 및 이벤트 정의
    if (btnManageAddrGroups && addressGroupsModal) {
        btnManageAddrGroups.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addressGroupsModal.classList.remove('hidden');
            loadAddressGroupsList();
        });
    }

    // 그룹 목록 렌더링
    async function loadAddressGroupsList() {
        if (!addrGroupsList) return;
        addrGroupsList.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 12px;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
        try {
            const res = await apiRequest('list_address_groups');
            if (res.success) {
                const groups = res.address_groups || [];
                addrGroupsList.innerHTML = '';
                groups.forEach(g => {
                    const isMijeong = g.name === '미정';
                    const tr = document.createElement('tr');
                    tr.dataset.id = g.id;
                    tr.dataset.name = g.name;
                    tr.style.borderBottom = '1px solid var(--border-color)';

                    if (!isMijeong) {
                        tr.draggable = true;
                        tr.className = 'group-drag-item';
                        tr.style.cursor = 'pointer'; // 손가락 커서로 드래그 가능하게
                    } else {
                        tr.className = 'group-static-item';
                    }

                    // 대표 색상 (사람 아이콘으로 대신)
                    const color = g.color || '#3b82f6';
                    const personIcon = `<i class="fa-solid fa-user address-group-icon-clickable" style="color: ${color}; margin-right: 8px; cursor: pointer; font-size: 14px; vertical-align: middle;" data-id="${g.id}"></i>`;

                    const renameButton = !isMijeong 
                        ? `<button class="btn-group-rename btn-address-group-rename" style="margin: 0 0 0 8px; font-size: 11px;" data-id="${g.id}" data-name="${escapeHtml(g.name)}">변경</button>` 
                        : '';

                    const nameCell = document.createElement('td');
                    nameCell.style.padding = '8px 12px';
                    nameCell.style.display = 'flex';
                    nameCell.style.alignItems = 'center';
                    nameCell.innerHTML = `
                        ${personIcon}
                        <span class="group-name-text" style="vertical-align: middle;">${escapeHtml(g.name)}</span>
                        ${renameButton}
                    `;
                    tr.appendChild(nameCell);

                    const actionCell = document.createElement('td');
                    actionCell.style.padding = '8px 12px';
                    actionCell.style.textAlign = 'right';

                    if (!isMijeong) {
                        const btnDel = document.createElement('button');
                        btnDel.type = 'button';
                        btnDel.className = 'btn-admin-action delete';
                        btnDel.style.margin = '0';
                        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i> 삭제';
                        btnDel.addEventListener('click', async (evt) => {
                            evt.stopPropagation();
                            if (!await customConfirm(`'${g.name}' 그룹을 삭제하시겠습니까?\n해당 그룹의 연락처들은 '미정' 그룹으로 변경됩니다.`, 'fa-solid fa-triangle-exclamation')) return;
                            
                            showToast('그룹을 삭제하는 중...');
                            const delRes = await apiRequest('delete_address_group', 'POST', { id: g.id });
                            showToast(delRes.message);
                            if (delRes.success) {
                                loadAddressGroupsList();
                                loadAddressBookData(); // Main address book refresh
                            }
                        });
                        actionCell.appendChild(btnDel);
                    } else {
                        actionCell.innerHTML = '<span style="color: var(--text-muted); font-size: 11px;">보호됨</span>';
                    }
                    tr.appendChild(actionCell);

                    // Drag and Drop Event Listeners (Only for non-system groups)
                    if (!isMijeong) {
                        tr.addEventListener('dragstart', (e) => {
                            tr.classList.add('dragging');
                            e.dataTransfer.setData('text/plain', g.id);
                            e.dataTransfer.effectAllowed = 'move';
                        });

                        tr.addEventListener('dragend', () => {
                            tr.classList.remove('dragging');
                            saveAddressGroupOrder();
                        });

                        tr.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            const draggingItem = addrGroupsList.querySelector('.dragging');
                            if (draggingItem && draggingItem !== tr) {
                                const bounding = tr.getBoundingClientRect();
                                const offset = e.clientY - bounding.top;
                                if (offset > bounding.height / 2) {
                                    tr.after(draggingItem);
                                } else {
                                    tr.before(draggingItem);
                                }
                            }
                        });
                    }

                    // Color Picker Logic
                    tr.querySelector('.address-group-icon-clickable').addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        const groupId = evt.currentTarget.dataset.id;
                        const rect = evt.currentTarget.getBoundingClientRect();

                        const tagColorPopover = document.getElementById('tag-color-popover');
                        tagColorPopover.classList.remove('hidden');
                        tagColorPopover.style.top = `${rect.bottom + window.scrollY + 5}px`;
                        tagColorPopover.style.left = `${rect.left + window.scrollX}px`;

                        renderAddressGroupColorPicker(groupId);
                    });

                    // Rename Logic
                    const renameBtn = tr.querySelector('.btn-address-group-rename');
                    if (renameBtn) {
                        renameBtn.addEventListener('click', (evt) => {
                            evt.stopPropagation();
                            const id = evt.currentTarget.dataset.id;
                            const name = evt.currentTarget.dataset.name;
                            
                            const renameIdInput = document.getElementById('rename-address-group-id');
                            const renameNewNameInput = document.getElementById('rename-address-group-new-name');
                            const addressGroupRenameModal = document.getElementById('address-group-rename-modal');
                            
                            if (renameIdInput && renameNewNameInput && addressGroupRenameModal) {
                                renameIdInput.value = id;
                                renameNewNameInput.value = name;
                                addressGroupRenameModal.classList.remove('hidden');
                                setTimeout(() => renameNewNameInput.focus(), 100);
                            }
                        });
                    }

                    addrGroupsList.appendChild(tr);
                });
            } else {
                addrGroupsList.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 12px; color: var(--color-danger);">로드 실패</td></tr>';
            }
        } catch (err) {
            console.error('Error loading address groups list:', err);
            addrGroupsList.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 12px; color: var(--color-danger);">에러 발생</td></tr>';
        }
    }

    // 그룹 순서 저장
    async function saveAddressGroupOrder() {
        const order = [];
        addrGroupsList.querySelectorAll('tr').forEach(tr => {
            if (tr.dataset.id) {
                order.push(tr.dataset.id);
            }
        });
        const res = await apiRequest('update_address_group_order', 'POST', { order: JSON.stringify(order) });
        if (res.success) {
            loadAddressBookData();
        } else {
            showToast(res.message);
        }
    }

    // 그룹 색상 선택기 렌더링
    function renderAddressGroupColorPicker(groupId) {
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6',
            '#6366f1', '#8b5cf6', '#ffffff', '#71717a', '#000000'
        ];

        const tagColorGrid = document.getElementById('tag-color-grid');
        const tagColorPopover = document.getElementById('tag-color-popover');

        tagColorGrid.innerHTML = '';
        colors.forEach(color => {
            const item = document.createElement('div');
            item.className = 'tag-color-item';
            item.style.backgroundColor = color;
            item.addEventListener('click', async () => {
                const res = await apiRequest('set_address_group_color', 'POST', { id: groupId, color: color });
                if (res.success) {
                    loadAddressGroupsList();
                    loadAddressBookData();
                    tagColorPopover.classList.add('hidden');
                }
            });
            tagColorGrid.appendChild(item);
        });
    }

    // 그룹 추가 서브밋
    if (formAddAddrGroup) {
        formAddAddrGroup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = newAddrGroupName.value.trim();
            if (!name) return;
            showToast('그룹을 추가하는 중...');
            const res = await apiRequest('save_address_group', 'POST', { name });
            showToast(res.message);
            if (res.success) {
                newAddrGroupName.value = '';
                loadAddressGroupsList();
                loadAddressBookData();
            }
        });
    }

    // 그룹 이름 변경 서브밋
    const formRenameAddressGroup = document.getElementById('form-rename-address-group');
    const addressGroupRenameModal = document.getElementById('address-group-rename-modal');
    const renameAddressGroupId = document.getElementById('rename-address-group-id');
    const renameAddressGroupNewName = document.getElementById('rename-address-group-new-name');

    if (formRenameAddressGroup) {
        formRenameAddressGroup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = renameAddressGroupId.value;
            const newName = renameAddressGroupNewName.value.trim();
            if (!newName || !id) {
                if (addressGroupRenameModal) addressGroupRenameModal.classList.add('hidden');
                return;
            }
            
            showToast('그룹 이름을 변경하는 중...');
            const res = await apiRequest('rename_address_group', 'POST', { id: id, name: newName });
            showToast(res.message);
            
            if (res.success) {
                if (addressGroupRenameModal) addressGroupRenameModal.classList.add('hidden');
                loadAddressGroupsList();
                loadAddressBookData();
            }
        });
    }

    // 바깥 클릭 시 모달 닫기 등록
    setupClickOutside(addressBookModal);
    setupClickOutside(addressFormModal);
    setupClickOutside(addressGroupsModal);
    setupClickOutside(addressGroupRenameModal);


    // --------------------------------------------------
    // RECIPIENT AUTOCOMPLETE (받는 이 이메일 주소 자동완성)
    // --------------------------------------------------
    
    let activeEmailInput = null;
    let activeEmailContainer = null;

    // 이메일 작성 시 자동완성 렌더링 함수
    function renderAutocomplete(search, targetInput, targetContainer) {
        if (!autocompleteList) return;
        activeEmailInput = targetInput;
        activeEmailContainer = targetContainer;

        if (!search) {
            autocompleteList.classList.add('hidden');
            return;
        }

        search = search.toLowerCase();
        
        // 내 주소록 + 보낸 사람 주소록에서 매칭 대상 찾음
        // 중복 제거 및 검색 매칭
        const allContacts = [];
        const seenEmails = new Set();

        const addUniqueContacts = (list) => {
            list.forEach(c => {
                if (!c.email) return;
                const emailLower = c.email.toLowerCase();
                if (!seenEmails.has(emailLower)) {
                    seenEmails.add(emailLower);
                    allContacts.push(c);
                }
            });
        };

        addUniqueContacts(state.addressBookListMy);
        addUniqueContacts(state.addressBookListReceived);

        const filtered = allContacts.filter(c => {
            const name = (c.name || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            return name.includes(search) || email.includes(search);
        });

        if (filtered.length === 0) {
            autocompleteList.classList.add('hidden');
            return;
        }

        autocompleteList.innerHTML = '';
        filtered.slice(0, 10).forEach(contact => {
            const item = document.createElement('div');
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.borderBottom = '1px solid var(--border-color)';
            item.style.fontSize = '13px';
            item.style.display = 'flex';
            item.style.flexDirection = 'column';
            item.style.gap = '2px';
            
            // 호버 스타일링
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--border-color)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });

            const nameSpan = document.createElement('span');
            nameSpan.style.fontWeight = 'bold';
            nameSpan.style.color = 'var(--text-primary)';
            nameSpan.innerText = contact.name || '미정';

            const emailSpan = document.createElement('span');
            emailSpan.style.color = 'var(--text-secondary)';
            emailSpan.style.fontSize = '11px';
            emailSpan.innerText = `${contact.email} (${contact.group_name || '미정'})`;

            item.appendChild(nameSpan);
            item.appendChild(emailSpan);

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (activeEmailInput && activeEmailContainer) {
                    addEmailTag(activeEmailContainer, contact.email);
                    activeEmailInput.value = '';
                    activeEmailInput.focus();
                }
                autocompleteList.classList.add('hidden');
            });

            autocompleteList.appendChild(item);
        });

        autocompleteList.classList.remove('hidden');
    }

    function setupEmailTagInput(input, container) {
        if (!input || !container) return;

        container.addEventListener('click', () => {
            input.focus();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === ',' || e.key === ';' || e.key === 'Enter') {
                const val = input.value.trim();
                if (val) {
                    if (addEmailTag(container, val)) {
                        e.preventDefault();
                        input.value = '';
                        autocompleteList.classList.add('hidden');
                    } else if (e.key !== 'Enter') {
                        // Just let the comma/semicolon stay in the input? 
                        // Actually, if it's invalid, we shouldn't tag it.
                    }
                }
            } else if (e.key === 'Backspace' && !input.value) {
                const tags = container.querySelectorAll('.email-tag');
                if (tags.length > 0) {
                    tags[tags.length - 1].remove();
                }
            }
        });

        input.addEventListener('input', (e) => {
            let value = e.target.value;
            if (value.includes(',') || value.includes(';')) {
                const parts = value.split(/[;,]/);
                const last = parts.pop();
                const successfullyTagged = [];
                const failedTags = [];
                
                parts.forEach(p => {
                    if (addEmailTag(container, p)) {
                        successfullyTagged.push(p);
                    } else {
                        failedTags.push(p);
                    }
                });
                
                if (failedTags.length > 0) {
                    // Keep failed ones in the input
                    e.target.value = failedTags.join(', ') + (last ? ', ' + last : '');
                } else {
                    e.target.value = last;
                }
                value = e.target.value;
            }
            renderAutocomplete(value.trim(), input, container);
        });

        input.addEventListener('focus', () => {
            // 백그라운드에서 조용히 로딩
            apiRequest('list_address_book').then(myRes => {
                if (myRes.success) state.addressBookListMy = myRes.address_book || [];
            });
            apiRequest('list_received_senders').then(recvRes => {
                if (recvRes.success) state.addressBookListReceived = recvRes.senders || [];
            });
        });
    }

    // 받는 이 및 참조 입력창에 태그 시스템 적용
    if (mailToInput) setupEmailTagInput(mailToInput, mailToContainer);
    if (mailCcInput) setupEmailTagInput(mailCcInput, mailCcContainer);

    // 바깥 영역 클릭 시 자동완성 닫기
    document.addEventListener('click', (e) => {
        if (autocompleteList && !autocompleteList.classList.contains('hidden')) {
            if (!mailToInput.contains(e.target) && !autocompleteList.contains(e.target)) {
                autocompleteList.classList.add('hidden');
            }
        }
    });

    // Run App!
    initApp();
});
