<!-- app/components/charts/LineChart.vue -->
<template>
  <div class="line-chart">
    <div v-if="!points.length" class="empty">Нет данных для графика</div>
    
    <svg 
      v-else
      :viewBox="`0 0 ${svgWidth} ${svgHeight}`" 
      preserveAspectRatio="xMidYMid meet"
      class="chart-svg"
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
          stroke="#333"
          stroke-dasharray="4,4"
        />
      </g>

      <!-- Оси -->
      <line :x1="chartLeft" :y1="chartTop" :x2="chartLeft" :y2="chartBottom" stroke="#555" stroke-width="1" />
      <line :x1="chartLeft" :y1="chartBottom" :x2="chartRight" :y2="chartBottom" stroke="#555" stroke-width="1" />

      <!-- Область под линией -->
      <polygon :points="areaPoints" :fill="`url(#gradient-${gradientId})`" opacity="0.3" />
      
      <!-- Линия -->
      <polyline
        :points="linePoints"
        fill="none"
        :stroke="color"
        stroke-width="3"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Градиент -->
      <defs>
        <linearGradient :id="`gradient-${gradientId}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :style="`stop-color:${color};stop-opacity:1`" />
          <stop offset="100%" :style="`stop-color:${color};stop-opacity:0`" />
        </linearGradient>
      </defs>

      <!-- Точки с интерактивом -->
      <g class="data-points">
        <circle
          v-for="(point, index) in chartPoints"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="5"
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
        {{ formatY(label.value) }}
      </text>

      <!-- Подписи оси X -->
      <text
        v-for="label in xAxisLabels"
        :key="label.label"
        :x="label.x"
        :y="chartBottom + 20"
        text-anchor="middle"
        class="axis-label axis-label-x"
      >
        {{ label.label }}
      </text>
    </svg>

    <!-- Тултип -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="chart-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <div class="tooltip-label">{{ tooltip.label }}</div>
        <div class="tooltip-value">{{ formatY(tooltip.value) }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Point {
  label: string
  value: number
}

const props = withDefaults(defineProps<{
  points: Point[]
  color?: string
  formatY?: (v: number) => string
}>(), {
  color: '#818cf8',
  formatY: (v: number) => v.toLocaleString('ru-RU')
})

// Уникальный ID для градиента (чтобы не конфликтовал при нескольких графиках на странице)
const gradientId = Math.random().toString(36).slice(2, 9)

const svgWidth = 800
const svgHeight = 320
const chartLeft = 70
const chartRight = 780
const chartTop = 20
const chartBottom = 280

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  label: '',
  value: 0
})

const maxValue = computed(() => Math.max(...props.points.map(p => p.value), 1))
const minValue = computed(() => Math.min(...props.points.map(p => p.value), 0))
const valueRange = computed(() => maxValue.value - minValue.value || 1)

const chartPoints = computed(() => {
  const chartWidth = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop
  const count = props.points.length

  return props.points.map((point, index) => {
    const x = count === 1 
      ? chartLeft + chartWidth / 2 
      : chartLeft + (index / (count - 1)) * chartWidth
    
    const normalized = (point.value - minValue.value) / valueRange.value
    const y = chartBottom - normalized * chartHeight
    
    return { x, y, ...point }
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

const yAxisLabels = computed(() => gridLines.value)

const xAxisLabels = computed(() => {
  if (props.points.length <= 6) {
    return chartPoints.value.map(p => ({ x: p.x, label: p.label }))
  }
  // Если точек много, показываем только первую, последнюю и несколько промежуточных
  const step = Math.ceil(props.points.length / 5)
  return chartPoints.value
    .filter((_, i) => i % step === 0 || i === chartPoints.value.length - 1)
    .map(p => ({ x: p.x, label: p.label }))
})

function showTooltip(index: number, event: MouseEvent) {
  const point = chartPoints.value[index]
  tooltip.value = {
    visible: true,
    x: event.clientX + 15,
    y: event.clientY - 15,
    label: point.label,
    value: point.value
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}

function moveTooltip(event: MouseEvent) {
  tooltip.value.x = event.clientX + 15
  tooltip.value.y = event.clientY - 15
}
</script>

<style lang="scss" scoped>
.line-chart {
  position: relative;
  width: 100%;

  .empty {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .chart-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .data-point {
    cursor: pointer;
    transition: r 0.2s ease;
    &:hover { r: 7; }
  }

  .axis-label {
    font-size: 11px;
    fill: var(--text-secondary);
    &-x { font-size: 10px; }
  }
}

.chart-tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border);

  .tooltip-label {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .tooltip-value {
    font-size: 15px;
    font-weight: 700;
  }
}
</style>