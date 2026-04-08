import { useQuery } from '@tanstack/react-query'
import { apiService } from '../api/api'

export function useSystemHealth() {
    return useQuery({
        queryKey: ['system-health'],
        queryFn: () => apiService.fetchSystemHealth(),
        refetchInterval: 30000, // Poll every 30s
    })
}
