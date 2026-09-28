(() => {
  const kind = new URLSearchParams(parent.location.search).get('kind') || 'manual';
  const roles = { manual: 'MANUAL_LABELER', ai: 'AI_LABELER', review: 'REVIEWER', manager: 'MANAGER' };
  const task = { id: 31, document_id: 11, session_id: 21, document_title: 'Bao cao tai chinh 2024.pdf', session_name: 'Kiem thu nghiem thu', task_type: kind === 'ai' ? 'AI' : 'MANUAL', assigned_to: 4, assignee: 'labeler01', status: 'IN_PROGRESS', assistance_mode: kind === 'manual' ? 'NONE' : 'AI_ASSISTED', labels: [
    { label_name: 'COMPANY_NAME', label_value: 'CONG TY CO PHAN 28.1', source_page: 1, confidence: .98 },
    { label_name: 'REVENUE', label_value: '262.611.441.370 VND', source_page: 2, confidence: .94 },
  ], reviews: [] };
  const review = { id: 7, document_id: 11, document_title: 'Bao cao tai chinh 2024.pdf', status: 'IN_PROGRESS', left_task_id: 31, right_task_id: 32, left_assignee: 'manual_a', right_assignee: 'manual_b', history: [], fields: [
    { fieldKey: 'COMPANY_NAME', fieldName: 'COMPANY_NAME', comparisonType: 'EXACT', left: { label_value: 'CONG TY CO PHAN 28.1', source_page: 1 }, right: { label_value: 'CONG TY CO PHAN 28.1', source_page: 1 }, finalValue: 'CONG TY CO PHAN 28.1', selectedSource: 'AUTO' },
    { fieldKey: 'REVENUE', fieldName: 'REVENUE', comparisonType: 'FORMAT_ONLY', left: { label_value: '262.611.441.370 VND', source_page: 2 }, right: { label_value: '262,611,441,370 VND', source_page: 2 } },
    { fieldKey: 'PROFIT_AFTER_TAX', fieldName: 'PROFIT_AFTER_TAX', comparisonType: 'MISSING', left: { label_value: '-12.500.000 VND', source_page: 2 }, right: null },
  ] };
  const statistics = { statuses: [{ status: 'IN_PROGRESS', total: 4 }, { status: 'APPROVED', total: 6 }], sectionProgress: [
    { task_id: 31, session_id: 21, username: 'manual_a', field_key: 'COMPANY_NAME', section_status: 'REVIEWED', assistance_mode: 'NONE' },
    { task_id: 32, session_id: 21, username: 'manual_b', field_key: 'REVENUE', section_status: 'SUBMITTED', assistance_mode: 'AI_ASSISTED' },
  ], userProductivity: [{ username: 'manual_a', assigned_tasks: 4, completed_tasks: 3, saved_sections: 1, submitted_sections: 2, reviewed_sections: 8, overdue_tasks: 0 }, { username: 'manual_b', assigned_tasks: 5, completed_tasks: 2, saved_sections: 2, submitted_sections: 4, reviewed_sections: 5, overdue_tasks: 1 }], timeComparison: [{ assistance_mode: 'NONE', average_seconds: 1260, median_seconds: 1140, sample_size: 8 }, { assistance_mode: 'AI_ASSISTED', average_seconds: 780, median_seconds: 720, sample_size: 9 }], overdueTasks: [{ document_title: 'Bao cao tai chinh 2023.pdf', username: 'manual_b', assistance_mode: 'NONE', status: 'IN_PROGRESS', due_at: '2026-09-20T17:00:00' }] };
  window.AAIR = {
    guard: async () => ({ id: 1, username: roles[kind].toLowerCase(), role: roles[kind] }),
    logout() {},
    createWorkTimer: () => ({ stop: async () => {}, seconds: 0 }),
    request: async (path, options = {}) => {
      if (options.blob) return fetch('/resource/guidelines/aair-labeling-guidelines.pdf').then(response => response.blob());
      if (path === '/tasks') return [task, { ...task, id: 32, assignee: 'manual_b', status: 'SUBMITTED' }];
      if (path === '/tasks/31' || path === '/tasks/32') return task;
      if (path === '/prompts/options') return [];
      if (path === '/prompts/system-default') return '';
      if (path === '/review-cases') return [{ ...review, fields: undefined }];
      if (path === '/review-cases/7') return review;
      if (path === '/statistics') return statistics;
      if (path === '/assignees') return [{ id: 5, username: 'reviewer01', role: 'REVIEWER' }];
      if (path === '/sessions') return [{ id: 21, name: 'Kiem thu nghiem thu' }];
      if (options.method) return { id: 99, active_seconds: 0 };
      return [];
    },
  };
})();
