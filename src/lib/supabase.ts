import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The one Supabase client. Built from the PUBLIC url + publishable key only — never a
 * service-role key, never a model key. `supabase` is null when the build has no keys,
 * and the app says so honestly instead of inventing an account.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null

export const supabaseUrl = url ?? null
export const supabaseKey = key ?? null

/** Accounts exist only when the client exists. */
export const accountsAvailable = supabase !== null
