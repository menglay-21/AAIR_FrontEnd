function togglePassword() {
    const passwordInput = document.getElementById('password');
    const passwordIcon = document.getElementById('passwordIcon');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        passwordIcon.innerText = 'visibility_off';
    } else {
        passwordInput.type = 'password';
        passwordIcon.innerText = 'visibility';
    }
}

// Ripple Effect Implementation
document.querySelectorAll('.ripple-effect').forEach(button => {
    button.addEventListener('click', function (e) {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        this.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Authenticate the existing sign-in form against Spring Boot.
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]" data-icon="sync">sync</span> Authenticating...`;
    btn.classList.add('opacity-80');

    let error = document.getElementById('loginError');
    if (!error) {
        error = document.createElement('p');
        error.id = 'loginError';
        error.className = 'text-sm text-red-600';
        error.setAttribute('role', 'alert');
        btn.before(error);
    }
    error.textContent = '';
    try {
        // A fresh login must never inherit an expired token from an older tab.
        AAIR.clearSession();
        const result = await AAIR.request('/auth/login', { method: 'POST', json: {
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value,
        } });
        const requestedPath = new URLSearchParams(location.search).get('returnTo');
        const sameOriginPath = requestedPath && requestedPath.startsWith('/main/HTML/')
            ? requestedPath
            : null;
        const destination = sameOriginPath || AAIR.home(result.user.role);
        AAIR.saveSession(result.accessToken, result.user);
        location.assign(destination);
    } catch (reason) {
        error.textContent = reason.message;
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        btn.classList.remove('opacity-80');
    }
});
