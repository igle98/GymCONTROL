# GymCONTROL

Aplicación web para registrar entrenamientos de gimnasio, seguir el progreso de cada ejercicio y gestionar rutinas personalizadas. Pensada como herramienta personal de uso diario en el móvil durante la sesión de entreno.

## Descripción

GymCONTROL permite al usuario llevar un control detallado de su actividad en el gimnasio: crear rutinas por grupo muscular, registrar series (peso, repeticiones, RPE) durante el entrenamiento, consultar el histórico de sesiones y visualizar la evolución de cada ejercicio a lo largo del tiempo. Incluye además sugerencias automáticas de peso/reps en base a las sesiones anteriores y un temporizador de descanso integrado.

Es una SPA construida en JavaScript puro (sin framework) y respaldada por Firebase para autenticación y persistencia, lo que permite usarla desde cualquier dispositivo manteniendo los datos sincronizados.

## Funcionalidades

- **Autenticación con Google** vía Firebase Auth.
- **Gestión de ejercicios**: catálogo personal filtrable por grupo muscular.
- **Rutinas**: creación, edición y activación de rutinas con ejercicios ordenados.
- **Entrenamiento en vivo**: registro de series con temporizador de descanso y sugerencias basadas en la última sesión.
- **Histórico de sesiones**: consulta de entrenamientos pasados.
- **Progreso**: gráficas de evolución por ejercicio (Chart.js).
- **Dashboard**: resumen de la rutina activa y últimos registros.

## Stack

- **Frontend**: JavaScript (ES modules), HTML, CSS — sin framework.
- **Build**: Vite.
- **Backend**: Firebase (Auth + Firestore).
- **Gráficas**: Chart.js.
- **Hosting**: Firebase Hosting.

## Estructura del proyecto

```
src/
├── components/   # Navbar, router SPA, temporizador de descanso
├── config/       # Inicialización de Firebase
├── services/     # Capa de acceso a Firestore (auth, ejercicios, rutinas, sesiones)
├── utils/        # Cálculos, formateadores, constantes, lógica de sugerencias
├── views/        # Vistas: dashboard, login, workout, rutinas, ejercicios, historial, progreso, ajustes
├── styles/       # CSS
└── main.js       # Punto de entrada
```

## Puesta en marcha

1. Clonar el repositorio e instalar dependencias:
   ```bash
   npm install
   ```
2. Crear un proyecto en [Firebase](https://console.firebase.google.com/) y habilitar **Authentication (Google)** y **Firestore**.
3. Copiar `.env.example` a `.env` y rellenar con las credenciales del proyecto:
   ```bash
   cp .env.example .env
   ```
4. Arrancar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — servidor de desarrollo (Vite).
- `npm run build` — build de producción en `dist/`.
- `npm run preview` — sirve el build localmente.

## Despliegue

Configurado para Firebase Hosting (ver `firebase.json`). Tras `npm run build`:

```bash
firebase deploy
```

Las reglas de Firestore (`firestore.rules`) restringen el acceso a los datos de cada usuario a su propio UID autenticado.

## Notas

Proyecto personal, desarrollado como parte de un portfolio.
