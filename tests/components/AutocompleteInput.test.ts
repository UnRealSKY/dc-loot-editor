import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutocompleteInput from '../../src/components/AutocompleteInput.vue'

describe('AutocompleteInput', () => {
  it('依輸入前綴過濾建議', async () => {
    const wrapper = mount(AutocompleteInput, {
      props: {
        modelValue: '',
        suggestions: ['附加大師', '附加奇幻', '楓祝30'],
        'onUpdate:modelValue': async (value: string) => {
          await wrapper.setProps({ modelValue: value })
        },
      },
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
    await wrapper.find('input').trigger('focus')
    await wrapper.find('.suggestion').trigger('mousedown')
    const updateEmits = wrapper.emitted('update:modelValue')!
    expect(updateEmits[updateEmits.length - 1]).toEqual(['附加大師'])
    expect(wrapper.emitted('select')![0]).toEqual(['附加大師'])
  })

  it('父層透過 v-model 由外部更新 modelValue 時，顯示值與過濾結果同步更新', async () => {
    const wrapper = mount(AutocompleteInput, {
      props: { modelValue: '', suggestions: ['附加大師', '楓祝30'] },
    })
    await wrapper.setProps({ modelValue: '楓' })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('楓')

    await wrapper.find('input').trigger('focus')
    const options = wrapper.findAll('.suggestion')
    expect(options).toHaveLength(1)
    expect(options[0].text()).toBe('楓祝30')
  })
})
