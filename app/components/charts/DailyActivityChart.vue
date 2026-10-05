<!-- app/components/charts/DailyActivityChart.vue -->
<template>
  <div class="daily-activity-chart">
    <h2>📊 Активность за последние 30 дней</h2>
    
    <div v-if="loading" class="loader">Загрузка статистики...</div>
    <div v-else-if="error" class="error">❌ {{ error }}</div>
    <div v-else-if="totalProcessed === 0" class="empty">Нет данных за последние 30 дней</div>
    
    <div v-else class="chart-wrapper">
      <div class="stats-summary">
        <div class="stat">
          <span class="label">Всего обработано:</span>
          <span class="value">{{ totalProcessed }}</span>
        </div>
        <div class="stat">
          <span class="label">Среднее в день:</span>
          <span class="value">{{ averagePerDay }}</span>
        </div>
      </div>

      <div class="bars-container">
        <div 
          v-for="day in data" 
          :key="day.date" 
          class="bar-column"
          :title="`${formatDate(day.date)}: +${day.added} новых, ${day.updated} обновлено`"
        >
          <div class="bar-stack" :style="{ height: getBarHeight(day.total) + 'px' }">
            <!-- updated сверху, added снизу (благодаря column-reverse) -->
            <div class="bar-segment updated" :style="{ height: getSegmentHeight(day.updated, day.total) + 'px' }"></div>
            <div class="bar-segment added" :style="{ height: getSegmentHeight(day.added, day.total) + 'px' }"></div>
          </div>
          <div class="bar-label">{{ formatShortDate(day.date) }}</div>
        </div>
      </div>

      <div class="legend">
        <div class="legend-item">
          <span class="legend-color added"></span>
          <span>Новые видео</span>
        </div>
        <div class="legend-item">
          <span class="legend-color updated"></span>
          <span>Обновления</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface DayStats {
  date: string
  total: number
  added: number
  updated: number
}

const data = ref<DayStats[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const MAX_BAR_HEIGHT = 120 // пикселей

const maxTotal = computed(() => Math.max(...data.value.map(d => d.total), 1))
const totalProcessed = computed(() => data.value.reduce((sum, d) => sum + d.total, 0))
const averagePerDay = computed(() => {
  const activeDays = data.value.filter(d => d.total > 0).length
  return activeDays > 0 ? Math.round(totalProcessed.value / activeDays) : 0
})

function getBarHeight(total: number): number {
  return (total / maxTotal.value) * MAX_BAR_HEIGHT
}

function getSegmentHeight(segment: number, total: number): number {
  if (total === 0) return 0
  return (segment / total) * getBarHeight(total)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }).replace('/', '.')
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    data.value = await $fetch<DayStats[]>('/api/analytics/daily-activity')
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.daily-activity-chart {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
    color: var(--text);
  }

  .loader, .error, .empty {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
  .error { color: var(--red); }

  .stats-summary {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-md);

    .stat {
      .label {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin-right: 0.5rem;
      }
      .value {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text);
      }
    }
  }

  .bars-container {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 160px; // MAX_BAR_HEIGHT + место для лейблов
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
  }

  .bar-column {
    flex: 1;
    min-width: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    cursor: help;

    .bar-stack {
      width: 100%;
      display: flex;
      flex-direction: column-reverse; 
      border-radius: 3px 3px 0 0;
      overflow: hidden;
      transition: height 0.3s ease;
    }

    .bar-segment {
      width: 100%;
      transition: height 0.3s ease;
      
      &.added { background: var(--green); }
      &.updated { background: var(--blue); }
    }

    .bar-label {
      font-size: 0.65rem;
      color: var(--text-secondary);
      margin-top: 4px;
      transform: rotate(-45deg);
      transform-origin: top left;
      white-space: nowrap;
    }
  }

  .legend {
    display: flex;
    gap: 1.5rem;
    margin-top: 1rem;
    justify-content: center;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-secondary);

      .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        &.added { background: var(--green); }
        &.updated { background: var(--blue); }
      }
    }
  }
}
</style>