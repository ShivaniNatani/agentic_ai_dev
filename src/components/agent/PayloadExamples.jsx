import { useState } from 'react'
import './PayloadExamples.css'

function PayloadExamples({ agent }) {
    const [copiedInput, setCopiedInput] = useState(false)
    const [copiedOutput, setCopiedOutput] = useState(false)

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(JSON.stringify(text, null, 2))
        if (type === 'input') {
            setCopiedInput(true)
            setTimeout(() => setCopiedInput(false), 2000)
        } else {
            setCopiedOutput(true)
            setTimeout(() => setCopiedOutput(false), 2000)
        }
    }

    return (
        <div className="payload-examples">
            <div className="payload-examples__grid">
                <div className="payload-examples__section">
                    <div className="payload-examples__header">
                        <h3 className="payload-examples__heading">
                            <span className="payload-examples__icon">📥</span>
                            Sample Request
                        </h3>
                        <button
                            className={`payload-examples__copy ${copiedInput ? 'payload-examples__copy--copied' : ''}`}
                            onClick={() => handleCopy(agent.sampleInput, 'input')}
                        >
                            {copiedInput ? '✓ Copied!' : '📋 Copy'}
                        </button>
                    </div>
                    <div className="payload-examples__code">
                        <pre>
                            <code>{JSON.stringify(agent.sampleInput, null, 2)}</code>
                        </pre>
                    </div>
                </div>

                <div className="payload-examples__section">
                    <div className="payload-examples__header">
                        <h3 className="payload-examples__heading">
                            <span className="payload-examples__icon">📤</span>
                            Sample Response
                        </h3>
                        <button
                            className={`payload-examples__copy ${copiedOutput ? 'payload-examples__copy--copied' : ''}`}
                            onClick={() => handleCopy(agent.sampleOutput, 'output')}
                        >
                            {copiedOutput ? '✓ Copied!' : '📋 Copy'}
                        </button>
                    </div>
                    <div className="payload-examples__code">
                        <pre>
                            <code>{JSON.stringify(agent.sampleOutput, null, 2)}</code>
                        </pre>
                    </div>
                </div>
            </div>

            <div className="payload-examples__notes">
                <h4>📝 Notes</h4>
                <ul>
                    <li>All timestamps are in ISO 8601 format (UTC)</li>
                    <li>The <code>processingTime</code> field indicates actual API processing duration</li>
                    <li>Error responses follow RFC 7807 problem details format</li>
                    <li>Rate limits are included in response headers</li>
                </ul>
            </div>
        </div>
    )
}

export default PayloadExamples
