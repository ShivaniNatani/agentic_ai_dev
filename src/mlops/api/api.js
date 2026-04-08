import axios from 'axios'

const api = axios.create({
    baseURL: '', // Proxied via Vite
    headers: {
        'Content-Type': 'application/json',
    },
})

export const apiService = {
    fetchFilters: async (model) => {
        const response = await api.get('/api/filters', { params: { model } })
        return response.data
    },
    fetchData: async (params) => {
        const response = await api.get('/api/data', { params })
        return response.data
    },
    refreshData: async () => {
        const response = await api.post('/api/refresh')
        return response.data
    },
    fetchAlerts: async (params) => {
        const response = await api.get('/api/alerts', { params })
        return response.data
    },
    fetchSystemHealth: async () => {
        const response = await api.get('/api/system-health')
        return response.data
    },
    fetchIncidents: async (params) => {
        const response = await api.get('/api/incidents', { params })
        return response.data
    },
    createIncident: async (payload) => {
        const response = await api.post('/api/incidents', payload)
        return response.data
    },
    resolveIncident: async (id, resolution) => {
        const response = await api.post(`/api/incidents/${id}/resolve`, { resolution })
        return response.data
    },
    sendSummaryEmail: async (payload) => {
        const response = await api.post('/api/email/summary', payload)
        return response.data
    },
    sendClientEmails: async (payload) => {
        const response = await api.post('/api/email/client', payload)
        return response.data
    },
    sendConsolidatedEmail: async (payload) => {
        const response = await api.post('/api/email/consolidated', payload)
        return response.data
    },
    chat: async (payload) => {
        const response = await api.post('/api/chat', payload)
        return response.data
    },
}
