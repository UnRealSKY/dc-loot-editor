import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ShieldTimer from '#src/components/ShieldTimer.vue'

// 皮卡啾／粉豆 反25 間20 浮動3；杜納斯 反20 間25 浮動0；魔消預設 20（玩家技能）
const chips = (w: ReturnType<typeof mount>) => w.findAll('.boss-chip')
const numberInputs = (w: ReturnType<typeof mount>) => w.findAll('input[type="number"]')
// 0 = 反盾持續、1 = 反盾間隔、2 = 間隔浮動、3 = 魔消持續
const seconds = (w: ReturnType<typeof mount>, i: number) =>
  (numberInputs(w)[i].element as HTMLInputElement).value

describe('ShieldTimer 選王', () => {
  beforeEach(() => localStorage.clear())

  it('列出所有王，預設選第一隻', () => {
    const w = mount(ShieldTimer)
    expect(chips(w).map((c) => c.text())).toEqual(['皮卡啾／粉豆', '杜納斯'])
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
