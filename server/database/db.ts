// server/database/db.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from './schema'

const dataDir = join(process.cwd(), 'data')

// Гарантируем наличие директории для БД
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
  console.log(`[БД] Создана директория: ${dataDir}`)
}

const dbPath = join(dataDir, 'analytics.db')
const sqlite = new Database(dbPath)

// Включаем внешние ключи (ON DELETE CASCADE и т.д.)
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
