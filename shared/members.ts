const capitalize = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toLocaleUpperCase('fr'))

/**
 * Table names from full registrant names: the first name alone, plus as many letters of the
 * last name as needed to tell apart people who share a first name ("Ethan M.", "Ethan C.").
 * Sorted alphabetically.
 */
export function tableNames(fullNames: string[]): string[] {
  const people = fullNames
    .map(n => n.trim().split(/\s+/).filter(Boolean))
    .filter(words => words.length > 0)
    .map(([first, ...rest]) => ({ first: capitalize(first), last: capitalize(rest.join(' ')) }))
  const key = (s: string) => s.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{Diacritic}/gu, '')

  const names = people.map(p => {
    const namesakes = people.filter(o => key(o.first) === key(p.first))
    if (namesakes.length === 1 || !p.last) return p.first
    // Shortest last-name prefix that no namesake shares.
    for (let len = 1; len < p.last.length; len++) {
      const prefix = key(p.last.slice(0, len))
      if (namesakes.every(o => o === p || key(o.last.slice(0, len)) !== prefix)) return `${p.first} ${p.last.slice(0, len)}.`
    }
    return `${p.first} ${p.last}`
  })
  return names.sort((a, b) => a.localeCompare(b, 'fr'))
}
