import { useQuery } from '@tanstack/react-query'
import { apiService, type DataResponse } from '../services/api'

export const useDashboardData = (params: Record<string, any>) =>
    useQuery({
        queryKey: ['dashboard-data', params] as const,
        queryFn: (): Promise<DataResponse> => apiService.fetchData(params),
        placeholderData: (previousData) => previousData,
    })
