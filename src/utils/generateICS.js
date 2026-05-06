export function generateICS(events) {
  const formatDate = (dateStr) => dateStr.replace(/-/g, '')

  const eventBlocks = events.map(e => [
    'BEGIN:VEVENT',
    `UID:${e.id || Math.random().toString(36).slice(2)}@claimsmart.uk`,
    `DTSTART;VALUE=DATE:${formatDate(e.date)}`,
    `DTEND;VALUE=DATE:${formatDate(e.date)}`,
    `SUMMARY:${e.title}`,
    `DESCRIPTION:${(e.description || '').replace(/\n/g, '\\n')}`,
    'END:VEVENT',
  ].join('\r\n'))

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClaimSmart UK//Benefits Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ClaimSmart UK — Benefits Calendar',
    ...eventBlocks,
    'END:VCALENDAR',
  ].join('\r\n')

  return icsContent
}

export function downloadICS(events, filename = 'claimsmart-calendar.ics') {
  const icsContent = generateICS(events)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
