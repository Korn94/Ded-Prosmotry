// server/services/measurementService.ts
import { db } from '../database/db'
import { measurements, viewsHistory, videos, subscribersHistory } from '../database/schema'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'

/**
 * Записывает результат парсинга в БД.
 * Обновляет и таблицу замеров (для обходов), и историю просмотров (для графиков).
 */
export async function recordMeasurement(
  passId: string,
  videoId: string,
  views: number,
  subscribers: number | null = null
) {
  const now = new Date()
  const isoNow = now.toISOString()
  const dateStr = isoNow.split('T')[0]! // YYYY-MM-DD

  // 1. Запись в таблицу замеров (связь с обходом)
  db.insert(measurements).values({
    id: randomUUID(),
    passId,
    videoId,
    views,
    subscribers,
    recordedAt: isoNow
  }).run()

  // 2. Запись в историю просмотров (для быстрых графиков тренда)
  db.insert(viewsHistory).values({
    id: randomUUID(),
    videoId,
    passId,
    date: dateStr,
    views
  }).run()

  // 3. Если известны подписчики сообщества, обновляем историю подписчиков
  if (subscribers !== null) {
    const video = db.select({ communityId: videos.communityId })
      .from(videos)
      .where(eq(videos.id, videoId))
      .get()
      
    if (video?.communityId) {
      db.insert(subscribersHistory).values({
        id: randomUUID(),
        communityId: video.communityId,
        passId,
        date: dateStr,
        subscribers
      }).run()
    }
  }
}
