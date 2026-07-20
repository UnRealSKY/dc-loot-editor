import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutocompleteInput from './AutocompleteInput.vue'

describe('AutocompleteInput', () => {
  it('依輸入前綴過濾建議', async () => {
    const wrapper = mount(AutocompleteInput, {
      props: { modelValue: '', suggestions: ['附加大師', '附加奇幻', '楓祝30'] },
    })
    await wrapper.find('input').setValue('附加')
    const options = wrapper.findAll('.suggestion')
    expect(options).toHaveLength(2)
    expect(options[0].text()).toBe('附加大師')
  })

  it('點選建議會 emit update:modelValue 與 select', async () => {
    const wrapper = mount(AutocompleteInput, {
      props: { modelValue: '附', suggestions: ['附加大師'] },
    })
    await wrapper.find('input').setValue('附')
    await wrapper.find('.suggestion').trigger('mousedown')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['附加大師'])
    expect(wrapper.emitted('select')![0]).toEqual(['附加大師'])
  })
})
