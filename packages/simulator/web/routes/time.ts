import { throttleTime } from 'rxjs/operators'
import type { Socket } from 'socket.io'

export function register(
  experiment: unknown,
  socket: Socket,
  sessionId?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const virtualTime = (experiment as { virtualTime: any }).virtualTime
  const parameters = (experiment as { parameters?: { dispatchReady?: boolean } })
    .parameters

  if (socket.data.timeControlsRegistered) {
    return []
  }

  if (!sessionId) {
    socket.data.timeControlsRegistered = true

    socket.on('reset', () => {
      virtualTime.reset()
    })
    socket.on('play', () => {
      if (!parameters?.dispatchReady) {
        return
      }
      virtualTime.play()
    })
    socket.on('pause', () => {
      virtualTime.pause()
    })
    socket.on('speed', (speed: number) => {
      const currentSpeed = virtualTime.getTimeMultiplier
        ? virtualTime.getTimeMultiplier()
        : 1
      if (currentSpeed === speed) {
        return
      }

      virtualTime.setTimeMultiplier(speed)
    })

    socket.on('disconnect', () => {
      socket.data.timeControlsRegistered = false
    })

    const timeSubscription = virtualTime
      .getTimeStream()
      .pipe(throttleTime(1000))
      .subscribe((time: number) => {
        socket.emit('time', time)
      })

    return [timeSubscription]
  }

  return []
}

export default { register }

// cjs fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { register }
