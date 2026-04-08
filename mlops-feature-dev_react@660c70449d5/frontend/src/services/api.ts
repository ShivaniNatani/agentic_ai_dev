import axios from 'axios'

export type DataRecord = {
    date_of_model_refresh: string
    model_name: string
    client_name: string
    metric_name: string
    metric_value: number | null
    threshold?: number | null
    threshold_min?: number | null
    threshold_max?: number | null
    threshold_range_label?: string | null
    model_version?: string | null
    latency_hours?: number | null
    accuracy?: number | null
    accuracy_pct?: number | null
    [key: string]: any
}

export type SummaryMetric = {
    metric_name: string
    mean?: number | null
    min?: number | null
    max?: number | null
    latest?: number | null
    delta?: number | null
}

export type FilterOptions = {
    models: string[]
    clients: string[]
    versions: string[]
    metrics: string[]
    date_min?: string | null
    date_max?: string | null
}

export type DataMeta = {
    data_source: string
    refresh_error?: string | null
    source_file_mtime?: string | null
    latest_data_point?: string | null
    refreshed_at?: string | null
}

export type DataResponse = {
    meta: DataMeta
    options: FilterOptions
    available_metrics: string[]
    summary: SummaryMetric[]
    records: DataRecord[]
}

export type AlertRow = {
    status: string
    severity: string
    signal: string
    signal_description?: string | null
    model?: string | null
    client?: string | null
    observed?: number | null
    threshold?: number | null
    timestamp?: string | null
}

export type AlertsResponse = {
    alerts: {
        rows: AlertRow[]
        status_tally: Record<string, number>
        severity_tally: Record<string, number>
        deepest_breach?: {
            breach: number
            metric: string
            model?: string | null
            client?: string | null
        } | null
    }
    allowed_metrics: string[]
    root_cause: Array<Record<string, any>>
}

export type SystemHealthResponse = {
    health: Array<{
        model: string
        client: string
        health_score: number
        status?: string | null
        freshness?: number | null
        stability?: number | null
        last_update?: string | null
    }>
    summary?: {
        avg_health: number
        healthy_count: number
        fresh_count: number
        stable_count: number
        total: number
    } | null
    predictive: Array<Record<string, any>>
}

export type Incident = {
    id: string
    title?: string
    category?: string
    type: string
    severity: string
    model: string
    client: string
    description: string
    timestamp: string
    status: string
    resolution?: string | null
}

export type IncidentsResponse = {
    stats: {
        total_incidents: number
        active_incidents: number
        resolved_incidents: number
        avg_resolution_hours: number
        by_severity?: Record<string, number>
    }
    timeline: Array<Record<string, any>>
    recent: Incident[]
}

export type ChatRequest = {
    message: string
    context?: Record<string, any>
    history?: Array<{ role: string; content: string }>
}

export type ChatResponse = {
    response?: string
    error?: string
}

const api = axios.create({
    baseURL: '',
    headers: {
        'Content-Type': 'application/json',
    },
})

export const apiService = {
    fetchFilters: async (model?: string): Promise<{ meta: DataMeta; options: FilterOptions }> => {
        const response = await api.get('/api/filters', { params: { model } })
        return response.data
    },
    fetchData: async (params: Record<string, any>): Promise<DataResponse> => {
        const response = await api.get('/api/data', { params })
        return response.data
    },
    refreshData: async (): Promise<{ success: boolean; meta?: DataMeta; error?: string }> => {
        const response = await api.post('/api/refresh')
        return response.data
    },
    fetchAlerts: async (params: Record<string, any>): Promise<AlertsResponse> => {
        const response = await api.get('/api/alerts', { params })
        return response.data
    },
    fetchSystemHealth: async (): Promise<SystemHealthResponse> => {
        const response = await api.get('/api/system-health')
        return response.data
    },
    fetchIncidents: async (params?: { days?: number }): Promise<IncidentsResponse> => {
        const response = await api.get('/api/incidents', { params })
        return response.data
    },
    createIncident: async (payload: {
        title: string
        description: string
        severity: string
        category: string
        model?: string
        client?: string
    }) => {
        const response = await api.post('/api/incidents', payload)
        return response.data
    },
    resolveIncident: async (id: string, resolution?: string) => {
        const response = await api.post(`/api/incidents/${id}/resolve`, { resolution })
        return response.data
    },
    sendSummaryEmail: async (payload: Record<string, any>) => {
        const response = await api.post('/api/email/summary', payload)
        return response.data
    },
    sendClientEmails: async (payload: Record<string, any>) => {
        const response = await api.post('/api/email/client', payload)
        return response.data
    },
    sendConsolidatedEmail: async (payload: Record<string, any>) => {
        const response = await api.post('/api/email/consolidated', payload)
        return response.data
    },
    chat: async (payload: ChatRequest): Promise<ChatResponse> => {
        const response = await api.post('/api/chat', payload)
        return response.data
    },
}
