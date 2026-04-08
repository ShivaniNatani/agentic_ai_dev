import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/api'

export const useSystemHealth = () =>
    useQuery({
        queryKey: ['system-health'],
        queryFn: apiService.fetchSystemHealth,
        staleTime: 30000,
    })
