import { customAlphabet } from 'nanoid'

// Ignore ambiguous characters (l1, O0, etc.)
const nanoid = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789',
  4
)

export const safeId = (): string => `${nanoid()}-${nanoid()}`

export default {
  safeId,
}

// Provide CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  module.exports = { safeId }
}
