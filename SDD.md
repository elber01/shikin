# Shikin — Software Design Document (SDD)

> **Rol de este documento:** fuente única de verdad del **diseño** de Shikin y
> de su migración hacia Spec-Driven Development, MCP y multiagentes.
> Bajo SDD, la spec precede al código: ningún cambio de arquitectura o
> contrato se implementa sin reflejarse aquí primero.
>
> Documentos hermanos: reglas operativas → `AGENTS.md` · protocolo de agentes
> de desarrollo → `agent.md` · agente orquestador runtime →
> `agents/orchestrator.md` · memoria viva → `MEMORY.md` · catálogo de
> capacidades → `skills.md` · cronología detallada → `worklog.md`.

## 1. Arquitectura General

- **Patrón Principal:** Monolito modular con Next.js 16 (App Router), Prisma 6 + Turso (libSQL) y API v1 orientada a integración con agentes.
- **Modelo Contable:** Doble entrada con cuentas reales (Asset, Liability, Equity, Investment) y cuentas virtuales (`x_<categoryId>`) para Ingresos y Gastos.
  - Gasto: `fromAccountId` = cuenta real → `toAccountId` = `x_<categoryId>`.
  - Ingreso: `fromAccountId` = `x_<categoryId>` → `toAccountId` = cuenta real (espejo del gasto).
  - Net worth = `asset + investment + equity − liability` (`src/lib/finzen/finance.ts`); las cuentas virtuales `income`/`expense` NO cuentan como riqueza.
- **Fail-Fast:** La aplicación exige `DATABASE_URL` válida en producción (Turso via `@prisma/adapter-libsql`) y `NEXTAUTH_SECRET`.
  - `src/lib/db.ts` se rehúsa a servir con SQLite efímero en producción (fix del hallazgo P0-1: cada lambda perdía datos). El `url` de `schema.prisma` es un placeholder de validación; la conexión real la construye el adapter en runtime.
- **Estado en cliente:** Zustand (`src/store/finzen-store.ts`) es la fuente única del cliente; sus interfaces son la frontera de tipos y deben permanecer sincronizados con `prisma/schema.prisma` (la asignación cruda en `loadData` hace que un drift compile pero rompa en runtime).
- **Navegación:** el shell vive en `src/app/page.tsx` (ruta única `/`); las vistas se direccionan con `?view=<viewKey>` y se sincronizan con el store mediante `src/components/finzen/view-route-sync.tsx`. La paleta de comandos (`src/components/finzen/command-palette.tsx`) y el diálogo de atajos (`shortcuts-dialog.tsx`) son UI pura: no alteran ningún contrato de API.
- **Undo (10-U3):** las eliminaciones iniciadas en la UI conservan un snapshot autoritativo del objeto eliminado en memoria del cliente durante 10 segundos. `POST /api/undo`, autenticado con sesión interna, restaura el registro con su ID original. No existe tabla de undo ni persistencia del snapshot: recargar, cerrar la pestaña o cerrar sesión descarta la posibilidad de deshacer.
- **Filtros y drill-down (10-U4):** la vista de transacciones es direccionable con filtros en la query: `/?view=transactions&category=<id>&account=<id>&type=<income|expense|transfer|adjustment>&from=YYYY-MM-DD&to=YYYY-MM-DD&q=<texto>`. La **URL es la fuente de verdad** de los filtros; no hay estado de filtros en el store (el único buffer local es el input de búsqueda, que se re-sincroniza con la URL). El parseo es total: un parámetro inválido se descarta sin error visible.
- **Capa de servicios (objetivo de la migración):** hoy la lógica de negocio vive inline en los route handlers de `src/app/api/**`. La migración la extrae a `src/lib/services/` para que API REST, UI y servidores MCP consuman las mismas funciones testeables.

## 2. Contratos de API Pública v1

- **Autenticación:** Header `X-API-Key` o `Authorization: Bearer fz_...` (validación SHA-256 + Rate Limit de 60 req/min).
  - Las keys se almacenan SOLO como hash SHA-256 (`src/lib/auth/api-key.ts`); la clave cruda nunca se loguea; permisos `read`/`read,write` (mutaciones con key sin `write` → `403 forbidden`); expiradas o desactivadas → `401`.
- **Rate limit compartido (Fase 0):** 60 req/min por **API key** (identificador = hash SHA-256 de la key; **nunca** la key cruda), ventana **fija anclada al primer hit** de cada key, contador en la tabla `RateLimitBucket` de Turso (**1 fila por principal**, sentencia atómica `INSERT … ON CONFLICT DO UPDATE … RETURNING`). El **mismo cubeto** lo comparten `/api/v1/*` y las rutas legacy `/api/agent/*` (un agente no puede saltarse el límite cambiando de ruta). Si el almacén compartido no está disponible (tabla ausente en prod, Turso caído, timeout), el limitador **degrada al contador en memoria por instancia** (comportamiento previo) y registra un log saneado (`reason: table_missing|timeout|unknown`); **nunca** devuelve 5xx por este motivo. Con `FINZEN_RATE_LIMIT_FAIL_MODE=strict` responde `503 rate_limit_unavailable` en lugar de degradar (modo reservado a la exposición MCP, Fase 3).
  - Contrato 429: `{ success: false, error: 'rate_limited', message }` + headers `Retry-After: <s>`, `X-RateLimit-Limit: 60`, `X-RateLimit-Window: 60s` (+ `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset: <unix s>`).
- **Errores:** SIEMPRE `{ success: false, error: "<codigo_snake_case>", message }`.
- **Rutas Principales:**
  - `POST /api/v1/expenses`: Registra gasto (`fromAccountId` real → `toAccountId` virtual).
  - `POST /api/v1/incomes`: Registra ingreso (`fromAccountId` virtual → `toAccountId` real).
  - `GET /api/v1/summary`: Resumen mensual consolidado (`expenses`, `income`, `net`).
  - `GET /api/v1/accounts`: Listado de cuentas del usuario (`?type=&currency=`).
  - `POST /api/v1/accounts`: Crea cuenta real (`asset`|`liability`) con `name`, `subType`, `currency` (DOP|USD), `currentBalance`, `institution`, `lastFour` → `201 { success, account }`. Permite al agente mantener el net worth (préstamos/inversiones) sin intervención humana.
  - `PATCH /api/v1/accounts/:id`: Edición parcial de campos seguros (`name`, `currentBalance`, `institution`, `lastFour`, `subType`). `currentBalance` es **ajuste directo** (los saldos de préstamos/inversiones vienen del banco; NO se recalculan desde transacciones). `currency`/`accountType` → `422 field_not_editable`.
  - `DELETE /api/v1/accounts/:id`: Protege el historial — si la cuenta tiene transacciones (`fromAccountId`/`toAccountId`) → `409 account_has_transactions` (+ `transactionCount`); vacía → borrado físico `200 { success, id, deleted: true }`.
  - Complementarias: `GET /api/v1/expenses|incomes` (`?limit` def 50 máx 200, `?month=YYYY-MM`) y `PATCH`/`DELETE /api/v1/expenses|incomes/:id`.
- **Convenciones de payload (innegociables):**
  - `amount > 0` obligatorio; `currency` `DOP`|`USD` (default `DOP`).
  - Cuentas: `accountType` `asset`|`liability` (default `asset`); `subType` `checking|savings|credit_card|cash|crypto_wallet|investment|loan` (default `checking`, alias `credit`→`credit_card`); `currentBalance` número finito (default `0`; pasivo se almacena positivo = deuda).
  - Toda la lógica de cuentas vive en `src/lib/services/accounts-service.ts` (primer servicio de la capa de la Fase 1); las rutas v1 y la interna `/api/accounts` son adaptadores delgados que comparten el servicio y su guard de integridad.
  - `category` texto libre con fuzzy-match (`name`/`nameEs`) y **autocreación** (`src/lib/finzen/v1-helpers.ts`).
  - El **color de categoría no es parte del contrato v1**: las rutas v1 no aceptan `color` y la autocreación deja `color = null` → la vista resuelve el token de fallback (`cat-12`). Si en el futuro v1 llegara a aceptar color, solo admite claves `cat-N` (nunca HEX).
  - Cuenta con prioridad `account_id` > `accountId` > `account` > default; si el usuario especificó una y no existe → `422 account_not_found` (sin fallback silencioso).
  - `date` ISO (default hoy); `importSource: 'api_v1'`; `tags: 'api_v1'`.
- **Rutas legacy `/api/agent/*` (deprecadas en Fase 0):** siguen operativas (Fase 0 **no** las borra) pero quedan **deprecadas**: (a) autentican con el mismo `authenticateV1Request` (aceptan `X-API-Key` y `Authorization: Bearer`), (b) comparten el cubeto de rate limit con v1, (c) normalizan sus errores a `{ success: false, error: "<snake_case>", message }` — el **shape de éxito no cambia** (solo se añade `success: true`) — y (d) responden **siempre** con `Deprecation: true`, `Sunset: Sun, 14 Feb 2027 00:00:00 GMT` y `Link: <sucesor v1>; rel="successor-version"`. No existe sucesor v1 para la **capacidad completa** de `GET /api/agent/summary` (net worth / progreso de presupuesto / alertas) ni para `GET /api/agent/categories`: su retiro queda **condicionado** a la Fase 1 (capa de servicios) y el `Sunset` se prorroga si el sucesor aún no existe. El `Link` de `summary` apunta a `/api/v1/summary` como **sucesor parcial** (resumen mensual, sin net worth ni presupuestos); `categories` **no** emite `Link`.
- **Nota U3 (10-nov-2026):** U3 no cambia ningún payload, status code ni código de error de `/api/v1/*`. Un DELETE ejecutado por la API v1 o por un agente sigue siendo físico y no genera un snapshot de undo en la UI. `/api/undo` es un endpoint **interno de sesión** y no forma parte de la API pública v1.
- **Nota U4 (15-nov-2026):** U4 no cambia ningún payload, status code ni código de error de `/api/v1/*`. El drill-down es navegación interna del shell (query params de la ruta `/`), no un contrato de API. La única dependencia nueva del proyecto es el runner de tests (Vitest + Vite, en `devDependencies`); no altera los contratos v1 ni el modelo de datos.

## 3. Estrategia de Extensión MCP (Model Context Protocol)

- Las capacidades de `src/lib/services/` y `src/lib/finzen/v1-helpers.ts` se expondrán como Servidores MCP usando `@modelcontextprotocol/sdk`.
  - `src/lib/services/` se crea en la Fase 1 (§6) extrayendo la lógica de los route handlers; `v1-helpers.ts` ya es código de servicio reutilizable tal cual.
- Reutilización directa de la autenticación por `ApiKey` existente: una misma key del usuario autentica la API REST y las tools MCP (misma tabla `ApiKey`: hash, permisos, `isActive`, `expiresAt`, `lastUsedAt`).
- **Catálogo inicial de tools** (inventario completo con estado en `skills.md`):

  | Tool MCP | Origen de la capacidad hoy |
  |---|---|
  | `record_expense` / `record_income` | Routes v1 + `v1-helpers` (resolución fuzzy de categoría y cuenta) |
  | `create_account` / `update_account` / `delete_account` | Routes v1 `POST /api/v1/accounts` + `PATCH`/`DELETE /api/v1/accounts/:id` + servicio `src/lib/services/accounts-service.ts` |
  | `list_transactions` | `GET /api/v1/expenses|incomes` + legacy `/api/agent/transactions` |
  | `get_financial_summary` | `GET /api/v1/summary` |
  | `get_net_worth` / `budget_progress` / `alerts` | `finance.ts` + legacy `/api/agent/summary` (ya lo computa server-side) |
  | `convert_currency` | `currency.ts` — **requiere proveedor de FX con caché** (hoy tasas estáticas) |
  | `parse_receipt` | `ocr.ts` — **migrar de cliente a servidor** (hoy tesseract.js en navegador) |
  | `import_csv` | `import-view.tsx` → `POST /api/restore` (bulk idempotente) |
  | `import_bank_statement` | `ofx.ts` + `bank-presets.ts` + `bank-import-flow.tsx` (CSV con presets de bancos dominicanos y OFX/QFX estándar; dedup idéntico al de CSV) |

- **Transporte:** HTTP streamable para convivir con la app en Vercel; `stdio` solo para desarrollo local.
- **Rate limiting:** Fase 0 — limitador compartido sobre Turso (`RateLimitBucket`, 1 fila por principal, ventana fija anclada, 60 req/min por key) con degradación a memoria si el almacén no está disponible. El MCP (Fase 3) y la consola in-app reutilizan **el mismo limitador** con otro *scope* (`user:<id>`, `session:<id>`): **no** habrá una segunda implementación.
- **Regla SDD para tools:** cada tool MCP nace de (1) un skill documentado en `skills.md`, (2) una función de servicio testeable en `src/lib/services/`, (3) su contrato reflejado en este documento, y (4) el nombre que invoca el Agente Orquestador (`agents/orchestrator.md`). Nunca lógica inline en el handler.

## 4. Modelo de Datos (`prisma/schema.prisma`)

9 modelos, dialecto SQLite con `previewFeatures = ["driverAdapters"]`:

| Modelo | Rol | Campos / convenciones clave |
|---|---|---|
| `User` | Dueño de todos los datos | `email` unique, `passwordHash`, `preferredLang`, `baseCurrency`, `theme` |
| `Session` | NextAuth | `sessionToken` unique (producción usa JWT; el modelo queda por compatibilidad) |
| `Account` | Cuentas reales y virtuales | `accountType` asset\|liability\|equity\|income\|expense · `subType` · `currency` · `currentBalance` |
| `Category` | Clasificación | `name`/`nameEs`/`nameEn`, `direction` income\|expense\|transfer, `isSystem`, `sortOrder`, `userId` nullable (globales del sistema), `color` = **clave de token** `cat-1..cat-12` (nunca HEX — el CSS se resuelve en la vista) |
| `Transaction` | Asiento double-entry | `type` income\|expense\|transfer\|adjustment · `fromAccountId`/`toAccountId` (reales o `x_<categoryId>`) · `categoryId` (SetNull) · `tags` (string CSV) · `importSource` |
| `Budget` / `BudgetItem` | Presupuestos | `period`, `plannedAmount`, `alertThresholdPct` (default 80) |
| `ApiKey` | Integración IA | `keyHash` unique SHA-256 · `keyPrefix` · `permissions` (CSV) · `lastUsedAt` · `expiresAt` · `isActive` |
| `RateLimitBucket` | Rate limit compartido (Fase 0) | `id` = *scope* (`key:<sha256>`; nunca la key cruda) · `hits` · `windowStartMs`/`expiresAtMs`/`updatedAtMs` = **BigInt** (epoch-ms; **no cabe en `Int`/Int32** — Prisma+SQLite rechaza la conversión) · 1 fila por principal · **sin** relación con `User`/`ApiKey` (el scope es opaco: el limitador servirá también a `user:`/`session:`) |

- La relación Account↔Transaction es **por convención de strings, sin FK** — es lo que habilita los IDs virtuales `x_<categoryId>`.
- Índices: `[userId, occurredOn]`, `[fromAccountId]`, `[categoryId]` (Transaction); `[userId]` (Account, Category, ApiKey).
- `schema.prisma` es la única fuente de verdad de datos.

## 5. Convenciones Transversales (resumen; detalle en `AGENTS.md` §5)

1. Monedas: siempre `CurrencyCode` (`USD|DOP|EUR|USDT|BTC`) + utilidades de `src/lib/finzen/currency.ts`; montos con `tabular-nums`.
2. i18n: toda string visible en `src/lib/finzen/i18n.ts` (es + en), consumida con `translations[locale]`.
3. UI: solo tokens semánticos (`bg-surface`, `var(--income)`, …). Prohibidos colores crudos y datos decorativos falsos (deltas/sparklines sin base real no se muestran).
4. Seguridad: keys solo hasheadas; jamás loguear la clave cruda; secrets fuera del código; `.env` gitignored.
5. React Compiler: disables puntuales SOLO para `react-hooks/preserve-manual-memoization` cuando las deps derivan de `new Date()`.
6. Verificación obligatoria al cerrar cualquier tarea: `bun run lint && bun run typecheck && bun run build`.
7. **Color de datos = token (convención 10-U1):** las categorías se colorean con los tokens `--cat-1..--cat-12` (light + dark en `src/app/globals.css`). `Category.color` guarda la **clave** (`cat-7`), nunca un HEX; un valor desconocido o heredado se normaliza al fallback `cat-12` con el vecino más cercano en OKLab. Prohibido inyectar HEX en `style` o en props de gráficos. La lógica de normalización vive en `src/lib/finzen/category-color.ts` y se aplica en el servicio de categorías (`src/lib/services/categories-service.ts`); la migración de datos existentes es un script aparte, idempotente y con rollback (`scripts/migrate-category-colors.ts`).
8. **Deep-links de vista, command palette y navegación por teclado (convención 10-U2):** el shell es una **única ruta `/`** y cada vista es direccionable por el query param `/?view=<viewKey>`, donde `viewKey` ∈ `VIEW_KEYS` (fuente de verdad única: `src/lib/finzen/views.ts`). La URL es la fuente de verdad del deep-link y el store Zustand la refleja en `activeView`; todo cambio de vista hace `router.push('/?view=…')` para que el back/forward del navegador funcione. Como `/` se **prerenderiza estáticamente**, `useSearchParams()` solo puede usarse dentro de un límite `<Suspense>` (error de build: `useSearchParams() should be wrapped in a suspense boundary`). La **command palette** (`cmdk`, ya instalada — cero dependencias nuevas) se abre con `⌘K`/`Ctrl+K` y ofrece navegación de vistas, acciones frecuentes (nueva transacción, exportar, atajos) y búsqueda de transacciones; todas sus strings visibles viven en `src/lib/finzen/i18n.ts` (es + en). Los atajos globales son `⌘K`/`Ctrl+K` (paleta), `?` (ayuda de atajos), `Alt+1..7` (vista N) y `Alt+N` (nueva transacción), y se ignoran dentro de campos editables y con modales abiertos (única excepción: `⌘K`/`Ctrl+K` también funciona con el foco en un campo editable, como en los editores estándar).
9. **Undo y límites de error (convención 10-U3):** los borrados iniciados por la UI ofrecen un único undo de 10 segundos mediante `sonner`. El snapshot vive solo en memoria y una nueva eliminación lo reemplaza. **Cada borrado emite un recibo firmado en servidor (HMAC-SHA256, clave derivada de `NEXTAUTH_SECRET` con contexto de dominio) que liga `userId` + `kind` + `id` + hash del snapshot**; `POST /api/undo` valida el recibo **antes de cualquier escritura**, de modo que un snapshot fabricado, alterado o belonging a otro usuario se rechaza (`invalid_undo_payload`). La restauración usa un servicio en `src/lib/services/undo-service.ts` y conserva el ID y los campos de negocio originales; nunca fabrica cuentas virtuales `x_<categoryId>`. Las importaciones masivas solo se revierten si ninguna fila cambió. Los errores de render se contienen con `error.tsx`, `global-error.tsx` y un boundary de componente; los fallos de acciones del usuario se muestran como toast, no como pantalla completa.
10. **Drill-down y filtros en URL (convención 10-U4):** los agregados de Dashboard, Reportes, Presupuestos y Cuentas son navegables: el destino es siempre `?view=transactions` con filtros (`category`, `account`, `type`, `from`, `to`, `q`). La **URL es la fuente de verdad** de los filtros (compartible, con back/forward del navegador); la vista de transacciones los parsea, los canonicaliza y los escribe de vuelta por `useViewNavigation().navigate('transactions', { filters })`. Los parámetros inválidos se descartan de forma silenciosa y determinista (mismo patrón total que `parseViewKey`: `type` fuera de enum, fecha inexistente o id malformado → se ignoran; `from > to` → se normaliza). Un filtro que apunta a una categoría o cuenta que ya no existe muestra un aviso i18n y una acción de "quitar filtros", y ese filtro se trata como inactivo. Toda acción de drill-down es un `<button type="button">` real con `aria-label` i18n que incluye el dato real (categoría/cuenta + importe + periodo); los gráficos de `recharts` se exponen como `role="img"` + `aria-label` i18n y **nunca** son la única vía a una acción. Los agregados compuestos (patrimonio neto, ratio de ahorro, ahorro neto, total del presupuesto) **no** son clicables: no se crea una acción sin resultado real.
11. **Rate limit compartido y rutas legacy (convención 11-A0):** todo limitador nuevo usa `src/lib/services/rate-limit.ts` (interfaz `RateLimitStore` enchufable: hoy Turso/libSQL); un `Map` en memoria **nunca** es la autoridad (solo *fallback* degradado). El identificador del cubeto es el **hash SHA-256 de la key** (`key:<hash>`), nunca la key cruda, y el **mismo scope** lo usan v1 y legacy. Las rutas deprecadas responden `Deprecation: true` + `Sunset` + `Link … rel="successor-version"`, normalizan sus errores al shape v1 **sin cambiar su shape de éxito**, y su fecha de retiro se prorroga si el sucesor aún no existe.

## 6. Roadmap de Migración (SDD → Servicios → MCP → Multiagentes)

| Fase | Objetivo | Criterios de salida |
|---|---|---|
| **0 — Consolidación** | Deprecar `/api/agent/*` (o redirigir a v1) · rate limit sobre almacén compartido · limpiar dependencias muertas (`z-ai-web-dev-sdk`) · Vitest para `lib/finzen/` (finance, currency, date-utils — funciones puras) — **la parte de Vitest se adelanta a 10-U4**; quedan pendientes la deprecación de `/api/agent/*`, el rate limit compartido y la limpieza de `z-ai-web-dev-sdk` | Triple verificación ✓ · tests de dominio ✓ · E2E curl v1 ✓ · **Estado (15-nov-2026):** Vitest adelantado a 10-U4 ✓ · rate limit compartido **implementado en código** — **pendiente la operación de prod** (`RateLimitBucket` en Turso: requiere `DATABASE_URL` + visto bueno del dueño) · `/api/agent/*` **deprecadas** (normalizadas, con rate limit compartido y headers; no se borran) · auditoría de dependencias: `@radix-ui/react-progress` y `@types/bcryptjs` eliminados; `zod` **se conserva** (reservada al bloque de agentes) |
| **1 — Capa de servicios** | Extraer la lógica de `src/app/api/**` a `src/lib/services/` (transactions, accounts, budgets, alerts); los routes quedan como adaptadores delgados | Contratos v1 intactos (E2E existentes como red de seguridad) · cobertura de servicios |
| **2 — SDD formal** | Specs por feature · `skills.md` como catálogo vivo · tipos compartidos generados (fin del drift store↔Prisma) | Toda capacidad nueva nace documentada en `skills.md` antes de codificarse |
| **3 — Servidor MCP** | Tools MCP sobre `src/lib/services/` con `@modelcontextprotocol/sdk`, auth por `ApiKey`, transporte HTTP | E2E MCP con API key real · rate limit compartido operativo |
| **4 — Multiagentes** | Roles definidos en `agent.md` (arquitecto, implementador, verificador, ops) operando con skills + MCP | Un flujo completo ejecutado por agentes con verificación automática |

- Cada fase cierra con: triple verificación ✓ + tests de la fase + `MEMORY.md` actualizado + entrada en `worklog.md`.
- Ninguna fase rompe el contrato v1 existente.

## 7. Riesgos y Deuda Vigilados (detalle en `MEMORY.md` §5)

1. ~~**Cero tests automatizados.**~~ **PARCIALMENTE RESUELTO (10-U4, 15-nov-2026):** Vitest sobre Node con `bun run test` integrado en `bun run verify` (lint + typecheck + test + build). Suites: P0 (recibo HMAC + `undo-service`), P1 (dominio puro: `category-color`, `views`, `currency`, `finance`, `export`, `transaction-filters`), P2 (paridad es/en con placeholders + contrato de error v1 `{ success: false, error: <snake_case> }`), P3 (servicios contra un SQLite temporal, opcional). **Pendiente:** E2E end-to-end (Playwright) y cobertura con umbral.
2. **FX estáticas** — la tool `convert_currency` exige proveedor externo con caché.
3. ~~**Rate limit en memoria**~~ **PARCIALMENTE RESUELTO (Fase 0):** limitador compartido sobre Turso implementado y probado; **pendiente la creación de la tabla en prod** (operación autorizada por el dueño). Hasta entonces opera en modo *fallback* (memoria por lambda). **Sigue bloqueando la Fase 3** hasta que la verificación de control en prod confirme el 429.
4. **Secreto NextAuth en historial de git** — rotar en Vercel si aún coincide.
5. **Dualidad `/api/v1` vs `/api/agent`** — **RESUELTO en Fase 0 (deprecación)**: las 4 rutas legacy comparten auth y rate limit con v1, normalizan sus errores al shape v1 y emiten headers de deprecación con `Sunset: Sun, 14 Feb 2027 00:00:00 GMT`. **Pendiente Fase 1:** successors v1 para `netWorth`/`budgetProgress`/`alerts` y `categories`, y el retiro físico de las legacy.
6. **Drift de tipos store↔Prisma** — asignación `any` en `loadData`; resolver con generación de tipos (Fase 2).
7. **DELETE de cuentas sin verificar referencias** — ~~deja transacciones huérfanas~~ **RESUELTO (8.2, 22-oct-2026)**: guard en el servicio compartido `accounts-service.ts`; las rutas v1 e interna `/api/accounts/:id` rechazan con `409 account_has_transactions` cuando la cuenta tiene transacciones.
