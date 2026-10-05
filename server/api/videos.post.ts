// server/api/videos.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { addVideoByUrl } from '../services/videoService'
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
      let added = 0
      let updated = 0
      let errors = 0
      let processed = 0

      for (const link of linkList) {
        processed++

        // Извлекаем videoId
        const match = link.trim().match(/ok\.ru\/video\/(\d+)/i)
        if (!match) {
          const errorMsg = JSON.stringify({
            type: 'progress',
            current: processed,
            total: linkList.length,
            link,
            status: 'error',
            error: 'Неверный формат ссылки (ожидается ok.ru/video/ID)'
          })
          controller.enqueue(new TextEncoder().encode(errorMsg + '\n'))
          errors++
          continue
        }

        const videoId = match[1]!
        const url = `https://ok.ru/video/${videoId}`

        try {
          const result = await addVideoByUrl(url, videoId)

          const progressMsg = JSON.stringify({
            type: 'progress',
            current: processed,
            total: linkList.length,
            videoId: result.videoId,
            title: result.title,
            communityName: result.communityName,
            views: result.views,
            status: result.isNew ? 'added' : 'updated',
            error: result.error
          })
          controller.enqueue(new TextEncoder().encode(progressMsg + '\n'))

          if (result.isNew) added++
          else updated++
          if (result.error) errors++
        } catch (err) {
          const errorMsg = JSON.stringify({
            type: 'progress',
            current: processed,
            total: linkList.length,
            link,
            status: 'error',
            error: (err as Error).message
          })
          controller.enqueue(new TextEncoder().encode(errorMsg + '\n'))
          errors++
        }

        // Задержка между запросами (антифрод)
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500))
      }

      const doneMsg = JSON.stringify({
        type: 'done',
        added,
        updated,
        errors,
        total: linkList.length
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
