import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TournamentListPage from './pages/TournamentListPage'
import TournamentDetailPage from './pages/TournamentDetailPage'
import TournamentAdminPage from './pages/TournamentAdminPage'
import AdminPage from './pages/AdminPage'
import CheckInPage from './pages/CheckInPage'
import MatchPage from './pages/MatchPage'
import CreateTournamentPage from './pages/CreateTournamentPage'
import './App.css'

function App() {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/Tournament'}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout>
                <DashboardPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/tournaments"
          element={
            isAuthenticated ? (
              <Layout>
                <TournamentListPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            isAuthenticated ? (
              <Layout>
                <TournamentDetailPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/tournaments/:id/admin"
          element={
            isAuthenticated && (user?.role === 'organizer' || user?.role === 'admin') ? (
              <Layout>
                <TournamentAdminPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/tournaments/:id/checkin"
          element={
            isAuthenticated ? (
              <Layout>
                <CheckInPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/tournaments/:id/matches"
          element={
            isAuthenticated ? (
              <Layout>
                <MatchPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin"
          element={
            isAuthenticated && user?.role === 'admin' ? (
              <Layout>
                <AdminPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/tournaments/new"
          element={
            isAuthenticated && (user?.role === 'organizer' || user?.role === 'admin') ? (
              <Layout>
                <CreateTournamentPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

