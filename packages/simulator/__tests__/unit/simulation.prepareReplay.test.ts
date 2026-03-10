import { buildReplayPreparationParameters } from '../../web/routes/http/simulation'

describe('simulation replay preparation', () => {
  it('preserves the original experiment startDate for replay sessions', () => {
    const parameters = buildReplayPreparationParameters({
      startDate: '2026-03-06T05:00:00.000Z',
    })

    expect(parameters.startDate).toBe('2026-03-06T05:00:00.000Z')
  })

  it('falls back to a generated startDate when the experiment has none', () => {
    const parameters = buildReplayPreparationParameters({})

    expect(typeof parameters.startDate).toBe('string')
    expect(Number.isNaN(Date.parse(parameters.startDate))).toBe(false)
  })
})
