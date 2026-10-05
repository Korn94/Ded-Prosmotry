// scripts/refresh-subscribers.ts
import { db } from '../server/database/db'
import { communities, subscribersHistory } from '../server/database/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { parseCommunityPage } from '../server/utils/okRuParser'

async function refreshAllSubscribers() {
  console.log('🚀 [Refresh Subscribers] Начало обновления подписчиков...')

  const allCommunities = db.select().from(communities).all()

  if (allCommunities.length === 0) {
    console.log('ℹ️ [Refresh Subscribers] Нет сообществ для обновления')
    return
  }

  console.log(`📋 [Refresh Subscribers] Найдено сообществ: ${allCommunities.length}`)

  let updated = 0
  let errors = 0
  const today = new Date().toISOString().split('T')[0]

  for (const community of allCommunities) {
    console.log(`⏳ [Refresh Subscribers] Парсинг: "${community.name}"...`)
    
    try {
      const parsed = await parseCommunityPage(community.url)
      
      if (parsed?.subscribers !== null && parsed?.subscribers !== undefined) {
        // Проверяем, есть ли уже запись за сегодня
        const existingToday = db.select()
          .from(subscribersHistory)
          .where(eq(subscribersHistory.communityId, community.id))
          .all()
          .find(s => s.date === today)
        
        if (!existingToday) {
          db.insert(subscribersHistory).values({
            id: randomUUID(),
            communityId: community.id,
            passId: null,
            date: today,
            subscribers: parsed.subscribers
          }).run()
          
          console.log(`✅ [Refresh Subscribers] "${community.name}": ${parsed.subscribers} подписчиков`)
          updated++
        } else {
          console.log(`⏭️ [Refresh Subscribers] "${community.name}": уже есть данные за сегодня`)
        }
      } else {
        console.warn(`⚠️ [Refresh Subscribers] "${community.name}": подписчики не найдены`)
        errors++
      }
    } catch (err) {
      console.error(`❌ [Refresh Subscribers] "${community.name}": ошибка -`, (err as Error).message)
      errors++
    }

    // Задержка между запросами (антифрод)
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 500))
  }

  console.log(`\n🎉 [Refresh Subscribers] Завершено!`)
  console.log(`   Обновлено: ${updated}`)
  console.log(`   Ошибок: ${errors}`)
}

refreshAllSubscribers().catch(err => {
  console.error('❌ [Refresh Subscribers] Критическая ошибка:', err)
  process.exit(1)
})
