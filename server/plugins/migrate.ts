// server/plugins/migrate.ts
import { defineNitroPlugin } from 'nitropack/runtime'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../database/db'

export default defineNitroPlugin(() => {
  console.log('[БД] Проверка и применение миграций...')
  try {
    migrate(db, { migrationsFolder: './server/database/migrations' })
    console.log('[БД] Миграции успешно применены / база данных актуальна')
  } catch (error) {
    console.error('[БД] Критическая ошибка применения миграций:', error)
  }
})
