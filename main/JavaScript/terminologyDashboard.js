window.AAIRTerminologyDashboardPage = async function ({ request }) {
    const numberFormat = new Intl.NumberFormat();
    const [summary, terms] = await Promise.all([
        request('/dashboard'),
        request('/terms')
    ]);

    const totalTerms = Number(summary['Thuật ngữ'] ?? terms.length);
    const activeTerms = Number(
        summary['Đang sử dụng'] ?? terms.filter(term => term.status === 'ACTIVE').length
    );
    const categoryCount = Number(
        summary['Nhóm chủ đề'] ?? new Set(terms.map(term => term.category).filter(Boolean)).size
    );
    const recentlyUpdated = terms.filter(term => {
        const updatedAt = Date.parse(term.updated_at || term.created_at || '');
        return Number.isFinite(updatedAt) && updatedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }).length;

    setText('#terminologyTotalTerms', `${numberFormat.format(totalTerms)} Terms`);
    setText('#terminologyCategoryCount', `${numberFormat.format(categoryCount)} Categories`);
    setText('#terminologyUpdatedCount', `${numberFormat.format(recentlyUpdated)} Terms Updated`);
    setText('#terminologyInactiveCount', `${numberFormat.format(Math.max(0, totalTerms - activeTerms))} Inactive`);

    renderRecentTerms(terms);
    renderCategoryDistribution(terms);

    document.querySelector('#viewAllTerms')?.addEventListener('click', openTermManagement);
    document.querySelector('#viewTerminologyCategories')?.addEventListener('click', openTermManagement);
    document.querySelector('#dashboardRefresh')?.addEventListener('click', () => window.location.reload());

    const rangeButton = document.querySelector('#dashboardRange');
    if (rangeButton) {
        rangeButton.textContent = 'All Time';
        rangeButton.disabled = true;
        rangeButton.title = 'API dashboard hiện trả số liệu toàn thời gian.';
    }

    function setText(selector, value) {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    }

    function renderRecentTerms(rows) {
        const body = document.querySelector('#terminologyRecentRows');
        if (!body) return;

        const recent = [...rows]
            .sort((left, right) => Date.parse(right.updated_at || right.created_at || 0)
                - Date.parse(left.updated_at || left.created_at || 0))
            .slice(0, 5);

        body.replaceChildren();
        if (!recent.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'px-6 py-8 text-center text-on-surface-variant';
            cell.textContent = 'No terminology entries yet.';
            row.append(cell);
            body.append(row);
            return;
        }

        recent.forEach(term => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-surface-container-low/50 transition-colors';

            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 font-semibold text-primary';
            nameCell.textContent = term.term || '—';

            const categoryCell = document.createElement('td');
            categoryCell.className = 'px-6 py-4 text-on-surface-variant';
            categoryCell.textContent = term.category || '—';

            const dateCell = document.createElement('td');
            dateCell.className = 'px-6 py-4 text-on-surface-variant';
            dateCell.textContent = formatDate(term.updated_at || term.created_at);

            const statusCell = document.createElement('td');
            statusCell.className = 'px-6 py-4';
            const status = document.createElement('span');
            status.className = term.status === 'ACTIVE'
                ? 'px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[11px] font-bold'
                : 'px-3 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-[11px] font-bold';
            status.textContent = term.status === 'ACTIVE' ? 'Active' : 'Inactive';
            statusCell.append(status);

            const actionCell = document.createElement('td');
            actionCell.className = 'px-6 py-4 text-right';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'text-primary hover:underline';
            editButton.textContent = 'Manage';
            editButton.setAttribute('aria-label', `Manage ${term.term || 'term'}`);
            editButton.addEventListener('click', openTermManagement);
            actionCell.append(editButton);

            row.append(nameCell, categoryCell, dateCell, statusCell, actionCell);
            body.append(row);
        });
    }

    function renderCategoryDistribution(rows) {
        const container = document.querySelector('#terminologyCategoryDistribution');
        if (!container) return;

        const counts = rows.reduce((result, term) => {
            const category = term.category?.trim() || 'Uncategorized';
            result.set(category, (result.get(category) || 0) + 1);
            return result;
        }, new Map());
        const categories = [...counts.entries()]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 5);

        container.replaceChildren();
        if (!categories.length) {
            const emptyState = document.createElement('p');
            emptyState.className = 'text-sm text-on-surface-variant';
            emptyState.textContent = 'No category data available.';
            container.append(emptyState);
            return;
        }

        const colors = ['#078bb8', '#44a08d', '#3b82f6', '#d49a2a', '#7c6bb1'];
        categories.forEach(([name, count], index) => {
            const item = document.createElement('div');
            item.className = 'space-y-1';

            const labels = document.createElement('div');
            labels.className = 'flex justify-between items-end gap-3';
            const categoryName = document.createElement('span');
            categoryName.className = 'font-body-sm font-semibold';
            categoryName.textContent = name;
            const categoryCount = document.createElement('span');
            categoryCount.className = 'text-[11px] font-bold text-on-surface-variant';
            categoryCount.textContent = `${numberFormat.format(count)} Terms (${Math.round(count / rows.length * 100)}%)`;
            labels.append(categoryName, categoryCount);

            const track = document.createElement('div');
            track.className = 'w-full bg-surface-container-high h-2 rounded-full overflow-hidden';
            const bar = document.createElement('div');
            bar.className = 'h-full rounded-full';
            bar.style.width = `${count / rows.length * 100}%`;
            bar.style.backgroundColor = colors[index % colors.length];
            track.append(bar);

            item.append(labels, track);
            container.append(item);
        });
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? '—'
            : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
    }

    function openTermManagement() {
        window.location.href = 'BaseManagement.html';
    }
};
