import { Subject, mergeMap, catchError, from, delay } from 'rxjs'
import { error, info } from './log'

// Configurable settings for API rate limiting
const API_CALL_LIMIT = parseInt(process.env.VROOM_CONCURRENT_LIMIT || '1')
const API_DELAY_MS = parseInt(process.env.VROOM_DELAY_MS || '500')

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
          delay(API_DELAY_MS),
          mergeMap((result: any) => {
            queueLength--
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
