window.AAIRTerminologyPage = async function ({ request, notice }) {
    const main = document.querySelector('main');
    const termSearch = document.querySelector('#termSearch');
    const termCategoryFilter = document.querySelector('#termCategoryFilter');
    const fields = {
        name: main.querySelector('#termName'),
        abbreviation: main.querySelector('#termAbbreviation'),
        category: main.querySelector('#termCategory'),
        definition: main.querySelector('#termDefinition'),
        example: main.querySelector('#termExample'),
        status: main.querySelector('#termStatusEnhanced')
    };
    const synonyms = createTagEditor(main.querySelector('#termSynonyms'));
    const related = createTagEditor(main.querySelector('#termRelated'), true);
    let terms = [];
    let logs = [];
    let editing = null;

    function createTagEditor(host, relatedMode = false) {
        const input = host.querySelector('input');
        let values = [];

        function draw() {
            host.querySelectorAll('.term-chip').forEach(node => node.remove());
            values.forEach(value => {
                const chip = document.createElement('span');
                chip.className = 'term-chip';
                const label = document.createElement('span');
                const row = relatedMode ? terms.find(item => Number(item.id) === Number(value)) : null;
                label.textContent = row ? row.term : String(value);
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = '×';
                remove.setAttribute('aria-label', `Xóa ${label.textContent}`);
                remove.addEventListener('click', () => {
                    values = values.filter(item => String(item) !== String(value));
                    draw();
                });
                chip.append(label, remove);
                host.insertBefore(chip, input);
            });
        }

        function add(raw) {
            const value = raw.trim();
            if (!value) return;

            let normalized = value;
            if (relatedMode) {
                const match = terms.find(item => item.term.toLowerCase() === value.toLowerCase());
                if (!match) {
                    notice('Hãy chọn một thuật ngữ có trong hệ thống.', true);
                    return;
                }
                if (Number(match.id) === Number(editing)) {
                    notice('Không thể liên kết thuật ngữ với chính nó.', true);
                    return;
                }
                normalized = Number(match.id);
            }

            if (!values.some(item => String(item) === String(normalized))) {
                values.push(normalized);
            }
            input.value = '';
            draw();
        }

        input.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                add(input.value.replace(/,$/, ''));
            }
            if (event.key === 'Backspace' && !input.value && values.length) {
                values.pop();
                draw();
            }
        });
        input.addEventListener('blur', () => {
            if (input.value.trim()) add(input.value);
        });

        return {
            get: () => [...values],
            set: next => {
                values = [...(next || [])];
                draw();
            },
            clear: () => {
                values = [];
                input.value = '';
                draw();
            }
        };
    }

    function reset() {
        editing = null;
        Object.values(fields).forEach(field => field.value = '');
        fields.status.value = 'ACTIVE';
        synonyms.clear();
        related.clear();
        main.querySelector('#termFormMode').textContent = 'Tạo thuật ngữ mới'; fields.name.focus();
    }

    function edit(row) {
        editing = row.id;
        fields.name.value = row.term || '';
        fields.abbreviation.value = row.abbreviation || '';
        fields.category.value = row.category || '';
        fields.definition.value = row.definition || '';
        fields.example.value = row.example_usage || '';
        fields.status.value = row.status || 'ACTIVE';
        synonyms.set(row.synonyms);
        related.set(row.related_term_ids);
        main.querySelector('#termFormMode').textContent = `Đang sửa #${row.id}`;
        fields.name.focus();
    }

    function renderTerms() {
        const query = termSearch.value.trim().toLowerCase();
        const category = termCategoryFilter.value;
        const visible = terms.filter(row => {
            const matchesCategory = !category || row.category === category;
            const searchableText = [row.term, row.abbreviation, ...(row.synonyms || [])]
                .join(' ')
                .toLowerCase();
            const matchesSearch = !query || searchableText.includes(query);
            return matchesCategory && matchesSearch;
        });
        const tbody = main.querySelector('#termRows');
        tbody.replaceChildren();

        visible.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-outline-variant/60 hover:bg-surface-container-low/40';

            [row.term, row.abbreviation || '—', row.category || '—', row.status].forEach(value => {
                const td = document.createElement('td');
                td.className = 'px-4 py-3';
                td.textContent = value;
                tr.append(td);
            });

            const actions = document.createElement('td');
            actions.className = 'px-4 py-3 text-right';

            const editButton = iconButton('edit', 'Sửa');
            editButton.addEventListener('click', () => edit(row));

            const deleteButton = iconButton('delete', 'Xóa');
            deleteButton.addEventListener('click', async () => {
                if (!confirm(`Xóa thuật ngữ "${row.term}"?`)) return;
                await request(`/terms/${row.id}`, { method: 'DELETE' });
                if (editing === row.id) reset();
                await refresh();
                notice('Đã xóa thuật ngữ và ghi audit log.');
            });

            actions.append(editButton, deleteButton);
            tr.append(actions);
            tbody.append(tr);
        });
    }

    function iconButton(icon, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.className = 'ml-2 rounded p-1 text-primary hover:bg-surface-container-low';

        const span = document.createElement('span');
        span.className = 'material-symbols-outlined text-lg';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = icon;
        button.append(span);
        return button;
    }

    function valueText(value) {
        if (value == null || value === '') return '—';
        if (Array.isArray(value)) {
            return value
                .map(item => terms.find(term => Number(term.id) === Number(item))?.term || item)
                .join(', ') || '—';
        }
        return String(value);
    }

    function renderHistory() {
        const actor = main.querySelector('#historyUser').value;
        const termName = main.querySelector('#historyTerm').value;
        const tbody = main.querySelector('#historyRows');
        tbody.replaceChildren();

        logs.filter(log => (!actor || String(log.actor_id) === actor) && (!termName || log.term_name === termName)).forEach(log => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-outline-variant/60 align-top';
            const values = [new Date(log.created_at).toLocaleString('vi-VN'), log.username || 'System', log.action, log.term_name];
            values.forEach(value => {
                const td = document.createElement('td');
                td.className = 'px-4 py-3';
                td.textContent = value;
                tr.append(td);
            });

            const diffCell = document.createElement('td');
            diffCell.className = 'px-4 py-3';
            const diff = document.createElement('div');
            diff.className = 'audit-diff';
            const oldValues = log.old_values || {}, newValues = log.new_values || {};
            const keys = ['term', 'definition', 'category', 'status', 'abbreviation', 'synonyms', 'related_term_ids', 'example_usage'];
            keys.filter(key => JSON.stringify(oldValues[key] ?? null) !== JSON.stringify(newValues[key] ?? null)).forEach(key => {
                const line = document.createElement('div');
                const name = document.createElement('b');
                name.textContent = key;

                const change = document.createElement('span');
                const oldNode = document.createElement('span');
                oldNode.className = 'audit-old';
                oldNode.textContent = valueText(oldValues[key]);

                const arrow = document.createTextNode(' → ');
                const newNode = document.createElement('span');
                newNode.className = 'audit-new';
                newNode.textContent = valueText(newValues[key]);

                change.append(oldNode, arrow, newNode);
                line.append(name, change);
                diff.append(line);
            });

            if (!diff.children.length) {
                diff.textContent = log.action === 'CREATED'
                    ? 'Tạo bản ghi'
                    : log.action === 'DELETED'
                        ? 'Xóa bản ghi'
                        : 'Không đổi dữ liệu';
            }
            diffCell.append(diff);
            tr.append(diffCell);
            tbody.append(tr);
        });
    }

    function rebuildOptions() {
        const categories = [...new Set(terms.map(item => item.category).filter(Boolean))].sort();
        const selectedCategory = termCategoryFilter.value;
        termCategoryFilter.replaceChildren(
            new Option('Tất cả category', ''),
            ...categories.map(value => new Option(value, value))
        );
        termCategoryFilter.value = selectedCategory;

        main.querySelector('#termCategories').replaceChildren(
            ...categories.map(value => {
                const option = document.createElement('option');
                option.value = value;
                return option;
            })
        );
        main.querySelector('#relatedOptions').replaceChildren(
            ...terms
                .filter(item => Number(item.id) !== Number(editing))
                .map(item => {
                    const option = document.createElement('option');
                    option.value = item.term;
                    return option;
                })
        );

        const historyTerm = main.querySelector('#historyTerm');
        const selectedTerm = historyTerm.value;
        historyTerm.replaceChildren(
            new Option('Tất cả thuật ngữ', ''),
            ...[...new Set(logs.map(log => log.term_name))]
                .sort()
                .map(value => new Option(value, value))
        );
        historyTerm.value = selectedTerm;

        const historyUser = main.querySelector('#historyUser');
        const selectedUser = historyUser.value;
        const actors = [...new Map(logs.filter(log => log.actor_id).map(log => [String(log.actor_id), log.username || `User #${log.actor_id}`])).entries()];
        historyUser.replaceChildren(
            new Option('Tất cả người dùng', ''),
            ...actors.map(([id, name]) => new Option(name, id))
        );
        historyUser.value = selectedUser;
    }

    async function refresh() {
        [terms, logs] = await Promise.all([request('/terms'), request('/term-audit-logs')]);
        rebuildOptions();
        renderTerms();
        renderHistory();
    }

    main.querySelector('#termForm').addEventListener('submit', async event => {
        event.preventDefault();
        const json = { term: fields.name.value.trim(), definition: fields.definition.value.trim(), category: fields.category.value.trim(), status: fields.status.value, abbreviation: fields.abbreviation.value.trim() || null, synonyms: synonyms.get(), relatedTermIds: related.get(), exampleUsage: fields.example.value.trim() || null };
        await request(editing ? `/terms/${editing}` : '/terms', { method: editing ? 'PUT' : 'POST', json });
        reset(); await refresh(); notice('Đã lưu thuật ngữ và ghi audit log.');
    });
    main.querySelector('#termCancel').addEventListener('click', reset);
    termSearch.addEventListener('input', renderTerms);
    termCategoryFilter.addEventListener('change', renderTerms);
    main.querySelector('#historyUser').addEventListener('change', renderHistory);
    main.querySelector('#historyTerm').addEventListener('change', renderHistory);
    await refresh(); reset();
};
