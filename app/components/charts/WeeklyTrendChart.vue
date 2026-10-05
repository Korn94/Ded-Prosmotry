<!-- app/components/charts/WeeklyTrendChart.vue -->
<template>
  <div class="weekly-views-chart">
    <h2>{{ titleText }}</h2>
    
    <div v-if="!weeklyData.length" class="empty-state">
      <p>Недостаточно данных для графика</p>
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
          />
        </g>

        <!-- Оси -->
        <line :x1="chartLeft" :y1="chartTop" :x2="chartLeft" :y2="chartBottom" stroke="#555" stroke-width="2" />
        <line :x1="chartLeft" :y1="chartBottom" :x2="chartRight" :y2="chartBottom" stroke="#555" stroke-width="2" />

        <!-- Область под линией -->
        <polygon :points="areaPoints" fill="url(#weeklyGradient)" opacity="0.3" />
        
        <!-- Линия -->
        <polyline
          :points="linePoints"
          fill="none"
          :stroke="color"
          stroke-width="3"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Градиент (динамический цвет) -->
        <defs>
          <linearGradient id="weeklyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" :style="{ stopColor: color, stopOpacity: 1 }" />
            <stop offset="100%" :style="{ stopColor: color, stopOpacity: 0 }" />
          </linearGradient>
        </defs>

        <!-- Точки с интерактивом -->
        <g class="data-points">
          <circle
            v-for="(point, index) in chartPoints"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            r="6"
            :fill="color"
            stroke="#1e1e1e"
            stroke-width="2"
            class="data-point"
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
        >
          {{ formatNumber(label.value) }}
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
          <div class="tooltip-value">{{ formatNumber(tooltip.value) }} просмотров</div>
          <div class="tooltip-growth" :class="getGrowthClass(tooltip.growth)">
            {{ formatGrowth(tooltip.growth) }}
          </div>
        </div>
      </Teleport>
    </div>

    <!-- Сводка -->
    <div class="summary" v-if="summary">
      <div class="summary-item">
        <span class="label">Всего видео:</span>
        <span class="value">{{ summary.videoCount }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Сумма просмотров:</span>
        <span class="value">{{ formatNumber(summary.totalViews) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Средний рост/неделю:</span>
        <span class="value" :class="getGrowthClass(summary.avgGrowth)">
          {{ formatGrowth(summary.avgGrowth) }}
        </span>
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
  videoCount: number
  totalViews: number
  titleText?: string
  color?: string
}>(), {
  titleText: '📈 Тренд просмотров по неделям',
  color: '#818cf8'
})

const svgWidth = 800
const svgHeight = 380
const chartLeft = 80
const chartRight = 760
const chartTop = 20
const chartBottom = 320

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  date: '',
  value: 0,
  growth: 0
})

const summary = computed(() => {
  if (!props.weeklyData.length) return null
  const growths = props.weeklyData.slice(1).map(w => w.growth)
  const avgGrowth = growths.length > 0 
    ? Math.round(growths.reduce((a, b) => a + b, 0) / growths.length)
    : 0
  return {
    videoCount: props.videoCount,
    totalViews: props.totalViews,
    avgGrowth
  }
})

const values = computed(() => props.weeklyData.map(w => w.totalViews))
const maxValue = computed(() => Math.max(...values.value, 1))
const minValue = computed(() => Math.min(...values.value, 0))
const valueRange = computed(() => maxValue.value - minValue.value || 1)

const chartPoints = computed(() => {
  const chartWidth = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop
  const count = props.weeklyData.length

  return props.weeklyData.map((week, index) => {
    const x = count === 1 
      ? chartLeft + chartWidth / 2 
      : chartLeft + (index / (count - 1)) * chartWidth
    
    const normalized = (week.totalViews - minValue.value) / valueRange.value
    const y = chartBottom - normalized * chartHeight
    
    return { x, y, ...week }
  })
})

const linePoints = computed(() => 
  chartPoints.value.map(p => `${p.x},${p.y}`).join(' ')
)

const areaPoints = computed(() => {
  if (!chartPoints.value.length) return ''
  const firstX = chartPoints.value[0].x
  const lastX = chartPoints.value[chartPoints.value.length - 1].x
  return [
    `${firstX},${chartBottom}`,
    ...chartPoints.value.map(p => `${p.x},${p.y}`),
    `${lastX},${chartBottom}`
  ].join(' ')
})

const gridLines = computed(() => {
  const lines = []
  const chartHeight = chartBottom - chartTop
  const steps = 5
  const step = chartHeight / steps
  
  for (let i = 0; i <= steps; i++) {
    lines.push({
      y: chartBottom - i * step,
      value: minValue.value + (i / steps) * valueRange.value
    })
  }
  return lines
})

const yAxisLabels = computed(() => 
  gridLines.value.map(line => ({
    value: Math.round(line.value),
    y: line.y
  }))
)

const xAxisLabels = computed(() => {
  if (props.weeklyData.length === 0) return []
  const maxLabels = 6
  const step = Math.ceil(props.weeklyData.length / maxLabels)
  
  return props.weeklyData
    .filter((_, index) => index % step === 0 || index === props.weeklyData.length - 1)
    .map((week) => {
      const originalIndex = props.weeklyData.findIndex(w => w.startDate === week.startDate)
      const chartWidth = chartRight - chartLeft
      const x = chartLeft + (originalIndex / (props.weeklyData.length - 1 || 1)) * chartWidth
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
  const sign = growth >= 0 ? '+' : ''
  return `${sign}${formatNumber(growth)}`
}

function getGrowthClass(growth: number): 'positive' | 'negative' | 'neutral' {
  if (growth > 0) return 'positive'
  if (growth < 0) return 'negative'
  return 'neutral'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

function showTooltip(index: number, event: MouseEvent) {
  const week = props.weeklyData[index]
  const point = chartPoints.value[index]
  if (!week || !point) return
  
  const endDate = new Date(week.startDate)
  endDate.setDate(endDate.getDate() + 6)
  
  tooltip.value = {
    visible: true,
    x: event.clientX + 10,
    y: event.clientY - 10,
    date: `${formatDate(week.startDate)} — ${formatDate(endDate.toISOString().split('T')[0])}`,
    value: point.totalViews,
    growth: week.growth
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}

function moveTooltip(event: MouseEvent) {
  tooltip.value.x = event.clientX + 10
  tooltip.value.y = event.clientY - 10
}
</script>

<style lang="scss" scoped>
.weekly-views-chart {
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

  .data-point {
    cursor: pointer;
    transition: r 0.2s ease;
    &:hover { r: 8; }
  }

  .axis-label {
    font-size: 12px;
    fill: var(--text-secondary);
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

  &-date { font-weight: 600; margin-bottom: 6px; font-size: 12px; color: var(--text-secondary); }
  &-value { font-size: 15px; margin-bottom: 4px; }
  &-growth { 
    font-size: 13px; 
    font-weight: 600;
    &.positive { color: var(--green); }
    &.negative { color: var(--red); }
    &.neutral  { color: var(--text-secondary); }
  }
}
</style>