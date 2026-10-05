// server/api/communities.post.ts
import { defineEventHandler, readBody } from 'h3'
import { addCommunityByUrl } from '../services/communityService'
import { z } from 'zod'

const AddCommunitySchema = z.object({
  url: z.string().url()
})

export default defineEventHandler(async (event) => {
  console.log('[API] POST /api/communities')

  const body = await readBody(event)
  const parsed = AddCommunitySchema.safeParse(body)

  if (!parsed.success) {
    return { success: false, error: 'Неверный URL сообщества' }
  }

  try {
    const result = await addCommunityByUrl(parsed.data.url)
    console.log(`[API] Добавлено сообщество: ${result.name}`)
    
    return {
      success: true,
      community: result
    }
  } catch (err) {
    console.error('[API] Ошибка добавления сообщества:', err)
    return {
      success: false,
      error: (err as Error).message
    }
  }
})
