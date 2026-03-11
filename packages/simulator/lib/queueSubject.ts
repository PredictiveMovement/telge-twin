import { Subject, mergeMap, catchError, from, delay } from 'rxjs'

// Configurable settings for API rate limiting
const API_CALL_LIMIT = parseInt(process.env.VROOM_CONCURRENT_LIMIT || '1')
const API_DELAY_MS = parseInt(process.env.VROOM_DELAY_MS || '500')

// OSRM routing calls: higher concurrency, no artificial delay
const OSRM_CALL_LIMIT = parseInt(process.env.OSRM_CONCURRENT_LIMIT || '4')

const queueSubject = new Subject<any>()
const osrmQueueSubject = new Subject<any>()

export function queue<T>(fn: () => Promise<T> | T): Promise<T> {
  return new Promise<any>((resolve, reject) => {
    queueSubject.next({ fn, resolve, reject })
  })
}

export function osrmQueue<T>(fn: () => Promise<T> | T): Promise<T> {
  return new Promise<any>((resolve, reject) => {
    osrmQueueSubject.next({ fn, resolve, reject })
  })
}

queueSubject
  .pipe(
    mergeMap(
      ({ fn, resolve, reject }) =>
        from(fn()).pipe(
          delay(API_DELAY_MS),
          mergeMap((result: any) => {
            resolve(result)
            return []
          }),
          catchError((err) => {
            reject(err)
            return []
          })
        ),
      API_CALL_LIMIT
    )
  )
  .subscribe()

osrmQueueSubject
  .pipe(
    mergeMap(
      ({ fn, resolve, reject }) =>
        from(fn()).pipe(
          mergeMap((result: any) => {
            resolve(result)
            return []
          }),
          catchError((err) => {
            reject(err)
            return []
          })
        ),
      OSRM_CALL_LIMIT
    )
  )
  .subscribe()

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  module.exports = queue
  module.exports.osrmQueue = osrmQueue
}

export default queue
