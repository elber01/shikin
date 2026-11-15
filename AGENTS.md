# AGENTS.md — Reglas operativas de Shikin

Guía obligatoria para **agentes IA y desarrolladores** que trabajen en este repo.
Objetivo: desarrollo sostenible — que cualquier sesión nueva produzca código
consistente, verificado y sin regresiones.

> Memoria histórica del proyecto: ver **`MEMORY.md`**.
> Estado técnico detallado por fase: ver **`worklog.md`**.

---

## 1. Qué es Shikin

App web de finanzas personales y del hogar: multi-moneda (USD/DOP/EUR/USDT/BTC),
español/inglés, claro/oscuro, OCR de recibos, presupuestos, reportes y una
**API pública v1** para agentes de IA (gastos, ingresos, resúmenes, cuentas).

## 2. Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict |
| UI | Tailwind CSS 4 + shadcn/ui + Radix + lucide-react + recharts |
| Animación | framer-motion (`ViewTransition` en vistas del shell) |
| Estado | Zustand (`src/store/finzen-store.ts`) — fuente única en cliente |
| Datos | Prisma 6 + Turso (libSQL) en prod; SQLite `file:` en dev |
| Auth | NextAuth v4 (Credentials + JWT, 30 días) |
| Runtime | **Bun** (no npm/node) |

## 3. Comandos esenciales

```bash
bun install              # dependencias
bun run dev              # http://localhost:3000 (puerto 3000)
bun run lint             # ESLint — DEBE pasar sin errores
bun run typecheck         # tsc --noEmit — DEBE pasar sin errores
bun run build            # build de producción (Next + standalone)
bun run db:push          # aplica schema.prisma a DATABASE_URL
bun run db:generate      # regenera cliente Prisma tras editar schema
```

### Checklist de verificación — OBLIGATORIO antes de dar por terminada cualquier tarea

```bash
bun run lint && bun run typecheck && bun run build
```

Si algo falla, se arregla **antes** de cerrar la tarea. No existen tests
automatizados todavía (ver deuda en `MEMORY.md`), así que esta triple
verificación es la barrera de calidad mínima.

## 4. Arquitectura clave (leer antes de tocar)

### Double-entry con cuentas virtuales
- Cada `Transaction` mueve `fromAccountId` → `toAccountId`.
- Un ID de cuenta puede ser **real** (cuenta del usuario) o **virtual** con
  formato `x_<categoryId>` (asiento de gasto/ingreso por categoría).
- **Net worth** (`src/lib/finzen/finance.ts`): `asset + investment + equity − liability`.
  Las cuentas `income`/`expense` son virtuales y NO cuentan.
- Las **transferencias** entre cuentas reales no alteran el net worth.

### Base de datos — Turso con fail-fast
- `src/lib/db.ts`: en producción **exige** `DATABASE_URL` (`libsql://...`) y se
  rehúsa a arrancar sin ella (P0-1 de la auditoría 27-sep-2026: con SQLite
  efímero cada lambda perdería datos).
- En dev sin `DATABASE_URL` → SQLite local `file:db/custom.db` con seed.
- El `url` de `schema.prisma` es un placeholder fijo; la conexión real la
  construye el adapter `@prisma/adapter-libsql` en runtime.

### Autenticación
- Interna (rutas `/api/*`): `getServerSession(authOptions)` → `session.user.id`.
- El tipo `session.user.id` existe gracias a la augmentación en
  `src/types/next-auth.d.ts` — **no** usar `as any` para acceder a él.
- Pública (rutas `/api/v1/*`): header `Authorization: Bearer fz_...` o
  `x-api-key`; las ApiKey se almacenan solo como **hash SHA-256**
  (`src/lib/auth/api-key.ts`).

### Frontera de tipos cliente↔servidor
- Los interfaces del store (`Transaction`, `Account`, `Category`, `Budget`) son
  la frontera de tipos del cliente y **deben mantenerse sincronizados** con
  `prisma/schema.prisma`. `loadData` asigna JSON crudo (`any`), por lo que un
  drift aquí compila pero rompe en runtime.
- Monedas: SIEMPRE `CurrencyCode` (`'USD'|'DOP'|'EUR'|'USDT'|'BTC'`) y las
  utilidades de `src/lib/finzen/currency.ts` (`convertAmount`, `formatMoney`).

## 5. Convenciones de código

### UI/UX — estrictas
- **Solo tokens semánticos**: `bg-surface`, `text-muted-foreground`,
  `var(--income)`, `var(--expense)`, etc. PROHIBIDO `bg-white`, `text-gray-500`
  u otros colores crudos — rompen el dark mode y la identidad.
- **Color de categoría = token (convención 10-U1):** el color de una categoría
  se guarda como **clave** `cat-1..cat-12` (tokens `--cat-N` en
  `globals.css`, light + dark), nunca como HEX. Para pintar, usa
  `categoryColorVar()` / `categoryColorSoft()` de
  `src/lib/finzen/category-color.ts`; para escribir, deja que
  `categories-service.ts` normalice. Un HEX heredado se acepta al leer pero
  **nunca** se inyecta en `style` o en props de gráficos.
- **Nada de datos decorativos falsos**: deltas "+0%", sparklines inventados o
  placeholders de sesión son deuda UX. Si no hay dato real, no se muestra el
  elemento (ver `computeDelta` que devuelve `undefined` sin base de
  comparación).
- Toda string visible va en `src/lib/finzen/i18n.ts` (es + en) y se consume con
  `translations[locale]`. Nada de texto suelto bilingüe en componentes.
- Números de dinero: clase `tabular-nums` + `formatMoney`.
- Estados de carga: `Skeleton`; estados vacíos: mensaje + acción clara.
- Accesibilidad: `aria-label` en botones de icono, `aria-current` en navegación
  activa, `aria-live` en feedback dinámico.
- **Filas de stats responsive (convención 8.7):** un grid de stats 3-col se
  apila bajo su breakpoint según el techo de fuente — `3-col desde md` si el
  techo es `text-xl`, `desde lg` si es `text-2xl`; `*:min-w-0` en el grid;
  montos con `break-words` (el dinero se envuelve, jamás ellipsis).

### Deep-links, command palette y navegación por teclado (10-U2)
- **Fuente de verdad de las vistas:** `src/lib/finzen/views.ts` → `VIEW_KEYS` +
  `ViewKey`. **Nunca** redeclarar el union de vistas en otro fichero; el store
  solo re-exporta el tipo. Los mapas de vistas (`VIEWS`, `VIEW_REGISTRY`) son
  `Record<ViewKey, …>` → `tsc` falla si falta una vista.
- **URL:** la vista se direcciona con `/?view=<viewKey>`; `view` ausente o
  inválido → `dashboard`. Todo cambio de vista pasa por
  `useViewNavigation().navigate()` (que hace `router.push`) → el back/forward
  del navegador funciona. **Prohibido** llamar `setActiveView` desde un
  componente.
- **`useSearchParams()`** solo dentro de un límite `<Suspense>` (la ruta `/`
  es prerenderizada estáticamente; sin el límite el build falla con
  `missing-suspense-with-csr-bailout`).
- **Paleta:** `src/components/finzen/command-palette.tsx` compone
  `ui/dialog.tsx` + `ui/command.tsx` **sin editarlos**. `cmdk` ya está
  instalado: **cero dependencias nuevas** (nada de `react-hotkeys`,
  `downshift`…). El `aria-label` del listbox y el nombre accesible del input
  van **siempre** en i18n (el default de cmdk es "Suggestions", en inglés).
- **Atajos globales:** `⌘K`/`Ctrl+K` (paleta) · `?` (ayuda) · `Alt+1..7`
  (vista N) · `Alt+N` (nueva transacción). Se ignoran con el foco en un campo
  editable o con un modal abierto, **única excepción: `⌘K`/`Ctrl+K`**, que
  también funciona con el foco en un campo editable (comportamiento estándar
  de los editores; con un modal abierto sí se ignora). `Esc`/`Tab` los aporta
  Radix (`FocusScope trapped`) — no reimplementarlos. La tabla de atajos vive
  en **una** constante compartida por el handler y el diálogo de ayuda.
- **Foco:** el cierre de la paleta restaura el foco al botón trigger
  (`onCloseAutoFocus`); si la acción pendiente abre otro diálogo, ese diálogo
  gestiona su propio foco.

### Undo y error boundaries (10-U3)
- **Snapshot solo en memoria:** nunca `localStorage`/`sessionStorage` (son
  descripciones y nombres financieros). Recargar, cerrar la pestaña o cerrar
  sesión **descarta** el undo.
- **Recibo firmado obligatorio:** cada DELETE emite un recibo HMAC-SHA256
  (clave derivada de `NEXTAUTH_SECRET` con contexto de dominio) que ata
  `userId` + `kind` + `id` + hash del snapshot. `POST /api/undo` lo valida
  **antes de escribir**: sin recibo válido no hay restauración. El snapshot
  viene del cliente → **nunca** se confía en él (ni en su `userId`, ni en su
  `isSystem`, ni en que "existió"): el recibo es la prueba de propiedad.
- **Ownership estricto:** una categoría solo es restaurable si es del usuario
  de la sesión o es del sistema global (`userId: null` **y** `isSystem: true`).
  `isSystem: true` con `userId` de otra persona **no** autoriza. Un snapshot
  de categoría con `isSystem !== false` se rechaza.
- **Un solo undo pendiente**, no una pila: una eliminación nueva lo reemplaza
  (y descarta el toast anterior con `toast.dismiss`).
- **Restaurar con servicio** (`src/lib/services/undo-service.ts`); el route
  handler (`src/app/api/undo/route.ts`) es un adaptador delgado con
  `getServerSession`. El `userId` sale **siempre** de la sesión, nunca del
  snapshot.
- **Preservar ID y campos de negocio** al restaurar; **nunca** fabricar filas de
  cuenta virtual `x_<categoryId>` (es una convención de string). Si falta una
  dependencia → `409 undo_dependency_missing`, sin escritura parcial.
- **Importación masiva = todo o nada:** si una fila del lote cambió, se aborta
  el lote entero (`409 undo_batch_conflict`) y no se borra ninguna fila.
- **Todo texto visible en `i18n.ts`** (es + en). Toast de Sonner (región
  `aria-live="polite"`) para el undo; fallback de error con `role="alert"`.
- **Los errores de acciones del usuario → toast**, nunca pantalla completa.
  Los boundaries (`app/error.tsx`, `app/global-error.tsx` y
  `view-error-boundary.tsx`) solo contienen errores de render/lifecycle.
- **Logging saneado:** solo tipo, digest y stack. **Nunca** emails,
  descripciones, nombres de cuenta, API keys, headers ni snapshots de undo.

### React Compiler (importante)
El ESLint usa React Compiler. Los `useMemo` cuyas dependencias derivan de
`new Date()` (impuro) no se pueden preservar y generan el error
`react-hooks/preserve-manual-memoization`. Convención del repo: deshabilitar
**solo esa regla, solo esa línea**:

```tsx
// eslint-disable-next-line react-hooks/preserve-manual-memoization -- deps derivan de new Date()
}, [transactions, viewYear, viewMonth, baseCurrency]);
```

### Dominio, i18n y export (convención 10-U0)
- **Nombre localizado de categoría:** usar SIEMPRE
  `localizedCategoryName(cat, locale)` de `src/lib/finzen/localize.ts`.
  Prohibido reintroducir el ternario `cat.nameEs || cat.name` (estaba
  duplicado en 11 vistas).
- **Export de transacciones:** usar SIEMPRE `src/lib/finzen/export.ts`
  (`exportTransactionsCsv` / `exportTransactionsJson` / `downloadTextFile`).
  No reimplementar el escape RFC 4180 ni el header
  `Date,Type,Amount,Currency,Description,Category,Account`. El JSON de
  respaldo debe conservar `id`, `tags` e `importSource` verbatim (los usa
  `POST /api/restore`, que preserva IDs).
- **Errores del servidor:** `apiFetch` (`src/store/finzen-store.ts`) lanza una
  `ApiError` con `code` (y `transactionCount` cuando aplica). Los handlers
  muestran la **causa real traducida** con la clave i18n del código — nunca
  el mensaje crudo del servidor ni un "Error al eliminar" genérico.
- **Totales por periodo:** una sola fuente de verdad —
  `computeMonthlyFlows()` en `src/lib/finzen/finance.ts`. Si el gráfico y las
  tarjetas de totales usan periodos distintos, el usuario ve cifras que no
  cuadran (pasó en Reportes hasta 10-U0).

### Seguridad
- **Nunca** secrets en código ni commits. `NEXTAUTH_SECRET` es fail-fast en
  producción (excepción controlada solo durante `phase-production-build`).
- `.env` es gitignored y **el sandbox lo puede perder en reinicios** — si
  desaparece, regenerarlo localmente; los secretos reales viven en Vercel.

## 6. Mapa del repo

```
prisma/schema.prisma        # 8 modelos — fuente de verdad de datos
src/app/api/                # rutas internas (sesión) + /api/v1 (API keys)
src/components/finzen/      # vistas del shell + componentes de dominio
src/components/finzen/ui/   # design system propio (stat-card, empty-state, icon-button…)
src/components/ui/          # primitivas shadcn/ui (no editar salvo wrapper)
src/components/auth/        # formulario de login/registro
src/hooks/use-alerts.ts     # motor de alertas (presupuesto, spikes, forecast)
src/hooks/use-view-navigation.ts    # navigate(view) — único camino de navegación
src/hooks/use-global-shortcuts.ts   # atajos globales
src/hooks/use-undo.ts               # snapshot en memoria + toast + refresh
src/lib/finzen/undo.ts              # DTOs compartidos de undo (snapshot, comando, códigos)
src/lib/services/undo-service.ts    # restore idempotente + undo de lote importado
src/lib/finzen/error-report.ts      # reportero saneado de errores (sin datos personales)
src/components/finzen/view-error-boundary.tsx  # boundary de render de las vistas
src/app/error.tsx                   # boundary de ruta (Next)
src/app/global-error.tsx            # boundary global (autocontenido)
src/lib/finzen/             # dominio: currency, finance, i18n, ocr, date-utils
src/lib/finzen/views.ts     # contrato de vistas (ViewKey, VIEW_KEYS, parseViewKey)
src/lib/finzen/platform.ts  # detección de plataforma (badge ⌘K / Ctrl+K)
src/lib/auth/               # authOptions, api-key, verificación v1
src/store/finzen-store.ts   # estado global (Zustand) — ver §4
src/components/finzen/view-registry.tsx   # iconos + claves i18n de cada vista
src/components/finzen/view-route-sync.tsx  # URL (?view=) ↔ store
src/components/finzen/command-palette.tsx  # command palette (cmdk)
src/components/finzen/shortcuts-dialog.tsx # ayuda de atajos
src/types/next-auth.d.ts    # augmentación de tipos de NextAuth
scripts/                    # utilidades de BD/keys (ESM, se corren con bun)
db/                         # SQLite local de dev + schema.sql
```

### Añadir una vista nueva
1. Crear `src/components/finzen/<vista>-view.tsx`.
2. Añadir la clave a `VIEW_KEYS` (`src/lib/finzen/views.ts`).
3. Registrarla en `VIEWS` de `app-shell.tsx` y su icono/etiqueta en
   `VIEW_REGISTRY` (`view-registry.tsx`).
4. Añadirla a `MOBILE_PRIMARY`/`MOBILE_SECONDARY`/`MOBILE_MORE`
   (`bottom-tab-bar.tsx`).
5. Añadir sus claves a `i18n.ts` (es + en).

> Los mapas de vistas son `Record<ViewKey, …>` → `tsc` **falla** si falta una
> vista (anti-drift). No redeclares el union `ViewKey` fuera de `views.ts`.

### Añadir un endpoint API
- Interno: `getServerSession(authOptions)` + early return 401 si no hay
  `session.user.id`.
- Público v1: autenticar con `authenticateApiKey` (`src/lib/auth/v1-api.ts`);
  responder SIEMPRE `{ success: false, error: "<codigo_snake>" }` en errores.

## 7. Qué NO hacer

- ❌ Commit de `.env`, `*.db`, backups o binarios ajenos al proyecto.
- ❌ Usar SQLite efímero en producción (`FINZEN_ALLOW_EPHEMERAL_DB` es solo
  para demos desechables).
- ❌ Colores crudos o texto de UI sin i18n.
- ❌ Placeholders fake en KPIs/sesión ("Mi Perfil —", "+0%").
- ❌ `as any` para esquivar tipos — arreglar la raíz (ej: augmentación).
- ❌ Tocar `src/components/ui/*` salvo integración — son primitivas estándar.
- ❌ Cerrar una tarea sin que pasen `lint` + `typecheck` + `build`.
