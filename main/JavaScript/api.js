/* Shared API client for the original HTML screens. */
window.AAIR = (() => {
    const base = (window.AAIR_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');
    const homes = {
        ADMIN: 'Admin', MANAGER: 'Manager', AI_LABELER: 'User/AILabeling',
        MANUAL_LABELER: 'User/ManualLabeling', REVIEWER: 'User/ManualReview',
        RESULT_ANALYST: 'User/ResultAnalysis', TERMINOLOGY: 'User/Terminology',
    };
    const loginPath = '/main/HTML/Home/signIn.html';
    function accessToken() {
        const token = sessionStorage.getItem('aair_access_token') || localStorage.getItem('aair_access_token');
        if (token && !sessionStorage.getItem('aair_access_token')) sessionStorage.setItem('aair_access_token', token);
        return token;
    }
    function saveSession(token) {
        // Replace any stale session before storing the newly issued token.
        sessionStorage.removeItem('aair_access_token');
        sessionStorage.removeItem('aair_user');
        localStorage.removeItem('aair_access_token');
        localStorage.removeItem('aair_user');
        sessionStorage.setItem('aair_access_token', token);
        localStorage.setItem('aair_access_token', token);
    }
    function logout() {
        sessionStorage.removeItem('aair_access_token');
        sessionStorage.removeItem('aair_user');
        localStorage.removeItem('aair_access_token');
        localStorage.removeItem('aair_user');
        location.assign(loginPath);
    }
    function clearSession() {
        sessionStorage.removeItem('aair_access_token');
        sessionStorage.removeItem('aair_user');
        localStorage.removeItem('aair_access_token');
        localStorage.removeItem('aair_user');
    }
    async function request(path, options = {}) {
        const { json, blob, ...init } = options;
        const token = accessToken();
        const headers = new Headers(init.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (json !== undefined) {
            headers.set('Content-Type', 'application/json');
            init.body = JSON.stringify(json);
        }
        let response;
        try { response = await fetch(base + path, { ...init, headers }); }
        catch { throw new Error('Không kết nối được máy chủ API. Hãy kiểm tra backend và kết nối mạng.'); }
        if (response.ok && blob) return response.blob();
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.success === false) {
            // A secondary request (for example a PDF download) must not destroy an
            // otherwise valid session. The guard's /auth/me call is authoritative.
            // Any expired/missing token means the current page is no longer
            // usable. Return to login instead of leaving a static shell visible.
            if (response.status === 401 && path !== '/auth/login') logout();
            const error = new Error(body?.message || `Yêu cầu thất bại (${response.status}).`);
            error.status = response.status;
            throw error;
        }
        return body?.data;
    }
    function home(role) {
        if (!homes[role]) throw new Error('Vai trò tài khoản không được hỗ trợ.');
        return `/main/HTML/${homes[role]}/Dashboard.html`;
    }
    async function guard() {
        if (!accessToken()) { location.replace(loginPath); return null; }
        const user = await request('/auth/me');
        const directory = `/main/HTML/${homes[user.role]}/`;
        if (!location.pathname.startsWith(directory)) { location.replace(home(user.role)); return null; }
        return user;
    }
    return { request, home, homes, guard, logout, clearSession, saveSession };
})();
