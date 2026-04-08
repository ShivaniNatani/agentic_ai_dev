export const clients = [
    {
        id: 'orthony',
        name: 'OrthoNY',
        logo: 'OA',
        tier: 'Enterprise',
        status: 'active',
        since: '2023',
        description: 'Leading orthopedic practice in Upstate New York.',
        projects: [
            { id: 1, name: 'Prior Auth Expansion', status: 'active', progress: 75 },
            { id: 2, name: 'Referral Automation', status: 'completed', progress: 100 }
        ],
        activeAgents: ['Prior Auth', 'Referral', 'Eligibility'],
        stats: {
            authSuccess: '94%',
            savings: '$1.2M',
            tasksAutomated: '45k'
        }
    },
    {
        id: 'cdphp',
        name: 'CDPHP',
        logo: 'CD',
        tier: 'Payer Partner',
        status: 'active',
        since: '2022',
        description: 'Physician-founded health plan serving New York.',
        projects: [
            { id: 3, name: 'Claims Adjudication Pilot', status: 'active', progress: 30 },
            { id: 4, name: 'Member Portal Integration', status: 'review', progress: 90 }
        ],
        activeAgents: ['Claims', 'Member Support', 'Payer Surveillance'],
        stats: {
            authSuccess: '99%',
            savings: '$3.5M',
            tasksAutomated: '120k'
        }
    },
    {
        id: 'palomar',
        name: 'Palomar Health',
        logo: 'PH',
        tier: 'Enterprise',
        status: 'onboarding',
        since: '2024',
        description: 'Largest healthcare district in Southern California.',
        projects: [
            { id: 5, name: 'Full Stack Implementation', status: 'active', progress: 15 }
        ],
        activeAgents: ['Prior Auth', 'Coding'],
        stats: {
            authSuccess: '-',
            savings: '-',
            tasksAutomated: '0'
        }
    },
    {
        id: 'optum',
        name: 'Optum Care',
        logo: 'OC',
        tier: 'Strategic',
        status: 'active',
        since: '2021',
        description: 'Technology-enabled health services business.',
        projects: [
            { id: 6, name: 'Risk Adjustment Optimization', status: 'maintenance', progress: 100 }
        ],
        activeAgents: ['Risk Adjustment', 'Clinical Review'],
        stats: {
            authSuccess: '97%',
            savings: '$8.4M',
            tasksAutomated: '500k+'
        }
    }
]
