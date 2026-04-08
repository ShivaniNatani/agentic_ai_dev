import { useDashboardContext } from '../context/DashboardContext'

export default function Settings() {
    const { filters, meta } = useDashboardContext()

    return (
        <div className="space-y-6">
            <div className="card-outline p-6">
                <h2 className="text-3xl font-display font-bold text-white">
                    Environment <span className="gradient-text">Settings</span>
                </h2>
                <p className="text-slate-400 mt-2">Operational context, data sources, and support contacts.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white">Data Context</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <p>Data source: {meta?.data_source ?? 'snapshot'}</p>
                        <p>Selected window: {filters.startDate} to {filters.endDate}</p>
                        <p>Model scope: {filters.model}</p>
                    </div>
                </div>
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white">Support</h3>
                    <p className="text-sm text-slate-300 mt-2">
                        Reach the observability team for anomaly reviews, alert tuning, or telemetry walkthroughs.
                    </p>
                    <p className="text-sm text-slate-400 mt-4">support@ikshealth.com · +1 (800) 555-0199</p>
                </div>
            </div>
        </div>
    )
}
