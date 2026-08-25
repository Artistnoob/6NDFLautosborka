import { getSupabaseServer, missingSupabaseResponse } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = getSupabaseServer()
  if (!supabase) return missingSupabaseResponse()

  const { data, error } = await supabase
    .from('cyberpunk_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ messages: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = getSupabaseServer()
  if (!supabase) return missingSupabaseResponse()

  let body: { nickname?: unknown; message?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const nickname = String(body.nickname ?? '').trim().slice(0, 30)
  const message = String(body.message ?? '').trim().slice(0, 500)
  if (!nickname || !message) {
    return Response.json({ error: 'Нужны никнейм и сообщение.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cyberpunk_messages')
    .insert({ nickname, message })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ message: data })
}
