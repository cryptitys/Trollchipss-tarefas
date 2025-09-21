// ==================== CONFIGURAÇÕES E VARIÁVEIS GLOBAIS ====================
let authToken = null;
let loginAttempts = 0;
let currentToken = '';
let notificationCount = 0;
let isSecureConnection = false;
let userSession = null;
let authTimeout = null;
const TOKEN_EXPIRY_HOURS = 6;
const API_BASE_URL = 'https://api.render.com/deploy/srv-d37ihkjuibrs7393hacg?key=gcJRRvgq5OY';

// ==================== CLASSES DE ERRO ====================
class BackendRequiredError extends Error {
    constructor(message) {
        super(message);
        this.name = "BackendRequiredError";
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthenticationError";
    }
}

class TokenExpiredError extends Error {
    constructor(message) {
        super(message);
        this.name = "TokenExpiredError";
    }
}

// ==================== FUNÇÕES UTILITÁRIAS ====================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateHash(data, salt) {
    const timestamp = Date.now().toString();
    const inputString = data + timestamp + salt + window.location.hostname;
    let hash = 0;
    
    for (let i = 0; i < inputString.length; i++) {
        const char = inputString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    return btoa(Math.abs(hash).toString()).substring(0, 16);
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 8;
}

// ==================== MANIPULAÇÃO DE DOM ====================
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
    }
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function addLoadingClass(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('loading');
    }
}

function removeLoadingClass(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
    }
}

// ==================== GESTÃO DE TOKENS ====================
function getCachedToken(username, tokenType) {
    try {
        const cacheKey = `${API_BASE_URL}_${tokenType}_${username}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (!cachedData) {
            return null;
        }

        const tokenData = JSON.parse(cachedData);
        const isExpired = isTokenExpired(tokenData.timestamp);
        
        if (isExpired) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        return tokenData.value;
    } catch (error) {
        console.error('Error reading cached token:', error);
        return null;
    }
}

function cacheToken(username, tokenType, tokenValue) {
    try {
        const cacheKey = `${API_BASE_URL}_${tokenType}_${username}`;
        const tokenData = {
            timestamp: Date.now(),
            value: tokenValue
        };
        localStorage.setItem(cacheKey, JSON.stringify(tokenData));
    } catch (error) {
        console.error('Error caching token:', error);
    }
}

function isTokenExpired(timestamp) {
    const currentTime = Date.now();
    const expiryTime = timestamp + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    return currentTime > expiryTime;
}

function clearExpiredTokens() {
    try {
        const keys = Object.keys(localStorage);
        const expiredKeys = keys.filter(key => key.startsWith(API_BASE_URL));
        
        expiredKeys.forEach(key => {
            try {
                const data = localStorage.getItem(key);
                if (data) {
                    const tokenData = JSON.parse(data);
                    if (isTokenExpired(tokenData.timestamp)) {
                        localStorage.removeItem(key);
                    }
                }
            } catch (error) {
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.error('Error clearing expired tokens:', error);
    }
}
// ==================== COMUNICAÇÃO COM API ====================
async function apiRequest(endpoint, options = {}, maxRetries = 3, retryDelay = 1000) {
    let url = endpoint;
    
    if (isSecureConnection && endpoint.startsWith('/')) {
        url = `${API_BASE_URL}${endpoint}`;
    }

    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            if (isSecureConnection) {
                const timestamp = Date.now();
                options.headers = {
                    ...options.headers,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': window.location.origin,
                    'Timestamp': timestamp,
                    'Signature': generateHash(endpoint, 'api_request'),
                    'X-Request-ID': Math.random().toString(36).substring(2)
                };
            }

            options.credentials = 'include';
            
            const response = await fetch(url, options);
            
            if (response.status === 401 && !options.isRetry && authToken) {
                try {
                    const newToken = await refreshAuthToken(authToken);
                    if (options.headers) {
                        options.headers.Authorization = `Bearer ${newToken}`;
                    }
                    return await apiRequest(endpoint, { ...options, isRetry: true }, maxRetries, retryDelay);
                } catch (refreshError) {
                    showNotification('Sessão expirada. Por favor, faça login novamente.', 5000);
                    clearUserSession();
                    return response;
                }
            }
            
            if (!response.ok) {
                let errorData = '';
                try {
                    errorData = await response.text();
                } catch (e) {}
                
                if (response.status === 403 || response.status === 401) {
                    throw new AuthenticationError('Access denied');
                } else if (response.status >= 500) {
                    throw new Error('Server error');
                } else {
                    throw new Error(`HTTP error: ${response.status}`);
                }
            }
            
            return response;
            
        } catch (error) {
            attempt++;
            if (attempt === maxRetries) {
                showNotification(`Falha na conexão com: ${url.substring(0, 30)}... Tentativas: ${maxRetries}`, 15000);
                
                if (!isSecureConnection && endpoint.startsWith('/')) {
                    isSecureConnection = true;
                    return await apiRequest(endpoint, options, maxRetries, retryDelay);
                }
                throw error;
            }
            
            await delay(retryDelay);
        }
    }
}

async function authenticateUser(username, password, rememberMe = false, isAutoLogin = false) {
    if (!username || !password) {
        showNotification('Por favor, preencha todos os campos', 3000);
        return;
    }

    username = username.trim().toLowerCase();
    password = password.trim();

    if (username.length < 3) {
        showNotification('Username deve ter pelo menos 3 caracteres', 3000);
        return;
    }

    const submitButton = document.querySelector('#btn-submit');
    if (submitButton) {
        submitButton.disabled = true;
    }

    showLoading('Verificando credenciais...');

    try {
        clearExpiredTokens();

        let authData = getCachedToken(username, 'auth');
        let sessionToken;

        if (!authData) {
            const response = await apiRequest('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (errorText.includes('invalid_credentials') || errorText.includes('Invalid credentials')) {
                    throw new AuthenticationError('Credenciais inválidas');
                }
                throw new Error('Authentication failed');
            }

            authData = await response.json();
            sessionToken = authData.session_token;

            const verifyResponse = await apiRequest('/auth/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                    'X-Client-Version': '1.0.0',
                    'X-Device-Id': 'web-browser'
                },
                body: JSON.stringify({
                    session_token: sessionToken
                })
            });

            if (!verifyResponse.ok) {
                throw new Error('Token verification failed');
            }

            const verificationData = await verifyResponse.json();
            const accessToken = verificationData.access_token;

            cacheToken(username, 'auth', authData);
            cacheToken(username, 'session', { session_token: sessionToken });
            cacheToken(username, 'access', { access_token: accessToken });

            authToken = accessToken;
        }

        const userProfile = await getUserProfile(username, authToken);
        
        if (!userProfile || !userProfile.roles || userProfile.roles.length === 0) {
            throw new Error('Perfil de usuário inválido');
        }

        const validRoles = userProfile.roles.filter(role => 
            role.name && (role.name.includes('user') || role.name.includes('admin') || role.name.includes('subscriber'))
        );

        if (validRoles.length === 0) {
            showNotification('Conta não possui permissões necessárias', 5000);
            return;
        }

        const highestRole = validRoles.reduce((max, role) => 
            (role.priority || 0) > (max.priority || 0) ? role : max, validRoles[0]
        );

        userSession = {
            username: username,
            token: authToken,
            sessionToken: sessionToken,
            profile: userProfile,
            role: highestRole.name,
            permissions: highestRole.permissions || [],
            loginTime: Date.now(),
            rememberMe: rememberMe
        };

        window.userAuthSystem = userSession;
        localStorage.setItem('user_session', JSON.stringify(userSession));

        showNotification('Login realizado com sucesso!', 2000);
        
        setTimeout(() => {
            hideLoading();
            redirectToDashboard();
        }, 2000);

    } catch (error) {
        hideLoading();
        
        if (submitButton) {
            submitButton.disabled = false;
        }

        if (error instanceof AuthenticationError) {
            showNotification('Credenciais inválidas. Tente novamente.', 3000);
            loginAttempts++;
            
            if (loginAttempts >= 3) {
                showNotification('Muitas tentativas falhas. Tente novamente em 5 minutos.', 5000);
                const submitButton = document.querySelector('#btn-submit');
                if (submitButton) {
                    submitButton.disabled = true;
                    setTimeout(() => {
                        submitButton.disabled = false;
                        loginAttempts = 0;
                    }, 300000);
                }
            }
        } else if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
            showNotification('Erro de conexão. Verifique sua internet.', 5000);
        } else {
            showNotification('Erro durante o login. Tente novamente.', 3000);
        }
        
        console.error('Login error:', error);
    }
    }
// ==================== FUNÇÕES DE USUÁRIO E PERFIL ====================
async function getUserProfile(username, token) {
    try {
        const cachedProfile = getCachedToken(username, 'profile');
        if (cachedProfile) {
            return cachedProfile;
        }

        const response = await apiRequest('/user/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-User-Id': username
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const profileData = await response.json();
        cacheToken(username, 'profile', profileData);
        
        return profileData;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
}

async function refreshAuthToken(oldToken) {
    try {
        const response = await apiRequest('/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${oldToken}`
            },
            body: JSON.stringify({ token: oldToken })
        });

        if (!response.ok) {
            throw new TokenExpiredError('Token refresh failed');
        }

        const data = await response.json();
        const newToken = data.access_token;
        
        if (userSession) {
            userSession.token = newToken;
            localStorage.setItem('user_session', JSON.stringify(userSession));
        }
        
        authToken = newToken;
        return newToken;
    } catch (error) {
        console.error('Token refresh error:', error);
        throw error;
    }
}

// ==================== NOTIFICAÇÕES E UI ====================
function showNotification(message, duration = 3000) {
    const notificationContainer = document.getElementById('notification-container') || createNotificationContainer();
    
    const notificationId = 'notification-' + Date.now();
    const notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="closeNotification('${notificationId}')">×</button>
        </div>
    `;

    notificationContainer.appendChild(notification);
    notificationCount++;

    setTimeout(() => {
        closeNotification(notificationId);
    }, duration);

    return notificationId;
}

function closeNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
            notificationCount--;
        }, 300);
    }
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 350px;
    `;
    document.body.appendChild(container);
    return container;
}

function showLoading(message = 'Carregando...') {
    const loadingModal = document.getElementById('loading-modal') || createLoadingModal();
    const messageElement = loadingModal.querySelector('.loading-message');
    
    if (messageElement) {
        messageElement.textContent = message;
    }
    
    loadingModal.style.display = 'flex';
    setTimeout(() => {
        loadingModal.style.opacity = '1';
    }, 10);
}

function hideLoading() {
    const loadingModal = document.getElementById('loading-modal');
    if (loadingModal) {
        loadingModal.style.opacity = '0';
        setTimeout(() => {
            loadingModal.style.display = 'none';
        }, 300);
    }
}

function createLoadingModal() {
    const modal = document.createElement('div');
    modal.id = 'loading-modal';
    modal.className = 'loading-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    modal.innerHTML = `
        <div class="loading-content" style="
            background: white;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            min-width: 200px;
        ">
            <div class="loading-spinner" style="
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            "></div>
            <p class="loading-message" style="margin: 0; color: #333;">Carregando...</p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    document.body.appendChild(modal);
    return modal;
}

// ==================== GESTÃO DE SESSÃO ====================
function clearUserSession() {
    userSession = null;
    authToken = null;
    localStorage.removeItem('user_session');
    sessionStorage.clear();
    
    if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
    }
}

function redirectToDashboard() {
    window.location.href = '/dashboard';
}

function logout() {
    clearUserSession();
    showNotification('Logout realizado com sucesso', 2000);
    setTimeout(() => {
        window.location.href = '/login';
    }, 2000);
}

// ==================== INICIALIZAÇÃO ====================
function initializeAuthSystem() {
    clearExpiredTokens();
    
    const savedSession = localStorage.getItem('user_session');
    if (savedSession) {
        try {
            userSession = JSON.parse(savedSession);
            authToken = userSession.token;
            
            if (isTokenExpired(userSession.loginTime)) {
                clearUserSession();
            } else {
                const timeUntilExpiry = (userSession.loginTime + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)) - Date.now();
                authTimeout = setTimeout(() => {
                    showNotification('Sessão expirada. Faça login novamente.', 5000);
                    clearUserSession();
                }, timeUntilExpiry);
            }
        } catch (error) {
            clearUserSession();
        }
    }

    window.addEventListener('beforeunload', () => {
        if (authTimeout) {
            clearTimeout(authTimeout);
        }
    });
}

// ==================== EXPORTAÇÕES (se usando módulos) ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        authenticateUser,
        logout,
        getUserProfile,
        showNotification,
        initializeAuthSystem,
        BackendRequiredError,
        AuthenticationError,
        TokenExpiredError
    };
}

// Inicializar o sistema quando o documento estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthSystem);
} else {
    initializeAuthSystem();
}
