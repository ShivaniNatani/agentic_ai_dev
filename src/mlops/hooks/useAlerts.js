import { useQuery } from '@tanstack/react-query'
import { apiService } from '../api/api'

export function useAlerts(params) {
    return useQuery({
        queryKey: ['alerts', params],
        queryFn: () => apiService.fetchAlerts(params),
    })
}
