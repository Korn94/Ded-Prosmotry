// server/api/videos.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { addVideoByUrl } from '../services/videoService'
import { createNdjsonStream } from '../utils/ndjsonStream'
import { z } from 'zod'

const AddVideosSchema = z.object({
  links: z.union([z.string(), z.array(z.string())]),
  communityId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  console.log('[API] POST /api/videos')

  const body = await readBody(event)
  const parsed = AddVideosSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Неверный формат данных: необходимо передать поле "links"'
    })
  }

  // Нормализуем ссылки
  const linkList = Array.isArray(parsed.data.links)
    ? parsed.data.links
    : parsed.data.links.split(/[\n,;\s]+/).filter(Boolean)

  if (linkList.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Не передано ни одной ссылки'
    })
  }

  console.log(`[API] Получено ссылок: ${linkList.length}`)

  // Создаем NDJSON стрим
  const stream = new ReadableStream({
    async start(controller) {
      const ndjson = createNdjsonStream(controller)
      let added = 0
      let updated = 0
      let errors = 0
      let processed = 0

      for (const link of linkList) {
        processed++

        // Извлекаем videoId
        const match = link.trim().match(/ok\.ru\/video\/(\d+)/i)
        if (!match) {
          ndjson.send({
            type: 'progress',
            current: processed,
            total: linkList.length,
            link,
            status: 'error',
            error: 'Неверный формат ссылки (ожидается ok.ru/video/ID)'
          })
          errors++
          continue
        }

        const videoId = match[1]!
        const url = `https://ok.ru/video/${videoId}`

        // Сообщаем фронту, что элемент взят в работу, и запускаем heartbeat
        ndjson.beginItem({ current: processed, total: linkList.length, videoId, link })

        try {
          const result = await addVideoByUrl(url, videoId)

          ndjson.send({
            type: 'progress',
            current: processed,
            total: linkList.length,
            videoId: result.videoId,
            title: result.title,
            communityName: result.communityName,
            views: result.views,
            // Ошибка парсера (сеть/таймаут и т.п.) важнее статуса added/updated
            status: result.error ? 'error' : (result.isNew ? 'added' : 'updated'),
            error: result.error,
            errorType: result.errorType
          })

          if (result.error) errors++
          else if (result.isNew) added++
          else updated++
        } catch (err) {
          ndjson.send({
            type: 'progress',
            current: processed,
            total: linkList.length,
            link,
            status: 'error',
            error: (err as Error).message
          })
          errors++
        } finally {
          ndjson.endItem()
        }

        // Задержка между запросами (антифрод)
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500))
      }

      ndjson.finish({
        type: 'done',
        added,
        updated,
        errors,
        total: linkList.length
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache'
    }
  })
})
