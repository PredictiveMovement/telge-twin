const originalEnv = { ...process.env }

describe('queueSubject concurrency & delay', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    process.env.VROOM_CONCURRENT_LIMIT = '1'
    process.env.VROOM_DELAY_MS = '50'
    // re-require module to pick up env
  })

  afterEach(() => {
    jest.useRealTimers()
    process.env = { ...originalEnv }
  })

  it('emits completions with delay and starts can overlap by design', async () => {
    const queue =
      require('../../lib/queueSubject').default ||
      require('../../lib/queueSubject')
    const order: string[] = []

    const p1 = queue(() => {
      order.push('start-1')
      return Promise.resolve('1')
    }).then(() => order.push('done-1'))

    const p2 = queue(() => {
      order.push('start-2')
      return Promise.resolve('2')
    }).then(() => order.push('done-2'))

    const p3 = queue(() => {
      order.push('start-3')
      return Promise.resolve('3')
    }).then(() => order.push('done-3'))

    await Promise.resolve()
    jest.advanceTimersByTime(60)
    await Promise.resolve()

    expect(order.includes('done-1')).toBe(true)

    jest.advanceTimersByTime(60)
    await Promise.resolve()
    expect(order.includes('done-2')).toBe(true)

    jest.advanceTimersByTime(60)
    await Promise.resolve()
    expect(order.includes('done-3')).toBe(true)

    await Promise.all([p1, p2, p3])
  })
})
