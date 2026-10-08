window.AAIRNavbar = (() => {
  let currentUser = null;
  let host = null;
  const defaultConfig = {
    brandHref: 'Dashboard.html',
    tabs: [
      { label: 'Dashboard', icon: 'dashboard', href: 'Dashboard.html' },
      { label: 'View ALL', icon: 'list_alt', href: 'ViewAll.html' },
      { label: 'Analyst', icon: 'analytics', href: 'Task.html' },
    ],
  };

  function pageConfig() {
    const config = window.AAIRNavbarConfig || {};
    return { ...defaultConfig, ...config, tabs: config.tabs || defaultConfig.tabs };
  }

  const roleLabel = role => role === 'RESULT_ANALYST' ? 'Analyst' : String(role || '')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Analyst';

  function paint(user) {
    if (!host || !user) return;
    currentUser = user;
    const username = user.username || user.email || 'User';
    host.querySelector('[data-aa-username]').textContent = username;
    host.querySelector('[data-aa-role]').textContent = roleLabel(user.role);
    host.querySelector('[data-aa-avatar]').textContent = username.slice(0, 2).toUpperCase();
  }

  function applyConfig() {
    const config = pageConfig();
    const brand = host.querySelector('.aair-navbar__brand');
    if (brand) {
      brand.href = config.brandHref || defaultConfig.brandHref;
      const brandName = brand.querySelector('strong');
      if (brandName && config.brandName) brandName.textContent = config.brandName;
    }
    const nav = host.querySelector('.aair-navbar__nav');
    if (!nav) return;
    nav.replaceChildren(...config.tabs.map(tab => {
      const link = document.createElement('a');
      link.href = tab.href;
      link.dataset.page = tab.page || tab.href.split('/').pop();
      const label = document.createElement('span');
      label.textContent = tab.label;
      link.append(label);
      return link;
    }));
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
      if (confirm('Are you sure you want to log out?')) window.AAIR?.logout();
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
    applyConfig();
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
