function renderCreditGauge(containerId, score, history) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const val = Math.max(0, Math.min(100, score || 0));
    const gradId = `hcGaugeGrad-${containerId}`;
    const glowId = `hcGaugeGlow-${containerId}`;

    // Colores de marca Happy Corner (calidos -> verde suave al final,
    // para mantener la lectura universal de "riesgo -> excelente")
    let scoreColor = '#f2735c'; // D - coral calido
    if (val >= 40 && val < 65) scoreColor = '#f7a335'; // C - Amber Glow (color de marca)
    if (val >= 65 && val < 85) scoreColor = '#ffb26b'; // B - durazno dorado
    if (val >= 85) scoreColor = '#4caf82'; // A - verde suave

    const tier = val >= 85 ? 'A' : val >= 65 ? 'B' : val >= 40 ? 'C' : 'D';

    // Matematica del arco semicircular (180deg = score 0, 0deg = score 100)
    function polarToCartesian(cx, cy, r, angleDeg) {
        const rad = (angleDeg * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
    }
    const cx = 100, cy = 100, r = 78;
    const scoreToAngle = (s) => 180 - (s / 100) * 180;
    const needleAngle = scoreToAngle(val);
    const needleTip = polarToCartesian(cx, cy, r - 20, needleAngle);
    const trackStart = polarToCartesian(cx, cy, r, 180);
    const trackEnd = polarToCartesian(cx, cy, r, 0);
    const fillEnd = polarToCartesian(cx, cy, r, needleAngle);
    const largeArcFill = (180 - needleAngle) > 180 ? 1 : 0;

    let html = `
      <div style="position: relative; width: 100%; max-width: 230px; margin: 0 auto; padding-bottom: 8px;">
           <svg viewBox="0 0 200 118" style="width: 100%; height: auto; overflow: visible; display:block; margin-bottom: -10px;">
                <defs>
                    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#f2735c" />
                        <stop offset="40%" stop-color="#f7a335" />
                        <stop offset="70%" stop-color="#ffb26b" />
                        <stop offset="100%" stop-color="#4caf82" />
                    </linearGradient>
                    <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="var(--hp-pink-glow, rgba(255,82,153,0.5))" />
                    </filter>
                </defs>

                <!-- Riel de fondo -->
                <path d="M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}"
                      fill="none" stroke="var(--border-color, rgba(255,255,255,0.08))" stroke-width="14" stroke-linecap="round" />

                <!-- Arco de progreso con gradiente de marca -->
                <path d="M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 ${largeArcFill} 1 ${fillEnd.x} ${fillEnd.y}"
                      fill="none" stroke="url(#${gradId})" stroke-width="14" stroke-linecap="round" filter="url(#${glowId})" />

                <!-- Aguja -->
                <g>
                    <line x1="${cx}" y1="${cy}" x2="${needleTip.x}" y2="${needleTip.y}"
                          stroke="var(--text-color, #fff)" stroke-width="3" stroke-linecap="round" />
                    <circle cx="${cx}" cy="${cy}" r="7" fill="var(--hp-pink, #ff5299)" />
                    <circle cx="${cx}" cy="${cy}" r="3" fill="var(--surface-color, #1a1a1a)" />
                </g>

                <!-- Texto central -->
                <text x="100" y="92" text-anchor="middle" font-size="30" font-weight="900" fill="${scoreColor}" font-family="Outfit, sans-serif">${val}</text>
                <text x="100" y="110" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-muted, #9ca3af)" font-family="Outfit, sans-serif" letter-spacing="0.5">DE 100 &middot; NIVEL ${tier}</text>
            </svg>
    `;

    if (history && history.length > 0) {
        let running = 20;
        const points = [{ value: 20 }];
        history.forEach(h => {
            running = Math.max(0, Math.min(100, running + (h.delta || h.change || 0)));
            points.push({ value: running });
        });

        const w = 200, h = 40, pad = 4;
        const stepX = (w - pad * 2) / (points.length - 1 || 1);
        const coords = points.map((p, i) => {
            const x = pad + i * stepX;
            const y = h - pad - ((p.value / 100) * (h - pad * 2));
            return `${x},${y}`;
        }).join(' ');

        html += `
            <div style="margin-top:10px;">
                <div style="font-size:10px; color:var(--text-muted, #9ca3af); font-weight:700; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Tendencia</div>
                <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:36px;">
                    <polyline points="${coords}" fill="none" stroke="var(--hp-pink, #ff5299)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}