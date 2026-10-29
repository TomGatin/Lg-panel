import { describe, expect, it } from 'vitest'
import { tableNames } from '../shared/members'

describe('table names', () => {
  it('keeps only the first name, sorted', () => {
    expect(tableNames(['Simon Lemaire', 'Adam Huet', ' Paul  Leroy '])).toEqual(['Adam', 'Paul', 'Simon'])
  })

  it('adds the last-name initial to namesakes only', () => {
    expect(tableNames(['Ethan Martin', 'Ethan Collet', 'Ethane Ebel', 'Tom Gavin']))
      .toEqual(['Ethan C.', 'Ethan M.', 'Ethane', 'Tom'])
  })

  it('capitalizes names typed in lowercase', () => {
    expect(tableNames(['jean-paul dupont', 'jean-paul martin'])).toEqual(['Jean-Paul D.', 'Jean-Paul M.'])
  })

  it('takes more letters when initials collide, ignoring case and accents', () => {
    expect(tableNames(['léa Moreau', 'Léa Morin', 'Léa Durand'])).toEqual(['Léa D.', 'Léa More.', 'Léa Mori.'])
  })
})
