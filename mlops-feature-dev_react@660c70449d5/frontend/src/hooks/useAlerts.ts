import { useQuery } from '@tanstack/react-query'
import { apiService, type AlertsResponse } from '../services/api'

export const useAlerts = (params: Record<string, any>) =>
    useQuery({
        queryKey: ['alerts', params] as const,
        queryFn: (): Promise<AlertsResponse> => apiService.fetchAlerts(params),
        placeholderData: (previousData) => previousData,
    })
