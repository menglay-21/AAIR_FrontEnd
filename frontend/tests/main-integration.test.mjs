import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

const root = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(root, 'main/JavaScript/workspace.js'), 'utf8')
const completionSource = readFileSync(resolve(root, 'main/JavaScript/sessionCompletion.js'), 'utf8')
const roleDirs = { ADMIN: 'Admin', MANAGER: 'Manager', AI_LABELER: 'User/AILabeling', MANUAL_LABELER: 'User/ManualLabeling', REVIEWER: 'User/ManualReview', RESULT_ANALYST: 'User/ResultAnalysis', TERMINOLOGY: 'User/Terminology' }
const task = { id: 31, document_id: 11, session_id: 21, document_title: 'API Document', session_name: 'API Session', task_type: 'MANUAL', assigned_to: 4, assignee: 'manual_labeler01', status: 'PENDING', labels: [{ label_name: 'Revenue', label_value: '<b>100</b>', source_page: 5, confidence: 0.8 }], reviews: [] }
const fixtures = {
  '/dashboard': { 'Tác vụ': 1, 'Chờ duyệt': 0, 'Đã duyệt': 0 },
  '/users': [{ id: 8, username: 'api_user', email: 'api@example.com', avatar_url: '/uploads/avatars/api.png', role: 'MANUAL_LABELER', is_active: true }],
  '/roles': ['ADMIN', 'MANAGER'],
  '/permissions?role=ADMIN': {
    role: 'ADMIN',
    members: 1,
    enabledPermissions: 6,
    totalPermissions: 32,
    restrictedFeatures: 4,
    coverage: 18.75,
    features: [
      { key: 'DASHBOARD', label: 'Dashboard', actions: { READ: true, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'USER_MANAGEMENT', label: 'User Management', actions: { READ: true, WRITE: true, EXECUTE: false, DELETE: false } },
      { key: 'PERMISSION_MANAGEMENT', label: 'Permission Management', actions: { READ: true, WRITE: true, EXECUTE: false, DELETE: false } },
      { key: 'AUDIT_LOGS', label: 'Audit Logs', actions: { READ: true, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'DOCUMENTS', label: 'Documents', actions: { READ: false, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'SESSIONS', label: 'Sessions', actions: { READ: false, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'TASKS', label: 'Tasks', actions: { READ: false, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'STATISTICS', label: 'Statistics', actions: { READ: false, WRITE: false, EXECUTE: false, DELETE: false } },
    ],
  },
  '/permissions?role=MANAGER': {
    role: 'MANAGER',
    members: 1,
    enabledPermissions: 11,
    totalPermissions: 32,
    restrictedFeatures: 2,
    coverage: 34.38,
    features: [
      { key: 'DASHBOARD', label: 'Dashboard', actions: { READ: true, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'USER_MANAGEMENT', label: 'User Management', actions: { READ: true, WRITE: true, EXECUTE: false, DELETE: false } },
      { key: 'PERMISSION_MANAGEMENT', label: 'Permission Management', actions: { READ: true, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'AUDIT_LOGS', label: 'Audit Logs', actions: { READ: false, WRITE: false, EXECUTE: false, DELETE: false } },
      { key: 'DOCUMENTS', label: 'Documents', actions: { READ: true, WRITE: true, EXECUTE: false, DELETE: true } },
      { key: 'SESSIONS', label: 'Sessions', actions: { READ: true, WRITE: true, EXECUTE: true, DELETE: false } },
      { key: 'TASKS', label: 'Tasks', actions: { READ: true, WRITE: true, EXECUTE: true, DELETE: false } },
      { key: 'STATISTICS', label: 'Statistics', actions: { READ: true, WRITE: false, EXECUTE: false, DELETE: false } },
    ],
  },
  '/assignees': [{id: 4, username: 'manual_labeler01', role: 'MANUAL_LABELER'}, {id: 3, username: 'ai_labeler01', role: 'AI_LABELER'}, {id: 5, username: 'reviewer01', role: 'REVIEWER'}],
  '/documents': [{ id: 11, title: 'API Document', original_name: 'sample.pdf', document_type: 'PDF', status: 'UPLOADED' }],
  '/sessions': [{ id: 21, name: 'API Session', description: '', session_type: 'MANUAL', status: 'DRAFT', members: [{id:4,username:'manual_labeler01'}] }],
  '/tasks': [task], '/tasks/31': task, '/tasks/31/ai-results': [],
  '/terms': [{id: 41, term: 'API Term', definition: '<script>alert(1)</script>', category: 'Accounting', status: 'ACTIVE'}],
  '/prompts': [{id: 51, name: 'API Prompt', description: 'Extract data', content: 'Prompt content', model: 'Custom', is_active: true}],
  '/prompts/options': [{id: 71, name: 'Gemini Prompt', description: '', content: 'Gemini content', model: 'Gemini', is_active: true}, {id: 72, name: 'Groq Prompt', description: '', content: 'Groq content', model: 'Groq', is_active: true}],
  '/prompts/system-default': 'System default content',
  '/audit-logs': [{id: 61, username: 'api_user', action: 'CREATE', resource_type: 'USER', resource_id: 4}],
  '/statistics': {statuses: [{status:'PENDING',total:1}], labels: [{label_name:'Revenue',total:1,average_confidence:0.8}], assignees:[{username:'manual_labeler01',total:1,approved:0}]},
}
async function setup(role, page, overrides = {}) {
  const path = `/main/HTML/${roleDirs[role]}/${page}`
  const dom = new JSDOM(readFileSync(resolve(root, path.slice(1)), 'utf8'), { url: `http://localhost:5173${path}`, runScripts: 'outside-only' })
  const w = dom.window, calls = [], state = structuredClone({...fixtures,...overrides})
  w.confirm = () => true
  w.prompt = () => null
  w.URL.createObjectURL = () => 'blob:test'
  w.URL.revokeObjectURL = () => {}
  w.AAIR = { guard: async () => ({id:1,username:'test_user',role}), assetUrl: path => path ? `http://localhost:8080${path}` : '', logout() {}, request: async (path, options={}) => {
    calls.push({path,...options})
    if(options.blob) return new w.Blob(['%PDF-'])
    if(path.startsWith('/session-completion')) return {allDone:true,missingItems:[],documents:[{id:31,name:'Report.pdf',status:'done',missingDetail:[]}]}
    if(options.method) {
      if(/^\/users\/\d+$/.test(path)&&options.method==='PUT') return {id:Number(path.split('/')[2]),...options.json}
      if(path.endsWith('/run-ai')) return {provider:options.json.provider,model:'test-model',labels:[{labelName:'revenue',labelValue:'1000000 VND',sourceLabel:'Doanh thu thuần',sourcePage:7,confidence:0.95}]}
      if(path.endsWith('/start')) state['/tasks/31'].status = 'IN_PROGRESS'
      if(path.endsWith('/labels')) state['/tasks/31'].labels = options.json.labels.map(l=>({label_name:l.labelName,label_value:l.labelValue,source_page:l.sourcePage,confidence:l.confidence}))
      if(path.endsWith('/submit')) state['/tasks/31'].status = 'SUBMITTED'
      if(path.startsWith('/permissions/')) return structuredClone(state[`/permissions?role=${path.split('/').pop()}`])
      return {id:99}
    }
    if (!(path in state)) throw new Error(`Unexpected API: ${path}`)
    return structuredClone(state[path])
  } }
  w.eval(readFileSync(resolve(root,'main/JavaScript/UserCreation.js'),'utf8'))
  w.eval(readFileSync(resolve(root,'main/JavaScript/adminLogView.js'),'utf8'))
  w.eval(completionSource)
  await w.eval(source)
  const settle = async () => { for(let i=0;i<12;i++) await new Promise(r=>setImmediate(r)) }
  await settle()
  const errors = () => [...w.document.querySelectorAll('#apiNotice')].filter(e=>e.style.color==='rgb(185, 28, 28)').map(e=>e.textContent)
  assert.deepEqual(errors(),[],`${path}: initialization failed`)
  const button = name => [...w.document.querySelectorAll('button')].find(b=>b.textContent.replace(/\s+/g,' ').trim()===name)
  return { dom, w, calls, settle, errors, button }
}
for (const [role,directory] of Object.entries(roleDirs)) {
  for (const page of readdirSync(resolve(root,'main/HTML',directory)).filter(p=>p.endsWith('.html'))) {
    test(`${role}: ${page} loads its API data`, async()=>{
      const ctx=await setup(role,page)
      try {
        assert.ok(ctx.calls.length, 'must call an API')
        assert.ok(ctx.w.document.querySelector('button[aria-label="Đăng xuất"]'), 'must show a visible logout button')
        assert.ok(!ctx.w.document.body.textContent.includes('Đang tải dữ liệu…'))
        assert.equal(ctx.w.document.querySelector('tbody script'), null, 'API text must not execute as HTML')
        if(page==='Task.html' && ctx.w.document.body.matches('.ai-task-page,.manual-task-page')) {
          assert.equal(ctx.w.document.querySelector('#processingPanel'),null,'removes the static processing strip')
          assert.equal(ctx.w.document.querySelector('[aria-label="Definition"]').value,'<b>100</b>', 'renders the real annotation')
          assert.equal(ctx.w.document.querySelector('[aria-label="Source Page"]').value,'5','renders the source page')
        }
      } finally {ctx.dom.window.close()}
    })
  }
}
test('manual label edits save before submit and preserve confidence',async()=>{
  const c=await setup('MANUAL_LABELER','Task.html')
  try {
    assert.equal(c.w.document.querySelector('#sessionProgressText').textContent,'1/1 tài liệu')
    const definition=c.w.document.querySelector('textarea[aria-label="Definition"]')
    definition.value='Updated value'
    definition.dispatchEvent(new c.w.Event('input',{bubbles:true}))
    c.button('Submit Task').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    const mutations=c.calls.filter(x=>x.method)
    assert.deepEqual(mutations.map(x=>x.path),['/tasks/31/start','/tasks/31/labels','/tasks/31/submit'])
    assert.deepEqual(JSON.parse(JSON.stringify(mutations[1].json.labels)),[{labelName:'Revenue',labelValue:'Updated value',sourcePage:5,confidence:0.8}])
    assert.equal(c.w.document.querySelector('#apiNotice')?.textContent,'Submit task thành công.')
    assert.ok(c.w.document.querySelector('#apiNotice').classList.contains('top-4'))
    assert.equal(definition.isConnected,false)
    assert.equal(c.w.document.querySelector('[aria-label="Definition"]').disabled,true)
  } finally {c.dom.window.close()}
})
test('term editor sends API field names and keeps content as text',async()=>{
  const c=await setup('TERMINOLOGY','BaseManagement.html')
  try {
    c.w.document.querySelector('input[placeholder="e.g. Operating Income"]').value='Test term'
    c.w.document.querySelector('textarea').value='Definition'
    const status=c.w.document.querySelector('#termStatus')
    assert.deepEqual([...status.options].map(option=>option.value),['ACTIVE','INACTIVE'])
    status.value='INACTIVE'
    c.button('Save Term').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    const call=c.calls.find(x=>x.method==='POST')
    assert.equal(call.path,'/terms');assert.equal(call.json.term,'Test term');assert.equal(call.json.status,'INACTIVE')
  } finally {c.dom.window.close()}
})
test('manager session form creates members and correctly assigned tasks',async()=>{
  const c=await setup('MANAGER','Session.html')
  try {
    c.w.document.querySelector('input[placeholder^="e.g."]').value='New Session'
    c.w.document.querySelector('input[name="documents"]').checked=true
    c.w.document.querySelector('input[name="members"][value="4"]').checked=true
    c.w.document.querySelector('[aria-label="Session due date"]').value='31/12/2099'
    c.button('Create Session').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    const mutations=c.calls.filter(x=>x.method)
    assert.deepEqual(mutations.map(x=>x.path),['/sessions','/sessions/99/members','/tasks'])
    assert.equal(mutations[0].json.dueAt,'2099-12-31T23:59:00')
    assert.equal(mutations[2].json.assignedTo,4);assert.equal(mutations[2].json.sessionId,99);assert.equal(mutations[2].json.documentId,11)
    assert.equal(c.w.document.querySelector('#apiNotice'),null,'non-Save/Submit actions must not show a popup')
  } finally {c.dom.window.close()}
})
test('manager uploads multiple PDF files in one selection and refreshes the database list',async()=>{
  const c=await setup('MANAGER','DocumentManagement.html')
  try {
    const input=c.w.document.querySelector('#documentInput')
    const files=[
      new c.w.File(['%PDF-1.7 first'],'first.pdf',{type:'application/pdf'}),
      new c.w.File(['%PDF-1.7 second'],'second.pdf',{type:'application/pdf'}),
    ]
    Object.defineProperty(input,'files',{configurable:true,value:files})
    input.dispatchEvent(new c.w.Event('change'));await c.settle()
    assert.deepEqual(c.errors(),[])
    ;[...c.w.document.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith('Save')).click();await c.settle()
    const uploads=c.calls.filter(x=>x.path==='/documents'&&x.method==='POST')
    assert.equal(uploads.length,2)
    assert.ok(c.calls.filter(x=>x.path==='/documents'&&!x.method).length>=2,'document list must refresh after upload')
  } finally {c.dom.window.close()}
})
test('AI labeler session list uses task API and filters by session',async()=>{
  const c=await setup('AI_LABELER','ViewAll.html')
  try {
    assert.ok(c.calls.some(x=>x.path==='/tasks'&&!x.method))
    const sessionFilter=c.w.document.querySelector('header select')
    assert.ok([...sessionFilter.options].some(option=>option.value==='API Session'))
    assert.ok(c.w.document.body.textContent.includes('API Session'))
  } finally {c.dom.window.close()}
})
test('clicking an assigned document loads its authenticated PDF at page 1 and 100% zoom',async()=>{
  const second={...task,id:32,document_id:12,document_title:'Second Document',task_type:'AI',assigned_to:3,assignee:'ai_labeler01'}
  const first={...task,task_type:'AI',assigned_to:3,assignee:'ai_labeler01'}
  const c=await setup('AI_LABELER','Task.html',{'/tasks':[first,second],'/tasks/31':first,'/tasks/32':second})
  try {
    c.w.document.querySelector('[aria-label="Mở tài liệu Second Document"]').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    assert.ok(c.calls.some(x=>x.path==='/documents/12/file'&&x.blob))
    assert.equal(new URL(c.w.location.href).searchParams.get('id'),'32')
    assert.equal(c.w.document.querySelector('#pdfViewer').getAttribute('src'),'/resource/pdfjs/viewer.html?file=blob%3Atest&title=Second%20Document#page=1&zoom=100')
    assert.equal(c.w.document.querySelector('[aria-label="Mở tài liệu Second Document"]').getAttribute('aria-current'),'true')
  } finally {c.dom.window.close()}
})
test('result analyst loads saved database labels and the matching PDF from task detail',async()=>{
  const taskSummary={...task,labels:undefined}
  const c=await setup('RESULT_ANALYST','Task.html',{'/tasks':[taskSummary],'/tasks/31':task,'/tasks/31/ai-results':[]})
  try {
    assert.ok(c.calls.some(x=>x.path==='/tasks/31'))
    assert.ok(c.calls.some(x=>x.path==='/documents/11/file'&&x.blob))
    assert.ok(c.w.document.body.textContent.includes('<b>100</b>'))
    assert.ok(c.w.document.body.textContent.includes('Manual Labeler'))
    assert.equal(c.w.document.querySelector('#raPdf').getAttribute('src'),'blob:test#page=1')
    assert.equal(c.w.document.querySelector('#raPdfEmpty').hidden,true)
  } finally {c.dom.window.close()}
})
test('AI labeler must choose one supported provider before running',async()=>{
  const aiTask={...task,task_type:'AI',assigned_to:3,assignee:'ai_labeler01'}
  const c=await setup('AI_LABELER','Task.html',{'/tasks':[aiTask],'/tasks/31':aiTask})
  try {
    const select=c.w.document.querySelector('header select')
    assert.equal(select.disabled,false)
    const values=[...select.options].map(option=>option.value)
    assert.deepEqual(values,['','Gemini','Claude','ChatGPT','Groq'])
    const runButton=[...c.w.document.querySelectorAll('button')].find(button=>button.textContent.includes('Run AI'))
    assert.equal(runButton.disabled,true)
    select.value='Gemini';select.dispatchEvent(new c.w.Event('change'))
    assert.equal(runButton.disabled,false)
    assert.equal(c.w.document.querySelector('#apiNotice'),null,'model selection must not show a task popup')
  } finally {c.dom.window.close()}
})
test('AI labeler can run the selected provider and render extracted source pages',async()=>{
  const aiTask={...task,task_type:'AI',assigned_to:3,assignee:'ai_labeler01'}
  const c=await setup('AI_LABELER','Task.html',{'/tasks':[aiTask],'/tasks/31':aiTask})
  try {
    const select=c.w.document.querySelector('header select')
    select.value='Gemini'
    select.dispatchEvent(new c.w.Event('change'))
    ;[...c.w.document.querySelectorAll('button')].find(button=>button.textContent.includes('Run AI')).click();await c.settle()
    const call=c.calls.find(x=>x.path==='/tasks/31/run-ai')
    assert.equal(call.json.provider,'Gemini')
    assert.equal(c.w.document.querySelector('[aria-label="Term"]').value,'revenue')
    assert.equal(c.w.document.querySelector('[aria-label="Definition"]').value,'1000000 VND')
    assert.equal(c.w.document.querySelector('[aria-label="Source Page"]').value,'7')
    assert.equal(c.w.document.querySelector('.annotation-source-label p').textContent,'Doanh thu thuần')
    assert.equal(c.w.document.body.textContent.includes('Validation Progress'),false)
    assert.equal(c.w.document.querySelector('#apiNotice'),null,'running AI must not show a task popup')
  } finally {c.dom.window.close()}
})
test('AI labeler prompt form creates a prompt through the API',async()=>{
  const c=await setup('AI_LABELER','Prompt.html')
  try {
    ;[...c.w.document.querySelectorAll('button')].find(button=>button.textContent.includes('New Prompt')).click();await c.settle()
    const modal=c.w.document.querySelector('#modalContent')
    modal.querySelector('input').value='Invoice extraction'
    const textareas=modal.querySelectorAll('textarea')
    textareas[0].value='Extract invoice fields'
    textareas[1].value='Return invoice number and total'
    const selects=modal.querySelectorAll('select')
    selects[0].value='true';selects[1].selectedIndex=1
    c.button('Create Prompt').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    const create=c.calls.find(x=>x.path==='/prompts'&&x.method==='POST')
    assert.equal(create.json.name,'Invoice extraction')
    assert.equal(create.json.content,'Return invoice number and total')
  } finally {c.dom.window.close()}
})
test('selecting a prompt automatically selects its model and keeps Run AI text-only',async()=>{
  const aiTask={...task,task_type:'AI',assigned_to:3,assignee:'ai_labeler01'}
  const c=await setup('AI_LABELER','Task.html',{'/tasks':[aiTask],'/tasks/31':aiTask})
  try {
    const model=c.w.document.querySelector('header select')
    const prompt=c.w.document.querySelector('#aiPromptSelect')
    const runButton=[...c.w.document.querySelectorAll('button')].find(button=>button.textContent.includes('Run AI'))
    assert.deepEqual([...prompt.options].map(option=>option.textContent),['System default prompt','Gemini Prompt · Gemini','Groq Prompt · Groq'])
    prompt.value='72';prompt.dispatchEvent(new c.w.Event('change'))
    assert.equal(model.value,'Groq')
    assert.equal(runButton.textContent.trim(),'Run AI')
    assert.equal(runButton.querySelector('.material-symbols-outlined'),null)
  } finally {c.dom.window.close()}
})
test('manager user page has the same create-user workflow as admin',async()=>{
  const c=await setup('MANAGER','UserManagement.html')
  try {
    ;[...c.w.document.querySelectorAll('button')].find(b=>b.textContent.includes('New User')).click();await c.settle()
    c.w.document.querySelector('[aria-label="Username"]').value='manager03'
    c.w.document.querySelector('[aria-label="Gmail"]').value='manager03@gmail.com'
    const role=c.w.document.querySelector('[aria-label="Role"]')
    assert.deepEqual([...role.options].map(o=>o.value),['','ADMIN','MANAGER'])
    role.value='MANAGER'
    c.button('Create').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    const create=c.calls.find(x=>x.path==='/users'&&x.method==='POST')
    assert.deepEqual(JSON.parse(JSON.stringify(create.json)),{username:'manager03',email:'manager03@gmail.com',role:'MANAGER'})
  } finally {c.dom.window.close()}
})
test('admin creates a user with Gmail and refreshes users without exposing a password field',async()=>{
  const c=await setup('ADMIN','ManagerManagement.html')
  try {
    ;[...c.w.document.querySelectorAll('button')].find(b=>b.textContent.includes('New Manager')).click();await c.settle()
    const username=c.w.document.querySelector('[aria-label="Username"]')
    const email=c.w.document.querySelector('[aria-label="Gmail"]')
    username.value='manager02'
    email.value='manager02@gmail.com'
    assert.equal(c.w.document.querySelector('[aria-label="Generated Password"]'),null)
    c.button('Create').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    const create=c.calls.find(x=>x.path==='/users'&&x.method==='POST')
    assert.deepEqual(JSON.parse(JSON.stringify(create.json)),{username:'manager02',email:'manager02@gmail.com',role:'MANAGER'})
    assert.ok(c.calls.filter(x=>x.path==='/users'&&!x.method).length>=2,'user list must refresh after creation')
  } finally {c.dom.window.close()}
})
test('user management numbers filtered and paginated rows independently from database IDs',async()=>{
  const users=Array.from({length:12},(_,index)=>({id:index+8,username:index===0?'admin':`manager${String(index).padStart(2,'0')}`,email:`user${index}@example.com`,role:index===0?'ADMIN':'MANAGER',is_active:true,created_at:'2026-09-12T10:00:00'}))
  const c=await setup('ADMIN','ManagerManagement.html',{'/users':users})
  try {
    const firstCell=()=>c.w.document.querySelector('tbody tr td')?.textContent.trim()
    assert.equal(firstCell(),'1','first visible row must not expose database id 8')
    c.button('chevron_right').click();await c.settle()
    assert.equal(firstCell(),'11','second page numbering must continue from page one')
    const search=c.w.document.querySelector('input[placeholder^="Search"]')
    search.value='manager05';search.dispatchEvent(new c.w.Event('input'));await c.settle()
    assert.equal(firstCell(),'1','filtering must renumber the resulting display order')
  } finally {c.dom.window.close()}
})
test('create user previews and uploads a validated avatar',async()=>{
  const c=await setup('ADMIN','ManagerManagement.html')
  try {
    ;[...c.w.document.querySelectorAll('button')].find(b=>b.textContent.includes('New Manager')).click();await c.settle()
    c.w.document.querySelector('[aria-label="Username"]').value='manager_avatar'
    c.w.document.querySelector('[aria-label="Gmail"]').value='manager.avatar@gmail.com'
    const input=c.w.document.querySelector('#userAvatarInput')
    const file=new c.w.File([new Uint8Array([0xff,0xd8,0xff,1])],'avatar.jpg',{type:'image/jpeg'})
    Object.defineProperty(input,'files',{configurable:true,value:[file]})
    input.dispatchEvent(new c.w.Event('change'));await c.settle()
    const preview=c.w.document.querySelector('img[alt="Avatar preview"]')
    assert.equal(preview.hidden,false)
    c.button('Create').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    const upload=c.calls.find(call=>call.path==='/users/99/avatar'&&call.method==='POST')
    assert.ok(upload?.body instanceof c.w.FormData)
    assert.equal(upload.body.get('file').name,'avatar.jpg')
  } finally {c.dom.window.close()}
})
test('edit user loads the current avatar and uploads its replacement',async()=>{
  const row={id:8,username:'admin',email:'admin@example.com',avatar_url:'/uploads/avatars/current.png',role:'ADMIN',is_active:true,created_at:'2026-09-12T10:00:00'}
  const c=await setup('ADMIN','ManagerManagement.html',{'/users':[row]})
  try {
    c.w.document.querySelector('button[aria-label="edit"]').click();await c.settle()
    const preview=c.w.document.querySelector('img[alt="Avatar preview"]')
    assert.equal(preview.src,'http://localhost:8080/uploads/avatars/current.png')
    const input=c.w.document.querySelector('#userAvatarInput')
    const replacement=new c.w.File([new Uint8Array([0x89,0x50,0x4e,0x47])],'replacement.png',{type:'image/png'})
    Object.defineProperty(input,'files',{configurable:true,value:[replacement]})
    input.dispatchEvent(new c.w.Event('change'));await c.settle()
    c.button('Save').click();await c.settle()
    assert.deepEqual(c.errors(),[])
    assert.ok(c.calls.some(call=>call.path==='/users/8'&&call.method==='PUT'))
    const upload=c.calls.find(call=>call.path==='/users/8/avatar'&&call.method==='POST')
    assert.equal(upload.body.get('file').name,'replacement.png')
  } finally {c.dom.window.close()}
})
test('admin permission matrix switches roles and saves changed actions',async()=>{
  const c=await setup('ADMIN','PermissionManagement.html')
  try {
    const managerHeading=[...c.w.document.querySelectorAll('h4')].find(h=>h.textContent.trim()==='Manager')
    managerHeading.closest('.group').click();await c.settle()
    assert.ok(c.calls.some(x=>x.path==='/permissions?role=MANAGER'&&!x.method))
    const readDashboard=c.w.document.querySelector('[aria-label="READ DASHBOARD"]')
    assert.equal(readDashboard.checked,true)
    assert.equal(c.w.document.querySelector('[aria-label="READ AUDIT_LOGS"]').disabled,true)
    readDashboard.click();await c.settle()
    ;[...c.w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Save Changes')).click();await c.settle()
    const save=c.calls.find(x=>x.path==='/permissions/MANAGER'&&x.method==='PUT')
    assert.deepEqual(JSON.parse(JSON.stringify(save.json)),{permissions:[{feature:'DASHBOARD',action:'READ',enabled:false}]})
  } finally {c.dom.window.close()}
})
test('empty datasets initialize without mock table records',async()=>{
  for(const [role,page,endpoint] of [['MANAGER','Session.html','/sessions'],['MANUAL_LABELER','Task.html','/tasks'],['TERMINOLOGY','BaseManagement.html','/terms']]){
    const c=await setup(role,page,{[endpoint]:[]})
    assert.deepEqual(c.errors(),[]);c.dom.window.close()
  }
})
