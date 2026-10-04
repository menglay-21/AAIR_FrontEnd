window.AAIRNavbar = (() => {
  let currentUser = null;
  let host = null;

  const roleLabel = role => role === 'RESULT_ANALYST' ? 'Analyst' : String(role || '')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Analyst';

  function paint(user) {
    if (!host || !user) return;
    currentUser = user;
    const username = user.username || user.email || 'Người dùng';
    host.querySelector('[data-aa-username]').textContent = username;
    host.querySelector('[data-aa-role]').textContent = roleLabel(user.role);
    host.querySelector('[data-aa-avatar]').textContent = username.slice(0, 2).toUpperCase();
  }

  function bind() {
    const page = location.pathname.split('/').pop() || 'Dashboard.html';
    host.querySelectorAll('[data-page]').forEach(link => link.classList.toggle('is-active', link.dataset.page === page));
    const menu = host.querySelector('.aair-navbar__menu');
    menu.addEventListener('click', () => {
      const open = host.classList.toggle('is-menu-open');
      menu.setAttribute('aria-expanded', String(open));
    });
    host.querySelectorAll('.aair-navbar__nav a').forEach(link => link.addEventListener('click', () => host.classList.remove('is-menu-open')));
    host.querySelector('#raLogout').addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn đăng xuất?')) window.AAIR?.logout();
    });
  }

  async function init() {
    const mount = document.querySelector('[data-aair-navbar-mount]');
    if (!mount) return;
    const source = new URL('../HTML/User/ResultAnalysis/navbar.html', document.currentScript?.src || location.href);
    const response = await fetch(source);
    if (!response.ok) throw new Error('Không tải được navbar dùng chung.');
    mount.innerHTML = await response.text();
    host = mount.querySelector('[data-aair-navbar]');
    bind();
    if (currentUser) paint(currentUser);
    window.AAIRGuidelineModal?.init();
    if (!currentUser && window.AAIR?.guard) {
      try { paint(await window.AAIR.guard()); } catch { /* guard handles redirect and API errors */ }
    }
  }

  const ready = init();
  function mount(user) { currentUser = user; return ready.then(() => paint(user)); }
  return { mount, ready, roleLabel };
})();

// Compatibility for workspace.js while it migrates to the shared navbar name.
window.AAIRSharedHeader = { mount: user => window.AAIRNavbar.mount(user) };
