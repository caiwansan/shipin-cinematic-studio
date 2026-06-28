import { ref } from 'vue'

export function useReplayFrame(apiBase: string) {
  const frame = ref(0)

  async function fetchFrame(t: number) {
    const res = await fetch(`${apiBase}?t=${t}`)
    return await res.json()
  }

  function updateFrame(t: number) {
    frame.value = t
  }

  return {
    frame,
    fetchFrame,
    updateFrame,
  }
}
