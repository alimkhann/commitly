import { auth } from '@clerk/nextjs/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '../config/env'

const { supabaseUrl, supabaseAnonKey } = env

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are not configured')
}

export function createServerSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    async accessToken() {
      const { getToken } = await auth()
      return getToken({ template: 'supabase' })
    },
  })
}
