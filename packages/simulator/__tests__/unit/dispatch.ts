const { from, Subject } = require('rxjs')
const { toArray } = require('rxjs/operators')
const { dispatch } = require('../../lib/dispatch/dispatchCentral')

describe('dispatch (current implementation)', () => {
  it('passes through items from an array Observable', (done) => {
    from([1, 2, 3])
      .pipe(toArray())
      .subscribe((arr: number[]) => {
        expect(arr).toEqual([1, 2, 3])
        done()
      })
  })

  it('passes through items from a Subject', (done) => {
    const subj = new Subject()
    const received: number[] = []
    subj.subscribe((n: number) => {
      received.push(n)
      if (received.length === 2) {
        expect(received).toEqual([10, 20])
        done()
      }
    })
    subj.next(10)
    subj.next(20)
  })
})
