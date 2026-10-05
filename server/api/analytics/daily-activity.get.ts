// server/api/analytics/daily-activity.get.ts
import { db } from '../../database/db'
import { viewsHistory, videos } from '../../database/schema'
import { sql, eq } from 'drizzle-orm'
import { subDays, format } from 'date-fns'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  console.log('[API] GET /api/analytics/daily-activity')
  
  // 1. Генерируем массив последних 30 дней (YYYY-MM-DD)
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    days.push(format(subDays(new Date(), i), 'yyyy-MM-dd'))
  }

  // 2. Делаем агрегирующий запрос в БД
  // Считаем общее количество замеров и количество НОВЫХ видео (addedAt == date)
  const stats = await db
    .select({
      date: viewsHistory.date,
      total: sql<number>`count(${viewsHistory.id})`,
      added: sql<number>`sum(case when ${viewsHistory.date} = ${videos.addedAt} then 1 else 0 end)`
    })
    .from(viewsHistory)
    .leftJoin(videos, eq(viewsHistory.videoId, videos.id))
    .where(sql`${viewsHistory.date} >= ${days[0]}`)
    .groupBy(viewsHistory.date)

  const statsMap = new Map(stats.map(s => [s.date, s]))

  // 3. Формируем ответ, заполняя нулями дни, когда не было активности
  return days.map(date => {
    const stat = statsMap.get(date)
    const total = stat?.total ?? 0
    const added = stat?.added ?? 0
    return {
      date,
      total,
      added,
      updated: total - added
    }
  })
})
