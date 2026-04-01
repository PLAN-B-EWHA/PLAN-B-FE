const TIP_SEPARATOR = '|'
const DEFAULT_TIP_SLOT_COUNT = 4

export function parseHomePracticeTips(value, slotCount = DEFAULT_TIP_SLOT_COUNT) {
  const items = typeof value === 'string'
    ? value
        .split(TIP_SEPARATOR)
        .map((item) => item.trim())
        .filter(Boolean)
    : []

  while (items.length < slotCount) {
    items.push('')
  }

  return items
}

export function stringifyHomePracticeTips(items) {
  if (!Array.isArray(items)) {
    return ''
  }

  return items
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .join(` ${TIP_SEPARATOR} `)
}
