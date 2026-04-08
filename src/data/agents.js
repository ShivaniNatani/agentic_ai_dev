export const agents = [
    {
        id: 'pkb',
        name: 'PKB Agent',
        type: 'Surveillance',
        version: '3.0.0',
        accuracy: '99.2%',
        shortDesc: 'Comprehensive Policy Surveillance and Next Best Action recommender.',
        fullDesc: 'The PKB Agent suite handles Payer Policy Surveillance, ensuring real-time monitoring of policy changes, and drives Next Best Action (NBA) recommendations for payers.',
        icon: '👁️',
        status: 'live',
        tags: ['Surveillance', 'Policy'],
        demonstration: 'Detailed policy extraction and difference analysis.',

        modelInfo: {
            architecture: 'Transformer-based NLP',
            trainingData: 'Policy Documents',
            lastRetrained: 'Jan 20, 2026',
            contextWindow: '128k tokens'
        },

        payers: [
            { name: 'UnitedHealthcare', status: 'Live', method: 'Scraping', successRate: '99.8%' },
            { name: 'Aetna', status: 'Live', method: 'API', successRate: '99.5%' },
            { name: 'Cigna', status: 'Beta', method: 'Scraping', successRate: '95.0%' }
        ],
        payloads: {
            request: {
                "payer_id": "UHC",
                "policy_type": "Medical Necessity",
                "keywords": ["orthopedics", "rehabilitation"],
                "date_range": {
                    "start": "2025-01-01",
                    "end": "2025-02-01"
                }
            },
            response: {
                "updates_found": 3,
                "policies": [
                    {
                        "id": "POL-2025-001",
                        "title": "Knee Arthroscopy Guidelines",
                        "change_summary": "Added requirement for conservative therapy duration.",
                        "impact_score": "High"
                    }
                ],
                "nba_recommendation": "Update prior auth templates for knee procedures."
            }
        },
        performance: [
            { date: 'Mon', errorRate: 0.1, latency: 2500 },
            { date: 'Tue', errorRate: 0.2, latency: 2450 },
            { date: 'Wed', errorRate: 0.0, latency: 2600 },
            { date: 'Thu', errorRate: 0.1, latency: 2550 },
            { date: 'Fri', errorRate: 0.3, latency: 2700 }
        ],
        demoVideoUrl: "/videos/agents/pkb_2.mp4",

        projects: [
            { id: 'PKB-1', client: 'PKB', name: 'Payer Policy Surveillance V-1', status: 'active', date: 'Live' },
            { id: 'PKB-2', client: 'PKB', name: 'Payer Policy Surveillance V-2 + 3', status: 'active', date: '11/27' },
            { id: 'NBA-1', client: 'NBA', name: 'Next Best Action Recommendation', status: 'active', date: '12/26' },
            { id: 'MNA-1', client: 'Generic', name: 'Medical Necessity Agent (Policy Extraction)', status: 'planning', date: 'TBD' },
            { id: 'EVE-1', client: 'Generic', name: 'ASK EVE', status: 'planning', date: 'TBD' }
        ],

        features: [
            'Real-time Policy Monitoring',
            'Next Best Action Recommendations',
            'Contextual Policy Chat (EVE)'
        ],
        endpoints: [
            { method: 'GET', path: '/v1/policies/search', description: 'Search for policy documents by keyword' },
            { method: 'POST', path: '/v1/surveillance/subscribe', description: 'Subscribe to policy updates for a payer' },
            { method: 'GET', path: '/v1/nba/recommendations', description: 'Get Next Best Action recommendations' }
        ]
    },
    {
        id: 'writeback',
        name: 'Writeback Agent',
        type: 'Integration',
        version: '4.2.0',
        accuracy: '100%',
        shortDesc: 'Universal integration engine for clinical note and pharmacy writebacks.',
        fullDesc: 'Handles high-volume writeback operations across multiple EHRs and specialties, including Orthopedics and Pharmacy workflows. Supports complex logic for Fee Schedules, PDF Conversions, and Pop-up Handling.',
        icon: '📝',
        status: 'live',
        tags: ['Integration', 'EHR'],

        modelInfo: { architecture: 'Determinstic', lastRetrained: 'N/A' },
        payers: [
            { name: 'CDPHP', status: 'Live', method: 'Direct Db', successRate: '100%' },
            { name: 'Fidelis', status: 'Live', method: 'HL7', successRate: '99.9%' }
        ],
        payloads: {
            request: {
                "patient_id": "PT-998877",
                "ehr_system": "Epic",
                "visit_id": "Vis-2201",
                "clinical_note": {
                    "text": "Patient reports improvement in mobility...",
                    "author": "Dr. Smith",
                    "timestamp": "2025-10-22T14:30:00Z"
                },
                "attachments": ["pdf_base64_string..."]
            },
            response: {
                "status": "SUCCESS",
                "writeback_id": "WB-00992",
                "ehr_timestamp": "2025-10-22T14:30:05Z",
                "warnings": []
            }
        },
        performance: [
            { date: 'Mon', errorRate: 0.0, latency: 120 },
            { date: 'Tue', errorRate: 0.0, latency: 115 },
            { date: 'Wed', errorRate: 0.0, latency: 130 },
            { date: 'Thu', errorRate: 0.1, latency: 125 },
            { date: 'Fri', errorRate: 0.0, latency: 118 }
        ],

        projects: [
            { id: 'CDP-ALL', client: 'CDPHP', name: 'CDPHP - ONY Writeback', status: 'active', date: 'Live' },
            { id: 'ORT-ALL', client: 'OrthoNY', name: 'OrthoNY ModMed Writeback', status: 'active', date: 'Live' },
            { id: 'AHN-1', client: 'AHN', name: 'AHN WriteBack', status: 'in-progress', date: 'TBD' },
            { id: 'PDP-1', client: 'PDP', name: 'PDP Writeback(NextGen v6)', status: 'in-progress', date: 'TBD' },
            { id: 'PHM-ALL', client: 'PHMG', name: 'PHMG Writeback', status: 'in-progress', date: 'TBD' },
            { id: 'REV-1', client: 'Revere', name: 'Revere Writeback - V', status: 'in-progress', date: 'TBD' },
            { id: 'PEH-1', client: 'PEH', name: 'EHR PEH Writeback (Integration Layer)', status: 'in-progress', date: 'TBD' }
        ],

        features: [
            'EHR Writeback (Epic, ModMed, NextGen)',
            'PDF Conversion & Upload',
            'Fee Schedule Logic',
            'Pharmacy Workflow Automation'
        ],
        endpoints: [
            { method: 'POST', path: '/v1/writeback/note', description: 'Write clinical note to EHR' },
            { method: 'POST', path: '/v1/writeback/pharmacy', description: 'Update pharmacy records' },
            { method: 'POST', path: '/v1/writeback/fee-schedule', description: 'Update fee schedule data' }
        ]
    },
    {
        id: 'browser-agent-pa',
        name: 'Browser Agent PA',
        type: 'Automation',
        version: '2.5.0',
        accuracy: '97.5%',
        shortDesc: 'Automates Prior Auth submissions and Referral determinations via browser emulation.',
        fullDesc: 'A powerful browser-based agent that navigates payer portals (Availity, UHC, Carelon, etc.) to submit Prior Authorizations, check statuses, and determine referral requirements.',
        icon: '💻',
        status: 'live',
        tags: ['Automation', 'Portal'],

        modelInfo: { architecture: 'Visual Dom Navigation', lastRetrained: 'Dec 2025' },
        payers: [
            { name: 'Availity', status: 'Live', method: 'Browser', successRate: '98.2%' },
            { name: 'UHC Link', status: 'Live', method: 'Browser', successRate: '97.5%' },
            { name: 'Carelon', status: 'Beta', method: 'Browser', successRate: '94.0%' }
        ],
        payloads: {
            request: {
                "portal": "Availity",
                "action": "SUBMIT_PA",
                "patient_details": {
                    "first_name": "John",
                    "last_name": "Doe",
                    "dob": "1980-05-15"
                },
                "service_line": "Radiology",
                "cpt_codes": ["72148", "72158"]
            },
            response: {
                "status": "COMPLETED",
                "auth_number": "A123456789",
                "determination": "APPROVED",
                "screenshot_url": "https://s3.bucket/scr/123.jpg"
            }
        },
        performance: [
            { date: 'Mon', errorRate: 1.5, latency: 15000 },
            { date: 'Tue', errorRate: 1.2, latency: 14500 },
            { date: 'Wed', errorRate: 0.8, latency: 14000 },
            { date: 'Thu', errorRate: 1.0, latency: 14800 },
            { date: 'Fri', errorRate: 1.1, latency: 14200 }
        ],

        projects: [
            { id: 'PA-1', client: 'BCBS', name: 'Browser submission agent (Prior Auth Submission) [BCBS IL]', status: 'planning', date: 'TBD' },
            { id: 'PA-2', client: 'BCBS AZ', name: 'CMM / GIA Availity PA (BCBS of AZ as payer)', status: 'planning', date: 'TBD' },
            { id: 'PA-3', client: 'Premera', name: 'Premera / GIA Availity PA Alaska', status: 'planning', date: 'TBD' },
            { id: 'PA-4', client: 'Regence', name: 'Regence Utah/ GIA Availity PA', status: 'planning', date: 'TBD' },
            { id: 'PA-5', client: 'Regence', name: 'Regence Idaho/ GIA Availity PA', status: 'planning', date: 'TBD' },
            { id: 'PA-6', client: 'Well Care', name: 'Well Care/ GIA Availity PA', status: 'planning', date: 'TBD' },
            { id: 'PA-7', client: 'Well Point', name: 'Well Point/ GIA Availity PA', status: 'planning', date: 'TBD' },
            { id: 'PA-8', client: 'UHC', name: 'CMM UHC PA', status: 'in-progress', date: '12/13' },
            { id: 'PA-9', client: 'Carelon', name: 'CMM Carelon PA (Radiology/Internal Med)', status: 'active', date: '12/09' },
            { id: 'PA-10', client: 'Evolent', name: 'CMM Evolent PA', status: 'active', date: '12/09' },
            { id: 'PA-11', client: 'Carelon', name: 'GIA Carelon PA', status: 'planning', date: 'Blocker' },
            { id: 'PA-12', client: 'OrthoNY', name: 'Evolent-OrthoNY', status: 'in-progress', date: 'TBD' },
            { id: 'PA-13', client: 'Fidelis', name: 'RADMD/Fidelis (Status Check)', status: 'active', date: 'Live' },
            { id: 'PA-14', client: 'Internal', name: 'Code Tagging', status: 'active', date: 'Live' },
            { id: 'REF-1', client: 'Availity', name: 'Availity Referral Determination', status: 'in-progress', date: 'TBD' },
            { id: 'REF-2', client: 'UHC', name: 'UHC Referral Determination', status: 'active', date: '12/15' },
            { id: 'REF-3', client: 'Cigna', name: 'Cigna Referral Determination', status: 'active', date: '12/19' },
            { id: 'REF-4', client: 'One Heart', name: 'One Heart Referral Agent', status: 'in-progress', date: 'TBD' },
            { id: 'REF-5', client: 'Revere', name: 'Revere - SelectHealth PA', status: 'in-progress', date: 'TBD' }
        ],

        features: [
            'Multi-Payer Portal Support',
            'Referral Determination',
            'Status Checks',
            'Code Tagging'
        ],
        endpoints: [
            { method: 'POST', path: '/v1/browser/navigate', description: 'Navigate to a specific URL' },
            { method: 'POST', path: '/v1/browser/submit-pa', description: 'Execute PA submission workflow' },
            { method: 'GET', path: '/v1/browser/status/{id}', description: 'Check status of browser session' }
        ]
    }
]
