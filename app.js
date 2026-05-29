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
        unreadCount: 0
    };

    function getBaseId(id) {
        if (!id) return '';
        return id.split(':2,')[0];
    }

    // --------------------------------------------------
    // FOLDER COLOR HELPER (Hash-based colors)
    // --------------------------------------------------
    function getFolderColor(folderName) {
        if (!folderName) return 'var(--text-secondary)';
        
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
        
        // Premium color palette for personal folders
        const colors = [
            '#3b82f6', // Blue
            '#10b981', // Emerald
            '#8b5cf6', // Violet
            '#ec4899', // Pink
            '#f59e0b', // Amber
            '#06b6d4', // Cyan
            '#f97316', // Orange
            '#14b8a6', // Teal
            '#a855f7', // Purple
            '#e11d48'  // Rose
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
    const badgeUnread = document.getElementById('badge-unread');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    
    // Controls
    const btnCompose = document.getElementById('btn-compose');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnLogout = document.getElementById('btn-logout');
    const btnAdmin = document.getElementById('btn-admin');
    const btnSettings = document.getElementById('user-profile-trigger');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const formSettings = document.getElementById('form-settings');
    
    function syncActiveFolderUI() {
        const folder = state.currentFolder;
        const isBuiltIn = ['INBOX', 'Starred', 'Sent', 'Drafts', 'Trash'].includes(folder);
        
        // If it's a personal folder (tag), ensure tags container is expanded and arrow is rotated
        if (!isBuiltIn) {
            const sidebarTagsContainer = document.getElementById('sidebar-tags-container');
            const tagsMenuArrow = document.getElementById('tags-menu-arrow');
            if (sidebarTagsContainer) sidebarTagsContainer.classList.remove('hidden');
            if (tagsMenuArrow) tagsMenuArrow.classList.add('rotated');
        }
        
        // 1. Update built-in nav items and btn-toggle-tags
        navItems.forEach(el => {
            if (el.id === 'btn-toggle-tags') {
                if (!isBuiltIn) {
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
        
        // 2. Update tag items in sidebar
        document.querySelectorAll('.tag-item').forEach(el => {
            if (el.dataset.folder === folder) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        
        // 3. Update popover tag items if loaded
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

        const rect = btn.getBoundingClientRect();
        
        const tooltip = document.createElement('div');
        tooltip.id = 'personal-folder-tooltip';
        
        // Layout and Position below the button
        tooltip.style.position = 'fixed';
        tooltip.style.top = `${rect.bottom + 8}px`;
        tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
        
        // Colors & Shape
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
        
        // Animation transitions
        tooltip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateX(-50%) translateY(5px)';

        // Arrow (Triangle pointing up)
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.top = '-6px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderLeft = '6px solid transparent';
        arrow.style.borderRight = '6px solid transparent';
        arrow.style.borderBottom = '6px solid #ef4444';
        tooltip.appendChild(arrow);
        
        const textSpan = document.createElement('span');
        textSpan.textContent = '개인 폴더가 없습니다';
        tooltip.appendChild(textSpan);

        document.body.appendChild(tooltip);

        // Force reflow
        tooltip.offsetHeight;

        // Animate in
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateX(-50%) translateY(0)';

        // Hide on scroll to prevent floating away
        const handleScroll = () => {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(-50%) translateY(-5px)';
            setTimeout(() => tooltip.remove(), 200);
            window.removeEventListener('scroll', handleScroll, true);
        };
        window.addEventListener('scroll', handleScroll, true);

        // Auto hide after 2.5 seconds
        setTimeout(() => {
            if (document.body.contains(tooltip)) {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateX(-50%) translateY(-5px)';
                setTimeout(() => tooltip.remove(), 200);
            }
            window.removeEventListener('scroll', handleScroll, true);
        }, 2500);
    }

    // --------------------------------------------------
    // CUSTOM CONFIRM DIALOG
    // --------------------------------------------------
    function customConfirm(message) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'confirm-overlay';
            
            const card = document.createElement('div');
            card.className = 'confirm-card';
            
            card.innerHTML = `
                <div class="confirm-body">
                    <i class="fa-solid fa-circle-question confirm-icon"></i>
                    <p class="confirm-message"></p>
                </div>
                <div class="confirm-footer">
                    <button type="button" class="btn-confirm-cancel">취소</button>
                    <button type="button" class="btn-confirm-ok">확인</button>
                </div>
            `;
            
            card.querySelector('.confirm-message').textContent = message;
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
        let savedTheme = localStorage.getItem('mail-theme') || 'violet';
        if (savedTheme === 'black') {
            savedTheme = 'white';
            localStorage.setItem('mail-theme', 'white');
        }
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
        
        const savedSidebarCollapsed = getCookie('sidebarCollapsed');
        if (savedSidebarCollapsed === 'true') {
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
        
        loadEmails(state.currentFolder);
        loadTags();
        updateGlobalUnreadCount();
        
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
        const username = formLogin.username.value;
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
        const username = formRegister.username.value;
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
            logoutUser();
        }
    });

    // --------------------------------------------------
    // MAIL ACTIONS (LIST, READ, DELETE, SEND)
    // --------------------------------------------------
    async function loadEmails(folder, showLoading = true) {
        state.currentFolder = folder;
        syncActiveFolderUI();
        folderTitle.textContent = getFolderDisplayName(folder);
        
        const btnEmptyTrash = document.getElementById('btn-empty-trash');
        if (btnEmptyTrash) {
            if (folder === 'Trash') {
                btnEmptyTrash.classList.remove('hidden');
            } else {
                btnEmptyTrash.classList.add('hidden');
            }
        }
        
        const startTime = Date.now();
        if (btnRefresh) {
            btnRefresh.classList.add('refreshing');
        }

        // Only fade out if switching folder or container has no list yet
        const isSameFolder = (state.currentFolder === folder);
        const hasExistingList = mailContainer.querySelector('.mail-list-table') !== null;
        const shouldFade = showLoading && (!isSameFolder || !hasExistingList);

        if (shouldFade) {
            mailContainer.classList.add('loading');
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Fetch emails from the server
        const res = await apiRequest('list_emails', 'GET', { folder });
        
        const elapsed = Date.now() - startTime;
        const minDuration = 1000;
        const delay = Math.max(0, minDuration - elapsed);
        
        setTimeout(() => {
            if (btnRefresh) {
                btnRefresh.classList.remove('refreshing');
            }
        }, delay);

        if (res.success) {
            const nextEmails = res.emails || [];
            const tbody = mailContainer.querySelector('#mail-list-tbody');
            
            if (isSameFolder && hasExistingList && tbody) {
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
                        
                        tr.className = `mail-item new-mail-item ${isSeen ? '' : 'unread'} ${isSelected ? 'selected' : ''}`;
                        tr.dataset.id = email.id;
                        
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
                                ${isSeen ? '' : '<span class="unread-dot"></span> '}
                                ${escapeHtml(email.subject)}
                            </td>
                            <td class="col-snippet">${escapeHtml(email.snippet || '')}</td>
                            <td class="col-date">${dateStr}</td>
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
                        
                        setTimeout(() => {
                            tr.classList.remove('new-mail-item');
                        }, 1000);
                    }
                    
                    state.emails = nextEmails;
                    updateGlobalUnreadCount();
                } else {
                    // Full render but without visible flicker/fading if same folder
                    state.emails = nextEmails;
                    if (showLoading) {
                        state.selectedEmailId = null;
                        if (readerContent) readerContent.classList.add('hidden');
                        if (readerEmpty) readerEmpty.classList.remove('hidden');
                    }
                    renderMailList();
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
            
            if (mailContainer.classList.contains('loading')) {
                mailContainer.offsetHeight;
                mailContainer.classList.remove('loading');
            }
            
            // Trigger a soft flash effect on refresh (only if it wasn't a full folder loading transition)
            if (!shouldFade) {
                const table = mailContainer.querySelector('.mail-list-table');
                if (table) {
                    table.classList.add('flash-refresh');
                    setTimeout(() => {
                        table.classList.remove('flash-refresh');
                    }, 800);
                }
            }
            
            // Adjust partition height
            const savedFolderHeight = getCookie('listHeight_' + folder);
            if (savedFolderHeight) {
                listHeight = parseInt(savedFolderHeight);
                mailListPane.style.height = `${listHeight}px`;
            } else {
                if (state.emails.length <= 5) {
                    setTimeout(() => {
                        const paneHeader = mailListPane.querySelector('.pane-header');
                        const table = mailListPane.querySelector('.mail-list-table');
                        const emptyMsg = mailListPane.querySelector('.list-empty');
                        
                        let targetHeight = 320;
                        const headerH = paneHeader ? paneHeader.offsetHeight : 55;
                        
                        if (table) {
                            const tableH = table.offsetHeight;
                            targetHeight = headerH + tableH + 4;
                        } else if (emptyMsg) {
                            const emptyH = emptyMsg.offsetHeight;
                            targetHeight = headerH + emptyH + 10;
                        }
                        
                        if (targetHeight < 70) targetHeight = 70;
                        listHeight = targetHeight;
                        mailListPane.style.height = `${targetHeight}px`;
                    }, 0);
                } else {
                    const globalSavedHeight = getCookie('listHeight');
                    listHeight = globalSavedHeight ? parseInt(globalSavedHeight) : 320;
                    mailListPane.style.height = `${listHeight}px`;
                }
            }
        } else {
            showToast(res.message);
            mailContainer.classList.remove('loading');
        }
    }

    function getFolderDisplayName(folder) {
        switch (folder) {
            case 'INBOX': return '받은 편지함';
            case 'Starred': return '즐겨찾기';
            case 'Sent': return '보낸 편지함';
            case 'Drafts': return '임시 보관함';
            case 'Trash': return '휴지통';
            default: return folder;
        }
    }

    function renderMailList() {
        const query = mailSearch.value.trim().toLowerCase();
        const filtered = state.emails.filter(email => {
            return email.subject.toLowerCase().includes(query) || 
                   email.from.toLowerCase().includes(query);
        });

        const mainContent = document.getElementById('main-content');
        if (filtered.length === 0) {
            mailContainer.innerHTML = '<div class="list-empty"><i class="fa-regular fa-envelope"></i><p>이메일이 없습니다.</p></div>';
            if (readerContent) readerContent.classList.add('hidden');
            if (readerEmpty) readerEmpty.classList.remove('hidden');
            state.selectedEmailId = null;
            if (mainContent) {
                mainContent.classList.add('empty-mailbox');
            }
            return;
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

        const table = document.createElement('table');
        table.className = 'mail-list-table';
        
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="col-chk"><input type="checkbox" id="chk-all-emails"></th>
                    <th class="col-flag"><i class="fa-regular fa-star"></i></th>
                    <th class="col-sender" style="width: ${colWidths.sender}px;">보낸사람</th>
                    <th class="col-subject" style="width: ${colWidths.subject}px;">제목</th>
                    <th class="col-snippet" style="width: ${colWidths.snippet}px;">내용</th>
                    <th class="col-date" style="width: ${colWidths.date}px;">시간</th>
                </tr>
            </thead>
            <tbody id="mail-list-tbody"></tbody>
        `;
        
        const tbody = table.querySelector('#mail-list-tbody');
        
        filtered.forEach((email, index) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${index * 15}ms`;
            const isSelected = getBaseId(email.id) === getBaseId(state.selectedEmailId);
            const isSeen = email.seen || isSelected;
            tr.className = `mail-item ${isSeen ? '' : 'unread'} ${isSelected ? 'selected' : ''}`;
            tr.dataset.id = email.id;

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
                    ${isSeen ? '' : '<span class="unread-dot"></span> '}
                    ${escapeHtml(email.subject)}
                </td>
                <td class="col-snippet">${escapeHtml(email.snippet || '')}</td>
                <td class="col-date">${dateStr}</td>
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

        mailContainer.innerHTML = '';
        mailContainer.appendChild(table);
        makeTableColumnsResizable(table);

        const chkAll = table.querySelector('#chk-all-emails');
        if (chkAll) {
            chkAll.addEventListener('change', (e) => {
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
    }

    async function updateGlobalUnreadCount() {
        if (state.user === null) return;
        
        const selBase = getBaseId(state.selectedEmailId);
        
        // If we are currently in INBOX, we don't need a separate API call
        if (state.currentFolder === 'INBOX') {
            state.unreadCount = state.emails.filter(e => !e.seen && getBaseId(e.id) !== selBase).length;
            if (state.unreadCount > 0) {
                badgeUnread.textContent = state.unreadCount;
                badgeUnread.style.display = 'inline-block';
            } else {
                badgeUnread.style.display = 'none';
            }
            return;
        }
        
        // Otherwise, fetch INBOX list to get the unread count
        try {
            const res = await apiRequest('list_emails', 'GET', { folder: 'INBOX' });
            if (res.success && res.emails) {
                const unread = res.emails.filter(e => !e.seen && getBaseId(e.id) !== selBase).length;
                if (unread > 0) {
                    badgeUnread.textContent = unread;
                    badgeUnread.style.display = 'inline-block';
                } else {
                    badgeUnread.style.display = 'none';
                }
            }
        } catch (err) {
            console.error('Error updating unread count:', err);
        }
    }

    async function loadTags() {
        const sidebarTagsContainer = document.getElementById('sidebar-tags-container');
        if (!sidebarTagsContainer) return;
        
        try {
            const res = await apiRequest('list_tags');
            if (res.success) {
                const tags = res.tags || [];
                sidebarTagsContainer.innerHTML = '';
                
                // When no personal folders exist, do not display anything continuously
                if (tags.length === 0) {
                    return;
                }
                
                tags.forEach(tag => {
                    const a = document.createElement('a');
                    a.href = '#';
                    a.className = `tag-item ${tag === state.currentFolder ? 'active' : ''}`;
                    a.dataset.folder = tag;
                    const folderColor = getFolderColor(tag);
                    a.innerHTML = `
                        <i class="fa-solid fa-folder" style="color: ${folderColor};"></i>
                        <span class="nav-label">${escapeHtml(tag)}</span>
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
                
                // Keep UI classes synchronized
                syncActiveFolderUI();
            } else {
                console.error('Failed to load tags:', res.message);
            }
        } catch (err) {
            console.error('Error loading tags:', err);
        }
    }

    async function selectEmail(id) {
        state.selectedEmailId = id;
        const targetBase = getBaseId(id);
        
        document.querySelectorAll('.mail-item').forEach(el => {
            if (getBaseId(el.dataset.id) === targetBase) {
                el.classList.add('selected');
                el.classList.remove('unread');
                // Remove unread dot inside subject
                const dot = el.querySelector('.unread-dot');
                if (dot) dot.remove();
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
                const allDestinations = ['INBOX', ...(resTags.tags || [])];
                let addedCount = 0;
                allDestinations.forEach(dest => {
                    if (dest === state.currentFolder) return;
                    
                    const a = document.createElement('a');
                    a.href = '#';
                    const folderColor = getFolderColor(dest);
                    a.innerHTML = `
                        <i class="fa-solid fa-folder" style="color: ${folderColor}; margin-right: 8px;"></i>
                        <span>${dest === 'INBOX' ? '받은 편지함 (INBOX)' : escapeHtml(dest)}</span>
                    `;
                    a.addEventListener('click', async (evt) => {
                        evt.preventDefault();
                        showToast('메일을 이동 중입니다...');
                        const rMove = await apiRequest('move_email', 'POST', {
                            id: id,
                            folder: state.currentFolder,
                            dest_folder: dest
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
        const res = await apiRequest('read_email', 'GET', { folder: actualFolder, id });
        if (res.success && res.email) {
            const email = res.email;
            readSubject.textContent = email.subject;
            readFrom.textContent = email.from;
            readTo.textContent = email.to;
            readDate.textContent = email.date;

            // Render email body inside sandboxed iframe
            const doc = mailBodyFrame.contentDocument || mailBodyFrame.contentWindow.document;
            doc.open();
            
            // Requirements 3.1: 다크 테마 배경 투명 및 글자색 연동
            const isWhiteTheme = document.body.classList.contains('theme-white');
            const bodyBg = isWhiteTheme ? '#ffffff' : '#161621'; // Solid dark theme bg
            const bodyColor = isWhiteTheme ? '#333333' : '#f3f4f6';
            const linkColor = isWhiteTheme ? '#4f46e5' : '#c084fc';
            
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
            
            const content = `
                <html>
                <head>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            font-size: 14px;
                            line-height: 1.6;
                            padding: 24px;
                            margin: 0;
                        }
                        a { color: ${linkColor}; }
                        ${themeOverrideCss}
                    </style>
                </head>
                <body>
                    ${email.body}
                </body>
                </html>
            `;
            doc.write(content);
            doc.close();

            // Display attachments if present in the email
            const readAttachments = document.getElementById('read-attachments');
            const attachmentsCount = document.getElementById('attachments-count');
            const readAttachmentsList = document.getElementById('read-attachments-list');
            
            if (readAttachments && readAttachmentsList && attachmentsCount) {
                const attachments = email.attachments || [];
                if (attachments.length > 0) {
                    readAttachments.classList.remove('hidden');
                    attachmentsCount.textContent = attachments.length;
                    readAttachmentsList.innerHTML = '';
                    
                    attachments.forEach(att => {
                        const a = document.createElement('a');
                        a.href = `data:${att.content_type};base64,${att.data}`;
                        a.download = att.filename;
                        a.className = 'read-attachment-item';
                        
                        const sizeKB = (att.size / 1024).toFixed(1);
                        
                        a.innerHTML = `
                            <i class="fa-solid fa-file-arrow-down"></i>
                            <span>${escapeHtml(att.filename)}</span>
                            <span style="color: var(--text-muted);">(${sizeKB} KB)</span>
                        `;
                        readAttachmentsList.appendChild(a);
                    });
                } else {
                    readAttachments.classList.add('hidden');
                }
            }

            // Setup reply / forward actions based on selected mail
            btnReply.onclick = () => openCompose(email.from, `Re: ${email.subject}`, `\n\n--- Original Message ---\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\n\n${email.text_body || ''}`);
            btnForward.onclick = () => openCompose('', `Fwd: ${email.subject}`, `\n\n--- Original Message ---\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\n\n${email.text_body || ''}`);
            btnDeleteMail.onclick = () => deleteEmail(id);

            // Mark locally as seen, update ID to the server's new ID, and update badge
            const targetBase = getBaseId(id);
            const emailInState = state.emails.find(e => getBaseId(e.id) === targetBase);
            if (emailInState) {
                emailInState.seen = true;
                emailInState.id = res.email.id; // Update to the new ID with flags
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
            showToast(res.message);
        }
    }

    async function deleteEmail(id) {
        let actualFolder = state.currentFolder;
        const emailInState = state.emails.find(e => e.id === id);
        if (emailInState && emailInState.folder) {
            actualFolder = emailInState.folder;
        }

        const noConfirmDelete = (actualFolder === 'INBOX' || !['Sent', 'Drafts', 'Trash'].includes(actualFolder));
        if (!noConfirmDelete) {
            if (!await customConfirm('이 메일을 삭제하시겠습니까?')) return;
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

    function openCompose(to = '', subject = '', body = '') {
        formCompose.to.value = to;
        formCompose.subject.value = subject;
        formCompose.body.value = body;
        uploadedFiles = [];
        updateAttachmentsList();
        composeModal.classList.remove('hidden');
        
        // Autofocus the recipient input field
        setTimeout(() => {
            if (formCompose.to) {
                formCompose.to.focus();
            }
        }, 50);
    }

    formCompose.addEventListener('submit', async (e) => {
        e.preventDefault();
        const to = formCompose.to.value;
        const subject = formCompose.subject.value;
        const body = formCompose.body.value;

        showToast('메일을 발송 중입니다...');
        
        const formData = new FormData();
        formData.append('to', to);
        formData.append('subject', subject);
        formData.append('body', body);
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

    async function loadAdminUsers() {
        adminUserList.innerHTML = '<tr><td colspan="6" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 회원 목록 불러오는 중...</td></tr>';
        
        const groupsRes = await apiRequest('admin_list_groups');
        adminGroupsList = groupsRes.success ? (groupsRes.groups || []) : [];

        const res = await apiRequest('admin_list_users');
        if (res.success) {
            allAdminUsers = res.users || [];
            
            // Build Group Filter Dropdown options
            const filterSelect = document.getElementById('admin-group-filter');
            if (filterSelect) {
                // Keep "전체" option, rebuild others
                filterSelect.innerHTML = '<option value="all">전체</option>';
                adminGroupsList.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.name;
                    opt.textContent = g.name;
                    filterSelect.appendChild(opt);
                });
                
                // Remove previous listener to avoid double binding
                filterSelect.onchange = (e) => {
                    renderAdminUsersTable(e.target.value);
                };
                filterSelect.value = 'all';
            }

            renderAdminUsersTable('all');
        } else {
            showToast(res.message);
        }
    }

    function renderAdminUsersTable(groupFilter = 'all') {
        adminUserList.innerHTML = '';
        
        const filteredUsers = allAdminUsers.filter(user => {
            if (groupFilter === 'all') return true;
            const uGroups = (user.group_name || '일반').split(',').map(s => s.trim());
            return uGroups.includes(groupFilter);
        });

        if (filteredUsers.length === 0) {
            adminUserList.innerHTML = '<tr><td colspan="6" style="text-align: center;">조건에 맞는 회원이 존재하지 않습니다.</td></tr>';
            return;
        }

        filteredUsers.forEach(user => {
            const tr = document.createElement('tr');
            
            let statusBadge = '';
            let actionButtons = '';

            if (user.status === 'pending') {
                statusBadge = '<span class="status-badge pending">승인 대기</span>';
                actionButtons = `
                    <button class="btn-admin-action approve" data-id="${user.id}"><i class="fa-solid fa-check"></i> 승인</button>
                    <button class="btn-admin-action delete" data-id="${user.id}"><i class="fa-solid fa-xmark"></i> 거절/삭제</button>
                `;
            } else if (user.status === 'approved') {
                statusBadge = '<span class="status-badge approved">활성화</span>';
                actionButtons = `
                    <button class="btn-admin-action lock" data-id="${user.id}"><i class="fa-solid fa-lock"></i> 잠금</button>
                    ${user.username !== 'dj' ? `<button class="btn-admin-action delete" data-id="${user.id}"><i class="fa-solid fa-trash"></i> 삭제</button>` : ''}
                `;
            } else if (user.status === 'locked') {
                statusBadge = '<span class="status-badge locked">잠금 상태</span>';
                actionButtons = `
                    <button class="btn-admin-action approve" data-id="${user.id}"><i class="fa-solid fa-lock-open"></i> 잠금해제</button>
                    <button class="btn-admin-action delete" data-id="${user.id}"><i class="fa-solid fa-trash"></i> 삭제</button>
                `;
            }

            const uGroups = (user.group_name || '일반').split(',').map(s => s.trim());

            let groupSelectHtml = `<div class="multi-group-dropdown" data-id="${user.id}">`;
            groupSelectHtml += `<button class="btn-multi-group-trigger" type="button">`;
            groupSelectHtml += `<span>${escapeHtml(uGroups.join(', '))}</span> <i class="fa-solid fa-caret-down"></i>`;
            groupSelectHtml += `</button>`;
            groupSelectHtml += `<div class="multi-group-options hidden">`;
            adminGroupsList.forEach(g => {
                const isChecked = uGroups.includes(g.name) ? 'checked' : '';
                groupSelectHtml += `
                    <label class="multi-group-option-label">
                        <input type="checkbox" class="chk-user-group-item" data-id="${user.id}" value="${escapeHtml(g.name)}" ${isChecked}>
                        <span>${escapeHtml(g.name)}</span>
                    </label>
                `;
            });
            groupSelectHtml += `</div></div>`;

            tr.innerHTML = `
                <td>${escapeHtml(user.username)}@onto.kr</td>
                <td>${escapeHtml(user.name)}</td>
                <td>${groupSelectHtml}</td>
                <td>${user.created_at}</td>
                <td>${statusBadge}</td>
                <td class="admin-actions-cell">${actionButtons}</td>
            `;

            adminUserList.appendChild(tr);
        });

        // Bind Group Selection Change
        adminUserList.querySelectorAll('.btn-multi-group-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = btn.closest('.multi-group-dropdown');
                const options = dropdown.querySelector('.multi-group-options');
                
                // Close other open ones first
                document.querySelectorAll('.multi-group-options').forEach(opt => {
                    if (opt !== options) opt.classList.add('hidden');
                });
                
                options.classList.toggle('hidden');
                
                if (!options.classList.contains('hidden')) {
                    // Position dynamically using fixed coordinates relative to the trigger button
                    const rect = btn.getBoundingClientRect();
                    options.style.position = 'fixed';
                    options.style.left = `${rect.left}px`;
                    options.style.width = `${rect.width}px`;
                    options.style.minWidth = '140px';
                    
                    const dropdownHeight = options.offsetHeight || 150;
                    if (rect.bottom + dropdownHeight > window.innerHeight - 20) {
                        options.style.top = 'auto';
                        options.style.bottom = `${window.innerHeight - rect.top + 4}px`;
                    } else {
                        options.style.bottom = 'auto';
                        options.style.top = `${rect.bottom + 4}px`;
                    }
                }
            });
        });

        adminUserList.querySelectorAll('.chk-user-group-item').forEach(chk => {
            chk.addEventListener('change', async (evt) => {
                const id = evt.target.dataset.id;
                const dropdown = evt.target.closest('.multi-group-dropdown');
                
                const checkedCheckboxes = dropdown.querySelectorAll('.chk-user-group-item:checked');
                const checkedGroups = Array.from(checkedCheckboxes).map(c => c.value);
                
                if (checkedGroups.length === 0) {
                    evt.target.checked = true;
                    showToast('회원은 최소 1개 이상의 그룹에 속해야 합니다.');
                    return;
                }
                
                const group_names_str = checkedGroups.join(', ');
                
                showToast('그룹 변경 중...');
                const r = await apiRequest('admin_update_user_group', 'POST', { id, group_name: group_names_str });
                showToast(r.message);
                
                if (r.success) {
                    // Update cache local data
                    const u = allAdminUsers.find(user => user.id == id);
                    if (u) u.group_name = group_names_str;
                    dropdown.querySelector('.btn-multi-group-trigger span').textContent = group_names_str;
                } else {
                    evt.target.checked = !evt.target.checked;
                }
            });
        });

        // Bind Actions
        adminUserList.querySelectorAll('.btn-admin-action.approve').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                const act = btn.textContent.includes('잠금해제') ? 'admin_unlock' : 'admin_approve';
                showToast('처리 중...');
                const r = await apiRequest(act, 'POST', { id });
                showToast(r.message);
                if (r.success) loadAdminUsers();
            };
        });

        adminUserList.querySelectorAll('.btn-admin-action.lock').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                showToast('처리 중...');
                const r = await apiRequest('admin_lock', 'POST', { id });
                showToast(r.message);
                if (r.success) loadAdminUsers();
            };
        });

        adminUserList.querySelectorAll('.btn-admin-action.delete').forEach(btn => {
            btn.onclick = async () => {
                if (!await customConfirm('이 계정을 삭제하시겠습니까? 메일 연동이 중지됩니다.')) return;
                const id = btn.dataset.id;
                showToast('삭제 중...');
                const r = await apiRequest('admin_delete', 'POST', { id });
                showToast(r.message);
                if (r.success) loadAdminUsers();
            };
        });
    }

    // --------------------------------------------------
    // EVENT LISTENERS
    // --------------------------------------------------
    btnCompose.addEventListener('click', () => openCompose());
    if (btnCloseCompose) btnCloseCompose.addEventListener('click', () => composeModal.classList.add('hidden'));
    
    btnRefresh.addEventListener('click', () => loadEmails(state.currentFolder));
    
    const btnEmptyTrash = document.getElementById('btn-empty-trash');
    if (btnEmptyTrash) {
        btnEmptyTrash.addEventListener('click', async () => {
            if (await customConfirm('휴지통의 모든 메일을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
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
    const tagsMenuArrow = document.getElementById('tags-menu-arrow');
    
    function renderTagsPopoverList(tags) {
        const popoverList = document.getElementById('tags-popover-list');
        if (!popoverList) return;
        
        popoverList.innerHTML = '';
        
        if (tags.length === 0) {
            popoverList.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-size: 12px; text-align: center;">생성된 폴더가 없습니다.</div>';
            return;
        }
        
        tags.forEach(tag => {
            const a = document.createElement('a');
            a.href = '#';
            a.className = `tags-popover-item ${tag === state.currentFolder ? 'active' : ''}`;
            a.dataset.folder = tag;
            const folderColor = getFolderColor(tag);
            a.innerHTML = `
                <i class="fa-solid fa-folder" style="color: ${folderColor};"></i>
                <span>${escapeHtml(tag)}</span>
            `;
            
            a.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                
                setCookie('currentFolder', tag);
                loadEmails(tag);
                
                if (sidebarTagsContainer) sidebarTagsContainer.classList.remove('hidden');
                if (tagsMenuArrow) tagsMenuArrow.classList.add('rotated');
                
                const tagsPopover = document.getElementById('tags-popover');
                if (tagsPopover) tagsPopover.classList.add('hidden');
                
                loadTags();
            });
            popoverList.appendChild(a);
        });
        
        syncActiveFolderUI();
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
    
    if (btnToggleTags && sidebarTagsContainer) {
        btnToggleTags.addEventListener('click', async (e) => {
            if (e.target.closest('#btn-manage-tags')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            
            const tagsPopover = document.getElementById('tags-popover');
            
            // If popover is open in collapsed mode, close it instantly
            if (sidebar.classList.contains('collapsed') && tagsPopover && !tagsPopover.classList.contains('hidden')) {
                tagsPopover.classList.add('hidden');
                return;
            }
            
            // If sidebarTagsContainer is open in expanded mode, close it instantly
            if (!sidebar.classList.contains('collapsed') && !sidebarTagsContainer.classList.contains('hidden')) {
                sidebarTagsContainer.classList.add('hidden');
                if (tagsMenuArrow) tagsMenuArrow.classList.remove('rotated');
                return;
            }
            
            try {
                const res = await apiRequest('list_tags');
                const tags = res.success ? (res.tags || []) : [];
                
                if (tags.length === 0) {
                    // 화살표가 내려갔다가 다시 올라오는 애니메이션
                    if (tagsMenuArrow) {
                        tagsMenuArrow.classList.add('rotated');
                        setTimeout(() => {
                            tagsMenuArrow.classList.remove('rotated');
                        }, 300);
                    }

                    // 빨간색 툴팁 표시 (개인 보관함 아래)
                    showPersonalFolderTooltip();

                    if (tagsPopover) tagsPopover.classList.add('hidden');
                    sidebarTagsContainer.classList.add('hidden');
                    
                    // Clear contents
                    sidebarTagsContainer.innerHTML = '';
                    const popoverList = document.getElementById('tags-popover-list');
                    if (popoverList) popoverList.innerHTML = '';
                    return;
                }
                
                if (sidebar.classList.contains('collapsed')) {
                    if (tagsPopover) {
                        // Render tags popover list INSTANTLY before opening to avoid "Loading..." flash
                        renderTagsPopoverList(tags);
                        tagsPopover.classList.remove('hidden');
                    }
                } else {
                    if (tagsPopover) tagsPopover.classList.add('hidden');
                    
                    // Render expanded sidebar tags list INSTANTLY before opening
                    sidebarTagsContainer.innerHTML = '';
                    tags.forEach(tag => {
                        const a = document.createElement('a');
                        a.href = '#';
                        a.className = `tag-item ${tag === state.currentFolder ? 'active' : ''}`;
                        a.dataset.folder = tag;
                        const folderColor = getFolderColor(tag);
                        a.innerHTML = `
                            <i class="fa-solid fa-folder" style="color: ${folderColor};"></i>
                            <span class="nav-label">${escapeHtml(tag)}</span>
                        `;
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
                    syncActiveFolderUI();
                    
                    sidebarTagsContainer.classList.remove('hidden');
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
    const btnCloseTags = document.getElementById('btn-close-tags');
    const formCreateTag = document.getElementById('form-create-tag');
    const newTagNameInput = document.getElementById('new-tag-name');
    const tagsModalList = document.getElementById('tags-modal-list');

    if (btnManageTags && tagsModal) {
        btnManageTags.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tagsModal.classList.remove('hidden');
            loadTagsModalList();
        });
    }

    if (btnCloseTags && tagsModal) {
        btnCloseTags.addEventListener('click', () => {
            tagsModal.classList.add('hidden');
        });
    }

    async function loadTagsModalList() {
        if (!tagsModalList) return;
        tagsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
        
        const res = await apiRequest('list_tags');
        if (res.success) {
            const tags = res.tags || [];
            tagsModalList.innerHTML = '';
            
            if (tags.length === 0) {
                tagsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-secondary);">생성된 폴더가 없습니다.</td></tr>';
                return;
            }
            
            tags.forEach(tag => {
                const tr = document.createElement('tr');
                const folderColor = getFolderColor(tag);
                tr.innerHTML = `
                    <td><i class="fa-solid fa-folder" style="color: ${folderColor}; margin-right: 8px;"></i> ${escapeHtml(tag)}</td>
                    <td style="text-align: center;">
                        <button class="btn-tag-delete btn-danger-action" data-tag="${escapeHtml(tag)}"><i class="fa-solid fa-trash-can"></i> 삭제</button>
                    </td>
                `;
                
                tr.querySelector('.btn-tag-delete').addEventListener('click', async (evt) => {
                    const tName = evt.currentTarget.dataset.tag;
                    if (!await customConfirm(`'${tName}' 개인 폴더를 삭제하시겠습니까?\n폴더 내부의 모든 메일도 함께 삭제됩니다.`)) return;
                    
                    showToast('폴더 삭제 중...');
                    const r = await apiRequest('delete_tag', 'POST', { tag_name: tName });
                    showToast(r.message);
                    if (r.success) {
                        loadTagsModalList();
                        loadTags();
                        if (state.currentFolder === tName) {
                            setCookie('currentFolder', 'INBOX');
                            loadEmails('INBOX');
                        }
                    }
                });
                
                tagsModalList.appendChild(tr);
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
            
            if (!/^[\p{L}\p{N}_\-]+$/u.test(tagName)) {
                showToast('폴더 이름은 문자, 숫자, 밑줄(_), 하이픈(-)만 가능합니다.');
                return;
            }
            
            showToast('폴더 생성 중...');
            const res = await apiRequest('create_tag', 'POST', { tag_name: tagName });
            showToast(res.message);
            if (res.success) {
                newTagNameInput.value = '';
                loadTagsModalList();
                loadTags();
            }
        });
    }

    // Tag Move Dropdown Click Toggle
    const btnMoveTag = document.getElementById('btn-move-tag');
    const tagMoveDropdownList = document.getElementById('tag-move-dropdown-list');
    if (btnMoveTag && tagMoveDropdownList) {
        btnMoveTag.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tagMoveDropdownList.classList.toggle('hidden');
        });
        document.addEventListener('click', () => {
            tagMoveDropdownList.classList.add('hidden');
        });
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
                const currentTheme = localStorage.getItem('mail-theme') || 'violet';
                settingsModal.querySelectorAll('.theme-btn').forEach(btn => {
                    if (btn.dataset.theme === currentTheme) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
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
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
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

    // --------------------------------------------------
    // RESIZER LOGIC
    // --------------------------------------------------
    const sidebar = document.getElementById('sidebar');
    const mailListPane = document.getElementById('mail-list-pane');
    const resizerSidebar = document.getElementById('resizer-sidebar');
    const resizerList = document.getElementById('resizer-list');
    
    let sidebarWidth = 280;
    let listHeight = 290;
    let sidebarCollapsed = false;

    // Double click Sidebar Resizer to restore default state (280px)
    resizerSidebar.addEventListener('dblclick', () => {
        sidebarCollapsed = false;
        sidebar.classList.remove('collapsed');
        sidebarWidth = 280;
        sidebar.style.width = `${sidebarWidth}px`;
        
        const tagsPopover = document.getElementById('tags-popover');
        if (tagsPopover) tagsPopover.classList.add('hidden');
        
        setCookie('sidebarWidth', sidebarWidth);
        setCookie('sidebarCollapsed', sidebarCollapsed);
    });

    // Double click List Resizer to auto-fit item count (max 5)
    resizerList.addEventListener('dblclick', () => {
        const trs = mailListPane.querySelectorAll('.mail-list-table tbody tr.mail-item');
        const header = mailListPane.querySelector('.pane-header');
        const headerHeight = header ? header.offsetHeight : 55;
        
        let targetHeight = 320;
        if (trs.length > 0) {
            const count = Math.min(trs.length, 5);
            let itemsHeight = 0;
            for (let i = 0; i < count; i++) {
                itemsHeight += trs[i].offsetHeight || 34;
            }
            const thead = mailListPane.querySelector('.mail-list-table thead');
            const theadHeight = thead ? thead.offsetHeight : 34;
            
            targetHeight = headerHeight + theadHeight + itemsHeight + 4;
        } else {
            const emptyMsg = mailListPane.querySelector('.list-empty');
            if (emptyMsg) {
                targetHeight = headerHeight + emptyMsg.offsetHeight + 10;
            } else {
                targetHeight = headerHeight + 50;
            }
        }
        
        if (targetHeight < 70) targetHeight = 70;
        
        listHeight = targetHeight;
        mailListPane.style.height = `${targetHeight}px`;
        setCookie('listHeight', listHeight);
        if (state.currentFolder) {
            setCookie('listHeight_' + state.currentFolder, listHeight);
        }
    });

    // Resizing Sidebar
    resizerSidebar.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('resizing');
        resizerSidebar.classList.add('dragging');
        sidebar.classList.add('resizing');
        
        let ticking = false;
        let lastClientX = 0;
        
        function onMouseMove(event) {
            lastClientX = event.clientX;
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    let width = lastClientX;
                    if (width < 150) {
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
        
        function onMouseUp() {
            document.body.style.cursor = '';
            document.body.classList.remove('resizing');
            resizerSidebar.classList.remove('dragging');
            sidebar.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setCookie('sidebarWidth', sidebarWidth);
            setCookie('sidebarCollapsed', sidebarCollapsed);
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Resizing Mail List (Vertical Row Resize)
    resizerList.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.body.style.cursor = 'row-resize';
        document.body.classList.add('resizing');
        resizerList.classList.add('dragging');
        
        const mainContent = document.getElementById('main-content');
        const mainContentRect = mainContent.getBoundingClientRect();
        
        let ticking = false;
        let lastClientY = 0;
        
        function onMouseMove(event) {
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
        
        function onMouseUp() {
            document.body.style.cursor = '';
            document.body.classList.remove('resizing');
            resizerList.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setCookie('listHeight', listHeight);
            if (state.currentFolder) {
                setCookie('listHeight_' + state.currentFolder, listHeight);
            }
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // --------------------------------------------------
    // ADMIN USER CREATION POPUP MODAL
    // --------------------------------------------------
    const adminCreateUserModal = document.getElementById('admin-create-user-modal');
    const btnOpenAdminCreate = document.getElementById('btn-open-admin-create');
    const btnCloseAdminCreate = document.getElementById('btn-close-admin-create');
    const formAdminCreateUser = document.getElementById('form-admin-create-user');
    const admGroupChecklist = document.getElementById('adm-group-checklist');

    btnOpenAdminCreate.addEventListener('click', async () => {
        if (admGroupChecklist) {
            admGroupChecklist.innerHTML = '<span style="color: var(--text-muted); font-size: 13px;">로딩 중...</span>';
            const groupsRes = await apiRequest('admin_list_groups');
            if (groupsRes.success) {
                admGroupChecklist.innerHTML = '';
                const groups = groupsRes.groups || [];
                groups.forEach(g => {
                    const label = document.createElement('label');
                    label.className = 'group-checklist-item';
                    
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.value = g.name;
                    if (g.name === '일반') chk.checked = true;
                    
                    const span = document.createElement('span');
                    span.textContent = g.name;
                    
                    label.appendChild(chk);
                    label.appendChild(span);
                    admGroupChecklist.appendChild(label);
                });
            } else {
                admGroupChecklist.innerHTML = `
                    <label class="group-checklist-item">
                        <input type="checkbox" value="일반" checked>
                        <span>일반</span>
                    </label>
                `;
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
        
        const checkedGroupNodes = admGroupChecklist ? admGroupChecklist.querySelectorAll('input[type="checkbox"]:checked') : [];
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
            loadAdminUsers();
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

    async function loadGroupsModalList() {
        if (!groupsModalList) return;
        groupsModalList.innerHTML = '<tr><td colspan="2" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</td></tr>';

        const res = await apiRequest('admin_list_groups');
        if (res.success) {
            const groups = res.groups || [];
            groupsModalList.innerHTML = '';

            groups.forEach(group => {
                const tr = document.createElement('tr');
                const isDefaultGroup = group.name === '일반';
                
                const actionsHtml = `
                    <button class="btn-group-lock btn-admin-action lock" data-group="${escapeHtml(group.name)}"><i class="fa-solid fa-lock"></i> 잠금</button>
                    <button class="btn-group-unlock btn-admin-action approve" data-group="${escapeHtml(group.name)}"><i class="fa-solid fa-lock-open"></i> 해제</button>
                    ${!isDefaultGroup ? `<button class="btn-group-delete btn-danger-action btn-admin-action delete" data-group="${escapeHtml(group.name)}"><i class="fa-solid fa-trash-can"></i> 삭제</button>` : ''}
                `;

                tr.innerHTML = `
                    <td><i class="fa-solid fa-users" style="color: var(--color-primary); margin-right: 8px;"></i> ${escapeHtml(group.name)}</td>
                    <td class="admin-actions-cell" style="text-align: center; justify-content: center;">
                        ${actionsHtml}
                    </td>
                `;

                tr.querySelector('.btn-group-lock').addEventListener('click', async (evt) => {
                    const gName = evt.currentTarget.dataset.group;
                    if (!await customConfirm(`'${gName}' 그룹의 모든 회원을 일괄 잠금 처리하시겠습니까?`)) return;
                    showToast('그룹 일괄 잠금 중...');
                    const r = await apiRequest('admin_lock_group', 'POST', { name: gName });
                    showToast(r.message);
                    loadAdminUsers();
                });

                tr.querySelector('.btn-group-unlock').addEventListener('click', async (evt) => {
                    const gName = evt.currentTarget.dataset.group;
                    if (!await customConfirm(`'${gName}' 그룹 내 잠금된 회원을 일괄 잠금 해제하시겠습니까?`)) return;
                    showToast('그룹 일괄 잠금 해제 중...');
                    const r = await apiRequest('admin_unlock_group', 'POST', { name: gName });
                    showToast(r.message);
                    loadAdminUsers();
                });

                if (!isDefaultGroup) {
                    tr.querySelector('.btn-group-delete').addEventListener('click', async (evt) => {
                        const gName = evt.currentTarget.dataset.group;
                        if (!await customConfirm(`'${gName}' 그룹을 삭제하시겠습니까?\n소속 회원은 모두 '일반' 그룹으로 변경됩니다.`)) return;
                        showToast('그룹 삭제 중...');
                        const r = await apiRequest('admin_delete_group', 'POST', { name: gName });
                        showToast(r.message);
                        if (r.success) {
                            loadGroupsModalList();
                            loadAdminUsers();
                        }
                    });
                }

                groupsModalList.appendChild(tr);
            });
        } else {
            showToast(res.message);
        }
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
                loadGroupsModalList();
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

    function getSelectedEmailIds() {
        const chks = document.querySelectorAll('.mail-item-chk:checked');
        if (chks.length > 0) {
            return Array.from(chks).map(chk => ({
                id: chk.dataset.id,
                from: chk.dataset.from,
                folder: chk.dataset.folder
            }));
        }
        return [];
    }

    function getTargetEmails() {
        const selected = getSelectedEmailIds();
        if (selected.length > 0) {
            return selected;
        }
        const targetEmail = state.emails.find(e => e.id === targetEmailId);
        return [{ 
            id: targetEmailId, 
            from: targetEmail ? targetEmail.from : '',
            folder: targetEmail ? targetEmail.folder : state.currentFolder
        }];
    }

    async function showMailContextMenu(e, emailId) {
        targetEmailId = emailId;

        const moveList = document.getElementById('ctx-move-list');
        if (moveList) {
            moveList.innerHTML = '<div style="padding: 6px 12px; color: var(--text-muted); font-size: 11px;">로딩 중...</div>';
            
            const resTags = await apiRequest('list_tags');
            if (resTags.success) {
                const dests = ['INBOX', ...(resTags.tags || [])];
                moveList.innerHTML = '';
                let destCount = 0;
                
                dests.forEach(dest => {
                    if (dest === state.currentFolder) return;
                    
                    const div = document.createElement('div');
                    div.className = 'context-submenu-item';
                    div.textContent = dest === 'INBOX' ? '받은 편지함 (INBOX)' : dest;
                    
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
                                dest_folder: dest
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

        const noConfirmDelete = (state.currentFolder === 'INBOX' || !['Sent', 'Drafts', 'Trash'].includes(state.currentFolder));
        if (!noConfirmDelete) {
            if (!await customConfirm(`${targets.length}개의 메일을 삭제하시겠습니까?`)) return;
        }

        showToast('메일을 삭제 중입니다...');
        let successCount = 0;
        for (const t of targets) {
            const res = await apiRequest('delete_email', 'POST', { folder: t.folder, id: t.id });
            if (res.success) successCount++;
        }

        showToast(`${successCount}개의 메일이 삭제되었습니다.`);
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
        headers.forEach((th) => {
            const colClass = Array.from(th.classList).find(c => c.startsWith('col-'));
            if (!colClass || colClass === 'col-chk' || colClass === 'col-flag') {
                return;
            }

            const colName = colClass.replace('col-', '');
            
            // Insert resizer handle if not already present
            if (!th.querySelector('.col-resizer')) {
                const resizer = document.createElement('div');
                resizer.className = 'col-resizer';
                th.appendChild(resizer);

                resizer.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const startX = e.clientX;
                    const startWidth = th.offsetWidth;
                    
                    document.body.style.cursor = 'col-resize';
                    resizer.classList.add('dragging');
                    
                    function onMouseMove(event) {
                        const width = startWidth + (event.clientX - startX);
                        const minWidth = 60; // minimum column width
                        if (width >= minWidth) {
                            th.style.width = width + 'px';
                        }
                    }
                    
                    function onMouseUp() {
                        document.body.style.cursor = '';
                        resizer.classList.remove('dragging');
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        
                        // Save width to cookie
                        const finalWidth = th.offsetWidth;
                        setCookie('colWidth_' + colName, finalWidth);
                    }
                    
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        });
    }

    // Run App!
    initApp();
});
