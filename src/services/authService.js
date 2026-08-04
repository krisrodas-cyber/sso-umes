import { supabase } from '../config/supabase.js'

export const getSession = async () => {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}
export const signIn = async (email, password) => {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export const signOut = async () => {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
