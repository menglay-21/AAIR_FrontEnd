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

// Form Submit Simulation
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]" data-icon="sync">sync</span> Authenticating...`;
    btn.classList.add('opacity-80');

    setTimeout(() => {
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]" data-icon="check_circle">check_circle</span> Success`;
        btn.classList.remove('custom-gradient-btn');
        btn.style.backgroundColor = '#10b981'; // Emerald 500 for success

        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            btn.classList.add('custom-gradient-btn');
            btn.style.backgroundColor = '';
            btn.classList.remove('opacity-80');
        }, 2000);
    }, 1500);
});