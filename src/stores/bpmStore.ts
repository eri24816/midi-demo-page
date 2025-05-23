import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStore = defineStore('bpm', () => {
    const bps = ref<number|null>(null)
    const volume = ref(0.5)

    return {
        bps,
        volume
    }
}) 