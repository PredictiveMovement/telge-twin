import { Subject, mergeMap, catchError, from, delay } from 'rxjs'
import { error, info } from './log'

const API_CALL_LIMIT = 1

const queueSubject = new Subject<any>()
let queueLength = 0

export function queue<T>(fn: () => Promise<T> | T): Promise<T> {
  queueLength++
  info(`🔄 Adding to queue, total queued: ${queueLength}`)
  return new Promise<any>((resolve, reject) => {
    queueSubject.next({ fn, resolve, reject })
  })
}

queueSubject
  .pipe(
    mergeMap(
      ({ fn, resolve, reject }) =>
        from(fn()).pipe(
          delay(500),
          mergeMap((result: any) => {
            queueLength--
            info(`✅ Queue completed, remaining: ${queueLength}`)
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
