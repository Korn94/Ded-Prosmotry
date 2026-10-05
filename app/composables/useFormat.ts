// app/composables/useFormat.ts
// Общие функции форматирования для UI

export const formatNumber = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null) return '–'
  if (typeof num === 'string') return num
  if (num === -1) return 'Ошибка'
  return new Intl.NumberFormat('ru-RU').format(num)
}

export const formatGrowth = (growth: number | undefined | null): string => {
  if (growth === undefined || growth === null) return '–'
  if (growth === -1) return 'Ошибка'
  const sign = growth >= 0 ? '+' : ''
  return `${sign}${formatNumber(growth)}`
}

export const getGrowthClass = (growth: number | undefined | null): 'positive' | 'negative' | 'neutral' => {
  if (growth === undefined || growth === null) return 'neutral'
  if (growth > 0) return 'positive'
  if (growth < 0) return 'negative'
  return 'neutral'
}

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export const formatDateISO = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Возвращает понедельник недели, в которую входит указанная дата (пн = 1, вс = 0)
 */
export const getMonday = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()     // 0 = вск, 1 = пн, ..., 6 = сб
  const diff = day === 0 ? 6 : day - 1 // сколько отнять до понедельника
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}
