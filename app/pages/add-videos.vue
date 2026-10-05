<!-- app/pages/add-videos.vue -->
<template>
  <div class="page-container">
    <header class="page-header">
      <h1>➕ Добавить видео</h1>
      <p class="subtitle">Вставьте одну или несколько ссылок на видео OK.RU</p>
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
          @click="handleAddVideos"
          :disabled="isProcessing || !linksInput.trim()"
          class="btn btn-green"
        >
          <Icon v-if="isProcessing" name="lucide:loader-2" class="spin" size="18" />
          <Icon v-else name="lucide:plus" size="18" />
          {{ isProcessing ? 'Добавление...' : 'Добавить видео' }}
        </button>
      </div>
    </div>

    <div v-if="results.length > 0" class="results-card">
      <h2>Результат добавления</h2>
      <div class="results-stats">
        <div class="stat">
          <span class="label">Добавлено:</span>
          <span class="value positive">{{ addedCount }}</span>
        </div>
        <div class="stat">
          <span class="label">Обновлено:</span>
          <span class="value neutral">{{ updatedCount }}</span>
        </div>
        <div class="stat">
          <span class="label">Ошибок:</span>
          <span class="value negative">{{ errorsCount }}</span>
        </div>
      </div>

      <table class="crm-table">
        <thead>
          <tr>
            <th>Видео</th>
            <th>Сообщество</th>
            <th class="num">Просмотры</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="result in results" :key="result.videoId || result.link">
            <td>
              <a v-if="result.videoId" :href="`https://ok.ru/video/${result.videoId}`" target="_blank">
                {{ result.title || `Видео #${result.videoId}` }}
              </a>
              <span v-else class="error-link">{{ result.link }}</span>
            </td>
            <td>{{ result.communityName || 'Без сообщества' }}</td>
            <td class="num">{{ formatNumber(result.views) }}</td>
            <td>
              <span class="status-badge" :class="result.status">
                {{ getStatusText(result.status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ProgressOverlay
      v-if="isProcessing"
      label="Добавление видео"
      :current="progressCurrent"
      :total="progressTotal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { readStreamProgress } from '~/composables/useStreamProgress'
import { formatNumber } from '~/composables/useFormat'

interface AddResult {
  videoId?: string
  link?: string
  title?: string | null
  communityName?: string | null
  views?: number
  status: 'added' | 'updated' | 'error'
  error?: string
}

const linksInput = ref('')
const isProcessing = ref(false)
const results = ref<AddResult[]>([])
const progressCurrent = ref(0)
const progressTotal = ref(0)

const addedCount = computed(() => results.value.filter(r => r.status === 'added').length)
const updatedCount = computed(() => results.value.filter(r => r.status === 'updated').length)
const errorsCount = computed(() => results.value.filter(r => r.status === 'error').length)

function getStatusText(status: string): string {
  switch (status) {
    case 'added': return '✅ Добавлено'
    case 'updated': return '🔄 Обновлено'
    case 'error': return '❌ Ошибка'
    default: return status
  }
}

async function handleAddVideos() {
  if (!linksInput.value.trim()) return

  isProcessing.value = true
  results.value = []
  progressCurrent.value = 0
  progressTotal.value = 0

  try {
    await readStreamProgress('/api/videos', (event) => {
      if (event.type === 'progress') {
        progressCurrent.value = event.current || 0
        progressTotal.value = event.total || 0

        results.value.push({
          videoId: event.videoId,
          link: event.link,
          title: event.title,
          communityName: event.communityName,
          views: event.views,
          status: event.status as any,
          error: event.error
        })
      } else if (event.type === 'done') {
        console.log('[AddVideos] Завершено:', event)
      }
    }, { 
      method: 'POST',
      body: { links: linksInput.value }  // 🔥 ДОБАВЛЕНО: передаём ссылки
    })

    linksInput.value = ''
  } catch (err) {
    console.error('[AddVideos] Ошибка:', err)
  } finally {
    isProcessing.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-container {
  max-width: 1000px;
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

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 600;

    &.added {
      background: rgba(76, 175, 80, 0.2);
      color: var(--green);
    }

    &.updated {
      background: rgba(33, 150, 243, 0.2);
      color: var(--blue);
    }

    &.error {
      background: rgba(244, 67, 54, 0.2);
      color: var(--red);
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
