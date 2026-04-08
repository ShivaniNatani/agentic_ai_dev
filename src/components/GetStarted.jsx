import './GetStarted.css'

function GetStarted() {
    return (
        <section id="get-started" className="get-started section">
            <div className="container">
                <div className="get-started__wrapper">
                    <div className="get-started__bg">
                        <div className="get-started__bg-glow"></div>
                        <div className="get-started__bg-pattern"></div>
                    </div>

                    <div className="get-started__content">
                        <h2 className="get-started__title">
                            Ready to Transform Your Operations?
                        </h2>
                        <p className="get-started__description">
                            API requires technical programming to exchange data in an automated fashion.
                            The implementation will require coordination with either your IT department,
                            software vendor or clearinghouse to set up the API service. We have a business
                            and technical team ready to support you through each step of the implementation
                            process, including post-production.
                        </p>
                        <div className="get-started__actions">
                            <a href="#" className="btn btn-primary btn-lg">
                                Get Started Today
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                            <a href="#" className="btn btn-outline">
                                Schedule a Consultation
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default GetStarted
