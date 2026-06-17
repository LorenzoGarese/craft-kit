# LorenzoGarese-marketplace

Marketplace de plugins de Claude Code. Un solo `marketplace add` y despues instalas los plugins que quieras.

## Agregar el marketplace
```
/plugin marketplace add LorenzoGarese/LorenzoGarese-marketplace
```

## Plugins disponibles

### craft
Kit para construir UI de producto con calidad, cada skill en un eje distinto.

```
/plugin install craft@LorenzoGarese-marketplace
```

| Skill | Eje |
|---|---|
| ui-ux-pro-max | Rigor de UX + patrones de producto (forms, tablas, charts, multi-stack) |
| frontend-design | Gusto estetico / que no parezca templated |
| impeccable | Auditoria: detecta anti-patterns visuales |
| design-motion-principles | Animaciones (crear + auditar motion) |
| stop-slop | Textos y microcopy |
| remotion-best-practices | Creacion de video con Remotion (React) |

### backend
Scaffolding de backend .NET (Clean Architecture + CQRS). Genera vertical slices end-to-end con tus convenciones.

```
/plugin install backend@LorenzoGarese-marketplace
```

| Skill | Eje |
|---|---|
| vertical-slice | Genera una slice CQRS completa (Command/Query + Handler + Validator + Response + endpoint) |

## Mantenimiento

- **Reproducir el entorno en una PC nueva** → [`setup/SETUP.md`](setup/SETUP.md). El backup real
  es `~/.claude/settings.json`; en [`setup/claude-settings.snippet.json`](setup/claude-settings.snippet.json)
  hay una version saneada de las claves portables.
- **Actualizar skills vendoreadas a su upstream** → `node scripts/update-skills.mjs`. Lee
  [`plugins/craft/skills/SOURCES.json`](plugins/craft/skills/SOURCES.json) (la procedencia de cada
  skill) y reaplica los parches locales solo. Completá los `upstream` marcados como TODO con el
  lugar real de donde sacaste cada skill.
