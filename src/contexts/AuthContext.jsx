import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    } catch (e) {
      console.warn('Profile fetch failed:', e.message)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    const redirectTo = sessionStorage.getItem('authRedirect') || '/dashboard'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirectTo}` },
    })
    if (error) throw error
  }

  // ── Email signup ──────────────────────────────────────────────────────────
  // Returns { error } — null error means success
  async function signUpWithEmail(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // After email confirmation, land on dashboard
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) return { error }

    // Supabase returns a user even before confirmation in some configs.
    // If email confirmation is required, data.user will exist but
    // data.session will be null. We surface this so the UI can show
    // "check your inbox" rather than silently doing nothing.
    const needsConfirmation = data.user && !data.session
    return { error: null, needsConfirmation }
  }

  // ── Email sign-in ─────────────────────────────────────────────────────────
  async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    return { error: null }
  }

  // ── Password reset ────────────────────────────────────────────────────────
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    })
    if (error) return { error }
    return { error: null }
  }

  // ── Update password (after reset link clicked) ────────────────────────────
  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error }
    return { error: null }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      resetPassword,
      updatePassword,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
