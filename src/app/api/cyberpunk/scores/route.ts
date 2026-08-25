import { getSupabaseServer, missingSupabaseResponse } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = getSupabaseServer()
  if (!supabase) return missingSupabaseResponse()

  const currentMonth = `${new Date().toISOString().slice(0, 7)}-01`
  const [allTimeResult, monthlyResult] = await Promise.all([
    supabase
      .from('cyberpunk_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(20),
    supabase
      .from('cyberpunk_monthly_scores')
      .select('*')
      .eq('score_month', currentMonth)
      .order('score', { ascending: false })
      .limit(20),
  ])

  if (allTimeResult.error) {
    return Response.json({ error: allTimeResult.error.message }, { status: 500 })
  }

  return Response.json({
    allTime: allTimeResult.data ?? [],
    monthly: monthlyResult.error ? [] : monthlyResult.data ?? [],
    monthlyError: monthlyResult.error?.message ?? null,
  })
}

export async function POST(req: Request) {
  const supabase = getSupabaseServer()
  if (!supabase) return missingSupabaseResponse()

  let body: { nickname?: unknown; score?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const nickname = String(body.nickname ?? '').trim().slice(0, 30)
  const score = Number(body.score)
  if (!nickname) return Response.json({ error: 'Сначала введите никнейм.' }, { status: 400 })
  if (!Number.isFinite(score) || score <= 0) {
    return Response.json({ error: 'Сначала наберите очки.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('submit_cyberpunk_score', {
    player_nickname: nickname,
    player_score: Math.round(score),
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rank: data ?? null })
}
