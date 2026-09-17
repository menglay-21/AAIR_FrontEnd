/* Bind API data to the tables, cards and editors in main/HTML. No separate UI. */
(async () => {
    'use strict';
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const text = el => el?.textContent.replace(/\s+/g, ' ').trim() || '';
    const page = location.pathname.split('/').pop();
    const request = AAIR.request;
    const tableStyles = new WeakMap();
    const taskSuccessNotices = new Set(['Lưu dữ liệu thành công.', 'Submit task thành công.']);
    let noticeTimer;
    let user;
    function notice(message, error = false) {
        // The application only uses toasts for explicit Save and Submit successes.
        if (!error && !taskSuccessNotices.has(message)) return;
        let el = $('#apiNotice');
        if (!el) {
            el = document.createElement('p'); el.id = 'apiNotice';
            el.style.transition = 'transform 300ms ease, opacity 300ms ease';
            el.onclick = () => { clearTimeout(noticeTimer); el.remove(); };
            document.body.append(el);
        }
        el.className = error
            ? 'fixed left-1/2 top-1/2 z-[200] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white px-6 py-4 text-center shadow-xl text-sm'
            : 'fixed top-4 right-4 z-[200] max-w-lg rounded-lg border bg-white px-5 py-3 shadow-lg text-sm';
        el.setAttribute('role', error ? 'alert' : 'status'); el.setAttribute('aria-live', error ? 'assertive' : 'polite');
        clearTimeout(noticeTimer);
        el.style.transform = error ? 'translate(-50%, -50%)' : 'translateX(0)'; el.style.opacity = '1';
        el.style.color = error ? '#b91c1c' : '#166534'; el.textContent = message;
        noticeTimer = setTimeout(() => {
            if (!error) el.style.transform = 'translateX(calc(100% + 2rem))';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 5000);
    }
    const busy = new WeakSet();
    async function run(button, fn) {
        if (button?.disabled || (button && busy.has(button))) return;
        if (button) { busy.add(button); button.setAttribute('aria-busy','true'); button.style.pointerEvents='none'; }
        try { await fn(); } catch (error) { notice(error.message, true); }
        finally { if (button) { busy.delete(button); button.removeAttribute('aria-busy'); button.style.pointerEvents=''; } }
    }
    function bind(button, fn) {
        if (!button) return;
        button.removeAttribute('onclick'); button.type = 'button';
        button.onclick = () => run(button, fn);
    }
    function buttons(pattern, root = document) { return $$('button', root).filter(b => pattern.test(text(b))); }
    function bindText(pattern, fn, root) { buttons(pattern, root).forEach(b => bind(b, () => fn(b))); }
    function unavailable(el, message = 'Chức năng này chưa có API hỗ trợ.') {
        if (!el) return;
        el.removeAttribute('onclick'); el.disabled = true; el.title = message;
        el.setAttribute('aria-label', `${text(el)} — ${message}`); el.style.opacity = '0.5';
    }
    const date = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
    function formattedLabelValue(labelName, value) {
        const input = String(value ?? '');
        if (/year|năm/i.test(labelName || '')) return input;
        const match = input.match(/^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?=\s|$)/i);
        if (!match) return input;
        const token = match[1];
        let formatted;
        if (/^-?\d+$/.test(token)) {
            if (token.replace('-', '').length < 5) return input;
            formatted = BigInt(token).toLocaleString('vi-VN');
        } else {
            const number = Number(token);
            if (!Number.isFinite(number) || Math.abs(number) < 10000) return input;
            formatted = number.toLocaleString('vi-VN', { maximumFractionDigits: 4 });
        }
        return formatted + input.slice(token.length);
    }
    function viDateToIso(value) {
        const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
        if (!match) throw new Error('Ngày hết hạn phải theo định dạng dd/mm/yyyy.');
        const [, day, month, year] = match;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 0);
        if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day))
            throw new Error('Ngày hết hạn không hợp lệ.');
        return { parsed, iso: `${year}-${month}-${day}T23:59:00` };
    }
    const status = row => row.status ?? (row.is_active === undefined ? '—' : row.is_active ? 'ACTIVE' : 'INACTIVE');
    const go = file => location.assign(file);
    function options(select, values, all = false) {
        if (!select) return;
        select.replaceChildren();
        if (all) select.add(new Option('All', ''));
        for (const value of values) {
            const [key, label] = Array.isArray(value) ? value : [value, value];
            select.add(new Option(label, key));
        }
    }
    function download(blob, name) {
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    const exportJson = (value, name) => download(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), name);
    async function documentFile(row) {
        download(await request(`/documents/${row.id}/file`, { blob: true }), row.original_name || row.title);
    }
    function action(label, callback) {
        const b = document.createElement('button'); b.className = 'p-1 mx-1 text-primary hover:underline';
        b.title = label; b.setAttribute('aria-label',label);
        if (['edit_note','delete','visibility','edit','block','check_circle'].includes(label)) {
            const icon=document.createElement('span');icon.className='material-symbols-outlined text-[20px]';icon.textContent=label;b.append(icon);
        } else b.textContent=label;
        bind(b, callback); return b;
    }
    // Keep the existing table and its cell styles; replace only its records.
    function table(el, columns, rows, actions) {
        if (!el) return;
        const head = $('thead tr', el), body = $('tbody', el) || el.createTBody();
        const oldCells = $$('tr:first-child td', body);
        const styles = tableStyles.get(el) || oldCells.map(c => c.className);
        const headStyle = $('th', el)?.className || 'px-4 py-3 text-left';
        head?.replaceChildren(...columns.map(([name]) => {
            const th = document.createElement('th'); th.className = headStyle; th.textContent = name; return th;
        }));
        body.replaceChildren();
        for (const row of rows) {
            const tr = document.createElement('tr'); tr.className = 'hover:bg-surface-container/30 transition-colors';
            columns.forEach(([, value], index) => {
                const td = document.createElement('td'); td.className = styles[index] || 'px-4 py-3 text-sm';
                if (value === '$actions') td.append(...actions(row));
                else {
                    const result = typeof value === 'function' ? value(row) : row[value];
                    if (result instanceof Node) td.append(result); else td.textContent = result ?? '—';
                }
                tr.append(td);
            });
            body.append(tr);
        }
        if (!rows.length) {
            const tr = body.insertRow(), td = tr.insertCell(); td.colSpan = columns.length;
            td.className = 'px-4 py-6 text-center text-on-surface-variant'; td.textContent = 'Chưa có dữ liệu.';
        }
    }
    function listTable(rows, columns, actions, filterFields = []) {
        const el = $('table');
        const search = $('input[placeholder^="Search"]:not(#modalContent input)');
        const selects = $$('header select');
        const filterValue = (spec, row) => {
            const field = Array.isArray(spec) ? spec[0] : spec;
            return typeof field === 'function' ? field(row) : row[field];
        };
        const filterOptions = spec => Array.isArray(spec) && spec[1]
            ? spec[1]
            : [...new Set(rows.map(r => filterValue(spec, r)).filter(Boolean))].sort();
        let current = 0, folderFilter = '';
        selects.forEach((select, index) => {
            const field = filterFields[index];
            if (field) options(select, filterOptions(field), true);
            else { options(select, [], true); select.disabled = true; }
        });
        const pagers = buttons(/^(chevron_left|chevron_right|[1-6])$/);
        const render = () => {
            if(page==='Session.html'){
                const metrics=[['Total Sessions',rows.length],['Active Sessions',rows.filter(r=>r.status==='ACTIVE').length],['Draft Sessions',rows.filter(r=>r.status==='DRAFT').length],['Closed Sessions',rows.filter(r=>r.status==='CLOSED').length]];
                $$('main .font-display-lg').forEach((value,index)=>{
                    value.textContent=String(metrics[index][1]);value.nextElementSibling.textContent=metrics[index][0];
                    $$('span',value.parentElement).filter(s=>!s.classList.contains('material-symbols-outlined')).forEach(s=>s.textContent='');
                });
            }
            if(page==='DocumentManagement.html'){
                const types=['','PDF'];
                $$('.folder-card').forEach((card,index)=>{
                    if(index>=types.length){card.hidden=true;return;}
                    const type=types[index];$('h3',card).textContent=type||'All Files';
                    const count=rows.filter(r=>!type||String(r.document_type).toUpperCase()===type).length;
                    $('p',card).textContent=`${count} Files`;
                    const footer=card.lastElementChild;if(footer&&!footer.contains($('h3',card)))footer.textContent='';
                    card.onclick=()=>{folderFilter=type;current=0;const filter=selects[0];if(filter)filter.value=type;render();};
                });
            }
            const query = search?.value.toLocaleLowerCase().trim() || '';
            const filtered = rows.filter(row => Object.values(row).filter(v => typeof v !== 'object').join(' ').toLocaleLowerCase().includes(query)
                && selects.every((s, i) => !s.value || String(filterValue(filterFields[i], row)) === s.value));
            const pages = Math.max(1, Math.ceil(filtered.length / 10)); current = Math.min(current, pages - 1);
            table(el, columns, filtered.slice(current * 10, current * 10 + 10), actions);
            pagers.forEach(b => {
                const label = text(b), number = Number(label);
                b.hidden = number > pages;
                b.disabled = label === 'chevron_left' ? current === 0 : label === 'chevron_right' ? current === pages - 1 : number === current + 1;
                b.setAttribute('aria-current', number === current + 1 ? 'page' : 'false');
            });
            $$('p,span').filter(p => p.children.length === 0 && /^Showing\b/.test(text(p))).forEach(p => { p.textContent = `Showing ${filtered.length ? current * 10 + 1 : 0}–${Math.min((current + 1) * 10, filtered.length)} / ${filtered.length}`; });
        };
        search?.addEventListener('input', () => { current = 0; render(); });
        selects.forEach(s => s.addEventListener('change', () => { current = 0; folderFilter=''; render(); }));
        pagers.forEach(b => bind(b, () => { current = text(b) === 'chevron_left' ? current - 1 : text(b) === 'chevron_right' ? current + 1 : Number(text(b)) - 1; render(); }));
        render();
        return { reload(next) {
            rows = next;
            selects.forEach((select,index)=>{const field=filterFields[index];if(field){const value=select.value;options(select,filterOptions(field),true);select.value=[...select.options].some(o=>o.value===value)?value:'';}});
            render();
        } };
    }
    function modalOpen() { if ($('#modalOverlay')?.classList.contains('hidden')) window.toggleModal(); }
    function modalClose() { if ($('#modalOverlay') && !$('#modalOverlay').classList.contains('hidden')) window.toggleModal(); }
    function fieldLabel(field, label) {
        const l = $('label', field.parentElement); if (l) l.textContent = label;
        field.setAttribute('aria-label', label);
    }
    function required(field, label) {
        if (!field.value.trim()) throw new Error(`Vui lòng nhập ${label}.`);
        return field.value.trim();
    }
    async function termsPage() {
        let rows = await request('/terms'), editing = null;
        const term = $('input[placeholder="e.g. Operating Income"]');
        const definition = $('textarea'), category = $('main select');
        const state = $('#termStatus');
        state.value = 'ACTIVE';
        const reset = () => { editing = null; term.value = ''; definition.value = ''; category.selectedIndex = 0; state.value = 'ACTIVE'; };
        const edit = row => { editing = row.id; term.value = row.term; definition.value = row.definition; state.value = row.status;
            if (![...category.options].some(o => o.value === row.category)) category.add(new Option(row.category, row.category));
            category.value = row.category || category.options[0].value; term.focus(); };
        const refresh = async () => { rows = await request('/terms'); list.reload(rows); };
        const list = listTable(rows, [['Financial Term','term'], ['Definition','definition'], ['Category','category'], ['Status','status'], ['Last Updated', r => date(r.updated_at)], ['Actions','$actions']], row => [
            action('edit_note', () => edit(row)), action('delete', async () => { if (confirm(`Xóa thuật ngữ “${row.term}”?`)) { await request(`/terms/${row.id}`, {method:'DELETE'}); if (editing === row.id) reset(); await refresh(); } }),
        ], ['category','status']);
        bindText(/^Save Term$/, async () => {
            const json = { term: required(term, 'thuật ngữ'), definition: required(definition, 'định nghĩa'), category: category.selectedIndex ? category.value : '', status: state.value };
            if (!['ACTIVE','INACTIVE'].includes(json.status)) throw new Error('Status phải là ACTIVE hoặc INACTIVE.');
            await request(editing ? `/terms/${editing}` : '/terms', { method: editing ? 'PUT' : 'POST', json });
            reset(); await refresh(); notice('Đã lưu thuật ngữ.');
        });
        bindText(/^Cancel$/, reset);
        $('#csvFileInput').addEventListener('change', e => run(e.target, async () => {
            const file = e.target.files[0]; if (!file) return;
            const records = parseCsv(await file.text());
            const header = records.shift()?.map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());
            if (!header?.includes('term') || !header.includes('definition')) throw new Error('CSV cần cột term, definition; có thể thêm category, status.');
            const imports = records.filter(r => r.some(Boolean)).map(r => Object.fromEntries(header.map((h,i) => [h, r[i] || ''])));
            if (imports.some(r => !r.term.trim() || !r.definition.trim() || !['ACTIVE','INACTIVE'].includes(r.status || 'ACTIVE'))) throw new Error('CSV có dòng thiếu term/definition hoặc status không hợp lệ.');
            let saved = 0;
            try { for (const row of imports) { await request('/terms', {method:'POST', json:{...row, status: row.status || 'ACTIVE'}}); saved++; } }
            catch (error) { throw new Error(`Đã nhập ${saved}/${imports.length} dòng; dừng ở dòng ${saved + 2}: ${error.message}`); }
            finally { await refresh(); e.target.value = ''; }
            notice(`Đã nhập ${saved} thuật ngữ.`);
        }));
    }
    function parseCsv(source) {
        const rows = []; let row = [], value = '', quoted = false;
        for (let i = 0; i < source.length; i++) {
            const c = source[i];
            if (c === '"') { if (quoted && source[i+1] === '"') { value += '"'; i++; } else quoted = !quoted; }
            else if (c === ',' && !quoted) { row.push(value); value = ''; }
            else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && source[i+1] === '\n') i++; row.push(value); rows.push(row); row=[]; value=''; }
            else value += c;
        }
        if (quoted) throw new Error('CSV có dấu ngoặc kép chưa đóng.');
        if (value || row.length) { row.push(value); rows.push(row); } return rows;
    }
    async function promptsPage() {
        let editing = null;
        const modal = $('#modalContent'), name = $('input', modal), [description, content] = $$('textarea', modal), [active, model] = $$('select', modal);
        fieldLabel(active, 'Status'); options(active, [['true','ACTIVE'],['false','INACTIVE']]);
        const save = buttons(/^Create Prompt$/, modal)[0];
        const reset = () => { editing = null; name.value = ''; description.value = ''; content.value = ''; active.value = 'true'; model.selectedIndex = 0; save.textContent = 'Create Prompt'; };
        const edit = row => {
            editing = row.id; name.value = row.name; description.value = row.description || ''; content.value = row.content;
            active.value = String(row.is_active);
            if (row.model && ![...model.options].some(o => o.value === row.model)) model.add(new Option(row.model, row.model));
            model.value = row.model || model.options[0].value; save.textContent = 'Save Prompt'; modalOpen();
        };
        const refresh = async () => list.reload(await request('/prompts'));
        const list = listTable(await request('/prompts'), [['Prompt','name'],['Purpose','description'],['Model','model'],['Status',status],['Updated',r=>date(r.updated_at)],['Action','$actions']], row => [
            action('edit',()=>edit(row)), action(row.is_active ? 'Disable' : 'Enable', async()=>{ await request(`/prompts/${row.id}`,{method:'PUT',json:{name:row.name,description:row.description,content:row.content,model:row.model,active:!row.is_active}}); await refresh(); }),
            action('delete',async()=>{if(confirm(`Xóa prompt “${row.name}”?`)){await request(`/prompts/${row.id}`,{method:'DELETE'});await refresh();}}),
        ], [status]);
        bindText(/New Prompt/, () => { reset(); modalOpen(); });
        bind(save, async () => {
            await request(editing ? `/prompts/${editing}` : '/prompts', {method: editing ? 'PUT':'POST', json:{name:required(name,'tên prompt'),description:description.value,content:required(content,'nội dung prompt'),model:model.selectedIndex ? model.value : '',active:active.value==='true'}});
            modalClose(); reset(); await refresh(); notice('Đã lưu prompt.');
        });
    }
    async function usersPage() {
        const canManageUsers = ['ADMIN','MANAGER'].includes(user.role);
        const endpoint = canManageUsers ? '/users' : '/assignees';
        const refresh = async () => list.reload(await request(endpoint));
        const roles = canManageUsers ? await request('/roles') : [];
        const list = listTable(await request(endpoint), [['No.','id'],['Username','username'],['Gmail','email'],['Role','role'],['Status',r=>canManageUsers?status(r):'ACTIVE'],['Created',r=>date(r.created_at)],['Actions','$actions']], row => canManageUsers ? [
            action('edit',()=>edit(row)), action(row.is_active?'block':'check_circle',async()=>{
                if (!confirm(`${row.is_active?'Khóa':'Mở khóa'} tài khoản ${row.username}?`)) return;
                await request(`/users/${row.id}`,{method:'PUT',json:{role:row.role,active:!row.is_active}}); await refresh();
            }),
        ] : [], canManageUsers ? [[r=>r.role, roles], r=>status(r)] : ['role', r=>'ACTIVE']);
        const modal=$('#modalContent'), [username,unused,email] = $$('input:not([type="checkbox"])',modal), role=$('select',modal);
        let editing=null;
        fieldLabel(username,'Username'); username.placeholder='e.g. manager02';
        unused.parentElement.hidden=true;
        fieldLabel(email,'Gmail'); email.placeholder='username@gmail.com'; email.type='email';
        fieldLabel(role,'Role'); options(role,roles);
        role.insertBefore(new Option('— Không chọn —',''), role.firstChild);
        const save=buttons(/^Create$/,modal)[0];
        const reset=()=>{editing=null;username.value='';username.disabled=false;email.value='';email.disabled=false;role.value='MANAGER';save.textContent='Create';$('h3',modal).textContent='Create User';};
        function edit(row){editing=row;username.value=row.username;username.disabled=true;email.value=row.email||'';email.disabled=true;if(![...role.options].some(o=>o.value===row.role))role.add(new Option(row.role,row.role));role.value=row.role;save.textContent='Save';$('h3',modal).textContent='Edit User';modalOpen();}
        bindText(/New Manager|New User/,()=>{reset();modalOpen();});
        bind(save,async()=>{
            const isEditing=Boolean(editing);
            const json=editing?{role:role.value,active:editing.is_active}:{username:required(username,'tên tài khoản'),email:required(email,'Gmail'),role:role.value};
            await request(editing?`/users/${editing.id}`:'/users',{method:editing?'PUT':'POST',json});modalClose();reset();await refresh();
            notice(isEditing?'Đã cập nhật tài khoản.':'Đã tạo tài khoản, gửi email và làm mới bảng.');
        });
    }
    async function documentsPage() {
        let pendingFiles=[];
        const refresh = async()=>list.reload([...pendingFiles.map((file,index)=>({id:-(index+1),title:file.name,original_name:file.name,document_type:'PDF',uploaded_by_username:user.username,created_at:new Date().toISOString(),status:'CHỜ LƯU',pending:true})),...await request('/documents')]);
        const list=listTable(await request('/documents'),[['No.','id'],['File Name','title'],['Original File','original_name'],['Type','document_type'],['Uploaded By',r=>r.uploaded_by_username||'—'],['Upload Date',r=>date(r.created_at)],['Status','status'],['Actions','$actions']],row=>row.pending?[]:[
            action('visibility',()=>documentFile(row)),action('edit',async()=>{
                const title=prompt('Tên tài liệu',row.title);if(title===null)return;if(!title.trim())throw new Error('Tên tài liệu không được trống.');
                await request(`/documents/${row.id}`,{method:'PUT',json:{title:title.trim(),documentType:row.document_type}});await refresh();
            }),action('delete',async()=>{if(confirm(`Xóa tài liệu “${row.title}”?`)){await request(`/documents/${row.id}`,{method:'DELETE'});await refresh();}}),
        ],['document_type']);
        const input=$('#documentInput');input.accept='.pdf,application/pdf';input.multiple=true;
        input.addEventListener('change',()=>run(input,async()=>{
            const files=[...input.files];if(!files.length)return;
            try {
                const invalid=files.find(file=>!/\.pdf$/i.test(file.name)||file.size===0||file.size>50*1024*1024);
                if(invalid)throw new Error(`File “${invalid.name}” không hợp lệ. Chỉ chọn PDF có nội dung, tối đa 50 MB mỗi file.`);
                pendingFiles.push(...files); await refresh();
            } finally {input.value='';}
        }));
        const saveButton=$('#saveDocumentsButton');
        bind(saveButton,async()=>{
            if(!pendingFiles.length)return;
            const files=[...pendingFiles];let uploaded=0;
            for(const file of files){const data=new FormData();data.append('file',file);data.append('metadata',new Blob([JSON.stringify({title:file.name,documentType:'PDF'})],{type:'application/json'}));await request('/documents',{method:'POST',body:data});uploaded++;}
            pendingFiles=[];await refresh();notice(`Đã lưu ${uploaded} tài liệu vào cơ sở dữ liệu.`);
        });
        window.addEventListener('beforeunload',event=>{if(!pendingFiles.length)return;event.preventDefault();event.returnValue='Xác nhận lưu thay đổi?';});
    }
    async function sessionsPage() {
        const [documents, assignees] = await Promise.all([request('/documents'),request('/assignees')]);
        const modal=$('#modalContent'), name=$('input[placeholder^="e.g."]',modal), description=$('textarea',modal);
        const lists=$$('div.max-h-48',modal);
        const [documentList,typeList,memberList]=lists;
        let editing=null, createdId=null, pendingTasks=[];
        const save=buttons(/^Create Session$/,modal)[0];
        function checkList(container,rows,key,radio=false){
            container.replaceChildren(...rows.map(row=>{
                const label=document.createElement('label');label.className='flex items-center gap-3 px-4 py-3 border-b border-outline-variant cursor-pointer';
                const input=document.createElement('input');input.type=radio?'radio':'checkbox';input.name=key;input.value=row.id;input.className='rounded border-outline-variant text-primary';
                const span=document.createElement('span');span.textContent=row.name;label.append(input,span);return label;
            }));
        }
        checkList(documentList,documents.map(d=>({id:d.id,name:d.title})),'documents');
        checkList(typeList,[{id:'MANUAL',name:'Manual labeling'},{id:'AI',name:'AI labeling'}],'sessionType',true);
        $('input',typeList).checked=true;
        const modelSection=typeList.parentElement;
        $('p',modelSection).textContent='Session Type';
        $$('p',modelSection)[1].textContent='Chọn gán nhãn AI, thủ công hoặc cả hai.';
        const modelSearch=$('input[placeholder="Search AI models..."]',modal);modelSearch.parentElement.hidden=true;
        checkList(memberList,assignees.map(u=>({id:u.id,name:`${u.username} — ${u.role}`})),'members');
        const selected=container=>$$('input:checked',container).map(i=>i.value);
        for(const container of lists){
            const section=container.parentElement, search=$('input[placeholder^="Search"]',section);
            search?.addEventListener('input',()=>$$('label',container).forEach(l=>l.hidden=!text(l).toLowerCase().includes(search.value.toLowerCase())));
            bindText(/^Select All$/,()=>$$('input[type="checkbox"]',container).forEach(i=>i.checked=true),section);
            if(container===typeList)buttons(/^Select All$/,section).forEach(b=>b.hidden=true);
            container.addEventListener('change',()=>{
                const counter=$$('span',section).find(s=>/Selected$/.test(text(s)));if(counter)counter.textContent=`${selected(container).length} Selected`;
            });
        }
        const startDate=$('#sessionStartDate',modal), dueDate=$('#sessionDueDate',modal);
        startDate.closest('[class~="space-y-1.5"]').hidden=true;
        dueDate.setAttribute('aria-label','Session due date');dueDate.required=true;
        dueDate.pattern='\\d{2}/\\d{2}/\\d{4}';
        dueDate.addEventListener('input',()=>{
            const digits=dueDate.value.replace(/\D/g,'').slice(0,8);
            dueDate.value=[digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join('/');
        });
        const dueLabel=$('label',dueDate.parentElement.parentElement);if(dueLabel)dueLabel.textContent='Session Due Date *';
        const reset=()=>{
            editing=null;createdId=null;pendingTasks=[];name.value='';description.value='';dueDate.value='';name.disabled=false;description.disabled=false;
            $$('input',documentList).forEach(i=>i.checked=false);$$('input',memberList).forEach(i=>i.checked=false);
            documentList.parentElement.hidden=false;typeList.parentElement.hidden=false;dueDate.parentElement.parentElement.hidden=false;
            save.textContent='Create Session';$('h3',modal).textContent='Create Session';
        };
        const edit=row=>{
            reset();editing=row;name.value=row.name;description.value=row.description||'';name.disabled=true;description.disabled=true;
            documentList.parentElement.hidden=true;typeList.parentElement.hidden=true;dueDate.parentElement.parentElement.hidden=true;
            $$('input',memberList).forEach(i=>i.checked=row.members.some(m=>String(m.id)===i.value));save.textContent='Save Members';$('h3',modal).textContent='Assign Users';modalOpen();
        };
        const refresh=async()=>list.reload(await request('/sessions'));
        const list=listTable(await request('/sessions'),[['No.','id'],['Session','name'],['Type','session_type'],['Assigned Users',r=>r.members.map(m=>m.username).join(', ')],['Due Date',r=>date(r.due_at)],['Status','status'],['Created',r=>date(r.created_at)],['Actions','$actions']],row=>[
            action('edit',()=>edit(row)),action('Tasks',async()=>{
                const tasks=(await request('/tasks')).filter(t=>t.session_id===row.id);
                exportJson(tasks,`session-${row.id}-tasks.json`);notice(`${tasks.length} tác vụ đã được xuất cùng thông tin phân công.`);
            }),...(row.status==='CLOSED'?[]:[action(row.status==='DRAFT'?'Start':'Close',async()=>{
                if(!confirm(`${row.status==='DRAFT'?'Bắt đầu':'Đóng'} phiên “${row.name}”?`))return;
                await request(`/sessions/${row.id}/status`,{method:'PATCH',json:{status:row.status==='DRAFT'?'ACTIVE':'CLOSED'}});await refresh();
            })]),
        ],['status']);
        // Hide the static empty-state card; the actual table supplies its empty state.
        $$('h3').filter(h=>/No AI sessions/.test(text(h))).forEach(h=>h.parentElement.hidden=true);
        bindText(/New Session|Create First Session/,()=>{reset();modalOpen();});
        bind(save,async()=>{
            const userIds=selected(memberList).map(Number);
            if(editing){await request(`/sessions/${editing.id}/members`,{method:'PUT',json:{userIds}});modalClose();await refresh();notice('Đã cập nhật thành viên.');return;}
            const type=selected(typeList)[0], docIds=selected(documentList).map(Number);
            if(!createdId){
                required(name,'tên phiên');
                required(dueDate,'ngày hết hạn');
                const sessionDue=viDateToIso(dueDate.value);
                if(sessionDue.parsed<=new Date())throw new Error('Ngày hết hạn phải ở tương lai.');
                if(!docIds.length)throw new Error('Vui lòng chọn ít nhất một tài liệu PDF.');
                const types=[type];
                const labelers=assignees.filter(u=>userIds.includes(u.id)&&['AI_LABELER','MANUAL_LABELER'].includes(u.role));
                if(docIds.length && types.some(t=>!labelers.some(u=>u.role===(t==='AI'?'AI_LABELER':'MANUAL_LABELER'))))throw new Error('Chọn người gán nhãn đúng vai trò cho mỗi loại tác vụ.');
                pendingTasks=docIds.flatMap(documentId=>types.flatMap(taskType=>labelers.filter(u=>u.role===(taskType==='AI'?'AI_LABELER':'MANUAL_LABELER')).map(u=>({documentId,taskType,assignedTo:u.id,dueAt:sessionDue.iso}))));
                const sessionDueAt=sessionDue.iso;
                const created=await request('/sessions',{method:'POST',json:{name:name.value.trim(),description:description.value,sessionType:type,dueAt:sessionDueAt}});createdId=created.id;
            }
            // Preserve the created ID and unfinished requests if any later step fails.
            try{
                await request(`/sessions/${createdId}/members`,{method:'PUT',json:{userIds}});
                while(pendingTasks.length){await request('/tasks',{method:'POST',json:{...pendingTasks[0],sessionId:createdId}});pendingTasks.shift();}
            }catch(error){await refresh();throw new Error(`Phiên #${createdId} đã tạo. Còn ${pendingTasks.length} tác vụ; bấm lưu để tiếp tục. ${error.message}`);}
            modalClose();reset();await refresh();notice('Đã tạo session thành công');
        });
    }
    async function taskList() {
        const rows=await request('/tasks');
        listTable(rows,[['Document','document_title'],['Session','session_name'],['Annotator','assignee'],['Type','task_type'],['Status','status'],['Due',r=>date(r.due_at)],['Action','$actions']],row=>[
            action('Open',()=>go(`Task.html?id=${row.id}`)),
        ],['session_name','status']);
    }
    async function taskPage() {
        // The old processing strip contained static demo values, not live API progress.
        $('#processingPanel')?.remove();
        const [tasks,prompts]=await Promise.all([
            request('/tasks'),
            user.role==='AI_LABELER'?request('/prompts'):Promise.resolve([]),
        ]);
        const id=new URLSearchParams(location.search).get('id');
        const initial=id?tasks.find(t=>String(t.id)===id):tasks.find(t=>user.role==='REVIEWER'?t.status==='SUBMITTED':!['APPROVED','SUBMITTED'].includes(t.status))||tasks[0];
        const item=$('.document-item'), container=item?.parentElement, template=item?.cloneNode(true);
        const documentButtons=new Map();
        if(container){
            container.replaceChildren();
            for(const row of tasks){
                const b=template.cloneNode(true);b.removeAttribute('data-pdf');b.removeAttribute('onclick');
                b.replaceChildren();
                const icon=document.createElement('span');icon.className='material-symbols-outlined text-[16px]';icon.textContent='picture_as_pdf';
                const label=document.createElement('span');label.className='truncate';label.textContent=row.document_title;
                b.append(icon,label);b.title=`Mở ${row.document_title}`;b.setAttribute('aria-label',`Mở tài liệu ${row.document_title}`);
                bind(b,()=>loadTask(row));documentButtons.set(row.id,b);container.append(b);
            }
        }
        // Reuse the original Term / Definition cards as editable annotation fields.
        const heading=$$('main h2,main h3').find(h=>text(h)==='Extracted Information');
        let panel=heading?.parentElement;
        while(panel && !$('label',panel))panel=panel.parentElement;
        const reviewBodies=$$('main .overflow-y-auto').filter(el=>$('input[type="checkbox"]',el));
        if(!panel)panel=reviewBodies[0];
        if(!panel)throw new Error('Không tìm thấy vùng nhãn của tác vụ.');
        const labeler=['AI_LABELER','MANUAL_LABELER'].includes(user.role);
        const termLabel=$$('label',panel).find(l=>text(l)==='Term');
        let cardTemplate;
        if(termLabel){
            cardTemplate=termLabel.parentElement;
            while(cardTemplate && !$$('label',cardTemplate).some(l=>text(l)==='Definition'))cardTemplate=cardTemplate.parentElement;
            cardTemplate=cardTemplate.cloneNode(true);
        }else cardTemplate=panel.firstElementChild.cloneNode(true);
        let readonly=!labeler;
        const cards=[];
        const clearCards=()=>{
            cards.length=0;
            if(heading){const keep=[...panel.children].find(c=>c===heading||c.contains(heading));[...panel.children].filter(c=>c!==keep).forEach(c=>c.remove());}
            else panel.replaceChildren();
        };
        function addLabel(row={labelName:'',labelValue:'',sourcePage:null,confidence:null}){
            const card=cardTemplate.cloneNode(true);
            let nameNode, valueNode;
            const labels=$$('label',card);
            if(labels.length){nameNode=labels.find(l=>text(l)==='Term')?.nextElementSibling;valueNode=labels.find(l=>text(l)==='Definition')?.nextElementSibling;}
            else{nameNode=$('span',card);valueNode=$('p',card);}
            if(!nameNode||!valueNode)throw new Error('Thiếu vùng Term / Definition trong mẫu nhãn.');
            $$('button,input',card).forEach(el=>el.remove());
            nameNode.textContent=row.labelName;valueNode.textContent=formattedLabelValue(row.labelName,row.labelValue);
            for(const [node,label] of [[nameNode,'Term'],[valueNode,'Definition']]){
                node.setAttribute('contenteditable',String(!readonly));node.setAttribute('role',readonly?'text':'textbox');node.setAttribute('aria-label',label);
                node.style.minHeight='1.5em';node.style.whiteSpace='pre-wrap';
            }
            $$('span',card).filter(e=>/%$/.test(text(e))).forEach(e=>e.textContent=row.confidence==null?'—':`${Math.round(row.confidence*100)}%`);
            const pageWrap=document.createElement('label');pageWrap.className='mt-3 flex items-center gap-3 border-t border-outline-variant pt-3 text-sm font-medium';
            const pageText=document.createElement('span');pageText.textContent='Source Page';
            const pageInput=document.createElement('input');pageInput.type='number';pageInput.min='1';pageInput.step='1';pageInput.required=true;
            pageInput.value=row.sourcePage==null?'':String(row.sourcePage);pageInput.placeholder='Số trang';pageInput.setAttribute('aria-label','Source Page');
            pageInput.className='ml-auto w-28 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-sm';pageInput.disabled=readonly;
            pageWrap.append(pageText,pageInput);card.append(pageWrap);
            cards.push({nameNode,valueNode,pageInput,confidence:row.confidence});panel.append(card);return nameNode;
        }
        const editor={
            get value(){return JSON.stringify(cards.map(c=>({labelName:text(c.nameNode),labelValue:c.valueNode.textContent,sourcePage:c.pageInput.value?Number(c.pageInput.value):null,confidence:c.confidence})).filter(c=>c.labelName||c.labelValue));},
            set value(value){clearCards();const rows=JSON.parse(value);rows.forEach(addLabel);if(!rows.length&&labeler)addLabel();},
            get readOnly(){return readonly;},
            set readOnly(value){readonly=value;cards.forEach(c=>{[c.nameNode,c.valueNode].forEach(n=>{n.setAttribute('contenteditable',String(!readonly));n.setAttribute('role',readonly?'text':'textbox');});c.pageInput.disabled=readonly;});},
            focus(){cards[0]?.nameNode.focus();},
        };
        editor.value='[]';
        reviewBodies.slice(1).forEach(body=>body.replaceChildren());
        // Other extraction/status panels contain mock results and are unavailable until an inference API exists.
        $$('main h2,main h3').filter(h=>['Extraction Status','Processing Details'].includes(text(h))).forEach(h=>{
            const section=h.parentElement;[...section.children].filter(c=>c!==h).forEach(c=>c.remove());const p=document.createElement('p');p.textContent='Chưa có dữ liệu xử lý AI.';section.append(p);
        });
        $$('main h3').filter(h=>text(h)==='Document Information').forEach(h=>{while(h.nextSibling)h.nextSibling.remove();});
        // Result comparison has two extraction panels; no synthetic second result.
        $$('main h2,main h3').filter(h=>text(h)==='Extracted Information'&&h!==heading).forEach(h=>{
            while(h.nextSibling)h.nextSibling.remove();const p=document.createElement('p');p.textContent='Kết quả tác vụ được hiển thị trong vùng nhãn bên cạnh.';h.parentElement.append(p);
        });
        const modelSelect=$('header select');
        if(modelSelect && ['AI_LABELER','MANUAL_LABELER'].includes(user.role)){
            const models=user.role==='MANUAL_LABELER'?['Gemini']:['ALL','Gemini','Groq','ChatGPT','Claude'];
            options(modelSelect,models.map(model=>[model,model]));
            modelSelect.insertBefore(new Option('Choose Model',''),modelSelect.firstChild);modelSelect.value=user.role==='MANUAL_LABELER'?'Gemini':'';modelSelect.disabled=false;
            modelSelect.addEventListener('change',()=>{if(modelSelect.value)notice(`Đã chọn model ${modelSelect.value}.`);});
        }else if(modelSelect){options(modelSelect,[],true);modelSelect.disabled=true;}
        if(!initial){
            buttons(/Save|Submit|Approve|Validate|^Edit$|Analyze/).forEach(b=>unavailable(b,'Chưa được phân công tác vụ.'));
            notice(id?'Không tìm thấy tác vụ hoặc bạn không có quyền truy cập.':'Chưa có tác vụ được phân công.',Boolean(id));return;
        }
        let task, fileUrl;
        const title=$('header:nth-of-type(2) .truncate');
        const type=$$('header:nth-of-type(2) .truncate')[1];
        const docHeading=$$('main h3').find(h=>text(h)==='Document Information');
        let docInfo;
        if(docHeading){docInfo=document.createElement('p');docHeading.after(docInfo);}
        const renderTask=()=>{
            editor.value=JSON.stringify(task.labels.map(l=>({labelName:l.label_name,labelValue:l.label_value,sourcePage:l.source_page,confidence:l.confidence})),null,2);
            editor.readOnly=!labeler||['SUBMITTED','APPROVED'].includes(task.status);
            document.title=`${task.document_title} — ${task.status}`;
        };
        const refresh=async()=>{task=await request(`/tasks/${task.id}`);renderTask();};
        async function loadTask(row){
            task=await request(`/tasks/${row.id}`);
            history.replaceState(null,'',`?id=${row.id}`);
            if(title)title.textContent=row.session_name||task.document_title;
            if(type)type.textContent=task.task_type;
            if(docInfo)docInfo.textContent=task.document_title;
            renderTask();
            documentButtons.forEach((button,taskId)=>{
                const selected=taskId===row.id;
                button.classList.toggle('bg-surface-container',selected);button.classList.toggle('text-primary',selected);
                button.setAttribute('aria-current',selected?'true':'false');
            });
            const iframe=$('#pdfViewer');
            if(iframe){iframe.removeAttribute('src');iframe.srcdoc='<p style="font-family:sans-serif;padding:24px">Đang tải tài liệu PDF…</p>';}
            try {
                const blob=await request(`/documents/${task.document_id}/file`,{blob:true});
                if(fileUrl)URL.revokeObjectURL(fileUrl);
                fileUrl=URL.createObjectURL(blob);
                if(iframe){iframe.removeAttribute('srcdoc');iframe.src=fileUrl;iframe.title=task.document_title;}
                notice(`Đã mở tài liệu ${task.document_title}.`);
            } catch(error) {
                if(iframe)iframe.srcdoc=`<p style="font-family:sans-serif;padding:24px;color:#b91c1c">Không tải được tài liệu PDF.</p>`;
                throw error;
            }
        }
        await loadTask(initial);
        window.addEventListener('pagehide',()=>{if(fileUrl)URL.revokeObjectURL(fileUrl);});
        const runAiButton=buttons(/Run AI/)[0];
        if(runAiButton && ['AI_LABELER','MANUAL_LABELER'].includes(user.role)){
            const updateRunAiState=()=>{
                runAiButton.disabled=!modelSelect?.value;
                runAiButton.style.opacity=runAiButton.disabled?'0.5':'';
                runAiButton.title=runAiButton.disabled?'Vui lòng chọn model trước khi chạy AI.':'';
            };
            modelSelect?.addEventListener('change',updateRunAiState);updateRunAiState();
            bind(runAiButton,async()=>{
                if(!modelSelect?.value)throw new Error('Vui lòng chọn model trước khi chạy AI.');
                const oldText=runAiButton.textContent;runAiButton.textContent='Running AI...';
                try{
                    const result=await request(`/tasks/${task.id}/run-ai`,{method:'POST',json:{provider:modelSelect.value}});
                    editor.value=JSON.stringify(result.labels||[]);editor.readOnly=false;
                    notice(`Đã rút trích ${result.labels?.length||0} chỉ tiêu bằng ${result.provider}. Hãy kiểm tra rồi nhấn Save.`);
                }finally{runAiButton.textContent=oldText;}
            });
        }else if(runAiButton)unavailable(runAiButton,'Chỉ AI Labeler được chạy mô hình AI.');
        function labels(){
            let data;try{data=JSON.parse(editor.value);}catch{throw new Error('Nhãn phải là JSON hợp lệ.');}
            if(!Array.isArray(data)||data.length>500||data.some(l=>!l||typeof l.labelName!=='string'||!l.labelName.trim()||l.labelName.length>150||!(l.labelValue==null||typeof l.labelValue==='string')||(l.labelValue?.length||0)>20000||!Number.isInteger(l.sourcePage)||l.sourcePage<1||!(l.confidence==null||typeof l.confidence==='number'&&l.confidence>=0&&l.confidence<=1)))throw new Error('Mỗi chỉ tiêu cần Term, Definition, Source Page là số nguyên dương và confidence từ 0 đến 1 (hoặc null); tối đa 500 chỉ tiêu.');
            return data;
        }
        const save=async(showNotice=true)=>{
            const data=labels();
            if(['PENDING','REJECTED'].includes(task.status)){await request(`/tasks/${task.id}/start`,{method:'POST'});task.status='IN_PROGRESS';}
            await request(`/tasks/${task.id}/labels`,{method:'PUT',json:{labels:data}});await refresh();
            if(showNotice)notice('Lưu dữ liệu thành công.');
        };
        bindText(/^save Save JSON$|^Save$/,async()=>{await save();if(user.role==='MANUAL_LABELER')exportJson(labels(),`task-${task.id}-labels.json`);});
        bindText(/^Submit Task$/,async()=>{if(!labels().length)throw new Error('Cần ít nhất một nhãn trước khi nộp.');await save(false);await request(`/tasks/${task.id}/submit`,{method:'POST'});await refresh();notice('Submit task thành công.');});
        bindText(/^Validate$/,()=>{labels();notice('Định dạng nhãn hợp lệ.');});
        bindText(/^Edit$|^edit$/,()=>{if(editor.readOnly)throw new Error('Tác vụ hiện chỉ được xem.');addLabel().focus();});
        if(user.role==='AI_LABELER'){
            const saveButton=buttons(/^Save$/)[0];
            const submit=saveButton.cloneNode(true);submit.textContent='Submit Task';saveButton.after(submit);
            bind(submit,async()=>{if(!labels().length)throw new Error('Cần ít nhất một nhãn.');await save(false);await request(`/tasks/${task.id}/submit`,{method:'POST'});await refresh();notice('Submit task thành công.');});
        }
        if(labeler)buttons(/^Edit$/).forEach(b=>b.textContent='Add Label');
        if(reviewBodies.length){
            const firstHeader=reviewBodies[0].previousElementSibling;if(firstHeader)firstHeader.textContent=`${initial.assignee||'Annotator'} — ${task.task_type}`;
            const history=reviewBodies[1];
            if(history){const header=history.previousElementSibling;if(header)header.textContent='Review History';
                const renderReviews=()=>{history.replaceChildren();for(const review of task.reviews){const p=document.createElement('p');p.className='p-4 border-b text-sm';p.textContent=`${review.reviewer} — ${review.decision}: ${review.feedback||''}`;history.append(p);}};
                renderReviews();
            }
        }
        bindText(/Approve Review/,async()=>{
            const answer=prompt('Nhập APPROVED để duyệt hoặc REJECTED để yêu cầu sửa:','APPROVED');if(answer===null)return;
            const decision=answer.trim().toUpperCase();if(!['APPROVED','REJECTED'].includes(decision))throw new Error('Quyết định phải là APPROVED hoặc REJECTED.');
            const feedback=prompt(decision==='REJECTED'?'Lý do yêu cầu sửa (bắt buộc):':'Nhận xét (không bắt buộc):','');if(feedback===null)return;
            await request(`/tasks/${task.id}/review`,{method:'POST',json:{decision,feedback}});await refresh();notice(`Đã lưu kết quả: ${decision}.`);
        });
        bindText(/^Analyze$/,()=>{exportJson({taskId:task.id,status:task.status,labels:task.labels,reviews:task.reviews},`task-${task.id}-analysis.json`);notice(`Đã xuất ${task.labels.length} nhãn và ${task.reviews.length} quyết định kiểm duyệt.`);});
        if(!labeler)buttons(/^Edit$|^edit$|^Validate$/).forEach(b=>unavailable(b,'Vai trò này chỉ xem nhãn.'));
        notice(`${task.document_title} — ${task.status}${labeler?' · Sửa Term/Definition trực tiếp; nút Add Label thêm nhãn, xóa nội dung cả hai ô để bỏ nhãn.':''}`);
    }
    async function logsPage() {
        let pageIndex=0,rows=await request('/audit-logs');
        const search=$('input[placeholder^="Search"]'),filters=$$('header select');
        const show=row=>{
            const drawer=$('#detail-drawer');
            const content=$('.overflow-y-auto',drawer);
            if(content){const pre=document.createElement('pre');pre.className='p-4 text-sm whitespace-pre-wrap';pre.textContent=JSON.stringify(row,null,2);content.replaceChildren(pre);}
            window.openDrawer();
        };
        const columns=[['Timestamp',r=>date(r.created_at)],['User','username'],['Resource','resource_type'],['Resource ID','resource_id'],['Action','action'],['Details','$actions']];
        const next=buttons(/^chevron_right$/)[0],previous=buttons(/^chevron_left$/)[0];
        buttons(/^[1-6]$/).forEach(b=>b.hidden=true);
        const render=()=>{
            const query=search.value.toLowerCase().trim();
            const filtered=rows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(query)&&filters.every((s,i)=>!s.value||r[i===0?'resource_type':'action']===s.value));
            table($('table'),columns,filtered,r=>[action('View',()=>show(r))]);
            previous.disabled=pageIndex===0;next.disabled=rows.length<100;
            $$('p,span').filter(p=>p.children.length===0&&/^Showing/.test(text(p))).forEach(p=>p.textContent=`Trang ${pageIndex+1}: ${filtered.length} bản ghi`);
        };
        const configureFilters=()=>filters.forEach((s,i)=>options(s,[...new Set(rows.map(r=>r[i===0?'resource_type':'action']))].sort(),true));
        configureFilters();search.addEventListener('input',render);filters.forEach(s=>s.addEventListener('change',render));
        bind(next,async()=>{const batch=await request(`/audit-logs?page=${pageIndex+1}`);pageIndex++;rows=batch;configureFilters();render();});
        bind(previous,async()=>{const batch=await request(`/audit-logs?page=${pageIndex-1}`);pageIndex--;rows=batch;configureFilters();render();});render();
        buttons(/Block IP|Related Activities/).forEach(b=>unavailable(b));
    }
    async function permissionsPage() {
        const [roles,users]=await Promise.all([request('/roles'),request('/users')]);
        const roleNames={ADMIN:'Administrator',MANAGER:'Manager'};
        const roleFeatures={
            ADMIN:new Set(['DASHBOARD','USER_MANAGEMENT','PERMISSION_MANAGEMENT','AUDIT_LOGS']),
            MANAGER:new Set(['DASHBOARD','USER_MANAGEMENT','PERMISSION_MANAGEMENT','DOCUMENTS','SESSIONS','TASKS','STATISTICS'])
        };
        const roleCards=new Map();
        $$('main h4').filter(h=>['Administrator','Manager','User'].includes(text(h))).forEach(h=>{
            const card=h.closest('.group'); if (!card) return;
            const name=text(h);
            const role=name==='Administrator'?'ADMIN':name==='Manager'?'MANAGER':'USER';
            roleCards.set(role,card);
            const count=$$('p',card).find(p=>/Members/.test(text(p)));
            const members=role==='USER'?users.filter(u=>!roles.includes(u.role)).length:users.filter(u=>u.role===role).length;
            if(count) count.textContent=`${members} Members`;
            if(role!=='USER') card.onclick=()=>selectRole(role);
        });
        const summary=$$('h3').find(h=>/Permission Summary|User Roles/.test(text(h)));
        if(summary)summary.textContent='Permission Summary';
        const matrix=$$('h3').find(h=>/Access Matrix|Account Role & Status/.test(text(h)));
        if(matrix)matrix.textContent='Access Matrix';
        const summaryValues={};
        $$('main').forEach(main=>$$('span',main).forEach(span=>{
            const label=span.parentElement?.querySelector('span')?.textContent?.trim();
            if(label)summaryValues[label]=span;
        }));
        const selectedRoleNode=$$('main span').find(s=>text(s)==='Administrator'&&s.parentElement?.querySelector('span')?.textContent?.includes('Selected Role'));
        const enabledNode=$$('main span').find(s=>text(s).includes('Actions'));
        const restrictedNode=$$('main span').find(s=>text(s)==='None');
        const coverageNode=$$('main span').find(s=>text(s).includes('%'));
        const saveButton=buttons(/Save Changes/)[0];
        const tbody=$('table tbody');
        let selectedRole='ADMIN', snapshot=null, changes=new Map();

        function setCardState() {
            for(const [role,card] of roleCards) {
                if(role==='USER') continue;
                card.classList.toggle('border-2',role===selectedRole);
                card.classList.toggle('border-primary',role===selectedRole);
                card.classList.toggle('border',role!==selectedRole);
            }
        }
        function renderSnapshot(data) {
            snapshot=data; changes=new Map();
            if(selectedRoleNode)selectedRoleNode.textContent=roleNames[selectedRole];
            if(enabledNode)enabledNode.textContent=`${data.enabledPermissions} Actions`;
            if(restrictedNode)restrictedNode.textContent=data.restrictedFeatures?`${data.restrictedFeatures} Features`:'None';
            if(coverageNode)coverageNode.textContent=`${data.coverage}%`;
            const progress=$$('main div').find(d=>d.classList.contains('bg-primary')&&d.classList.contains('h-full')&&d.classList.contains('w-full'));
            if(progress){progress.classList.remove('w-full');progress.style.width=`${data.coverage}%`;}
            if(!tbody)return;
            tbody.replaceChildren(...data.features.map(feature=>{
                const tr=document.createElement('tr');tr.className='hover:bg-surface-container-low/30 transition-colors group';
                const td=document.createElement('td');td.className='px-6 py-4 sticky left-0 bg-white/95 backdrop-blur-sm z-10';
                td.textContent=feature.label;tr.append(td);
                for(const actionName of ['READ','WRITE','EXECUTE','DELETE']){
                    const cell=document.createElement('td');cell.className='px-4 py-4 text-center';
                    const input=document.createElement('input');input.type='checkbox';input.checked=Boolean(feature.actions[actionName]);
                    input.className='w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20';
                    input.setAttribute('aria-label',`${actionName} ${feature.key}`);
                    const editable=user.role==='ADMIN' && roleFeatures[selectedRole].has(feature.key);
                    input.disabled=!editable;
                    input.onchange=()=>changes.set(`${feature.key}:${actionName}`,{feature:feature.key,action:actionName,enabled:input.checked});
                    cell.append(input);tr.append(cell);
                }
                return tr;
            }));
        }
        async function selectRole(role) {
            selectedRole=role; setCardState();
            renderSnapshot(await request(`/permissions?role=${encodeURIComponent(role)}`));
            if(saveButton)saveButton.disabled=user.role!=='ADMIN';
        }
        if(saveButton)saveButton.disabled=user.role!=='ADMIN';
        bind(saveButton,async()=>{
            if(user.role!=='ADMIN'||!snapshot)return;
            const permissions=[...changes.values()];
            if(!permissions.length){notice('Không có thay đổi permission.');return;}
            const data=await request(`/permissions/${selectedRole}`,{method:'PUT',json:{permissions}});
            renderSnapshot(data); notice('Đã lưu thay đổi permission.');
        });
        await selectRole(selectedRole);
    }
    async function dashboardPage() {
        const data=await request('/dashboard');
        const role=user.role;
        const rows=await request(role==='ADMIN'?'/audit-logs':role==='TERMINOLOGY'?'/terms':'/tasks');
        // All dashboard designs have their KPI cards in the first grid.
        const grid=$('main .grid');
        if(grid){
            const entries=Object.entries(data);
            [...grid.children].forEach((card,index)=>{
                const value=$('h3[class*="32px"],h3[class*="headline"],p[class*="headline-md"],p[class*="text-3xl"],span[class*="text-3xl"]',card)
                    || $$('h3,p',card).find(e=>/^\d/.test(text(e)));
                if(!value)return;
                const entry=entries[index];value.textContent=entry?String(entry[1]):'—';
                const label=value.previousElementSibling;if(label)label.textContent=entry?entry[0]:'Chưa có dữ liệu';
                $$('svg',card).forEach(s=>s.hidden=true);
                $$('span,p,div',card).filter(e=>e!==value&&e!==label&&!e.contains(value)&&!e.contains(label)&&/\+\d|%|STABLE|Critical|Action Required|Last 7 Days|^add\s+\d/i.test(text(e))).forEach(e=>e.textContent='');
            });
        }
        if(role==='ADMIN'){
            table($('table'),[['Time',r=>date(r.created_at)],['User','username'],['Resource','resource_type'],['ID','resource_id'],['Action','action']],rows.slice(0,3));
            bindText(/View Full Audit/,()=>go('LogView.html'));
        }else if(role==='TERMINOLOGY'){
            table($('table'),[['Term','term'],['Category','category'],['Date',r=>date(r.updated_at)],['Status','status']],rows.slice(0,10));
            bindText(/View All|Details/,()=>go('BaseManagement.html'));
            const heading=$$('h3').find(h=>text(h)==='Category Distribution');
            if(heading)replacePanel(heading,Object.entries(rows.reduce((groups,r)=>{groups[r.category||'Other']=(groups[r.category||'Other']||0)+1;return groups;},{})).map(([k,v])=>`${k}: ${v}`));
        }else if(role==='MANAGER'){
            const tables=$$('table');
            table(tables[0],[['Document','document_title'],['Assigned To','assignee'],['Status','status'],['Created',r=>date(r.created_at)]],rows.slice(0,10));
            const title=$$('h3').find(h=>text(h)==='AI Model Status');if(title)title.textContent='Task Status';
            const team=await request('/assignees');table(tables[1],[['Username','username'],['Role','role']],team);
            bindText(/View All/,()=>go('UserManagement.html'));bindText(/View Detailed Logs/,()=>go('Session.html'));
        }else{
            $$('table').forEach(t=>table(t,[['Document','document_title'],['Assignee','assignee'],['Status','status'],['Action','$actions']],rows.slice(0,10),r=>[action('Open',()=>go(`Task.html?id=${r.id}`))]));
            bindText(/View All|Full Comparison|Full Audit/,()=>go('ViewAll.html'));
            bindText(/Continue/,()=>go(rows.length?`Task.html?id=${rows[0].id}`:'ViewAll.html'));
            const sessions=$$('h2,h3').find(h=>text(h)==='Current AI Labeling Sessions');
            if(sessions){const section=sessions.parentElement.parentElement;const cards=$('.grid',section);if(cards){
                const template=cards.firstElementChild.cloneNode(true);cards.replaceChildren();
                for(const row of rows.slice(0,3)){const card=template.cloneNode(true);const h=$('h4,h3',card);if(h)h.textContent=row.document_title;
                    $$('p',card).forEach((p,i)=>p.textContent=i===0?row.session_name:row.status);
                    $$('span',card).filter(s=>!s.classList.contains('material-symbols-outlined')).forEach(s=>s.textContent='');
                    bindText(/Continue/,()=>go(`Task.html?id=${row.id}`),card);cards.append(card);}
            }}
            $$('h3,h4').filter(h=>['Recent Activity','Top Reviewers','Recent Analysis Summary','Recent Error Overview'].includes(text(h))).forEach(h=>replacePanel(h,rows.slice(0,5).map(r=>`${r.document_title} — ${r.status}`)));
            $$('h3,h4').filter(h=>['Accuracy Trend','Annotation Distribution','Agreement Performance','Error Trend','Review Progress'].includes(text(h))).forEach(h=>replacePanel(h,['Chưa có dữ liệu cho chỉ số này.']));
        }
        buttons(/Last 30 Days/).forEach(b=>{b.textContent='All Time';unavailable(b,'API dashboard hiện trả số liệu toàn thời gian.');});
    }
    function replacePanel(heading,lines) {
        let container=heading.parentElement;
        if(container.children.length===1||container.className.includes('items-center'))container=container.parentElement;
        const keep=[...container.children].find(c=>c===heading||c.contains(heading));
        [...container.children].filter(c=>c!==keep).forEach(c=>c.remove());
        const content=document.createElement('div');content.className='p-4 text-sm space-y-2';
        for(const line of lines.length?lines:['Chưa có dữ liệu.']){const p=document.createElement('p');p.textContent=line;content.append(p);}container.append(content);
    }
    async function statisticsPage() {
        const data=await request('/statistics');
        const total=data.statuses.reduce((n,r)=>n+Number(r.total),0);
        const metrics=[['Tác vụ',total],['Đã duyệt',data.statuses.find(r=>r.status==='APPROVED')?.total||0],['Nhãn',data.labels.reduce((n,r)=>n+Number(r.total),0)],['Người được phân công',data.assignees.filter(r=>r.username).length]];
        [...$('main .grid').children].forEach((card,i)=>{
            const value=$('div.font-headline-md',card);if(!value||!metrics[i])return;
            value.textContent=String(metrics[i][1]);value.previousElementSibling.textContent=metrics[i][0];
            $$('span',card).filter(s=>!s.classList.contains('material-symbols-outlined')).forEach(s=>s.textContent='');
            $$('[style*="width"]',card).forEach(el=>el.style.width='0');
        });
        const groups={
            'Annotation Progress':data.statuses.map(r=>`${r.status}: ${r.total}`),
            'User Productivity':data.assignees.map(r=>`${r.username||'Chưa phân công'}: ${r.approved}/${r.total} đã duyệt`),
            'Task Distribution':data.labels.map(r=>`${r.label_name}: ${r.total} nhãn; độ tin cậy ${r.average_confidence==null?'—':Number(r.average_confidence).toFixed(3)}`),
            'AI Accuracy Trend':['Chưa có dữ liệu độ chính xác theo thời gian.'],
            'Daily Activity Intensity':['Chưa có dữ liệu hoạt động theo ngày.'],
        };
        $$('main h3,main h4').forEach(h=>{if(groups[text(h)])replacePanel(h,groups[text(h)]);});
        buttons(/Last 30 Days/).forEach(b=>{b.textContent='All Time';unavailable(b);});
        bindText(/View All|analytics/,()=>exportJson(data,'statistics.json'));
        notice(`Thống kê từ ${total} tác vụ.`);
    }
    async function monitoringPage() {
        const logs=await request('/audit-logs');
        table($('table'),[['Timestamp',r=>date(r.created_at)],['User','username'],['Resource','resource_type'],['Action','action']],logs.slice(0,10));
        $$('main h3,main h4').filter(h=>['CPU & Memory Usage (24h)','API Latency vs GPU Load'].includes(text(h))).forEach(h=>replacePanel(h,['Chưa có API cung cấp số liệu giám sát.']));
        buttons(/^Restart$|^Logs$|filter_list/).forEach(b=>unavailable(b,'Chưa có API quản lý dịch vụ.'));
        bindText(/View All Full Logs/,()=>go('LogView.html'));
        $$('main h3').filter(h=>['RTMPose','Model Server','REST API','Database','Storage Service'].includes(text(h))).forEach(h=>{
            const card=h.closest('.bg-white')||h.parentElement.parentElement;
            $$('p,span',card).filter(e=>!e.classList.contains('material-symbols-outlined')).forEach(e=>{if(e.children.length===0)e.textContent='—';});
        });
        notice('API đang phản hồi. Chưa có API giám sát CPU/GPU, mô hình và dịch vụ.');
    }
    try {
        // System Monitoring is retired; remove its navigation entry everywhere,
        // including static admin pages that still contain the old template link.
        $$('a[href*="SystemMonitoring.html"]').forEach(link => {
            const separator = link.previousElementSibling;
            if (separator?.classList.contains('w-[1px]')) separator.remove();
            link.remove();
        });
        const main=$('main');if(main)main.style.visibility='hidden';
        // Clear sample rows immediately so network failures never look like real data.
        $$('tbody').forEach(body=>{const el=body.closest('table');tableStyles.set(el,$$('tr:first-child td',body).map(c=>c.className));const columns=$$('thead th',el).length;body.replaceChildren();const td=body.insertRow().insertCell();td.colSpan=columns||1;td.className='p-4';td.textContent='Đang tải dữ liệu…';});
        user=await AAIR.guard();if(!user)return;
        const profile=$('header .hidden.md\\:block');
        if(profile){const ps=$$('p',profile);if(ps[0])ps[0].textContent=user.username;if(ps[1])ps[1].textContent=user.role;
            const avatar=profile.previousElementSibling;if(avatar)avatar.textContent=user.username.slice(0,2).toUpperCase();
            const logout=document.createElement('button');
            logout.type='button';logout.setAttribute('aria-label','Đăng xuất');logout.title='Đăng xuất khỏi hệ thống';
            logout.className='ml-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/40 bg-white/15 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70';
            const icon=document.createElement('span');icon.className='material-symbols-outlined text-[18px]';icon.textContent='logout';
            const label=document.createElement('span');label.textContent='Đăng xuất';
            logout.append(icon,label);bind(logout,()=>{if(confirm('Bạn có chắc muốn đăng xuất?'))AAIR.logout();});
            profile.parentElement.append(logout);
        }
        if(page==='BaseManagement.html')await termsPage();
        else if(page==='Prompt.html')await promptsPage();
        else if(page==='ManagerManagement.html'||page==='UserManagement.html')await usersPage();
        else if(page==='DocumentManagement.html')await documentsPage();
        else if(page==='Session.html')await sessionsPage();
        else if(page==='ViewAll.html')await taskList();
        else if(page==='Task.html')await taskPage();
        else if(page==='LogView.html')await logsPage();
        else if(page==='PermissionManagement.html')await permissionsPage();
        else if(page==='Dashboard.html')await dashboardPage();
        else if(page==='Statistics.html')await statisticsPage();
        else if(page==='SystemMonitoring.html')await monitoringPage();
        if(main)main.style.visibility='';
    }catch(error){
        $$('tbody').forEach(body=>{if(text(body)==='Đang tải dữ liệu…')$('td',body).textContent='Không tải được dữ liệu. Hãy thử lại.';});
        notice(error.message,true);
    }
})();
