import { describe, it, expect } from 'vitest'
import { buildAliasMap } from '#src/store/roster'

describe('buildAliasMap', () => {
  it('建立 handle→alias 映射', () => {
    const m = buildAliasMap([
      { handle: '@.unrealsky', alias: '天天' },
      { handle: '@trm.andy', alias: '安迪' },
    ])
    expect(m.get('@.unrealsky')).toBe('天天')
    expect(m.get('@trm.andy')).toBe('安迪')
  })
  it('略過缺 handle 或 alias 的項目', () => {
    const m = buildAliasMap([
      { handle: '', alias: 'x' },
      { handle: '@a', alias: '' },
      { handle: '@b', alias: '乙' },
    ])
    expect(m.has('')).toBe(false)
    expect(m.has('@a')).toBe(false)
    expect(m.get('@b')).toBe('乙')
  })
})
