<!-- app/components/ProgressOverlay.vue -->
<template>
  <Teleport to="body">
    <div v-if="total > 0" class="overlay">
      <div class="overlay-card">
        <h3>{{ label }}</h3>
        
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: percent + '%' }"></div>
        </div>
        
        <div class="progress-info">
          <span class="progress-text">{{ current }} / {{ total }}</span>
          <span class="percent-text">{{ Math.round(percent) }}%</span>
        </div>
        
        <p class="progress-sub">
          Обработано: {{ current }} из {{ total }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  current: number
  total: number
}>()

const percent = computed(() => {
  if (props.total <= 0) return 0
  return Math.min(100, (props.current / props.total) * 100)
})
</script>

<style lang="scss" scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  backdrop-filter: blur(4px);
}

.overlay-card {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 2.5rem;
  max-width: 420px;
  width: 90%;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border);
  
  h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
    color: var(--text);
  }
}

.progress-bar {
  height: 12px;
  background: var(--bg-input);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--blue), #64b5f6);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.progress-text,
.percent-text {
  font-size: 0.95rem;
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.progress-sub {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}
</style>