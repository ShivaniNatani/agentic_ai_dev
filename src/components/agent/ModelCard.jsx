import './ModelCard.css'

function ModelCard({ agent }) {
    return (
        <div className="model-card">
            <div className="model-card__grid">
                <div className="model-card__section model-card__overview">
                    <h3 className="model-card__heading">Overview</h3>
                    <div className="model-card__info-grid">
                        <div className="model-card__info-item">
                            <span className="model-card__label">Model Type</span>
                            <span className="model-card__value">{agent.modelType}</span>
                        </div>
                        <div className="model-card__info-item">
                            <span className="model-card__label">Training Data</span>
                            <span className="model-card__value">{agent.trainingData}</span>
                        </div>
                        <div className="model-card__info-item">
                            <span className="model-card__label">Accuracy</span>
                            <span className="model-card__value model-card__value--highlight">{agent.accuracy}</span>
                        </div>
                        <div className="model-card__info-item">
                            <span className="model-card__label">Version</span>
                            <span className="model-card__value">{agent.version}</span>
                        </div>
                    </div>
                </div>

                <div className="model-card__section model-card__capabilities">
                    <h3 className="model-card__heading">
                        <span className="model-card__heading-icon">✓</span>
                        Capabilities
                    </h3>
                    <ul className="model-card__list">
                        {agent.capabilities.map((item, index) => (
                            <li key={index} className="model-card__list-item model-card__list-item--success">
                                <span className="model-card__bullet">✓</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="model-card__section model-card__limitations">
                    <h3 className="model-card__heading">
                        <span className="model-card__heading-icon">⚠</span>
                        Limitations
                    </h3>
                    <ul className="model-card__list">
                        {agent.limitations.map((item, index) => (
                            <li key={index} className="model-card__list-item model-card__list-item--warning">
                                <span className="model-card__bullet">!</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="model-card__section model-card__usecases">
                    <h3 className="model-card__heading">
                        <span className="model-card__heading-icon">💡</span>
                        Use Cases
                    </h3>
                    <div className="model-card__tags">
                        {agent.useCases.map((useCase, index) => (
                            <span key={index} className="model-card__tag">{useCase}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ModelCard
