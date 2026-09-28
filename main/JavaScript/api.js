/* Shared API client for the original HTML screens. */
window.AAIR = (() => {
    const base = (window.AAIR_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');
    const homes = {
        ADMIN: 'Admin', MANAGER: 'Manager', AI_LABELER: 'User/AILabeling',
        MANUAL_LABELER: 'User/ManualLabeling', REVIEWER: 'User/ManualReview',
        RESULT_ANALYST: 'User/ResultAnalysis', TERMINOLOGY: 'User/Terminology',
    };
    const loginPath = '/main/HTML/Home/signIn.html';
    function loginUrl() {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        return `${loginPath}?returnTo=${encodeURIComponent(returnTo)}`;
    }
    function accessToken() {
        const token = sessionStorage.getItem('aair_access_token')
            || localStorage.getItem('aair_access_token')
            || (window.name.startsWith('aair_access_token=') ? window.name.slice('aair_access_token='.length) : '');
        if (token && !sessionStorage.getItem('aair_access_token')) sessionStorage.setItem('aair_access_token', token);
        return token;
    }
    function saveSession(token, user) {
        // Replace any stale session before storing the newly issued token.
        sessionStorage.removeItem('aair_access_token');
        sessionStorage.removeItem('aair_user');
        localStorage.removeItem('aair_access_token');
        localStorage.removeItem('aair_user');
        sessionStorage.setItem('aair_access_token', token);
        localStorage.setItem('aair_access_token', token);
        if (user) {
            const serializedUser = JSON.stringify(user);
            sessionStorage.setItem('aair_user', serializedUser);
            localStorage.setItem('aair_user', serializedUser);
        }
        window.name = `aair_access_token=${token}`;
    }
    function logout() {
        sessionStorage.removeItem('aair_access_token');
        sessionStorage.removeItem('aair_user');
        localStorage.removeItem('aair_access_token');
        localStorage.removeItem('aair_user');
        if (window.name.startsWith('aair_access_token=')) window.name = '';
        location.assign(loginPath);
    }
    function clearSession() {
        sessionStorage.removeItem('aair_access_token');
        sessionStorage.removeItem('aair_user');
        localStorage.removeItem('aair_access_token');
        localStorage.removeItem('aair_user');
        if (window.name.startsWith('aair_access_token=')) window.name = '';
    }
    async function firstValidToken(tokens) {
        for (const token of tokens) {
            const headers = new Headers({ Authorization: `Bearer ${token}` });
            try {
                const response = await fetch(base + '/auth/me', { headers });
                if (response.ok) return token;
            } catch {
                return null;
            }
        }
        return null;
    }
    async function request(path, options = {}) {
        const { json, blob, suppressAuthRedirect, ...init } = options;
        const sessionToken = sessionStorage.getItem('aair_access_token');
        const storedToken = localStorage.getItem('aair_access_token');
        const windowToken = window.name.startsWith('aair_access_token=') ? window.name.slice('aair_access_token='.length) : '';
        const tokens = [...new Set([sessionToken, storedToken, windowToken].filter(Boolean))];
        if (!tokens.length && path !== '/auth/login') {
            location.replace(loginUrl());
            throw new Error('Phiên đăng nhập không tồn tại.');
        }
        let lastResponse;
        let lastBody;
        for (const token of tokens.length ? tokens : [null]) {
            const requestInit = { ...init };
            const headers = new Headers(requestInit.headers);
            if (token) headers.set('Authorization', `Bearer ${token}`);
            if (json !== undefined) {
                headers.set('Content-Type', 'application/json');
                requestInit.body = JSON.stringify(json);
            }
            try { lastResponse = await fetch(base + path, { ...requestInit, headers }); }
            catch { throw new Error('Không kết nối được máy chủ API. Hãy kiểm tra backend và kết nối mạng.'); }
            if (lastResponse.ok) {
                if (token && token !== sessionToken) sessionStorage.setItem('aair_access_token', token);
                if (blob) return lastResponse.blob();
                const body = await lastResponse.json().catch(() => null);
                return body?.data;
            }
            lastBody = await lastResponse.json().catch(() => null);
            if (lastResponse.status !== 401) break;
        }
        if (lastResponse?.status === 401 && path !== '/auth/login' && !suppressAuthRedirect) {
            // A provider-backed operation can fail with 401 even while the AAIR
            // JWT remains valid. Only destroy the browser session after the
            // authoritative identity endpoint rejects every stored token.
            const validToken = path === '/auth/me' ? null : await firstValidToken(tokens);
            if (validToken) {
                sessionStorage.setItem('aair_access_token', validToken);
            } else {
                clearSession();
                location.replace(loginUrl());
            }
        }
        const error = new Error(lastBody?.message || `Yêu cầu thất bại (${lastResponse?.status || 0}).`);
        error.status = lastResponse?.status;
        throw error;
    }
    function home(role) {
        if (!homes[role]) throw new Error('Vai trò tài khoản không được hỗ trợ.');
        return `/main/HTML/${homes[role]}/Dashboard.html`;
    }
    function assetUrl(path) {
        if (!path) return '';
        if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
        const apiUrl = new URL(base, location.href);
        return `${apiUrl.origin}${path.startsWith('/') ? path : `/${path}`}`;
    }
    function cachedUserForCurrentTask() {
        if (!location.pathname.endsWith('/Task.html')) return null;
        try {
            const cached = JSON.parse(sessionStorage.getItem('aair_user') || localStorage.getItem('aair_user') || 'null');
            const directory = cached && homes[cached.role] ? `/main/HTML/${homes[cached.role]}/` : '';
            return directory && location.pathname.startsWith(directory) ? cached : null;
        } catch { return null; }
    }
    async function guard() {
        const token = accessToken();
        if (!token) { location.replace(loginUrl()); return null; }
        // Task workspaces are separate legacy HTML documents. Reuse the role
        // established at login so navigation does not depend on an extra
        // /auth/me round trip; every task/data API still validates the JWT.
        const cached = cachedUserForCurrentTask();
        if (cached) return cached;
        const user = await request('/auth/me');
        const directory = `/main/HTML/${homes[user.role]}/`;
        if (!location.pathname.startsWith(directory)) { location.replace(home(user.role)); return null; }
        return user;
    }
    return { request, assetUrl, home, homes, guard, logout, clearSession, saveSession };
})();
