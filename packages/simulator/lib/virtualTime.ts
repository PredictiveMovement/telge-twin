import { interval, firstValueFrom } from 'rxjs'
import {
  scan,
  shareReplay,
  map,
  filter,
  distinctUntilChanged,
  tap,
} from 'rxjs/operators'
import { addMilliseconds, startOfDay, addHours, getUnixTime } from 'date-fns'

export class VirtualTime {
  private startHour: number
  private timeMultiplier: number
  private internalTimeScale = 1
  private currentTime: any
  private _now!: number

  constructor(timeMultiplier = 1, startHour = 8.0) {
    this.startHour = startHour
    this.timeMultiplier = timeMultiplier
    this.reset()
  }

  reset(): void {
    const startDate: Date = addHours(startOfDay(new Date()), this.startHour)
    const msUpdateFrequency = 100
    this.currentTime = interval(msUpdateFrequency).pipe(
      scan(
        (acc: Date) =>
          addMilliseconds(
            acc,
            msUpdateFrequency * this.timeMultiplier * this.internalTimeScale
          ),
        startDate
      ),
      shareReplay(1)
    )
    this._now = startDate.getTime()
  }

  getTimeStream() {
    return this.currentTime
  }

  getTimeInMilliseconds() {
    return this.currentTime.pipe(
      map(getUnixTime),
      map((e: number) => e * 1000),
      tap((time: number) => (this._now = time)),
      distinctUntilChanged()
    )
  }

  getTimeInMillisecondsAsPromise(): Promise<number> {
    return firstValueFrom(this.getTimeInMilliseconds())
  }

  now(): number {
    return this._now
  }

  play(): void {
    this.internalTimeScale = 1
  }

  pause(): void {
    this.internalTimeScale = 0
  }

  async waitUntil(time: number): Promise<any> {
    if (this.timeMultiplier === 0) return // don't wait when time is stopped
    if (this.timeMultiplier === Infinity) return // return directly if time is set to infinity
    const waitUntil = time
    return firstValueFrom(
      this.getTimeInMilliseconds().pipe(filter((t: number) => t >= waitUntil))
    )
  }

  async wait(ms: number): Promise<any> {
    const now = await this.getTimeInMillisecondsAsPromise()
    return this.waitUntil(now + ms)
  }

  // Set the speed in which time should advance
  setTimeMultiplier(timeMultiplier: number): void {
    this.timeMultiplier = timeMultiplier
  }
}

export const virtualTime = new VirtualTime(1, 8.0)

// CJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  module.exports = { VirtualTime, virtualTime }
}
