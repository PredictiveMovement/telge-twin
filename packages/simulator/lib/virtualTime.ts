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
  private endHour?: number
  private timeMultiplier: number
  private internalTimeScale = 1
  private currentTime: any
  private _now!: number
  private workdayStartMs!: number
  private workdayEndMs!: number
  private readonly defaultShiftDurationHours = 8

  constructor(timeMultiplier = 1, startHour = 8.0, endHour?: number) {
    this.startHour = startHour
    this.endHour = endHour
    this.timeMultiplier = timeMultiplier
    this.reset()
  }

  reset(): void {
    const startDate: Date = addHours(startOfDay(new Date()), this.startHour)
    const msUpdateFrequency = 100
    this.workdayStartMs = startDate.getTime()

    const resolvedEndHour = this.resolveEndHour()
    const endDate = addHours(startOfDay(startDate), resolvedEndHour)
    this.workdayEndMs = endDate.getTime()

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

  setWorkdayHours(startHour: number, endHour?: number): void {
    this.startHour = startHour
    this.endHour = endHour
    this.reset()
  }

  getWorkdayBounds(): { startMs: number; endMs: number } {
    return {
      startMs: this.workdayStartMs,
      endMs: this.workdayEndMs,
    }
  }

  private resolveEndHour(): number {
    const defaultEnd = this.startHour + this.defaultShiftDurationHours
    if (typeof this.endHour !== 'number' || isNaN(this.endHour)) {
      return defaultEnd
    }

    const startMinutes = Math.round(this.startHour * 60)
    const endMinutes = Math.round(this.endHour * 60)

    if (endMinutes <= startMinutes) {
      const minutesWithRollover = endMinutes + 24 * 60
      return minutesWithRollover / 60
    }

    return this.endHour
  }

  play(): void {
    this.internalTimeScale = 1
  }

  pause(): void {
    this.internalTimeScale = 0
  }

  isPlaying(): boolean {
    return this.internalTimeScale > 0
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

  getTimeMultiplier(): number {
    return this.timeMultiplier
  }
}

class VirtualTimeManager {
  private globalVirtualTime: VirtualTime
  private sessionVirtualTimes: Map<string, VirtualTime>
  private currentSessionId: string | null = null
  private experimentToSession: Map<string, string> = new Map()

  constructor() {
    this.globalVirtualTime = new VirtualTime(1, 8.0)
    this.sessionVirtualTimes = new Map()
  }

  setGlobalVirtualTimeInstance(instance: VirtualTime) {
    this.globalVirtualTime = instance
  }

  registerSession(sessionId: string, sessionVirtualTime: VirtualTime) {
    this.sessionVirtualTimes.set(sessionId, sessionVirtualTime)
  }

  unregisterSession(sessionId: string) {
    this.sessionVirtualTimes.delete(sessionId)
    for (const [
      experimentId,
      sessionIdForExp,
    ] of this.experimentToSession.entries()) {
      if (sessionIdForExp === sessionId) {
        this.experimentToSession.delete(experimentId)
      }
    }
  }

  setCurrentSession(sessionId: string | null) {
    this.currentSessionId = sessionId
  }

  registerExperiment(experimentId: string, sessionId: string) {
    this.experimentToSession.set(experimentId, sessionId)
  }

  private getCurrentVirtualTime(): VirtualTime {
    if (
      this.currentSessionId &&
      this.sessionVirtualTimes.has(this.currentSessionId)
    ) {
      return this.sessionVirtualTimes.get(this.currentSessionId)!
    }

    if (!this.currentSessionId && this.sessionVirtualTimes.size === 1) {
      const singleSession = Array.from(this.sessionVirtualTimes.values())[0]
      return singleSession
    }

    return this.globalVirtualTime
  }

  reset(): void {
    return this.getCurrentVirtualTime().reset()
  }

  getTimeStream() {
    return this.getCurrentVirtualTime().getTimeStream()
  }

  getTimeInMilliseconds() {
    return this.getCurrentVirtualTime().getTimeInMilliseconds()
  }

  getTimeInMillisecondsAsPromise(): Promise<number> {
    return this.getCurrentVirtualTime().getTimeInMillisecondsAsPromise()
  }

  now(): number {
    return this.getCurrentVirtualTime().now()
  }

  play(): void {
    return this.getCurrentVirtualTime().play()
  }

  pause(): void {
    return this.getCurrentVirtualTime().pause()
  }

  isPlaying(): boolean {
    return this.getCurrentVirtualTime().isPlaying()
  }

  async waitUntil(time: number): Promise<any> {
    return this.getCurrentVirtualTime().waitUntil(time)
  }

  async wait(ms: number): Promise<any> {
    return this.getCurrentVirtualTime().wait(ms)
  }

  setTimeMultiplier(timeMultiplier: number): void {
    return this.getCurrentVirtualTime().setTimeMultiplier(timeMultiplier)
  }

  getTimeMultiplier(): number {
    return this.getCurrentVirtualTime().getTimeMultiplier()
  }

  getGlobalVirtualTime(): VirtualTime {
    return this.globalVirtualTime
  }

  getSessionVirtualTime(sessionId: string): VirtualTime | undefined {
    return this.sessionVirtualTimes.get(sessionId)
  }
}

export const virtualTime = new VirtualTimeManager()

// CJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  module.exports = { VirtualTime, virtualTime }
}
