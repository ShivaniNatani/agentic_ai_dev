import { useState, useRef } from 'react'
import './GlobalMap.css'

export default function GlobalMap() {
    const containerRef = useRef(null)
    const [tilt, setTilt] = useState({ x: 0, y: 0 })

    const handleMouseMove = (e) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Calculate tilt (-10deg to 10deg)
        const rotX = -((y - rect.height / 2) / rect.height) * 10
        const rotY = ((x - rect.width / 2) / rect.width) * 10

        setTilt({ x: rotX, y: rotY })
    }

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 })
    }

    // BEACONS (Percentage positions on map)
    const beacons = [
        { id: 'us-east', x: 28, y: 38, name: 'AWS US-East (N. Virginia)', status: 'Active', load: '89%', color: 'beacon-us-east' },
        { id: 'us-west', x: 18, y: 35, name: 'AWS US-West (Oregon)', status: 'Active', load: '45%', color: 'beacon-default' },
        { id: 'eu-west', x: 48, y: 30, name: 'AWS EU-West (Ireland)', status: 'Active', load: '62%', color: 'beacon-eu-west' },
        { id: 'ap-south', x: 68, y: 45, name: 'AWS AP-South (Mumbai)', status: 'Active', load: '78%', color: 'beacon-default' },
    ]

    return (
        <div
            className="global-map-container"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className="holographic-plate"
                style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            >
                {/* SVG WORLD MAP (Simplified) */}
                <svg className="world-map-svg" viewBox="0 0 100 60" preserveAspectRatio="none">
                    <path
                        className="map-land"
                        d="M20,30 Q25,25 30,30 T40,30 T50,25 T60,30 T70,35 T80,30 T90,25" // Abstract wave for world
                    // Replacing with a slightly more realistic rough path for demo
                    // Actually, let's use a very simplified polygon set for continents to look techy
                    />
                    {/* Simplified Continents (Tech Abstraction) */}
                    <path className="map-land" d="M10,20 L30,20 L35,40 L15,45 Z" /> {/* North America */}
                    <path className="map-land" d="M20,50 L30,50 L32,60 L22,60 Z" /> {/* South America */}
                    <path className="map-land" d="M45,20 L60,20 L60,35 L50,45 L45,35 Z" /> {/* Europe/Africa */}
                    <path className="map-land" d="M65,20 L90,20 L85,45 L70,40 Z" /> {/* Asia */}
                    <path className="map-land" d="M75,50 L85,50 L85,55 L75,55 Z" /> {/* Australia */}
                </svg>

                {/* Beacons */}
                {beacons.map(beacon => (
                    <div
                        key={beacon.id}
                        className={`map-beacon ${beacon.color}`}
                        style={{ left: `${beacon.x}%`, top: `${beacon.y}%` }}
                    >
                        <div className="map-tooltip">
                            <span className="region-label">{beacon.name}</span>
                            <div>Status: {beacon.status}</div>
                            <div>Load: {beacon.load}</div>
                        </div>
                    </div>
                ))}

                {/* Overlay Text */}
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', fontFamily: 'monospace', fontSize: '10px', color: 'var(--aurora-cyan)' }}>
                    <div>GLOBAL DEPLOYMENT MATRIX</div>
                    <div>ACTIVE NODES: {beacons.length}</div>
                </div>
            </div>
        </div>
    )
}
