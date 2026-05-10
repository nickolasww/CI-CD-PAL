import type React from "react"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { isAuthenticated, getCurrentUser, updateUserProfile } from "../../utils/auth"
import Navbar from "../../components/navbar"
import { useAuth } from "../../context/AuthContext"

export default function ProfilePage() {
  const [lastSignInAt, setLastSignInAt] = useState("")
  const [updatedAt, setUpdatedAt] = useState("")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(true)
  const { profile } = useAuth()

  useEffect(() => {
    const init = async () => {
      const authed = await isAuthenticated()
      if (!authed) {
        navigate("/")
        return
      }

      const user = await getCurrentUser()
      if (user) {
        setFullName(user.fullName || user.email || "")
        setEmail(user.email || "")
        setLastSignInAt(user.last_sign_in_at || "")
        setUpdatedAt(user.updated_at || "")
      }

      setIsChecking(false)
    }

    init()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      await updateUserProfile(fullName, email, updatedAt, lastSignInAt)
      setMessage("Profile berhasil diperbarui!")
      window.dispatchEvent(new Event("storage"))
      setTimeout(() => {
        navigate(profile?.role === "admin" ? "/dashboard" : "/")
      }, 1500)
    } catch (err) {
      setMessage("Terjadi kesalahan saat memperbarui profile")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    navigate(profile?.role === "admin" ? "/dashboard" : "/")
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Memuat...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">Edit Profile</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
              <p>Perbarui informasi profile Anda.</p>
            </div>
            <form onSubmit={handleSubmit} className="mt-5">
              <div className="w-full">
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  FullName
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="fullName"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Masukkan email"
                  />
                </div>

                  <label htmlFor="lastSignInAt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                    Terakhir Masuk
                  </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="lastSignInAt"
                    id="lastSignInAt"
                    value={`${new Date(lastSignInAt).toLocaleString()}`}
                    disabled
                    className="shadow-sm p-2 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                </div>

                <div> 
                  <label htmlFor="updatedAt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                    Terakhir Diperbarui
                  </label>
                
                <div className="mt-1">
                  <input
                    type="text"
                    name="updatedAt"
                    id="updatedAt"
                    value={`${new Date(updatedAt).toLocaleString()}`}
                    disabled
                    className="shadow-sm p-2 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500
                    dark:text-gray-400 cursor-not-allowed"
                    />
                </div>
                    </div>
              </div>

              {message && (
                <div
                  className={`mt-4 p-3 rounded-md ${
                    message.includes("berhasil")
                      ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400"
                      : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400"
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="mt-5 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
