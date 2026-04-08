import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useFilters } from '../hooks/useFilters'
import { apiService, type FilterOptions } from '../services/api'

export type DashboardFilters = {
    model: string
    client: string
    version: string
    startDate: string
    endDate: string
    thresholdMode: string
    ranges: string[]
    metrics: string[]
    trendWindow: number
    quickRange: string
}

type DashboardContextValue = {
    filters: DashboardFilters
    setFilters: (next: Partial<DashboardFilters>) => void
    options: FilterOptions
    refreshData: () => Promise<void>
    meta?: { data_source: string; latest_data_point?: string | null }
}

const DEFAULT_FILTERS: DashboardFilters = {
    model: '',
    client: 'All Clients',
    version: 'All Versions',
    startDate: '',
    endDate: '',
    thresholdMode: 'All data',
    ranges: ['All ranges'],
    metrics: [],
    trendWindow: 3,
    quickRange: 'All',
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined)

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
    const [filters, setFilterState] = useState<DashboardFilters>(DEFAULT_FILTERS)
    const [options, setOptions] = useState<FilterOptions>({
        models: [],
        clients: [],
        versions: [],
        metrics: [],
    })
    const [meta, setMeta] = useState<{ data_source: string; latest_data_point?: string | null } | undefined>(undefined)

    const { data } = useFilters(filters.model || undefined)

    useEffect(() => {
        if (!data) return
        setOptions(data.options)
        setMeta({ data_source: data.meta.data_source, latest_data_point: data.meta.latest_data_point })

        setFilterState((prev) => {
            const next = { ...prev }
            if (!prev.model && data.options.models.length > 0) {
                next.model = data.options.models[0]
            }
            if (!prev.startDate && data.options.date_min) {
                next.startDate = data.options.date_min
            }
            if (!prev.endDate && data.options.date_max) {
                next.endDate = data.options.date_max
            }
            return next
        })
    }, [data])

    const setFilters = (next: Partial<DashboardFilters>) => {
        setFilterState((prev) => ({ ...prev, ...next }))
    }

    const refreshData = async () => {
        await apiService.refreshData()
    }

    const value = useMemo(
        () => ({ filters, setFilters, options, refreshData, meta }),
        [filters, options, meta]
    )

    return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export const useDashboardContext = () => {
    const ctx = useContext(DashboardContext)
    if (!ctx) {
        throw new Error('useDashboardContext must be used within DashboardProvider')
    }
    return ctx
}
