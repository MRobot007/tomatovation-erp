import { describe, expect, test } from 'vitest'
import { BUCKET_LIMITS, displayName, formatBytes, validateFile } from './storage.api'

/** jsdom's File honours size from the blob parts, so this fakes a large one. */
function fakeFile(name: string, type: string, bytes: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

describe('validateFile — avatars', () => {
  test('accepts a small PNG', () => {
    expect(validateFile('avatars', fakeFile('me.png', 'image/png', 500_000)).ok).toBe(true)
  })

  test('rejects a file over the 2 MB bucket limit', () => {
    const result = validateFile('avatars', fakeFile('big.png', 'image/png', 3 * 1024 * 1024))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // The message names the actual size, so the user knows how much to trim.
      expect(result.reason).toContain('3.0 MB')
      expect(result.reason).toContain('2 MB')
    }
  })

  test('rejects a PDF, which the avatars bucket does not allow', () => {
    const result = validateFile('avatars', fakeFile('cv.pdf', 'application/pdf', 1000))
    expect(result.ok).toBe(false)
  })

  test('accepts exactly the limit, not one byte less', () => {
    expect(validateFile('avatars', fakeFile('edge.png', 'image/png', 2 * 1024 * 1024).valueOf() as File).ok).toBe(
      true,
    )
  })
})

describe('validateFile — attachments', () => {
  test('accepts a PDF', () => {
    expect(validateFile('attachments', fakeFile('scan.pdf', 'application/pdf', 1_000_000).valueOf() as File).ok).toBe(
      true,
    )
  })

  test('accepts a Word document', () => {
    const file = fakeFile(
      'doc.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      2_000_000,
    )
    expect(validateFile('attachments', file).ok).toBe(true)
  })

  test('rejects an executable', () => {
    const result = validateFile('attachments', fakeFile('virus.exe', 'application/x-msdownload', 1000))
    expect(result.ok).toBe(false)
  })

  test('rejects a file with no MIME type', () => {
    const result = validateFile('attachments', fakeFile('mystery', '', 1000))
    expect(result.ok).toBe(false)
  })

  test('rejects an empty file', () => {
    // A zero-byte upload usually means a failed drag or a broken picker; it is
    // never something the user meant to attach.
    const result = validateFile('attachments', fakeFile('empty.pdf', 'application/pdf', 0))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/empty/i)
  })

  test('rejects a file over 10 MB', () => {
    const result = validateFile('attachments', fakeFile('huge.pdf', 'application/pdf', 11 * 1024 * 1024))
    expect(result.ok).toBe(false)
  })
})

describe('bucket limits mirror the migration', () => {
  test('avatars allows exactly the three image types the bucket does', () => {
    expect([...BUCKET_LIMITS.avatars.mimeTypes]).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
    expect(BUCKET_LIMITS.avatars.maxBytes).toBe(2097152)
  })

  test('attachments matches the 10 MB bucket limit', () => {
    expect(BUCKET_LIMITS.attachments.maxBytes).toBe(10485760)
  })
})

describe('displayName', () => {
  test('strips the folder and the timestamp prefix', () => {
    expect(displayName('abc-123/1784535355000-medical-note.pdf')).toBe('medical-note.pdf')
  })

  test('leaves a name without a timestamp alone', () => {
    expect(displayName('abc-123/plain.pdf')).toBe('plain.pdf')
  })

  test('does not strip a short leading number that is part of the name', () => {
    // "2024" is only four digits, so it is the filename, not a timestamp.
    expect(displayName('abc-123/2024-report.pdf')).toBe('2024-report.pdf')
  })

  test('handles a path with no folder', () => {
    expect(displayName('loose.pdf')).toBe('loose.pdf')
  })
})

describe('formatBytes', () => {
  test('bytes below a kilobyte', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  test('rounds kilobytes', () => {
    expect(formatBytes(2048)).toBe('2 KB')
  })

  test('shows one decimal for megabytes', () => {
    expect(formatBytes(1_572_864)).toBe('1.5 MB')
  })

  test('zero is not an error', () => {
    expect(formatBytes(0)).toBe('0 B')
  })
})
