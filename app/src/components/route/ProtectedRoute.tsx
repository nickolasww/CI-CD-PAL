import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'client'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  // Belum login → ke halaman login
  if (!user) return <Navigate to="/" replace />

  // Tunggu profile selesai dimuat
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  // Role tidak sesuai → admin ke dashboard, lainnya ke homepage
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}