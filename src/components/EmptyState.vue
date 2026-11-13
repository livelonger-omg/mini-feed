<template>
  <div class="empty" data-testid="empty-state" role="status">
    <svg class="empty__art" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle
        cx="60"
        cy="60"
        r="44"
        stroke="url(#emptyGrad)"
        stroke-width="1.5"
        stroke-dasharray="6 8"
      />
      <path
        d="M40 52h40M40 66h26"
        stroke="#9AA6B5"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.75"
      />
      <circle cx="94" cy="34" r="5" fill="#A97BFF" />
      <circle cx="26" cy="82" r="3.5" fill="#4EE0B5" />
      <defs>
        <linearGradient
          id="emptyGrad"
          x1="16"
          y1="16"
          x2="104"
          y2="104"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#5B8CFF" />
          <stop offset="1" stop-color="#A97BFF" />
        </linearGradient>
      </defs>
    </svg>
    <p class="empty__title">还没有碎语</p>
    <p class="empty__text">在上面写点什么都行，它只会留在你这台设备上。</p>
  </div>
</template>

<style scoped>
.empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: var(--gap-5) var(--gap-3);
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.012);
}

.empty__art {
  width: 120px;
  height: 120px;
  margin-bottom: 4px;
  animation: breathe 5s var(--ease) infinite;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.75;
    transform: translateY(0) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-4px) scale(1.02);
  }
}

.empty__title {
  font-size: 17px;
  font-weight: 600;
}

.empty__text {
  max-width: 34ch;
  font-size: 14px;
  color: var(--text-3);
}

@media (max-width: 480px) {
  .empty {
    padding: var(--gap-4) var(--gap-2);
  }

  .empty__art {
    width: 96px;
    height: 96px;
  }
}
</style>
