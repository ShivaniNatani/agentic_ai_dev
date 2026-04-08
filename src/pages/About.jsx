import './About.css'

function About() {
    const stats = [
        { value: '#1', label: 'Care Enablement Platform' },
        { value: '8-12%', label: 'Revenue Improvement' },
        { value: '95%+', label: 'Accuracy Rate' },
        { value: '600+', label: 'Healthcare Clients' }
    ]

    const values = [
        {
            icon: '🏥',
            title: 'Chore-free Care',
            description: 'We take on the administrative, clinical, and operational burdens of healthcare, allowing clinicians and staff to focus on delivering exceptional care.'
        },
        {
            icon: '💰',
            title: 'Financial Sustainability',
            description: 'Our solutions enable growth and optimize enterprises for long-term financial sustainability. We share the risk with our clients.'
        },
        {
            icon: '❤️',
            title: 'Patient-Centric Approach',
            description: 'By driving patient safety, satisfaction, and engagement, we help healthcare organizations deliver exceptional care experiences.'
        },
        {
            icon: '🤖',
            title: 'Tech + Human Synergy',
            description: 'Our unique approach blends innovative technology with human expertise for a scalable, trusted path to transformative change.'
        }
    ]

    const solutions = [
        'Revenue Cycle Management',
        'Clinical Support Services',
        'Value-Based Care Solutions',
        'Prior Authorization Automation',
        'Medical Coding & Auditing',
        'Patient Engagement'
    ]

    return (
        <div className="about-page">
            {/* Hero Section */}
            <section className="about-hero">
                <div className="about-hero-bg">
                    <div className="about-orb about-orb--1"></div>
                    <div className="about-orb about-orb--2"></div>
                </div>
                <div className="container">
                    <div className="about-hero-content">
                        <span className="about-kicker">About IKS Health</span>
                        <h1 className="about-title">
                            <span className="gradient-text">The Agentic AI Platform</span>
                            <span>That Connects the Entire Care Journey</span>
                        </h1>
                        <p className="about-subtitle">
                            IKS Health delivers revenue cycle management, clinical support, and value-based care solutions
                            to create transformative value in healthcare.
                        </p>
                        <div className="about-hero-actions">
                            <a href="https://ikshealth.com/" target="_blank" rel="noopener noreferrer" className="btn-primary">
                                Visit Website →
                            </a>
                            <a href="https://ikshealth.com/contact-us/" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                                Contact Us
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="about-stats">
                <div className="container">
                    <div className="about-stats-grid">
                        {stats.map((stat, index) => (
                            <div key={index} className="about-stat-card">
                                <span className="about-stat-value">{stat.value}</span>
                                <span className="about-stat-label">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section className="about-mission">
                <div className="container">
                    <div className="about-section-header">
                        <span className="about-section-kicker">Our Mission</span>
                        <h2>The Intelligent Care Enablement Platform</h2>
                        <p>
                            IKS Health's platform combines AI and human expertise to connect clinical, operational,
                            and financial workflows—removing friction, improving performance, and creating measurable
                            impact across the care journey.
                        </p>
                    </div>
                </div>
            </section>

            {/* Values Section */}
            <section className="about-values">
                <div className="container">
                    <div className="about-section-header">
                        <span className="about-section-kicker">Why Care Enablement?</span>
                        <h2>Our Core Values</h2>
                    </div>
                    <div className="about-values-grid">
                        {values.map((value, index) => (
                            <div key={index} className="about-value-card">
                                <span className="about-value-icon">{value.icon}</span>
                                <h3>{value.title}</h3>
                                <p>{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Solutions Section */}
            <section className="about-solutions">
                <div className="container">
                    <div className="about-section-header">
                        <span className="about-section-kicker">What We Do</span>
                        <h2>Our Solutions</h2>
                    </div>
                    <div className="about-solutions-grid">
                        {solutions.map((solution, index) => (
                            <div key={index} className="about-solution-tag">
                                {solution}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="about-contact">
                <div className="container">
                    <div className="about-contact-card">
                        <h3>Connect with IKS Health</h3>
                        <div className="about-contact-grid">
                            <a href="https://ikshealth.com/" target="_blank" rel="noopener noreferrer" className="about-contact-link">
                                <span className="about-contact-icon">🌐</span>
                                <span>ikshealth.com</span>
                            </a>
                            <a href="https://ikshealth.com/careers/" target="_blank" rel="noopener noreferrer" className="about-contact-link">
                                <span className="about-contact-icon">💼</span>
                                <span>Careers</span>
                            </a>
                            <a href="https://ikshealth.com/contact-us/" target="_blank" rel="noopener noreferrer" className="about-contact-link">
                                <span className="about-contact-icon">📧</span>
                                <span>Contact Us</span>
                            </a>
                            <a href="https://ikshealth.com/insights/" target="_blank" rel="noopener noreferrer" className="about-contact-link">
                                <span className="about-contact-icon">📰</span>
                                <span>News & Insights</span>
                            </a>
                        </div>
                        <div className="about-locations">
                            <p><strong>Locations:</strong> USA • India</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default About
