// server/api/update-stats.post.ts
import { defineEventHandler, readBody } from 'h3'
import { db } from '../database/db'
import { videos } from '../database/schema'
import { inArray, eq } from 'drizzle-orm'
import { createPass, finishPass } from '../services/passService'
import { recordMeasurement } from '../services/measurementService'
import { parseVideoPage } from '../utils/okRuParser'
import { z } from 'zod'

const UpdateStatsSchema = z.object({
  videoIds: z.array(z.string()).optional(),
  communityIds: z.array(z.string()).optional(),
  updateAll: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  console.log('[API] POST /api/update-stats')
  const body = await readBody(event)
  const parsed = UpdateStatsSchema.safeParse(body)

  // 1. Определяем, какие видео нужно обновить
  let targetVideos: any[] = []
  let passType: 'global' | 'community' | 'multi' = 'global'
  let passCommunityIds: string[] = []
  let passLabel: string | null = null

  if (parsed.success && parsed.data.communityIds && parsed.data.communityIds.length > 0) {
    passType = parsed.data.communityIds.length === 1 ? 'community' : 'multi'
    passCommunityIds = parsed.data.communityIds
    targetVideos = db.select().from(videos).where(inArray(videos.communityId, passCommunityIds)).all()
    passLabel = `Обновление ${targetVideos.length} видео`
  } else if (parsed.success && parsed.data.videoIds && parsed.data.videoIds.length > 0) {
    targetVideos = db.select().from(videos).where(inArray(videos.id, parsed.data.videoIds)).all()
  } else {
    // Глобальное обновление (Сценарий А или "Обновить всё")
    targetVideos = db.select().from(videos).all()
  }

  if (targetVideos.length === 0) {
    return { error: 'Нет видео для обновления' }
  }

  // 2. Создаем Обход (Pass)
  const passId = await createPass(passLabel, passType, passCommunityIds)

  // 3. Запускаем NDJSON стрим
  const stream = new ReadableStream({
    async start(controller) {
      let processed = 0
      let successCount = 0
      let errorCount = 0
      let titlesUpdated = 0 // Счётчик обновлённых названий
      const total = targetVideos.length

      for (const video of targetVideos) {
        processed++
        
        // Парсим страницу
        const parsedData = await parseVideoPage(video.url, video.id)

        if (parsedData.error || parsedData.views === -1) {
          errorCount++
          const msg = JSON.stringify({
            type: 'progress',
            current: processed,
            total,
            videoId: video.id,
            status: 'error',
            error: parsedData.error || 'Не удалось получить просмотры'
          })
          controller.enqueue(new TextEncoder().encode(msg + '\n'))
        } else {
          // Обновляем title, если он пустой в БД, но есть на странице
          if (!video.title && parsedData.title) {
            db.update(videos)
              .set({ title: parsedData.title })
              .where(eq(videos.id, video.id))
              .run()
            titlesUpdated++
            console.log(`[Обход] Обновлено название для ${video.id}: "${parsedData.title}"`)
          }

          // Записываем замер в БД
          // Примечание: подписчиков пока передаем как null, чтобы не делать лишний запрос 
          // к странице сообщества для каждого видео (это замедлит процесс и повысит риск бана).
          await recordMeasurement(passId, video.id, parsedData.views, null)
          
          successCount++
          const msg = JSON.stringify({
            type: 'progress',
            current: processed,
            total,
            videoId: video.id,
            title: parsedData.title || video.title, // Возвращаем актуальное название
            status: 'updated',
            views: parsedData.views
          })
          controller.enqueue(new TextEncoder().encode(msg + '\n'))
        }

        // Антифрод задержка
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 500))
      }

      // 4. Завершаем обход
      await finishPass(passId, successCount, errorCount)

      const doneMsg = JSON.stringify({
        type: 'done',
        passId,
        updated: successCount,
        errors: errorCount,
        titlesUpdated, // Добавляем статистику по названиям в финальный ответ
        total
      })
      controller.enqueue(new TextEncoder().encode(doneMsg + '\n'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache'
    }
  })
})
