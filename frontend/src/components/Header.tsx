import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function Header() {
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <header
      style={{
        backgroundColor: '#333',
        color: '#fff',
        padding: '15px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>
          TCG大会システム
        </Link>
        <nav style={{ display: 'flex', gap: '15px' }}>
          <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>
            ダッシュボード
          </Link>
          <Link to="/tournaments" style={{ color: '#fff', textDecoration: 'none' }}>
            大会一覧
          </Link>
          {(user?.role === 'organizer' || user?.role === 'admin') && (
            <Link to="/tournaments/new" style={{ color: '#fff', textDecoration: 'none' }}>
              大会作成
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin" style={{ color: '#fff', textDecoration: 'none' }}>
              管理者画面
            </Link>
          )}
        </nav>
      </div>
      <div style={{ marginLeft: 'auto' }}>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 15px',
            backgroundColor: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}

