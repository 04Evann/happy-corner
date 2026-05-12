import { initPromise, auth, onAuthStateChanged } from './firebase-auth.js';

document.addEventListener("DOMContentLoaded", () => {
    initPromise.then(() => {
        onAuthStateChanged(auth, (user) => {
            const authIconDesktop = document.getElementById('auth-icon-desktop');
            const sideMenu = document.getElementById('sideMenu');
            
            if (user) {
                // Usuario logueado: Mostrar inicial o iluminar el ícono
                if (authIconDesktop) {
                    authIconDesktop.innerHTML = `
                        <div style="background: var(--hp-pink); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;">
                            ${user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                    `;
                }

                // En el menú móvil podemos cambiar "Iniciar Sesión" por el Dashboard
                const mobileLoginLink = sideMenu ? sideMenu.querySelector('a.login-mobile-link') : null;
                if (mobileLoginLink) {
                    mobileLoginLink.innerHTML = `Dashboard (${user.displayName ? user.displayName.split(' ')[0] : 'Cuenta'})`;
                    mobileLoginLink.style.color = 'var(--hp-pink)';
                    mobileLoginLink.style.fontWeight = '700';
                }
            } else {
                // No logueado: El ícono por defecto ya es el SVG de la persona, no hace falta cambiar innerHTML, 
                // solo asegurarnos de que no tenga el circulo rosa si hizo logout.
                if (authIconDesktop) {
                    authIconDesktop.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    `;
                }

                const mobileLoginLink = sideMenu ? sideMenu.querySelector('a.login-mobile-link') : null;
                if (mobileLoginLink) {
                    mobileLoginLink.innerHTML = `Iniciar Sesión`;
                    mobileLoginLink.style.color = '';
                    mobileLoginLink.style.fontWeight = '';
                }
            }
        });
    });
});
