window.AAIRTerminologyPage = async function ({ request, notice }) {
    const main = document.querySelector('main');
    main.className = 'min-h-[calc(100vh-98px)] bg-surface p-5';
    main.innerHTML = `
      <section class="mx-auto max-w-[1550px]">
        <header class="mb-4 flex items-end justify-between"><div><p class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Knowledge management</p><h1 class="mt-1 text-2xl font-bold">Terminology Base</h1></div><button id="termNew" class="rounded-md bg-primary px-4 py-2 text-xs font-bold text-white"><span class="material-symbols-outlined mr-1 align-middle text-base">add</span>New Term</button></header>
        <div class="grid grid-cols-12 gap-4">
          <section class="col-span-12 overflow-hidden rounded-lg border border-outline-variant bg-white lg:col-span-7">
            <div class="flex items-center gap-3 border-b border-outline-variant p-4"><input id="termSearch" class="min-w-0 flex-1 rounded-md border-outline-variant text-sm" placeholder="Tìm thuật ngữ, viết tắt hoặc từ đồng nghĩa"><select id="termCategoryFilter" class="rounded-md border-outline-variant text-sm"><option value="">Tất cả category</option></select></div>
            <div class="max-h-[590px] overflow-auto"><table class="w-full text-left text-xs"><thead class="sticky top-0 bg-surface-container-low"><tr><th class="px-4 py-3">Financial Term</th><th class="px-4 py-3">Abbreviation</th><th class="px-4 py-3">Category</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Actions</th></tr></thead><tbody id="termRows"></tbody></table></div>
          </section>
          <aside class="col-span-12 rounded-lg border border-outline-variant bg-white lg:col-span-5">
            <div class="border-b border-outline-variant bg-surface-container-low px-5 py-4"><h2 class="font-bold">Term Details</h2><p id="termFormMode" class="mt-1 text-[10px] text-on-surface-variant">Tạo thuật ngữ mới</p></div>
            <form id="termForm" class="grid grid-cols-2 gap-4 p-5">
              <label class="col-span-2 grid gap-1.5 text-xs font-bold">Financial Term<input id="termName" required maxlength="200" class="rounded-md border-outline-variant text-sm"></label>
              <label class="grid gap-1.5 text-xs font-bold">Abbreviation<input id="termAbbreviation" maxlength="100" class="rounded-md border-outline-variant text-sm" placeholder="Có thể để trống"></label>
              <label class="grid gap-1.5 text-xs font-bold">Category<input id="termCategory" maxlength="100" list="termCategories" class="rounded-md border-outline-variant text-sm"><datalist id="termCategories"></datalist></label>
              <label class="col-span-2 grid gap-1.5 text-xs font-bold">Definition<textarea id="termDefinition" required rows="3" maxlength="20000" class="rounded-md border-outline-variant text-sm"></textarea></label>
              <div class="col-span-2"><label class="mb-1.5 block text-xs font-bold">Synonyms</label><div id="termSynonyms" class="tag-editor"><input aria-label="Thêm từ đồng nghĩa" placeholder="Nhập rồi Enter hoặc dấu phẩy"></div></div>
              <div class="col-span-2"><label class="mb-1.5 block text-xs font-bold">Related Terms</label><div id="termRelated" class="tag-editor"><input aria-label="Thêm thuật ngữ liên quan" list="relatedOptions" placeholder="Tìm thuật ngữ rồi Enter"><datalist id="relatedOptions"></datalist></div></div>
              <label class="col-span-2 grid gap-1.5 text-xs font-bold">Example Usage<textarea id="termExample" rows="2" maxlength="5000" class="rounded-md border-outline-variant text-sm"></textarea></label>
              <label class="grid gap-1.5 text-xs font-bold">Status<select id="termStatusEnhanced" class="rounded-md border-outline-variant text-sm"><option>ACTIVE</option><option>INACTIVE</option></select></label>
              <div class="col-span-2 flex justify-end gap-2 border-t border-outline-variant pt-4"><button id="termCancel" type="button" class="rounded-md border border-outline-variant px-4 py-2 text-xs font-bold">Cancel</button><button class="rounded-md bg-primary px-4 py-2 text-xs font-bold text-white">Save Term</button></div>
            </form>
          </aside>
        </div>
        <section class="mt-4 overflow-hidden rounded-lg border border-outline-variant bg-white">
          <header class="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface-container-low px-5 py-4"><div class="mr-auto"><h2 class="font-bold">History</h2><p class="mt-1 text-[10px] text-on-surface-variant">Nhật ký thêm, sửa, xóa · mới nhất trước</p></div><select id="historyUser" class="rounded-md border-outline-variant text-xs"><option value="">Tất cả người dùng</option></select><select id="historyTerm" class="rounded-md border-outline-variant text-xs"><option value="">Tất cả thuật ngữ</option></select></header>
          <div class="max-h-[360px] overflow-auto"><table class="w-full text-left text-xs"><thead class="sticky top-0 bg-white"><tr><th class="px-4 py-3">Thời gian</th><th class="px-4 py-3">Người thực hiện</th><th class="px-4 py-3">Hành động</th><th class="px-4 py-3">Thuật ngữ</th><th class="px-4 py-3">Thay đổi</th></tr></thead><tbody id="historyRows"></tbody></table></div>
        </section>
      </section>`;
    const style = document.createElement('style');
    style.textContent = '.tag-editor{display:flex;min-height:42px;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;border:1px solid #c7d2db;border-radius:6px;background:#fff}.tag-editor:focus-within{border-color:#078bb8;box-shadow:0 0 0 3px #078bb81f}.tag-editor input{min-width:150px;flex:1;border:0!important;padding:4px!important;box-shadow:none!important;font-size:12px}.term-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:4px;background:#e5f3f8;color:#075f7f;font-size:10px;font-weight:700}.term-chip button{border:0;background:transparent;color:inherit;cursor:pointer}.audit-diff{display:grid;gap:4px}.audit-diff div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px}.audit-diff b{color:#526474}.audit-old{text-decoration:line-through;color:#a04d49}.audit-new{color:#147154}';
    document.head.append(style);

    const fields = {
        name: main.querySelector('#termName'), abbreviation: main.querySelector('#termAbbreviation'),
        category: main.querySelector('#termCategory'), definition: main.querySelector('#termDefinition'),
        example: main.querySelector('#termExample'), status: main.querySelector('#termStatusEnhanced')
    };
    const synonyms = createTagEditor(main.querySelector('#termSynonyms'));
    const related = createTagEditor(main.querySelector('#termRelated'), true);
    let terms = [], logs = [], editing = null;

    function createTagEditor(host, relatedMode = false) {
        const input = host.querySelector('input');
        let values = [];
        function draw() {
            host.querySelectorAll('.term-chip').forEach(node => node.remove());
            values.forEach(value => {
                const chip = document.createElement('span'); chip.className = 'term-chip';
                const label = document.createElement('span');
                const row = relatedMode ? terms.find(item => Number(item.id) === Number(value)) : null;
                label.textContent = row ? row.term : String(value);
                const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Xóa ${label.textContent}`);
                remove.addEventListener('click', () => { values = values.filter(item => String(item) !== String(value)); draw(); });
                chip.append(label, remove); host.insertBefore(chip, input);
            });
        }
        function add(raw) {
            const value = raw.trim(); if (!value) return;
            let normalized = value;
            if (relatedMode) {
                const match = terms.find(item => item.term.toLowerCase() === value.toLowerCase());
                if (!match) { notice('Hãy chọn một thuật ngữ có trong hệ thống.', true); return; }
                if (Number(match.id) === Number(editing)) { notice('Không thể liên kết thuật ngữ với chính nó.', true); return; }
                normalized = Number(match.id);
            }
            if (!values.some(item => String(item) === String(normalized))) values.push(normalized);
            input.value = ''; draw();
        }
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(input.value.replace(/,$/, '')); }
            if (event.key === 'Backspace' && !input.value && values.length) { values.pop(); draw(); }
        });
        input.addEventListener('blur', () => { if (input.value.trim()) add(input.value); });
        return { get: () => [...values], set: next => { values = [...(next || [])]; draw(); }, clear: () => { values = []; input.value = ''; draw(); } };
    }

    function reset() {
        editing = null; Object.values(fields).forEach(field => field.value = ''); fields.status.value = 'ACTIVE'; synonyms.clear(); related.clear();
        main.querySelector('#termFormMode').textContent = 'Tạo thuật ngữ mới'; fields.name.focus();
    }
    function edit(row) {
        editing = row.id; fields.name.value = row.term || ''; fields.abbreviation.value = row.abbreviation || ''; fields.category.value = row.category || '';
        fields.definition.value = row.definition || ''; fields.example.value = row.example_usage || ''; fields.status.value = row.status || 'ACTIVE';
        synonyms.set(row.synonyms); related.set(row.related_term_ids); main.querySelector('#termFormMode').textContent = `Đang sửa #${row.id}`; fields.name.focus();
    }
    function renderTerms() {
        const query = main.querySelector('#termSearch').value.trim().toLowerCase();
        const category = main.querySelector('#termCategoryFilter').value;
        const visible = terms.filter(row => (!category || row.category === category) && (!query || [row.term, row.abbreviation, ...(row.synonyms || [])].join(' ').toLowerCase().includes(query)));
        const tbody = main.querySelector('#termRows'); tbody.replaceChildren();
        visible.forEach(row => {
            const tr = document.createElement('tr'); tr.className = 'border-b border-outline-variant/60 hover:bg-surface-container-low/40';
            [row.term, row.abbreviation || '—', row.category || '—', row.status].forEach(value => { const td = document.createElement('td'); td.className = 'px-4 py-3'; td.textContent = value; tr.append(td); });
            const actions = document.createElement('td'); actions.className = 'px-4 py-3 text-right';
            const editButton = iconButton('edit', 'Sửa'); editButton.addEventListener('click', () => edit(row));
            const deleteButton = iconButton('delete', 'Xóa'); deleteButton.addEventListener('click', async () => { if (!confirm(`Xóa thuật ngữ "${row.term}"?`)) return; await request(`/terms/${row.id}`, { method: 'DELETE' }); if (editing === row.id) reset(); await refresh(); notice('Đã xóa thuật ngữ và ghi audit log.'); });
            actions.append(editButton, deleteButton); tr.append(actions); tbody.append(tr);
        });
    }
    function iconButton(icon, label) {
        const button = document.createElement('button'); button.type = 'button'; button.title = label; button.className = 'ml-2 rounded p-1 text-primary hover:bg-surface-container-low';
        const span = document.createElement('span'); span.className = 'material-symbols-outlined text-lg'; span.textContent = icon; button.append(span); return button;
    }
    function valueText(value) {
        if (value == null || value === '') return '—';
        if (Array.isArray(value)) return value.map(item => terms.find(term => Number(term.id) === Number(item))?.term || item).join(', ') || '—';
        return String(value);
    }
    function renderHistory() {
        const actor = main.querySelector('#historyUser').value, termName = main.querySelector('#historyTerm').value;
        const tbody = main.querySelector('#historyRows'); tbody.replaceChildren();
        logs.filter(log => (!actor || String(log.actor_id) === actor) && (!termName || log.term_name === termName)).forEach(log => {
            const tr = document.createElement('tr'); tr.className = 'border-b border-outline-variant/60 align-top';
            const values = [new Date(log.created_at).toLocaleString('vi-VN'), log.username || 'System', log.action, log.term_name];
            values.forEach(value => { const td = document.createElement('td'); td.className = 'px-4 py-3'; td.textContent = value; tr.append(td); });
            const diffCell = document.createElement('td'); diffCell.className = 'px-4 py-3';
            const diff = document.createElement('div'); diff.className = 'audit-diff';
            const oldValues = log.old_values || {}, newValues = log.new_values || {};
            const keys = ['term','definition','category','status','abbreviation','synonyms','related_term_ids','example_usage'];
            keys.filter(key => JSON.stringify(oldValues[key] ?? null) !== JSON.stringify(newValues[key] ?? null)).forEach(key => {
                const line = document.createElement('div'); const name = document.createElement('b'); name.textContent = key;
                const change = document.createElement('span'); const oldNode = document.createElement('span'); oldNode.className = 'audit-old'; oldNode.textContent = valueText(oldValues[key]);
                const arrow = document.createTextNode(' → '); const newNode = document.createElement('span'); newNode.className = 'audit-new'; newNode.textContent = valueText(newValues[key]);
                change.append(oldNode, arrow, newNode); line.append(name, change); diff.append(line);
            });
            if (!diff.children.length) diff.textContent = log.action === 'CREATED' ? 'Tạo bản ghi' : log.action === 'DELETED' ? 'Xóa bản ghi' : 'Không đổi dữ liệu';
            diffCell.append(diff); tr.append(diffCell); tbody.append(tr);
        });
    }
    function rebuildOptions() {
        const categories = [...new Set(terms.map(item => item.category).filter(Boolean))].sort();
        const categoryFilter = main.querySelector('#termCategoryFilter'); const selectedCategory = categoryFilter.value;
        categoryFilter.replaceChildren(new Option('Tất cả category', ''), ...categories.map(value => new Option(value, value))); categoryFilter.value = selectedCategory;
        main.querySelector('#termCategories').replaceChildren(...categories.map(value => { const option = document.createElement('option'); option.value = value; return option; }));
        main.querySelector('#relatedOptions').replaceChildren(...terms.filter(item => Number(item.id) !== Number(editing)).map(item => { const option = document.createElement('option'); option.value = item.term; return option; }));
        const historyTerm = main.querySelector('#historyTerm'); const selectedTerm = historyTerm.value;
        historyTerm.replaceChildren(new Option('Tất cả thuật ngữ', ''), ...[...new Set(logs.map(log => log.term_name))].sort().map(value => new Option(value, value))); historyTerm.value = selectedTerm;
        const historyUser = main.querySelector('#historyUser'); const selectedUser = historyUser.value;
        const actors = [...new Map(logs.filter(log => log.actor_id).map(log => [String(log.actor_id), log.username || `User #${log.actor_id}`])).entries()];
        historyUser.replaceChildren(new Option('Tất cả người dùng', ''), ...actors.map(([id, name]) => new Option(name, id))); historyUser.value = selectedUser;
    }
    async function refresh() {
        [terms, logs] = await Promise.all([request('/terms'), request('/term-audit-logs')]);
        rebuildOptions(); renderTerms(); renderHistory();
    }

    main.querySelector('#termForm').addEventListener('submit', async event => {
        event.preventDefault();
        const json = { term: fields.name.value.trim(), definition: fields.definition.value.trim(), category: fields.category.value.trim(), status: fields.status.value, abbreviation: fields.abbreviation.value.trim() || null, synonyms: synonyms.get(), relatedTermIds: related.get(), exampleUsage: fields.example.value.trim() || null };
        await request(editing ? `/terms/${editing}` : '/terms', { method: editing ? 'PUT' : 'POST', json });
        reset(); await refresh(); notice('Đã lưu thuật ngữ và ghi audit log.');
    });
    main.querySelector('#termCancel').addEventListener('click', reset);
    main.querySelector('#termNew').addEventListener('click', reset);
    main.querySelector('#termSearch').addEventListener('input', renderTerms);
    main.querySelector('#termCategoryFilter').addEventListener('change', renderTerms);
    main.querySelector('#historyUser').addEventListener('change', renderHistory);
    main.querySelector('#historyTerm').addEventListener('change', renderHistory);
    await refresh(); reset();
};
