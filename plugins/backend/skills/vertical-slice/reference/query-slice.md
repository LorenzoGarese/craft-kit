# Query slice (read)

Los `<Placeholders>` son **formas, no literales**. Reemplazá `<AppRoot>` y los `using` por los reales detectados en el repo destino (ver [conventions.md](conventions.md) → "Aprender del vecino"). Carpeta destino: `Features/<Area>/Queries/<Name>/`, con `namespace` = la ruta de esa carpeta.

## `<Name>Query.cs`

```csharp
using <AppRoot>.Application.Abstractions.Mediator; // solo si el repo define un marker de lectura (IReadRequest); detectar
using MediatR;

namespace <AppRoot>.Application.Features.<Area>.Queries.<Name>;

public sealed record <Name>Query(
    <Type> <Param>)            // params de filtro/id; para "listar" incluir page/pageSize
    : IRequest<<Name>Response>;   // + , IReadRequest  si el repo usa marker de lectura (ver nota)
```

> **Marker de lectura (opcional):** Si al **aprender del vecino** ves que las queries del repo llevan un marker de lectura (ej. `IReadRequest`), agregalo igual que el Command lleva `IWriteRequest`, con su `using`. Si el repo no usa marker de lectura (o es inconsistente), omitilo: `IRequest<...>` solo alcanza.

## `<Name>QueryHandler.cs`

```csharp
using <AppRoot>.Application.Abstractions.Persistence;
using <AppRoot>.Application.Exceptions._4XX;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace <AppRoot>.Application.Features.<Area>.Queries.<Name>;

public sealed class <Name>QueryHandler(IAppDbContext db)
    : IRequestHandler<<Name>Query, <Name>Response>
{
    public async Task<<Name>Response> Handle(<Name>Query request, CancellationToken ct)
    {
        // GET por id: proyectar y throw NotFoundException si no existe.
        var item = await db.<Set>
            .AsNoTracking()
            .Where(x => x.Id == request.<Param>)
            .Select(x => new <Name>Response(x.<Field1>, x.<Field2>))
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("<Entidad>");
        return item;
    }
}
```

## `<Name>Response.cs`

```csharp
namespace <AppRoot>.Application.Features.<Area>.Queries.<Name>;

public sealed record <Name>Response(
    <Type> <Field>);
```

> **Paginación**: para "listar", el Response es un record con `Items` + total/`page`/`pageSize`, y el handler aplica `.Skip((page - 1) * pageSize).Take(pageSize)` (seguir el patrón de un feature de listado existente en el repo si lo hay). Las queries normalmente **no** llevan Validator, salvo que los params lo requieran.
