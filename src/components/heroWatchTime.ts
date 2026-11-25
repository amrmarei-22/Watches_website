const cairoTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export type WatchHandAngles = {
  hour: number
  minute: number
  second: number
}

export function getCairoHandAngles(timestamp: number): WatchHandAngles {
  const parts = cairoTimeFormatter.formatToParts(new Date(timestamp))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const hour = value('hour')
  const minute = value('minute')
  const second = value('second') + (timestamp % 1000) / 1000

  return {
    hour: ((hour % 12) + minute / 60 + second / 3600) * 30,
    minute: (minute + second / 60) * 6,
    second: second * 6,
  }
}
