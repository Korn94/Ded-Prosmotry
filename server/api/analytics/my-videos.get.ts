// server/api/analytics/my-videos.get.ts
import { db } from '../../database/db'
import { videos, viewsHistory } from '../../database/schema'
import { eq, desc, isNull } from 'drizzle-orm'
import { startOfWeek, format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  console.log('[API] GET /api/analytics/my-videos')

  // 1. Получаем все видео БЕЗ сообщества (Сценарий А)
  const myVideos = db.select().from(videos)
    .where(isNull(videos.communityId))
    .all()

  if (myVideos.length === 0) {
    return { videos: [], weeklyData: [], totalViews: 0 }
  }

  const videoIds = myVideos.map(v => v.id)

  // 2. Получаем всю историю просмотров для этих видео
  const history = videoIds.length > 0
    ? db.select({
        videoId: viewsHistory.videoId,
        date: viewsHistory.date,
        views: viewsHistory.views
      })
      .from(viewsHistory)
      // Фильтруем по videoIds вручную через фильтр для простоты
      .orderBy(desc(viewsHistory.date))
      .all()
      .filter(h => videoIds.includes(h.videoId))
    : []

  // Группируем историю по видео
  const historyByVideo = history.reduce((acc, h) => {
    if (!acc[h.videoId]) acc[h.videoId] = []
    acc[h.videoId].push(h)
    return acc
  }, {} as Record<string, typeof history>)

  // 3. Определяем диапазон дат (от самой ранней записи до сегодня)
  const allDates = history.map(h => new Date(h.date))
  if (allDates.length === 0) {
    return { 
      videos: myVideos.map(v => ({ ...v, currentViews: 0, growth7: 0, growth14: 0, growth30: 0 })), 
      weeklyData: [], 
      totalViews: 0 
    }
  }

  const firstDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  const today = new Date()
  
  // 4. Генерируем массив недель (начиная с понедельника первой записи)
  const weeks: Array<{ startDate: string; totalViews: number; growth: number }> = []
  let weekStart = startOfWeek(firstDate, { weekStartsOn: 1 })
  
  while (weekStart <= today) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
    
    // Суммируем последние валидные просмотры каждого видео в этой неделе
    let weekTotal = 0
    for (const video of myVideos) {
      const videoHistory = (historyByVideo[video.id] || [])
        .filter(h => h.date >= weekStartStr && h.date <= weekEndStr && h.views !== -1)
      
      if (videoHistory.length > 0) {
        // Берем последнюю запись в неделе
        weekTotal += videoHistory[0].views
      } else {
        // Если в этой неделе замеров не было, берем последнюю известную до этой недели
        const lastKnown = (historyByVideo[video.id] || [])
          .filter(h => h.date < weekStartStr && h.views !== -1)
        if (lastKnown.length > 0) {
          weekTotal += lastKnown[0].views
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

  // 5. Формируем список видео с текущими просмотрами и ростом за разные периоды
  const videosWithStats = myVideos.map(video => {
    const videoHistory = (historyByVideo[video.id] || [])
      .filter(h => h.views !== -1)
    
    const currentViews = videoHistory[0]?.views ?? 0
    const latestDate = videoHistory[0]?.date ? new Date(videoHistory[0].date) : new Date()
    
    // Функция для получения просмотров N дней назад
    const getViewsDaysAgo = (days: number): number => {
      const targetDate = subDays(latestDate, days)
      const targetStr = format(targetDate, 'yyyy-MM-dd')
      
      const record = videoHistory.find(h => h.date <= targetStr)
      return record?.views ?? 0
    }
    
    return {
      id: video.id,
      url: video.url,
      title: video.title,
      addedAt: video.addedAt,
      currentViews,
      growth7: currentViews - getViewsDaysAgo(7),
      growth14: currentViews - getViewsDaysAgo(14),
      growth30: currentViews - getViewsDaysAgo(30)
    }
  })

  const totalViews = videosWithStats.reduce((sum, v) => sum + v.currentViews, 0)

  return {
    videos: videosWithStats,
    weeklyData: weeks,
    totalViews
  }
})
