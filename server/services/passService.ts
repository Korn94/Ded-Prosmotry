// server/services/passService.ts
import { db } from '../database/db'
import { passes } from '../database/schema'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export type PassType = 'community' | 'multi' | 'global'

export async function createPass(
  label: string | null, 
  type: PassType, 
  communityIds: string[] = []
): Promise<string> {
  const id = randomUUID()
  const now = new Date()
  
  // Генерируем автоматическую метку, если не передана
  const finalLabel = label || `Обход ${format(now, 'dd MMM yyyy, HH:mm', { locale: ru })}`

  db.insert(passes).values({
    id,
    label: finalLabel,
    type,
    communityIds: JSON.stringify(communityIds), // Сохраняем массив как JSON
    startedAt: now.toISOString(),
    finishedAt: null,
    status: 'in_progress',
    videoCount: 0,
    errorCount: 0,
  }).run()

  console.log(`[Обход] Создан новый обход: "${finalLabel}" (${type})`)
  return id
}

export async function finishPass(passId: string, videoCount: number, errorCount: number) {
  db.update(passes)
    .set({
      status: 'completed',
      finishedAt: new Date().toISOString(),
      videoCount,
      errorCount
    })
    .where(eq(passes.id, passId))
    .run()
    
  console.log(`[Обход] Завершён ${passId}: успешно ${videoCount}, ошибок ${errorCount}`)
}
