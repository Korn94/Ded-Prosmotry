<!-- app/pages/parse-views.vue -->
<template>
  <div class="page-container">
    <header class="page-header">
      <h1>👁 Просмотры по ссылкам</h1>
      <p class="subtitle">Вставьте ссылки на видео OK.RU — количество просмотров будет получено без сохранения в базу данных</p>
    </header>

    <div class="form-card">
      <textarea
        v-model="linksInput"
        placeholder="https://ok.ru/video/123456789&#10;https://ok.ru/video/987654321"
        rows="6"
        :disabled="isProcessing"
      ></textarea>

      <div class="actions">
        <button
          @click="handleParseViews"
          :disabled="isProcessing || !linksInput.trim()"
          class="btn btn-green"
        >
          <Icon v-if="isProcessing" name="lucide:loader-2" class="spin" size="18" />
          <Icon v-else name="lucide:eye" size="18" />
          {{ isProcessing ? 'Парсинг...' : 'Получить просмотры' }}
        </button>
      </div>
    </div>

    <div v-if="results.length > 0" class="results-card">
      <h2>Результат парсинга</h2>
      <div class="results-stats">
        <div class="stat">
          <span class="label">Успешно:</span>
          <span class="value positive">{{ okCount }}</span>
        </div>
        <div class="stat">
          <span class="label">Ошибок:</span>
          <span class="value negative">{{ errorsCount }}</span>
        </div>
        <div class="stat">
          <span class="label">Сумма просмотров:</span>
          <span class="value neutral">{{ formatNumber(totalViews) }}</span>
        </div>
      </div>

      <table class="crm-table">
        <thead>
          <tr>
            <th>Видео</th>
            <th>Название</th>
            <th>Сообщество</th>
            <th class="num">Просмотры</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(result, index) in results" :key="result.videoId || result.link || index">
            <td>
              <a v-if="result.videoId" :href="`https://ok.ru/video/${result.videoId}`" target="_blank">
                {{ result.videoId }}
              </a>
              <span v-else class="error-link">{{ result.link }}</span>
            </td>
            <td>{{ result.title || '–' }}</td>
            <td>{{ result.communityName || 'Без сообщества' }}</td>
            <td class="num">{{ formatNumber(result.views) }}</td>
            <td>
              <span class="status-badge" :class="[result.status, result.errorType === 'network' ? 'network' : '']">
                {{ getStatusText(result.status, result.errorType) }}
              </span>
              <div v-if="result.error" class="error-text">{{ result.error }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ProgressOverlay
      v-if="isProcessing"
      label="Парсинг просмотров"
      :hint="progressHint"
      :current="progressCurrent"
      :total="progressTotal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { readStreamProgress, getStreamHint } from '~/composables/useStreamProgress'
import { formatNumber } from '~/composables/useFormat'

interface ParseResult {
  videoId?: string
  link?: string
  title?: string | null
  communityName?: string | null
  views?: number
  status: 'ok' | 'error'
  error?: string
  errorType?: 'network' | 'parse'
}

const linksInput = ref('')
const isProcessing = ref(false)
const results = ref<ParseResult[]>([])
const progressCurrent = ref(0)
const progressTotal = ref(0)
const totalViews = ref(0)
const progressHint = ref('')

const okCount = computed(() => results.value.filter(r => r.status === 'ok').length)
const errorsCount = computed(() => results.value.filter(r => r.status === 'error').length)

function getStatusText(status: string, errorType?: string): string {
  switch (status) {
    case 'ok': return '✅ Получено'
    case 'error': return errorType === 'network' ? '🌐 Сеть/таймаут' : '❌ Ошибка'
    default: return status
  }
}

async function handleParseViews() {
  if (!linksInput.value.trim()) return

  isProcessing.value = true
  results.value = []
  progressCurrent.value = 0
  progressTotal.value = 0
  totalViews.value = 0

  try {
    await readStreamProgress('/api/parse-views', (event) => {
      // Подсказка «что сейчас происходит» (start/ping) или пусто для остальных событий
      progressHint.value = getStreamHint(event)
      // total известен уже на событии start — оверлей покажется сразу, а не после первого видео
      if (event.type === 'start' && event.total) progressTotal.value = event.total

      if (event.type === 'progress') {
        progressCurrent.value = event.current || 0
        progressTotal.value = event.total || 0

        results.value.push({
          videoId: event.videoId,
          link: event.link,
          title: event.title,
          communityName: event.communityName,
          views: event.views,
          status: (event.status === 'ok' ? 'ok' : 'error'),
          error: event.error,
          errorType: event.errorType
        })
      } else if (event.type === 'done') {
        totalViews.value = (event as any).totalViews || 0
        console.log('[ParseViews] Завершено:', event)
      }
    }, {
      method: 'POST',
      body: { links: linksInput.value }
    })

    linksInput.value = ''
  } catch (err) {
    console.error('[ParseViews] Ошибка:', err)
  } finally {
    isProcessing.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-container {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  
  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    color: var(--text);
  }
  
  .subtitle {
    margin: 0;
    color: var(--text-secondary);
  }
}

.form-card {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);

  textarea {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    padding: 1rem;
    font-size: 0.95rem;
    font-family: monospace;
    resize: vertical;
    margin-bottom: 1rem;

    &::placeholder {
      color: var(--text-secondary);
    }

    &:focus {
      outline: none;
      border-color: var(--blue);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
}

.results-card {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: var(--shadow);

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.3rem;
    color: var(--text);
  }

  .results-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-md);

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .label {
        font-size: 0.85rem;
        color: var(--text-secondary);
      }

      .value {
        font-size: 1.5rem;
        font-weight: 700;

        &.positive { color: var(--green); }
        &.neutral { color: var(--text); }
        &.negative { color: var(--red); }
      }
    }
  }

  .error-link {
    color: var(--red);
  }

  .error-text {
    font-size: 0.8rem;
    color: var(--red);
    margin-top: 0.25rem;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 600;

    &.ok {
      background: rgba(76, 175, 80, 0.2);
      color: var(--green);
    }

    &.error {
      background: rgba(244, 67, 54, 0.2);
      color: var(--red);
    }

    // Сетевая ошибка (таймаут/обрыв) — не вина видео, а проблемы соединения
    &.network {
      background: rgba(255, 152, 0, 0.2);
      color: var(--growth-neutral);
    }
  }
}

.btn {
  @include btn-base;
  
  &-green {
    background: var(--green);
    color: white;
    &:hover:not(:disabled) { background: #388e3c; }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
