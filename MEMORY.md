# MEMORY.md — Memoria viva de Shikin

> **Propósito:** que cualquier persona o agente IA que inicie una sesión nueva
> entienda el proyecto SIN leer los 282KB de `worklog.md`. Cronología detallada
> → `worklog.md`. Reglas operativas → `AGENTS.md`.
>
> **Mantenimiento:** al cerrar cada fase de trabajo, actualizar las secciones
> "Estado actual" y "Deuda técnica" con fecha.

> Diseño del sistema → `SDD.md` · Protocolo de agentes → `agent.md` ·
> Catálogo de capacidades → `skills.md`.

**Última actualización:** 13-nov-2026 (10-U1 — design system propio (`src/components/finzen/ui/`), color de categoría como token semántico (`cat-1..cat-12`, con script de migración pendiente de ejecutar en prod), i18n con tipo derivado (402 claves), limpieza de 34 ficheros + 35 deps, y `bun run verify` Repair: el script `build` era rojo en Windows por `cp -r` → ahora portable con `scripts/copy-standalone.mjs`)

---

## 1. Identidad del proyecto

- El producto se llama **Shikin** desde el 25-oct-2026 (antes FinZen). Los
  identifiers internos (`finzen-store`, `src/lib/finzen/`, `FINZEN_*`,
  `[finzen]`, prefijo de keys `fz_`) conservan el nombre viejo por decisión
  del dueño — refactor separado si se pide.
- **Producto:** finanzas personales y del hogar, inspirado en YNAB, Monarch,
  Copilot y Rocket Money.
- **Diferenciadores:** multi-moneda real (USD/DOP/EUR/USDT/BTC), i18n es/en,
  dark mode, OCR de recibos, presupuestos con umbrales, motor de alertas y
  **API pública v1** para que agentes de IA (Claude, GPT, etc.) registren y
  consulten gastos/ingresos con una API key del usuario.
- **Origen:** partió del template `nextjs_tailwind_shadcn_ts` (de ahí el nombre
  en `package.json` — no renombrar rompe nada, pero sería cosmético).

## 2. Cronología condensada (las fases que dejaron huella)

| Fase | Qué se logró | Fecha aprox. |
|---|---|---|
| 1–4 | Arquitectura, design system, backend, frontend + OCR/CSV | inicio |
| 5 | Demo live + reset de BD limpia | — |
| 7–7.3 | Migración SQLite local → Postgres/Vercel y RESTAURACIÓN de modo edición, incomes, CRUD cuentas, presupuestos, OCR tras la migración (hubo pérdida de features) | — |
| 7.4 | Sistema de backup/restore JSON contra pérdida de datos | — |
| 7.5 | API pública con API keys + rate limit | — |
| 7.6–7.7 | Deploy a Vercel + migración de datos del sandbox a producción | — |
| 7.8 | **Turso (libSQL)** como BD persistente — antes cada lambda perdía datos | — |
| 7.9 | API v1 completa: incomes, PATCH/DELETE, `account_id`, `/api/v1/accounts`, summary con gastos+ingresos+net. E2E con curl en producción ✓ | — |
| Auditoría 27-sep-2026 | Scorecard con hallazgos P0–P3 (reportes en `/tmp/opencode/finzen-audit/`, hoy efímeros). P0-1 (BD divergente) y P0-2 (sheet pegado) corregidos; P1-4, P2-1, P2-5, P2-8, P2-9 en "UI quick wins" | 27-sep |
| **Estabilización + UX real** | Ver §4 | 29-sep-2026 |
| **8.1 — Estructura SDD** | Informe técnico-arquitectónico completo + creación de `SDD.md` (diseño + roadmap de migración), `agent.md` (protocolo de trabajo de agentes) y `skills.md`. Definición del Agente Orquestador runtime (`agents/orchestrator.md`) y reestructuración de `skills.md` como catálogo tipado de habilidades de IA (contratos Entrada/Salida por skill, `get_net_worth` añadido al vocabulario). Sin cambios de código | 1-oct-2026 |
| **8.2 — CRUD cuentas v1 + multiagentes opencode** | `POST`/`PATCH`/`DELETE /api/v1/accounts` con servicio compartido `accounts-service.ts` (nace la capa de `src/lib/services/`), guard 409 de historial (cierra SDD §7.7), flujo multiagente coordinador→planificador→implementador→revisor cableado en `.opencode/`, skills `finzen-dev-harness` + `hig-ux-ui` (HIG Apple), script `verify`. E2E 21/21 local ✓ | 22-oct-2026 |
| **8.3 — Importar desde tu banco** | Wizard de estados de cuenta: parser OFX/QFX (`ofx.ts`), presets CSV de bancos dominicanos (`bank-presets.ts`: BPD, Banreservas, BHD, APAP, genérico), `parseCSVLine` extraída a `csv.ts` compartida, dedup con fix del bug latente de ingresos (`realAccountId`), preview con tabla y advertencia de moneda distinta. Fixtures parsers 33/33 ✓ | 22-oct-2026 |
| **8.4 — Pass UI/HIG producción** | FIX 1-6 del dueño: submit login `h-11 min-h-11` (≥44px), micro-feedback en primitivas (`active:brightness-95`, `duration-150`, hover primario oscurece 8% vía token `--primary-hover`), login con "¿Olvidaste tu contraseña?" (mailto real) + error inline que conserva el email, token `--shadow-card` (tinta #00274a) en login+dashboard, empty states completos (transactions/reports/categories), negativos semánticos (`text-expense`) y hex crudo de chrome eliminado. Revisor APRUEBA · verify ✓ | 22-oct-2026 |
| **8.5 — Fix flechas dobles Ajustes** | Solicitud directa del dueño: cada acordeón de Ajustes mostraba 2 chevrons (uno manual sin rotación + el nativo de la primitiva). Eliminado el `ChevronDown` manual de `settings-view.tsx` y su import; queda el chevron nativo con rotación. verify ✓ (cambio trivial, sin flujo multiagente) | 25-oct-2026 |
| **9 — Rebrand FinZen → Shikin** | Logo distintivo, favicon, metadata, docs; renames externos GitHub/Vercel; internals intactos | 26-oct-2026 |
| **8.6 — Fix responsivo Transacciones** | Desbordamiento de ingresos/gastos en móvil: totals a 1 col + fuente por breakpoint (patrón reports-view), `truncate` en nombre de cuenta, `w-full` en selects del sheet + padding del form. Fix huérfano previo adoptado y cerrado. Revisor APRUEBA · verify ✓ | 27-oct-2026 |
| **8.7 — Responsive total de stats (todas las resoluciones)** | El dueño reportó que la adaptación solo se veía en móvil: el patrón `sm:grid-cols-3` + fuente grande desbordaba a 640-1023px en Transacciones y (peor, text-2xl) en Reports/Dashboard. Alcance sistémico aprobado: transactions `md:grid-cols-3` + escalera `text-base sm:text-lg md:text-xl`; reports/dashboard `lg:grid-cols-3` + `*:min-w-0` + `break-words` en montos; KpiCard `break-words`. Convención nueva documentada en AGENTS.md §5. Revisor APRUEBA · verify ✓ (node). Commit `421251e` + docs **sin push** — GCM headless no puede re-autenticar (lección §6) | 27-oct-2026 |
| **10-U0 — U0: higiene UI + bug de presupuestos** | Primera fase del programa "mejora UI/UX + agentes dentro de la app" (plan de 5 fases UI U0→U4 + bloque de agentes). Entrega: i18n completo (0 `locale === 'es' ?` en las vistas, 390 claves con paridad es/en), a11y (aria-labels i18n, `<div onClick>`→`<button>`, CTAs ≥44px), export CSV/JSON unificado en 4 sitios con fidelidad de respaldo, botón "Exportar" de Reportes revivido, rango↔gráfico↔totales alineados (`computeMonthlyFlows` como única fuente), drag & drop real en Importar con copy honesto (solo CSV), y **fix del bug real** `addBudgetItem` (no persistía: id `temp_…` en local → se perdía al recargar) con `POST /api/budgets/[budgetId]/items` + `src/lib/services/budgets-service.ts`. Revisor APRUEBA, 0 bloqueantes · harness 3/3 ✓ (node) | 12-nov-2026 |
| **10-U1 — U1: design system + tokens de categoría + i18n derivado + limpieza** | Segunda fase. (B1) `Category.color` pasa de HEX crudo en BD a **clave de token** `cat-1..cat-12` (tokens `--cat-N` light+dark, módulo puro `category-color.ts` con vecino más cercano en OKLab, servicio `categories-service.ts`, seed y picker migrados, script `scripts/migrate-category-colors.ts` con dry-run/apply/rollback). (B2) design system propio en `src/components/finzen/ui/` (stat-card, stat-grid, empty-state, confirm-delete, icon-button, progress-bar, currency-select, crud-dialog, category-icon + `STAT_SCALE` como fuente única de la escala responsive). (B3) i18n: `TranslationKey` **derivado** del diccionario `es` (paridad es/en garantizada por `tsc`). (B4) borrados 34 ficheros (30 primitivas shadcn sin uso + `use-toast`/`use-mobile`/`mock-data`/`tailwind.config.ts`) y 35 deps; `bun.lock` con 344 eliminaciones y 0 añadidos (salvo el hoists de `uuid@8.3.2` con sha512 idéntico). **Fix del harness**: `bun run verify` era rojo en Windows (`cp -r` en el script `build`) → `scripts/copy-standalone.mjs` portable. Revisor APRUEBA, 0 bloqueantes · `bun run verify` exit 0 | 13-nov-2026 |

## 3. Decisiones de arquitectura y su porqué

| Decisión | Porqué | Dónde |
|---|---|---|
| **Double-entry con cuentas virtuales** `x_<categoryId>` | Un gasto/ingreso es una transferencia cuenta real → cuenta virtual de categoría; habilita reportes por categoría sin tabla extra | `schema.prisma`, `finance.ts` |
| **Net worth** = asset+investment+equity−liability | Las cuentas income/expense son virtuales (asientos), no riqueza | `finance.ts` |
| **Turso + fail-fast sin `DATABASE_URL` en prod** | P0-1: SQLite efímero en lambas = datos divergentes/perdidos. La app se rehúsa a arrancar mal configurada | `db.ts` |
| **`url` fija en schema.prisma** (placeholder) | Prisma valida el schema en generate; la conexión real la construye `@prisma/adapter-libsql` en runtime | `schema.prisma` |
| **NextAuth v4 + JWT (30 días) + `token.id`** | Sessions de DB no escalan en serverless; el `user.id` viaja en el JWT y se expone con augmentación de tipos | `auth-options.ts`, `types/next-auth.d.ts` |
| **API keys solo como hash SHA-256** (prefijo visible para display) | Si se filtra la BD no se filtran las keys | `api-key.ts` |
| **FX estáticas** en `currency.ts` | Simplicidad para MVP | deuda — ver §5 |
| **i18n casero** (`translations[locale]`) con next-intl instalado | El casero es suficiente y más simple; migrar a next-intl sería solo si se requiere routing por locale | `i18n.ts` |
| **React Compiler + disables puntuales** | Los memos con deps de `new Date()` no se pueden preservar; convención documentada en AGENTS.md §5 | varios `.tsx` |
| **`scripts/*.js` en ESM** | ESLint prohíbe `require()`; Bun ejecuta ESM en .js sin config | `scripts/` |
| **SDD: la spec precede al código** | `SDD.md` es la fuente de verdad del diseño; los agentes actualizan la spec antes de implementar y memorizan al cerrar (`agent.md`); cada capacidad vive documentada en `skills.md` | `SDD.md`, `agent.md`, `skills.md` |
| **Orquestador runtime como coordinador único** | El Agente Orquestador (`agents/orchestrator.md`) es el único agente que habla con el usuario final; su system prompt y el catálogo tipado `skills.md` fijan el vocabulario canónico de skills; los roles de `agent.md` §4 son agentes de desarrollo, no runtime | `agents/orchestrator.md`, `skills.md` |
| **DELETE de cuentas protege el historial (409)** | Un borrado duro deja transacciones huérfanas (SDD §7.7); el agente debe llevar saldos a 0 con PATCH, no borrar. El guard vive en el servicio y cubre v1 + ruta interna | `src/lib/services/accounts-service.ts` |
| **PATCH v1 de cuentas con campos inmutables** | `currency`/`accountType` → `422 field_not_editable`; cambiarlos rompería la semántica del net worth. `currentBalance` = ajuste directo (saldos bancarios, sin recálculo) | `accounts-service.ts`, rutas v1 |
| **Flujo multiagente coordinador→planificador→implementador→revisor** | El coordinador orquesta y es el único que cierra (harness + memoria); roles materializados como agentes de opencode con permisos (planificador/revisor read-only) | `.opencode/agent/`, `agent.md` §4 |
| **Consola de agentes: multiusuario y endpoint OpenAI-compatible** (decidido por el dueño 12-nov-2026, **no implementado todavía**) | La clave del proveedor LLM será **por usuario** (cifrada en reposo, con cuotas) → aísla a cada usuario y permite revocar por separado, a costa de duplicar el alcance de la fase de agentes. El cliente será un **endpoint compatible con OpenAI** (`LLM_BASE_URL` configurable) → una sola implementación de streaming + tool-calls cubre Anthropic vía gateway, OpenAI, Groq y modelos locales, sin acoplar el código a un vendor y **sin dependencias nuevas** (`fetch` nativo + `zod` ya instalado) | `MEMORY.md` §4 (sesión 12-nov-2026), `worklog.md` PHASE 10 |

## 4. Estado actual (13-nov-2026)

**Barreras de calidad:** **`bun run verify` VERDE (exit 0)** — lint + typecheck + build + copia portable a standalone. `bun` v1.4.4 disponible en `node_modules\.bin\bun.cmd` (instalado con `npm install --no-save --no-package-lock bun`; `package.json` y lockfiles intactos salvo las purgas aprobadas). E2E accounts v1 21/21 en dev ✓ · fixtures parsers bancarios 33/33 ✓ · smoke rebrand en producción ✓ · **deploy de 10-U0 confirmado en producción** (build id `TalGg…` → `rR0OK7…`) · **10-U1 commiteada y pusheada** (`821ee87`).

**⚠️ PENDIENTE DE DECISIÓN DEL DUEÑO — migración de colores en producción:** la app ya resuelve colores por token en runtime (tolera HEX heredado), pero la BD de Turso conserva los HEX antiguos. Para alinearla: `bun scripts/migrate-category-colors.ts --dry-run --allow-production` (ver) → `--apply --allow-production` (escribe, con backup) → `--rollback <backup>` (deshace). **El gate `--allow-production` es obligatorio para cualquier modo contra `libsql:`** (incluido dry-run). No ejecutar contra producción sin su visto bueno (riesgo de datos).

**✅ 10-U1 COMMITEADA Y PUSHEADA (13-nov-2026):** commit `821ee87` → `main` (`origin/main` verificado). Working tree limpio. 10-U0 = `7a53c1f` (commiteado, pusheado y desplegado).

Sesión 13-nov-2026 (10-U1 — design system + tokens de categoría + i18n derivado + limpieza; flujo coordinador→planificador→implementador→revisor; revisor APRUEBA, 0 bloqueantes):
- **Alcance:** 4 bloques. B1 (color de categoría como token), B2 (design system propio en `src/components/finzen/ui/`), B3 (i18n con tipo derivado), B4 (limpieza de 34 ficheros + 35 deps). Cierra las deudas #13, #14 y #15.
- **Spec primero (coordinador, antes del código):** `SDD.md` §2 (el color **no** es parte del contrato v1 → la autocreación deja `color = null` → fallback `cat-12`), §4 (`Category.color` = clave `cat-1..cat-12`, nunca HEX), §5 convención 7; `skills.md` §3 (`resolve_category` + skill nueva `normalize_category_color`); `agents/orchestrator.md` (tabla de delegación + directiva); `AGENTS.md` §5 (color de categoría = token) y §6 (mapa con `finzen/ui/`).
- **B1:** tokens `--cat-1..--cat-12` (light+dark) en `globals.css`; módulo puro `src/lib/finzen/category-color.ts` (vecino más cercano en OKLab: sRGB→lineal→OKLab, ΔE euclídeo, empate → índice menor; la salida **nunca** emite HEX → `var(--cat-N)`); servicio `src/lib/services/categories-service.ts` (ownership, categorías de sistema no borrables, 409 `category_has_transactions` / `category_in_budget`); rutas `/api/categories` convertidas en adaptadores delgados; seed y picker migrados; script `scripts/migrate-category-colors.ts` (dry-run por defecto, `--apply`, `--rollback`, backup, idempotencia, lotes de 100, gate `--allow-production`).
  - **Conflicto de spec resuelto:** el plan fijaba `#10B981` → `cat-1` por decisión de producto, pero el vecino OKLab puro da `cat-2` (ΔE 0.0547 vs 0.1025). Solución: `LEGACY_CATEGORY_COLOR_ALIASES` se consulta **antes** del vecino, y `nearestCategoryColorKey` queda **puro** (las 12 anclas mapean a sí mismas). El alias aplica en el servicio y en la migración.
- **B2:** 10 ficheros nuevos en `src/components/finzen/ui/`. `STAT_SCALE` (`stat-scale.ts`) es la **fuente única** del techo de fuente y del breakpoint del grid → hace imposible que divergan (que era exactamente el bug que causó la fase 8.7). `IconButton` normaliza el target ≥40px + `aria-label`; `ConfirmDelete` envuelve `AlertDialog` con `bg-expense text-primary-foreground`; `ProgressBar` con `role="progressbar"`; `CrudDialog` en modo asistente (sin `<form>`) para los 3 wizards, para no alterar su flujo.
- **B3:** `TranslationKey` pasa a ser `keyof typeof es` con `en: Record<TranslationKey,string>` → **el compilador** ahora garantiza la paridad es/en (una clave faltante en `en` rompe el typecheck). 0 cambios en los ~390 call-sites `t['clave']`.
- **B4:** 30 primitivas shadcn sin uso + `use-toast.ts` + `use-mobile.ts` + `mock-data.ts` + `tailwind.config.ts` (config legacy de Tailwind 3 que no se aplicaba → era una trampa) borrados; 35 deps purgadas con `bun remove`. **`bun.lock`: 344 eliminaciones, 0 añadidos**, salvo el hoists de `uuid@8.3.2` (mismo sha512 que el `next-auth/uuid` anidado previo). `tailwindcss-animate` también purgado (muerto tras borrar `tailwind.config.ts`; las utilidades `animate-*` vienen de `tw-animate-css`).
- **Fix del harness (hallazgo del implementador):** `bun run verify` era **ROJO** en Windows — el script `build` terminaba con `cp -r` (Unix) → `cp: illegal option -- r`. Preexistente, pero bloqueaba la barrera canónica. Resuelto con `scripts/copy-standalone.mjs` (ESM, `fs.cpSync` recursivo, mensaje claro si falta `.next/standalone`) y `package.json` → `"build": "next build && node scripts/copy-standalone.mjs"` + `vercel-build` equivalente (generate → build → copia).
- **Bugs de CSS inválido arreglados (2):** `` `${iconColor}20` `` en `dashboard-view.tsx` y `` `${m2.color}15` `` en `accounts-view.tsx` generaban `var(--expense)20` / `var(--info)15` → **no es CSS válido**, el fondo nunca se pintaba. Ahora `color-mix(in oklab, currentColor 12%/8%, transparent)`.
- **3 avisos del revisor resueltos antes de cerrar:** (A1) `PATCH /api/categories/[id]` **sin** `color` reseteaba la categoría a `cat-12` (regresión vs HEAD) → ahora "ausente" = preserva, `null` explícito = reset al fallback; (A5) el gate `--allow-production` solo cubría `--apply` → ahora cubre dry-run/apply/rollback y corta **antes** de conectar; (A6) los swatches de color sin `aria-label`/`aria-pressed` y con target 32px → ahora con `aria-label` i18n (12 claves nuevas, 390→402), `aria-pressed` y target ≥40px.
- **Verificación:** `bun run verify` exit 0 (implementador, revisor y coordinador). Revisor: **APRUEBA**, 0 bloqueantes, con recálculo independiente de la matemática OKLab (las 12 anclas mapean a sí mismas; `#059669`→`cat-1`, `#F59E0B`→`cat-5`, `#6B7280`→`cat-12`, basura→`cat-12`) y verificación del sha512 de `uuid`. Intactos: `prisma/schema.prisma`, `src/lib/auth/**`, `src/lib/db.ts`, **todo** `/api/v1/**`, `finance.ts` y `finzen-store.ts` → doble entrada, net worth y contrato v1 sin tocar. 0 `as any` nuevos. La migración **no** se ejecutó contra Turso.

Sesión 12-nov-2026 (10-U0 — primera fase del programa UI/UX + agentes in-app; flujo coordinador→planificador→implementador→revisor; revisor APRUEBA, 0 bloqueantes):
- **Origen:** el dueño preguntó (A) cuánto se puede mejorar la UI "en todo" y (B) si puede manejar sus agentes externos dentro de la app sin depender de una plataforma aparte. El coordinador respondió con un diagnóstico grounded (inventario read-only del repo) + un programa de fases, no con un parche.
- **Diagnóstico (5 ejes):** 32 de 48 primitivas shadcn sin usar + ~12 deps muertas (el 2/3 del design system es residuo de plantilla) · ~274 strings bifurcadas `locale === 'es' ?` en 16 archivos (i18n a medio aplicar) · 0 design system propio (5 escalas de KPI, 3 copias del export, 5 empty states, 7 diálogos CRUD, 4 copias del loop de totales) · `Category.color` en HEX crudo desde BD inyectado en los gráficos (rompe dark mode) · features muertas (botón "Exportar" de Reportes sin `onClick`, rango que no afectaba al gráfico, etiqueta "12 meses" con 6 meses de datos, import que promete `.xlsx` y solo acepta CSV, idioma/moneda que nunca se persisten).
- **Corrección al plan (verificada antes de implementar):** de los "2 bugs de pérdida de datos" reportados, **solo 1 existía**. `deleteAccount` NO borra en cliente ante un 409: `apiFetch` lanza antes del `set` (`finzen-store.ts:125`). Se dejó intacto y solo se mejoró el mensaje. El bug real era `addBudgetItem` (`store:282-308`): con presupuesto existente solo mutaba el estado local con id `temp_…` y **nunca persistía** → la partida se perdía al recargar.
- **Desviación de alcance justificada:** el fix exige una ruta que no existía → se crea `POST /api/budgets/[budgetId]/items` + `src/lib/services/budgets-service.ts` (ownership del presupuesto y de la categoría, validaciones, threshold clamp). El plan original excluía `src/app/api/**`; se desvió por correctness y por `AGENTS.md` §5 (lógica de negocio en `src/lib/services/`, handler delgado).
- **Entregado:** 5 archivos nuevos + 18 modificados. i18n completo (390 claves, paridad es/en verificada por script, 0 huérfanas nuevas) · a11y (aria-labels i18n, `<div onClick>`→`<button>` nativo, CTAs ≥44px) · export CSV/JSON unificado en 4 sitios con **fidelidad de respaldo** (`id`/`tags`/`importSource` verbatim → compatible con `POST /api/restore`) · botón Exportar de Reportes revivido (CSV+JSON) · rango↔gráfico↔totales alineados con `computeMonthlyFlows` como única fuente · etiqueta real del gráfico (`common.lastMonths` con `{n}`) · drag & drop real en Importar con copy honesto (solo CSV) · `apiFetch` propaga `code`/`transactionCount` sin `as any` (clase `ApiError`) → el 409 de cuentas muestra la causa real traducida con el conteo.
- **Verificación:** harness 3/3 exit 0 (eslint · tsc · next build con 23 páginas y 31 rutas) ejecutado por implementador, revisor y coordinador; greps de control en verde (`locale === 'es' ?` → 0, `text-white`/`bg-white` en vistas → 0, `as any` nuevos → 0); revisor verificó con comparador ejecutable que el CSV es byte-idéntico al anterior, que no hay IDOR en el endpoint nuevo, que el fix persiste (store→route→service→prisma) y que `api/v1/**`, `prisma/schema.prisma`, `package.json`, `lib/auth/**` y `components/ui/**` quedaron intactos.
- **Corrección post-revisión (3 avisos, resueltos antes de cerrar):** el JSON de respaldo perdía `id`/`tags`/`importSource` → restaurados (el CSV no se tocó); 3 claves i18n huérfanas introducidas por la fase → eliminadas; 3 strings visibles restantes en `settings-view` → i18n. El aviso de la tilde de "Últimos" resultó de un snapshot previo (verificado por codepoint: `Ú` U+00DA).
- **Memoria de la sesión 8.7:** el commit `8f573e3` ("docs: cierre 8.7 — AGENTS convención responsive, memoria y worklog") actualizó `AGENTS.md` y `MEMORY.md` pero **no** `worklog.md` → la fase 8.7 quedaba sin cronología. Cerrado el 12-nov-2026 con una entrada retroactiva en `worklog.md`.
- **Decisiones del dueño para el bloque de agentes (NO iniciado):** **multiusuario (multi-tenant)** — la clave del proveedor LLM será por usuario, cifrada en reposo, con cuotas (esto **duplica** el alcance frente a la opción de usuario único que recomendaba el planificador) · **endpoint compatible con OpenAI** (`LLM_BASE_URL` configurable) como proveedor del LLM server-side, cero dependencias nuevas (`fetch` + `zod` ya instalado). Orden: Fase 0 del roadmap (Vitest + rate limit compartido + deprecar `/api/agent/*`) → Fase 1 (capa de servicios) → capa de tools + log auditable + undo → consola in-app (SSE + aprobación humana) → servidor MCP.

Sesión 27-oct-2026 (8.7 — Responsive total de stats; flujo
coordinador→planificador→implementador→revisor; alcance sistémico + push
aprobados por el dueño; revisor APRUEBA, 0 bloqueantes):
- **Síntoma:** el fix 8.6 solo adaptaba móvil — el dueño seguía viendo
  desborde de ingresos/gastos en otras resoluciones ("todas las fuentes
  deben variar según el tamaño de pantalla"). Causa: el patrón
  `grid-cols-1 sm:grid-cols-3` + fuente grande desde 640px es sistémico y a
  640-1023px (tablet vertical, laptops con zoom 125-150% de Windows) las 3
  tarjetas quedan ~157-208px útiles: Transacciones iba justo con text-lg
  (17 chars ≈ 155px), Reports/Dashboard desbordaban HOY con text-2xl
  (≈198px en ~157px).
- **Fix (~14+/15−, solo classNames en 4 archivos):** transactions-view
  Totals `md:grid-cols-3` + escalera `text-base sm:text-lg md:text-xl`
  (peor monto 17 chars ≈ 183px cabe en ~208px útiles de md); reports-view y
  dashboard-view (KPIs + skeletons, mismo breakpoint para paridad de carga)
  `lg:grid-cols-3` + `*:min-w-0` + `break-words` en los 3 montos (el
  condicional `text-expense` de netSavings preservado); KpiCard
  `break-words` (único consumidor: dashboard, verificado). TransactionRow
  SIN cambios (monto `shrink-0 whitespace-nowrap` ya correcto). Se descartó
  tipografía fluida clamp (sobre-ingeniería; la escalera es la convención
  del repo) — decisión planificador+dueño.
- **Spec primero:** convención nueva fijada en AGENTS.md §5 ("Filas de
  stats responsive": apilar según techo de fuente, `*:min-w-0`,
  `break-words` — wrap jamás ellipsis).
- **Verificación:** lint ✓ typecheck ✓ build ✓ (23 páginas) vía node,
  re-ejecutadas de forma independiente por el revisor. Commit `421251e`.
  Avisos no bloqueantes: skeleton grid sin `*:min-w-0` (no-op sobre
  Skeletons vacíos, opcional), ruido Prisma engines del sandbox en build
  (ambiental), ruido mode-bit (preexistente).
- **Escalación:** el push a producción quedó BLOQUEADO por credenciales
  (ver aviso arriba) — reportado al dueño, no forzado.

Sesión 27-oct-2026 (8.6 — Fix desbordamiento responsive en Transacciones;
flujo coordinador→planificador→implementador→revisor, Opción A del dueño;
revisor APRUEBA, 0 bloqueantes):
- **Qué:** el módulo Transacciones desbordaba en pantallas pequeñas — los
  totales de Ingresos/Gastos/# usaban 3 columnas fijas + fuente fija
  (~77px útiles por tarjeta en un 360px vs montos de ~130px). Fix de 19
  líneas de classNames en 3 archivos: (1) totals a `grid-cols-1
  sm:grid-cols-3` + `text-base sm:text-lg` + `break-words` (el dinero se
  envuelve, jamás ellipsis — patrón de reports-view); (2) nombre de
  cuenta en la fila con `truncate` (antes `max-w-[160px]` sin clamp: una
  palabra larga desbordaba); (3) `w-full` en los 6 selects Desde/Hacia
  del sheet (eran `w-fit` y un nombre largo sangraba sobre el hermano) +
  `px-4 pb-6` al form (inputs tocaban los bordes del sheet) + tabs
  `text-xs sm:text-sm px-1.5 sm:px-2`.
- **Fix huérfano adoptado:** el working tree traía el fix del bloque
  Totals SIN commitear de una sesión interrumpida; auditado por el
  planificador y mantenido tal cual — el commit 8.6 lo cierra con
  verify + revisor + memoria.
- **Verificación:** lint ✓ typecheck ✓ build ✓ (23 páginas) — vía node
  con los binarios de `node_modules` (`bun` no existe en este sandbox);
  el revisor re-ejecutó las 3 barreras de forma independiente. Correr
  `bun run verify` en un entorno con bun para la confirmación canónica.
- **Avisos del revisor:** string inline es/en "Categoría (origen)" en
  add-transaction-sheet es preexistente (clase de deuda §5.9, fuera de
  scope).

Sesión 26-oct-2026 (9 — Rebrand FinZen → Shikin, flujo coordinador→implementador→revisor; revisor APRUEBA, 0 bloqueantes):
- **Qué:** la app es **Shikin** en todo lo visible. Logo distintivo del dueño
  (JPEG analizado con sharp: insignia azul marino centrada sobre fondo
  claro; crop cuadrado 640x640 → 4 assets vía `scripts/generate-brand-assets.js`:
  `public/brand/shikin-logo.png` 512², `src/app/icon.png` 512²,
  `src/app/apple-icon.png` 180², `public/brand/shikin-og.png` 1200x630;
  `icon.svg` y `logo.svg` huérfanos eliminados). Nombre SIEMPRE por
  `t['app.name']` (login/sidebar/top bar móvil/footer de Ajustes — la key
  existía sin consumirse) y saludo del dashboard por `t['auth.welcome']`
  (cierra ternario hardcodeado). SVG crudo del login → `<Image>` con
  `ring-border` (cierra el detalle §5.11). Metadata completa "Shikin" +
  `metadataBase` (VERCEL_PROJECT_PRODUCTION_URL→NEXT_PUBLIC_BASE_URL→
  localhost) + OG image. Docs/headers + `package.json` name → `shikin`.
- **Externos:** repo GitHub renombrado a **`elber01/shikin`** (gh API +
  `git remote set-url` + description). **Turso ya era `seiri`** — nada
  que renombrar, cero riesgo de datos. **Vercel ✓ (cierre con token
  temporal del dueño, revocado tras el uso):** Edwin renombró el proyecto
  a `shikin` (el dominio por defecto NO cambia solo con el rename); el
  coordinador asignó **`shikin-elber01s-projects.vercel.app`** (el
  `shikin.vercel.app` puro estaba tomado por otra cuenta) y dejó
  `finzen-zeta.vercel.app` como **redirect 308** al nuevo. No existe
  `NEXTAUTH_URL` (NextAuth deriva el origin — login OK sin redeploy).
  Integración Git viva con el repo renombrado.
- **Intactos por decisión del dueño:** identifiers `finzen` minúscula
  (`src/lib/finzen/`, `finzen-store.ts`, `useFinZenStore`, env `FINZEN_*`,
  logs `[finzen]`), prefijo de keys `fz_` (invalidaría la key activa),
  `db.ts` completo, `db/backup.json`, contrato v1.
- **Verificación:** verify ✓ · smoke producción (deploy `de0b113`): title
  "Shikin — Personal & Household Finance" ✓ · favicon PNG 512 ✓ · og:image
  absoluta ✓ · 4 assets 200 ✓ · `POST /api/v1/accounts` sin key → 401
  `missing_api_key` = contrato vivo ✓.

Sesión 22-oct-2026 (8.4 — Pass UI/HIG para producción, con flujo
coordinador→implementador→revisor; revisor APRUEBA, 0 bloqueantes):
- **FIX 1:** submit del login `w-full h-11 min-h-11` — 44px garantizados
  (`.h-11` = `calc(var(--spacing)*11)` verificado en CSS compilado; el HTML
  renderizado en dev muestra las clases).
- **FIX 2 (micro-feedback):** primitivas ui/button.tsx (+`duration-150
  active:brightness-95`) y ui/input.tsx (`transition-[color,border-color,
  box-shadow] duration-150`) — pasada de integración del design system
  autorizada por el dueño. Hover del primario ahora OSCURECE 8% vía token
  nuevo `--primary-hover: color-mix(in oklab, var(--primary) 92%, black)`
  (antes `bg-primary/90` aclaraba por opacidad).
- **FIX 3 (login sin callejón):** "¿Olvidaste tu contraseña?" como mailto
  real al dueño (restablece con `scripts/reset-password.js`) — solo modo
  login; errores de credenciales/registro ahora inline (`role="alert"`,
  `aria-live`, `bg-expense-soft`/`text-expense`) SIN revelar cuál campo
  falló y CONSERVANDO el email; el error se limpia al alternar modo y al
  reintentar.
- **FIX 4 (elevación):** token `--shadow-card` (tinta rgba(0,39,74,.06/.08),
  no negro puro) aplicado a login Card, KpiCard y los 5 Cards del dashboard;
  utility `shadow-card` verificada en CSS compilado.
- **FIX 5 (0 vacíos mudos):** transactions (nuevo usuario → icono + frase +
  CTA `setAddSheetOpen(true)`; filtro vacío → mensaje simple), reports
  (early return post-hooks con Card completo + topCategories vacío →
  `reports.noExpenses`), categories-manager (frase guía al botón «Nueva»).
  +7 claves i18n (union+es+en verificados por script del revisor).
- **FIX 6 (montos):** tabular-nums ya era global (`font-feature-settings
  'tnum'` en body — confirmado); negativos ahora SIEMPRE `text-expense`
  (net savings < 0 en reports corregido; budgets ya cumplía); hex crudo de
  chrome `#6B7280` → `var(--muted-foreground)` en reports y dashboard.
- **FIX 7 (API agente):** los endpoints 8.2 ya existen y pasan 21/21 en
  dev (re-verificado esta sesión). ~~Vercel bloqueó los deployments
  8.1–8.4~~ **RESUELTO 25-oct-2026:** Edwin desbloqueó la cuenta; el push
  de 8.5 (`df8bbf9`) desplegó correctamente. Smoke en producción:
  `/login` 200 · `POST /api/v1/accounts` sin key → **401** (antes 405 del
  deploy viejo) = código nuevo vivo. Pendiente opcional para cerrar el
  criterio del dueño: batería E2E 21/21 contra producción con una key real
  (crear nueva desde Ajustes o `scripts/gen-turso-api-key.js`).
- Nota dev: sin `DATABASE_URL`, `next dev` usa `/tmp/finzen.db` (seed copiado
  de `db/custom.db` en el primer cold start); las keys de test deben
  generarse contra ESE archivo.

Sesión 22-oct-2026 (8.3 — "Importar desde tu banco", ejecutada con el flujo
coordinador→implementador→revisor):
- **Qué es:** wizard que reemplaza el card muerto "Plaid — próximamente"
  (Plaid real requiere API keys y no soporta los bancos dominicanos). El
  usuario descarga su estado de cuenta desde la banca del banco y lo importa:
  CSV con presets (Banco Popular, Banreservas, BHD, APAP, genérico) u
  OFX/QFX estándar — parsing local, sin servicios externos.
- **Parsers puros** (`src/lib/finzen/`): `ofx.ts` (OFX 1.x SGML y 2.x por
  regex, tolera tags sin cerrar), `bank-presets.ts` (`parseBankAmount` para
  formatos dominicanos: coma decimal, "1.234,56", "(500.00)", "RD$";
  `autoMapColumns` con normalización de acentos), `csv.ts`
  (`parseCSVLine` extraída de import-view para compartirla).
- **Wizard** (`bank-import-flow.tsx`): banco → subir archivo (detección OFX y
  de fila de header en las primeras 5 líneas) → mapeo pre-relleno editable →
  preview (chips de resumen + tabla + cuenta destino + advertencia si la
  moneda del statement OFX difiere de la cuenta) → confirmación.
- **Fix de bug latente:** el dedup del flujo CSV original jamás detectaba
  duplicados de INGRESOS (usaba `tx.fromAccountId`, que en ingresos es la
  cuenta virtual). Corregido con `realAccountId = type==='income' ?
  toAccountId : fromAccountId` en los 3 sitios (preview banco, commit banco,
  flujo CSV original).
- Moneda de las transacciones = la de la cuenta destino (mejora sobre el
  CSV wizard que usaba baseCurrency). `importSource: 'bank'`,
  `tags: bank_<banco>_<ts>`.
- **Verificación:** fixtures de parsers 33/33 (montos, acentos, header tras
  título, OFX sin closing tags, fecha inválida); revisor APRUEBA; `bun run
  verify` ✓.
- Deuda documentada en §5.9 (i18n inline y a11y del módulo import) y §5.10
  (`x_undefined`).

Sesión 22-oct-2026 (8.2 — CRUD de cuentas para el agente + multiagentes, ejecutada
con el flujo coordinador→implementador→revisor):
- **API v1:** `POST /api/v1/accounts` (201) y `PATCH`/`DELETE
  /api/v1/accounts/:id` (200; `409 account_has_transactions` +
  `transactionCount`). PATCH de `currentBalance` es ajuste directo (saldos
  bancarios, sin recálculo desde transacciones); `currency`/`accountType` →
  `422 field_not_editable`. Validaciones: `accountType` asset|liability,
  `subType` con alias `credit`→`credit_card` y el nuevo `loan`, `currency`
  DOP|USD (def DOP), `lastFour` 2-4 dígitos. **La key actual del agente
  funciona sin scope nuevo** (permiso `write` ya presente en el modelo).
- **Capa de servicios:** nace `src/lib/services/accounts-service.ts` (primer
  servicio de la Fase 1 del roadmap), compartido por v1 y la ruta interna
  `/api/accounts/[id]` — el guard 409 también protege la UI y cierra la
  deuda SDD §7.7.
- **UI:** subtype `loan` (Préstamo, icono Building2); diálogo de borrado
  explica la restricción de historial y deshabilita la acción si tiene
  transacciones; toasts con la causa real del servidor; `text-white` →
  `text-primary-foreground` en el botón destructivo (contraste dark mode).
- **Multiagentes opencode:** `.opencode/opencode.json` (default `coordinador`,
  instructions AGENTS.md+agent.md) + agentes `coordinador` (primary),
  `planificador`/`revisor` (read-only) e `implementador` en
  `.opencode/agent/`. `agent.md` §4 reescrito al flujo de 4 roles. **Requiere
  reiniciar opencode para que cargue la config.**
- **Skills opencode:** `finzen-dev-harness` (ciclo SDD + barrera `bun run
  verify`) y `hig-ux-ui` (Apple HIG mapeada a tokens/convenciones del repo)
  en `.opencode/skills/`.
- **Harness:** script `verify` = lint+typecheck+build en un comando. E2E
  `scripts/e2e-accounts-v1.js` (21 pasos con cleanup propio; 21/21 local).
- **Spec primero:** SDD §2/§3/§7.7, `skills.md` (alta de
  `create_account`/`update_account`/`delete_account`),
  `agents/orchestrator.md` (delegación + directriz de patrimonio), README
  (tabla API + `verify`).
- Revisado por subagente revisor: veredicto APRUEBA; avisos no bloqueantes
  documentados en worklog 8.2 (laxitud de `Number()` en booleanos, toasts
  mixtos es/en con mensajes del servidor en inglés, PATCH interno aún permite
  `accountType`/`currency` — divergencia de consistencia conocida).
- **Pendiente tras deploy:** correr la batería E2E en producción
  (`bun scripts/e2e-accounts-v1.js --base https://finzen-zeta.vercel.app
  --key <key de Grazia>` → 21/21 cierra el criterio del dueño).

Sesión 1-oct-2026 (documentación SDD — sin cambios de código):
- Informe técnico-arquitectónico para planificar la migración (API v1 y
  legacy `/api/agent/*`, modelo Prisma, integraciones candidatas a MCP,
  ausencia de prompts/LLM server-side, dependencia `z-ai-web-dev-sdk` sin uso).
- Creados `SDD.md` (arquitectura, contratos v1, estrategia MCP, modelo de
  datos, roadmap Fases 0–4), `agent.md` (ciclo SDD, roles multiagente,
  handoff/escalación) y `skills.md` (catálogo con estado MCP por skill).
- Creado `agents/orchestrator.md` — Agente Orquestador Principal: system
  prompt del usuario (verbatim) + contrato de delegación + reglas de
  integridad verificadas contra el código (doble entrada, net worth,
  errores snake_case, keys solo `keyPrefix`). Skills renombradas al
  vocabulario del orquestador en `skills.md` y `SDD.md` §3.
- `skills.md` reestructurado al catálogo formal del usuario ("Catálogo de
  Skills — Habilidades de IA"): secciones 1–6 (Consultas y Analítica ·
  Registro y Transacciones · Resolución y Helpers · Ingesta · Operación ·
  Desarrollo), contratos Entrada/Salida tipados por skill y formato de alta
  SDD. `get_net_worth` incorporado (antes `net_worth`) en `skills.md`,
  `SDD.md` §3 y la tabla de delegación del orquestador. Nota técnica: el
  contrato `{ userId } → { netWorth, assets, liabilities }` difiere del
  naming del legacy (`totalAssets`/`totalLiabilities`) — gana la skill al
  extraer el servicio (Fase 1).
- `MEMORY.md` actualizado según su propia convención de mantenimiento.

Sesión 29-sep-2026 (estabilización + UX con datos reales):
- **Tipos:** augmentación NextAuth (`session.user.id`), store tipado con
  `CurrencyCode`/`TransactionType`, `isSystem`+`sortOrder` en `Category`.
  `tsc` pasó de 28 errores → 0.
- **Código muerto eliminado:** filtro `memberId` (schema no lo tiene) y
  claves duplicadas en `date-utils.ts`.
- **Seguridad:** `NEXTAUTH_SECRET` ahora es **fail-fast en producción**
  (fallback solo dev y solo durante `phase-production-build`). El valor del
  fallback antiguo YA está en el historial de git — rotar en Vercel si aún
  coincide (ver §5).
- **UX sin decoración falsa:** deltas mes-vs-mes reales (`computeDelta`
  devuelve `undefined` sin base → no se muestra), sparkline del net worth
  reconstruido con flujos reales de 12 meses (`computeNetWorthHistory`),
  KpiCard con tono semántico independiente de la flecha (gasto ↑ = rojo).
- **Sesión real:** sidebar muestra nombre/email/inicial de la sesión y
  logout (desktop y móvil). "Mi Hogar" fake eliminado.
- **Auth:** i18n completo, medidor de fortaleza de contraseña, toggle de
  idioma pre-login, autocomplete correcto.
- **Shell:** transición de vistas con framer-motion (`ViewTransition`) y
  skip-to-content.
- `.gitignore`: binarios ajenos (`*.apk`, `*.tar.gz`, `*.docx`), `download/`.
  Script `typecheck` añadido a package.json. `.env` local regenerado
  (el sandbox lo pierde en reinicios — solo lleva NEXTAUTH_SECRET de dev).

**Producción (29-sep-2026):** repo `github.com/elber01/finzen` conectado por
integración Git al proyecto Vercel **finzen-zeta** (`finzen-zeta.vercel.app`).
Pipeline verificado end-to-end: push → build → deploy automático. Turso
conectado (mismo `DATABASE_URL` de las fases 7.x). Se removió
`ignoreBuildErrors` de next.config.ts (`c0f6aa9`) — el build de producción
ahora valida tipos estrictamente. El dominio `app.getfinzen.com` sigue
pendiente de repoint (§5).

## 5. Deuda técnica conocida (no apagar la alarma — priorizar)

1. **CERO tests automatizados.** Recomendación: Vitest para `lib/finzen/`
   (finance, currency, date-utils — funciones puras, baratas de testear) y
   Playwright para E2E de login + CRUD de transacciones.
2. **FX estáticas** (`FX_RATES`): convertir DOP/USDT/BTC con tasas fijas.
   Migrar a una API de tasas con caché si el usuario opera mucho en cripto.
3. **Secreto NextAuth en historial de git:** el fallback antiguo está
   expuesto en commits previos. Verificar que `NEXTAUTH_SECRET` en Vercel
   sea distinto; rotar si coincide.
4. **Dominio custom:** `app.getfinzen.com` aún apunta al deploy viejo y
   sigue pendiente de repoint. La URL buena desde la fase 9 es
   **`shikin-elber01s-projects.vercel.app`** (`finzen-zeta.vercel.app` es
   redirect 308 hacia ella). `shikin.vercel.app` está tomado por otra
   cuenta; si Edwin quiere uniformidad total del dominio (p. ej.
   `getshikin.com`), es compra/DNS aparte.
5. **Onboarding de saldos iniciales:** crear cuenta con balance ≠ 0 genera
   un "adjustment"? Flujo manual — mejorar UX de primera carga.
6. **Rate limit de la API v1:** documentado en worklog 7.5; verificar
   implementación real si el uso público crece.
7. **`package.json` name** sigue siendo `nextjs_tailwind_shadcn_ts` (cosmético).
8. **Dualidad `/api/v1` vs `/api/agent/*` (legacy):** las rutas agent duplican
   capacidades sin rate limit y con shape de error distinto (`{ error }`).
   Deprecar en la Fase 0 del roadmap de `SDD.md` §6 antes de exponer tools MCP.
9. **Módulo Importar — i18n y a11y:** ~~strings inline es/en y `<div>`s
   clickeables sin `role="button"`/teclado~~ **RESUELTO (10-U0, 12-nov-2026):**
   las 3 vistas del módulo (import-view, ocr-flow, bank-import-flow) pasaron a
   i18n completo y sus zonas clickeables son `<button type="button">` nativos
   con `focus-visible`. Se añadió además drag & drop real y el copy dejó de
   prometer `.xlsx`/`.xls` (solo se soporta CSV).
10. **`x_undefined` como cuenta virtual:** cuando el fuzzy-match de categoría
    falla, los asientos guardan `x_undefined` (convención heredada también de
    la API v1). Normalizar (categoría real "Sin categoría" o validación
    `x_<cuid>` en la API) al extraer servicios (Fase 1).
11. **Detalles visuales menores del pass 8.4:** CTAs de empty states usan
    `size="sm"` (h-9, 36px < 44px ideal táctil — consistentes con los empty
    states preexistentes). ~~Logo del login con SVG crudo~~ **RESUELTO
    (9, 26-oct-2026):** reemplazado por el PNG de Shikin con tokens
    (`ring-border`).
12. **Rename total de internals "finzen" (solo si se pide):** paths
    `src/lib/finzen/`, `src/components/finzen/`, `finzen-store.ts`,
    `useFinZenStore`, env `FINZEN_*`, logs `[finzen]` y prefijo `fz_`
    conservan el nombre viejo por decisión del dueño (refactor masivo de
    imports, cero valor visible — ver sesión 9). Menor:
    `scripts/generate-brand-assets.js` tiene `DEFAULT_SRC` absoluto a
    `~/Downloads` (override `--src` existe; en clonación fresca convendría
    exigir `--src`).
13. ~~**Residuo de plantilla (detectado en 10-U0, sin resolver):**~~ **RESUELTO
    (10-U1, 13-nov-2026):** borrados 30 primitivas shadcn sin uso +
    `src/hooks/use-toast.ts` + `src/hooks/use-mobile.ts` +
    `src/lib/finzen/mock-data.ts` + `tailwind.config.ts` (config legacy de
    Tailwind 3 que no se aplicaba → trampa para futuras sesiones) y **35
    deps** purgadas con `bun remove` (`bun.lock`: 344 eliminaciones, 0
    añadidos salvo el hoists de `uuid@8.3.2` con sha512 idéntico al
    `next-auth/uuid` anidado previo). `tailwindcss-animate` también purgado
    (muerto tras borrar `tailwind.config.ts`; las utilidades `animate-*`
    vienen de `tw-animate-css`). Se conservan `cmdk` (U2), `zod` (bloque de
    agentes) y `sonner`.
14. ~~**`Category.color` guarda HEX en BD**~~ **RESUELTO (10-U1,
    13-nov-2026):** `Category.color` ahora guarda la **clave** `cat-1..cat-12`
    (tokens `--cat-N` light+dark). Módulo puro `category-color.ts` (vecino
    más cercano en OKLab, con alias explícito `#10B981`→`cat-1` por decisión
    de producto), servicio `categories-service.ts`, seed y picker migrados, y
    el render **nunca** emite HEX (tolerante a HEX heredado → se puede
    desplegar antes de migrar los datos).
    **PENDIENTE (decisión del dueño):** ejecutar la migración en Turso —
    `bun scripts/migrate-category-colors.ts --dry-run --allow-production`
    → `--apply --allow-production` → `--rollback <backup>`. Sin ejecutar, la
    BD de prod conserva HEX (funcional, pero fuera de la convención).
15. ~~**`TranslationKey` es un union type manual**~~ **RESUELTO (10-U1,
    13-nov-2026):** `TranslationKey` es `keyof typeof es` y `en` está tipado
    `Record<TranslationKey, string>` → **el compilador** garantiza la paridad
    es/en (una clave faltante en `en` rompe el typecheck). 402 claves, 0
    cambios en los call-sites `t['clave']`.
16. **`text-white` en la variante `destructive`** de `src/components/ui/button.tsx`
    y `ui/badge.tsx`. `AGENTS.md` §7 prohíbe tocar primitivas salvo
    integración → decisión del dueño pendiente (wrapper o excepción
    documentada).
17. **`src/hooks/use-alerts.ts` resuelve el nombre de categoría por su cuenta**
    (3 sitios con `cat.nameEs || cat.name`) en vez de usar
    `localizedCategoryName()` (creado en 10-U0). -> pendiente, 1 línea.
18. **`apiFetch` devuelve `any`** (`res.json()` sin genérico) → el resultado de
    los POST no se valida estáticamente contra el tipo de la entidad.
    -> `apiFetch<T>` con genérico.
19. **Multiusuario exigido para la consola de agentes** (decisión del dueño
    12-nov-2026): la clave del proveedor LLM será **por usuario** → exige
    cifrado en reposo, aislamiento por usuario y cuotas por plan. Duplica el
    alcance de la fase de agentes frente a la opción de usuario único. La
    Fase 0 del roadmap (`SDD.md` §6: rate limit compartido + Vitest) es
    prerrequisito duro de esto.
20. **Worklog de la fase 8.7 faltante:** el commit `8f573e3` actualizó
    `AGENTS.md` y `MEMORY.md` pero no `worklog.md`. **RESUELTO 12-nov-2026**
    (entrada retroactiva añadida en la fase 10-U0). Lección: un mensaje de
    commit que promete "memoria y worklog" no es evidencia — auditar que
    AMBOS archivos cambiaron.
21. **Deltas visuales aceptados en 10-U1 (revisor, no bloqueantes):** los CTA
    de los empty states pasaron de `h-9 px-4` a `h-11 min-h-11` (36→44px, HIG)
    y el `IconButton` de "copiar" hereda `text-muted-foreground`. El bucket
    "sin categoría" pasó de `var(--muted-foreground)` a `var(--cat-12)`
    (alineado con la convención 10-U1). Aceptados por el coordinador; no
    son deuda.
22. **El harness canónico exige `bun`:** `bun run verify` es la barrera
    oficial, pero el sandbox no traía bun. Resuelto instalándolo **dentro de
    `node_modules`** (`npm install --no-save --no-package-lock bun` → v1.4.4) →
    `.\node_modules\.bin\bun.cmd run verify`. `package.json` y los lockfiles
    quedan intactos (salvo purgas aprobadas) y no se crea `package-lock.json`.
23. **`bun.lock` tiene una línea añadida respecto a HEAD:** `uuid@8.3.2`
    (hoisted) sustituye a `uuid@11.1.0` (directa) tras la purga de 10-U1 —
    mismo sha512 que el `next-auth/uuid` anidado previo, integridad verificada.
    No es una regresión, pero conviene saberlo al comparar lockfiles.

## 6. Lecciones aprendidas (para no repetir errores)

- **El sandbox pierde `.env` en reinicios.** Todo lo crítico vive en Vercel;
  regenerar `.env` local es rutina (ver comando en README).
- **SQLite efímero + serverless = catastrophe silenciosa** (P0-1). Por eso
  `db.ts` hace fail-fast; no "arreglar" ese guard con un default.
- **Migraciones de plataforma pierden features:** en la 7→7.3 se perdieron
  modo edición, incomes y CRUD tras migrar; se restauraron a mano. Ante una
  migración, checklist de features primero.
- **E2E real contra producción** (curl) es la única verdad para la API v1:
  los tests de la 7.9 pillaron que `account_id` era ignorado.
- **El React Compiler es estricto:** memos con `new Date()` en deps no se
  pueden preservar — usar la convención de disable documentada, no pelearla.
- **Diffs huérfanos en working tree:** sesiones interrumpidas pueden dejar
  fixes sin commitear. Antes de planificar, separar el diff REAL
  (`git -c core.filemode=false diff --ignore-cr-at-eol`) del ruido
  mode-bit/CRLF que ensucia todo el tree en un checkout Windows.
- **`bun` puede no existir en el sandbox:** si `bun` no está, las 3 barreras
  de verify corren igual con node + los binarios de `node_modules`
  (`eslint .`, `tsc --noEmit`, `next build`); si el tree vino de Linux,
  reconciliar natives win32 con `npm install --no-save` (lockfiles intactos).
- **`git push` puede colgarse por Git Credential Manager headless:** si el
  cache de credenciales de GitHub expira, GCM intenta abrir un popup de
  login y el shell no-interactivo se cuelga sin error (o falla con
  "Cannot prompt" con `credential.interactive=false`). No forzarlo: pedirle
  al dueño que corra `git push origin main` en una terminal normal de su
  máquina (ahí el popup sí aparece y refresca el cache para sesiones
  futuras). Diagnóstico rápido: red OK (`Invoke-WebRequest github.com`)
  + push colgado = credenciales, no red.
- **Un hallazgo de un subagente es una hipótesis, no un hecho** (12-nov-2026):
  el planificador reportó que `deleteAccount` borraba las transacciones en
  el cliente pese al 409 del servidor; al leer el código, `apiFetch` lanzaba
  **antes** del `set` → era un falso positivo. Un hallazgo de subagente se
  verifica leyendo el código **antes** de escribirlo en el brief de
  implementación, o el implementador "arregla" código correcto. Lo mismo
  con el mensaje de un commit: `8f573e3` decía "memoria y worklog" y solo
  actualizó 2 de los 3 archivos → auditar el diff real, no el mensaje.
- **La barrera canónica puede estar rota sin que nadie lo note** (13-nov-2026):
  `bun run verify` era **ROJO** en Windows — el script `build` de
  `package.json` terminaba con `cp -r` (Unix) → `cp: illegal option -- r`.
  Estaba desde antes y todas las fases anteriores lo evitaron corriendo
  eslint/tsc/next build por separado. Conclusión: **correr siempre el script
  completo, no sus partes**, y si un script del repo usa herramientas de un
  SO, hacerlo portable (aquí: `scripts/copy-standalone.mjs` con `fs.cpSync`).
- **`bun` se puede tener sin tocar el repo:** `npm install --no-save
  --no-package-lock bun` lo deja en `node_modules\.bin` (gitignored) →
  harness canónico disponible y `package.json` intacto. Es la vía para
  purgar deps con `bun remove` sin reescribir el lockfile a mano.

## 7. Personas y contexto

- **Edwin (elber01):** dueño del producto. Usuario principal con datos reales
  en Turso (cuentas BPD/APAP/AFI en DOP/USD). Tiene una API key "Nueva grazzia"
  de la que no conoce el valor completo — si la necesita, crear una nueva
  desde Ajustes o con `scripts/gen-turso-api-key.js`.
