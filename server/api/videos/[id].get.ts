// server/api/videos/[id].get.ts
import { db } from '../../database/db'
import { videos, communities, measurements, passes, viewsHistory } from '../../database/schema'
import { eq, desc } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Не указан ID' })

  console.log(`[API] GET /api/videos/${id}`)

  // 1. Видео + сообщество
  const video = db.select({
    id: videos.id,
    url: videos.url,
    title: videos.title,
    addedAt: videos.addedAt,
    communityId: videos.communityId,
    communityName: communities.name,
    communityUrl: communities.url
  })
    .from(videos)
    .leftJoin(communities, eq(videos.communityId, communities.id))
    .where(eq(videos.id, id))
    .get()

  if (!video) {
    throw createError({ statusCode: 404, message: 'Видео не найдено' })
  }

  // 2. Все замеры с информацией об обходах
  const allMeasurements = db.select({
    id: measurements.id,
    views: measurements.views,
    recordedAt: measurements.recordedAt,
    passId: measurements.passId,
    passLabel: passes.label,
    passStartedAt: passes.startedAt
  })
    .from(measurements)
    .leftJoin(passes, eq(measurements.passId, passes.id))
    .where(eq(measurements.videoId, id))
    .orderBy(desc(measurements.recordedAt))
    .all()

  // 3. История просмотров (для графика, от старых к новым)
  const history = db.select({
    date: viewsHistory.date,
    views: viewsHistory.views
  })
    .from(viewsHistory)
    .where(eq(viewsHistory.videoId, id))
    .orderBy(viewsHistory.date)
    .all()

  // 4. Текущие просмотры и расчёт роста с предыдущего замера
  const currentViews = allMeasurements[0]?.views ?? 0
  const previousViews = allMeasurements[1]?.views ?? currentViews
  const growth = currentViews - previousViews

  // 5. Формируем список замеров с дельтой
  const measurementsWithGrowth = allMeasurements.map((m, idx) => {
    const prev = allMeasurements[idx + 1]?.views ?? m.views
    return {
      id: m.id,
      views: m.views,
      recordedAt: m.recordedAt,
      growth: m.views - prev,
      passLabel: m.passLabel || 'Вне обхода',
      passStartedAt: m.passStartedAt
    }
  })

  return {
    ...video,
    currentViews,
    previousViews,
    growth,
    history,
    measurements: measurementsWithGrowth
  }
})
