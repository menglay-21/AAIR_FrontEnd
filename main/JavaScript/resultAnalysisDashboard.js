window.AAIRResultAnalysisDashboard = async function ({ request, notice, go }) {
    const $ = id => document.getElementById(id);
    const number = value => Number(value || 0);
    const displayNumber = value => new Intl.NumberFormat('vi-VN').format(number(value));
    const localIso = value => value.toISOString().slice(0, 19);
    const statusLabels = {
        PENDING: 'Chờ xử lý', IN_PROGRESS: 'Đang xử lý', SUBMITTED: 'Đã nộp',
        APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối'
    };

    function textCell(value) {
        const cell = document.createElement('td');
        cell.className = 'px-5 py-3 border-t border-outline-variant/30';
        cell.textContent = value == null || value === '' ? '—' : String(value);
        return cell;
    }
    function emptyRow(body, columns, message) {
        body.replaceChildren(); const row = document.createElement('tr'); const cell = textCell(message);
        cell.colSpan = columns; cell.className = 'px-5 py-8 text-center text-on-surface-variant'; row.append(cell); body.append(row);
    }
    function statusPill(status) {
        const pill = document.createElement('span');
        pill.className = 'inline-flex rounded-full bg-surface-container px-2 py-1 text-[10px] font-bold text-on-surface-variant';
        pill.textContent = statusLabels[status] || status || '—'; return pill;
    }
    function metric(id, value) { $(id).textContent = displayNumber(value); }
    function bars(host, values, label, value) {
        host.replaceChildren(); const max = Math.max(1, ...values.map(value));
        if (!values.length) { host.textContent = 'Chưa có dữ liệu trong khoảng thời gian này.'; host.className += ' text-sm text-on-surface-variant'; return; }
        values.forEach((item, index) => {
            const row = document.createElement('div'); row.className = 'space-y-1';
            const head = document.createElement('div'); head.className = 'flex items-center justify-between gap-3 text-sm';
            const name = document.createElement('span'); name.textContent = label(item);
            const count = document.createElement('strong'); count.textContent = displayNumber(value(item)); head.append(name, count);
            const track = document.createElement('div'); track.className = 'h-2 overflow-hidden rounded-full bg-surface-container';
            const fill = document.createElement('div'); fill.className = index % 2 ? 'h-full rounded-full bg-secondary' : 'h-full rounded-full bg-primary';
            fill.style.width = `${Math.max(2, (value(item) / max) * 100)}%`; track.append(fill); row.append(head, track); host.append(row);
        });
    }
    function formatDate(value) {
        if (!value) return '—'; const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN');
    }
    async function load() {
        const now = new Date(); const from = new Date(now); from.setDate(now.getDate() - 30);
        $('analystRange').textContent = `30 ngày gần nhất · ${from.toLocaleDateString('vi-VN')} – ${now.toLocaleDateString('vi-VN')}`;
        $('analystDashboardState').textContent = 'Đang tải dữ liệu...';
        try {
            const query = `?from=${encodeURIComponent(localIso(from))}&to=${encodeURIComponent(localIso(now))}`;
            const [statistics, tasks] = await Promise.all([request(`/statistics${query}`), request('/tasks')]);
            const statuses = statistics.statuses || []; const labels = statistics.labels || []; const productivity = statistics.userProductivity || [];
            const totals = Object.fromEntries(statuses.map(item => [item.status, number(item.total)]));
            const totalTasks = statuses.reduce((sum, item) => sum + number(item.total), 0);
            const inProgress = Object.entries(totals).filter(([status]) => !['APPROVED', 'SUBMITTED', 'REJECTED'].includes(status)).reduce((sum, [, total]) => sum + total, 0);
            const overdue = productivity.reduce((sum, item) => sum + number(item.overdue_tasks), 0);
            metric('metricTotalTasks', totalTasks); metric('metricInProgress', inProgress); metric('metricSubmitted', totals.SUBMITTED); metric('metricApproved', totals.APPROVED); metric('metricOverdue', overdue); metric('metricLabels', labels.reduce((sum, item) => sum + number(item.total), 0));
            bars($('statusDistribution'), statuses, item => statusLabels[item.status] || item.status, item => number(item.total));
            bars($('labelDistribution'), labels.slice(0, 8), item => item.label_name || 'Không xác định', item => number(item.total));

            const recent = tasks.filter(task => !task.created_at || new Date(task.created_at) >= from).sort((left, right) => new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0)).slice(0, 10);
            const taskBody = $('recentTasks'); taskBody.replaceChildren();
            if (!recent.length) emptyRow(taskBody, 4, 'Chưa có tác vụ trong 30 ngày gần nhất.');
            recent.forEach(task => {
                const row = document.createElement('tr'); row.className = 'cursor-pointer hover:bg-surface-container-low/40';
                row.addEventListener('click', () => go(`Task.html?id=${task.id}`));
                const status = document.createElement('td'); status.className = 'px-5 py-3 border-t border-outline-variant/30'; status.append(statusPill(task.status));
                row.append(textCell(task.document_title || task.document_name), textCell(task.assignee || task.assignee_username), status, textCell(formatDate(task.updated_at || task.created_at))); taskBody.append(row);
            });

            const productivityBody = $('userProductivity'); productivityBody.replaceChildren();
            if (!productivity.length) emptyRow(productivityBody, 3, 'Chưa có dữ liệu năng suất.');
            productivity.slice(0, 10).forEach(item => { const row = document.createElement('tr'); row.append(textCell(item.username || 'Chưa phân công'), textCell(item.completed_tasks), textCell(item.overdue_tasks)); productivityBody.append(row); });
            $('analystDashboardState').textContent = totalTasks ? `Cập nhật từ cơ sở dữ liệu lúc ${new Date().toLocaleTimeString('vi-VN')}.` : 'Chưa có dữ liệu trong 30 ngày gần nhất.';
        } catch (error) {
            $('analystDashboardState').textContent = `Không tải được dữ liệu: ${error.message}`;
            ['metricTotalTasks', 'metricInProgress', 'metricSubmitted', 'metricApproved', 'metricOverdue', 'metricLabels'].forEach(id => { $(id).textContent = '—'; });
            emptyRow($('recentTasks'), 4, 'Không thể tải tác vụ. Hãy thử làm mới.'); emptyRow($('userProductivity'), 3, 'Không thể tải năng suất. Hãy thử làm mới.');
            $('statusDistribution').textContent = 'Không thể tải dữ liệu.'; $('labelDistribution').textContent = 'Không thể tải dữ liệu.';
            notice(error.message, true);
        }
    }
    $('analystRefresh').addEventListener('click', load);
    await load();
};
