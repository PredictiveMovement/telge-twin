jest.mock('node-fetch', () => jest.fn())

const fetchMock = require('node-fetch') as jest.Mock
const vroomLib = require('../../lib/vroom')

describe('VROOM cancellation', () => {
  const vehicles = [
    {
      id: 1,
      time_window: [0, 3600],
      capacity: [10],
      start: [18.0, 59.0],
      end: [18.0, 59.0],
    },
  ]

  afterEach(() => {
    fetchMock.mockReset()
  })

  it('aborts before making request when shouldAbort is true', async () => {
    const shouldAbort = jest.fn().mockResolvedValue(true)

    await expect(
      vroomLib.plan({ vehicles, shouldAbort })
    ).rejects.toThrow(vroomLib.VROOM_PLANNING_CANCELLED_MESSAGE)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not continue retries once cancellation is detected after a failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network failed'))
    const shouldAbort = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)

    await expect(
      vroomLib.plan({ vehicles, shouldAbort })
    ).rejects.toThrow(vroomLib.VROOM_PLANNING_CANCELLED_MESSAGE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

export {}
