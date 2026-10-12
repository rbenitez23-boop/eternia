/*
 * Configuración de Eternia.
 * ESTOS VALORES SON PÚBLICOS POR DISEÑO (no son llaves ni contraseñas):
 *   - API_URL: la dirección de la app web "Eternia API" de Apps Script.
 *   - GOOGLE_CLIENT_ID: identificador público del botón "Continuar con Google".
 * Nunca pongas aquí contraseñas, TOKEN_SALT ni IDs del Sheet.
 *
 * Si API_URL está vacío, la página funciona en MODO DEMO (datos de ejemplo, nada se guarda).
 */
window.ETERNIA_CONFIG = Object.freeze({
  API_URL: '',
  GOOGLE_CLIENT_ID: ''
});
