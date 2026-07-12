/**
 * PageShell Contract Tests
 *
 * These tests validate the contract behavior of PageShell — NOT internal
 * implementation details. Each test maps to a specific rule in the spec.
 *
 * Run: npx vitest run frontend/workspaces/geo/tests/foundation/page-shell-contract.test.ts
 *
 * @file page-shell-contract.test.ts
 */

import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import PageShell from '~/workspaces/geo/components/foundation/PageShell.vue'

/**
 * Helper: mount PageShell with common test props
 */
function createShell(props: Record<string, any> = {}, slots: Record<string, string> = {}) {
  return mount(PageShell, {
    props: {
      title: 'Test Page',
      ...props,
    },
    slots: {
      summary: '<div data-testid="summary-slot">Summary content</div>',
      content: '<div data-testid="content-slot">Content body</div>',
      explain: '<div data-testid="explain-slot">Explain content</div>',
      next: '<div data-testid="next-slot">Next action</div>',
      ...slots,
    },
  })
}

describe('PageShell Contract', () => {
  // ─── Test 1: Loading ────────────────────────────────────────────
  it('shows LoadingState when loading=true, hides content and error', () => {
    const wrapper = createShell({
      loading: true,
      error: { title: 'Some Error', reason: 'Something broke' },
    })

    // Should NOT show content
    expect(wrapper.find('[data-testid="content-slot"]').exists()).toBe(false)
    // Should NOT show error text (ErrorState won't have data-testid content)
    expect(wrapper.find('[data-testid="page-state"]').text()).not.toContain('Some Error')
    // LoadingState should be shown (it renders skeleton bars with class)
    expect(wrapper.find('.foundation-loading').exists()).toBe(true)
  })

  // ─── Test 2: Error priority over empty ──────────────────────────
  it('error priority over empty (when both error and empty are provided, shows error)', () => {
    const wrapper = createShell({
      error: { title: 'Critical Error', reason: 'Network failure' },
      empty: { title: 'No data' },
    })

    // Should show error, not empty
    expect(wrapper.find('.foundation-error').exists()).toBe(true)
    expect(wrapper.find('.foundation-empty').exists()).toBe(false)
    // Should not show content slot
    expect(wrapper.find('[data-testid="content-slot"]').exists()).toBe(false)
  })

  // ─── Test 3: Empty priority over content ───────────────────────
  it('empty priority over content (when empty is provided, does not show content slot)', () => {
    const wrapper = createShell({
      empty: { title: 'Nothing here' },
    })

    // Should show empty state, not content
    expect(wrapper.find('.foundation-empty').exists()).toBe(true)
    expect(wrapper.find('[data-testid="content-slot"]').exists()).toBe(false)
  })

  // ─── Test 4: Default state shows content slot ──────────────────
  it('default state shows content slot', () => {
    const wrapper = createShell()

    // Should show content
    expect(wrapper.find('[data-testid="content-slot"]').exists()).toBe(true)
    // Should NOT show any state component
    expect(wrapper.find('.foundation-loading').exists()).toBe(false)
    expect(wrapper.find('.foundation-error').exists()).toBe(false)
    expect(wrapper.find('.foundation-empty').exists()).toBe(false)
  })

  // ─── Test 5: Title renders as a single h1 ──────────────────────
  it('title renders as a unique h1 element', () => {
    const wrapper = createShell({ title: 'My Unique Title' })

    const h1Elements = wrapper.findAll('h1')
    expect(h1Elements).toHaveLength(1)
    expect(h1Elements[0].text()).toBe('My Unique Title')
  })

  // ─── Test 6: hideExplain hides explain slot ────────────────────
  it('does not render explain slot when hideExplain=true', () => {
    const wrapper = createShell({ hideExplain: true })

    expect(wrapper.find('[data-testid="page-explain"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="explain-slot"]').exists()).toBe(false)
  })

  // ─── Test 7: hideNext hides next slot ───────────────────────────
  it('does not render next slot when hideNext=true', () => {
    const wrapper = createShell({ hideNext: true })

    expect(wrapper.find('[data-testid="page-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="next-slot"]').exists()).toBe(false)
  })

  // ─── Test 8: Summary slot renders regardless of state ──────────
  it('summary slot renders in loading state', () => {
    const wrapper = createShell({ loading: true })
    expect(wrapper.find('[data-testid="summary-slot"]').exists()).toBe(true)
  })

  it('summary slot renders in error state', () => {
    const wrapper = createShell({ error: { title: 'Oops' } })
    expect(wrapper.find('[data-testid="summary-slot"]').exists()).toBe(true)
  })

  it('summary slot renders in empty state', () => {
    const wrapper = createShell({ empty: { title: 'Empty' } })
    expect(wrapper.find('[data-testid="summary-slot"]').exists()).toBe(true)
  })

  it('summary slot renders in default state', () => {
    const wrapper = createShell()
    expect(wrapper.find('[data-testid="summary-slot"]').exists()).toBe(true)
  })

  // ─── Test 9: PageShell renders data-testid="page-shell" ────────
  it('renders main element with data-testid="page-shell"', () => {
    const wrapper = createShell()

    expect(wrapper.find('[data-testid="page-shell"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="page-shell"]').element.tagName).toBe('MAIN')
  })

  // ─── Test 10: PageHeader renders data-testid="page-header" ─────
  it('renders PageHeader with data-testid="page-header"', () => {
    const wrapper = createShell()

    expect(wrapper.find('[data-testid="page-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="page-header"]').element.tagName).toBe('HEADER')
  })
})
