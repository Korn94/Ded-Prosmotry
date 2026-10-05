// server/api/passes.get.ts
import { db } from '../database/db'
import { passes } from '../database/schema'
import { desc } from 'drizzle-orm'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  console.log('[API] GET /api/passes')
  
  const result = await db
    .select()
    .from(passes)
    .orderBy(desc(passes.startedAt))
    .limit(100) // Для MVP ограничим сотней последних обходов

  // Парсим communityIds из JSON-строки обратно в массив для фронтенда
  return result.map(pass => ({
    ...pass,
    communityIds: pass.communityIds ? JSON.parse(pass.communityIds) : []
  }))
})
