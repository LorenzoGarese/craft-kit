# Convenciones para generación de vertical slices CQRS (.NET)

Esta guía es la referencia que el agente debe seguir al ejecutar la skill `vertical-slice`. Es accionable y determinística: cada sección indica qué hacer, en qué orden, y cómo interpretar lo que se encuentra.

---

## 1. Detección de proyectos

La detección es **siempre por convención**, nunca por nombre hardcodeado. Ejecutar los siguientes pasos en orden:

### Capa Application (donde vive la lógica CQRS)

1. Glob `**/*.csproj` desde la raíz del repo destino.
2. Para cada `.csproj` encontrado, verificar dos condiciones:
   - La carpeta del `.csproj` contiene una subcarpeta `Features/` (existencia física).
   - El contenido del `.csproj` tiene una referencia a `MediatR` (Grep `MediatR` dentro del archivo `.csproj`).
3. El candidato que cumpla ambas condiciones es la capa Application. Ejemplos reales de nombres: `Company.API.Application`, `STePUy.Facturador.Core`. El sufijo puede ser `.Application`, `.Core` u otro: no se asume.

### Capa Web (controladores)

1. Buscar la carpeta que contenga `Controllers/` y un archivo `Program.cs` al mismo nivel o en la raíz del proyecto.
2. Glob `**/Controllers/*.cs` y `**/Program.cs`.

### Capa Domain

1. Buscar el `.csproj` cuyo nombre termina en `.Domain`, o el que contiene las clases de entidad (Grep `BaseEntity` o `abstract class` en los `.cs` de cada proyecto candidato).

### Ambigüedad

Si hay más de un candidato que cumpla las condiciones de cualquier capa, **parar y preguntar una sola vez** al usuario cuál es el proyecto correcto antes de continuar.

---

## 2. Aprender del vecino

Antes de generar cualquier archivo, leer al menos **una feature existente completa** del repo destino para captar los valores reales de ese proyecto. Los nombres que aparecen a continuación son los del repo de referencia; en otro repo pueden diferir y por eso **siempre se aprenden leyendo, nunca se asumen**.

### Archivos a leer (elegir una feature existente al azar o la más simple)

| Archivo | Qué extraer |
|---|---|
| `Features/<Área>/Commands/<Acción>/<Acción>Command.cs` | Namespace raíz, marker de escritura y su `using` |
| `Features/<Área>/Commands/<Acción>/<Acción>CommandHandler.cs` | Patrón de DI (primary constructor), acceso a DB, helpers de repos |
| `Features/<Área>/Commands/<Acción>/<Acción>CommandValidator.cs` | Extensiones de validación personalizadas (ej. `.PasswordRules()`, `.RoleNameRules()`) |
| Un `*Controller.cs` en la capa Web | Wrapper de respuesta, método base, firma de endpoints |

### Valores a registrar antes de generar

- **Namespace raíz**: extraer del `namespace` de los archivos leídos (ej. `Company.API.Application`).
- **Marker de escritura**: la interfaz que implementan los commands además de `IRequest<T>`. En el repo de referencia es `IWriteRequest`, definida en `...Application.Abstractions.Mediator`. El `using` exacto se extrae del Command leído.
- **Marker de lectura**: la interfaz que implementan las queries (en el repo de referencia es `IReadRequest`, mismo namespace).
- **Response compartido**: Cuando el vecino ya tiene un tipo Response compartido (ej. en una carpeta `Contracts/` del área, como `Roles/Commands/Contracts/RoleResponse.cs`), REUSALO en vez de crear `<Name>Response` nuevo; seguí la ubicación que use el repo para los Response. El estilo de CÓDIGO (primary ctor, sealed, etc.) es canónico, pero la UBICACIÓN/forma de tipos compartidos se sigue del vecino.
- **Wrapper de respuesta**: los métodos del `BaseApiController` que devuelven `IActionResult`. En el repo de referencia: `Success(data, mensaje)`, `CreatedSuccess(data, mensaje)`, `CreatedAtActionSuccess(...)`. El `Sender` es `ISender` (MediatR), obtenido vía `HttpContext.RequestServices`.
- **Helper de repos**: `GetByIdOrThrowAsync<T>()` (extensión sobre `IBaseRepository<T>`) o el patrón equivalente encontrado. En queries se suele usar EF Core directo con `FirstOrDefaultAsync` + `throw NotFoundException.For(...)`.
- **Extensiones de validación**: anotar las que existen (ej. `.RoleNameRules()`) para no reinventarlas en el validator nuevo.
- **Tipos de excepción disponibles**: leer la carpeta `Application/Exceptions/_4XX/`. En el repo de referencia: `NotFoundException`, `BadRequestException`, `ConflictException`, `UnauthorizedException`, `ForbiddenException`, `TooManyRequestsException`. Usar `NotFoundException.For(nombreEntidad, id)` cuando existe ese factory estático.

---

## 3. Estilo canónico

### Estructura de carpetas

```
Features/
  <Área>/
    Commands/
      <Acción>/
        <Acción>Command.cs
        <Acción>CommandHandler.cs
        <Acción>CommandValidator.cs
    Queries/
      <Acción>/
        <Acción>Query.cs
        <Acción>QueryHandler.cs
```

El namespace de cada archivo debe ser idéntico a la ruta de carpetas relativa al proyecto (ej. `Company.API.Application.Features.Roles.Commands.CreateRole`).

### Tipos correctos

| Artefacto | Tipo C# |
|---|---|
| Command / Query | `sealed record` |
| Response / DTO | `sealed record` |
| Handler | `sealed class` |
| Validator | `sealed class` |

### Primary constructor (correcto vs incorrecto)

**Correcto — primary constructor:**
```csharp
public sealed class CreateRoleCommandHandler(IAppDbContext db, IExistenceValidator existence)
    : BasicCreateHandler<CreateRoleCommand, Role, RoleResponse>(db, existence)
{
    protected override Role Build(CreateRoleCommand request)
    {
        var role = new Role(request.Nombre);
        // ...
        return role;
    }
}
```

**Incorrecto — constructor explícito + campos readonly:**
```csharp
// NO usar este estilo, aunque exista en features antiguas del repo
public sealed class CreateRoleCommandHandler : IRequestHandler<CreateRoleCommand, RoleResponse>
{
    private readonly IAppDbContext _db;

    public CreateRoleCommandHandler(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<RoleResponse> Handle(CreateRoleCommand request, CancellationToken ct) { ... }
}
```

### Firma del handler

```csharp
public async Task<TResponse> Handle(TRequest request, CancellationToken cancellationToken)
```

El parámetro de cancelación se llama `cancellationToken` (no `ct`) salvo que el repo destino use otro nombre de forma consistente (verificar leyendo).

### Carpeta plana — drift a evitar

La estructura `Features/<Área>/<Nombre>/` sin la subcarpeta `Commands/` o `Queries/` **no es el estilo canónico**. Si el repo destino la usa de forma consistente, adaptarse; si es un caso aislado (feature viejo), generar con la estructura correcta `Commands/` / `Queries/`.

### Mensajes y comentarios

Todos los mensajes de dominio, mensajes de excepción, y comentarios en el código generado van en **español** (ej. `"Usuario no encontrado"`, `"El nombre ya está en uso"`).

### Command y Query — ejemplos

```csharp
// Command
public sealed record CreateRoleCommand(
    string Nombre,
    IReadOnlyCollection<PermissionDto> Permissions)
    : IRequest<RoleResponse>, IWriteRequest;

// Query
public sealed record GetRoleByIdQuery(Guid Id)
    : IRequest<RoleResponse>, IReadRequest;
```

---

## 4. Marker de escritura y transacción

### IWriteRequest

Los commands deben implementar `IWriteRequest` (además de `IRequest<TResponse>`). Este marker es detectado por el `TransactionBehavior` del pipeline de MediatR.

### TransactionBehavior

Verificar que existe una carpeta `Behaviours/` en la capa Application con un archivo `TransactionBehavior.cs` (o nombre equivalente). Si existe:

- El behavior envuelve automáticamente toda petición que implemente `IWriteRequest` en una transacción de base de datos.
- El behavior llama a `SaveChangesAsync` al final de la operación exitosa.
- Por lo tanto, el handler **NO debe llamar** `SaveChangesAsync` ni `CommitTransaction` por su cuenta.

Si la carpeta `Behaviours/` no existe o no hay `TransactionBehavior`, el handler sí debe llamar `SaveChangesAsync` explícitamente. Verificar esto leyendo el contenido de `Behaviours/` antes de generar.

### Otros behaviors relevantes (repo de referencia)

| Behavior | Función |
|---|---|
| `ValidationBehavior` | Ejecuta todos los `IValidator<TRequest>` registrados; lanza `RequestValidationException` si hay errores |
| `TrimStringsBehavior` | Recorta propiedades `string` de todas las requests por reflexión |
| `BruteForceBehavior` | Detecta `IBruteForceProtectedRequest`; bloquea si se supera el límite |

El agente no debe reimplementar lógica que ya provee un behavior.

---

## 5. Guardrails

Estas reglas no son opcionales. El agente debe verificarlas antes de escribir cualquier archivo.

### No pisar archivos existentes

Antes de crear cada archivo, verificar si ya existe en el sistema de archivos. Si existe **cualquiera** de los archivos que se van a generar (Command, Handler, Validator, etc.):

1. Detener la generación inmediatamente.
2. Informar al usuario qué archivos ya existen.
3. Preguntar cómo proceder (sobreescribir, renombrar, cancelar).
4. No continuar hasta recibir instrucción explícita.

### Namespaces y usings reales

Usar **exclusivamente** los namespaces y usings detectados en la sección 2 (Aprender del vecino). No inventar ni asumir namespaces. Si un using no fue detectado en los archivos leídos, buscar explícitamente antes de usarlo.

### Inserción de endpoints en controladores

Al agregar un endpoint a un controlador existente:

1. Leer el archivo completo del controlador antes de modificarlo.
2. Insertar el nuevo método respetando la estructura existente (posición, indentación, atributos de autorización).
3. Agregar los `using` necesarios al encabezado sin duplicar los existentes.
4. No modificar ningún método existente.
5. Si la clase del controlador está `sealed`, mantenerla `sealed`.

### Coherencia de nombres

El nombre de la feature (área) y la acción deben coincidir exactamente entre todos los artefactos generados (Command, Handler, Validator, Controller endpoint, namespace, carpeta). Si hay ambigüedad en el nombre, preguntar antes de generar.
