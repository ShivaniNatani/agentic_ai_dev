import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import './VoiceAssistant.css'

/**
 * VoiceAssistant
 *
 * Dual-mode voice component:
 *   1. Standalone Mode (default): Renders its own floating orb button and handles
 *      navigation commands (go to dashboard, toggle theme, etc.).
 *   2. Embedded Mode (onVoiceInput prop): Renders nothing visible on its own.
 *      Instead, it exposes startListening() via the ref, and passes the final
 *      transcript back to the parent through onVoiceInput(text).
 *
 * Props:
 *   - onVoiceInput: (text: string) => void   — If provided, operates in embedded mode.
 *   - embedded: boolean                      — If true, renders nothing (parent controls UI).
 */
export default function VoiceAssistant({ onVoiceInput, embedded = false, micRef }) {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [showPopover, setShowPopover] = useState(false)
    const recognitionRef = useRef(null)
    const navigate = useNavigate()
    const { toggleTheme } = useTheme()

    // Expose listening state up for parent styling
    const isEmbedded = !!onVoiceInput || embedded

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = false
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = 'en-US'

            recognitionRef.current.onstart = () => {
                setIsListening(true)
                setShowPopover(true)
                setTranscript('')
            }

            recognitionRef.current.onresult = (event) => {
                const current = event.resultIndex
                const transcriptText = event.results[current][0].transcript
                setTranscript(transcriptText)
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
                // Hide popover after delay
                setTimeout(() => setShowPopover(false), 3000)
            }

            recognitionRef.current.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error)
                setIsListening(false)

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
                    setTranscript("Mic blocked/unavailable. Switching to Demo Mode...")
                    setShowPopover(true)
                    setTimeout(() => simulateVoice(), 1500)
                } else {
                    setTranscript(`Error: ${event.error}`)
                    setShowPopover(true)
                }
            }
        }
    }, [])

    const startListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start()
            } catch (e) {
                console.error("Mic already active")
            }
        } else {
            // Fallback Simulation for environments without Mic
            simulateVoice()
        }
    }, [])

    // Expose startListening to parent via micRef
    useEffect(() => {
        if (micRef) {
            micRef.current = { startListening, isListening }
        }
    }, [micRef, startListening, isListening])

    const simulateVoice = () => {
        setIsListening(true)
        setShowPopover(true)
        setTranscript('Listening...')

        const commands = isEmbedded
            ? ["What is the total billed this month?", "Compare January vs February", "Show me denial trends"]
            : ["Switch to Light Mode", "Go to Dashboard", "Open Releases"]
        const randomCmd = commands[Math.floor(Math.random() * commands.length)]

        setTimeout(() => setTranscript(randomCmd.substring(0, 5)), 500)
        setTimeout(() => setTranscript(randomCmd.substring(0, 10)), 1000)
        setTimeout(() => setTranscript(randomCmd), 1500)

        setTimeout(() => {
            setIsListening(false)
            if (isEmbedded && onVoiceInput) {
                onVoiceInput(randomCmd)
            } else {
                processCommand(randomCmd)
            }
            setTimeout(() => setShowPopover(false), 3000)
        }, 2000)
    }

    // When listening ends with a real transcript, route it
    useEffect(() => {
        if (!isListening && transcript && transcript !== 'Listening...') {
            if (isEmbedded && onVoiceInput) {
                onVoiceInput(transcript)
            } else {
                processCommand(transcript)
            }
        }
    }, [isListening])

    const processCommand = (cmd) => {
        const lower = cmd.toLowerCase()
        if (lower.includes('dashboard') || lower.includes('home')) {
            navigate('/dashboard')
        } else if (lower.includes('light') || lower.includes('white')) {
            toggleTheme()
        } else if (lower.includes('dark') || lower.includes('black')) {
            toggleTheme()
        } else if (lower.includes('release') || lower.includes('notes')) {
            navigate('/releases')
        } else if (lower.includes('agent')) {
            navigate('/agents')
        }
    }

    // In embedded mode, render nothing — parent controls the UI
    if (isEmbedded) {
        return null
    }

    // Standalone mode: render the floating orb
    return (
        <div className="voice-orb-container">
            {showPopover && (
                <div className="transcript-popover">
                    <div className="transcript-text">
                        {transcript || 'Listening...'}
                    </div>
                    {isListening && <div className="transcript-listening">Processing...</div>}
                </div>
            )}

            <button
                className={`voice-orb-btn ${isListening ? 'listening' : ''}`}
                onClick={startListening}
                title="Speak to Agent"
            >
                {isListening ? '🎙️' : '🎙️'}
                {isListening && <div className="voice-ripple"></div>}
                {isListening && <div className="voice-ripple"></div>}
            </button>
        </div>
    )
}
