import './TransactionTypes.css'

const transactions = [
    { name: 'Optum Real Pre-Service Eligibility', isNew: true },
    { name: 'Optum Real Claim Pre-Check', isNew: true },
    { name: 'Optum Real Claim Inquiry', isNew: true },
    { name: 'Eligibility and benefits', isNew: false },
    { name: 'Referrals', isNew: false },
    { name: 'Prior authorizations (status check)', isNew: false },
    { name: 'Claim submissions', isNew: false },
    { name: 'Pended claim attachments', isNew: false },
    { name: 'Claim status and payment', isNew: false },
    { name: 'Claim reconsiderations (with attachments)', isNew: false },
    { name: 'Claim appeals (with attachments)', isNew: false },
    { name: 'Provider demographics (add, term, change)', isNew: false },
    { name: 'Documents (replacing paper correspondence)', isNew: false },
    { name: 'TrackIt', isNew: false }
]

function TransactionTypes() {
    return (
        <section id="transactions" className="transactions section">
            <div className="container">
                <div className="transactions__content">
                    <div className="transactions__info">
                        <h2 className="section-title">API Transaction Types</h2>
                        <p className="section-subtitle">
                            Explore the wide range of transaction types available through our API,
                            designed to streamline your healthcare operations.
                        </p>
                        <a href="#" className="btn btn-primary">
                            View All API Types
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>

                    <div className="transactions__list">
                        {transactions.map((item, index) => (
                            <div
                                key={index}
                                className="transactions__item"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <span className="transactions__item-check">✓</span>
                                <span className="transactions__item-name">{item.name}</span>
                                {item.isNew && <span className="badge">NEW</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

export default TransactionTypes
