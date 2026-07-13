function renderCreditGauge(containerId, score, history) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Normalize score to 0-100
    const val = Math.max(0, Math.min(100, score || 0));

    // Calculate angle for needle (0 to 180 degrees)
    const angle = (val / 100) * 180;

    // Format score color based on zones
    let scoreColor = '#eb5757'; // 0-40
    if (val >= 40 && val < 65) scoreColor = '#f2994a'; // 40-65
    if (val >= 65 && val < 85) scoreColor = '#3b82f6'; // 65-85
    if (val >= 85) scoreColor = '#27ae60'; // 85-100

    let html = `
        <div style="position: relative; width: 100%; max-width: 250px; margin: 0 auto;">
            <svg viewBox="0 0 200 120" style="width: 100%; height: auto;">
                <!-- Zones -->
                <!-- 0-40 (Red) -->
                <path d="M 20 100 A 80 80 0 0 1 54.3 27.6" fill="none" stroke="#eb5757" stroke-width="15" stroke-linecap="butt" />
                <!-- 40-65 (Orange) -->
                <path d="M 54.3 27.6 A 80 80 0 0 1 124.6 24.3" fill="none" stroke="#f2994a" stroke-width="15" stroke-linecap="butt" />
                <!-- 65-85 (Blue) -->
                <path d="M 124.6 24.3 A 80 80 0 0 1 166.3 53.1" fill="none" stroke="#3b82f6" stroke-width="15" stroke-linecap="butt" />
                <!-- 85-100 (Green) -->
                <path d="M 166.3 53.1 A 80 80 0 0 1 180 100" fill="none" stroke="#27ae60" stroke-width="15" stroke-linecap="butt" />
                
                <!-- Needle -->
                <g transform="translate(100, 100) rotate(${angle - 90})">
                    <polygon points="-4,0 4,0 0,-70" fill="currentColor" style="color: var(--text-color, #fff);" />
                    <circle cx="0" cy="0" r="8" fill="currentColor" style="color: var(--text-color, #fff);" />
                    <circle cx="0" cy="0" r="3" fill="var(--bg-color, #1a1a1a)" />
                </g>

                <!-- Center Text -->
                <text x="100" y="90" text-anchor="middle" font-size="28" font-weight="900" fill="${scoreColor}" font-family="Outfit, sans-serif">${val}</text>
                <text x="100" y="110" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text-muted, #9ca3af)" font-family="Outfit, sans-serif">PUNTAJE</text>
            </svg>
    `;

    // Trend line if history is provided
    if (history && history.length > 0) {
        // Find recent deltas
        const lastDelta = history[history.length - 1].delta;
        const trendIcon = lastDelta > 0 ? '↗️' : (lastDelta < 0 ? '↘️' : '➡️');
        const trendColor = lastDelta > 0 ? '#27ae60' : (lastDelta < 0 ? '#eb5757' : 'var(--text-muted, #9ca3af)');
        const trendText = lastDelta > 0 ? `+${lastDelta}` : lastDelta;
        
        html += `
            <div style="text-align: center; margin-top: -10px;">
                <span style="font-size: 13px; font-weight: 700; color: ${trendColor}; background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 10px;">
                    ${trendIcon} ${trendText} pts reciente
                </span>
            </div>
        `;
    }

    html += `</div>`;
    
    container.innerHTML = html;
}
window.renderCreditGauge = renderCreditGauge;
