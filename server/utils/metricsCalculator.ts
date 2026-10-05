// server/utils/metricsCalculator.ts
export type TrendType = 'sharp_up' | 'up' | 'stable' | 'down' | 'sharp_down'

export interface TrendResult {
  type: TrendType
  percent: number
  icon: string
}

/**
 * Определяет тренд на основе процентного изменения (согласно ТЗ п. 8.5)
 */
export function calculateTrend(current: number, previous: number): TrendResult {
  if (previous === 0) {
    return { 
      type: current > 0 ? 'sharp_up' : 'stable', 
      percent: 0,
      icon: current > 0 ? '↗️↗️' : '→'
    }
  }
  
  const percent = ((current - previous) / previous) * 100
  
  let type: TrendType = 'stable'
  let icon = '→'
  
  if (percent > 20) { type = 'sharp_up'; icon = '↗️↗️' }
  else if (percent > 5) { type = 'up'; icon = '↗️' }
  else if (percent < -20) { type = 'sharp_down'; icon = '↘️↘️' }
  else if (percent < -5) { type = 'down'; icon = '↘️' }
  
  return { type, percent, icon }
}

/**
 * Возвращает CSS-класс и текстовый статус для вовлечённости (ТЗ п. 8.1)
 */
export function getEngagementStatus(engagement: number): { 
  status: 'high' | 'normal' | 'dead', 
  label: string,
  class: string 
} {
  if (engagement > 1) return { status: 'high', label: 'Высокая', class: 'engagement-high' }
  if (engagement >= 0.1) return { status: 'normal', label: 'Нормальная', class: 'engagement-normal' }
  return { status: 'dead', label: 'Мёртвое', class: 'engagement-dead' }
}
