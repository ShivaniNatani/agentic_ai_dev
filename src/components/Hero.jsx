import './Hero.css'

function Hero() {
    return (
        <section className="hero">
            <div className="hero__bg">
                <div className="hero__bg-gradient"></div>
                <div className="hero__bg-grid"></div>
                <div className="hero__bg-glow"></div>
            </div>

            <div className="container hero__container">
                <div className="hero__content">
                    <span className="hero__badge animate-fade-in">Digital Solutions</span>
                    <h1 className="hero__title animate-fade-in animate-delay-1">
                        Application Programming
                        <span className="hero__title-highlight"> Interface (API)</span>
                    </h1>
                    <p className="hero__description animate-fade-in animate-delay-2">
                        A free digital solution that allows health care professionals to automate
                        administrative transactions. This option is best for organizations that have
                        the technical resources to implement and maintain APIs.
                    </p>
                    <div className="hero__actions animate-fade-in animate-delay-3">
                        <a href="#get-started" className="btn btn-primary">
                            <span>Get Started</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </a>
                        <a href="#" className="btn btn-outline">
                            Self-Paced User Guide
                        </a>
                    </div>
                </div>

                <div className="hero__visual animate-fade-in animate-delay-4">
                    <div className="hero__card">
                        <div className="hero__card-icon">🔗</div>
                        <div className="hero__card-content">
                            <h3>API Marketplace</h3>
                            <p>Explore technical sandboxes and resources</p>
                            <a href="#" className="hero__card-link">
                                Go to Marketplace →
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="hero__scroll">
                <span>Scroll to explore</span>
                <div className="hero__scroll-indicator"></div>
            </div>
        </section>
    )
}

export default Hero
