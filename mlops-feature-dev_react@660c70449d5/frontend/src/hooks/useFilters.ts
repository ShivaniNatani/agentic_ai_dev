import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/api'

export const useFilters = (model?: string) =>
    useQuery({
        queryKey: ['filters', model],
        queryFn: () => apiService.fetchFilters(model),
        staleTime: 60000,
    })
