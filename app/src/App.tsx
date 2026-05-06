import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider} from "./context/AuthContext"
import ProtectedRoute from "./components/route/ProtectedRoute"
import DashboardPage from "./pages/dashboard"
import HomePage from "./pages/(public)/homepage"
import LoginPage from "./pages/login"
import EditProfile from "./pages/editprofile"
import ThemeProvider from "./components/theme/themeprovider"

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Halaman publik — siapa saja bisa akses TANPA login */}
            <Route path="/" element={<HomePage />} />

            {/* Halaman login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Halaman khusus admin saja */}
            <Route path="/dashboard" element={
              <ProtectedRoute requiredRole="admin">
                <DashboardPage />
              </ProtectedRoute>
            } />

            {/* Halaman edit profile - butuh login */}
            <Route path="/editprofile" element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App