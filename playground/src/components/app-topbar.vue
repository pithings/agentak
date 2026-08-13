<script setup lang="ts">
import { chat, toggleChat } from "../chat-store";
import { theme, toggleTheme } from "../theme";

const emit = defineEmits<{ (event: "toggle-nav"): void }>();
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur supports-[backdrop-filter]:bg-page/70"
  >
    <div class="mx-auto flex h-14 w-full max-w-[110rem] items-center gap-3 px-4 sm:px-6">
      <button
        type="button"
        class="-ml-1 rounded-md p-2 text-soft hover:bg-fill hover:text-ink lg:hidden"
        aria-label="Toggle the navigation"
        @click="emit('toggle-nav')"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
        </svg>
      </button>

      <RouterLink to="/" class="flex items-center gap-2.5">
        <span
          class="grid size-7 place-items-center rounded-md bg-brand font-mono text-[0.6875rem] font-semibold text-brand-ink"
        >
          wa
        </span>
        <span class="text-sm font-semibold tracking-tight">Agentak</span>
      </RouterLink>

      <div class="ml-auto flex items-center gap-3">
        <button
          type="button"
          class="rounded-md border border-line p-2 text-soft hover:bg-fill hover:text-ink"
          :aria-label="theme === 'dark' ? 'Use the light theme' : 'Use the dark theme'"
          @click="toggleTheme()"
        >
          <svg
            v-if="theme === 'dark'"
            viewBox="0 0 24 24"
            class="size-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
              stroke-linecap="round"
            />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            class="size-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke-linejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          class="hidden items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium hover:opacity-90 sm:inline-flex"
          :class="
            chat.open
              ? 'border border-line text-soft hover:bg-fill hover:text-ink'
              : 'border border-transparent bg-brand text-brand-ink'
          "
          :aria-expanded="chat.open"
          @click="toggleChat()"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4-.8L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"
              stroke-linejoin="round"
            />
          </svg>
          {{ chat.open ? "Hide the agent" : "Ask the agent" }}
        </button>
      </div>
    </div>
  </header>
</template>
