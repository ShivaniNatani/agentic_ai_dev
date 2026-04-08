import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Overview from './pages/Overview'
import Performance from './pages/Performance'
import Drift from './pages/Drift'
import Latency from './pages/Latency'
import SystemHealth from './pages/SystemHealth'
import Incidents from './pages/Incidents'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import { DashboardProvider } from './context/DashboardContext'

export default function App() {
    return (
        <BrowserRouter>
            <DashboardProvider>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Overview />} />
                        <Route path="/performance" element={<Performance />} />
                        <Route path="/system-health" element={<SystemHealth />} />
                        <Route path="/drift" element={<Drift />} />
                        <Route path="/latency" element={<Latency />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/incidents" element={<Incidents />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Overview />} />
                    </Routes>
                </Layout>
            </DashboardProvider>
        </BrowserRouter>
    )
}
