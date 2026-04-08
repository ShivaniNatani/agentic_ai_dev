export const sandboxConfig = {
    agents: {
        'prior-auth': {
            id: 'prior-auth',
            name: 'Prior Authorization Agent',
            environment: 'React + TypeScript',
            url: 'https://stackblitz.com/edit/vitejs-vite-x3y8x8?embed=1&hideExplorer=1&view=preview',
            description: 'Interactive demo of the Prior Auth submission workflow with real-time validation.',
            features: ['Live Form Validation', 'PDF Parsing', 'Payer Rules Engine']
        },
        'referral': {
            id: 'referral',
            name: 'Referral Coordinator',
            environment: 'React + Tailwind',
            url: 'https://stackblitz.com/edit/vitejs-vite-x3y8x8?embed=1&hideExplorer=1&view=preview', // Placeholder
            description: 'Demonstrates intelligent provider matching and appointment scheduling.',
            features: ['Provider Search', 'Geo-matching', 'Calendar Sync']
        },
        'writeback': {
            id: 'writeback',
            name: 'EHR Writeback Agent',
            environment: 'Node.js API',
            url: 'https://stackblitz.com/edit/node-hp2b4y?embed=1&hideExplorer=1&view=preview', // Placeholder
            description: 'Backend service for writing clinical notes back to EHR systems.',
            features: ['HL7 Generation', 'FHIR API', 'Audit Logging']
        }
    },
    defaultSettings: {
        theme: 'dark',
        mockLatency: 200, // ms
        autoReset: true // reset state on reload
    }
}
