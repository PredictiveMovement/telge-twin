const { VirtualTime } = require('../../lib/virtualTime')

// Lightweight numeric proximity check without TS augmentation
const toBeNear = (received: number, expected: number) =>
  Math.round(received / 100) === Math.round(expected / 100)

describe('VirtualTime', () => {
  let virtualTime: any
  let sub: any

  beforeEach(() => {
    virtualTime = new VirtualTime(1)
    // Subscribe to drive the internal interval and update .now()
    sub = virtualTime.getTimeInMilliseconds().subscribe(() => {})
  })

  afterEach(() => {
    if (sub && sub.unsubscribe) sub.unsubscribe()
  })

  it('can pass the time', (done) => {
    let start = virtualTime.now()

    setTimeout(() => {
      expect(toBeNear(virtualTime.now(), start + 1000)).toBe(true)
      done()
    }, 1100)
  })

  it('can pause and receive same time', (done) => {
    let start = virtualTime.now()
    virtualTime.pause()

    setTimeout(() => {
      expect(toBeNear(virtualTime.now(), start)).toBe(true)
      done()
    }, 1100)
  })

  it('can pause and receive same time after play', (done) => {
    let start = virtualTime.now()
    virtualTime.pause()

    setTimeout(() => {
      virtualTime.play()
      expect(toBeNear(virtualTime.now(), start)).toBe(true)
      done()
    }, 1100)
  })

  it('can pause and resume and receive same time plus extra time', (done) => {
    let start = virtualTime.now()
    virtualTime.pause()

    setTimeout(() => {
      expect(toBeNear(virtualTime.now(), start)).toBe(true)
      virtualTime.play()

      setTimeout(() => {
        expect(toBeNear(virtualTime.now(), start + 1000)).toBe(true)
        done()
      }, 1100)
    }, 1100)
  })
})
