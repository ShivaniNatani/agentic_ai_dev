import './WhyAddAPI.css'

const features = [
    {
        icon: '🎯',
        title: 'Flexibility',
        items: [
            'Appropriate for practices, facilities, health care systems, vendors, clearinghouses and revenue cycle management companies',
            'Various levels of data are accessible for each API type; choose those that fit your needs',
            'Available for many UnitedHealthcare payers and plans'
        ]
    },
    {
        icon: '⚙️',
        title: 'Automation',
        items: [
            'Transactions are automated on a timetable you set',
            'Real-time data is returned faster',
            'Incorporates seamlessly into existing workflow'
        ]
    },
    {
        icon: '🔒',
        title: 'Security',
        items: [
            'Enforces password reset every 2 years',
            'Protects data from unauthorized views through encryption',
            'Offers a secure, standardized method of communication between software programs'
        ]
    }
]

function WhyAddAPI() {
    return (
        <section id="why-api" className="why-api section">
            <div className="container">
                <div className="why-api__header">
                    <h2 className="section-title">Why Add API to Your Practice?</h2>
                    <p className="section-subtitle">
                        API is designed to help your organization improve efficiency, reduce costs
                        and increase cash flow. Phone calls and paper handling decrease, while
                        contributing to a smoother workflow with fewer interruptions.
                    </p>
                </div>

                <div className="why-api__grid">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="why-api__card glass-card"
                            style={{ animationDelay: `${index * 0.15}s` }}
                        >
                            <div className="why-api__card-header">
                                <span className="why-api__icon">{feature.icon}</span>
                                <h3 className="why-api__title">{feature.title}</h3>
                            </div>
                            <ul className="why-api__list">
                                {feature.items.map((item, i) => (
                                    <li key={i} className="why-api__list-item">
                                        <span className="why-api__list-bullet"></span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default WhyAddAPI
