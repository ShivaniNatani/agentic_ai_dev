import './Projects.css'

function Projects({ agent }) {
    const projects = getProjectsForAgent(agent.id)

    return (
        <div className="projects">
            <div className="projects__header">
                <h3 className="projects__title">Ongoing Projects</h3>
                <span className="projects__count">{projects.length} Active</span>
            </div>

            <div className="projects__list">
                {projects.map((project) => (
                    <div key={project.id} className="projects__item glass-card">
                        <div className="projects__item-header">
                            <div className="projects__item-status-wrapper">
                                <span className={`projects__item-status projects__item-status--${project.status}`}>
                                    {project.statusLabel}
                                </span>
                                <span className="projects__item-priority">
                                    {project.priority}
                                </span>
                            </div>
                            <span className="projects__item-date">{project.lastUpdated}</span>
                        </div>

                        <h4 className="projects__item-name">{project.name}</h4>
                        <p className="projects__item-description">{project.description}</p>

                        <div className="projects__progress">
                            <div className="projects__progress-header">
                                <span>Progress</span>
                                <span>{project.progress}%</span>
                            </div>
                            <div className="projects__progress-bar">
                                <div
                                    className="projects__progress-fill"
                                    style={{ width: `${project.progress}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="projects__updates">
                            <h5>Recent Updates</h5>
                            <ul>
                                {project.updates.map((update, i) => (
                                    <li key={i}>
                                        <span className="projects__update-date">{update.date}</span>
                                        <span className="projects__update-text">{update.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="projects__team">
                            <span className="projects__team-label">Team:</span>
                            <div className="projects__team-members">
                                {project.team.map((member, i) => (
                                    <span key={i} className="projects__team-member" title={member}>
                                        {member.charAt(0)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function getProjectsForAgent(agentId) {
    const projectsData = {
        'prior-auth': [
            {
                id: 1,
                name: 'Aetna Integration Expansion',
                description: 'Expanding prior auth coverage to include all Aetna commercial plans with real-time eligibility verification.',
                status: 'active',
                statusLabel: 'In Progress',
                priority: '🔴 High',
                progress: 72,
                lastUpdated: 'Jan 5, 2024',
                team: ['Alex Chen', 'Maria Santos', 'James Wilson'],
                updates: [
                    { date: 'Jan 5', text: 'Completed API endpoint integration for commercial plans' },
                    { date: 'Jan 3', text: 'Resolved authentication token refresh issues' },
                    { date: 'Dec 28', text: 'Started UAT testing with pilot customers' }
                ]
            },
            {
                id: 2,
                name: 'Appeals Automation v2',
                description: 'Implementing ML-powered appeals generation with automatic documentation gathering.',
                status: 'active',
                statusLabel: 'In Progress',
                priority: '🟡 Medium',
                progress: 45,
                lastUpdated: 'Jan 4, 2024',
                team: ['Priya Sharma', 'Mike Johnson'],
                updates: [
                    { date: 'Jan 4', text: 'Training model on 50K historical appeal cases' },
                    { date: 'Dec 30', text: 'Completed data preprocessing pipeline' }
                ]
            },
            {
                id: 3,
                name: 'FHIR R4 Compliance Update',
                description: 'Upgrading all endpoints to meet FHIR R4 specification requirements.',
                status: 'review',
                statusLabel: 'In Review',
                priority: '🟢 Low',
                progress: 90,
                lastUpdated: 'Jan 6, 2024',
                team: ['Sarah Kim', 'David Lee', 'Anna Brown'],
                updates: [
                    { date: 'Jan 6', text: 'Submitted for security review' },
                    { date: 'Jan 2', text: 'All unit tests passing' }
                ]
            }
        ],
        'referral': [
            {
                id: 1,
                name: 'Provider Network Expansion',
                description: 'Adding 10,000+ new specialists to the referral network with automated credential verification.',
                status: 'active',
                statusLabel: 'In Progress',
                priority: '🔴 High',
                progress: 55,
                lastUpdated: 'Jan 5, 2024',
                team: ['Lisa Park', 'Tom Hardy', 'Jen Wu'],
                updates: [
                    { date: 'Jan 5', text: 'Onboarded 6,200 specialists so far' },
                    { date: 'Jan 1', text: 'Completed West Coast region expansion' }
                ]
            },
            {
                id: 2,
                name: 'Smart Wait Time Prediction',
                description: 'ML model to predict appointment wait times based on provider schedules and historical data.',
                status: 'active',
                statusLabel: 'In Progress',
                priority: '🟡 Medium',
                progress: 30,
                lastUpdated: 'Jan 4, 2024',
                team: ['Kevin Nguyen', 'Amy Zhang'],
                updates: [
                    { date: 'Jan 4', text: 'Initial model achieving 78% accuracy' },
                    { date: 'Dec 28', text: 'Feature engineering complete' }
                ]
            }
        ],
        'writeback': [
            {
                id: 1,
                name: 'Athenahealth Integration',
                description: 'Full bidirectional sync support for Athenahealth EHR with conflict resolution.',
                status: 'active',
                statusLabel: 'In Progress',
                priority: '🔴 High',
                progress: 68,
                lastUpdated: 'Jan 6, 2024',
                team: ['Chris Martin', 'Rachel Green', 'Joey Tribbiani'],
                updates: [
                    { date: 'Jan 6', text: 'Patient demographics sync working in production' },
                    { date: 'Jan 4', text: 'Resolved field mapping conflicts' },
                    { date: 'Jan 2', text: 'Beta testing with 5 pilot clinics' }
                ]
            },
            {
                id: 2,
                name: 'Real-time Audit Dashboard',
                description: 'Building a real-time monitoring dashboard for all writeback operations with PHI compliance.',
                status: 'review',
                statusLabel: 'In Review',
                priority: '🟡 Medium',
                progress: 88,
                lastUpdated: 'Jan 5, 2024',
                team: ['Monica Geller', 'Chandler Bing'],
                updates: [
                    { date: 'Jan 5', text: 'Submitted for HIPAA compliance review' },
                    { date: 'Jan 3', text: 'Dashboard UI complete' }
                ]
            },
            {
                id: 3,
                name: 'Batch Sync Performance Upgrade',
                description: 'Optimizing batch sync operations to handle 10x throughput with zero downtime.',
                status: 'completed',
                statusLabel: 'Completed',
                priority: '🟢 Low',
                progress: 100,
                lastUpdated: 'Jan 1, 2024',
                team: ['Ross Geller'],
                updates: [
                    { date: 'Jan 1', text: '✅ Deployed to production successfully' },
                    { date: 'Dec 29', text: 'Performance tests show 12x improvement' }
                ]
            }
        ]
    }

    return projectsData[agentId] || []
}

export default Projects
