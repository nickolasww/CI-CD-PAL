import { createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'client'
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const lastProfileUserIdRef = useRef<string | null>(null)

  async function fetchProfile(userId: string) {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .single()

      if (error || !data) {
        setProfile(null)
        return
      }

      setProfile(data as Profile)
    } finally {
      setProfileLoading(false)
    }
  }

  const syncSession = async (session: Session | null) => {
    const nextUser = session?.user ?? null
    setUser(nextUser)

    if (!nextUser) {
      lastProfileUserIdRef.current = null
      setProfile(null)
      setProfileLoading(false)
      return
    }

    if (lastProfileUserIdRef.current !== nextUser.id) {
      lastProfileUserIdRef.current = nextUser.id
      setProfile(null)
    }

    await fetchProfile(nextUser.id)
  }

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!isMounted) return
      await syncSession(session)
      if (isMounted) setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return
        await syncSession(session)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

const signOut = async () => {
  await supabase.auth.signOut()
  setUser(null)
  setProfile(null)
  window.location.href = "/"
}

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, signOut }}>
    {/* Jangan render children sampai loading selesai */}
    {loading ? (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    ) : (
      children
    )}
  </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)