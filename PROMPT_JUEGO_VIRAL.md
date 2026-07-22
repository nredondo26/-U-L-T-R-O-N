# 🎮 PROMPT ULTRON: Desarrollar un Videojuego Indie Viral Multiplataforma

> **Objetivo:** Probar TODAS las capacidades de ULTRON (Orchestrator, Architect, Editor, Librarian, Basher, Researcher, Thinker, Reviewer) desarrollando un juego indie con potencial viral, arquitectura multiplataforma y listo para publicar en Steam.

---

## 🧠 FASE 0 — INVESTIGACIÓN (Researcher + Librarian + Thinker)

Activa **Researcher**, **Librarian** y **Thinker** en paralelo para investigar:

1. **Analiza los 3 patrones de viralidad mejor probados** (según datos de 2023-2025):
   - **Unexpected Win Mechanic** (Balatro: combos absurdos que piden screenshot)
   - **"Watch This" Loop** (Lethal Company: momentos virales de 5-30 segundos)
   - **Close Call Economy** (Vampire Survivors: victorias por margen <10% = 89% share rate)
   - **Failure Spectacle** (fallos espectaculares se comparten tanto como victorias)

2. **Analiza por qué estos juegos explotaron**:
   - Vampire Survivors: loop de baja fricción, recompensa cada 23 segundos, psicología de casino
   - Balatro: poker como lenguaje universal, profundidad inesperada, 5M copias
   - Lethal Company: experiencia compartida, voice chat como mecánica, $0 marketing

3. **Recomienda el género y mecánica principal** basado en:
   - Menor tiempo de desarrollo posible
   - Máximo potencial de viralidad inherente (no depende de marketing)
   - Facilidad para ser "streamable" desde el primer minuto
   - Baja fricción: que se entienda en 3 segundos

---

## 🏗️ FASE 1 — ARQUITECTURA Y PLAN (Architect + Orchestrator + Thinker)

Con los datos de investigación, el **Architect** debe diseñar:

### 1.1 Concepto del Juego
- **Nombre tentativo** del juego
- **Elevator pitch** (1 frase que se entienda en 3 segundos)
- **Mecánica principal** (core loop) en 3 pasos
- **Gatillos de viralidad** incorporados en el diseño (no añadidos después):
  - ¿Qué hará que un jugador diga "mira esto"?
  - ¿Qué hará que un jugador tome screenshot?
  - ¿Qué hará que un jugador quiera "una partida más"?
- **Perfil de jugador objetivo**

### 1.2 Stack Tecnológico
Diseñar una arquitectura que cumpla **TODOS** estos requisitos:

| Requisito | Solución técnica |
|-----------|-----------------|
| 🖥️ Desktop (Windows/Mac/Linux) | _____ |
| 🌐 Web (jugar desde navegador) | _____ |
| 📱 Mobile (iOS/Android) | _____ |
| 🎮 Steam (Steamworks SDK) | _____ |
| ⚡ Rendimiento incluso en PC baja | _____ |
| 🛠️ Tooling para desarrollo rápido | _____ |

**Stack recomendado a evaluar:**
- **Phaser 3** (HTML5 Canvas) + GemShell → Steam/Desktop/Mobile. Un solo código base HTML5, GemShell lo empaqueta para Steam (Windows/Mac/Linux) y mobile (iOS/Android via Capacitor). Incluye Steamworks API.
- Alternativa: **Godot 4** (exporta a Web + Desktop + Mobile nativo)
- **Justifica la decisión** basada en: velocidad de desarrollo, multiplataforma real, comunidad, asset pipeline

### 1.3 Estructura de Archivos
```
game/
├── src/
│   ├── main.ts
│   ├── scenes/
│   ├── entities/
│   ├── systems/
│   └── ui/
├── assets/
├── steam/        # Steamworks integration
├── mobile/       # Mobile-specific configs
├── web/          # Web-specific build
├── package.json
├── tsconfig.json
└── gemshell.json # GemShell config for cross-platform
```

### 1.4 Plan de Desarrollo en 7 Días
| Día | Agente Principal | Hito |
|-----|-----------------|------|
| 1 | Architect + Editor | Boilerplate + escena principal + movimiento |
| 2 | Editor + Basher | Core loop jugable (mecánica principal funciona) |
| 3 | Editor + Basher | Enemigos + scoring + game over + restart |
| 4 | Researcher + Editor | Power-ups / progresión / meta-progresión |
| 5 | Editor + Thinker | Pulido de viralidad: screenshots, shareability, close calls |
| 6 | Basher + Reviewer | Build Web + Desktop + QA + bug fixes |
| 7 | Reviewer + Basher | Steam build + itch.io + publishing prep |

---

## ⚙️ FASE 2 — IMPLEMENTACIÓN (Editor + Basher + Orchestrator)

El **Editor** y **Basher** deben implementar:

### 2.1 Configuración del Proyecto
- Inicializar proyecto con TypeScript + el engine elegido
- Hot-reload en desarrollo
- Build scripts para: web, desktop (Steam), mobile
- ESLint + Prettier config

### 2.2 Core Game (MVP en <500 líneas)
- Una escena/mundo funcional
- La mecánica principal (movimiento + acción central)
- Sistema de puntuación
- Game over / restart loop
- Que sea **divertido en el primer minuto**
- Que corra a 60fps incluso en hardware bajo

### 2.3 Sistemas de Viralidad (integrados desde el día 1)
- **Screenshot automático** en momentos clave (high score, combos, close calls)
- **Share URL** con estado de la partida (para web)
- **Clip export** de los últimos 15 segundos (WebGL recording)
- **"Watch this" detector**: identifica momentos virales automáticamente
- **Close call tracker**: registra y muestra victorias por poco margen

### 2.4 Progresión
- Meta-progresión entre partidas (localStorage para web, save para Steam)
- Al menos 3 desbloqueables que incentiven "una más"
- Achievements list (compatible con Steamworks)
- **"Near miss" design**: que perder se sienta como "casi gané"

---

## 🛠️ FASE 3 — MULTIPLATAFORMA (Basher + Editor + Architect)

### 3.1 Build para Web
- Exportar como HTML5 estático (un solo `index.html` + bundle JS)
- Hosteable en itch.io, GitHub Pages, o cualquier CDN
- Responsive: funciona en desktop browser y mobile browser
- Touch controls para mobile web

### 3.2 Build para Steam (Desktop)
- Usar GemShell (si se eligió Phaser) para empaquetar como app nativa
- Configurar Steamworks: logros, cloud saves, overlay
- Builds para Windows (.exe), macOS (.app), Linux (.AppImage)
- Icono personalizado, splash screen opcional

### 3.3 Build para Mobile (iOS/Android)
- GemShell Capacitor export para App Store y Google Play
- Orientación, iconos, splash screens configurados
- Touch input como control primario
- Rendimiento en dispositivos gama media

---

## ✅ FASE 4 — CALIDAD Y QA (Reviewer + Thinker)

### 4.1 Code Review
- **Reviewer** debe auditar TODO el código generado:
  - Performance: ¿corre a 60fps consistente?
  - Memory leaks: ¿hay fugas en escenas/eventos?
  - Edge cases: ¿qué pasa si el jugador hace X inesperado?
  - Steam integration: ¿maneja correctamente offline mode?
  - Mobile: ¿tolera suspension/resume?
- Reportar cada issue con severidad (critical/major/minor)
- El **Editor** debe corregir CADA issue antes de pasar a la siguiente fase

### 4.2 Playtesting
- Generar un build web y compartirlo
- Verificar: first-time experience, tutorial implícito, "fun in 1 minute"

---

## 🚀 FASE 5 — PUBLICACIÓN Y ESTRATEGIA (Orchestrator + Researcher)

### 5.1 Steam Store Page
- Generar texto completo para la página de Steam:
  - **Título y subtitle** (que pase el test de 3 segundos)
  - **Descripción corta** (que enganche en 1 línea)
  - **Features list** (bullet points orientados a viralidad)
  - **Tags** óptimos para descubrimiento en Steam (basado en datos de 2024)
  - **Capsule art description** (qué debe mostrar visualmente)

### 5.2 Estrategia de Lanzamiento
- Pricing recomendado (basado en datos: indie hits $5-$10)
- Estrategia de demo: ¿sí o no? ¿qué incluye?
- Plataformas de lanzamiento: Steam + itch.io + Web
- Estrategia para TikTok/YouTube Shorts:
  - ¿Qué clip de 15s hará que alguien pare el scroll?
  - ¿Qué hará que un streamer quiera jugarlo?

### 5.3 Monetización
- Modelo: premium (pago único) vs free-to-play vs demo+full
- Justificación basada en datos de mercado indie 2024

---

## 📋 ENTREGABLES FINALES

ULTRON debe producir **cada uno de estos archivos** en la carpeta `game/`:

| Archivo | Propósito |
|---------|-----------|
| `game/src/main.ts` | Entry point con boot del engine |
| `game/src/scenes/GameScene.ts` | Escena principal con core loop |
| `game/src/scenes/MenuScene.ts` | Menú principal |
| `game/src/scenes/GameOverScene.ts` | Pantalla de game over + share |
| `game/src/entities/Player.ts` | Jugador (movimiento + input) |
| `game/src/entities/Enemy.ts` | Enemigos / obstáculos |
| `game/src/systems/ScoreSystem.ts` | Puntuación + close call detection |
| `game/src/systems/ViralSystem.ts` | Screenshots automáticos + share |
| `game/src/systems/ProgressionSystem.ts` | Meta-progresión entre runs |
| `game/src/utils/Storage.ts` | Save/load (abstracted per platform) |
| `game/package.json` | Dependencias + scripts |
| `game/tsconfig.json` | TypeScript config |
| `game/gemshell.json` | GemShell cross-platform config |
| `game/steam/steam.txt` | Steamworks app config |
| `game/web/index.html` | Web entry point |
| `ARCHITECTURE.md` | Documentación técnica del diseño |
| `STEAM_PAGE.md` | Texto completo para la store page |
| `LAUNCH_STRATEGY.md` | Plan de lanzamiento viral |

---

## 🔥 REGLAS DE EJECUCIÓN PARA ULTRON

1. **Cada agente debe activarse explícitamente** — no asumir que otro lo hará
2. **El Orchestrator coordina** y asegura que ningún agente quede ocioso
3. **El Reviewer audita TODO el código** antes de darlo por terminado
4. **El Librarian documenta cada decisión** en ARCHITECTURE.md
5. **Cada fase debe completarse al 100%** antes de pasar a la siguiente
6. **Si hay bugs, el Reviewer los reporta y el Editor los corrige** antes de continuar
7. **El juego debe ser jugable y divertido en <100 líneas de código del core loop**
8. **El prompt final debe poder ejecutarse con un solo comando:** `npm run dev`

---

## 🎯 MÉTRICAS DE ÉXITO

- [ ] Core loop jugable en <1 hora de desarrollo
- [ ] Build web funcional: se juega desde navegador
- [ ] Build desktop funcional: se juega desde Steam (al menos en test mode)
- [ ] Build mobile funcional: se juega en Android/iOS
- [ ] 60fps consistentes en PC media-baja
- [ ] La partida promedio genera al menos 1 "close call" (vida <10%)
- [ ] El juego se entiende en 3 segundos (test: mostrarlo a alguien sin explicar)
- [ ] Tiene al menos 1 mecanismo de share integrado
- [ ] Tiene al menos 3 desbloqueables
- [ ] Steam page lista para publicación

---

> **Instrucción final para ULTRON:** Ejecuta este prompt completo. No omitas ninguna fase. Cada agente debe trabajar en su especialidad. El Reviewer audita todo. El resultado final debe ser un juego funcional, divertido, viral por diseño, y listo para publicar en Steam + Web + Mobile. ¡Comienza ahora!
