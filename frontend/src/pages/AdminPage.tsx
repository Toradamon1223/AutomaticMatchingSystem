import { useEffect, useState } from 'react'
import { User } from '../types'
import apiClient from '../api/client'
import BackButton from '../components/BackButton'

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await apiClient.get<User[]>('/admin/users')
      setUsers(response.data)
    } catch (error) {
      console.error('ユーザー一覧の取得に失敗しました', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await apiClient.patch(`/admin/users/${userId}/role`, { role })
      alert('役割を更新しました')
      loadUsers()
    } catch (error: any) {
      alert(error.response?.data?.message || '役割の更新に失敗しました')
    }
  }

  if (loading) {
    return <div>読み込み中...</div>
  }

  return (
    <div>
      <BackButton to="/" />
      <h1>管理者画面</h1>

      <div style={{ marginTop: '30px' }}>
        <h2>ユーザー管理</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>名前</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>メール</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>役割</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{user.name}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{user.email}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{user.role}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                  >
                    <option value="user">ユーザー</option>
                    <option value="organizer">開催者</option>
                    <option value="admin">管理者</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

