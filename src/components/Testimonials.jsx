import './Testimonials.css'

const testimonials = [
    {
        quote: "UnitedHealthcare has done an amazing job of providing documentation, resources and qualified people in their API department. As some companies do not even have a test environment or support, UnitedHealthcare has exceeded any expectations.",
        author: "Healthcare Provider"
    },
    {
        quote: "Love the API claim status service. Claim status programs that used to take us 5 hours over 2 days to run, now take about 20 minutes to run the same transaction and get the same data. We will be seeking additional API services with UnitedHealthcare.",
        author: "Medical Practice Manager"
    }
]

function Testimonials() {
    return (
        <section id="testimonials" className="testimonials section">
            <div className="container">
                <div className="testimonials__header">
                    <h2 className="section-title">What Our Users Say</h2>
                    <p className="section-subtitle">
                        Hear from healthcare professionals who have transformed their operations with our API
                    </p>
                </div>

                <div className="testimonials__grid">
                    {testimonials.map((item, index) => (
                        <div
                            key={index}
                            className="testimonials__card"
                            style={{ animationDelay: `${index * 0.2}s` }}
                        >
                            <div className="testimonials__quote-icon">"</div>
                            <blockquote className="testimonials__quote">
                                {item.quote}
                            </blockquote>
                            <div className="testimonials__author">
                                <div className="testimonials__avatar">
                                    {item.author[0]}
                                </div>
                                <span className="testimonials__name">{item.author}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Testimonials
