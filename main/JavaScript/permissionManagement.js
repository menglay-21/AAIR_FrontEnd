window.AAIRPermissionsPage = async function ({ request, user, notice }) {
    const main = document.querySelector('main');
    const [roles, users] = await Promise.all([request('/roles'), request('/users')]);
    const manageableUsers = users;
    main.className = 'min-h-[calc(100vh-98px)] bg-surface p-6';
    main.innerHTML = `
      <section class="mx-auto max-w-[1500px]">
        <div class="mb-5 flex items-end justify-between gap-4">
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Security administration</p><h1 class="mt-1 text-2xl font-bold text-on-surface">Permission Management</h1></div>
          <div class="inline-flex rounded-lg border border-outline-variant bg-white p-1" role="tablist">
            <button id="permissionRoleTab" class="rounded-md bg-primary px-4 py-2 text-xs font-bold text-white" role="tab">Theo role</button>
            <button id="permissionUserTab" class="rounded-md px-4 py-2 text-xs font-bold text-on-surface-variant" role="tab">Theo user</button>
          </div>
        </div>
        <div class="grid grid-cols-12 gap-4">
          <aside class="col-span-12 rounded-lg border border-outline-variant bg-white p-4 lg:col-span-3">
            <div id="rolePicker"><label class="mb-2 block text-xs font-bold">Role mặc định</label><select id="permissionRole" class="w-full rounded-md border-outline-variant text-sm"></select></div>
            <div id="userPicker" hidden><label class="mb-2 block text-xs font-bold">Tài khoản</label><select id="permissionUser" class="w-full rounded-md border-outline-variant text-sm"></select><div id="permissionUserMeta" class="mt-3 rounded-md bg-surface-container-low p-3 text-xs"></div></div>
            <div class="mt-5 border-t border-outline-variant pt-4 text-[11px] leading-5 text-on-surface-variant">
              <p><span class="mr-2 inline-block h-2 w-2 rounded-full bg-slate-400"></span>Kế thừa từ role</p>
              <p><span class="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500"></span>Custom permission</p>
              <p class="mt-3">Override theo user được ưu tiên trước quyền role và mọi thay đổi đều được ghi audit log.</p>
            </div>
          </aside>
          <section class="col-span-12 overflow-hidden rounded-lg border border-outline-variant bg-white lg:col-span-9">
            <header class="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-5 py-4">
              <div><h2 id="permissionTitle" class="font-bold">Access Matrix</h2><p id="permissionSubtitle" class="mt-1 text-[10px] text-on-surface-variant"></p></div>
              <button id="permissionSave" class="rounded-md bg-primary px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Lưu thay đổi</button>
            </header>
            <div class="overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr class="border-b border-outline-variant bg-surface-container-low/50"><th class="px-5 py-3 text-left text-[10px] uppercase">System Feature</th><th class="px-3 py-3 text-center text-[10px] uppercase">Read</th><th class="px-3 py-3 text-center text-[10px] uppercase">Write</th><th class="px-3 py-3 text-center text-[10px] uppercase">Execute</th><th class="px-3 py-3 text-center text-[10px] uppercase">Delete</th></tr></thead><tbody id="permissionRows"></tbody></table></div>
          </section>
        </div>
      </section>`;

    const roleTab = main.querySelector('#permissionRoleTab');
    const userTab = main.querySelector('#permissionUserTab');
    const rolePicker = main.querySelector('#rolePicker');
    const userPicker = main.querySelector('#userPicker');
    const roleSelect = main.querySelector('#permissionRole');
    const userSelect = main.querySelector('#permissionUser');
    const rows = main.querySelector('#permissionRows');
    const save = main.querySelector('#permissionSave');
    const title = main.querySelector('#permissionTitle');
    const subtitle = main.querySelector('#permissionSubtitle');
    const meta = main.querySelector('#permissionUserMeta');
    const actions = ['READ', 'WRITE', 'EXECUTE', 'DELETE'];
    let mode = 'role';
    let selectedId = null;
    let changes = new Map();

    roles.forEach(role => roleSelect.add(new Option(role === 'ADMIN' ? 'Administrator' : 'Manager', role)));
    manageableUsers.forEach(item => userSelect.add(new Option(`${item.username} · ${item.role}`, item.id)));

    function setTabs() {
        const userMode = mode === 'user';
        rolePicker.hidden = userMode;
        userPicker.hidden = !userMode;
        roleTab.classList.toggle('bg-primary', !userMode);
        roleTab.classList.toggle('text-white', !userMode);
        userTab.classList.toggle('bg-primary', userMode);
        userTab.classList.toggle('text-white', userMode);
        save.disabled = user.role !== 'ADMIN' || (userMode && Number(selectedId) === Number(user.id));
    }

    function featureCell(label) {
        const td = document.createElement('td');
        td.className = 'px-5 py-4 font-semibold text-on-surface';
        td.textContent = label;
        return td;
    }

    async function loadRole() {
        changes = new Map();
        const data = await request(`/permissions?role=${encodeURIComponent(roleSelect.value)}`);
        title.textContent = `Quyền mặc định: ${data.role}`;
        subtitle.textContent = `${data.enabledPermissions}/${data.totalPermissions} quyền đang bật · ${data.coverage}% coverage`;
        rows.replaceChildren(...data.features.map(feature => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-outline-variant/60';
            tr.append(featureCell(feature.label));
            actions.forEach(action => {
                const td = document.createElement('td');
                td.className = 'px-3 py-4 text-center';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = Boolean(feature.actions[action]);
                input.disabled = user.role !== 'ADMIN';
                input.className = 'h-5 w-5 rounded border-outline-variant text-primary';
                input.setAttribute('aria-label', `${action} ${feature.label}`);
                input.addEventListener('change', () => changes.set(`${feature.key}:${action}`, { feature: feature.key, action, enabled: input.checked }));
                td.append(input); tr.append(td);
            });
            return tr;
        }));
    }

    async function loadUser() {
        selectedId = Number(userSelect.value);
        changes = new Map();
        const data = await request(`/permissions/users/${selectedId}`);
        title.textContent = `Quyền riêng: ${data.user.username}`;
        subtitle.textContent = `${data.customCount} custom permission · quyền hiệu lực = custom trước, role sau`;
        meta.replaceChildren();
        const roleLine = document.createElement('b'); roleLine.textContent = `Role mặc định: ${data.user.role}`;
        const statusLine = document.createElement('p'); statusLine.className = 'mt-1 text-on-surface-variant'; statusLine.textContent = data.user.is_active ? 'Tài khoản đang hoạt động' : 'Tài khoản đã khóa';
        meta.append(roleLine, statusLine);
        rows.replaceChildren(...data.features.map(feature => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-outline-variant/60';
            tr.append(featureCell(feature.label));
            actions.forEach(action => {
                const permission = feature.actions[action];
                const td = document.createElement('td'); td.className = 'px-2 py-3 text-center';
                const select = document.createElement('select');
                select.className = `min-w-[112px] rounded-md border px-2 py-1.5 text-[11px] ${permission.source === 'CUSTOM' ? 'border-amber-500 bg-amber-50 font-bold text-amber-800' : 'border-outline-variant bg-white'}`;
                select.add(new Option(`Kế thừa (${permission.roleEnabled ? 'Cho phép' : 'Từ chối'})`, 'inherit'));
                select.add(new Option('Cho phép riêng', 'allow'));
                select.add(new Option('Từ chối riêng', 'deny'));
                select.value = permission.overrideEnabled == null ? 'inherit' : permission.overrideEnabled ? 'allow' : 'deny';
                select.disabled = user.role !== 'ADMIN' || Number(selectedId) === Number(user.id);
                select.setAttribute('aria-label', `${action} ${feature.label} cho ${data.user.username}`);
                select.addEventListener('change', () => {
                    const enabled = select.value === 'inherit' ? null : select.value === 'allow';
                    changes.set(`${feature.key}:${action}`, { feature: feature.key, action, enabled });
                    select.classList.toggle('border-amber-500', enabled !== null);
                    select.classList.toggle('bg-amber-50', enabled !== null);
                });
                td.append(select); tr.append(td);
            });
            return tr;
        }));
        setTabs();
    }

    roleTab.addEventListener('click', async () => { mode = 'role'; setTabs(); await loadRole(); });
    userTab.addEventListener('click', async () => { mode = 'user'; setTabs(); if (userSelect.value) await loadUser(); });
    roleSelect.addEventListener('change', loadRole);
    userSelect.addEventListener('change', loadUser);
    save.addEventListener('click', async () => {
        const permissions = [...changes.values()];
        if (!permissions.length) { notice('Không có thay đổi permission.'); return; }
        if (mode === 'role') await request(`/permissions/${roleSelect.value}`, { method: 'PUT', json: { permissions } });
        else await request(`/permissions/users/${selectedId}`, { method: 'PUT', json: { permissions } });
        notice('Đã lưu permission và ghi audit log.');
        await (mode === 'role' ? loadRole() : loadUser());
    });
    setTabs();
    await loadRole();
};
