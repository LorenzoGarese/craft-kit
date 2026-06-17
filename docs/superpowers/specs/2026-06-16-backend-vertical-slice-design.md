# Diseño — plugin `backend`, skill `vertical-slice`

Fecha: 2026-06-16
Estado: aprobado (brainstorming), pendiente plan de implementación.

## Objetivo

Un plugin nuevo (`backend`) en el marketplace `LorenzoGarese-marketplace`, cuya primera
skill (`vertical-slice`) genera una *vertical slice* CQRS end-to-end en backends .NET con
Clean Architecture + MediatR + FluentValidation, **encodeando las convenciones de casa** para
que el código generado matchee el repo en vez de salir genérico.

Motivación: el modelo base sabe .NET genérico, no las convenciones específicas (estilo de
handler, markers, wrapper de respuesta, naming de carpetas). Eso es lo que aporta valor y lo
que un scaffolder debe fijar.

## Decisiones (del brainstorming)

| Eje | Decisión |
|---|---|
| Alcance | **Stack completo end-to-end**: 4 archivos de Application + Request DTO en Web + endpoint en el controller. |
| Command/Query | **Ambos, autodetecta** por el verbo de la operación (crear/actualizar/borrar → command; obtener/listar → query). |
| Interacción | **Interview corto**: infiere lo que puede, pregunta solo lo que falta/ambiguo (área, campos+tipos, auth, permiso). |
| Estilo canónico | **Moderno** (estilo `ChangePassword`): primary constructor, subcarpeta `Commands/Queries`, namespace = carpeta, records sellados. Unifica el drift hacia adelante. |
| Genericidad | **Genérica, auto-detecta** los proyectos por convención (sirve para Company, Nexus, Facturador `.Core`, etc.) sin hardcodear nombres. |
| Enfoque de build | **Skill de instrucciones + templates de referencia** (sin scripts ni dependencias de runtime). |

## Estructura del plugin

```
plugins/backend/
  .claude-plugin/plugin.json          # name: backend, version 0.1.0
  skills/vertical-slice/
    SKILL.md
    reference/
      conventions.md     # reglas de casa: estilo, markers, naming, carpetas
      command-slice.md   # templates anotados: Command/Handler/Validator/Response (write)
      query-slice.md     # variante read: GET, AsNoTracking, paginación
      web-wiring.md      # Request DTO + endpoint + helpers de BaseApiController
```

Segundo plugin del marketplace, al lado de `craft`. Entrada nueva en
`.claude-plugin/marketplace.json`. Instalación: `/plugin install backend@LorenzoGarese-marketplace`.

## Disparo

Por `description` del SKILL.md: se activa al pedir crear feature/endpoint/command/query/slice
en un backend .NET CQRS+MediatR. Conversacional, sin slash command obligatorio.

## Flujo de la skill

### 1. Detección de proyectos (determinística, Glob/Grep)

1. **Capa de aplicación**: el `.csproj` cuya carpeta contiene `Features/` y referencia MediatR
   (matchea `.Application` *o* `.Core` u otro sufijo).
2. **Web**: carpeta con `Controllers/` + ASP.NET (`Program.cs`).
3. **Domain**: `*.Domain` o el proyecto de entidades.
4. **Aprender del vecino**: leer 1 feature existente (Command + Handler + Controller) para
   captar los `using`, los markers (`IWriteRequest`/equivalente read), el wrapper de respuesta
   (`ApiResponse`/`Success`/`CreatedSuccess`) y las extensiones de validación reales del repo.
   Esto hace la skill genérica pero fiel a cada proyecto.

Si la detección es ambigua (varios candidatos), preguntar una vez cuál.

### 2. Interview corto

Inferir del prompt; preguntar solo lo faltante o ambiguo, máx 2-3 por ronda:
- **Área** (carpeta de feature / controller destino).
- **Operación**: command vs query (autodetectado por el verbo; confirmar si dudoso).
- **Campos + tipos** del input.
- **Auth**: `[Authorize]` / `[AllowAnonymous]`, `RequiresPermission(area, action)`.
- **Rate limiting** (`EnableRateLimiting`) si aplica.
- **Forma del response**.

### 3. Generación — camino command (write)

Carpeta `Features/<Área>/Commands/<Name>/`:
- `<Name>Command.cs` — `sealed record` con primary-ctor de los campos, `: IRequest<<Name>Response>, IWriteRequest`.
- `<Name>CommandHandler.cs` — `sealed class` con primary constructor (deps detectadas:
  repos/abstractions + `IAppDbContext`), `Handle(<Name>Command request, CancellationToken ct)`,
  cuerpo con el patrón real (cargar → validar → mutar → guardar) y excepciones de dominio en
  español (`Application.Exceptions._4XX`).
- `<Name>CommandValidator.cs` — `sealed AbstractValidator<<Name>Command>`, reglas por campo,
  reusando extensiones detectadas.
- `<Name>Response.cs` — `sealed record`.

Web:
- `Web/Contracts/<Área>/<Name>Request.cs` — DTO espejo de los campos.
- Endpoint en `<Área>Controller : BaseApiController`: atributos (`[Http*("...")]`, auth,
  rate limiting, permiso), `Sender.Send(new <Name>Command(...), ct)`, `return Success(...)` /
  `CreatedSuccess(...)`. Si el controller no existe, se crea siguiendo el patrón; si existe,
  se **inserta** el método sin pisar nada.

### 4. Generación — camino query (read)

`Features/<Área>/Queries/<Name>/`: `Query` (`: IRequest<Response>`, sin marker de escritura),
`Handler` con `AsNoTracking` + proyección, `Response`. Endpoint GET. Paginación
(`page`/`pageSize`) si es "listar". Normalmente sin Validator (salvo que los params lo requieran).

### 5. Guardrails

- **Nunca pisar** un archivo existente: si el nombre ya existe, parar y preguntar.
- Insertar el endpoint respetando `using` y la llave de cierre de la clase.
- Usar los namespaces/usings **reales** descubiertos en la detección, no los de Company.
- **DI**: MediatR y FluentValidation se auto-registran por assembly scan; la skill lo verifica
  y solo agrega registración si el repo la hace a mano.

### 6. Verificación

Al terminar, correr `dotnet build` de la solución para confirmar que compila; reportar errores.
`allowed-tools: Bash(dotnet build*)`.

## Fuera de alcance (v1, YAGNI)

- Migrations / creación de entidades EF.
- Generación de tests.
- Customización de OpenAPI/Swagger.
- Registro manual de DI (salvo que el repo lo requiera).

Estas pueden venir como skills aparte del plugin `backend` más adelante (`ef-core`, `api-security`,
`clean-arch-guard`, etc.).

## Criterio de aceptación

Probar `vertical-slice` contra Company-API: generar una slice de ejemplo (command y query),
correr `dotnet build` OK, y descartar los archivos generados. La salida debe ser
indistinguible del estilo de `ChangePassword`/`Login`.

## Componentes y responsabilidades

| Unidad | Qué hace | De qué depende |
|---|---|---|
| `SKILL.md` | Orquesta el flujo (detectar → interview → generar → build) | reference/* |
| `reference/conventions.md` | Reglas de estilo/markers/naming canónicos | — |
| `reference/command-slice.md` | Templates anotados de la slice de escritura | conventions.md |
| `reference/query-slice.md` | Templates anotados de la slice de lectura | conventions.md |
| `reference/web-wiring.md` | Request DTO + endpoint + helpers de controller | conventions.md |
