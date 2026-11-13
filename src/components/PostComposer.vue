<script setup>
import { computed, ref } from 'vue'
import { MAX_LENGTH } from '../../shared/limits.js'

const props = defineProps({
  maxLength: { type: Number, default: MAX_LENGTH },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])

const text = ref('')
const composing = ref(false)
const inputRef = ref(null)

const length = computed(() => text.value.length)
const canSubmit = computed(
  () =>
    !props.submitting &&
    text.value.trim().length > 0 &&
    length.value <= props.maxLength
)

const counterClass = computed(() => ({
  'is-warning':
    length.value >= props.maxLength * 0.8 && length.value <= props.maxLength,
  'is-over': length.value > props.maxLength
}))

function submit() {
  if (!canSubmit.value) return

  const value = text.value.trim()
  text.value = ''
  emit('submit', value)
}

// 发布失败时由父组件把草稿放回输入框，避免用户重新输入。
// 用户已经开始写新内容时不能覆盖，否则会静默丢失输入。
function restoreDraft(value) {
  if (typeof value !== 'string' || !value.trim()) return
  if (text.value.trim()) return

  text.value = value
  inputRef.value?.focus?.()
}

defineExpose({ restoreDraft })

function onKeydown(event) {
  if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
  if (composing.value || event.isComposing) return

  event.preventDefault()
  submit()
}
</script>

<template>
  <section class="composer" aria-labelledby="composer-title">
    <h1 id="composer-title" class="composer__title">此刻，想留下点什么？</h1>

    <form class="composer__form" autocomplete="off" @submit.prevent="submit">
      <label class="sr-only" for="post-input">输入内容</label>
      <textarea
        id="post-input"
        ref="inputRef"
        v-model="text"
        data-testid="post-input"
        class="composer__input"
        rows="3"
        :maxlength="maxLength"
        placeholder="写下一句碎语……"
        @keydown="onKeydown"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      ></textarea>

      <div class="composer__footer">
        <p class="composer__hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> 快速发布</p>
        <div class="composer__actions">
          <span
            data-testid="char-count"
            class="counter"
            :class="counterClass"
            aria-live="polite"
          >
            {{ length }} / {{ maxLength }}
          </span>
          <button
            data-testid="publish-btn"
            class="btn btn--primary"
            type="submit"
            :disabled="!canSubmit"
            @click.prevent="submit"
          >
            {{ submitting ? '发布中…' : '发布' }}
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.composer {
  padding: var(--gap-4);
  background: linear-gradient(180deg, rgba(26, 34, 48, 0.9), rgba(19, 26, 34, 0.78));
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: border-color 0.3s var(--ease), box-shadow 0.3s var(--ease);
}

.composer:focus-within {
  border-color: rgba(91, 140, 255, 0.45);
  box-shadow: var(--shadow-md), 0 0 0 4px rgba(91, 140, 255, 0.1);
}

.composer__title {
  margin-bottom: var(--gap-3);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.composer__input {
  display: block;
  width: 100%;
  min-height: 84px;
  padding: 14px 16px;
  font-size: 17px;
  line-height: 1.7;
  color: var(--text-1);
  background: rgba(11, 15, 20, 0.55);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  resize: vertical;
  transition: background 0.25s var(--ease), border-color 0.25s var(--ease);
}

.composer__input::placeholder {
  color: var(--text-3);
}

.composer__input:focus {
  outline: none;
  background: rgba(11, 15, 20, 0.78);
  border-color: rgba(169, 123, 255, 0.5);
}

.composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-2);
  margin-top: var(--gap-3);
  flex-wrap: wrap;
}

.composer__hint {
  font-size: 12px;
  color: var(--text-3);
}

.composer__actions {
  display: flex;
  align-items: center;
  gap: var(--gap-3);
  margin-left: auto;
}

.counter {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: var(--text-3);
  transition: color 0.2s var(--ease);
}

.counter.is-warning {
  color: var(--warn);
}

.counter.is-over {
  color: var(--danger);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 10px 28px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  border-radius: var(--radius-pill);
  transition: transform 0.18s var(--ease), box-shadow 0.25s var(--ease),
    opacity 0.2s var(--ease), filter 0.25s var(--ease);
}

.btn--primary {
  color: #0a0e13;
  background: linear-gradient(120deg, var(--accent-1), var(--accent-2) 70%, #c08bff);
  box-shadow: 0 8px 22px rgba(91, 140, 255, 0.28);
}

.btn--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.06);
  box-shadow: 0 12px 28px rgba(122, 124, 255, 0.36);
}

.btn--primary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  box-shadow: none;
  filter: grayscale(0.3);
}

@media (max-width: 768px) {
  .composer {
    padding: var(--gap-3);
    border-radius: var(--radius-md);
  }

  .composer__input {
    font-size: 16px;
    min-height: 76px;
  }

  .composer__hint {
    display: none;
  }

  .composer__actions {
    width: 100%;
    justify-content: space-between;
  }

  .btn {
    min-height: 44px;
  }
}
</style>
