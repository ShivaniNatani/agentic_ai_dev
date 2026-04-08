export const releases = [
    // 1. Referral (UHC and Cigna)
    {
        id: 'rel-uhc-ref-1',
        projectId: 'REF-2',
        agent: 'Referral Agent',
        category: 'Referral Agent',
        payer: 'UHC',
        icon: '🔄',
        stage: 'Live',
        version: '1.0.0',
        type: 'minor',
        date: 'Jan 13, 2026',
        owner: 'Shivani',
        title: 'UHC Referral Automation: Credential Update',
        description: 'Critical security and configuration update to ensure uninterrupted referral processing for UHC portal.',
        highlights: [
            'Automated detailed referral submission (no manual entry)',
            'N8N workflow resilience upgrade (99.9% uptime)',
            'Enhanced session management for long-running bots'
        ],
        fixes: []
    },
    {
        id: 'rel-cigna-ref-1',
        projectId: 'REF-3',
        agent: 'Referral Agent',
        category: 'Referral Agent',
        payer: 'Cigna',
        icon: '🔄',
        stage: 'Live',
        version: '1.0.0',
        type: 'minor',
        date: 'Jan 13, 2026',
        owner: 'Shivani',
        title: 'Cigna Workflow Stabilization',
        description: 'Resolved configuration bottlenecks to accelerate Cigna referral determinations.',
        highlights: [
            'Zero-touch credential rotation implemented',
            'Eliminated workflow stalls during peak load',
            'Granular error telemetry for faster resolution'
        ],
        fixes: []
    },

    // 2. CDPHP
    {
        id: 'rel-cdp-1',
        projectId: 'CDP-ALL',
        agent: 'Writeback Agent',
        category: 'Writeback Agent',
        payer: 'CDPHP',
        icon: '⚡',
        stage: 'Live',
        version: '1.0.1',
        type: 'minor',
        date: 'Jan 13, 2026',
        owner: 'Shivani & Argha',
        title: 'CDPHP High-Performance Writeback',
        description: 'Achieved sub-2-minute end-to-end job completion for CDPHP writebacks.',
        highlights: [
            '100% Automated OTP handling (Gmail/IMAP integration)',
            'Zero Human-in-the-Loop (Fully Autonomous)',
            'Resilient selector strategies (DOM/CV/Index)',
            'Cost Optimization: Zero external API usage'
        ],
        fixes: [
            'Healthcheck tuning for network latency',
            'Headless mode enforcement for stability'
        ]
    },

    // 3. Recommended Best Action (Optimix)
    {
        id: 'nba-1.0.4',
        projectId: 'NBA-1',
        agent: 'Optimix',
        category: 'Optimix',
        payer: 'Recommended Best Action',
        icon: '🤖',
        stage: 'Live',
        version: '1.0.4',
        type: 'minor',
        date: 'Jan 20, 2026',
        owner: 'Amey & Amit',
        title: 'Optimix: Intent & Document Intelligence',
        description: 'Major upgrade to Next Best Action (NBA) agent with value-based intent recognition.',
        highlights: [
            'Context-Aware: Retains session memory for complex queries',
            'RAG Integration: Fetches exact payer rules from vector DB',
            'Revenue Focus: Links CARC/RARC codes to financial impact',
            'Multi-Turn Logic: Handles complex patient history questions'
        ],
        fixes: []
    },
    {
        id: 'nba-1.0.3',
        projectId: 'NBA-1',
        agent: 'Optimix',
        category: 'Optimix',
        payer: 'Recommended Best Action',
        icon: '💬',
        stage: 'Live',
        version: '1.0.3',
        type: 'minor',
        date: 'Jan 16, 2026',
        owner: 'Amey & Amit',
        title: 'Chat Feature',
        description: 'Implemented comprehensive chat capabilities for the Next Best Action agent.',
        highlights: [
            'Chat interface integration',
            'Real-time query handling'
        ],
        fixes: []
    },

    // 4. Payer Surveillence
    {
        id: 'pkb-3.0',
        projectId: 'PKB-2',
        agent: 'PKB Agent',
        category: 'Payer Surveillance',
        payer: 'PKB',
        icon: '👁️',
        stage: 'Live',
        version: '3.0.0',
        type: 'major',
        date: 'Jan 13, 2026',
        owner: 'Amey',
        title: 'PKB Surveillance 3.0: Autonomous Review',
        description: 'Breakthrough release integrating Human-in-the-Loop (HITL) with 95% automated policy comparison.',
        highlights: [
            '95% Automation Rate in Policy Comparison',
            'Unstructured Data Extraction from Claim PDFs',
            'Seamless EVE Integration (Payload v2)',
            'Automated Policy Document Retrieval'
        ],
        fixes: [
            'Resolved diagnostic imaging navigation issues'
        ]
    },

    // 5. Browser Agent PA
    {
        id: 'rel-pa-9',
        projectId: 'PA-9',
        agent: 'Browser Agent PA',
        category: 'Browser Agent PA',
        payer: 'Carelon',
        icon: '💻',
        stage: 'Live',
        version: '2.5.0',
        type: 'minor',
        date: 'Jan 20, 2026',
        owner: 'Akshay',
        title: 'Ops Testing & n8n Fixes',
        description: 'Operational testing updates and workflow stabilization.',
        highlights: [
            'Ops testing in progress for Carelon portal',
            'Wissen team fixed blocking bugs in n8n workflow',
            'Resolved resolved by Wissen team'
        ],
        fixes: []
    },

    // 6. Referral (Availity)
    {
        id: 'rel-ref-1',
        projectId: 'REF-1',
        agent: 'Referral Agent',
        category: 'Referral Agent',
        payer: 'Availity',
        icon: '🔄',
        stage: 'Dev',
        version: '1.0.0',
        type: 'minor',
        date: 'Jan 22, 2026',
        owner: 'Amey & Prathamesh',
        title: 'Availity Referral Expansion',
        description: 'Development completed for different payers like BCBS of IL, Premera, Wellcare.',
        highlights: [
            'Development completed for Regence, Wellpoint',
            'Under testing phase',
            'Multi-payer GIA Availity integration'
        ],
        fixes: []
    },

    // 7. OrthoNY (Writeback)
    {
        id: 'rel-ort-eve',
        projectId: 'ORT-ALL',
        agent: 'Writeback Agent',
        category: 'Writeback Agent',
        payer: 'OrthoNY',
        icon: '🦴',
        stage: 'Live',
        version: '2.1.1',
        type: 'minor',
        date: 'Jan 26, 2026',
        owner: 'Argha & Athul',
        title: 'EVE Notes Integration',
        description: 'Enhanced Chat Feature with AI-Powered Intelligence and Workers Compensation updates.',
        highlights: [
            'Log Analysis, PCP Agent & Smarter AI',
            'Pop-Up Handling, Removal of Mismatched Pharmacies',
            'Workers Compensation Agent',
            'Auto Insurance Agent Cache logging',
            'Notes writeback with PDF attached'
        ],
        fixes: [
            'Detailed notes writeback with PDF attached'
        ]
    }
]
