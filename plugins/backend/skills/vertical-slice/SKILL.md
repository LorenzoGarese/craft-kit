---
name: vertical-slice
description: Use cuando el usuario quiere crear un endpoint, feature, command, query o "slice" en un backend .NET con Clean Architecture + CQRS (MediatR) + FluentValidation. Genera la vertical slice completa end-to-end (Command/Query + Handler + Validator + Response + Request DTO + endpoint en el controller) detectando y siguiendo las convenciones del repo. Para .NET/C# con MediatR; no para frontend ni otros stacks.
allowed-tools:
  - Bash(dotnet build*)
---

# Skill: vertical-slice

Orquesta la generación completa de una vertical slice CQRS en un backend .NET con Clean Architecture. Sigue este flujo en orden: Setup → Interview → Generación → Guardrails → Verificación. No saltear ningún paso.

---

## 1. Setup / Detección

Antes de generar cualquier archivo, identificar los proyectos reales del repo destino y aprender del código existente. Seguir `reference/conventions.md` → secciones "Detección de proyectos" y "Aprender del vecino".

### 1.1 Identificar las capas

Ejecutar en orden:

1. **Capa Application**: glob `**/*.csproj`; el candidato que tenga carpeta `Features/` físicamente Y referencia a `MediatR` en su `.csproj` es la capa Application. Registrar su nombre (puede ser `.Application`, `.Core` u otro).
2. **Capa Web**: buscar la carpeta que contenga `Controllers/` y `Program.cs`. Glob `**/Controllers/*.cs` y `**/Program.cs`.
3. **Capa Domain** (si se necesita): buscar el `.csproj` cuyo nombre termina en `.Domain`, o el que contiene clases con `BaseEntity` o `abstract class`.

Si hay más de un candidato para cualquiera de estas capas, parar y preguntar al usuario antes de continuar.

**Nunca asumir nombres** como `Company.*`, `MyApp.*` ni similares. Los nombres reales se leen del repo.

### 1.2 Aprender del vecino

Leer al menos una feature existente completa (elegir la más simple). De esa lectura, registrar los siguientes valores antes de continuar:

| Valor | Dónde leerlo |
|---|---|
| Namespace raíz (`<AppRoot>`) | Declaración `namespace` en cualquier archivo de `Features/` |
| Marker de escritura (`IWriteRequest`) y su `using` | Campo `: IRequest<T>, I...` en un Command existente |
| Marker de lectura (`IReadRequest`) y su `using` | Campo `: IRequest<T>, I...` en una Query existente |
| Wrapper de respuesta (`Success`, `CreatedSuccess`, etc.) | Método base en `BaseApiController` o equivalente |
| Helper de repositorio (`GetByIdOrThrowAsync` o equivalente) | Un CommandHandler o QueryHandler existente |
| Extensiones de validación personalizadas | Un `*CommandValidator.cs` existente |
| Tipos de excepción disponibles | Carpeta `Application/Exceptions/_4XX/` |
| TransactionBehavior existe | Carpeta `Behaviours/` → archivo `TransactionBehavior.cs` |

Si `TransactionBehavior` existe, el handler **no** llama `SaveChangesAsync` (lo hace el behavior). Si no existe, el handler sí debe llamarlo.

No continuar al siguiente paso sin tener todos estos valores registrados.

---

## 2. Interview corto

Inferir del prompt del usuario la mayor cantidad de información posible. Preguntar **solo lo que falta o es ambiguo**, en un máximo de 2-3 preguntas por ronda. Usar la herramienta de preguntas estructurada si está disponible.

### Reglas de inferencia

- **Tipo de operación**: detectar por el verbo del prompt.
  - Crear, agregar, registrar, actualizar, modificar, borrar, eliminar → **Command**.
  - Obtener, buscar, listar, consultar, traer → **Query**.
  - Si el verbo es ambiguo (ej. "procesar", "confirmar"), preguntar explícitamente.
- **Área/Controller**: inferir del contexto (ej. "un endpoint de roles" → área `Roles`). Confirmar si no está claro.
- **Nombre de la acción**: derivar del verbo + sustantivo (ej. "crear rol" → `CreateRole`). Confirmar si hay ambigüedad.

### Información mínima necesaria

| Campo | Descripción |
|---|---|
| Área / Controller destino | Módulo funcional (ej. `Roles`, `Usuarios`, `Pagos`) |
| Operación | Command o Query (autodetectar; confirmar si es dudoso) |
| Nombre de la acción | PascalCase (ej. `CreateRole`, `GetRoleById`) |
| Campos y tipos | Nombre y tipo C# de cada campo del Command/Query |
| Auth | `[Authorize]` / `[AllowAnonymous]` + `RequiresPermission` si aplica |
| Rate limiting | Política si el repo la usa y aplica al endpoint |
| Forma del response | Qué devuelve: entidad, DTO, nada (mensaje solo), lista paginada |

No preguntar por información que pueda inferirse con certeza del contexto.

---

## 3. Generación

Con los valores del Setup y los datos del Interview, generar todos los archivos. Usar **exclusivamente** los namespaces, usings, markers y helpers reales detectados en el Setup.

### 3.1 Elegir el camino según el tipo de operación

- **Command (escritura)**: seguir `reference/command-slice.md` para generar:
  - `<Name>Command.cs`
  - `<Name>CommandHandler.cs`
  - `<Name>CommandValidator.cs`
  - `<Name>Response.cs`

- **Query (lectura)**: seguir `reference/query-slice.md` para generar:
  - `<Name>Query.cs`
  - `<Name>QueryHandler.cs`
  - `<Name>Response.cs`
  - Validator solo si los parámetros lo requieren.

### 3.2 Wiring web

Independientemente del tipo, seguir `reference/web-wiring.md` para:

- Crear o actualizar el `<Area>Controller.cs` en la capa Web.
- Crear `<Name>Request.cs` en `Web/Contracts/<Area>/` (solo si el endpoint recibe body; omitir para GET con pocos params primitivos).
- Insertar el método del endpoint respetando las reglas de inserción del reference.

### 3.3 Carpetas y namespaces

- Commands → `Features/<Area>/Commands/<Name>/` con namespace `<AppRoot>.Features.<Area>.Commands.<Name>`.
- Queries → `Features/<Area>/Queries/<Name>/` con namespace `<AppRoot>.Features.<Area>.Queries.<Name>`.
- El namespace de cada archivo debe ser idéntico a la ruta de carpetas relativa al proyecto.
- Los tipos C# a usar: `sealed record` para Command/Query/Response, `sealed class` para Handler/Validator.
- Usar primary constructor en los handlers (no constructor explícito con campos `readonly`).

---

## 4. Guardrails

Estas reglas son obligatorias. Verificar antes de escribir cualquier archivo.

### 4.1 No pisar archivos existentes

Antes de crear cada archivo, verificar si ya existe en el sistema de archivos. Si existe **cualquiera** de los archivos a generar:

1. Detener la generación inmediatamente.
2. Informar al usuario qué archivos ya existen.
3. Preguntar cómo proceder (sobreescribir, renombrar, cancelar).
4. No continuar hasta recibir instrucción explícita.

Ver también `reference/conventions.md` → sección "Guardrails".

### 4.2 Namespaces y usings reales

Usar **solo** los namespaces y usings detectados en el Setup (sección 1.2). No inventar ni asumir. Si un using no fue detectado en los archivos leídos, buscarlo explícitamente antes de usarlo.

### 4.3 Inserción de endpoints en controllers existentes

Al agregar un endpoint a un controller existente:

1. Leer el archivo completo antes de modificarlo.
2. Insertar el nuevo método antes de la llave de cierre de la clase.
3. Agregar los `using` necesarios al encabezado sin duplicar los existentes.
4. No modificar ningún método existente.
5. Mantener `sealed` si la clase ya lo es.

### 4.4 Registro de dependencias

Verificar en `Program.cs` o en los archivos de configuración de DI si MediatR y FluentValidation están registrados por assembly scan. Si es así, no registrar nada a mano. Solo registrar manualmente si el repo lo requiere de forma explícita (verificarlo leyendo, no asumirlo).

---

## 5. Verificación

Al terminar de escribir todos los archivos:

1. Correr `dotnet build` sobre la solución completa:
   ```
   dotnet build <ruta-al-.sln>
   ```
2. Si el build falla:
   - Leer los errores de compilación.
   - Corregir los problemas encontrados (namespace incorrecto, using faltante, firma de método, etc.).
   - Volver a correr `dotnet build` hasta que compile sin errores.
3. Reportar al usuario:
   - Resultado del build (éxito o errores persistentes).
   - Lista de archivos creados (ruta absoluta o relativa desde la raíz del repo).
   - Lista de archivos modificados (ruta + qué se agregó).
