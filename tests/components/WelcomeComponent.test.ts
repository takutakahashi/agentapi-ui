import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WelcomeComponent from '~/components/WelcomeComponent.vue'

describe('WelcomeComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(WelcomeComponent)
    expect(wrapper.text()).toContain('Hello from TypeScript component!')
  })

  it('updates message when button is clicked', async () => {
    const wrapper = mount(WelcomeComponent)
    const button = wrapper.find('button')
    
    await button.trigger('click')
    
    expect(wrapper.text()).toContain('Updated at')
  })
})