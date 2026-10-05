// server/api/analytics/community-weekly/[id].get.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { db } from '../../../database/db'
import { videos, viewsHistory, communities } from '../../../database/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { startOfWeek, format } from 'date-fns'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Не указан ID сообщества' })

  console.log(`[API] GET /api/analytics/community-weekly/${id}`)

  // Проверяем существование сообщества
  const community = db.select().from(communities).where(eq(communities.id, id)).get()
  if (!community) {
    throw createError({ statusCode: 404, message: 'Сообщество не найдено' })
  }

  // 1. Все видео этого сообщества
  const commVideos = db.select().from(videos)
    .where(eq(videos.communityId, id))
    .all()

  if (commVideos.length === 0) {
    return { weeklyData: [], totalViews: 0, videoCount: 0 }
  }

  const videoIds = commVideos.map(v => v.id)

  // 2. Вся история просмотров для этих видео (ИСПРАВЛЕНО: используем inArray вместо eq)
  const history = db.select({
    videoId: viewsHistory.videoId,
    date: viewsHistory.date,
    views: viewsHistory.views
  })
    .from(viewsHistory)
    .where(inArray(viewsHistory.videoId, videoIds))
    .orderBy(desc(viewsHistory.date))
    .all()

  // Группируем историю по видео
  const historyByVideo = history.reduce((acc, h) => {
    if (!acc[h.videoId]) acc[h.videoId] = []
    acc[h.videoId]!.push(h)
    return acc
  }, {} as Record<string, typeof history>)

  // 3. Определяем диапазон дат
  const allDates = history.map(h => new Date(h.date))
  if (allDates.length === 0) {
    return { weeklyData: [], totalViews: 0, videoCount: commVideos.length }
  }

  const firstDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  const today = new Date()

  // 4. Генерируем массив недель
  const weeks: Array<{ startDate: string; totalViews: number; growth: number }> = []
  let weekStart = startOfWeek(firstDate, { weekStartsOn: 1 })

  while (weekStart <= today) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    // Суммируем последние валидные просмотры каждого видео в этой неделе
    let weekTotal = 0
    for (const video of commVideos) {
      const videoHistory = (historyByVideo[video.id] || [])
        .filter(h => h.date >= weekStartStr && h.date <= weekEndStr && h.views !== -1)

      if (videoHistory.length > 0) {
        weekTotal += videoHistory[0]!.views
      } else {
        // Если в этой неделе замеров не было, берём последнюю известную
        const lastKnown = (historyByVideo[video.id] || [])
          .filter(h => h.date < weekStartStr && h.views !== -1)
        if (lastKnown.length > 0) {
          weekTotal += lastKnown[0]!.views
        }
      }
    }

    const prevWeek = weeks[weeks.length - 1]
    const growth = prevWeek ? weekTotal - prevWeek.totalViews : 0

    weeks.push({
      startDate: weekStartStr,
      totalViews: weekTotal,
      growth
    })

    weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() + 1)
  }

  const totalViews = weeks.length > 0 ? weeks[weeks.length - 1]!.totalViews : 0

  return {
    weeklyData: weeks,
    totalViews,
    videoCount: commVideos.length
  }
})
