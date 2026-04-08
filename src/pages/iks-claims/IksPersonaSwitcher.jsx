/**
 * Persona switcher pill — Ops Manager | Sr. Leader | Work Plan
 * Sits between the header row and the main content area.
 */
export default function IksPersonaSwitcher({ persona, setPersona }) {
    return (
        <div className="iks-persona-bar">
            <span className="iks-persona-eyebrow">View as</span>
            <div className="iks-persona-switch">
                <button
                    type="button"
                    className={persona === 'ops-manager' ? 'active' : ''}
                    onClick={() => setPersona('ops-manager')}
                >
                    Ops Manager
                </button>
                <button
                    type="button"
                    className={persona === 'sr-leader' ? 'active' : ''}
                    onClick={() => setPersona('sr-leader')}
                >
                    Sr. Leader
                </button>
                <button
                    type="button"
                    className={persona === 'work-plan' ? 'active' : ''}
                    onClick={() => setPersona('work-plan')}
                >
                    Work Plan
                </button>
            </div>
            <span className="iks-persona-desc">
                {persona === 'ops-manager'
                    ? 'Daily operational view — inventory, resolution, efficiency & cash'
                    : persona === 'sr-leader'
                        ? 'Strategic ROI view — automation, model trust & financial health'
                        : 'Execution planning view — today vs later split, quick notes and payer distribution'}
            </span>
        </div>
    )
}
