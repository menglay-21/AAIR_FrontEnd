import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { getRoleConfig } from '../config/roles'
import { api } from '../services/api'

const sections = {
  ADMIN: [['users', 'Người dùng'], ['audit-logs', 'Nhật ký']],
  MANAGER: [['documents', 'Tài liệu'], ['sessions', 'Phiên gán nhãn'], ['tasks', 'Phân công']],
  AI_LABELER: [['tasks', 'Tác vụ AI'], ['prompts', 'Prompt AI']],
  MANUAL_LABELER: [['tasks', 'Tác vụ của tôi']], REVIEWER: [['tasks', 'Hàng đợi duyệt']],
  RESULT_ANALYST: [['statistics', 'Báo cáo thống kê'], ['tasks', 'Kết quả chi tiết']],
  TERMINOLOGY: [['terms', 'Kho thuật ngữ']],
}
const formDefaults = {
  users: { username: '', email: '', role: 'MANAGER' },
  terms: { term: '', definition: '', category: '', status: 'ACTIVE' },
  prompts: { name: '', description: '', content: '', model: '', active: true },
  sessions: { name: '', description: '', sessionType: 'MANUAL' },
}
function err(e) { return e?.message || 'Không thể tải dữ liệu.' }
function Table({ rows }) {
  if (!rows.length) return <p className="empty-state">Chưa có dữ liệu.</p>
  const cols = Object.keys(rows[0]).filter((key) => !['password', 'storage_path', 'detail', 'members'].includes(key))
  return <div className="data-table-wrap"><table className="data-table"><thead><tr>{cols.map((key) => <th key={key}>{key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id ?? i}>{cols.map((key) => <td key={key}>{typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '—')}</td>)}</tr>)}</tbody></table></div>
}
function AddForm({ type, reload }) {
  const defaults = formDefaults[type]; const [open, setOpen] = useState(false); const [form, setForm] = useState(defaults); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (!defaults) return null
  const send = async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await api(`/${type}`, { method: 'POST', body: JSON.stringify(form) }); setOpen(false); setForm(defaults); reload() } catch (reason) { setError(err(reason)) } finally { setBusy(false) } }
  return <><button className="button button--primary data-new" onClick={() => setOpen(!open)} type="button">Thêm mới</button>{open && <form className="data-form" onSubmit={send}>{Object.keys(defaults).map((key) => {
    if (key === 'active') return <label key={key}><input checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} type="checkbox" /> Đang hoạt động</label>
    if (['definition', 'description', 'content'].includes(key)) return <label key={key}>{key}<textarea required={key !== 'description'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
    if (key === 'role') return <label key={key}>Vai trò<select value={form[key]} onChange={(e) => setForm({ ...form, role: e.target.value })}>{['ADMIN', 'MANAGER'].map((v) => <option key={v}>{v}</option>)}</select></label>
    if (key === 'status') return <label key={key}>Trạng thái<select value={form[key]} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>ACTIVE</option><option>INACTIVE</option></select></label>
    if (key === 'sessionType') return <label key={key}>Loại phiên<select value={form[key]} onChange={(e) => setForm({ ...form, sessionType: e.target.value })}><option>MANUAL</option><option>AI</option><option>MIXED</option></select></label>
    return <label key={key}>{key}<input required={key !== 'category' && key !== 'model'} type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
  })}{error && <p className="form-error">{error}</p>}<button className="button button--primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button></form>}</>
}
export default function WorkspaceDataPage() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const config = getRoleConfig(user.role); const groups = sections[user.role]; const [active, setActive] = useState(groups[0][0]); const [rows, setRows] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); setError(''); try { const result = await api(`/${active}`); const data = result.data; setRows(Array.isArray(data) ? data : Object.entries(data).flatMap(([group, value]) => Array.isArray(value) ? value.map((item) => ({ group, ...item })) : [{ group, value }])); } catch (reason) { setError(err(reason)) } finally { setLoading(false) } }
  useEffect(() => { load() }, [active])
  return <div className="workspace" style={{ '--role-accent': config.accent }}><aside className="workspace-sidebar"><Brand /><div className="workspace-user"><span>{user.username.slice(0, 2).toUpperCase()}</span><div><strong>{user.username}</strong><small>{config.label}</small></div></div><nav className="workspace-nav"><Link to={config.route}><span className="material-symbols-outlined">grid_view</span>Tổng quan</Link>{groups.map(([id, label]) => <button className={active === id ? 'active' : ''} key={id} onClick={() => setActive(id)} type="button"><span className="material-symbols-outlined">{id === 'tasks' ? 'assignment' : 'table_chart'}</span>{label}</button>)}</nav><div className="sidebar-bottom"><Link to="/"><span className="material-symbols-outlined">home</span>Trang chủ</Link><button onClick={() => { logout(); navigate('/login') }} type="button"><span className="material-symbols-outlined">logout</span>Đăng xuất</button></div></aside><main className="workspace-main"><header className="workspace-header"><div><p>{config.eyebrow}</p><strong>{config.label}</strong></div></header><div className="workspace-content"><div className="workspace-section__heading"><div><p className="section-kicker">DỮ LIỆU HỆ THỐNG</p><h2>{groups.find(([id]) => id === active)[1]}</h2></div></div><AddForm type={active} reload={load} />{error && <p className="form-error">{error}</p>}{loading ? <p>Đang tải dữ liệu…</p> : <Table rows={rows} />}</div></main></div>
}
