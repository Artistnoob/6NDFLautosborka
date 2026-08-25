import { getSupabaseServer, missingSupabaseResponse } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = getSupabaseServer()
  if (!supabase) return missingSupabaseResponse()

  let body: { nickname?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const nickname = String(body.nickname ?? '').trim().slice(0, 30)
  if (!nickname) return Response.json({ error: 'Нужен никнейм.' }, { status: 400 })

  const { error } = await supabase.rpc('erase_cyberpunk_identity', {
    player_nickname: nickname,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
