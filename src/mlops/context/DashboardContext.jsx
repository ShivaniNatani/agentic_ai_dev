import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiService } from '../api/api'
import { useQuery } from '@tanstack/react-query'

const DEFAULT_FILTERS = {
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

const DashboardContext = createContext(undefined)

export const DashboardProvider = ({ children }) => {
    const [filters, setFilterState] = useState(DEFAULT_FILTERS)
    const [options, setOptions] = useState({
        models: [],
        clients: [],
        versions: [],
        metrics: [],
    })
    const [meta, setMeta] = useState(undefined)

    // Fetch filters/options when model changes
    const { data: filterData } = useQuery({
        queryKey: ['filters', filters.model],
        queryFn: () => apiService.fetchFilters(filters.model || undefined),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    useEffect(() => {
        if (!filterData) return
        setOptions(filterData.options)
        setMeta({
            data_source: filterData.meta.data_source,
            latest_data_point: filterData.meta.latest_data_point
        })

        setFilterState((prev) => {
            const next = { ...prev }
            // if (!prev.model && filterData.options.models.length > 0) {
            //     next.model = filterData.options.models[0]
            // }
            if (!prev.startDate && filterData.options.date_min) {
                next.startDate = filterData.options.date_min
            }
            if (!prev.endDate && filterData.options.date_max) {
                next.endDate = filterData.options.date_max
            }
            return next
        })
    }, [filterData])

    const setFilters = (next) => {
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
