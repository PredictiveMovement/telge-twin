import { throttleTime } from 'rxjs/operators'
import type { Socket } from 'socket.io'

export function register(experiment: unknown, socket: Socket) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const virtualTime = (experiment as { virtualTime: any }).virtualTime

  socket.on('reset', () => virtualTime.reset())
  socket.on('play', () => virtualTime.play())
  socket.on('pause', () => virtualTime.pause())
  socket.on('speed', (speed: number) => virtualTime.setTimeMultiplier(speed))

  return [
    virtualTime
      .getTimeStream()
      .pipe(throttleTime(1000))
      .subscribe((time: number) => socket.emit('time', time)),
  ]
}

export default { register }

// cjs fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { register }
