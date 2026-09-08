import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = request.headers.get('Authorization') ?? ''
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  const { data: profile } = await caller.from('profiles').select('role,active').eq('id', user.id).single()
  if (!profile?.active || profile.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403, headers: corsHeaders })
  const body = await request.json()
  if (!body.email || !body.full_name || !['admin', 'agent'].includes(body.role)) return Response.json({ error: 'Invalid invitation' }, { status: 400, headers: corsHeaders })
  const admin = createClient(url, service)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, { data: { full_name: body.full_name } })
  if (error || !data.user) return Response.json({ error: error?.message ?? 'Invitation failed' }, { status: 400, headers: corsHeaders })
  await admin.from('profiles').update({ role: body.role, phone: body.phone || null }).eq('id', data.user.id)
  return Response.json({ ok: true }, { headers: corsHeaders })
})
