// cookie-notice.js

document.addEventListener("DOMContentLoaded", () => {
    // Verificar si ya aceptó las cookies
    if (!localStorage.getItem('cookiesAccepted')) {
        const cookieBanner = document.createElement('div');
        cookieBanner.id = 'cookie-banner';
        cookieBanner.innerHTML = `
            <div style="flex: 1;">
                <strong>Privacidad y Cookies:</strong> 
                Usamos cookies y almacenamiento local para mantener tu sesión activa, recordar tu carrito de compras y mejorar tu experiencia. 
                Al continuar, aceptas nuestra política de privacidad.
            </div>
            <button id="acceptCookiesBtn" style="
                background: var(--hp-pink); 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 8px; 
                font-weight: 700; 
                cursor: pointer;
                white-space: nowrap;
            ">Aceptar</button>
        `;
        
        // Estilos del banner
        Object.assign(cookieBanner.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            width: '100%',
            background: 'var(--surface-color, #1a1a1a)',
            color: 'var(--text-color, #fff)',
            borderTop: '1px solid var(--border-color, #333)',
            padding: '15px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            boxSizing: 'border-box',
            zIndex: '9999',
            boxShadow: '0 -4px 10px rgba(0,0,0,0.2)',
            fontSize: '14px',
            fontFamily: "'Outfit', sans-serif"
        });

        document.body.appendChild(cookieBanner);

        document.getElementById('acceptCookiesBtn').addEventListener('click', () => {
            localStorage.setItem('cookiesAccepted', 'true');
            cookieBanner.style.display = 'none';
        });
    }
});
