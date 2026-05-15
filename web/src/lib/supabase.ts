import { createBrowserClient } from '@supabase/ssr'

/**
 * Client-side Supabase client. Uses @supabase/ssr's createBrowserClient which
 * stores the session in cookies AND localStorage, so that server components and
 * API routes (which use createServerClient) can read the same session via cookies.
 *
 * The old plain createClient from @supabase/supabase-js only wrote to localStorage,
 * which left server-rendered auth blind to logged-in users and caused /upgrade
 * and API routes to redirect to /login with 307.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
