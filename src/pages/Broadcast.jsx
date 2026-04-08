import React, { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Brain, Zap, Shield, TrendingUp, AlertTriangle, Activity,
    BarChart3, Globe, MessageSquare, Sparkles, ChevronRight,
    Play, CheckCircle, Star, Cpu, Network, Eye, Target,
    ArrowRight, Server, Layers, FileText, Video, Lock, Code, Database, Key,
    Cloud, Box
} from 'lucide-react';
import './Broadcast.css';

// Animated counter component
const AnimatedCounter = ({ end, duration = 2000, suffix = '', prefix = '' }) => {
    const [count, setCount] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        let start = 0;
        const step = end / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [isVisible, end, duration]);

    return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
};

// Floating particles component
const FloatingParticles = () => (
    <div className="particles-container">
        {[...Array(20)].map((_, i) => (
            <motion.div
                key={i}
                className="particle"
                initial={{ opacity: 0, y: 100 }}
                animate={{
                    opacity: [0, 1, 0],
                    y: [-20, -100],
                    x: [0, Math.random() * 50 - 25]
                }}
                transition={{
                    duration: 3 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 5
                }}
                style={{
                    left: `${Math.random() * 100}%`,
                    background: `hsl(${200 + Math.random() * 60}, 80%, 60%)`
                }}
            />
        ))}
    </div>
);

// Feature card component
const FeatureCard = ({ icon: Icon, title, description, gradient, delay }) => (
    <motion.div
        className="feature-card"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay }}
        whileHover={{ scale: 1.02, translateY: -5 }}
    >
        <div className="feature-icon" style={{ background: gradient }}>
            <Icon size={28} />
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
    </motion.div>
);

// Live Activity Feed Component
const LiveActivityFeed = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const potentialEvents = [
            { type: 'agent', msg: 'Agent-009 submitted claim #88219 to UHC', time: 'Just now' },
            { type: 'ml', msg: 'Drift detected in model: viral_pred_v2 (0.04)', time: '2s ago' },
            { type: 'sys', msg: 'Auto-scaled inference nodes to match load', time: '5s ago' },
            { type: 'agent', msg: 'Context retained for multi-step patient interaction', time: '8s ago' },
            { type: 'ml', msg: 'Prediction served for cardiac_risk (98% conf)', time: '12s ago' }
        ];

        const interval = setInterval(() => {
            const randomTemplate = potentialEvents[Math.floor(Math.random() * potentialEvents.length)];
            const newEvent = { ...randomTemplate, id: Date.now() + Math.random() };
            setEvents(prev => [newEvent, ...prev].slice(0, 4));
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="live-feed-widget">
            <div className="feed-header">
                <div className="live-dot"></div>
                <span>LIVE NEXUS FEED</span>
            </div>
            <div className="feed-list">
                <AnimatePresence initial={false}>
                    {events.map((e) => (
                        <motion.div
                            key={e.id}
                            initial={{ opacity: 0, x: -20, height: 0 }}
                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`feed-item ${e.type}`}
                        >
                            <span className="feed-time">{e.time}</span>
                            <span className="feed-msg">{e.msg}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

// Innovation card component
const InnovationCard = ({ number, title, description, icon: Icon }) => (
    <motion.div
        className="innovation-card"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        whileHover={{ scale: 1.03 }}
    >
        <div className="innovation-number">{number}</div>
        <Icon className="innovation-icon" size={40} />
        <h4>{title}</h4>
        <p>{description}</p>
    </motion.div>
);

export default function Broadcast() {
    const { scrollYProgress } = useScroll();
    const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

    // Preview Interaction State
    const [previewMode, setPreviewMode] = useState('agentic'); // agentic | mlops
    const [activeDashboard, setActiveDashboard] = useState('agentic');
    const [activeTab, setActiveTab] = useState('Overview');

    const agenticFeatures = [
        { icon: Brain, title: "Cognitive Swarms", description: "Agents that don't just follow rules—they understand context, adapt to payer behavior, and solve problems autonomously.", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
        { icon: Users, title: "Collaborative Intelligence", description: "Algorithms that know when to ask for help. Seamless human-AI handoffs ensure 100% accuracy on critical tasks.", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
        { icon: Clock, title: "Infinite Uptime", description: "A workforce that never sleeps. Process thousands of claims while your team rests, ready for approval by morning.", gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }
    ];

    const mlopsFeatures = [
        { icon: TrendingUp, title: "Predictive Immunity", description: "Systems that sense failure before it happens. Drift detection triggers retraining automatically.", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
        { icon: Shield, title: "Clinical-Grade Stability", description: "Confidence scores for every single prediction, ensuring AI never hallucinates on patient data.", gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
        { icon: Target, title: "Challenger Evolution", description: "Constant A/B testing in the background to evolve better models without risking production stability.", gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" }
    ];

    const renderPreviewContent = () => {
        if (previewMode === 'mlops') {
            switch (activeTab) {
                case 'System Health':
                    return (
                        <div className="preview-main">
                            <div className="preview-cards">
                                <div className="preview-card green"><Activity size={20} /><span>API Uptime</span><strong>99.99%</strong></div>
                                <div className="preview-card blue"><Server size={20} /><span>Latency</span><strong>42ms</strong></div>
                            </div>
                            <div className="preview-list-header">
                                <span>Service</span><span>Status</span><span>Repplicas</span><span>CPU</span>
                            </div>
                            <div className="preview-list-body">
                                {[
                                    { svc: 'Inference-A', status: 'Healthy', rep: '5/5', cpu: '45%' },
                                    { svc: 'Inference-B', status: 'Healthy', rep: '3/3', cpu: '32%' },
                                    { svc: 'Data-Ingest', status: 'Healthy', rep: '2/2', cpu: '12%' },
                                    { svc: 'Drift-Mon', status: 'Healthy', rep: '1/1', cpu: '8%' }
                                ].map((s, i) => (
                                    <div key={i} className="preview-list-row">
                                        <span>{s.svc}</span><span style={{ color: '#4ade80' }}>● {s.status}</span><span>{s.rep}</span><span>{s.cpu}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                case 'Performance':
                    return (
                        <div className="preview-main">
                            <div className="preview-cards">
                                <div className="preview-card blue"><Zap size={20} /><span>Total Preds</span><strong>1.2M</strong></div>
                                <div className="preview-card green"><CheckCircle size={20} /><span>Accuracy</span><strong>98.2%</strong></div>
                            </div>
                            <div className="preview-chart-mini">
                                {/* Simulated Performance Graph */}
                                <div style={{ display: 'flex', alignItems: 'flex-end', height: '100px', gap: '4px' }}>
                                    {[60, 65, 70, 68, 72, 75, 80, 85, 82, 88, 90, 92, 95, 94, 98].map((h, i) => (
                                        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: i * 0.05 }}
                                            style={{ flex: 1, background: i > 10 ? '#4ade80' : '#3b82f6', borderRadius: '2px' }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                default: // Overview
                    return (
                        <div className="preview-main">
                            <div className="preview-list-header">
                                <span>Model Name</span><span>Version</span><span>Drift</span><span>Status</span>
                            </div>
                            <div className="preview-list-body">
                                {[
                                    { name: 'Viral_Pred_v1', ver: 'v2.1.0', drift: '0.04', status: 'Healthy', color: '#22c55e' },
                                    { name: 'Cardiac_Risk', ver: 'v1.0.5', drift: '0.12', status: 'Retraining', color: '#eab308' },
                                    { name: 'Claims_NLP', ver: 'v3.2.0', drift: '0.01', status: 'Healthy', color: '#22c55e' },
                                    { name: 'Readmission_X', ver: 'v0.9.beta', drift: 'N/A', status: 'Deploying', color: '#3b82f6' }
                                ].map((m, i) => (
                                    <motion.div key={i} className="preview-list-row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                                        <span className="p-name">{m.name}</span><span className="p-ver">{m.ver}</span><span className="p-drift">{m.drift}</span><span className="p-status" style={{ color: m.color }}>● {m.status}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    );
            }
        } else { // Agentic
            switch (activeTab) {
                case 'Status':
                    return (
                        <div className="preview-main">
                            <div className="preview-cards">
                                <div className="preview-card green"><CheckCircle size={20} /><span>Job Success</span><strong>100%</strong></div>
                                <div className="preview-card blue"><Clock size={20} /><span>Avg Time</span><strong>1.2s</strong></div>
                            </div>
                            <div className="preview-list-header">
                                <span>Job ID</span><span>Agent</span><span>Task</span><span>Duration</span>
                            </div>
                            <div className="preview-list-body">
                                {[
                                    { id: '#9921', agent: 'Auth-Bot-1', task: 'Verify CPT', time: '0.8s' },
                                    { id: '#9922', agent: 'Claim-Bot-4', task: 'Submit HCFA', time: '1.4s' },
                                    { id: '#9923', agent: 'Appeal-Bot-2', task: 'Gen Letter', time: '1.2s' },
                                    { id: '#9924', agent: 'Auth-Bot-1', task: 'Check Status', time: '0.5s' }
                                ].map((j, i) => (
                                    <div key={i} className="preview-list-row">
                                        <span>{j.id}</span><span>{j.agent}</span><span>{j.task}</span><span>{j.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                case 'Clients':
                    return (
                        <div className="preview-main">
                            <div className="preview-list-header">
                                <span>Client</span><span>Active Agents</span><span>Daily Vol</span><span>SLA</span>
                            </div>
                            <div className="preview-list-body">
                                {[
                                    { name: 'Mount Sinai', agents: '45', vol: '12k', sla: '99.9%' },
                                    { name: 'NYU Langone', agents: '32', vol: '8k', sla: '99.8%' },
                                    { name: 'Mayo Clinic', agents: '28', vol: '6k', sla: '100%' },
                                    { name: 'Cleveland', agents: '50', vol: '15k', sla: '99.5%' }
                                ].map((c, i) => (
                                    <div key={i} className="preview-list-row">
                                        <span>{c.name}</span><span>{c.agents}</span><span>{c.vol}</span><span style={{ color: '#4ade80' }}>{c.sla}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                default: // Overview
                    return (
                        <div className="preview-main">
                            <div className="preview-list-header">
                                <span>Client</span><span>Payor</span><span>Action</span><span>Status</span>
                            </div>
                            <div className="preview-list-body">
                                {[
                                    { client: 'Mount Sinai', payor: 'UHC', action: 'Claim_Sub_881', status: 'Active' },
                                    { client: 'NYU Langone', payor: 'Aetna', action: 'Elig_Verify', status: 'Success' },
                                    { client: 'Cleveland Cl', payor: 'Cigna', action: 'Auth_Req_992', status: 'Processing' },
                                    { client: 'Mayo Clinic', payor: 'BCBS', action: 'Denial_Appeal', status: 'Queued' }
                                ].map((a, i) => (
                                    <motion.div key={i} className="preview-list-row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                                        <span className="p-client">{a.client}</span><span className="p-payor">{a.payor}</span><span className="p-action">{a.action}</span><span className="p-status-badge">{a.status}</span>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="preview-footer-stats">
                                <div><Activity size={14} /> <span>Active Swarms: 12</span></div>
                                <div><Zap size={14} /> <span>Throughput: 140 tps</span></div>
                            </div>
                        </div>
                    );
            }
        }
    };

    return (
        <div className="broadcast-page">
            {/* 1. HERO SECTION - UNIFIED */}
            {/* 1. HERO SECTION - UNIFIED */}
            <section className="hero-section unified-hero">
                {/* <FloatingParticles /> */}
                <div className="hero-content" style={{ y }}>
                    <div className="hero-badge">
                        <Sparkles size={16} /> <span>Platform Release 3.0</span>
                    </div>
                    <h1 className="hero-title-static">
                        The <span className="gradient-text">Convergence</span>
                        <br /><span className="hero-subtitle">of Intelligence</span>
                    </h1>
                    <p className="hero-description huge">
                        Unifying <strong>Autonomous Agent Swarms</strong> and <strong>Predictive MLOps</strong> into a single, commanding nervous system for healthcare operations.
                    </p>

                    <div className="hero-buttons" style={{ marginTop: '30px', opacity: 1 }}>
                        <button
                            className={`btn-primary ${activeDashboard === 'agentic' ? 'active-dash-btn' : ''}`}
                            onClick={() => { setActiveDashboard('agentic'); setActiveTab('Overview'); }}
                        >
                            <Brain size={18} />
                            Agentic Dashboard
                        </button>
                        <button
                            className={`btn-secondary ${activeDashboard === 'mlops' ? 'active-dash-btn' : ''}`}
                            onClick={() => { setActiveDashboard('mlops'); setActiveTab('Overview'); }}
                        >
                            <TrendingUp size={18} />
                            MLOps Observatory
                        </button>
                    </div>

                    <div
                        style={{ marginTop: '40px', width: '100%', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10, opacity: 1 }}
                    >
                        <LiveActivityFeed />
                    </div>
                    <div className="hero-scroll-indicator">
                        <span>Discover the Power</span>
                        <ArrowRight size={20} style={{ transform: 'rotate(90deg)' }} />
                    </div>
                </div>
                <div className="orb orb-center"></div>
            </section>

            {/* 2. AGENTIC DOMAIN */}
            <section className="domain-section agentic-domain">
                <div className="domain-content left">
                    <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                        <div className="domain-label"><Brain size={18} /> Agentic Authority</div>
                        <h2>Autonomous <span className="gradient-text-purple">Workflow Engine</span></h2>
                        <p className="domain-desc">
                            Orchestrate independent agent swarms that handle complex payer interactions, retain context across long sessions, and self-heal when errors occur.
                        </p>
                        <div className="domain-stats">
                            <div className="d-stat"><strong>150+</strong><span>Active Agents</span></div>
                            <div className="d-stat"><strong>9.2k</strong><span>Daily Actions</span></div>
                            <div className="d-stat"><strong>98.5%</strong><span>Success Rate</span></div>
                        </div>
                    </motion.div>
                </div>
                <div className="domain-visual right">
                    <div className="features-grid compact">
                        {agenticFeatures.map((f, i) => <FeatureCard key={i} {...f} delay={i * 0.1} />)}
                    </div>
                </div>
            </section>

            {/* 3. MLOPS DOMAIN */}
            <section className="domain-section mlops-domain">
                <div className="domain-visual left">
                    <div className="features-grid compact">
                        {mlopsFeatures.map((f, i) => <FeatureCard key={i} {...f} delay={i * 0.1} />)}
                    </div>
                </div>
                <div className="domain-content right">
                    <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                        <div className="domain-label"><TrendingUp size={18} /> ML Observatory</div>
                        <h2>Precision <span className="gradient-text-blue">at Scale</span></h2>
                        <p className="domain-desc">
                            A complete operational nervous system for your models. Real-time drift detection, stability scoring, and predictive incident alerts.
                        </p>
                        <div className="domain-stats">
                            <div className="d-stat"><strong>50+</strong><span>Live Models</span></div>
                            <div className="d-stat"><strong>45ms</strong><span>Avg Latency</span></div>
                            <div className="d-stat"><strong>99.9%</strong><span>Uptime SLA</span></div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* 4. INTERACTIVE PREVIEW */}
            <section className="preview-section-large">
                <div className="section-header">
                    <h2>Command <span className="gradient-text">Your Console</span></h2>
                    <p>Experience the unified interface designed for total operational control.</p>
                </div>

                <div className="console-toggle-container">
                    <button className={`console-toggle ${previewMode === 'agentic' ? 'active' : ''}`} onClick={() => setPreviewMode('agentic')}>
                        <Brain size={16} /> Agent View
                    </button>
                    <button className={`console-toggle ${previewMode === 'mlops' ? 'active' : ''}`} onClick={() => setPreviewMode('mlops')}>
                        <TrendingUp size={16} /> MLOps View
                    </button>
                </div>

                <motion.div className="preview-container large-preview holographic-border" layout>
                    <div className="preview-header">
                        <div className="preview-title">IKS Command Center // {previewMode === 'agentic' ? 'Agent Swarm' : 'Model Observatory'}</div>
                        <div className="preview-controls">
                            <span className="control minimize"></span><span className="control maximize"></span><span className="control close"></span>
                        </div>
                    </div>
                    <div className="preview-content">
                        <div className="preview-sidebar">
                            {(previewMode === 'agentic' ? ['Overview', 'Status', 'Clients'] : ['Overview', 'System Health', 'Performance']).map(item => (
                                <div key={item} className={`preview-menu-item ${activeTab === item ? 'active' : ''}`} onClick={() => setActiveTab(item)}>
                                    {item}
                                </div>
                            ))}
                        </div>
                        <div className="preview-body-container">
                            <AnimatePresence mode='wait'>
                                <motion.div
                                    key={previewMode + activeTab}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="preview-body"
                                >
                                    {renderPreviewContent()}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* 5. CAPABILITIES LIVE MATRIX */}
            <section className="capabilities-section">
                <div className="section-header">
                    <h2>Platform <span className="gradient-text">Matrix</span></h2>
                    <p>Live operational capabilities across the stack.</p>
                </div>
                <div className="capabilities-grid">
                    <div className="cap-card">
                        <div className="cap-icon-box blue"><Brain size={24} /></div>
                        <h3>Agentic Swarm</h3>
                        <div className="cap-stat-row">
                            <span>Active Bots</span><strong>142</strong>
                        </div>
                        <div className="cap-stat-row">
                            <span>Success Rate</span><strong className="text-green">99.8%</strong>
                        </div>
                        <p>Automated HCFA submission & context-aware patient interaction.</p>
                    </div>
                    <div className="cap-card">
                        <div className="cap-icon-box purple"><Building size={24} /></div>
                        <h3>Payor Gateway</h3>
                        <div className="cap-stat-row">
                            <span>Portals</span><strong>15+</strong>
                        </div>
                        <div className="cap-stat-row">
                            <span>Latency</span><strong>~1.4s</strong>
                        </div>
                        <p>Direct API integration with United, Aetna, Cigna, & BCBS.</p>
                    </div>
                    <div className="cap-card">
                        <div className="cap-icon-box green"><TrendingUp size={24} /></div>
                        <h3>MLOps Engine</h3>
                        <div className="cap-stat-row">
                            <span>Daily Preds</span><strong>1.2M</strong>
                        </div>
                        <div className="cap-stat-row">
                            <span>Drift</span><strong className="text-green">0.02%</strong>
                        </div>
                        <p>Real-time clinical risk scoring & claims denial prediction.</p>
                    </div>
                    <div className="cap-card">
                        <div className="cap-icon-box orange"><Shield size={24} /></div>
                        <h3>Security Core</h3>
                        <div className="cap-stat-row">
                            <span>Encryption</span><strong>AES-256</strong>
                        </div>
                        <div className="cap-stat-row">
                            <span>Audit Log</span><strong>Enabled</strong>
                        </div>
                        <p>HIPAA-compliant infrastructure with MFA & RBAC enforcement.</p>
                    </div>
                    <div className="cap-card">
                        <div className="cap-icon-box pink"><Zap size={24} /></div>
                        <h3>Performance</h3>
                        <div className="cap-stat-row">
                            <span>Uptime</span><strong>99.99%</strong>
                        </div>
                        <div className="cap-stat-row">
                            <span>Scale</span><strong>Auto</strong>
                        </div>
                        <p>Kubernetes-based auto-scaling for peak load management.</p>
                    </div>
                    <div className="cap-card">
                        <div className="cap-icon-box cyan"><Database size={24} /></div>
                        <h3>GCP Integration</h3>
                        <div className="cap-stat-row">
                            <span>Ingest</span><strong>Pub/Sub</strong>
                        </div>
                        <div className="cap-stat-row">
                            <span>Storage</span><strong>BigQuery</strong>
                        </div>
                        <p>Real-time authorized data streams via Google Cloud Platform.</p>
                    </div>
                </div>
            </section>

            {/* 6. DUAL-CORE ARCHITECTURE */}
            <section className="architecture-section">
                <div className="section-header">
                    <h2>System <span className="gradient-text">Architecture</span></h2>
                    <p>Dual-core processing pipeline with sandbox validation.</p>
                </div>

                <div className="arch-container">
                    {/* Layer 1: Ingestion */}
                    <div className="arch-layer">
                        <div className="arch-node gcp">
                            <Database size={32} />
                            <span>GCP Data Lake</span>
                            <small>FHIR / HL7 Streams</small>
                        </div>
                        <div className="arch-flow-arrow down"></div>
                    </div>

                    {/* Layer 2: The Split */}
                    <div className="arch-split-container">
                        <div className="arch-branch left">
                            <div className="arch-label">Operational Workflow</div>
                            <div className="arch-node agentic">
                                <Brain size={32} />
                                <span>Agentic Swarm</span>
                                <small>Auth • Claims • Appeals</small>
                            </div>
                        </div>

                        <div className="arch-center-logic">
                            <div className="pulse-hub"></div>
                        </div>

                        <div className="arch-branch right">
                            <div className="arch-label">Model Oversight</div>
                            <div className="arch-node mlops">
                                <Activity size={32} />
                                <span>MLOps Engine</span>
                                <small>Drift • Risk • Audit</small>
                            </div>
                        </div>
                    </div>

                    {/* Layer 3: Sandbox Loop */}
                    <div className="arch-sandbox-loop">
                        <div className="sandbox-line"></div>
                        <div className="arch-node sandbox">
                            <AlertTriangle size={24} />
                            <span>Validation Sandbox</span>
                            <small>Pre-Production Check</small>
                        </div>
                        <div className="sandbox-line"></div>
                    </div>

                    {/* Layer 4: Response */}
                    <div className="arch-layer">
                        <div className="arch-flow-arrow down"></div>
                        <div className="arch-node resolve">
                            <CheckCircle size={32} />
                            <span>Resolution Core</span>
                            <small>Payor Portal Write-Back</small>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. DEPLOYMENT GUIDE */}
            <section className="deployment-section">
                <div className="section-header">
                    <h2>Ready for <span className="gradient-text">Production</span></h2>
                    <p>Deploy the entire swarm in two simple steps.</p>
                </div>
                <div className="deployment-card">
                    <div className="step-block">
                        <div className="step-label">Step 1: Configure Environment</div>
                        <p>Create a <code>.env</code> file with your platform credentials.</p>
                        <div className="code-block">
                            <div className="code-line"><span className="c-key">IKS_API_KEY</span>=<span className="c-val">your_api_key_here</span></div>
                            <div className="code-line"><span className="c-key">PAYOR_GATEWAY_URL</span>=<span className="c-val">https://gateway.iks-health.com/v2</span></div>
                        </div>
                    </div>
                    <div className="step-block">
                        <div className="step-label">Step 2: Launch Swarm Container</div>
                        <p>Run the automation with a single Docker command.</p>
                        <div className="code-block terminal">
                            <div className="code-line">$ docker run -d --name iks-swarm -p 9012:9012 --env-file .env iks-intelligence-core</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 8. CTA */}
            <section className="cta-section landing-cta">
                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                    <h2>One Platform. Infinite Intelligence.</h2>
                    <div className="cta-buttons">
                        <Link to="/dashboard/agentic" className="btn-primary large"><Brain size={20} /> Launch Agent Console</Link>
                        <Link to="/dashboard/mlops" className="btn-secondary large"><TrendingUp size={20} /> Launch MLOps Console</Link>
                    </div>
                </motion.div>
            </section>

            <footer className="broadcast-footer">
                <div className="footer-content">
                    <div className="footer-logo">
                        <Layers size={24} /> <span>IKS Intelligence Platform</span>
                    </div>
                    <p>© 2026 IKS Health. Innovation in Action.</p>
                </div>
            </footer>
        </div >
    );
}
