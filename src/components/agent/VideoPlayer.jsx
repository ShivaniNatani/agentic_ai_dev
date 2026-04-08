import { useEffect, useMemo, useState } from 'react'
import './VideoPlayer.css'

function VideoPlayer({ agent, preferredVariantId, clientLabel }) {
    const variants = useMemo(() => {
        if (agent.videoVariants && agent.videoVariants.length) {
            return agent.videoVariants
        }
        if (agent.videoUrl) {
            return [{ id: 'default', label: agent.name, url: agent.videoUrl }]
        }
        return []
    }, [agent.name, agent.videoUrl, agent.videoVariants])

    const visibleVariants = useMemo(() => {
        if (preferredVariantId) {
            const match = variants.find((v) => v.id === preferredVariantId)
            return match ? [match] : variants
        }
        return variants
    }, [variants, preferredVariantId])

    const [activeVariantId, setActiveVariantId] = useState(visibleVariants[0]?.id)

    useEffect(() => {
        setActiveVariantId(visibleVariants[0]?.id)
    }, [visibleVariants])
    const activeVariant = visibleVariants.find((v) => v.id === activeVariantId) || visibleVariants[0]
    const hasVideo = Boolean(activeVariant?.url)
    const videoSrc = hasVideo ? encodeURI(activeVariant.url) : ''
    const showTabs = !preferredVariantId && visibleVariants.length > 1

    return (
        <div className="video-player">
            <div className="video-player__container">
                <div className="video-player__wrapper">
                    {showTabs ? (
                        <div className="video-player__variant-tabs">
                            {visibleVariants.map((variant) => (
                                <button
                                    key={variant.id}
                                    className={`video-player__variant-tab ${activeVariant?.id === variant.id ? 'is-active' : ''}`}
                                    onClick={() => setActiveVariantId(variant.id)}
                                >
                                    {variant.label}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {hasVideo && videoSrc ? (
                        <video
                            key={activeVariant?.id || 'video'}
                            className="video-player__video"
                            controls
                            controlsList="nodownload"
                            preload="metadata"
                        >
                            <source src={videoSrc} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    ) : (
                        <div className="video-player__placeholder">
                            <div className="video-player__play-btn">
                                <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                            <div className="video-player__overlay">
                                <span className="video-player__title">{agent.name}</span>
                                <span className="video-player__subtitle">Demo Video</span>
                            </div>
                            <div className="video-player__duration">Upload MP4 to /public/videos/agents</div>
                        </div>
                    )}
                </div>

                <div className="video-player__info">
                    <h3 className="video-player__heading">
                        <span className="video-player__icon">🎬</span>
                        Product Demo
                    </h3>
                    {clientLabel ? (
                        <p className="video-player__variant-label">
                            Client: {clientLabel}
                        </p>
                    ) : activeVariant?.label ? (
                        <p className="video-player__variant-label">
                            Client: {activeVariant.label}
                        </p>
                    ) : null}
                    <p className="video-player__description">
                        Watch a comprehensive demonstration of the {agent.name} in action.
                        This video covers the complete workflow from API request to response,
                        including real-world use cases and integration examples.
                    </p>

                    <div className="video-player__chapters">
                        <h4>Video Chapters</h4>
                        <ul className="video-player__chapter-list">
                            <li>
                                <span className="video-player__timestamp">0:00</span>
                                <span>Introduction & Overview</span>
                            </li>
                            <li>
                                <span className="video-player__timestamp">0:45</span>
                                <span>API Authentication Setup</span>
                            </li>
                            <li>
                                <span className="video-player__timestamp">1:30</span>
                                <span>Making Your First Request</span>
                            </li>
                            <li>
                                <span className="video-player__timestamp">2:15</span>
                                <span>Handling Responses</span>
                            </li>
                            <li>
                                <span className="video-player__timestamp">3:00</span>
                                <span>Error Handling & Best Practices</span>
                            </li>
                        </ul>
                    </div>

                    <div className="video-player__actions">
                        <a
                            className={`btn btn-primary ${hasVideo ? '' : 'btn-disabled'}`}
                            href={hasVideo ? videoSrc : undefined}
                            target={hasVideo ? '_blank' : undefined}
                            rel={hasVideo ? 'noreferrer' : undefined}
                            aria-disabled={hasVideo ? 'false' : 'true'}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                            {hasVideo ? 'Watch Full Demo' : 'Upload Demo to Enable'}
                        </a>
                        <button className="btn btn-outline">
                            Download Slides
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VideoPlayer
