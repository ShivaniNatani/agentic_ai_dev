import './Benefits.css'

const benefits = [
    {
        icon: '⚡',
        title: 'Automate Tasks',
        description: 'Allows you to automate routine administrative tasks seamlessly'
    },
    {
        icon: '🔄',
        title: 'Interoperability',
        description: 'Permits data transfers to your application of choice'
    },
    {
        icon: '🚀',
        title: 'Faster Distribution',
        description: 'Distributes data faster than traditional methods'
    },
    {
        icon: '💰',
        title: 'Reduce Costs',
        description: 'Reduces administrative costs, denials, and saves time'
    },
    {
        icon: '🛡️',
        title: 'Flag Issues',
        description: 'Flags issues before claims are submitted'
    },
    {
        icon: '📊',
        title: 'Real-time Transparency',
        description: 'Brings real-time transparency into existing workflow'
    }
]

function Benefits() {
    return (
        <section id="benefits" className="benefits section">
            <div className="container">
                <div className="benefits__header">
                    <h2 className="section-title">Benefits of Using API</h2>
                    <p className="section-subtitle">
                        Discover how our API solutions can transform your healthcare operations
                    </p>
                </div>

                <div className="benefits__grid">
                    {benefits.map((benefit, index) => (
                        <div
                            key={index}
                            className="benefits__card glass-card"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="benefits__icon">{benefit.icon}</div>
                            <h3 className="benefits__title">{benefit.title}</h3>
                            <p className="benefits__description">{benefit.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Benefits
