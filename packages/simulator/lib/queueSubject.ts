import { Subject, mergeMap, catchError, from } from 'rxjs'
import { debug, error } from './log'

const API_CALL_LIMIT = 30

interface QueueItem<T> {
  fn: () => Promise<T> | T
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const queueSubject = new Subject<any>()
let queueLength = 0

export function queue<T>(fn: () => Promise<T> | T): Promise<T> {
  queueLength++
  return new Promise<any>((resolve, reject) => {
    queueSubject.next({ fn, resolve, reject })
  })
}

queueSubject
  .pipe(
    mergeMap(
      ({ fn, resolve, reject }) =>
        from(fn()).pipe(
          mergeMap((result: any) => {
            queueLength--
            debug('queueLength', queueLength)
            resolve(result)
            return []
          }),
          catchError((err) => {
            queueLength--
            error('error queue', err, queueLength)
            reject(err)
            return []
          })
        ),
      API_CALL_LIMIT
    )
  )
  .subscribe()

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = queue
}

export default queue
