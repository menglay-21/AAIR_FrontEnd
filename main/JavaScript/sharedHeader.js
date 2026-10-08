window.AAIRSharedHeader = (() => {
  function mount(user) {
    const username = user?.username || '—';
    const role = user?.role === 'RESULT_ANALYST' ? 'Analyst' : (user?.role || '—');
    const name = document.querySelector('#raUsername, [data-aa-username]');
    const roleNode = document.querySelector('#raRole, [data-aa-role]');
    const avatar = document.querySelector('#raAvatar, [data-aa-avatar]');
    if (name) name.textContent = username;
    if (roleNode) roleNode.textContent = role;
    if (avatar) avatar.textContent = username.slice(0, 2).toUpperCase();
    const account = document.querySelector('.ra-account, .aa-account');
    if (account && !account.querySelector('[data-guideline-trigger]')) window.AAIRGuidelineModal?.init();
  }
  return { mount };
})();
