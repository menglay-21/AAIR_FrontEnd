import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { getRoleConfig } from '../config/roles'
import { api } from '../services/api'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const config = useMemo(() => getRoleConfig(user.role), [user.role])
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let alive = true
    api('/dashboard').then((response) => alive && setStats(response.data)).catch(() => {})
    return () => { alive = false }
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="workspace" style={{ '--role-accent': config.accent }}>
      <aside className={`workspace-sidebar ${menuOpen ? 'workspace-sidebar--open' : ''}`}>
        <Brand />
        <button className="sidebar-close" onClick={() => setMenuOpen(false)} type="button">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="workspace-user">
          <span>{user.username.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user.username}</strong>
            <small>{config.label}</small>
          </div>
        </div>
        <nav className="workspace-nav">
          <Link className="active" to={config.route}>
            <span className="material-symbols-outlined">grid_view</span> Tổng quan
          </Link>
          {config.actions.map(([title, , icon]) => (
            <a href={`#${title.toLowerCase().replaceAll(' ', '-')}`} key={title}>
              <span className="material-symbols-outlined">{icon}</span> {title}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/"><span className="material-symbols-outlined">home</span> Trang chủ</Link>
          <button onClick={handleLogout} type="button">
            <span className="material-symbols-outlined">logout</span> Đăng xuất
          </button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Đóng menu" />}

      <main className="workspace-main">
        <header className="workspace-header">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} type="button">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div>
            <p>{config.eyebrow}</p>
            <strong>{config.label}</strong>
          </div>
          <div className="workspace-header__right">
            <span className="status-dot">Hệ thống hoạt động</span>
            <button className="notification-button" type="button" aria-label="Thông báo">
              <span className="material-symbols-outlined">notifications</span><i />
            </button>
          </div>
        </header>

        <div className="workspace-content">
          <section className="welcome-panel">
            <div>
              <p className="section-kicker">WORKSPACE CỦA BẠN</p>
              <h1>Xin chào, {user.username}.</h1>
              <p>{config.description}</p>
            </div>
            <div className="role-badge">
              <span className="material-symbols-outlined">badge</span>
              <small>Vai trò hiện tại</small>
              <strong>{config.shortLabel}</strong>
            </div>
          </section>

          <section className="stats-grid" aria-label="Thống kê nhanh">
            {(stats ? Object.entries(stats).map(([label, value]) => [String(value), label]) : config.stats).map(([value, label]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small><i /> Cập nhật vừa xong</small>
              </article>
            ))}
          </section>

          <section className="workspace-section">
            <div className="workspace-section__heading">
              <div>
                <p className="section-kicker">TRUY CẬP NHANH</p>
                <h2>Công việc chính</h2>
              </div>
              <span>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date())}</span>
            </div>
            <div className="action-grid">
              {config.actions.map(([title, text, icon], index) => (
                <article id={title.toLowerCase().replaceAll(' ', '-')} key={title}>
                  <span className="action-grid__index">0{index + 1}</span>
                  <span className="action-grid__icon material-symbols-outlined">{icon}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <Link to={`${config.route}/data`}>Mở phân hệ <span className="material-symbols-outlined">arrow_forward</span></Link>
                </article>
              ))}
            </div>
          </section>

          <section className="account-note">
            <span className="material-symbols-outlined">shield_lock</span>
            <div>
              <strong>Phiên đăng nhập được bảo vệ</strong>
              <p>Tài khoản được xác thực qua API Spring Boot và token JWT được giữ trong phiên trình duyệt.</p>
            </div>
            <span className="account-note__active">ACTIVE</span>
          </section>
        </div>
      </main>
    </div>
  )
}
