import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logo } from '../assets'
import { getRoleConfig } from '../config/roles'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.title = 'Login | AAIR Lab'
    if (user) navigate(user.redirectPath || getRoleConfig(user.role).route, { replace: true })
  }, [navigate, user])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const loggedInUser = await login({
        username: form.username.trim(),
        password: form.password,
      })
      navigate(
        location.state?.from || loggedInUser.redirectPath || getRoleConfig(loggedInUser.role).route,
        { replace: true },
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col items-center justify-center p-md relative overflow-hidden h-screen">
      <div className="fixed inset-0 z-0 pointer-events-none" />

      <main className="relative z-10 w-full flex flex-col items-center h-full justify-center">
        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_20px_40px_rgba(0,0,0,0.06)] transition-all duration-300 max-w-[480px] p-2xl">
          <div className="flex flex-col items-center text-center mb-xl">
            <div className="mb-lg flex flex-col items-center gap-xs">
              <Link to="/">
                <img alt="AAIR Lab Logo" className="w-32 h-auto mb-xs" src={logo} />
              </Link>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Welcome To AAIR Lab&nbsp;</h1>
          </div>

          <form className="space-y-lg" id="loginForm" onSubmit={handleSubmit}>
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-1" htmlFor="username">Username</label>
              <div className="relative group input-focus-ring border border-outline-variant rounded-lg transition-all duration-200">
                <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]" data-icon="person">person</span>
                </div>
                <input
                  autoComplete="username"
                  className="block w-full pl-[48px] pr-md py-lg bg-transparent border-none focus:ring-0 text-on-surface placeholder-outline font-body-md rounded-lg"
                  id="username"
                  name="username"
                  onChange={updateField}
                  placeholder="Enter your username"
                  required
                  type="text"
                  value={form.username}
                />
              </div>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-1" htmlFor="password">Password</label>
              <div className="relative group input-focus-ring border border-outline-variant rounded-lg transition-all duration-200">
                <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]" data-icon="lock">lock</span>
                </div>
                <input
                  autoComplete="current-password"
                  className="block w-full pl-[48px] pr-[48px] py-lg bg-transparent border-none focus:ring-0 text-on-surface placeholder-outline font-body-md rounded-lg"
                  id="password"
                  name="password"
                  onChange={updateField}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-md flex items-center text-outline hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]" data-icon="visibility" id="passwordIcon">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer group" />
            </div>

            {error && <p className="legacy-login-error" role="alert">{error}</p>}

            <button
              className="ripple-effect custom-gradient-btn w-full h-[48px] rounded-lg text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-sm"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Signing In...' : 'Sign In'}
              <span className="material-symbols-outlined text-[18px]" data-icon="arrow_forward">arrow_forward</span>
            </button>
          </form>

          <div className="relative my-xl">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant" /></div>
            <div className="relative flex justify-center text-label-md" />
          </div>
        </div>

        <footer className="text-center absolute bottom-12">
          <p className="font-body-sm text-body-sm text-outline opacity-60">Version 1.0</p>
        </footer>
      </main>

      <div className="hidden lg:block absolute bottom-12 right-12 z-10">
        <div className="w-64 h-64 opacity-20" />
      </div>
    </div>
  )
}
