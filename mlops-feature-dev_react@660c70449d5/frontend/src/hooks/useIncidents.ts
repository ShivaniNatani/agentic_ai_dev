import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/api'

export const useIncidents = (params?: { days?: number }) =>
    useQuery({
        queryKey: ['incidents', params],
        queryFn: () => apiService.fetchIncidents(params),
        staleTime: 30000,
    })
