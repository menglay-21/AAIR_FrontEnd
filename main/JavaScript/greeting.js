(function () {
  'use strict';
  function getGreeting(date) {
    const value = date instanceof Date ? date : new Date(date);
    const hour = value.getHours();
    const minute = value.getMinutes();
    if (hour === 0 && minute === 0) return 'Good Evening,';
    if (hour < 12 || (hour === 12 && minute === 0)) return 'Good Morning,';
    if (hour < 18 || (hour === 18 && minute === 0)) return 'Good Afternoon,';
    return 'Good Evening,';
  }
  function init() {
    const node = document.querySelector('[data-greeting]');
    if (!node) return;
    let user = null;
    try { user = JSON.parse(sessionStorage.getItem('aair_user') || localStorage.getItem('aair_user') || 'null'); } catch {}
    const name = user?.displayName || user?.display_name || user?.username || '';
    const render = () => { node.textContent = `${getGreeting(new Date())}${name ? ` ${name}` : ''}`; };
    render();
    window.setInterval(render, 60 * 1000);
  }
  window.AAIRGreeting = { getGreeting, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
