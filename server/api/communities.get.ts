// server/api/communities.get.ts
import { db } from '../database/db'
import { communities, videos, measurements, subscribersHistory, passes } from '../database/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { calculateTrend } from '../utils/metricsCalculator'
import type { ApiCommunityDto } from '~~/shared/types/api'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (): Promise<ApiCommunityDto[]> => {
  console.log('[API] GET /api/communities (с расчётом метрик)')
  
  // 1. Базовые данные сообществ
  const allCommunities = await db.select().from(communities).all()
  if (allCommunities.length === 0) return []

  const communityIds = allCommunities.map(c => c.id)

  // 2. Видео, принадлежащие этим сообществам
  const allVideos = await db.select().from(videos)
    .where(inArray(videos.communityId, communityIds))
    .all()

  const videosByCommunity = allVideos.reduce((acc, v) => {
    if (v.communityId) {
      const list = acc[v.communityId] ?? (acc[v.communityId] = [])
      list.push(v)
    }
    return acc
  }, {} as Record<string, typeof allVideos[number][]>)

  // 3. Последние известные подписчики для каждого сообщества
  const subsHistory = await db.select().from(subscribersHistory)
    .where(inArray(subscribersHistory.communityId, communityIds))
    .orderBy(desc(subscribersHistory.date))
    .all()
    
  const latestSubsByCommunity = subsHistory.reduce((acc, s) => {
    if (!acc[s.communityId]) acc[s.communityId] = s.subscribers
    return acc
  }, {} as Record<string, number>)

  // 4. Замеры (measurements) для расчета дельты (активности)
  // Join с passes нужен, чтобы отсортировать замеры по дате обхода, а не по дате записи
  const allMeasurements = await db.select({
    videoId: measurements.videoId,
    views: measurements.views,
    passDate: passes.startedAt
  })
    .from(measurements)
    .leftJoin(passes, eq(measurements.passId, passes.id))
    .orderBy(desc(passes.startedAt))
    .all()

  // Группируем историю просмотров по видео (от новых к старым)
  const measurementsByVideo = allMeasurements.reduce((acc, m) => {
    const list = acc[m.videoId] ?? (acc[m.videoId] = [])
    list.push(m.views)
    return acc
  }, {} as Record<string, number[]>)

  // 5. Агрегация и расчёт метрик
  const result = allCommunities.map(community => {
    const commVideos = videosByCommunity[community.id] || []
    const videoCount = commVideos.length
    
    let currentTotalViews = 0
    let previousTotalViews = 0
    
    for (const video of commVideos) {
      const viewsHistory = measurementsByVideo[video.id] || []
      const current = viewsHistory[0] ?? 0
      // Если нет предыдущего замера, считаем, что прошлое значение равно текущему (рост 0)
      const previous = viewsHistory[1] ?? current 
      
      currentTotalViews += current
      previousTotalViews += previous
    }

    const subscribers = latestSubsByCommunity[community.id] ?? 0
    
    // Формула вовлечённости: Σ просмотров / (подписчики × кол-во видео)
    let engagement = 0
    if (subscribers > 0 && videoCount > 0) {
      engagement = currentTotalViews / (subscribers * videoCount)
    }
    
    // Формула активности: Средний прирост на видео за последний обход
    const activity = videoCount > 0 ? (currentTotalViews - previousTotalViews) / videoCount : 0
    
    const trend = calculateTrend(currentTotalViews, previousTotalViews)

    return {
      id: community.id,
      okGroupId: community.okGroupId,
      name: community.name,
      url: community.url,
      videoCount,
      subscribers,
      totalViews: currentTotalViews,
      engagement: Number(engagement.toFixed(2)),
      activity: Math.round(activity),
      trend: trend.type,
      trendPercent: Math.round(trend.percent),
      trendIcon: trend.icon
    }
  })

  // Сортировка по вовлечённости (от большей к меньшей)
  return result.sort((a, b) => b.engagement - a.engagement)
})
