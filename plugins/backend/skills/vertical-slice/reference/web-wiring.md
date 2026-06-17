# Web wiring (Request DTO + endpoint)

Los `<Placeholders>` son **formas, no literales** (ver [conventions.md](conventions.md)). El endpoint usa los helpers de `BaseApiController` (`Sender`, `Success`/`CreatedSuccess`); no los redeclares.

## `<Name>Request.cs` (en `Web/Contracts/<Area>/`)

```csharp
namespace <WebRoot>.Web.Contracts.<Area>;

public sealed record <Name>Request(
    <Type1> <Field1>,
    <Type2> <Field2>);   // espejo de los campos del Command/Query
```

## Endpoint (método a insertar en `<Area>Controller : BaseApiController`)

```csharp
[Authorize]                                  // o [AllowAnonymous]
[RequiresPermission("<area>", "<Action>")]   // si el repo usa permisos y aplica
[EnableRateLimiting("<policy>")]             // si aplica
[HttpPost("<route>")]                        // GET para query; PUT/DELETE segun corresponda
public async Task<IActionResult> <Name>([FromBody] <Name>Request request, CancellationToken ct)
{
    var result = await Sender.Send(new <Name>Command(request.<Field1>, request.<Field2>), ct);
    return Success(result, "<mensaje en espanol>");   // o CreatedSuccess(...) en creaciones
}
```

## Reglas de inserción / creación del controller

- Si `<Area>Controller.cs` **existe**: insertar el método **antes** de la llave de cierre de la clase; agregar los `using` del Command/Request si faltan; no tocar lo demás.
- Si **no existe**: crearlo siguiendo el patrón del repo: `[Route("api/<area>")] public sealed class <Area>Controller : BaseApiController`, con los `using` necesarios.
- Para **query/GET**: usar params `[FromQuery]` en vez de `[FromBody]`; sin Request DTO si son pocos params primitivos.
- El `Sender`, `Success` y `CreatedSuccess` vienen de `BaseApiController` (no redeclararlos).
