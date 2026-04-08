import React from 'react'

export default function Placeholder({ title = 'Page Under Construction' }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
            <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
            <p className="text-slate-400">This module is currently being ported.</p>
        </div>
    )
}
