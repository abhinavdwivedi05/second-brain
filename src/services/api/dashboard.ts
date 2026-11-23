import { apiClient } from './client';
import { DashboardStats, ActivityLog } from '@/types';

/**
 * Fetch real aggregated dashboard metrics, recent items, and recent activities from PostgreSQL.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/api/v1/dashboard/stats');
}

/**
 * Fetch user activity events with pagination.
 */
export async function fetchActivities(limit: number = 50, offset: number = 0): Promise<ActivityLog[]> {
  return apiClient.get<ActivityLog[]>(`/api/v1/activities?limit=${limit}&offset=${offset}`);
}

