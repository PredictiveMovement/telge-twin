import type { Socket } from 'socket.io'

export function register(
  experiment: {
    logStream: { subscribe: (fn: (item: unknown) => void) => unknown }
  },
  socket: Socket
) {
  return [
    experiment.logStream.subscribe((item: unknown) => {
      socket.emit('log', item)
    }),
  ]
}

export default { register }

// CJS fallback
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') module.exports = { register }
