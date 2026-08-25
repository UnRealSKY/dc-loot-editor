// 計時提示音（WebAudio）。兩個機制面板共用同一個 AudioContext——
// 首次操作時才建立，符合瀏覽器的自動播放限制；無音訊環境靜默略過，計時照常運作。

let audio: AudioContext | null = null

export function ensureAudio(): void {
  try {
    audio ??= new AudioContext()
  } catch {
    // 無音訊環境忽略
  }
}

// 是否發聲由呼叫端判斷（各面板自己的聲音開關）
export function beep(freq: number, ms: number, delayMs = 0): void {
  ensureAudio()
  if (!audio) return
  try {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.value = 0.12
    osc.connect(gain).connect(audio.destination)
    const t = audio.currentTime + delayMs / 1000
    osc.start(t)
    osc.stop(t + ms / 1000)
  } catch {
    // 無聲環境忽略
  }
}
