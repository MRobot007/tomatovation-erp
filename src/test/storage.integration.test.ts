import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { fixturePassword } from './fixtures'

/**
 * Storage RLS — run against the LIVE linked project.
 *
 *   npm run test:storage
 *
 * The bucket policies key off the FIRST PATH SEGMENT of the object name:
 *
 *   (storage.foldername(name))[1] = auth.uid()
 *
 * That makes the path convention load-bearing security, not a naming style. If
 * `uploadFile` ever stopped prefixing the owner id, writes would be rejected —
 * or worse, a wrong prefix would place a file where someone else could reach
 * it. These tests pin that behaviour.
 *
 * Uses the same fixtures as the manager-scoping suite:
 *   node scripts/setup-rls-fixtures.mjs
 */

const url = process.env.VITE_SUPABASE_URL ?? ''
const key = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const PASSWORD = fixturePassword()

const EMAILS = {
  manager: 'rls-fixture-manager@example.com',
  report: 'rls-fixture-report@example.com',
  outsider: 'rls-fixture-outsider@example.com',
}

interface Actor {
  client: SupabaseClient<Database>
  id: string
}

async function signIn(email: string): Promise<Actor> {
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`${email}: ${error.message}. Run: npm run test:fixtures`)
  return { client, id: data.user.id }
}

function textFile(contents = 'attachment body'): Blob {
  return new Blob([contents], { type: 'application/pdf' })
}

const RUN = Date.now()

let manager: Actor
let report: Actor
let outsider: Actor
let reportFilePath: string

beforeAll(async () => {
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')

  manager = await signIn(EMAILS.manager)
  report = await signIn(EMAILS.report)
  outsider = await signIn(EMAILS.outsider)

  reportFilePath = `${report.id}/${RUN}-report-note.pdf`

  const { error } = await report.client.storage
    .from('attachments')
    .upload(reportFilePath, textFile(), { contentType: 'application/pdf' })

  if (error) throw new Error(`fixture upload failed: ${error.message}`)
}, 60_000)

describe('attachments — write path is owner-scoped', () => {
  test('a user CAN upload under their own id', async () => {
    const { error } = await report.client.storage
      .from('attachments')
      .upload(`${report.id}/${RUN}-own.pdf`, textFile(), { contentType: 'application/pdf' })

    expect(error).toBeNull()
  })

  test('a user CANNOT upload under someone else’s id', async () => {
    // The whole point of the path convention. Without the policy this would
    // succeed and plant a file in another employee's folder.
    const { error } = await outsider.client.storage
      .from('attachments')
      .upload(`${report.id}/${RUN}-planted.pdf`, textFile(), { contentType: 'application/pdf' })

    expect(error).not.toBeNull()
  })

  test('a user CANNOT upload to the bucket root, bypassing the prefix', async () => {
    const { error } = await outsider.client.storage
      .from('attachments')
      .upload(`${RUN}-rootless.pdf`, textFile(), { contentType: 'application/pdf' })

    expect(error).not.toBeNull()
  })

  test('a manager CANNOT upload into their report’s folder', async () => {
    // Managers read their reports' files; they do not write into them.
    const { error } = await manager.client.storage
      .from('attachments')
      .upload(`${report.id}/${RUN}-by-manager.pdf`, textFile(), { contentType: 'application/pdf' })

    expect(error).not.toBeNull()
  })
})

describe('attachments — read is scoped to the reporting line', () => {
  test('the owner CAN mint a signed URL for their own file', async () => {
    const { data, error } = await report.client.storage
      .from('attachments')
      .createSignedUrl(reportFilePath, 60)

    expect(error).toBeNull()
    expect(data?.signedUrl).toContain('token=')
  })

  test('their manager CAN mint one', async () => {
    const { data, error } = await manager.client.storage
      .from('attachments')
      .createSignedUrl(reportFilePath, 60)

    expect(error).toBeNull()
    expect(data?.signedUrl).toBeTruthy()
  })

  test('an unrelated employee CANNOT', async () => {
    const { data, error } = await outsider.client.storage
      .from('attachments')
      .createSignedUrl(reportFilePath, 60)

    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  test('an anonymous client CANNOT', async () => {
    const anon = createClient<Database>(url, key, { auth: { persistSession: false } })
    const { error } = await anon.storage.from('attachments').createSignedUrl(reportFilePath, 60)
    expect(error).not.toBeNull()
  })

  test('listing a colleague’s folder returns nothing', async () => {
    const { data } = await outsider.client.storage.from('attachments').list(report.id)
    expect(data ?? []).toHaveLength(0)
  })
})

describe('attachments — delete is owner-only', () => {
  test('an unrelated employee CANNOT delete someone else’s file', async () => {
    await outsider.client.storage.from('attachments').remove([reportFilePath])

    // Supabase's remove() reports success for rows the policy filtered out, so
    // the assertion has to be that the file still exists — not that an error
    // was returned.
    const { error } = await report.client.storage
      .from('attachments')
      .createSignedUrl(reportFilePath, 60)

    expect(error).toBeNull()
  })

  test('a manager CANNOT delete their report’s file either', async () => {
    await manager.client.storage.from('attachments').remove([reportFilePath])

    const { error } = await report.client.storage
      .from('attachments')
      .createSignedUrl(reportFilePath, 60)

    expect(error).toBeNull()
  })

  test('the owner CAN delete their own file', async () => {
    const path = `${report.id}/${RUN}-disposable.pdf`
    await report.client.storage
      .from('attachments')
      .upload(path, textFile(), { contentType: 'application/pdf' })

    await report.client.storage.from('attachments').remove([path])

    const { error } = await report.client.storage.from('attachments').createSignedUrl(path, 60)
    expect(error).not.toBeNull()
  })
})

describe('avatars — public read, owner write', () => {
  const png = () =>
    new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
      type: 'image/png',
    })

  test('a user CAN upload their own avatar', async () => {
    const { error } = await report.client.storage
      .from('avatars')
      .upload(`${report.id}/${RUN}-avatar.png`, png(), { contentType: 'image/png', upsert: true })

    expect(error).toBeNull()
  })

  test('a user CANNOT overwrite a colleague’s avatar', async () => {
    const { error } = await outsider.client.storage
      .from('avatars')
      .upload(`${report.id}/${RUN}-avatar.png`, png(), { contentType: 'image/png', upsert: true })

    expect(error).not.toBeNull()
  })

  test('avatars are publicly readable — no signing needed', async () => {
    // Deliberate: an avatar appears in every roster row, and signing each one
    // would mean dozens of round trips per screen.
    const anon = createClient<Database>(url, key, { auth: { persistSession: false } })
    const publicUrl = anon.storage
      .from('avatars')
      .getPublicUrl(`${report.id}/${RUN}-avatar.png`).data.publicUrl

    const response = await fetch(publicUrl)
    expect(response.ok).toBe(true)
  })
})

describe('bucket limits are enforced server-side, not only in the client', () => {
  test('an oversized avatar is rejected by the bucket', async () => {
    // 3 MB against a 2 MB bucket limit. The client checks this too, but the
    // bucket is the boundary — a crafted request bypasses the client entirely.
    const big = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/png' })

    const { error } = await report.client.storage
      .from('avatars')
      .upload(`${report.id}/${RUN}-oversized.png`, big, { contentType: 'image/png' })

    expect(error).not.toBeNull()
  })

  test('a disallowed MIME type is rejected by the bucket', async () => {
    const script = new Blob(['#!/bin/sh\necho hi'], { type: 'application/x-sh' })

    const { error } = await report.client.storage
      .from('attachments')
      .upload(`${report.id}/${RUN}-script.sh`, script, { contentType: 'application/x-sh' })

    expect(error).not.toBeNull()
  })
})
