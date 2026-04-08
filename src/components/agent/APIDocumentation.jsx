import { useState } from 'react'
import './APIDocumentation.css'

function APIDocumentation({ agent }) {
    const [activeEndpoint, setActiveEndpoint] = useState(0)

    const generateCurlExample = (endpoint) => {
        return `curl -X ${endpoint.method} \\
  "${agent.baseUrl}${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(agent.sampleInput, null, 2)}'`
    }

    const generatePythonExample = (endpoint) => {
        return `import requests

url = "${agent.baseUrl}${endpoint.path}"
headers = {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN",
    "Content-Type": "application/json"
}
payload = ${JSON.stringify(agent.sampleInput, null, 4)}

response = requests.${endpoint.method.toLowerCase()}(url, json=payload, headers=headers)
print(response.json())`
    }

    const generateJSExample = (endpoint) => {
        return `const response = await fetch("${agent.baseUrl}${endpoint.path}", {
  method: "${endpoint.method}",
  headers: {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(${JSON.stringify(agent.sampleInput, null, 4)})
});

const data = await response.json();
console.log(data);`
    }

    const [codeTab, setCodeTab] = useState('curl')

    return (
        <div className="api-docs">
            <div className="api-docs__grid">
                <div className="api-docs__section api-docs__overview">
                    <h3 className="api-docs__heading">Base Configuration</h3>
                    <div className="api-docs__config">
                        <div className="api-docs__config-item">
                            <span className="api-docs__config-label">Base URL</span>
                            <code className="api-docs__config-value">{agent.baseUrl}</code>
                        </div>
                        <div className="api-docs__config-item">
                            <span className="api-docs__config-label">Authentication</span>
                            <code className="api-docs__config-value">{agent.authType}</code>
                        </div>
                    </div>
                </div>

                <div className="api-docs__section api-docs__headers">
                    <h3 className="api-docs__heading">Request Headers</h3>
                    <table className="api-docs__table">
                        <thead>
                            <tr>
                                <th>Header</th>
                                <th>Value</th>
                                <th>Required</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agent.headers.map((header, index) => (
                                <tr key={index}>
                                    <td><code>{header.name}</code></td>
                                    <td><code className="api-docs__code--muted">{header.value}</code></td>
                                    <td>
                                        <span className={`api-docs__badge ${header.required ? 'api-docs__badge--required' : 'api-docs__badge--optional'}`}>
                                            {header.required ? 'Required' : 'Optional'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="api-docs__section api-docs__endpoints">
                    <h3 className="api-docs__heading">Endpoints</h3>
                    <div className="api-docs__endpoint-list">
                        {agent.endpoints.map((endpoint, index) => (
                            <button
                                key={index}
                                className={`api-docs__endpoint ${activeEndpoint === index ? 'api-docs__endpoint--active' : ''}`}
                                onClick={() => setActiveEndpoint(index)}
                            >
                                <span className={`api-docs__method api-docs__method--${endpoint.method.toLowerCase()}`}>
                                    {endpoint.method}
                                </span>
                                <span className="api-docs__path">{endpoint.path}</span>
                            </button>
                        ))}
                    </div>

                    <div className="api-docs__endpoint-detail">
                        <p className="api-docs__endpoint-desc">
                            {agent.endpoints[activeEndpoint].description}
                        </p>

                        <div className="api-docs__code-tabs">
                            <button
                                className={`api-docs__code-tab ${codeTab === 'curl' ? 'api-docs__code-tab--active' : ''}`}
                                onClick={() => setCodeTab('curl')}
                            >
                                cURL
                            </button>
                            <button
                                className={`api-docs__code-tab ${codeTab === 'python' ? 'api-docs__code-tab--active' : ''}`}
                                onClick={() => setCodeTab('python')}
                            >
                                Python
                            </button>
                            <button
                                className={`api-docs__code-tab ${codeTab === 'javascript' ? 'api-docs__code-tab--active' : ''}`}
                                onClick={() => setCodeTab('javascript')}
                            >
                                JavaScript
                            </button>
                        </div>

                        <div className="api-docs__code-block">
                            <button className="api-docs__copy-btn" onClick={() => {
                                navigator.clipboard.writeText(
                                    codeTab === 'curl' ? generateCurlExample(agent.endpoints[activeEndpoint]) :
                                        codeTab === 'python' ? generatePythonExample(agent.endpoints[activeEndpoint]) :
                                            generateJSExample(agent.endpoints[activeEndpoint])
                                )
                            }}>
                                📋 Copy
                            </button>
                            <pre>
                                <code>
                                    {codeTab === 'curl' && generateCurlExample(agent.endpoints[activeEndpoint])}
                                    {codeTab === 'python' && generatePythonExample(agent.endpoints[activeEndpoint])}
                                    {codeTab === 'javascript' && generateJSExample(agent.endpoints[activeEndpoint])}
                                </code>
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default APIDocumentation
