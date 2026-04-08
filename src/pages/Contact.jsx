import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Contact.css'

function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        subject: '',
        message: ''
    })
    const [submitted, setSubmitted] = useState(false)
    const [newsletterEmail, setNewsletterEmail] = useState('')
    const [subscribed, setSubscribed] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        // Simulate form submission
        setTimeout(() => {
            setSubmitted(true)
            setFormData({ name: '', email: '', company: '', subject: '', message: '' })
        }, 800)
    }

    const handleNewsletter = (e) => {
        e.preventDefault()
        setTimeout(() => {
            setSubscribed(true)
            setNewsletterEmail('')
        }, 500)
    }

    return (
        <div className="contact">
            <section className="contact__hero">
                <div className="contact__hero-bg"></div>
                <div className="container">
                    <h1 className="contact__title">
                        <span className="contact__icon">📬</span>
                        Contact Us
                    </h1>
                    <p className="contact__description">
                        Have questions about our AI Agents? Our team is here to help you get started.
                    </p>
                </div>
            </section>

            <section className="contact__content section">
                <div className="container">
                    <div className="contact__grid">
                        <div className="contact__form-section">
                            <div className="contact__card glass-card">
                                <h3>Send us a Message</h3>

                                {submitted ? (
                                    <div className="contact__success">
                                        <span className="contact__success-icon">✅</span>
                                        <h4>Message Sent!</h4>
                                        <p>We'll get back to you within 24 hours.</p>
                                        <button
                                            className="btn btn-outline"
                                            onClick={() => setSubmitted(false)}
                                        >
                                            Send Another Message
                                        </button>
                                    </div>
                                ) : (
                                    <form className="contact__form" onSubmit={handleSubmit}>
                                        <div className="contact__form-row">
                                            <div className="contact__field">
                                                <label>Name *</label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    placeholder="Your name"
                                                    required
                                                />
                                            </div>
                                            <div className="contact__field">
                                                <label>Email *</label>
                                                <input
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    placeholder="you@company.com"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="contact__form-row">
                                            <div className="contact__field">
                                                <label>Company</label>
                                                <input
                                                    type="text"
                                                    value={formData.company}
                                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                                    placeholder="Your company"
                                                />
                                            </div>
                                            <div className="contact__field">
                                                <label>Subject *</label>
                                                <select
                                                    value={formData.subject}
                                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Select a topic</option>
                                                    <option value="sales">Sales Inquiry</option>
                                                    <option value="support">Technical Support</option>
                                                    <option value="partnership">Partnership</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="contact__field">
                                            <label>Message *</label>
                                            <textarea
                                                value={formData.message}
                                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                                placeholder="Tell us how we can help..."
                                                rows={5}
                                                required
                                            />
                                        </div>

                                        <button type="submit" className="btn btn-primary">
                                            Send Message
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        <div className="contact__sidebar">
                            <div className="contact__info-card glass-card">
                                <h4>Get in Touch</h4>
                                <div className="contact__info-list">
                                    <div className="contact__info-item">
                                        <span className="contact__info-icon">📧</span>
                                        <div>
                                            <strong>Email</strong>
                                            <p>support@aiagents.com</p>
                                        </div>
                                    </div>
                                    <div className="contact__info-item">
                                        <span className="contact__info-icon">📞</span>
                                        <div>
                                            <strong>Phone</strong>
                                            <p>1-800-AI-AGENT</p>
                                        </div>
                                    </div>
                                    <div className="contact__info-item">
                                        <span className="contact__info-icon">🕐</span>
                                        <div>
                                            <strong>Hours</strong>
                                            <p>Mon-Fri 9AM-6PM EST</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="contact__newsletter glass-card">
                                <h4>📰 Newsletter</h4>
                                <p>Subscribe to get updates on new features and release notes.</p>

                                {subscribed ? (
                                    <div className="contact__subscribed">
                                        ✅ You're subscribed!
                                    </div>
                                ) : (
                                    <form className="contact__newsletter-form" onSubmit={handleNewsletter}>
                                        <input
                                            type="email"
                                            value={newsletterEmail}
                                            onChange={(e) => setNewsletterEmail(e.target.value)}
                                            placeholder="Enter your email"
                                            required
                                        />
                                        <button type="submit" className="btn btn-primary">
                                            Subscribe
                                        </button>
                                    </form>
                                )}
                            </div>

                            <div className="contact__links glass-card">
                                <h4>Quick Links</h4>
                                <nav>
                                    <Link to="/agents">View AI Agents</Link>
                                    <Link to="/setup">Setup Guide</Link>
                                    <Link to="/release-notes">Release Notes</Link>
                                </nav>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default Contact
