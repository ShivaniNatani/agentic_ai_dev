import { useQuery } from '@tanstack/react-query'
import { apiService } from '../api/api'

export function useDashboardData(params) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['dashboard-data', params],
        queryFn: () => apiService.fetchData(params),
        keepPreviousData: true,
        staleTime: 60 * 1000, // 1 minute
        retry: 1,
    })

    return { data, isLoading, error }
}
