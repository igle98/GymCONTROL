import { loginWithGoogle } from '../services/auth.js';
import { navigate } from '../components/router.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div class="login-view">
      <div class="login-logo">🏋️</div>
      <h1 class="login-title">gymCONTROL</h1>
      <p class="login-subtitle">Tu progreso, tus datos, sin tonterías.</p>
      <button class="btn-google" id="btn-login">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google">
        Entrar con Google
      </button>
      <p id="login-error" class="text-warning mt-16 hidden"></p>
    </div>
  `;

  const btn = container.querySelector('#btn-login');
  const error = container.querySelector('#login-error');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Conectando...';
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      error.textContent = 'Error al iniciar sesión. Inténtalo de nuevo.';
      error.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = `
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google">
        Entrar con Google
      `;
    }
  });
}
