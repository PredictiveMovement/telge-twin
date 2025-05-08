import chalk from 'chalk'
import { ReplaySubject } from 'rxjs'

// eslint-disable-next-line no-undef
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toUpperCase()

const logLevelIsAtLeastDebug = LOG_LEVEL === 'DEBUG'
const logLevelIsAtLeastInfo = LOG_LEVEL === 'INFO' || logLevelIsAtLeastDebug
const logLevelIsAtLeastWarn = LOG_LEVEL === 'WARN' || logLevelIsAtLeastInfo

export const logStream = new ReplaySubject<string>(10)

type Printer = (...args: any[]) => void

type ColorFn = (txt: string) => string

const print = (
  logFn: Printer,
  titleFn: ColorFn,
  messageFn: ColorFn,
  title: string,
  message: string,
  data?: unknown,
  ...rest: unknown[]
) => {
  if (data !== undefined) {
    logFn(
      titleFn(title),
      messageFn(message),
      data instanceof Error ? data : JSON.stringify(data, null, 2),
      ...rest
    )
  } else {
    logFn(titleFn(title), messageFn(message), ...rest)
  }
}

export const debug = (message: string, data?: unknown, ...rest: unknown[]) => {
  if (logLevelIsAtLeastDebug) {
    print(
      console.debug,
      chalk.whiteBright.bold,
      chalk.gray,
      'DEBUG',
      message,
      data,
      ...rest
    )
  }
}

export const error = (title: string, err: unknown, ...rest: unknown[]) => {
  print(
    console.error,
    chalk.redBright.bold,
    chalk.red,
    'ERROR',
    title,
    err,
    ...rest
  )
}

export const info = (message: string, data?: unknown, ...rest: unknown[]) => {
  logStream.next(
    message + ' ' + [data, ...rest].map((x) => JSON.stringify(x)).join(' ')
  )

  if (logLevelIsAtLeastInfo) {
    print(
      console.log,
      chalk.whiteBright.bold,
      chalk.white,
      'INFO ',
      message,
      data,
      ...rest
    )
  }
}

export const warn = (message: string, data?: unknown, ...rest: unknown[]) => {
  if (logLevelIsAtLeastWarn) {
    print(
      console.log,
      chalk.red.bold,
      chalk.white,
      'WARN ',
      message,
      data,
      ...rest
    )
  }
}

export const write = (data: string): void => {
  if (logLevelIsAtLeastDebug) {
    process.stdout.write(data)
  }
}

// CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  module.exports = { logStream, debug, error, info, warn, write }
}
