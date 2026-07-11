import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export function useSession() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, signOut: () => supabase.auth.signOut() }
}
