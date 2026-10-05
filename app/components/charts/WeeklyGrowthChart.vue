<!-- app/components/charts/WeeklyGrowthChart.vue -->
<template>
  <div class="weekly-growth-chart">
    <h2>{{ titleText }}</h2>
    
    <div v-if="!weeklyData.length || allZero" class="empty-state">
      <p>Недостаточно данных для графика (нужно минимум 2 недели)</p>
    </div>
    
    <div v-else class="chart-container">
      <svg
        class="chart-svg"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        preserveAspectRatio="xMidYMid meet"
      >
        <!-- Сетка -->
        <g class="grid-lines">
          <line
            v-for="line in gridLines"
            :key="line.y"
            :x1="chartLeft"
            :y1="line.y"
            :x2="chartRight"
            :y2="line.y"
            stroke="#444"
            stroke-dasharray="4,4"
            :stroke-width="line.value === 0 ? 2 : 1"
            :stroke="line.value === 0 ? '#888' : '#444'"
          />
        </g>

        <!-- Оси -->
        <line :x1="chartLeft" :y1="chartTop" :x2="chartLeft" :y2="chartBottom" stroke="#555" stroke-width="2" />
        
        <!-- Столбцы -->
        <g class="bars">
          <rect
            v-for="(bar, index) in bars"
            :key="index"
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="bar.height"
            :fill="bar.value >= 0 ? '#4caf50' : '#f44336'"
            :opacity="hoveredIndex === index ? 1 : 0.85"
            class="bar"
            @mouseenter="showTooltip(index, $event)"
            @mouseleave="hideTooltip"
            @mousemove="moveTooltip($event)"
          />
        </g>

        <!-- Подписи оси Y -->
        <text
          v-for="label in yAxisLabels"
          :key="label.value"
          :x="chartLeft - 10"
          :y="label.y"
          text-anchor="end"
          alignment-baseline="middle"
          class="axis-label"
          :class="{ 'zero-label': label.value === 0 }"
        >
          {{ formatGrowth(label.value) }}
        </text>

        <!-- Подписи оси X -->
        <text
          v-for="label in xAxisLabels"
          :key="label.date"
          :x="label.x"
          :y="chartBottom + 20"
          text-anchor="middle"
          class="axis-label axis-label-x"
        >
          {{ label.text }}
        </text>
      </svg>

      <!-- Тултип -->
      <Teleport to="body">
        <div
          v-if="tooltip.visible"
          class="tooltip"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
        >
          <div class="tooltip-date">{{ tooltip.date }}</div>
          <div class="tooltip-value" :class="tooltip.value >= 0 ? 'positive' : 'negative'">
            {{ formatGrowth(tooltip.value) }} просмотров
          </div>
          <div class="tooltip-total">
            Итого на конец недели: {{ formatNumber(tooltip.totalViews) }}
          </div>
        </div>
      </Teleport>
    </div>

    <!-- Сводка -->
    <div class="summary" v-if="summary">
      <div class="summary-item">
        <span class="label">Недель с ростом:</span>
        <span class="value positive">{{ summary.positiveWeeks }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Недель со спадом:</span>
        <span class="value negative">{{ summary.negativeWeeks }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Средний прирост/неделю:</span>
        <span class="value" :class="summary.avgGrowth >= 0 ? 'positive' : 'negative'">
          {{ formatGrowth(summary.avgGrowth) }}
        </span>
      </div>
      <div class="summary-item">
        <span class="label">Лучшая неделя:</span>
        <span class="value positive">{{ formatGrowth(summary.maxGrowth) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Худшая неделя:</span>
        <span class="value negative">{{ formatGrowth(summary.minGrowth) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface WeeklyData {
  startDate: string
  totalViews: number
  growth: number
}

const props = withDefaults(defineProps<{
  weeklyData: WeeklyData[]
  titleText?: string
}>(), {
  titleText: '📊 Прирост просмотров по неделям'
})

const svgWidth = 800
const svgHeight = 380
const chartLeft = 90
const chartRight = 760
const chartTop = 30
const chartBottom = 320

const hoveredIndex = ref<number | null>(null)
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  date: '',
  value: 0,
  totalViews: 0
})

// Фильтруем первую неделю (у неё нет предыдущей для сравнения)
const growthData = computed(() => 
  props.weeklyData.slice(1).filter(w => w.growth !== 0 || true) // показываем все, включая нули
)

const allZero = computed(() => 
  growthData.value.length === 0 || growthData.value.every(w => w.growth === 0)
)

const values = computed(() => growthData.value.map(w => w.growth))
const maxPositive = computed(() => Math.max(...values.value.filter(v => v >= 0), 0))
const maxNegative = computed(() => Math.abs(Math.min(...values.value.filter(v => v < 0), 0)))
const maxAbs = computed(() => Math.max(maxPositive.value, maxNegative.value, 1))

const summary = computed(() => {
  const growths = growthData.value.map(w => w.growth)
  if (growths.length === 0) return null
  
  const positiveWeeks = growths.filter(g => g > 0).length
  const negativeWeeks = growths.filter(g => g < 0).length
  const avgGrowth = Math.round(growths.reduce((a, b) => a + b, 0) / growths.length)
  const maxGrowth = Math.max(...growths)
  const minGrowth = Math.min(...growths)
  
  return { positiveWeeks, negativeWeeks, avgGrowth, maxGrowth, minGrowth }
})

const zeroY = computed(() => {
  // Позиция нулевой линии: пропорционально соотношению положительных и отрицательных значений
  const chartHeight = chartBottom - chartTop
  if (maxAbs.value === 0) return chartTop + chartHeight / 2
  
  const totalRange = maxPositive.value + maxNegative.value
  if (totalRange === 0) return chartTop + chartHeight / 2
  
  return chartTop + (maxPositive.value / totalRange) * chartHeight
})

const bars = computed(() => {
  const count = growthData.value.length
  if (count === 0) return []
  
  const chartWidth = chartRight - chartLeft
  const barWidth = (chartWidth / count) * 0.7
  const gap = (chartWidth / count) * 0.3
  
  const upperHeight = zeroY.value - chartTop
  const lowerHeight = chartBottom - zeroY.value
  
  return growthData.value.map((week, index) => {
    const x = chartLeft + (index * (chartWidth / count)) + gap / 2
    const value = week.growth
    
    let y: number
    let height: number
    
    if (value >= 0) {
      // Столбец растёт вверх от нуля
      const normalized = maxPositive.value > 0 ? value / maxPositive.value : 0
      height = normalized * upperHeight
      y = zeroY.value - height
    } else {
      // Столбец растёт вниз от нуля
      const normalized = maxNegative.value > 0 ? Math.abs(value) / maxNegative.value : 0
      height = normalized * lowerHeight
      y = zeroY.value
    }
    
    return { x, y, width: barWidth, height: Math.max(height, 1), value }
  })
})

const gridLines = computed(() => {
  const lines = []
  const steps = 4 // по 4 деления вверх и вниз от нуля
  
  // Нулевая линия
  lines.push({ y: zeroY.value, value: 0 })
  
  // Положительные значения (вверх)
  const upperHeight = zeroY.value - chartTop
  for (let i = 1; i <= steps; i++) {
    const y = zeroY.value - (i / steps) * upperHeight
    const value = Math.round((i / steps) * maxPositive.value)
    lines.push({ y, value })
  }
  
  // Отрицательные значения (вниз)
  const lowerHeight = chartBottom - zeroY.value
  for (let i = 1; i <= steps; i++) {
    const y = zeroY.value + (i / steps) * lowerHeight
    const value = -Math.round((i / steps) * maxNegative.value)
    lines.push({ y, value })
  }
  
  return lines
})

const yAxisLabels = computed(() => gridLines.value)

const xAxisLabels = computed(() => {
  const count = growthData.value.length
  if (count === 0) return []
  
  const chartWidth = chartRight - chartLeft
  const maxLabels = 8
  const step = Math.ceil(count / maxLabels)
  
  return growthData.value
    .filter((_, index) => index % step === 0 || index === count - 1)
    .map((week) => {
      const originalIndex = growthData.value.findIndex(w => w.startDate === week.startDate)
      const x = chartLeft + (originalIndex + 0.5) * (chartWidth / count)
      const dateParts = week.startDate.split('-')
      return { 
        date: week.startDate, 
        x, 
        text: `${dateParts[2]}.${dateParts[1]}` 
      }
    })
})

function formatNumber(num: number): string {
  return new Intl.NumberFormat('ru-RU').format(num)
}

function formatGrowth(growth: number): string {
  const sign = growth > 0 ? '+' : ''
  return `${sign}${formatNumber(growth)}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

function showTooltip(index: number, event: MouseEvent) {
  hoveredIndex.value = index
  const week = growthData.value[index]
  if (!week) return
  
  // Находим индекс в оригинальном weeklyData, чтобы получить даты
  const originalIndex = props.weeklyData.findIndex(w => w.startDate === week.startDate)
  const prevWeek = props.weeklyData[originalIndex - 1]
  
  const startDate = prevWeek ? formatDate(prevWeek.startDate) : '?'
  const endDate = formatDate(week.startDate)
  
  tooltip.value = {
    visible: true,
    x: event.clientX + 10,
    y: event.clientY - 10,
    date: `${startDate} → ${endDate}`,
    value: week.growth,
    totalViews: week.totalViews
  }
}

function hideTooltip() {
  hoveredIndex.value = null
  tooltip.value.visible = false
}

function moveTooltip(event: MouseEvent) {
  tooltip.value.x = event.clientX + 10
  tooltip.value.y = event.clientY - 10
}
</script>

<style lang="scss" scoped>
.weekly-growth-chart {
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

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .chart-container {
    position: relative;
    width: 100%;
  }

  .chart-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .bar {
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .axis-label {
    font-size: 12px;
    fill: var(--text-secondary);
    
    &.zero-label {
      fill: var(--text);
      font-weight: 700;
    }
    
    &-x { font-size: 11px; }
  }

  .summary {
    display: flex;
    gap: 2rem;
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-md);
    flex-wrap: wrap;

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .label {
        font-size: 0.8rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .value {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text);
        font-variant-numeric: tabular-nums;

        &.positive { color: var(--green); }
        &.negative { color: var(--red); }
      }
    }
  }
}

.tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border);

  &-date { 
    font-weight: 600; 
    margin-bottom: 6px; 
    font-size: 12px; 
    color: var(--text-secondary); 
  }
  
  &-value { 
    font-size: 16px; 
    margin-bottom: 4px;
    font-weight: 700;
    
    &.positive { color: var(--green); }
    &.negative { color: var(--red); }
  }
  
  &-total {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
}
</style>