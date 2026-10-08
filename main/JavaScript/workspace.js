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
    function splitLabelValue(value, explicitSourceLabel) {
        const input = String(value ?? '');
        const marker = input.match(/\n\s*Nhãn nguồn:\s*/i);
        const sourceLabel = String(explicitSourceLabel ?? (marker ? input.slice(marker.index + marker[0].length) : '')).trim();
        return {
            editableValue: (marker ? input.slice(0, marker.index).trimEnd() : input).replace(/\s+text$/i, '').trim(),
            sourceLabel,
        };
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
    const status = row => (row.is_active === false ? 'INACTIVE' : (row.status ?? (row.is_active ? 'ACTIVE' : '—')));
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
    function avatarNode(row, sizeClass = 'w-9 h-9') {
        const holder=document.createElement('span');
        holder.className=`${sizeClass} shrink-0 overflow-hidden rounded-full bg-primary/10 text-primary inline-flex items-center justify-center font-bold`;
        holder.textContent=(row.username||'?').slice(0,2).toUpperCase();
        return holder;
    }
    function userIdentity(row) {
        const wrap=document.createElement('span');wrap.className='inline-flex items-center gap-3';
        const name=document.createElement('span');name.textContent=row.username;name.className='font-medium text-on-surface';
        wrap.append(avatarNode(row),name);return wrap;
    }
    const requestFrame=callback=>typeof window.requestAnimationFrame==='function'
        ? window.requestAnimationFrame(callback)
        : window.setTimeout(callback,0);
    const cancelFrame=id=>{
        if(typeof window.cancelAnimationFrame==='function')window.cancelAnimationFrame(id);
        else window.clearTimeout(id);
    };
    function setupTaskWorkspace() {
        const workspace=$('main');
        const pdfPane=workspace?.children[0];
        const dataPane=workspace?.children[1];
        if(!workspace||!pdfPane||!dataPane||!$('#pdfViewer',pdfPane))return;

        const storageKey=`aair.taskWorkspace.pdfPaneWidth.${document.body.classList.contains('manual-task-page')?'manual-v2':'default'}`;
        const defaultWidth=document.body.classList.contains('manual-task-page')?56:58;
        const clamp=value=>Math.min(80,Math.max(30,Number(value)||defaultWidth));
        let width=clamp(localStorage.getItem(storageKey));
        let frame=0;
        pdfPane.classList.add('workspace-pdf-pane');
        dataPane.classList.add('workspace-data-pane');
        $('#pdfViewer',pdfPane).parentElement?.classList.add('workspace-pdf-viewport');
        workspace.style.setProperty('--pdf-pane-width',`${width}%`);

        const splitter=document.createElement('button');
        splitter.type='button';
        splitter.className='task-workspace-splitter';
        splitter.title='Kéo để thay đổi chiều rộng vùng PDF';
        splitter.setAttribute('role','separator');
        splitter.setAttribute('aria-label','Thay đổi chiều rộng vùng PDF');
        splitter.setAttribute('aria-orientation','vertical');
        splitter.setAttribute('aria-valuemin','30');
        splitter.setAttribute('aria-valuemax','80');
        splitter.setAttribute('aria-valuenow',String(Math.round(width)));
        dataPane.before(splitter);

        const applyWidth=(next,persist=false)=>{
            width=clamp(next);
            cancelFrame(frame);
            frame=requestFrame(()=>{
                workspace.style.setProperty('--pdf-pane-width',`${width}%`);
                splitter.setAttribute('aria-valuenow',String(Math.round(width)));
                window.dispatchEvent(new Event('resize'));
            });
            if(persist)localStorage.setItem(storageKey,String(width));
        };
        const move=event=>{
            const bounds=workspace.getBoundingClientRect();
            applyWidth((event.clientX-bounds.left)/bounds.width*100);
        };
        const stop=event=>{
            if(splitter.hasPointerCapture(event.pointerId))splitter.releasePointerCapture(event.pointerId);
            document.body.classList.remove('task-workspace-resizing');
            applyWidth(width,true);
        };
        splitter.addEventListener('pointerdown',event=>{
            splitter.setPointerCapture(event.pointerId);
            document.body.classList.add('task-workspace-resizing');
            move(event);
        });
        splitter.addEventListener('pointermove',event=>{
            if(splitter.hasPointerCapture(event.pointerId))move(event);
        });
        splitter.addEventListener('pointerup',stop);
        splitter.addEventListener('pointercancel',stop);
        splitter.addEventListener('keydown',event=>{
            if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
            event.preventDefault();
            const next=event.key==='Home'?30:event.key==='End'?80:width+(event.key==='ArrowLeft'?-2:2);
            applyWidth(next,true);
        });
        $$('[data-pdf-action]',pdfPane).forEach(button=>bind(button,()=>{
            const iframe=$('#pdfViewer',pdfPane);
            const viewer=iframe?.contentWindow?.PDFViewerApplication?.pdfViewer;
            const action=button.dataset.pdfAction;
            if(!viewer)return;
            if(action==='fit-width')viewer.currentScaleValue='page-width';
            if(action==='fit-page')viewer.currentScaleValue='page-fit';
            if(action==='rotate')viewer.pagesRotation=(viewer.pagesRotation+90)%360;
            if(action==='search')iframe.contentWindow?.document.querySelector('#viewFind')?.click();
        }));
    }
    function setupDocumentSidebar(options={}) {
        const sidebar=options.sidebar||document.querySelector('body > aside');
        const workspace=options.workspace||$('main');
        if(!sidebar||!workspace)return;

        const storagePrefix=options.storagePrefix||'aair.taskWorkspace.documentSidebar';
        const widthKey=`${storagePrefix}Width`;
        const expandedKey=`${storagePrefix}ExpandedWidth`;
        const defaultWidth=options.defaultWidth||157;
        const clamp=value=>Math.min(320,Math.max(80,Number(value)||defaultWidth));
        const savedRaw=localStorage.getItem(widthKey);
        const saved=savedRaw===null?defaultWidth:Number(savedRaw);
        let width=saved===0?0:clamp(saved);
        let expandedWidth=clamp(localStorage.getItem(expandedKey)||width||defaultWidth);
        let frame=0;
        let startX=0;
        let moved=false;

        const handle=document.createElement('button');
        handle.type='button';
        handle.className=`document-sidebar-handle${options.handleClass?` ${options.handleClass}`:''}`;
        handle.setAttribute('role','separator');
        handle.setAttribute('aria-label','Thay đổi chiều rộng danh sách tài liệu');
        handle.setAttribute('aria-orientation','vertical');
        handle.setAttribute('aria-valuemin','0');
        handle.setAttribute('aria-valuemax','320');
        const icon=document.createElement('span');
        icon.className='material-symbols-outlined';
        handle.append(icon);
        document.body.append(handle);

        const render=(next,persist=false)=>{
            width=next<=40?0:clamp(next);
            if(width>0)expandedWidth=width;
            cancelFrame(frame);
            frame=requestFrame(()=>{
                document.body.style.setProperty('--document-sidebar-width',`${width}px`);
                document.body.classList.toggle('document-sidebar-collapsed',width===0);
                handle.setAttribute('aria-valuenow',String(Math.round(width)));
                handle.setAttribute('aria-expanded',String(width>0));
                handle.title=width>0?'Kéo để đổi chiều rộng; bấm để thu gọn':'Bấm để mở danh sách tài liệu';
                icon.textContent=width>0?'chevron_left':'chevron_right';
                if(options.toggleButton){
                    options.toggleButton.setAttribute('aria-expanded',String(width>0));
                    options.toggleButton.setAttribute('aria-label',width>0?'Thu gọn danh sách tài liệu':'Mở danh sách tài liệu');
                    options.toggleButton.title=width>0?'Thu gọn danh sách tài liệu':'Mở danh sách tài liệu';
                    const toggleIcon=$('.material-symbols-outlined',options.toggleButton);
                    if(toggleIcon)toggleIcon.textContent=width>0?'chevron_left':'chevron_right';
                }
                window.dispatchEvent(new Event('resize'));
            });
            if(persist){
                localStorage.setItem(widthKey,String(width));
                if(width>0)localStorage.setItem(expandedKey,String(expandedWidth));
            }
        };
        const toggle=()=>render(width===0?expandedWidth:0,true);
        const move=event=>{
            moved=moved||Math.abs(event.clientX-startX)>3;
            render(event.clientX);
        };
        const stop=event=>{
            if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
            document.body.classList.remove('document-sidebar-resizing');
            render(width,true);
        };
        handle.addEventListener('pointerdown',event=>{
            if(event.button!==0)return;
            startX=event.clientX;moved=false;
            handle.setPointerCapture(event.pointerId);
            document.body.classList.add('document-sidebar-resizing');
        });
        handle.addEventListener('pointermove',event=>{
            if(handle.hasPointerCapture(event.pointerId))move(event);
        });
        handle.addEventListener('pointerup',event=>{
            stop(event);
            if(!moved)toggle();
        });
        handle.addEventListener('pointercancel',stop);
        handle.addEventListener('keydown',event=>{
            if(['Enter',' '].includes(event.key)){event.preventDefault();toggle();return;}
            if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
            event.preventDefault();
            const next=event.key==='Home'?0:event.key==='End'?320:width+(event.key==='ArrowLeft'?-12:12);
            render(next,true);
        });
        options.toggleButton?.addEventListener('click',toggle);
        render(width);
        return {toggle,render,get width(){return width;}};
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
    function listTable(rows, columns, actions, filterFields = [], config = {}) {
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
        let current = 0, folderFilter = '', sortIndex = config.defaultSortIndex ?? -1, sortDirection = 1;
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
            let filtered = rows.filter(row => Object.values(row).filter(v => typeof v !== 'object').join(' ').toLocaleLowerCase().includes(query)
                && selects.every((s, i) => !s.value || String(filterValue(filterFields[i], row)) === s.value));
            if(sortIndex>=0){
                const key=config.sortKeys?.[sortIndex] ?? columns[sortIndex]?.[1];
                filtered=[...filtered].sort((left,right)=>{
                    const a=typeof key==='function'?key(left):left[key],b=typeof key==='function'?key(right):right[key];
                    return String(a??'').localeCompare(String(b??''),'vi',{numeric:true,sensitivity:'base'})*sortDirection;
                });
            }
            const pages = Math.max(1, Math.ceil(filtered.length / 10)); current = Math.min(current, pages - 1);
            const visible=filtered.slice(current * 10, current * 10 + 10).map((row,index)=>config.numbered?{...row,__rowNumber:current*10+index+1}:row);
            table(el, columns, visible, actions);
            if(config.sortable)$$('thead th',el).forEach((th,index)=>{
                if(!config.sortKeys?.[index])return;
                th.style.cursor='pointer';th.title='Sắp xếp cột này';th.setAttribute('aria-sort',sortIndex===index?(sortDirection===1?'ascending':'descending'):'none');
                th.onclick=()=>{sortDirection=sortIndex===index?-sortDirection:1;sortIndex=index;current=0;render();};
            });
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
        if (window.AAIRTerminologyPage) return window.AAIRTerminologyPage({request,notice,user});
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
        const systemPrompt = await request('/prompts/system-default').catch(() => '');
        const modal = $('#modalContent'), name = $('input', modal), [description, content] = $$('textarea', modal), [active, model] = $$('select', modal);
        fieldLabel(active, 'Status'); options(active, [['true','ACTIVE'],['false','INACTIVE']]);
        const save = buttons(/^Create Prompt$/, modal)[0];
        const reset = () => { editing = null; name.value = ''; description.value = ''; content.value = systemPrompt; active.value = 'true'; model.selectedIndex = 0; save.textContent = 'Create Prompt'; };
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
        const list = listTable(await request(endpoint), [['No.',r=>r.__rowNumber],['Username',userIdentity],['Gmail','email'],['Role','role'],['Status',r=>canManageUsers?status(r):'ACTIVE'],['Created',r=>date(r.created_at)],['Actions','$actions']], row => canManageUsers ? [
            action('edit',()=>edit(row)), action(row.is_active?'block':'check_circle',async()=>{
                if (!confirm(`${row.is_active?'Khóa':'Mở khóa'} tài khoản ${row.username}?`)) return;
                await request(`/users/${row.id}`,{method:'PUT',json:{role:row.role,active:!row.is_active}}); await refresh();
            }),
        ] : [], canManageUsers ? [[r=>r.role, roles], r=>status(r)] : ['role', r=>'ACTIVE'], {numbered:true,sortable:true,sortKeys:[null,'username','email','role',r=>status(r),'created_at',null]});
        const modal=$('#modalContent'), [username,unused,email] = $$('input:not([type="checkbox"])',modal), role=$('select',modal);
        let editing=null;
        fieldLabel(username,'Username'); username.placeholder='e.g. manager02';
        unused.parentElement.hidden=true;
        fieldLabel(email,'Gmail'); email.placeholder='username@gmail.com'; email.type='email';
        fieldLabel(role,'Role'); options(role,roles);
        role.insertBefore(new Option('— Không chọn —',''), role.firstChild);
        const save=buttons(/^Create$/,modal)[0];
        const reset=()=>{editing=null;username.value='';username.disabled=false;email.value='';email.disabled=false;role.value='MANAGER';save.textContent='Create';$('h3',modal).textContent='Create User';};
        function edit(row){reset();editing=row;username.value=row.username;username.disabled=true;email.value=row.email||'';email.disabled=true;if(![...role.options].some(o=>o.value===row.role))role.add(new Option(row.role,row.role));role.value=row.role;save.textContent='Save';$('h3',modal).textContent='Edit User';modalOpen();}
        bindText(/New Manager|New User/,()=>{reset();modalOpen();});
        bind(save,async()=>{
            const isEditing=Boolean(editing);
            const json=editing?{role:role.value,active:editing.is_active}:{username:required(username,'tên tài khoản'),email:required(email,'Gmail'),role:role.value};
            await request(editing?`/users/${editing.id}`:'/users',{method:editing?'PUT':'POST',json});
            modalClose();reset();await refresh();
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
        const selected=container=>$$('input:checked',container).map(i=>i.value);
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
        const assistanceSection=document.createElement('div');
        assistanceSection.className='space-y-2';
        assistanceSection.innerHTML='<label class="block text-[11px] font-semibold text-on-surface">AI assistance</label><select id="taskAssistanceMode" class="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-[12px]"><option value="NONE">Không dùng AI hỗ trợ</option><option value="AI_ASSISTED">Có AI hỗ trợ</option></select><p class="text-[10px] text-on-surface-variant">Dùng để so sánh thời gian làm thủ công và có AI hỗ trợ.</p>';
        modelSection.after(assistanceSection);
        const assistanceMode=$('#taskAssistanceMode',assistanceSection);
        const modelSearch=$('input[placeholder="Search AI models..."]',modal);modelSearch.parentElement.hidden=true;
        checkList(memberList,assignees.map(u=>({id:u.id,name:`${u.username} — ${u.role}`})),'members');
        const userSection=memberList.parentElement;
        const userSearchRow=memberList.previousElementSibling;
        const userCountSpan=$$('span',userSection).find(s=>/Selected$/.test(text(s)));

        const manualAssignContainer=document.createElement('div');
        manualAssignContainer.id='manualAssignContainer';
        manualAssignContainer.className='space-y-4';
        manualAssignContainer.innerHTML=`
            <div class="space-y-1.5">
                <label class="text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                    Manual Labeler 1 <span class="text-error font-normal">*</span>
                </label>
                <select id="manualLabeler1" class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-body-md cursor-pointer">
                    <option value="">Select user...</option>
                </select>
            </div>
            <div class="space-y-1.5">
                <label class="text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                    Manual Labeler 2 <span class="font-normal normal-case text-on-surface-variant">(Optional)</span>
                </label>
                <select id="manualLabeler2" class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-body-md cursor-pointer">
                    <option value="">Select user (optional)...</option>
                </select>
            </div>
            <div class="space-y-1.5">
                <label class="text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                    Reviewer <span class="text-error font-normal">*</span>
                </label>
                <select id="manualReviewer" class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-body-md cursor-pointer">
                    <option value="">Select user...</option>
                </select>
            </div>
        `;
        userSection.appendChild(manualAssignContainer);

        const aiAssignContainer=document.createElement('div');
        aiAssignContainer.id='aiAssignContainer';
        aiAssignContainer.className='space-y-4';
        aiAssignContainer.innerHTML=`
            <div class="space-y-1.5">
                <label class="text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                    AI Labeler <span class="text-error font-normal">*</span>
                </label>
                <select id="aiLabeler" class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-body-md cursor-pointer">
                    <option value="">Select user...</option>
                </select>
            </div>
            <div class="space-y-1.5">
                <label class="text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                    Reviewer <span class="text-error font-normal">*</span>
                </label>
                <select id="aiReviewer" class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-body-md cursor-pointer">
                    <option value="">Select user...</option>
                </select>
            </div>
        `;
        userSection.appendChild(aiAssignContainer);

        const m1Select=$('#manualLabeler1',manualAssignContainer);
        const m2Select=$('#manualLabeler2',manualAssignContainer);
        const reviewerSelect=$('#manualReviewer',manualAssignContainer);

        const aiLabelerSelect=$('#aiLabeler',aiAssignContainer);
        const aiReviewerSelect=$('#aiReviewer',aiAssignContainer);

        let currentAssignees=assignees;
        let manualLabelers=currentAssignees.filter(u=>u.role==='MANUAL_LABELER');
        let aiLabelers=currentAssignees.filter(u=>u.role==='AI_LABELER');
        let reviewers=currentAssignees.filter(u=>u.role==='REVIEWER');

        function formatUserOptionLabel(user){
            if(!user)return '';
            const status=user.is_active===false?'INACTIVE':(user.status||'UNKNOWN');
            return `${user.username} — ${status}`;
        }

        function populateSelect(select,users,defaultLabel){
            const currentVal=select.value;
            select.replaceChildren();
            const defaultOpt=document.createElement('option');
            defaultOpt.value='';
            defaultOpt.textContent=defaultLabel;
            select.appendChild(defaultOpt);
            for(const u of users){
                const opt=document.createElement('option');
                opt.value=String(u.id);
                opt.textContent=formatUserOptionLabel(u);
                if(String(u.id)===currentVal)opt.selected=true;
                select.appendChild(opt);
            }
        }

        function populateManualOptions(){
            populateSelect(m1Select,manualLabelers,'Select user...');
            populateSelect(m2Select,manualLabelers,'Select user (optional)...');
            populateSelect(reviewerSelect,reviewers,'Select user...');
            syncAssignmentOptions();
        }

        function populateAiOptions(){
            populateSelect(aiLabelerSelect,aiLabelers,'Select user...');
            populateSelect(aiReviewerSelect,reviewers,'Select user...');
            syncAiAssignmentOptions();
        }

        function renderAssignmentDropdowns(assigneeList=currentAssignees){
            currentAssignees=assigneeList||[];
            manualLabelers=currentAssignees.filter(u=>u.role==='MANUAL_LABELER');
            aiLabelers=currentAssignees.filter(u=>u.role==='AI_LABELER');
            reviewers=currentAssignees.filter(u=>u.role==='REVIEWER');
            populateManualOptions();
            populateAiOptions();
        }
        window.renderAssignmentDropdowns=renderAssignmentDropdowns;

        function syncAssignmentOptions(){
            const val1=m1Select.value;
            const val2=m2Select.value;
            const valRev=reviewerSelect.value;

            $$('option',m1Select).forEach(opt=>{
                if(!opt.value)return;
                const taken=(opt.value===val2 && val2!=='')||(opt.value===valRev && valRev!=='');
                opt.disabled=taken;
                const user=manualLabelers.find(u=>String(u.id)===opt.value);
                if(user){
                    const label=formatUserOptionLabel(user);
                    opt.textContent=taken?`${label} (Selected)`:label;
                }
            });

            $$('option',m2Select).forEach(opt=>{
                if(!opt.value)return;
                const taken=(opt.value===val1 && val1!=='')||(opt.value===valRev && valRev!=='');
                opt.disabled=taken;
                const user=manualLabelers.find(u=>String(u.id)===opt.value);
                if(user){
                    const label=formatUserOptionLabel(user);
                    opt.textContent=taken?`${label} (Selected)`:label;
                }
            });

            $$('option',reviewerSelect).forEach(opt=>{
                if(!opt.value)return;
                const taken=(opt.value===val1 && val1!=='')||(opt.value===val2 && val2!=='');
                opt.disabled=taken;
                const user=reviewers.find(u=>String(u.id)===opt.value);
                if(user){
                    const label=formatUserOptionLabel(user);
                    opt.textContent=taken?`${label} (Selected)`:label;
                }
            });

            const count=[val1,val2,valRev].filter(Boolean).length;
            if(userCountSpan && !manualAssignContainer.hidden)userCountSpan.textContent=`${count} Selected`;
        }

        function syncAiAssignmentOptions(){
            const valAi=aiLabelerSelect.value;
            const valRev=aiReviewerSelect.value;

            $$('option',aiLabelerSelect).forEach(opt=>{
                if(!opt.value)return;
                const taken=(opt.value===valRev && valRev!=='');
                opt.disabled=taken;
                const user=aiLabelers.find(u=>String(u.id)===opt.value);
                if(user){
                    const label=formatUserOptionLabel(user);
                    opt.textContent=taken?`${label} (Selected)`:label;
                }
            });

            $$('option',aiReviewerSelect).forEach(opt=>{
                if(!opt.value)return;
                const taken=(opt.value===valAi && valAi!=='');
                opt.disabled=taken;
                const user=reviewers.find(u=>String(u.id)===opt.value);
                if(user){
                    const label=formatUserOptionLabel(user);
                    opt.textContent=taken?`${label} (Selected)`:label;
                }
            });

            const count=[valAi,valRev].filter(Boolean).length;
            if(userCountSpan && !aiAssignContainer.hidden)userCountSpan.textContent=`${count} Selected`;
        }

        m1Select.addEventListener('change',()=>{
            if(m1Select.value && m1Select.value===m2Select.value)m2Select.value='';
            if(m1Select.value && m1Select.value===reviewerSelect.value)reviewerSelect.value='';
            syncAssignmentOptions();
        });
        m2Select.addEventListener('change',()=>{
            if(m2Select.value && m2Select.value===m1Select.value)m1Select.value='';
            if(m2Select.value && m2Select.value===reviewerSelect.value)reviewerSelect.value='';
            syncAssignmentOptions();
        });
        reviewerSelect.addEventListener('change',()=>{
            if(reviewerSelect.value && reviewerSelect.value===m1Select.value)m1Select.value='';
            if(reviewerSelect.value && reviewerSelect.value===m2Select.value)m2Select.value='';
            syncAssignmentOptions();
        });

        aiLabelerSelect.addEventListener('change',()=>{
            if(aiLabelerSelect.value && aiLabelerSelect.value===aiReviewerSelect.value)aiReviewerSelect.value='';
            syncAiAssignmentOptions();
        });
        aiReviewerSelect.addEventListener('change',()=>{
            if(aiReviewerSelect.value && aiReviewerSelect.value===aiLabelerSelect.value)aiLabelerSelect.value='';
            syncAiAssignmentOptions();
        });

        renderAssignmentDropdowns(currentAssignees);

        let previousType='MANUAL';
        const syncSessionType=()=>{
            const type=selected(typeList)[0]||'MANUAL';
            if(type!==previousType){
                if(type==='AI'){
                    m1Select.value='';
                    m2Select.value='';
                    reviewerSelect.value='';
                    syncAssignmentOptions();
                }else{
                    aiLabelerSelect.value='';
                    aiReviewerSelect.value='';
                    syncAiAssignmentOptions();
                }
                previousType=type;
            }
            if(type==='AI'){
                assistanceMode.value='AI_ASSISTED';
                assistanceMode.disabled=true;
                manualAssignContainer.hidden=true;
                aiAssignContainer.hidden=false;
                if(userSearchRow)userSearchRow.hidden=true;
                memberList.hidden=true;
                syncAiAssignmentOptions();
            }else{
                assistanceMode.disabled=false;
                manualAssignContainer.hidden=false;
                aiAssignContainer.hidden=true;
                if(userSearchRow)userSearchRow.hidden=true;
                memberList.hidden=true;
                syncAssignmentOptions();
            }
        };
        typeList.addEventListener('change',syncSessionType);
        syncSessionType();

        for(const container of lists){
            const section=container.parentElement, search=$('input[placeholder^="Search"]',section);
            search?.addEventListener('input',()=>$$('label',container).forEach(l=>l.hidden=!text(l).toLowerCase().includes(search.value.toLowerCase())));
            bindText(/^Select All$/,()=>$$('input[type="checkbox"]',container).forEach(i=>i.checked=true),section);
            if(container===typeList)buttons(/^Select All$/,section).forEach(b=>b.hidden=true);
            container.addEventListener('change',()=>{
                const counter=$$('span',section).find(s=>/Selected$/.test(text(s)));if(counter && container!==memberList)counter.textContent=`${selected(container).length} Selected`;
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
            editing=null;name.value='';description.value='';dueDate.value='';name.disabled=false;description.disabled=false;
            $$('input',documentList).forEach(i=>i.checked=false);$$('input',memberList).forEach(i=>i.checked=false);
            documentList.parentElement.hidden=false;typeList.parentElement.hidden=false;dueDate.parentElement.parentElement.hidden=false;
            assistanceSection.hidden=false;assistanceMode.value='NONE';
            m1Select.value='';m2Select.value='';reviewerSelect.value='';
            aiLabelerSelect.value='';aiReviewerSelect.value='';
            const typeInputs=$$('input',typeList);if(typeInputs[0])typeInputs[0].checked=true;
            previousType='MANUAL';
            syncSessionType();
            save.textContent='Create Session';$('h3',modal).textContent='Create Session';
        };
        const edit=row=>{
            reset();editing=row;name.value=row.name;description.value=row.description||'';name.disabled=true;description.disabled=true;
            documentList.parentElement.hidden=true;typeList.parentElement.hidden=true;dueDate.parentElement.parentElement.hidden=true;
            assistanceSection.hidden=true;
            manualAssignContainer.hidden=true;aiAssignContainer.hidden=true;if(userSearchRow)userSearchRow.hidden=false;memberList.hidden=false;
            $$('input',memberList).forEach(i=>i.checked=row.members.some(m=>String(m.id)===i.value));save.textContent='Save Members';$('h3',modal).textContent='Assign Users';modalOpen();
        };
        const reloadAssignees=async()=>{
            try{
                const fetched=await request('/assignees');
                renderAssignmentDropdowns(fetched);
                checkList(memberList,currentAssignees.map(u=>({id:u.id,name:`${u.username} — ${u.role}`})),'members');
            }catch{}
        };
        const refresh=async()=>{list.reload(await request('/sessions'));await reloadAssignees();};
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
        bindText(/New Session|Create First Session/,async()=>{reset();modalOpen();await reloadAssignees();});
        bind(save,async()=>{
            const userIds=selected(memberList).map(Number);
            if(editing){await request(`/sessions/${editing.id}/members`,{method:'PUT',json:{userIds}});modalClose();await refresh();notice('Đã cập nhật thành viên.');return;}
            const type=selected(typeList)[0]||'MANUAL', docIds=selected(documentList).map(Number);

            if(type==='MANUAL'){
                required(name,'tên phiên');
                required(dueDate,'ngày hết hạn');
                const sessionDue=viDateToIso(dueDate.value);
                if(sessionDue.parsed<=new Date())throw new Error('Ngày hết hạn phải ở tương lai.');
                if(!docIds.length)throw new Error('Vui lòng chọn ít nhất một tài liệu PDF.');

                if(!m1Select.value)throw new Error('Vui lòng chọn Manual Labeler 1.');
                if(!reviewerSelect.value)throw new Error('Vui lòng chọn Reviewer.');

                const m1Id=Number(m1Select.value);
                const m2Id=m2Select.value?Number(m2Select.value):null;
                const revId=Number(reviewerSelect.value);

                const chosenIds=[m1Id,m2Id,revId].filter(Boolean);
                if(new Set(chosenIds).size!==chosenIds.length)throw new Error('Không được chọn trùng người dùng giữa các vai trò.');

                const m1User=currentAssignees.find(u=>u.id===m1Id);
                const m2User=m2Id?currentAssignees.find(u=>u.id===m2Id):null;
                const revUser=currentAssignees.find(u=>u.id===revId);

                if(!m1User || m1User.role!=='MANUAL_LABELER')throw new Error('Manual Labeler 1 phải có vai trò MANUAL_LABELER.');
                if(m2User && m2User.role!=='MANUAL_LABELER')throw new Error('Manual Labeler 2 phải có vai trò MANUAL_LABELER.');
                if(!revUser || revUser.role!=='REVIEWER')throw new Error('Reviewer phải có vai trò REVIEWER.');

                const manualLabelerIds=[m1Id];
                if(m2Id)manualLabelerIds.push(m2Id);

                const payload={
                    name:name.value.trim(),
                    description:description.value?description.value.trim():null,
                    sessionType:'MANUAL',
                    dueAt:sessionDue.iso,
                    documents:docIds,
                    manualLabelerIds,
                    aiLabelerId:null,
                    reviewerId:revId,
                    assistanceMode:assistanceMode.value
                };

                await request('/sessions',{method:'POST',json:payload});
                modalClose();reset();await refresh();notice('Đã tạo session thành công');
                return;
            }

            if(type==='AI'){
                required(name,'tên phiên');
                required(dueDate,'ngày hết hạn');
                const sessionDue=viDateToIso(dueDate.value);
                if(sessionDue.parsed<=new Date())throw new Error('Ngày hết hạn phải ở tương lai.');
                if(!docIds.length)throw new Error('Vui lòng chọn ít nhất một tài liệu PDF.');

                if(!aiLabelerSelect.value)throw new Error('Vui lòng chọn AI Labeler.');
                if(!aiReviewerSelect.value)throw new Error('Vui lòng chọn Reviewer.');

                const aiId=Number(aiLabelerSelect.value);
                const revId=Number(aiReviewerSelect.value);

                if(aiId===revId)throw new Error('Không được chọn trùng người dùng giữa các vai trò.');

                const aiUser=currentAssignees.find(u=>u.id===aiId);
                const revUser=currentAssignees.find(u=>u.id===revId);

                if(!aiUser || aiUser.role!=='AI_LABELER')throw new Error('AI Labeler phải có vai trò AI_LABELER.');
                if(!revUser || revUser.role!=='REVIEWER')throw new Error('Reviewer phải có vai trò REVIEWER.');

                const payload={
                    name:name.value.trim(),
                    description:description.value?description.value.trim():null,
                    sessionType:'AI',
                    dueAt:sessionDue.iso,
                    documents:docIds,
                    manualLabelerIds:[],
                    aiLabelerId:aiId,
                    reviewerId:revId,
                    assistanceMode:assistanceMode.value
                };

                await request('/sessions',{method:'POST',json:payload});
                modalClose();reset();await refresh();notice('Đã tạo session thành công');
                return;
            }
        });
    }
    async function taskList() {
        const rows=await request('/tasks');
        listTable(rows,[['Document','document_title'],['Session','session_name'],['Annotator','assignee'],['Type','task_type'],['Status','status'],['Due',r=>date(r.due_at)],['Action','$actions']],row=>[
            action('Open',()=>go(`Task.html?id=${row.id}`)),
        ],['session_name','status']);
    }
    async function legacyResultAnalysisPage() {
        window.AAIRSharedHeader?.mount(user);
        setupDocumentSidebar({
            sidebar:$('#raDocuments'),
            workspace:$('.ra-layout'),
            storagePrefix:'aair.resultAnalysis.documentSidebar',
            defaultWidth:156,
            handleClass:'document-sidebar-handle--analysis'
        });
        const qs=new URLSearchParams(location.search);
        const requestedId=qs.get('id');
        const tasks=await request('/tasks');
        const taskSelect=$('#raTaskSelect');
        const durationEl=$('#raSessionDuration');
        let currentTimerSessionId=Symbol('initial');
        let sessionTimerInterval=null;
        const formatSessionDuration=totalSeconds=>{
            const s=Math.max(0,Math.floor(totalSeconds));
            const hours=Math.floor(s/3600);
            const minutes=Math.floor((s%3600)/60);
            const seconds=s%60;
            return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        };
        window.AAIR=window.AAIR||{};window.AAIR.formatSessionDuration=formatSessionDuration;
        const updateSessionTimer=task=>{
            const sessionId=task?.session_id??null;
            const startedAt=task?.session_started_at??null;
            if(sessionId===currentTimerSessionId)return;
            currentTimerSessionId=sessionId;
            if(sessionTimerInterval){clearInterval(sessionTimerInterval);sessionTimerInterval=null;}
            if(!durationEl)return;
            if(!startedAt){durationEl.textContent='—:—:—';durationEl.title='Phiên chưa bắt đầu';return;}
            const startMs=new Date(startedAt).getTime();
            if(isNaN(startMs)){durationEl.textContent='—:—:—';return;}
            durationEl.title=`Bắt đầu: ${startedAt}`;
            const tick=()=>{
                const elapsedSec=Math.max(0,Math.floor((Date.now()-startMs)/1000));
                durationEl.textContent=formatSessionDuration(elapsedSec);
            };
            tick();
            sessionTimerInterval=window.setInterval(tick,1000);
        };
        const documents=$('#raDocumentList');
        const modelASelect=$('#raModelA');
        const modelBSelect=$('#raModelB');
        const resultsA=$('#raResultsA');
        const resultsB=$('#raResultsB');
        const note=$('#raNote');
        const noteCompare=$('#raNoteCompare');
        const correctionPrompt=$('#raCorrectionPrompt');
        const originalPrompt=$('#raOriginalPrompt');
        const correctionResult=$('#raCorrectionResult');
        const pdf=$('#raPdf');
        const pdfEmpty=$('#raPdfEmpty');
        const state={tasks,task:null,rows:[],models:[],modelA:'',modelB:'',analyzed:false,page:1,pdfUrl:null,noteRow:null,noteCompare:null,redoRunId:null,completionGuard:null};
        const fieldLabels={company_name:'Company Name',ticker:'Ticker',industry:'Industry',report_period:'Report Period',report_year:'Report Year',revenue:'Revenue'};
        const value=row=>row?.indicator_value??row?.label_value??row?.value??'No value';
        const fieldLabel=row=>fieldLabels[key(row)]||row?.indicator_name||row?.label_name||'Unnamed field';
        const key=row=>String(row?.indicator_name??row?.label_name??row?.term??'').trim().toLowerCase();
        const modelKey=row=>row?.run_id?`run::${row.run_id}`:`saved::${row?.provider||'AI'}::${row?.model||row?.provider||'Model'}`;
        const pct=row=>{const n=Number(row?.confidence);return Number.isFinite(n)?`${Math.round(n<=1?n*100:n)}%`:'—';};
        const name=task=>task?.document_title||task?.title||`Document #${task?.id||''}`;
        const setMessage=message=>{const el=$('#raMessage');if(el)el.textContent=message||'';};
        const selectTask=(id)=>{
            const next=tasks.find(row=>String(row.id)===String(id))||tasks[0];
            if(!next)return;
            state.task=next;state.analyzed=false;state.page=1;
            taskSelect.value=String(next.id);
            $('#raSession').textContent=next.session_name||'AI Results';
            $('#raType').textContent=next.task_type||'AI';
            $('#raDocumentTitle').textContent=name(next);
            updateSessionTimer(next);
            renderDocuments();
            loadTaskResults();
        };
        const renderDocuments=()=>{
            documents.replaceChildren();
            tasks.forEach(row=>{
                const button=document.createElement('button');
                button.type='button';button.className=state.task?.id===row.id?'active':'';button.dataset.taskId=String(row.id);
                button.title=name(row);
            const label=document.createElement('span');label.innerHTML=`${name(row)}<small>${row.session_name||'Unknown session'} · Task #${row.id}</small>`;button.dataset.status=row.status==='APPROVED'||row.status==='SUBMITTED'?'done':'pending';
            button.append(label);button.onclick=()=>selectTask(row.id);documents.append(button);
            });
        };
        const renderModels=()=>{
            const fill=select=>{select.replaceChildren(new Option('Select a result source',''),...state.models.map(model=>new Option(`${model.provider} · ${model.model}${model.runId?` · ${String(model.runId).slice(0,8)}`:''}`,model.key)));select.disabled=state.models.length<1;};
            fill(modelASelect);fill(modelBSelect);
            state.modelA=state.modelA||state.models[0]?.key||'';state.modelB=state.modelB||state.models[1]?.key||'';
            if(state.modelA===state.modelB&&state.models[1])state.modelB=state.models[1].key;
            modelASelect.value=state.modelA;modelBSelect.value=state.modelB;
        };
        const rowsFor=model=>state.rows.filter(row=>modelKey(row)===model);
        const rowFor=(rows,indicator)=>rows.find(row=>key(row)===indicator);
        const draw=(target,rows,other,side)=>{
            target.replaceChildren();
            if(!rows.length){const empty=document.createElement('p');empty.className='ra-empty-results';empty.textContent='No results for this model.';target.append(empty);return;}
            rows.forEach(row=>{
                const compare=rowFor(other,key(row));
                const different=state.analyzed&&(!compare||String(value(row))!==String(value(compare)));
                const card=document.createElement('article');card.className=`ra-result${different?' different':''}`;
                const top=document.createElement('div');top.className='ra-result__top';
                const title=document.createElement('div');const label=document.createElement('span');label.className='ra-label';label.textContent='Indicator';
                const strong=document.createElement('strong');strong.textContent=fieldLabel(row);strong.title=row.indicator_name||row.label_name||'';title.append(label,strong);top.append(title);
                if(different){const badge=document.createElement('span');badge.className='ra-difference';badge.textContent='Different';top.append(badge);}
                const valueLabel=document.createElement('span');valueLabel.className='ra-label';valueLabel.textContent=`Value ${side}`;
                const parsed=splitLabelValue(value(row),row.source_label||row.source_text);const valueText=document.createElement('div');valueText.className='ra-value';const valueNode=document.createElement('div');valueNode.textContent=parsed.editableValue||'No value';valueText.append(valueNode);if(parsed.sourceLabel){const sourceText=document.createElement('small');sourceText.className='ra-source-text';sourceText.textContent=`Source: ${parsed.sourceLabel}`;valueText.append(sourceText);}
                const meta=document.createElement('div');meta.className='ra-meta';
                const confidence=document.createElement('span');confidence.textContent=`Confidence ${pct(row)}`;
                const source=document.createElement('button');source.className='ra-source';source.type='button';source.textContent=`Page ${row.source_page||'—'} · Go to page`;
                source.onclick=event=>{event.stopPropagation();openPage(row.source_page);};
                meta.append(confidence,source);card.append(top,valueLabel,valueText,meta);
                card.onclick=()=>openNote(row,compare);target.append(card);
            });
        };
        const renderResults=()=>{
            const a=rowsFor(state.modelA),b=rowsFor(state.modelB);
            const selectedA=state.models.find(model=>model.key===state.modelA),selectedB=state.models.find(model=>model.key===state.modelB);
            $('#raModelAMeta').textContent=selectedA?`${selectedA.provider} · ${selectedA.model}`:'';$('#raModelBMeta').textContent=selectedB?`${selectedB.provider} · ${selectedB.model}`:'';
            draw(resultsA,a,b,'A');draw(resultsB,b,a,'B');
            const all=[...new Set([...a,...b].map(key).filter(Boolean))];
            const differences=state.analyzed?all.filter(indicator=>{const left=rowFor(a,indicator),right=rowFor(b,indicator);return !left||!right||String(value(left))!==String(value(right));}):[];
            $('#raDifferenceCount').textContent=String(differences.length);
        };
        const openPage=page=>{
            const next=Number(page);if(!Number.isInteger(next)||next<1)return;
            state.page=next;$('#raPageLabel').textContent=`Page ${next}`;
            if(state.pdfUrl)pdf.src=`${state.pdfUrl}#page=${next}`;
        };
        const loadPdf=async()=>{
            if(state.pdfUrl)URL.revokeObjectURL(state.pdfUrl);state.pdfUrl=null;
            pdf.removeAttribute('src');pdf.hidden=true;pdfEmpty.hidden=false;
            if(!state.task?.document_id)return;
            const blob=await request(`/documents/${state.task.document_id}/file`,{blob:true});
            state.pdfUrl=URL.createObjectURL(blob);pdf.src=`${state.pdfUrl}#page=${state.page}&zoom=100&toolbar=0`;pdf.hidden=false;pdfEmpty.hidden=true;
        };
        const loadTaskResults=async()=>{
            const taskId=state.task.id;
            const [detail,aiRows]=await Promise.all([
                request(`/tasks/${taskId}`),
                request(`/tasks/${taskId}/ai-results`,{suppressAuthRedirect:true}).catch(()=>[]),
            ]);
            if(state.task.id!==taskId)return;
            state.task=Object.assign(state.task,detail);
            const savedProvider=state.task.task_type==='MANUAL'?'Manual Labeler':'AI Labeler';
            const savedModel=state.task.assignee?`Saved result · ${state.task.assignee}`:'Saved result';
            const savedRows=Array.isArray(detail.labels)?detail.labels.map(row=>({
                provider:savedProvider,model:savedModel,indicator_name:row.label_name,
                indicator_value:row.label_value,source_page:row.source_page,confidence:row.confidence,
            })):[];
            state.rows=[...aiRows,...savedRows];
            state.models=[...new Map(state.rows.map(row=>[modelKey(row),{key:modelKey(row),provider:row.provider||'AI',model:row.model||row.provider||'Model',runId:row.run_id||null}])).values()];
            state.modelA='';state.modelB='';renderModels();syncModelOptions();renderResults();setMessage('');
            try{await loadPdf();}catch(error){setMessage(error.message); }
            await state.completionGuard?.refresh();
        };
        const openNote=(row,compare)=>{
            state.noteRow=row;state.noteCompare=compare;state.redoRunId=null;note.hidden=false;
            noteCompare.replaceChildren();
            [[state.modelA,value(row)],[state.modelB,compare?value(compare):'Missing result']].forEach(([model,result])=>{const box=document.createElement('div');const provider=document.createElement('span');provider.textContent=model||'Model';const content=document.createElement('b');content.textContent=String(result);box.append(provider,content);noteCompare.append(box);});
            correctionPrompt.value=`Check indicator ${row.indicator_name||row.label_name||''} on page ${row.source_page||''}. Read the source label accurately, do not infer values, and return JSON with value, unit, source_page, source_label, and confidence.`;
            originalPrompt.value='Extract financial indicators from the report and always include value, unit, source_page, source_label, and confidence.';
            correctionResult.textContent='';
        };
        taskSelect.replaceChildren(...tasks.map(row=>new Option(`${name(row)} · Task #${row.id}`,String(row.id))));
        const initial=tasks.find(row=>String(row.id)===String(requestedId))||tasks[0];
        if(!initial){setMessage('No assigned task.');return;}
        taskSelect.onchange=()=>selectTask(taskSelect.value);
        const syncModelOptions=()=>{[...modelBSelect.options].forEach(option=>{option.disabled=option.value===state.modelA;});[...modelASelect.options].forEach(option=>{option.disabled=option.value===state.modelB;});const analyze=$('#raAnalyze');const blocked=!state.modelA||!state.modelB||state.modelA===state.modelB;analyze.disabled=blocked;analyze.title=blocked?'Select two different result sources.':'Analyze differences between the two sources';};
        modelASelect.onchange=()=>{state.modelA=modelASelect.value;if(state.modelA===state.modelB)state.modelB=[...modelBSelect.options].find(option=>!option.disabled&&option.value!==state.modelA)?.value||'';state.analyzed=false;syncModelOptions();renderResults();};
        modelBSelect.onchange=()=>{state.modelB=modelBSelect.value;if(state.modelA===state.modelB){setMessage('The two models must be different result sources.');state.analyzed=false;}syncModelOptions();renderResults();};
        $('#raAnalyze').onclick=()=>{state.analyzed=Boolean(state.modelA&&state.modelB&&state.modelA!==state.modelB);renderResults();setMessage(state.analyzed?'Differences between the two models have been analyzed.':'Select two different result sources.');};
        const saveNote=document.createElement('button');saveNote.type='button';saveNote.className='ra-secondary-button';saveNote.textContent='Save NOTE';correctionResult.after(saveNote);
        const confirmRedo=document.createElement('button');confirmRedo.type='button';confirmRedo.className='ra-secondary-button';confirmRedo.hidden=true;confirmRedo.textContent='Confirm redo result';saveNote.after(confirmRedo);
        saveNote.onclick=async()=>{if(!state.task||!state.noteRow)return;const noteText=correctionPrompt.value.trim();if(!noteText){setMessage('Enter a NOTE explaining the error.');return;}await request(`/analysis/tasks/${state.task.id}/fields/${encodeURIComponent(key(state.noteRow))}`,{method:'PUT',json:{note:noteText,redoRunId:null,redoConfirmed:false}});await state.completionGuard?.refresh();setMessage('NOTE saved for the field.');};
        confirmRedo.onclick=async()=>{if(!state.task||!state.noteRow||!state.redoRunId)return;await request(`/analysis/tasks/${state.task.id}/fields/${encodeURIComponent(key(state.noteRow))}`,{method:'PUT',json:{note:null,redoRunId:state.redoRunId,redoConfirmed:true}});confirmRedo.hidden=true;await state.completionGuard?.refresh();setMessage('Redo result confirmed.');};
        $('#raCloseNote').onclick=()=>{note.hidden=true;};
        $('#raRunCorrection').onclick=async()=>{
            if(!state.task||!correctionPrompt.value.trim())return;
            const button=$('#raRunCorrection');button.disabled=true;correctionResult.textContent='Running AI again…';
            try{const selected=state.models.find(model=>model.key===state.modelA);const provider=selected?.provider||'Gemini';const response=await request(`/tasks/${state.task.id}/run-ai`,{method:'POST',json:{provider,prompt:correctionPrompt.value}});state.redoRunId=response?.runId||null;confirmRedo.hidden=!state.redoRunId;correctionResult.textContent=`AI reran ${response?.labels?.length||0} indicators with ${response?.provider||provider}. Review and confirm the redo result.`;}catch(error){correctionResult.textContent=error.message;}finally{button.disabled=false;}
        };
        $('#raImprovePrompt').onclick=()=>{originalPrompt.value=`${originalPrompt.value.trim()} For each indicator, compare the source label in the same context; do not infer values; always return value, unit, source_page, source_label, and confidence.`;};
        window.addEventListener('pagehide',()=>{if(state.pdfUrl)URL.revokeObjectURL(state.pdfUrl);if(sessionTimerInterval)clearInterval(sessionTimerInterval);});
        state.completionGuard=AAIR.SessionCompletion?.create({button:$('#raCompleteAnalysis'),loadStatus:()=>request(`/session-completion${state.task?.session_id?`?sessionId=${state.task.session_id}`:''}`),findItem:item=>$(`[data-task-id="${item.id}"]`,documents),blockedTitle:'Resolve all differences in all documents before completing the analysis'});
        $('#raCompleteAnalysis').onclick=async()=>{if(state.completionGuard&&!await state.completionGuard.ensure('Analysis cannot be completed yet'))return;await request('/analysis/complete',{method:'POST',json:{sessionId:state.task?.session_id||null}});await state.completionGuard?.refresh();setMessage('The session analysis is complete.');};
        syncModelOptions();selectTask(initial.id);
    }
    async function taskPage() {
        if(document.body.matches('.ai-task-page,.manual-task-page')){
            setupDocumentSidebar();
            setupTaskWorkspace();
        }
        if(user?.role==='RESULT_ANALYST'&&document.body.classList.contains('result-analysis-page')){await legacyResultAnalysisPage();return;}
        // The old processing strip contained static demo values, not live API progress.
        $('#processingPanel')?.remove();
        const [tasks,prompts,systemPrompt]=await Promise.all([
            request('/tasks'),
            ['AI_LABELER','MANUAL_LABELER'].includes(user.role)
                ?request('/prompts/options',{suppressAuthRedirect:true}).catch(()=>[])
                :Promise.resolve([]),
            ['AI_LABELER','MANUAL_LABELER'].includes(user.role)
                ?request('/prompts/system-default',{suppressAuthRedirect:true}).catch(()=> '')
                :Promise.resolve(''),
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
                const status=document.createElement('span');status.className='document-status';
                const statusIcon=document.createElement('span');statusIcon.className='material-symbols-outlined';
                const states={PENDING:['schedule','Chưa làm'],IN_PROGRESS:['edit','Đang làm'],SUBMITTED:['check_circle','Hoàn thành'],APPROVED:['check_circle','Hoàn thành'],REJECTED:['error','Có lỗi']};
                const [statusName,statusLabel]=states[row.status]||['schedule','Chưa làm'];
                statusIcon.textContent=statusName;status.append(statusIcon);status.title=statusLabel;b.dataset.status=row.status||'PENDING';
                b.append(icon,label,status);b.title=row.document_title;b.setAttribute('aria-label',`Mở tài liệu ${row.document_title} - ${statusLabel}`);
                bind(b,()=>loadTask(row));documentButtons.set(row.id,b);container.append(b);
            }
        }
        // Render each extracted field as a compact review card.
        const heading=$$('main h2,main h3').find(h=>['Extracted Information','Thông tin trích xuất'].includes(text(h)));
        let panel=$('[data-annotation-panel]')||heading?.parentElement;
        const reviewBodies=$$('main .overflow-y-auto').filter(el=>$('input[type="checkbox"]',el));
        if(!panel)panel=reviewBodies[0];
        if(!panel)throw new Error('Không tìm thấy vùng nhãn của tác vụ.');
        const labeler=['AI_LABELER','MANUAL_LABELER'].includes(user.role);
        let readonly=!labeler;
        const cards=[];
        let pdfPageCount=null,queueAutoSave=()=>{},flushAutoSave=async()=>{};
        const clearCards=()=>{
            cards.length=0;
            if(heading){const keep=[...panel.children].filter(c=>c===heading||c.classList.contains('annotation-panel-save')||c.contains(heading)||$$('h2,h3',c).some(h=>['Document Information','Thông tin tài liệu'].includes(text(h))));[...panel.children].filter(c=>!keep.includes(c)).forEach(c=>c.remove());}
            else panel.replaceChildren();
        };
        function addLabel(row={labelName:'',labelValue:'',sourceLabel:'',sourcePage:null,confidence:null}){
            const card=document.createElement('article');card.className='annotation-field-card annotation-field-card--legacy';
            const parts=splitLabelValue(row.labelValue,row.sourceLabel);
            const top=document.createElement('div');top.className='annotation-field-card__top';
            const friendlyLabels={company_name:'Tên công ty',industry:'Ngành nghề',report_period:'Kỳ báo cáo',report_year:'Năm báo cáo',revenue:'Doanh thu',total_assets:'Tổng tài sản',equity:'Vốn chủ sở hữu',cfo:'Dòng tiền từ HĐKD',cfi:'Dòng tiền từ HĐĐT',cff:'Dòng tiền từ HĐTC',net_cash_flow:'Dòng tiền thuần'};
            const key=String(row.labelName||'').trim().toLowerCase();
            const labelBlock=document.createElement('span');labelBlock.className='annotation-field-name';
            const friendly=document.createElement('strong');friendly.textContent=friendlyLabels[key]||row.labelName||'Field mới';
            const technical=document.createElement('small');technical.textContent=row.labelName||'field_key';labelBlock.append(friendly,technical);
            const termInput=document.createElement('input');termInput.type='text';termInput.value=row.labelName||'';termInput.maxLength=150;termInput.setAttribute('aria-label','Tên field');termInput.className='annotation-term-input';termInput.disabled=readonly;termInput.hidden=true;
            const stateBadge=document.createElement('span');stateBadge.className='annotation-status';
            const editButton=document.createElement('button');editButton.type='button';editButton.className='annotation-icon-button';editButton.title=readonly?'Bấm Mở khóa để chỉnh sửa':'Sửa field';editButton.disabled=readonly;editButton.innerHTML='<span class="material-symbols-outlined">edit</span>';
            const confirmButton=document.createElement('button');confirmButton.type='button';confirmButton.className='annotation-icon-button annotation-icon-button--confirm';confirmButton.title='Xác nhận (Enter)';confirmButton.innerHTML='<span class="material-symbols-outlined">check</span>';
            top.append(labelBlock,termInput,stateBadge,editButton,confirmButton);
            const valueInput=document.createElement('textarea');valueInput.value=parts.editableValue;valueInput.placeholder='Nhập giá trị...';valueInput.maxLength=20000;valueInput.rows=4;valueInput.setAttribute('aria-label','Giá trị field');valueInput.className='annotation-definition-input';valueInput.disabled=readonly;
            const meta=document.createElement('div');meta.className='annotation-field-card__meta';
            const pageInput=document.createElement('input');pageInput.type='number';pageInput.min='1';pageInput.max=String(pdfPageCount||9999);pageInput.step='1';pageInput.required=true;pageInput.value=row.sourcePage==null?'':String(row.sourcePage);pageInput.setAttribute('aria-label','Trang nguồn');pageInput.className='annotation-page-input';pageInput.disabled=readonly;pageInput.hidden=true;
            const pageButton=document.createElement('button');pageButton.type='button';pageButton.className='annotation-page-chip';pageButton.title='Đến trang nguồn trong PDF';
            const confidence=document.createElement('span');confidence.className='annotation-confidence';const confidencePct=row.confidence==null?null:Math.round(row.confidence*100);confidence.textContent=`AI ${confidencePct==null?'—':`${confidencePct}%`}`;confidence.dataset.level=confidencePct==null?'unknown':confidencePct>=90?'high':confidencePct>=70?'medium':'low';
            const currentValue=parts.editableValue.trim();const suspicious=(key==='report_period'&&currentValue&&/^fy$/i.test(currentValue))||(key==='report_year'&&currentValue&&!/^\d{4}$/.test(currentValue))||(key==='revenue'&&currentValue&&!/[\d]/.test(currentValue));
            const warning=document.createElement('span');warning.className='annotation-warning';warning.hidden=!suspicious;warning.title='Giá trị cần kiểm tra lại với tài liệu nguồn.';warning.innerHTML='<span class="material-symbols-outlined">warning</span>';
            const sourceToggle=document.createElement('button');sourceToggle.type='button';sourceToggle.className='annotation-source-toggle';sourceToggle.textContent='Xem nguồn';sourceToggle.disabled=!pageInput.value;sourceToggle.title=pageInput.value?'Xem nhãn nguồn':'Chưa có trang nguồn';
            meta.append(pageButton,pageInput,confidence,warning,sourceToggle);
            const hasSavedValue=Boolean(row.labelName||row.labelValue||row.sourcePage);
            const saveState=document.createElement('span');saveState.className='annotation-save-state';
            const cardState={termInput,valueInput,pageInput,sourceLabel:parts.sourceLabel,confidence:row.confidence,saveState,dirty:false,saved:hasSavedValue,confirmed:false};
            const paintState=()=>{const state=readonly?'Chỉ xem':cardState.confirmed?'Đã duyệt':cardState.dirty?'Đã chỉnh sửa':hasSavedValue?'Chưa duyệt':'Chưa nhập';stateBadge.textContent=state;stateBadge.dataset.state=readonly?'readonly':cardState.confirmed?'confirmed':cardState.dirty?'edited':'pending';saveState.textContent=readonly?'Chỉ xem':cardState.dirty?'Chưa lưu':cardState.saved?'Đã lưu':'Chưa nhập';pageButton.textContent=pageInput.value?`Trang ${pageInput.value}`:'Chưa có trang';pageButton.disabled=!pageInput.value;sourceToggle.disabled=!pageInput.value;sourceToggle.title=pageInput.value?'Xem nguồn':'Chưa có trang nguồn';};
            const changed=()=>{if(readonly)return;cardState.dirty=true;cardState.confirmed=false;saveState.dataset.state='dirty';paintState();queueAutoSave(cardState);};
            const jumpToSource=()=>{const page=Number(pageInput.value);if(!Number.isInteger(page)||page<1)return;const iframe=$('#pdfViewer');const viewer=iframe?.contentWindow?.PDFViewerApplication?.pdfViewer;if(viewer){viewer.currentPageNumber=page;return;}if(iframe?.src)iframe.src=iframe.src.replace(/#.*/,'')+`#page=${page}&zoom=page-width`;};
            const original={term:termInput.value,value:valueInput.value,page:pageInput.value};
            editButton.onclick=()=>{if(card.classList.contains('is-editing')){termInput.value=original.term;valueInput.value=original.value;pageInput.value=original.page;valueInput.readOnly=true;pageInput.disabled=true;cardState.dirty=false;card.classList.remove('is-editing');labelBlock.hidden=false;termInput.hidden=true;pageInput.hidden=true;paintState();return;}card.classList.add('is-editing');labelBlock.hidden=true;termInput.hidden=false;termInput.disabled=readonly;valueInput.readOnly=false;pageInput.disabled=false;pageInput.hidden=false;termInput.focus();};
            confirmButton.onclick=()=>{cardState.confirmed=true;changed();paintState();};
            const definitionLabel=document.createElement('label');definitionLabel.className='annotation-legacy-label';definitionLabel.textContent='Definition';
            const source=document.createElement('div');source.className='annotation-source-label';source.hidden=false;
            const sourceTitle=document.createElement('strong');sourceTitle.textContent='NHÃN NGUỒN';
            const sourceValue=document.createElement('span');sourceValue.textContent=parts.sourceLabel||'Chưa có nhãn nguồn từ AI';
            source.append(sourceTitle,sourceValue);
            sourceToggle.onclick=()=>{if(sourceToggle.disabled)return;source.hidden=!source.hidden;sourceToggle.textContent=source.hidden?'Xem nguồn':'Ẩn nguồn';};pageButton.onclick=jumpToSource;
            termInput.addEventListener('input',changed);valueInput.addEventListener('input',changed);pageInput.addEventListener('input',changed);
            valueInput.addEventListener('keydown',event=>{if(event.key==='Escape'&&card.classList.contains('is-editing')){editButton.click();return;}if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();confirmButton.click();}if(event.key==='Tab'&&!event.shiftKey){const index=cards.indexOf(cardState);const next=cards[index+1];if(next){event.preventDefault();next.valueInput.focus();}}});
            card.append(top,definitionLabel,valueInput,meta,source);paintState();cards.push(cardState);panel.append(card);return valueInput;
        }
        const editor={
            get value(){return JSON.stringify(cards.map(c=>{const editableValue=c.valueInput.value;return {labelName:c.termInput.value.trim(),labelValue:c.sourceLabel?`${editableValue}\nNhãn nguồn: ${c.sourceLabel}`:editableValue,sourcePage:c.pageInput.value?Number(c.pageInput.value):null,confidence:c.confidence};}).filter(c=>c.labelName||c.labelValue));},
            set value(value){clearCards();const rows=JSON.parse(value);rows.forEach(addLabel);if(!rows.length&&labeler)addLabel();const saveDock=panel.querySelector('.annotation-panel-save');if(saveDock)panel.append(saveDock);},
            get readOnly(){return readonly;},
            set readOnly(value){readonly=value;cards.forEach(c=>{c.termInput.disabled=readonly;c.valueInput.readOnly=readonly;c.pageInput.disabled=readonly;c.saveState.textContent=readonly?'Chỉ xem':c.dirty?'Chưa lưu':c.saved?'Đã lưu':'Chưa nhập';});},
            focus(){cards[0]?.valueInput.focus();},
        };
        editor.value='[]';
        reviewBodies.slice(1).forEach(body=>body.replaceChildren());
        // Other extraction/status panels contain mock results and are unavailable until an inference API exists.
        $$('main h2,main h3').filter(h=>['Extraction Status','Processing Details'].includes(text(h))).forEach(h=>{
            const section=h.parentElement;[...section.children].filter(c=>c!==h).forEach(c=>c.remove());const p=document.createElement('p');p.textContent='Chưa có dữ liệu xử lý AI.';section.append(p);
        });
        $$('main h3').filter(h=>['Document Information','Thông tin tài liệu'].includes(text(h))).forEach(h=>{while(h.nextSibling)h.nextSibling.remove();});
        // Result comparison has two extraction panels; no synthetic second result.
        $$('main h2,main h3').filter(h=>text(h)==='Extracted Information'&&h!==heading).forEach(h=>{
            while(h.nextSibling)h.nextSibling.remove();const p=document.createElement('p');p.textContent='Kết quả tác vụ được hiển thị trong vùng nhãn bên cạnh.';h.parentElement.append(p);
        });
        const modelSelect=$('header select');
        const aiHeader=$$('main h2').find(h=>text(h)==='AI Extraction')?.parentElement;
        const aiContent=aiHeader?.parentElement?.querySelector('.overflow-y-auto');
        const promptSelect=$('#aiPromptSelect');
        if(modelSelect && ['AI_LABELER','MANUAL_LABELER'].includes(user.role)){
            const models=user.role==='MANUAL_LABELER'?['Gemini']:['Gemini','Claude','ChatGPT','Groq'];
            options(modelSelect,models.map(model=>[model,model]));
            modelSelect.insertBefore(new Option('Choose Model',''),modelSelect.firstChild);modelSelect.value=user.role==='MANUAL_LABELER'?'Gemini':'';modelSelect.disabled=false;
            const updatePrompts=()=>{
                if(!promptSelect)return;
                const rows=prompts.filter(row=>row.is_active!==false && ['Gemini','Claude','ChatGPT','Groq'].includes(String(row.model||'')));
                promptSelect.replaceChildren(new Option('System default prompt','__default__'),...rows.map(row=>new Option(`${row.name} · ${row.model||'Any model'}`,String(row.id))));
                if(!rows.some(row=>String(row.id)===promptSelect.value))promptSelect.value='__default__';
            };
            updatePrompts();
            promptSelect?.addEventListener('change',()=>{
                const row=prompts.find(item=>String(item.id)===promptSelect.value);
                if(!row?.model)return;
                const model=String(row.model);
                if([...modelSelect.options].some(option=>option.value===model))modelSelect.value=model;
                updatePrompts();
                promptSelect.value=String(row.id);
                    const runButton=buttons(/Run AI|Chạy AI/)[0];
                if(runButton){
                    runButton.disabled=false;
                    runButton.style.opacity='';
                    runButton.title='';
                }
            });
            modelSelect.addEventListener('change',()=>{updatePrompts();if(modelSelect.value)notice(`Đã chọn model ${modelSelect.value}.`);});
        }else if(modelSelect){options(modelSelect,[],true);modelSelect.disabled=true;}
        if(!initial){
            buttons(/Save|Submit|Nộp bài|Approve|Analyze/).forEach(b=>unavailable(b,'Chưa được phân công tác vụ.'));
            notice(id?'Không tìm thấy tác vụ hoặc bạn không có quyền truy cập.':'Chưa có tác vụ được phân công.',Boolean(id));return;
        }
        let task, fileUrl, workTimer, completionGuard;
        const title=$('#sessionTitle');
        const type=null;
        const docHeading=$$('main h3').find(h=>['Document Information','Thông tin tài liệu'].includes(text(h)));
        let docInfo;
        if(docHeading){while(docHeading.nextSibling)docHeading.nextSibling.remove();docInfo=document.createElement('p');docHeading.after(docInfo);docHeading.textContent='Thông tin tài liệu';}
        if(heading)heading.textContent='Thông tin trích xuất';
        const renderTask=()=>{
            editor.value=JSON.stringify(task.labels.map(l=>({labelName:l.label_name,labelValue:l.label_value,sourcePage:l.source_page,confidence:l.confidence})),null,2);
            editor.readOnly=!labeler||['SUBMITTED','APPROVED'].includes(task.status);
            document.title=`${task.document_title} — ${task.status}`;
        };
        const refresh=async()=>{task=await request(`/tasks/${task.id}`);renderTask();};
        async function loadTask(row){
            if(task&&task.id!==row.id)await flushAutoSave();
            if(workTimer)await workTimer.stop('MANUAL');
            task=await request(`/tasks/${row.id}`);
            pdfPageCount=null;
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
                if(iframe){
                    const viewerUrl=`/resource/pdfjs/viewer.html?file=${encodeURIComponent(fileUrl)}&title=${encodeURIComponent(task.document_title)}#page=1&zoom=page-width`;
                    const openedTaskId=task.id;
                    iframe.onload=()=>{
                        const addPdfControls=()=>{
                            const documentInFrame=iframe.contentDocument;
                            const toolbar=documentInFrame?.querySelector('#toolbarViewerRight');
                            if(!toolbar||documentInFrame.querySelector('[data-aair-pdf-control]'))return;
                            [['fit-width','↔','Vừa chiều rộng'],['fit-page','□','Vừa toàn trang'],['rotate','↻','Xoay trang']].forEach(([action,icon,title])=>{
                                const button=documentInFrame.createElement('button');button.type='button';button.dataset.aairPdfControl=action;button.title=title;button.className='toolbarButton';button.textContent=icon;
                                button.onclick=()=>{const viewer=iframe.contentWindow?.PDFViewerApplication?.pdfViewer;if(!viewer)return;if(action==='fit-width')viewer.currentScaleValue='page-width';if(action==='fit-page')viewer.currentScaleValue='page-fit';if(action==='rotate')viewer.pagesRotation=(viewer.pagesRotation+90)%360;};toolbar.append(button);
                            });
                        };
                        let attempts=0;
                        const syncPageCount=()=>{
                            if(task.id!==openedTaskId)return;
                            const count=Number(iframe.contentWindow?.PDFViewerApplication?.pdfDocument?.numPages||0);
                            if(count>0){pdfPageCount=count;cards.forEach(card=>{card.pageInput.max=String(count);card.pageInput.title=`Trang hợp lệ: 1-${count}`;});addPdfControls();return;}
                            if(++attempts<30)setTimeout(syncPageCount,200);
                        };
                        syncPageCount();
                    };
                    iframe.removeAttribute('srcdoc');iframe.src=viewerUrl;iframe.title=task.document_title;
                }
                if(labeler && !['SUBMITTED','APPROVED'].includes(task.status) && AAIR.createWorkTimer) workTimer=AAIR.createWorkTimer({taskId:task.id});
                notice(`Đã mở tài liệu ${task.document_title}.`);
                if(completionGuard)await completionGuard.refresh();
            } catch(error) {
                if(iframe)iframe.srcdoc=`<p style="font-family:sans-serif;padding:24px;color:#b91c1c">Không tải được tài liệu PDF.</p>`;
                throw error;
            }
        }
        await loadTask(initial);
        const submitTaskButton=buttons(/^(Submit Task|Nộp bài)$/)[0];
        if(window.AAIR.SessionCompletion&&submitTaskButton){
            completionGuard=AAIR.SessionCompletion.create({
                button:submitTaskButton,
                loadStatus:()=>request(`/session-completion${task?.session_id?`?sessionId=${task.session_id}`:''}`),
                findItem:documentStatus=>documentButtons.get(Number(documentStatus.id)),
                blockedTitle:status=>`Còn ${(status.missingItems||[]).length} tài liệu chưa hoàn tất`,
                onStatus:status=>{
                    const reported=status.documents||[];
                    const sessionTasks=reported.length?reported:tasks.filter(item=>String(item.session_id)===String(task?.session_id));
                    const total=sessionTasks.length,done=sessionTasks.filter(item=>item.status==='done'||['SUBMITTED','APPROVED','COMPLETED'].includes(item.status)).length;
                    const percent=total?Math.round(done/total*100):0;
                    const progress=$('#sessionProgressTrack'),bar=$('#sessionProgressBar'),label=$('#sessionProgressText');
                    if(progress)progress.setAttribute('aria-valuenow',String(percent));
                    if(bar)bar.style.width=`${percent}%`;
                    if(label)label.textContent=`${done}/${total} tài liệu · ${percent}%`;
                }
            });
            await completionGuard.refresh();
        }
        window.addEventListener('pagehide',()=>{if(fileUrl)URL.revokeObjectURL(fileUrl);});
        const runAiButton=buttons(/Run AI|Chạy AI/)[0];
        if(runAiButton && ['AI_LABELER','MANUAL_LABELER'].includes(user.role)){
            const updateRunAiState=()=>{
                const blocked=task?.task_type==='MANUAL'&&task?.assistance_mode==='NONE';
                runAiButton.disabled=blocked||!modelSelect?.value;
                runAiButton.style.opacity=runAiButton.disabled?'0.5':'';
                runAiButton.title=blocked?'Task này được cấu hình không dùng AI hỗ trợ.':runAiButton.disabled?'Vui lòng chọn model trước khi chạy AI.':'';
            };
            modelSelect?.addEventListener('change',updateRunAiState);updateRunAiState();
            bind(runAiButton,async()=>{
                if(!modelSelect?.value)throw new Error('Vui lòng chọn model trước khi chạy AI.');
                const oldMarkup=runAiButton.innerHTML;
                runAiButton.textContent='Running AI...';
                try{
                    const selectedPrompt=prompts.find(item=>String(item.id)===promptSelect?.value);
                    const prompt=selectedPrompt?.content||systemPrompt;
                    const result=await request(`/tasks/${task.id}/run-ai`,{method:'POST',json:{provider:modelSelect.value,prompt:prompt||null}});
                    editor.value=JSON.stringify(result.labels||[]);editor.readOnly=false;
                    cards.forEach(card=>{card.dirty=true;card.saveState.dataset.state='dirty';card.saveState.textContent='Chưa lưu';});
                    queueAutoSave();
                    notice(`Đã rút trích ${result.labels?.length||0} chỉ tiêu bằng ${result.provider}. Hãy kiểm tra rồi nhấn Save.`);
                }finally{runAiButton.innerHTML=oldMarkup;}
            });
        }else if(runAiButton)unavailable(runAiButton,'Chỉ AI Labeler được chạy mô hình AI.');
        function labels(){
            let data;try{data=JSON.parse(editor.value);}catch{throw new Error('Nhãn phải là JSON hợp lệ.');}
            if(!Array.isArray(data)||data.length>500||data.some(l=>!l||typeof l.labelName!=='string'||!l.labelName.trim()||l.labelName.length>150||!(l.labelValue==null||typeof l.labelValue==='string')||(l.labelValue?.length||0)>20000||!Number.isInteger(l.sourcePage)||l.sourcePage<1||(pdfPageCount&&l.sourcePage>pdfPageCount)||!(l.confidence==null||typeof l.confidence==='number'&&l.confidence>=0&&l.confidence<=1)))throw new Error(`Mỗi chỉ tiêu cần tên, giá trị, trang nguồn từ 1${pdfPageCount?`-${pdfPageCount}`:''} và confidence từ 0 đến 1 (hoặc null); tối đa 500 chỉ tiêu.`);
            return data;
        }
        let manualSaveButton=null;
        const save=async(showNotice=true,track=true,refreshAfter=true)=>{
            const data=labels();
            if(['PENDING','REJECTED'].includes(task.status)){await request(`/tasks/${task.id}/start`,{method:'POST'});task.status='IN_PROGRESS';}
            await request(`/tasks/${task.id}/labels`,{method:'PUT',json:{labels:data}});if(refreshAfter)await refresh();
            if(completionGuard)await completionGuard.refresh();
            if(track&&workTimer)await workTimer.stop('SAVE',true);
            if(showNotice)notice('Lưu dữ liệu thành công.');
        };
        if(labeler && panel){
            const saveWrap=document.createElement('div');saveWrap.className='annotation-panel-save';
            manualSaveButton=document.createElement('button');manualSaveButton.type='button';manualSaveButton.textContent='Lưu';manualSaveButton.disabled=true;manualSaveButton.className='annotation-save-button';
            saveWrap.append(manualSaveButton);panel.append(saveWrap);
            manualSaveButton.onclick=async()=>{if(manualSaveButton.disabled)return;manualSaveButton.disabled=true;manualSaveButton.textContent='Đang lưu…';try{await save();cards.forEach(card=>{card.dirty=false;card.saved=true;card.saveState.dataset.state='saved';card.saveState.textContent='Đã lưu';});}catch(error){manualSaveButton.disabled=false;manualSaveButton.textContent='Lưu';throw error;}manualSaveButton.textContent='Lưu';};
        }
        let autoSaveTimer=null,autoSavePromise=Promise.resolve();
        const setSaveState=(state,message)=>cards.filter(card=>card.dirty).forEach(card=>{card.saveState.dataset.state=state;card.saveState.textContent=message;});
        const performAutoSave=async()=>{
            if(readonly||!cards.some(card=>card.dirty))return false;
            setSaveState('saving','Đang lưu…');
            try{
                await save(false,false,false);
                cards.forEach(card=>{if(card.dirty){card.dirty=false;card.saved=true;card.saveState.dataset.state='saved';card.saveState.textContent='Đã lưu';}});
                return true;
            }catch(error){setSaveState('error','Lỗi lưu');notice(error.message,true);throw error;}
        };
        flushAutoSave=async()=>{
            if(autoSaveTimer){clearTimeout(autoSaveTimer);autoSaveTimer=null;}
            autoSavePromise=autoSavePromise.then(performAutoSave,performAutoSave);return autoSavePromise;
        };
        queueAutoSave=()=>{
            if(autoSaveTimer)clearTimeout(autoSaveTimer);
            if(manualSaveButton){manualSaveButton.disabled=false;return;}
            autoSaveTimer=setTimeout(()=>{autoSaveTimer=null;autoSavePromise=autoSavePromise.then(performAutoSave,performAutoSave);},1000);
        };
        buttons(/^Save$/).forEach(button=>button.remove());
        bindText(/^(Submit Task|Nộp bài)$/,async()=>{if(!labels().length)throw new Error('Cần ít nhất một nhãn trước khi nộp.');await flushAutoSave();if(['PENDING','REJECTED'].includes(task.status))await save(false,false,false);if(completionGuard&&!await completionGuard.ensure('Chưa thể Submit Task'))return;await request(`/tasks/${task.id}/submit`,{method:'POST'});if(workTimer)await workTimer.stop('SUBMIT');await refresh();if(completionGuard)await completionGuard.refresh();notice('Submit task thành công.');});
        if(labeler){
            const saveDock=panel.querySelector('.annotation-panel-save');
            if(saveDock) panel.append(saveDock);
        }
        if(aiContent){
            const topHeader=$$('header')[1];
            buttons(/^Edit$/,topHeader).forEach(button=>button.remove());
            const saveWrap=document.createElement('div');
            saveWrap.className='mt-6 flex justify-end border-t border-outline-variant pt-4';
            const saveButton=document.createElement('button');
            saveButton.type='button';
            saveButton.className='ai-save-results px-4 py-2 rounded-lg text-[12px] bg-button-active text-text-active hover:opacity-85 transition-opacity flex items-center gap-2 shadow-sm';
            saveButton.innerHTML='<span class="material-symbols-outlined text-[16px]">save</span>Save';
            saveWrap.append(saveButton);
            aiContent.append(saveWrap);
            bind(saveButton,async()=>{await save();if(user.role==='MANUAL_LABELER')exportJson(labels(),`task-${task.id}-labels.json`);});
        }
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
        notice(`${task.document_title} — ${task.status}`);
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
        if (window.AAIRPermissionsPage) return window.AAIRPermissionsPage({request,notice,user});
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
            const assigned=role==='USER'?users.filter(u=>!roles.includes(u.role)):users.filter(u=>u.role===role);
            if(count) count.textContent=`${assigned.length} Members`;
            const footer=count?.parentElement?.parentElement,avatars=footer?.firstElementChild;
            if(avatars){
                avatars.replaceChildren(...assigned.slice(0,3).map(member=>avatarNode(member,'w-6 h-6')));
                if(assigned.length>3){const more=document.createElement('span');more.className='w-6 h-6 rounded-full bg-surface-container-highest border-2 border-white inline-flex items-center justify-center text-[8px] font-bold';more.textContent=`+${assigned.length-3}`;avatars.append(more);}
            }
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
        const greeting=$$('header h2').find(h=>/^Good (Morning|Afternoon|Evening)/.test(text(h)));if(greeting){const currentGreeting=window.AAIRGreeting?.getGreeting?.(new Date())||'Good Morning,';greeting.textContent=`${currentGreeting} ${user.username}`;}
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
        const [data,tasks,assignees,sessions]=await Promise.all([request('/statistics'),request('/tasks'),request('/assignees'),request('/sessions')]);
        const main=$('main');
        main.className='manager-workflow';
        main.innerHTML=`<section class="manager-workflow__head"><div><p>WORKFLOW CONTROL</p><h2>Tiến độ gán nhãn và kiểm duyệt</h2></div><div class="manager-filters"><label>Session<select id="statsSession"><option value="">Tất cả session</option></select></label><label>AI assistance<select id="statsMode"><option value="">Tất cả chế độ</option><option value="NONE">NONE</option><option value="AI_ASSISTED">AI_ASSISTED</option></select></label></div></section><section id="statsKpis" class="manager-kpis"></section><section class="manager-grid"><div class="manager-panel manager-panel--wide"><div class="manager-panel__head"><div><span>TEAM DELIVERY</span><h3>Tiến độ theo người và section</h3></div><button id="exportStatistics" class="manager-icon-button" type="button" title="Xuất dữ liệu"><span class="material-symbols-outlined">download</span></button></div><div class="manager-table-wrap"><table><thead><tr><th>Người thực hiện</th><th>Task</th><th>Section</th><th>Tiến độ</th><th>Trễ hạn</th></tr></thead><tbody id="productivityBody"></tbody></table></div></div><div class="manager-panel"><div class="manager-panel__head"><div><span>TIME STUDY</span><h3>AI hỗ trợ và thủ công</h3></div></div><div id="timeComparison" class="time-comparison"></div></div><div class="manager-panel manager-panel--wide"><div class="manager-panel__head"><div><span>DEADLINES</span><h3>Task cần chú ý</h3></div><span id="overdueCount" class="danger-count"></span></div><div class="manager-table-wrap"><table><thead><tr><th>Tài liệu</th><th>Người thực hiện</th><th>Chế độ</th><th>Trạng thái</th><th>Deadline</th></tr></thead><tbody id="overdueBody"></tbody></table></div></div><div class="manager-panel"><div class="manager-panel__head"><div><span>PAIR REVIEW</span><h3>Tạo review case</h3></div></div><form id="reviewCaseForm" class="review-case-form"><label>Nguồn A<select id="reviewLeft" required></select></label><label>Nguồn B<select id="reviewRight" required></select></label><label>Reviewer<select id="reviewerSelect" required></select></label><label>Deadline<input id="reviewDue" type="datetime-local" required></label><button type="submit"><span class="material-symbols-outlined">compare_arrows</span>Tạo review case</button><p id="reviewCaseMessage"></p></form></div></section>`;
        const sessionSelect=$('#statsSession'),modeSelect=$('#statsMode');
        sessions.forEach(row=>sessionSelect.add(new Option(row.name,String(row.id))));
        const eligible=tasks.filter(row=>['SUBMITTED','APPROVED'].includes(row.status));
        const taskLabel=row=>`${row.document_title} · ${row.assignee||'Chưa gán'} · #${row.id}`;
        const fillTaskSelect=(select,rows)=>select.replaceChildren(new Option('Chọn task',''),...rows.map(row=>new Option(taskLabel(row),String(row.id))));
        fillTaskSelect($('#reviewLeft'),eligible);fillTaskSelect($('#reviewRight'),eligible);
        assignees.filter(row=>row.role==='REVIEWER').forEach(row=>$('#reviewerSelect').add(new Option(row.username,String(row.id))));
        $('#reviewLeft').addEventListener('change',event=>{const left=eligible.find(row=>String(row.id)===event.target.value);fillTaskSelect($('#reviewRight'),left?eligible.filter(row=>row.id!==left.id&&row.document_id===left.document_id):eligible);});
        const statusTotals=Object.fromEntries(data.statuses.map(row=>[row.status,Number(row.total)]));
        const render=()=>{
            const sessionId=sessionSelect.value,mode=modeSelect.value;
            const sections=(data.sectionProgress||[]).filter(row=>(!sessionId||String(row.session_id)===sessionId)&&(!mode||row.assistance_mode===mode));
            const taskIds=new Set(sections.map(row=>row.task_id));
            const people=(data.userProductivity||[]).filter(row=>!sessionId||sections.some(section=>section.username===row.username));
            const reviewed=sections.filter(row=>row.section_status==='REVIEWED').length,totalSections=sections.filter(row=>row.field_key).length;
            $('#statsKpis').innerHTML=[['Tổng task',taskIds.size||data.statuses.reduce((n,row)=>n+Number(row.total),0),'assignment'],['Đã duyệt',statusTotals.APPROVED||0,'task_alt'],['Section hoàn tất',`${reviewed}/${totalSections}`,'view_week'],['Task trễ hạn',(data.overdueTasks||[]).length,'warning']].map(([label,value,icon])=>`<article><span class="material-symbols-outlined">${icon}</span><small>${label}</small><strong>${value}</strong></article>`).join('');
            $('#productivityBody').innerHTML=people.length?people.map(row=>{const total=Number(row.saved_sections||0)+Number(row.submitted_sections||0)+Number(row.reviewed_sections||0),done=Number(row.reviewed_sections||0),percent=total?Math.round(done/total*100):0;return `<tr><td><b>${row.username||'Chưa phân công'}</b></td><td>${row.completed_tasks}/${row.assigned_tasks}</td><td>${done}/${total}</td><td><div class="progress-cell"><span style="width:${percent}%"></span></div><small>${percent}%</small></td><td><span class="${Number(row.overdue_tasks)?'status-overdue':'status-ok'}">${row.overdue_tasks||0}</span></td></tr>`;}).join(''):'<tr><td colspan="5">Chưa có dữ liệu phù hợp.</td></tr>';
        };
        const comparisons=data.timeComparison||[];const maxTime=Math.max(1,...comparisons.map(row=>Number(row.average_seconds)||0));
        $('#timeComparison').innerHTML=comparisons.length?comparisons.map(row=>`<div><header><b>${row.assistance_mode}</b><span>${Math.round(Number(row.average_seconds||0)/60)} phút TB · n=${row.sample_size}</span></header><span class="time-bar"><i style="width:${Number(row.average_seconds||0)/maxTime*100}%"></i></span><small>Trung vị ${Math.round(Number(row.median_seconds||0)/60)} phút</small></div>`).join(''):'<p>Chưa đủ task hoàn thành để so sánh thời gian.</p>';
        const overdue=data.overdueTasks||[];$('#overdueCount').textContent=`${overdue.length} quá hạn`;$('#overdueBody').innerHTML=overdue.length?overdue.map(row=>`<tr><td>${row.document_title}</td><td>${row.username||'—'}</td><td>${row.assistance_mode}</td><td><span class="status-overdue">${row.status}</span></td><td>${date(row.due_at)}</td></tr>`).join(''):'<tr><td colspan="5"><span class="status-ok">Không có task trễ hạn.</span></td></tr>';
        sessionSelect.addEventListener('change',render);modeSelect.addEventListener('change',render);render();
        bind($('#exportStatistics'),()=>exportJson(data,'aair-manager-statistics.json'));
        $('#reviewCaseForm').addEventListener('submit',event=>{event.preventDefault();run(event.submitter,async()=>{const leftId=Number($('#reviewLeft').value),rightId=Number($('#reviewRight').value),assignedTo=Number($('#reviewerSelect').value),due=$('#reviewDue').value;if(!leftId||!rightId||!assignedTo||!due)throw new Error('Vui lòng chọn đủ hai nguồn, Reviewer và deadline.');await request('/review-cases',{method:'POST',json:{leftTaskId:leftId,rightTaskId:rightId,assignedTo,dueAt:`${due}:00`}});$('#reviewCaseMessage').textContent='Đã tạo review case và giao Reviewer.';});});
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
        user=await AAIR.guard();if(!user)return;window.AAIRGuidelineModal?.init();
        const profile=$('header .hidden.md\\:block');
        if(profile){const ps=$$('p',profile);if(ps[0])ps[0].textContent=user.username;if(ps[1])ps[1].textContent=user.role==='RESULT_ANALYST'?'Analyst':user.role;
            const avatar=profile.previousElementSibling;if(avatar){avatar.replaceChildren();const node=avatarNode(user,'w-full h-full');avatar.append(node);}
            const logout=document.createElement('button');
            logout.type='button';logout.setAttribute('aria-label','Log out');logout.title='Log out of the system';
            logout.className='ml-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/40 bg-white/15 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70';
            const label=document.createElement('span');label.textContent='Log out';
            logout.append(label);bind(logout,()=>{if(confirm('Are you sure you want to log out?'))AAIR.logout();});
            profile.parentElement.append(logout);
        }
        if(page==='BaseManagement.html')await termsPage();
        else if(page==='Prompt.html')await promptsPage();
        else if(page==='ManagerManagement.html'||page==='UserManagement.html')await usersPage();
        else if(page==='DocumentManagement.html')await documentsPage();
        else if(page==='Session.html')await sessionsPage();
        else if(page==='ViewAll.html')await taskList();
        else if(page==='Task.html'&&document.body.classList.contains('review-page')) await request('/tasks').catch(()=>[]);
        else if(page==='Task.html')await taskPage();
        else if(page==='LogView.html')await logsPage();
        else if(page==='PermissionManagement.html')await permissionsPage();
        else if(page==='Dashboard.html'&&user.role==='RESULT_ANALYST'&&window.AAIRResultAnalysisDashboard)await window.AAIRResultAnalysisDashboard({request,user,notice,go});
        else if(page==='Dashboard.html')await dashboardPage();
        else if(page==='Statistics.html')await statisticsPage();
        else if(page==='SystemMonitoring.html')await monitoringPage();
        if(main)main.style.visibility='';
    }catch(error){
        $$('tbody').forEach(body=>{if(text(body)==='Đang tải dữ liệu…')$('td',body).textContent='Không tải được dữ liệu. Hãy thử lại.';});
        notice(error.message,true);
    }
})();
