import { supabase } from '@/lib/supabase'

export interface Department {
  id: string
  name: string
}

/**
 * The department options, from the departments table rather than from whatever
 * strings happen to be saved on profiles.
 *
 * Deriving them from profiles was the old approach and it cannot express a
 * department nobody is in yet — which is every department at the moment it is
 * created, including the two we ship with.
 */
export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .order('name')

  if (error) throw error
  return data ?? []
}

/**
 * Adds a department. Insert is restricted to managers and super admins by RLS,
 * so a plain employee reaching this gets a policy violation rather than a row.
 *
 * A name that already exists — in any casing, since the column is citext — comes
 * back as a duplicate-key error. That is reported as the department simply
 * existing, because from the caller's point of view it does.
 */
export async function createDepartment(name: string): Promise<Department> {
  const trimmed = name.trim()

  const { data, error } = await supabase
    .from('departments')
    .insert({ name: trimmed })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`"${trimmed}" is already a department`)
    if (error.code === '42501') {
      throw new Error('Only a manager or super admin can add a department')
    }
    throw error
  }

  return data
}
