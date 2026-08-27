import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ShieldTimer from '#src/components/ShieldTimer.vue'
import { BOSSES } from '#src/shield/bosses'
import { clearAnchor } from '#src/shield/anchor'
import { setHpNow, clearHpNow } from '#src/hp/current'

// 皮卡啾／粉豆 反25 間20 浮動3；杜納斯 反20 間25 浮動0；魔消預設 20（玩家技能）
const chips = (w: ReturnType<typeof mount>) => w.findAll('.boss-chip')
const numberInputs = (w: ReturnType<typeof mount>) => w.findAll('input[type="number"]')
// 0 = 反盾持續、1 = 反盾間隔、2 = 間隔浮動、3 = 魔消持續
const seconds = (w: ReturnType<typeof mount>, i: number) =>
  (numberInputs(w)[i].element as HTMLInputElement).value

describe('ShieldTimer 選王', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAnchor()
  })

  it('列出所有王，預設選第一隻', () => {
    const w = mount(ShieldTimer)
    expect(chips(w).map((c) => c.text())).toEqual(BOSSES.map((b) => b.name))
    expect(chips(w)[0].classes()).toContain('boss-on')
  })

  it('換王會套用該王的秒數並記住選擇', async () => {
    const w = mount(ShieldTimer)
    await chips(w)[1].trigger('click')
    expect(chips(w)[1].classes()).toContain('boss-on')
    expect(seconds(w, 0)).toBe('20') // 反盾持續
    expect(seconds(w, 1)).toBe('25') // 反盾間隔
    expect(localStorage.getItem('dc-shield-boss')).toBe('dunas')
  })

  it('魔消持續是玩家技能，換王不變', async () => {
    const w = mount(ShieldTimer)
    expect(seconds(w, 3)).toBe('20')
    await chips(w)[1].trigger('click')
    expect(seconds(w, 3)).toBe('20')
  })

  it('計時中鎖住換王，重置後解鎖', async () => {
    const w = mount(ShieldTimer)
    await w.findAll('.ctrl')[0].trigger('click') // 反盾開始
    expect(chips(w).every((c) => c.attributes('disabled') !== undefined)).toBe(true)
    expect(w.find('.lock-hint').exists()).toBe(true)

    await w.findAll('.ctrl')[4].trigger('click') // 重置
    expect(chips(w).every((c) => c.attributes('disabled') === undefined)).toBe(true)
    expect(w.find('.lock-hint').exists()).toBe(false)
  })
})

describe('ShieldTimer 參數覆寫', () => {
  beforeEach(() => localStorage.clear())

  it('改秒數只影響當下這隻王，並存進覆寫表', async () => {
    const w = mount(ShieldTimer)
    await chips(w)[1].trigger('click') // 杜納斯
    await numberInputs(w)[0].setValue(22)
    expect(JSON.parse(localStorage.getItem('dc-shield-overrides')!)).toEqual({
      dunas: { shieldDuration: 22, interval: 25, intervalFloat: 0 },
    })

    await chips(w)[0].trigger('click') // 切回皮卡啾：仍是內建預設
    expect(seconds(w, 0)).toBe('25')
  })

  it('有覆寫才出現「還原預設」，按下即回內建值', async () => {
    const w = mount(ShieldTimer)
    expect(w.find('.reset-boss').exists()).toBe(false)

    await numberInputs(w)[0].setValue(26)
    expect(w.find('.reset-boss').text()).toBe('還原皮卡啾／粉豆預設')

    await w.find('.reset-boss').trigger('click')
    expect(seconds(w, 0)).toBe('25')
    expect(w.find('.reset-boss').exists()).toBe(false)
  })

  it('秒數改回內建預設會自動移除覆寫', async () => {
    const w = mount(ShieldTimer)
    await numberInputs(w)[0].setValue(26)
    await numberInputs(w)[0].setValue(25)
    expect(w.find('.reset-boss').exists()).toBe(false)
    expect(JSON.parse(localStorage.getItem('dc-shield-overrides')!)).toEqual({})
  })
})

describe('ShieldTimer 切到循環模板的王（女皇）', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAnchor()
  })

  const queenChip = (w: ReturnType<typeof mount>) =>
    chips(w)[BOSSES.findIndex((b) => b.id === 'queen')]
  const items = (w: ReturnType<typeof mount>) => w.findAll('.cycle-item')

  it('換到女皇時反盾面板收起，改列出全部機制', async () => {
    const w = mount(ShieldTimer)
    await queenChip(w).trigger('click')
    expect(w.find('.controls').exists()).toBe(false) // 反盾的操作區
    expect(items(w).map((li) => li.find('.phase-title').text())).toEqual([
      '活屍60s', '鎖潛能90s', '變豬60s', '反盾80s', '小黑屋90s',
    ])
  })

  it('每個機制各自觸發，沒按過的維持未開始', async () => {
    const w = mount(ShieldTimer)
    await queenChip(w).trigger('click')
    await items(w)[0].find('.trigger').trigger('click')
    expect(items(w)[0].find('.seg-remaining').text()).toBe('60s')
    expect(items(w)[1].find('.not-started').exists()).toBe(true)
  })

  it('微調只影響按下去的那個機制', async () => {
    const w = mount(ShieldTimer)
    await queenChip(w).trigger('click')
    await items(w)[0].find('.trigger').trigger('click')
    await items(w)[0].findAll('.nudge')[1].trigger('click') // ＋1s
    expect(items(w)[0].find('.seg-remaining').text()).toBe('61s')
    expect(items(w)[1].find('.not-started').exists()).toBe(true)
  })

  it('沒開始的機制不給微調（欄位仍在，一按觸發卡片才不會突然撐高）', async () => {
    const w = mount(ShieldTimer)
    await queenChip(w).trigger('click')
    const nudges = items(w)[0].findAll('.nudge')
    expect(nudges).toHaveLength(2)
    expect(nudges.every((b) => b.attributes('disabled') != null)).toBe(true)
  })

  it('倒數到剩 5 秒內轉成警戒色，過了那一輪就恢復', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(ShieldTimer)
      await queenChip(w).trigger('click')
      await items(w)[0].find('.trigger').trigger('click') // 活屍 60s
      vi.advanceTimersByTime(56_000)
      await nextTick()
      expect(items(w)[0].find('.seg-remaining').text()).toBe('4s')
      expect(items(w)[0].classes()).toContain('phase-shield') // 跟反盾面板同一組配色語意
      // 到點後自動接下一輪，回到 60 秒
      vi.advanceTimersByTime(4_000)
      await nextTick()
      expect(items(w)[0].find('.seg-remaining').text()).toBe('60s')
      expect(items(w)[0].classes()).toContain('phase-attack')
    } finally {
      vi.useRealTimers()
    }
  })

  it('有循環在跑就鎖住換王，重置後才放開', async () => {
    const w = mount(ShieldTimer)
    await queenChip(w).trigger('click')
    await items(w)[0].find('.trigger').trigger('click')
    expect(chips(w)[0].attributes('disabled')).toBeDefined()
    await w.find('.cycle-head .btn').trigger('click') // 重置
    expect(chips(w)[0].attributes('disabled')).toBeUndefined()
  })
})

describe('對齊遊戲計時後顯示的是時間，而且不會一直跳', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAnchor()
  })

  async function align(w: ReturnType<typeof mount>, mmss: string) {
    await w.find('.anchor-input').setValue(mmss)
    await w.findAll('.anchor-row .btn')[0].trigger('click')
  }

  it('對齊後有一個持續走的遊戲計時可以核對', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(ShieldTimer)
      expect(w.find('.game-clock').exists()).toBe(false) // 沒對齊就沒有
      await align(w, '12:00')
      expect(w.find('.game-clock').text()).toBe('12:00')
      vi.advanceTimersByTime(5_000)
      await nextTick()
      expect(w.find('.game-clock').text()).toBe('11:55') // 跟著遊戲一起倒數
      // 校準 −1 秒後也要跟著改
      await w.findAll('.anchor-row .btn')[1].trigger('click')
      await nextTick()
      expect(w.find('.game-clock').text()).toBe('11:54')
    } finally {
      vi.useRealTimers()
    }
  })

  it('反盾：可輸出到顯示遊戲時間，倒數走動時那個時刻不動', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(ShieldTimer)
      await align(w, '12:00')
      await w.findAll('.ctrl')[2].trigger('click') // 反盾阻止成功
      await nextTick()
      const at = w.find('.until-time').text()
      expect(at).toMatch(/^\d{2}:\d{2}$/)
      // 阻止成功 25s + 間隔 20s＝可以打到 11:15
      expect(at).toBe('11:15')
      vi.advanceTimersByTime(3_000)
      await nextTick()
      expect(w.find('.until-time').text()).toBe(at) // 秒數在走，時刻不該跟著漂
      // 25 秒那段走掉 3 秒（更新是逐幀的，最後一幀落在 2992ms，進位後 23）
      expect(w.find('.seg-remaining').text()).toBe('本段 23s')
    } finally {
      vi.useRealTimers()
    }
  })

  it('選女皇時遊戲計時照樣走——反盾狀態機停了，時鐘不能跟著停', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(ShieldTimer)
      await chips(w)[BOSSES.findIndex((b) => b.id === 'queen')].trigger('click')
      // 切到女皇之後過了一段時間才對齊，對齊當下就該顯示輸入的時間
      vi.advanceTimersByTime(23_000)
      await nextTick()
      await align(w, '44:00')
      await nextTick()
      expect(w.find('.game-clock').text()).toBe('44:00')
      vi.advanceTimersByTime(5_000)
      await nextTick()
      expect(w.find('.game-clock').text()).toBe('43:55')
    } finally {
      vi.useRealTimers()
    }
  })

  it('女皇：每個機制顯示下次觸發的遊戲時間，並列出接下來的時間表', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(ShieldTimer)
      await chips(w)[BOSSES.findIndex((b) => b.id === 'queen')].trigger('click')
      await align(w, '12:00')
      await w.findAll('.cycle-item')[0].find('.trigger').trigger('click') // 活屍 60s
      await nextTick()
      expect(w.findAll('.cycle-item')[0].find('.until-time').text()).toBe('11:00')
      vi.advanceTimersByTime(3_000)
      await nextTick()
      expect(w.findAll('.cycle-item')[0].find('.until-time').text()).toBe('11:00')
      // 時間表列出同一個機制接下來的每一輪
      const rows = w.findAll('.events-card .event')
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0].find('.ev-time').text()).toBe('11:00')
      expect(rows[0].find('.ev-label').text()).toBe('活屍')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('阿卡伊農：血量掉到門檻就提醒', () => {
  const akaironChip = (w: ReturnType<typeof mount>) =>
    chips(w)[BOSSES.findIndex((b) => b.id === 'akairon')]

  beforeEach(() => {
    localStorage.clear()
    clearAnchor()
    clearHpNow()
  })

  it('沒有血量讀數時說明要先開擷取', async () => {
    const w = mount(ShieldTimer)
    await akaironChip(w).trigger('click')
    expect(w.find('.need-capture').exists()).toBe(true)
    expect(w.findAll('.mark').map((e) => e.text())).toEqual(['80%', '60%', '40%', '20%'])
  })

  it('報出距離下一個門檻還有多少', async () => {
    const w = mount(ShieldTimer)
    await akaironChip(w).trigger('click')
    setHpNow(93.5, 0.5, Date.now())
    await nextTick()
    expect(w.find('.phase-title').text()).toBe('下一個 80%')
    expect(w.find('.gap-value').text()).toContain('13.5')
    expect(w.find('.chip-hp').text()).toBe('目前 93.5%')
  })

  it('進到提前量之內就轉成警戒色', async () => {
    const w = mount(ShieldTimer)
    await akaironChip(w).trigger('click')
    setHpNow(84, 0.5, Date.now())
    await nextTick()
    expect(w.find('.phase-panel').classes()).toContain('phase-warn')
  })

  it('跨過門檻時標記已過並顯示機制來了', async () => {
    const w = mount(ShieldTimer)
    await akaironChip(w).trigger('click')
    setHpNow(81, 0.5, Date.now())
    await nextTick()
    setHpNow(79, 0.5, Date.now())
    await nextTick()
    expect(w.find('.phase-title').text()).toContain('80%')
    expect(w.findAll('.mark')[0].classes()).toContain('done')
  })

  it('一口氣掉很多時，中間的門檻也算過了', async () => {
    const w = mount(ShieldTimer)
    await akaironChip(w).trigger('click')
    setHpNow(85, 1, Date.now())
    await nextTick()
    setHpNow(35, 1, Date.now())
    await nextTick()
    const marks = w.findAll('.mark')
    expect(marks[0].classes()).toContain('done') // 80
    expect(marks[1].classes()).toContain('done') // 60
    expect(marks[2].classes()).toContain('done') // 40
    expect(marks[3].classes()).not.toContain('done') // 20 還沒
  })
})
