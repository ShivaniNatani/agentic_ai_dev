import { useQuery } from '@tanstack/react-query'
import { apiService } from '../api/api'

export function useIncidents({ days = 30 } = {}) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['incidents', days],
        queryFn: () => apiService.fetchIncidents({ days }),
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: 60 * 1000, // Poll every minute
    })

    return { data, isLoading, error, refetch }
}
