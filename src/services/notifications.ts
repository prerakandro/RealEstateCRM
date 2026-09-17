import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types/domain'
import { throwIfError } from './service-utils'

export interface NotificationFilters {
  userId?: string
  unreadOnly?: boolean
  limit?: number
}

export async function listNotifications(
  filters: NotificationFilters = {},
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.unreadOnly) query = query.eq('is_read', false)
  if (filters.limit) query = query.limit(filters.limit)
  const { data, error } = await query
  throwIfError(error, 'Notifications could not be loaded.')
  return data ?? []
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  throwIfError(error, 'The notification could not be updated.')
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  throwIfError(error, 'Notifications could not be updated.')
}
