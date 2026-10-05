// server/api/communities/[id].get.ts
import { db } from '../../database/db'
import { 
  communities, videos, measurements, passes, 
  subscribersHistory 
} from '../../database/schema'
import { eq, desc, and } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { calculateTrend } from '../../utils/metricsCalculator'
import type { 
  ApiCommunityDetailDto, 
  ApiPassSummaryDto, 
  ApiCommunityVideoDto 
} from '../../../shared/types/api'

export default defineEventHandler(async (event): Promise<ApiCommunityDetailDto> => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Не указан ID' })

  console.log(`[API] GET /api/communities/${id}`)

  // 1. Получаем само сообщество
  const community = db.select().from(communities).where(eq(communities.id, id)).get()
  if (!community) {
    throw createError({ statusCode: 404, message: 'Сообщество не найдено' })
  }

  // 2. Видео этого сообщества
  const commVideos = db.select().from(videos)
    .where(eq(videos.communityId, id))
    .all()

  const videoIds = commVideos.map(v => v.id)

  // 3. Все замеры для этих видео (с привязкой к обходам)
  const allMeasurements = videoIds.length > 0
    ? db.select({
        videoId: measurements.videoId,
        views: measurements.views,
        passId: measurements.passId,
        recordedAt: measurements.recordedAt
      })
      .from(measurements)
      .where(
        // inArray для videoId
        videoIds.length === 1 
          ? eq(measurements.videoId, videoIds[0])
          : undefined as any // fallback
      )
      .orderBy(desc(measurements.recordedAt))
      .all()
    : []

  // Если inArray не сработал через where, фильтруем вручную (для простоты MVP)
  const filteredMeasurements = allMeasurements.length > 0 
    ? allMeasurements 
    : (videoIds.length > 0
        ? db.select({
            videoId: measurements.videoId,
            views: measurements.views,
            passId: measurements.passId,
            recordedAt: measurements.recordedAt
          })
          .from(measurements)
          .orderBy(desc(measurements.recordedAt))
          .all()
          .filter(m => videoIds.includes(m.videoId))
        : [])

  // Группируем замеры по видео (от новых к старым)
  const measurementsByVideo = filteredMeasurements.reduce((acc, m) => {
    if (!acc[m.videoId]) acc[m.videoId] = []
    acc[m.videoId].push(m)
    return acc
  }, {} as Record<string, typeof filteredMeasurements>)

  // 4. Все обходы, в которых участвовало это сообщество
  // Ищем по JSON-полю communityIds или по факту наличия замеров
  const allPasses = db.select().from(passes)
    .orderBy(desc(passes.startedAt))
    .all()

  const relevantPassIds = new Set(filteredMeasurements.map(m => m.passId))
  const relevantPasses = allPasses.filter(p => relevantPassIds.has(p.id))

  // 5. История подписчиков
  const subsHistory = db.select().from(subscribersHistory)
    .where(eq(subscribersHistory.communityId, id))
    .orderBy(desc(subscribersHistory.date))
    .all()

  const subsByDate = new Map(subsHistory.map(s => [s.date, s.subscribers]))
  const latestSubs = subsHistory[0]?.subscribers ?? 0

  // Подписчики месяц назад (примерно)
  const monthAgoSubs = subsHistory.length > 1 ? subsHistory[subsHistory.length - 1]?.subscribers ?? latestSubs : latestSubs
  const subscribersChange = latestSubs - monthAgoSubs

  // 6. Формируем историю обходов с агрегированными метриками
  const passesHistory: ApiPassSummaryDto[] = relevantPasses.map(pass => {
    const passMeasurements = filteredMeasurements.filter(m => m.passId === pass.id)
    const totalViews = passMeasurements.reduce((sum, m) => sum + m.views, 0)
    const date = pass.startedAt.split('T')[0]
    const subscribers = subsByDate.get(date) ?? latestSubs
    
    const videoCount = passMeasurements.length
    let engagement = 0
    if (subscribers > 0 && videoCount > 0) {
      engagement = totalViews / (subscribers * videoCount)
    }

    return {
      id: pass.id,
      label: pass.label,
      date,
      videoCount,
      totalViews,
      subscribers,
      engagement: Number(engagement.toFixed(2))
    }
  }).sort((a, b) => a.date.localeCompare(b.date)) // от старых к новым для графика

  // 7. Формируем список видео с ростом
  const videosList: ApiCommunityVideoDto[] = commVideos.map(video => {
    const history = measurementsByVideo[video.id] || []
    const currentViews = history[0]?.views ?? 0
    const previousViews = history[1]?.views ?? currentViews

    return {
      id: video.id,
      url: video.url,
      title: video.title,
      addedAt: video.addedAt,
      currentViews,
      previousViews,
      growth: currentViews - previousViews
    }
  }).sort((a, b) => b.currentViews - a.currentViews)

  // 8. Итоговые метрики
  const totalViews = videosList.reduce((sum, v) => sum + v.currentViews, 0)
  const previousTotalViews = videosList.reduce((sum, v) => sum + v.previousViews, 0)
  const videoCount = commVideos.length
  
  let engagement = 0
  if (latestSubs > 0 && videoCount > 0) {
    engagement = totalViews / (latestSubs * videoCount)
  }
  
  const activity = videoCount > 0 ? (totalViews - previousTotalViews) / videoCount : 0
  const trend = calculateTrend(totalViews, previousTotalViews)

  return {
    id: community.id,
    okGroupId: community.okGroupId,
    name: community.name,
    url: community.url,
    createdAt: community.createdAt,
    subscribers: latestSubs,
    subscribersChange,
    totalViews,
    videoCount,
    engagement: Number(engagement.toFixed(2)),
    activity: Math.round(activity),
    trendIcon: trend.icon,
    passesHistory,
    videos: videosList
  }
})
