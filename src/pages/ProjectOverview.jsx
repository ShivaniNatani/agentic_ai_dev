import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { projects } from '../data/projects'
import { useAuth } from '../context/AuthContext' // Import Auth
import './ProjectOverview.css'

// Initial columns setup
const initialColumns = {
    backlog: { id: 'backlog', title: 'Planning', color: 'var(--text-muted)', items: [] },
    active: { id: 'active', title: 'In Progress', color: 'var(--aurora-cyan)', items: [] },
    review: { id: 'review', title: 'In Review', color: 'var(--aurora-purple)', items: [] },
    completed: { id: 'completed', title: 'Completed', color: 'var(--status-success)', items: [] }
}

function ProjectOverview() {
    const { user } = useAuth() // Get current user

    // Re-derive columns state for the component based on USER
    const [columns, setColumns] = useState(initialColumns)
    const [draggedItem, setDraggedItem] = useState(null)

    // Effect to filter projects when user changes
    useEffect(() => {
        const cols = JSON.parse(JSON.stringify(initialColumns)) // Reset columns

        // Filter Logic
        let visibleProjects = projects
        if (user && user.role !== 'admin') {
            visibleProjects = projects.filter(p =>
                p.owner.toLowerCase() === user.displayName.toLowerCase() ||
                p.owner === user.username // Fallback match
            )
        }

        visibleProjects.forEach(p => {
            let statusKey = 'backlog'
            const s = p.stage.toLowerCase()
            if (s.includes('live') || s.includes('complete')) statusKey = 'completed'
            else if (s.includes('review') || s.includes('testing')) statusKey = 'review'
            else if (s.includes('progress') || s.includes('dev')) statusKey = 'active'

            cols[statusKey].items.push(p)
        })

        setColumns(cols)
    }, [user]) // Re-run when user changes


    // ... drag handlers same as before ...
    const handleDragStart = (e, item, sourceColumnId) => {
        setDraggedItem({ item, sourceColumnId })
        e.dataTransfer.effectAllowed = 'move'
        e.target.classList.add('project-card--dragging')
    }

    const handleDragEnd = (e) => {
        e.target.classList.remove('project-card--dragging')
        setDraggedItem(null)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = (e, targetColumnId) => {
        e.preventDefault()
        if (!draggedItem) return
        if (draggedItem.sourceColumnId === targetColumnId) return

        const sourceColumn = columns[draggedItem.sourceColumnId]
        const targetColumn = columns[targetColumnId]
        const sourceItems = [...sourceColumn.items]
        const targetItems = [...targetColumn.items]

        const itemIndex = sourceItems.findIndex(i => i.id === draggedItem.item.id)
        sourceItems.splice(itemIndex, 1)

        const newItem = { ...draggedItem.item }
        targetItems.push(newItem)

        setColumns({
            ...columns,
            [draggedItem.sourceColumnId]: { ...sourceColumn, items: sourceItems },
            [targetColumnId]: { ...targetColumn, items: targetItems }
        })
    }

    // Calc total for header
    const totalProjects = Object.values(columns).reduce((acc, col) => acc + col.items.length, 0)

    return (
        <div className="project-board-page">
            <div className="project-bg">
                <div className="project-bg-orb project-bg-orb--1"></div>
            </div>

            <div className="container-fluid">
                <div className="project-header">
                    <div>
                        <h1 className="project-title">Project Overview</h1>
                        <p className="project-subtitle">
                            {user?.role === 'admin'
                                ? `Managing all ${totalProjects} active initiatives across the organization.`
                                : `Managing ${totalProjects} active initiatives for ${user?.displayName}.`
                            }
                        </p>
                    </div>
                    <div className="project-actions">
                        <button className="btn btn-secondary">Filter</button>
                        <button className="btn btn-primary">+ New Project</button>
                    </div>
                </div>

                <div className="kanban-board">
                    {Object.values(columns).map(column => (
                        <div
                            key={column.id}
                            className="kanban-column"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id)}
                        >
                            <div className="kanban-column-header">
                                <span className="kanban-column-dot" style={{ backgroundColor: column.color }}></span>
                                <h3 className="kanban-column-title">{column.title}</h3>
                                <span className="kanban-column-count">{column.items.length}</span>
                            </div>

                            <div className="kanban-column-content">
                                {column.items.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="kanban-card animate-scale-in"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item, column.id)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <div className="kanban-card-header">
                                            <div className="kanban-client-badge">
                                                <span className="kanban-client-logo">{item.logo || '🚀'}</span>
                                                {item.client || item.owner}
                                            </div>
                                            <button className="kanban-card-menu">•••</button>
                                        </div>

                                        <h4 className="kanban-card-title">{item.name}</h4>
                                        <p className="kanban-card-update">{item.update}</p>

                                        <div className="kanban-progress">
                                            <div className="kanban-progress-bar">
                                                <div
                                                    className="kanban-progress-fill"
                                                    style={{
                                                        width: `${item.progress}%`,
                                                        backgroundColor: column.color
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="kanban-progress-label">{item.progress}%</span>
                                        </div>

                                        <div className="kanban-card-footer">
                                            <div className="kanban-avatars">
                                                <div className="kanban-avatar" title={item.owner}>{item.owner.substring(0, 2).toUpperCase()}</div>
                                            </div>
                                            <span className="kanban-date">{new Date(item.lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    </div>
                                ))}
                                {column.items.length === 0 && (
                                    <div className="empty-column-state">
                                        No projects
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ProjectOverview
