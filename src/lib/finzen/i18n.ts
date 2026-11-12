import type { Locale } from './currency';

export type TranslationKey =
  | 'app.name'
  | 'nav.dashboard'
  | 'nav.transactions'
  | 'nav.add'
  | 'nav.reports'
  | 'nav.settings'
  | 'nav.accounts'
  | 'nav.budgets'
  | 'nav.import'
  | 'nav.lightMode'
  | 'nav.darkMode'
  | 'nav.more'
  | 'nav.logout'
  | 'auth.signIn'
  | 'auth.signUp'
  | 'auth.name'
  | 'auth.email'
  | 'auth.password'
  | 'auth.passwordHint'
  | 'auth.noAccount'
  | 'auth.hasAccount'
  | 'auth.loginSubtitle'
  | 'auth.registerSubtitle'
  | 'auth.welcomeBack'
  | 'auth.welcome'
  | 'auth.invalidCredentials'
  | 'auth.errorRequired'
  | 'auth.errorGeneric'
  | 'auth.weakPassword'
  | 'auth.passwordStrength'
  | 'auth.strength.weak'
  | 'auth.strength.fair'
  | 'auth.strength.strong'
  | 'auth.forgotPassword'
  | 'dashboard.greeting.morning'
  | 'dashboard.greeting.afternoon'
  | 'dashboard.greeting.evening'
  | 'dashboard.netWorth'
  | 'dashboard.thisMonth'
  | 'dashboard.income'
  | 'dashboard.expenses'
  | 'dashboard.savingsRatio'
  | 'dashboard.savingsTarget'
  | 'dashboard.cashFlow'
  | 'dashboard.expenseDistribution'
  | 'dashboard.alerts'
  | 'dashboard.recentTransactions'
  | 'dashboard.viewAll'
  | 'dashboard.topCategories'
  | 'dashboard.forecast'
  | 'transactions.title'
  | 'transactions.search'
  | 'transactions.filter'
  | 'transactions.export'
  | 'transactions.allCategories'
  | 'transactions.allMembers'
  | 'transactions.allAccounts'
  | 'transactions.allCurrencies'
  | 'transactions.thisMonth'
  | 'transactions.lastMonth'
  | 'transactions.thisQuarter'
  | 'transactions.thisYear'
  | 'transactions.lastYear'
  | 'transactions.noTransactions'
  | 'transactions.emptyHint'
  | 'transactions.emptyCta'
  | 'transactions.showing'
  | 'transactions.of'
  | 'transactions.today'
  | 'transactions.yesterday'
  | 'transactions.income'
  | 'transactions.expense'
  | 'transactions.transfer'
  | 'transactions.adjustment'
  | 'tx.addTitle'
  | 'tx.amount'
  | 'tx.fromAccount'
  | 'tx.toAccount'
  | 'tx.toCategory'
  | 'tx.source'
  | 'tx.description'
  | 'tx.descriptionPlaceholder'
  | 'tx.date'
  | 'tx.pickDate'
  | 'tx.member'
  | 'tx.save'
  | 'tx.saving'
  | 'tx.saved'
  | 'tx.saveFailed'
  | 'tx.attachReceipt'
  | 'tx.cancel'
  | 'budgets.title'
  | 'budgets.new'
  | 'budgets.overall'
  | 'budgets.spent'
  | 'budgets.approaching'
  | 'budgets.overBudget'
  | 'budgets.left'
  | 'budgets.by'
  | 'budgets.suggestion'
  | 'reports.title'
  | 'reports.range'
  | 'reports.totalIncome'
  | 'reports.totalExpenses'
  | 'reports.netSavings'
  | 'reports.incomeVsExpenses'
  | 'reports.topCategories'
  | 'reports.export'
  | 'reports.emptyTitle'
  | 'reports.emptyHint'
  | 'reports.emptyCta'
  | 'reports.noExpenses'
  | 'import.title'
  | 'import.csv'
  | 'import.csvDesc'
  | 'import.receipt'
  | 'import.receiptDesc'
  | 'import.bank'
  | 'import.bankDesc'
  | 'import.bankChoose'
  | 'import.bankUpload'
  | 'import.bankUploadHint'
  | 'import.bankMapColumns'
  | 'import.bankPreview'
  | 'import.bankTarget'
  | 'import.bankImport'
  | 'import.bankImported'
  | 'import.bankDuplicates'
  | 'import.bankInvalid'
  | 'import.bankDetected'
  | 'import.bankRange'
  | 'import.bankOther'
  | 'import.bankOfxAuto'
  | 'import.recentImports'
  | 'settings.title'
  | 'settings.profile'
  | 'settings.household'
  | 'settings.categories'
  | 'settings.security'
  | 'settings.bankConnections'
  | 'settings.appearance'
  | 'settings.language'
  | 'settings.theme'
  | 'settings.currency'
  | 'settings.dataExport'
  | 'settings.deleteAccount'
  | 'common.light'
  | 'common.dark'
  | 'common.system'
  | 'common.spanish'
  | 'common.english'
  // ── U0 (higiene visual): claves nuevas para i18n + a11y ──
  | 'common.other'
  | 'common.today'
  | 'common.all'
  | 'common.lastMonths'
  | 'common.exportCsv'
  | 'common.exportJson'
  | 'common.selectMonth'
  | 'common.nameRequired'
  | 'common.cancel'
  | 'common.delete'
  | 'common.save'
  | 'common.saveChanges'
  | 'common.create'
  | 'common.close'
  | 'common.soon'
  | 'common.noData'
  | 'common.exported'
  | 'common.selectAccount'
  | 'common.selectCategory'
  | 'common.invalidAmount'
  | 'common.failed'
  | 'common.account'
  | 'common.category'
  | 'common.amount'
  | 'common.date'
  | 'common.description'
  | 'common.type'
  | 'common.optional'
  | 'common.currency'
  | 'common.more'
  | 'common.importCompleted'
  | 'common.emptyFile'
  | 'common.csvError'
  | 'a11y.skipToContent'
  | 'a11y.loadingPanel'
  | 'a11y.sidebar'
  | 'a11y.toggleSidebar'
  | 'a11y.toggleTheme'
  | 'a11y.switchLanguage'
  | 'a11y.edit'
  | 'a11y.delete'
  | 'a11y.bottomNav'
  | 'a11y.moreMenu'
  | 'accounts.errorHasTransactions'
  | 'accounts.name'
  | 'accounts.namePlaceholder'
  | 'accounts.type'
  | 'accounts.asset'
  | 'accounts.liability'
  | 'accounts.subtype'
  | 'accounts.debtAmount'
  | 'accounts.balance'
  | 'accounts.institution'
  | 'accounts.create'
  | 'accounts.new'
  | 'accounts.edit'
  | 'accounts.created'
  | 'accounts.updated'
  | 'accounts.deleted'
  | 'accounts.deleteTitle'
  | 'accounts.deleteWithTx'
  | 'accounts.deleteConfirm'
  | 'accounts.totalIn'
  | 'accounts.assets'
  | 'accounts.liabilities'
  | 'accounts.emptyTitle'
  | 'accounts.emptyHint'
  | 'accounts.debt'
  | 'accounts.deleteFailed'
  | 'budgets.deleteTitle'
  | 'budgets.deleteBody'
  | 'budgets.cancel'
  | 'budgets.delete'
  | 'budgets.editItem'
  | 'budgets.newItem'
  | 'budgets.category'
  | 'budgets.amount'
  | 'budgets.alertPct'
  | 'budgets.emptyTitle'
  | 'budgets.emptyHint'
  | 'budgets.updated'
  | 'budgets.added'
  | 'budgets.deleted'
  | 'budgets.duplicate'
  | 'budgets.selectCategory'
  | 'budgets.invalidAmount'
  | 'budgets.alertAt'
  | 'budgets.saveChanges'
  | 'budgets.add'
  | 'budgets.errorNotFound'
  | 'budgets.errorInvalidCategory'
  | 'budgets.errorInvalidAmount'
  | 'dashboard.emptyHint'
  | 'dashboard.emptyCreateAccount'
  | 'dashboard.emptyRecordTransaction'
  | 'dashboard.noAlerts'
  | 'reports.rangeAll'
  | 'reports.exportMenu'
  | 'transactions.noTransactionsToExport'
  | 'transactions.exportedCount'
  | 'transactions.specificMonth'
  | 'settings.myProfile'
  | 'settings.name'
  | 'settings.email'
  | 'settings.baseCurrency'
  | 'settings.householdSubtitle'
  | 'settings.members'
  | 'settings.householdDev'
  | 'settings.categoriesSubtitle'
  | 'settings.categoriesHint'
  | 'settings.passwords'
  | 'settings.passwordAlgoValue'
  | 'settings.sessions'
  | 'settings.sessionsValue'
  | 'settings.twoFactorSubtitle'
  | 'settings.twoFactorDev'
  | 'settings.noConnections'
  | 'settings.plaidHint'
  | 'settings.exportHint'
  | 'settings.deleteAccountHint'
  | 'settings.deleteAccountTitle'
  | 'settings.deleteAccountBody'
  | 'settings.deleting'
  | 'settings.deleteEverything'
  | 'settings.accountDeleted'
  | 'settings.deleteAccountFailed'
  | 'settings.signOut'
  | 'settings.signOutHint'
  | 'import.csvOnly'
  | 'import.exportTitle'
  | 'import.exportHint'
  | 'import.importCsvTitle'
  | 'import.selectCsv'
  | 'import.mapColumns'
  | 'import.importCount'
  | 'import.importedLabel'
  | 'import.totalInFile'
  | 'import.batchId'
  | 'import.seeTags'
  | 'import.createAccountFirst'
  | 'import.imported'
  | 'import.duplicatesSkipped'
  | 'import.uncategorized'
  | 'import.invalid'
  | 'import.defaultDescription'
  | 'ocr.onlyImages'
  | 'ocr.ocrFailed'
  | 'ocr.createAccount'
  | 'ocr.expenseAdded'
  | 'ocr.scanReceipt'
  | 'ocr.uploadReceipt'
  | 'ocr.processing'
  | 'ocr.merchant'
  | 'ocr.createAccountWarning'
  | 'ocr.saveExpense'
  | 'ocr.expenseAddedTitle'
  | 'bank.createAccountFirst'
  | 'bank.noTransactions'
  | 'bank.selectBank'
  | 'bank.processError'
  | 'bank.noValidTransactions'
  | 'bank.rows'
  | 'bank.continue'
  | 'bank.income'
  | 'bank.expenses'
  | 'bank.currencyMismatch'
  | 'bank.debit'
  | 'bank.credit'
  | 'bank.defaultDescription'
  | 'categories.management'
  | 'categories.editTitle'
  | 'categories.newTitle'
  | 'categories.new'
  | 'categories.expenses'
  | 'categories.income'
  | 'categories.empty'
  | 'categories.system'
  | 'categories.deleteTitle'
  | 'categories.deleteBody'
  | 'categories.created'
  | 'categories.updated'
  | 'categories.deleted'
  | 'categories.nameEs'
  | 'categories.nameEn'
  | 'categories.nameEsPlaceholder'
  | 'categories.direction'
  | 'categories.expenseType'
  | 'categories.incomeType'
  | 'categories.icon'
  | 'categories.color'
  | 'apiKeys.integration'
  | 'apiKeys.new'
  | 'apiKeys.emptyHint'
  | 'apiKeys.inactive'
  | 'apiKeys.used'
  | 'apiKeys.deactivate'
  | 'apiKeys.activate'
  | 'apiKeys.revokeTitle'
  | 'apiKeys.revokeBody'
  | 'apiKeys.revoke'
  | 'apiKeys.created'
  | 'apiKeys.revoked'
  | 'apiKeys.deactivated'
  | 'apiKeys.activated'
  | 'apiKeys.copied'
  | 'apiKeys.publicEndpoints'
  | 'apiKeys.registerExpense'
  | 'apiKeys.listExpenses'
  | 'apiKeys.monthlySummary'
  | 'apiKeys.header'
  | 'apiKeys.or'
  | 'apiKeys.createTitle'
  | 'apiKeys.createdBody'
  | 'apiKeys.useHeader'
  | 'apiKeys.done'
  | 'apiKeys.agentName'
  | 'apiKeys.agentNamePlaceholder'
  | 'apiKeys.permissions'
  | 'apiKeys.readWrite'
  | 'apiKeys.readOnly'
  | 'apiKeys.create'
  | 'apiKeys.copy'
  | 'tx.editTitle'
  | 'tx.updated'
  | 'tx.deleted'
  | 'tx.undo'
  | 'tx.restored'
  | 'tx.restoreFailed'
  | 'tx.deleteFailed'
  | 'tx.closeConfirm'
  | 'tx.categorySource'
  | 'tx.receiptSoon'
  | 'tx.deleteTitle'
  | 'tx.deleteBody'
  | 'tx.invalidAmount'
  | 'tx.selectSourceAccount'
  | 'tx.selectIncomeCategory'
  | 'tx.selectDestinationAccount'
  | 'tx.selectBothAccounts';

const es: Record<TranslationKey, string> = {
  'app.name': 'Shikin',
  'nav.dashboard': 'Panel',
  'nav.transactions': 'Transacciones',
  'nav.add': 'Agregar',
  'nav.reports': 'Reportes',
  'nav.settings': 'Ajustes',
  'nav.accounts': 'Cuentas',
  'nav.budgets': 'Presupuestos',
  'nav.import': 'Importar',
  'nav.lightMode': 'Modo claro',
  'nav.darkMode': 'Modo oscuro',
  'nav.more': 'Más',
  'nav.logout': 'Cerrar sesión',
  'auth.signIn': 'Iniciar Sesión',
  'auth.signUp': 'Crear Cuenta',
  'auth.name': 'Nombre (opcional)',
  'auth.email': 'Email',
  'auth.password': 'Contraseña',
  'auth.passwordHint': 'Mínimo 6 caracteres',
  'auth.noAccount': '¿No tienes cuenta? Regístrate',
  'auth.hasAccount': '¿Ya tienes cuenta? Inicia sesión',
  'auth.loginSubtitle': 'Inicia sesión para continuar',
  'auth.registerSubtitle': 'Crea tu cuenta para empezar',
  'auth.welcomeBack': '¡Bienvenido de nuevo!',
  'auth.welcome': '¡Bienvenido a Shikin!',
  'auth.invalidCredentials': 'Email o contraseña inválidos',
  'auth.errorRequired': 'Email y contraseña son obligatorios',
  'auth.errorGeneric': 'Algo salió mal. Intenta de nuevo.',
  'auth.weakPassword': 'Contraseña muy corta (mínimo 6 caracteres)',
  'auth.passwordStrength': 'Fortaleza',
  'auth.strength.weak': 'Débil',
  'auth.strength.fair': 'Aceptable',
  'auth.strength.strong': 'Fuerte',
  'auth.forgotPassword': '¿Olvidaste tu contraseña?',
  'dashboard.greeting.morning': 'Buenos días',
  'dashboard.greeting.afternoon': 'Buenas tardes',
  'dashboard.greeting.evening': 'Buenas noches',
  'dashboard.netWorth': 'Patrimonio Neto',
  'dashboard.thisMonth': 'Este mes',
  'dashboard.income': 'Ingresos',
  'dashboard.expenses': 'Gastos',
  'dashboard.savingsRatio': 'Ratio de Ahorro',
  'dashboard.savingsTarget': 'Meta 20%',
  'dashboard.cashFlow': 'Flujo de Caja',
  'dashboard.expenseDistribution': 'Distribución de Gastos',
  'dashboard.alerts': 'Alertas',
  'dashboard.recentTransactions': 'Transacciones Recientes',
  'dashboard.viewAll': 'Ver todas',
  'dashboard.topCategories': 'Categorías Principales',
  'dashboard.forecast': 'Pronóstico del Próximo Mes',
  'transactions.title': 'Transacciones',
  'transactions.search': 'Buscar...',
  'transactions.filter': 'Filtrar',
  'transactions.export': 'Exportar',
  'transactions.allCategories': 'Todas las categorías',
  'transactions.allMembers': 'Todos los miembros',
  'transactions.allAccounts': 'Todas las cuentas',
  'transactions.allCurrencies': 'Todas las monedas',
  'transactions.thisMonth': 'Este mes',
  'transactions.lastMonth': 'Mes pasado',
  'transactions.thisQuarter': 'Este trimestre',
  'transactions.thisYear': 'Este año',
  'transactions.lastYear': 'Año pasado',
  'transactions.noTransactions': 'No hay transacciones',
  'transactions.emptyHint': 'Registra tu primer gasto o ingreso para verlos aquí.',
  'transactions.emptyCta': 'Registrar primera transacción',
  'transactions.showing': 'Mostrando',
  'transactions.of': 'de',
  'transactions.today': 'HOY',
  'transactions.yesterday': 'AYER',
  'transactions.income': 'Ingreso',
  'transactions.expense': 'Gasto',
  'transactions.transfer': 'Transferencia',
  'transactions.adjustment': 'Ajuste',
  'tx.addTitle': 'Nueva Transacción',
  'tx.amount': 'Monto',
  'tx.fromAccount': 'De cuenta',
  'tx.toAccount': 'A cuenta',
  'tx.toCategory': 'Categoría',
  'tx.source': 'Origen',
  'tx.description': 'Descripción',
  'tx.descriptionPlaceholder': 'ej. Supermercado Nacional',
  'tx.date': 'Fecha',
  'tx.pickDate': 'Elegir fecha',
  'tx.member': 'Miembro',
  'tx.save': 'Guardar Transacción',
  'tx.saving': 'Guardando...',
  'tx.saved': 'Transacción guardada',
  'tx.saveFailed': 'Error al guardar',
  'tx.attachReceipt': 'Adjuntar recibo',
  'tx.cancel': 'Cancelar',
  'budgets.title': 'Presupuestos',
  'budgets.new': 'Nuevo',
  'budgets.overall': 'General',
  'budgets.spent': 'gastado',
  'budgets.approaching': 'Acercándose al límite',
  'budgets.overBudget': 'Sobre presupuesto',
  'budgets.left': 'restante',
  'budgets.by': 'por',
  'budgets.suggestion': 'Sugerencia',
  'reports.title': 'Reportes',
  'reports.range': 'Rango',
  'reports.totalIncome': 'Ingresos Totales',
  'reports.totalExpenses': 'Gastos Totales',
  'reports.netSavings': 'Ahorro Neto',
  'reports.incomeVsExpenses': 'Ingresos vs Gastos',
  'reports.topCategories': 'Categorías Principales',
  'reports.export': 'Exportar',
  'reports.emptyTitle': 'Sin datos aún',
  'reports.emptyHint': 'Registra transacciones para ver tus reportes y análisis.',
  'reports.emptyCta': 'Registrar transacción',
  'reports.noExpenses': 'Sin gastos en este periodo',
  'import.title': 'Centro de Importación',
  'import.csv': 'Importar CSV',
  'import.csvDesc': 'Arrastra un archivo .csv',
  'import.receipt': 'Escanear Recibo (OCR)',
  'import.receiptDesc': 'Toma una foto o sube una imagen',
  'import.bank': 'Importar desde tu banco',
  'import.bankDesc': 'Estados de cuenta CSV u OFX/QFX',
  'import.bankChoose': 'Elige tu entidad bancaria',
  'import.bankUpload': 'Sube tu estado de cuenta',
  'import.bankUploadHint': 'Descarga el estado de cuenta (CSV u OFX/QFX) desde la banca en línea de tu banco y súbelo aquí.',
  'import.bankMapColumns': 'Confirma el mapeo de columnas',
  'import.bankPreview': 'Vista previa',
  'import.bankTarget': 'Cuenta destino',
  'import.bankImport': 'Importar transacciones',
  'import.bankImported': 'Importadas',
  'import.bankDuplicates': 'Duplicados omitidos',
  'import.bankInvalid': 'Filas inválidas',
  'import.bankDetected': 'transacciones detectadas',
  'import.bankRange': 'Rango',
  'import.bankOther': 'Otro banco (genérico)',
  'import.bankOfxAuto': 'OFX/QFX detectado — mapeo automático',
  'import.recentImports': 'Importaciones recientes',
  'settings.title': 'Ajustes',
  'settings.profile': 'Perfil',
  'settings.household': 'Hogar',
  'settings.categories': 'Categorías',
  'settings.security': 'Seguridad',
  'settings.bankConnections': 'Conexiones Bancarias',
  'settings.appearance': 'Apariencia',
  'settings.language': 'Idioma',
  'settings.theme': 'Tema',
  'settings.currency': 'Moneda base',
  'settings.dataExport': 'Exportar datos',
  'settings.deleteAccount': 'Eliminar cuenta',
  'common.light': 'Claro',
  'common.dark': 'Oscuro',
  'common.system': 'Sistema',
  'common.spanish': 'Español',
  'common.english': 'Inglés',
  'common.other': 'Otro',
  'common.today': 'Hoy',
  'common.all': 'Todos',
  'common.lastMonths': 'Últimos {n} meses',
  'common.exportCsv': 'Exportar CSV',
  'common.exportJson': 'Exportar JSON',
  'common.selectMonth': 'Seleccionar mes',
  'common.nameRequired': 'Nombre requerido',
  'common.cancel': 'Cancelar',
  'common.delete': 'Eliminar',
  'common.save': 'Guardar',
  'common.saveChanges': 'Guardar Cambios',
  'common.create': 'Crear',
  'common.close': 'Cerrar',
  'common.soon': 'Próximamente',
  'common.noData': 'No hay datos',
  'common.exported': 'Exportado {format}',
  'common.selectAccount': 'Selecciona cuenta',
  'common.selectCategory': 'Selecciona categoría',
  'common.invalidAmount': 'Monto inválido',
  'common.failed': 'Error',
  'common.account': 'Cuenta',
  'common.category': 'Categoría',
  'common.amount': 'Monto',
  'common.date': 'Fecha',
  'common.description': 'Descripción',
  'common.type': 'Tipo',
  'common.optional': 'opcional',
  'common.currency': 'Moneda',
  'common.more': 'más',
  'common.importCompleted': '¡Importación completada!',
  'common.emptyFile': 'Archivo vacío',
  'common.csvError': 'Error CSV',
  'a11y.skipToContent': 'Saltar al contenido principal',
  'a11y.loadingPanel': 'Cargando',
  'a11y.sidebar': 'Navegación lateral',
  'a11y.toggleSidebar': 'Alternar barra lateral',
  'a11y.toggleTheme': 'Alternar tema',
  'a11y.switchLanguage': 'Cambiar idioma',
  'a11y.edit': 'Editar',
  'a11y.delete': 'Eliminar',
  'a11y.bottomNav': 'Navegación inferior',
  'a11y.moreMenu': 'Menú de más opciones',
  'accounts.errorHasTransactions':
    'Esta cuenta tiene {n} transacciones asociadas y no se puede eliminar (el historial se conserva). Para retirarla del patrimonio, edita su saldo a 0.',
  'accounts.name': 'Nombre',
  'accounts.namePlaceholder': 'ej. Cuenta BHD',
  'accounts.type': 'Tipo de cuenta',
  'accounts.asset': 'Activo (mi dinero)',
  'accounts.liability': 'Pasivo (deuda)',
  'accounts.subtype': 'Subtipo',
  'accounts.debtAmount': 'Monto de deuda',
  'accounts.balance': 'Saldo',
  'accounts.institution': 'Institución',
  'accounts.create': 'Crear cuenta',
  'accounts.new': 'Nueva cuenta',
  'accounts.edit': 'Editar cuenta',
  'accounts.created': 'Cuenta creada',
  'accounts.updated': 'Cuenta actualizada',
  'accounts.deleted': 'Cuenta eliminada',
  'accounts.deleteTitle': '¿Eliminar cuenta?',
  'accounts.deleteWithTx':
    'Esta cuenta tiene {n} transacciones asociadas y no se puede eliminar (el historial se conserva). Para retirarla del patrimonio, edita su saldo a 0.',
  'accounts.deleteConfirm': 'Se eliminará "{name}".',
  'accounts.totalIn': 'Total en',
  'accounts.assets': 'Activos',
  'accounts.liabilities': 'Pasivos',
  'accounts.emptyTitle': 'No tienes cuentas aún',
  'accounts.emptyHint': 'Crea tu primera cuenta para comenzar.',
  'accounts.debt': 'Deuda',
  'accounts.deleteFailed': 'No se pudo eliminar: {message}',
  'budgets.deleteTitle': '¿Eliminar partida?',
  'budgets.deleteBody': 'No se puede deshacer.',
  'budgets.cancel': 'Cancelar',
  'budgets.delete': 'Eliminar',
  'budgets.editItem': 'Editar partida',
  'budgets.newItem': 'Nueva partida',
  'budgets.category': 'Categoría',
  'budgets.amount': 'Monto',
  'budgets.alertPct': 'Alerta (%)',
  'budgets.emptyTitle': 'No hay presupuesto',
  'budgets.emptyHint': 'Crea un presupuesto mensual.',
  'budgets.updated': 'Partida actualizada',
  'budgets.added': 'Partida agregada',
  'budgets.deleted': 'Partida eliminada',
  'budgets.duplicate': 'Ya tiene presupuesto',
  'budgets.selectCategory': 'Selecciona categoría',
  'budgets.invalidAmount': 'Monto inválido',
  'budgets.alertAt': 'Alerta al',
  'budgets.saveChanges': 'Guardar Cambios',
  'budgets.add': 'Agregar',
  'budgets.errorNotFound': 'El presupuesto no existe',
  'budgets.errorInvalidCategory': 'La categoría no es válida',
  'budgets.errorInvalidAmount': 'El monto no es válido',
  'dashboard.emptyHint':
    'Tu base de datos está limpia. Comienza creando tu primera cuenta para registrar transacciones y ver tus finanzas crecer.',
  'dashboard.emptyCreateAccount': '➕ Crear cuenta',
  'dashboard.emptyRecordTransaction': 'Registrar transacción',
  'dashboard.noAlerts': 'No hay alertas. ¡Todo bajo control! ✓',
  'reports.rangeAll': 'Todo',
  'reports.exportMenu': 'Exportar reportes',
  'transactions.noTransactionsToExport': 'No hay transacciones para exportar',
  'transactions.exportedCount': '{n} exportadas como {format}',
  'transactions.specificMonth': 'Mes específico...',
  'settings.myProfile': 'Mi perfil',
  'settings.name': 'Nombre',
  'settings.email': 'Email',
  'settings.baseCurrency': 'Moneda base',
  'settings.householdSubtitle': 'Mi Hogar · 1 miembro',
  'settings.members': 'Miembros',
  'settings.householdDev':
    'La gestión multi-miembro (invitar a tu familia, asignar transacciones) está en desarrollo.',
  'settings.categoriesSubtitle': '{n} categorías',
  'settings.categoriesHint':
    'Gestiona, edita y crea categorías en la sección de esta misma página.',
  'settings.passwords': 'Contraseñas',
  'settings.passwordAlgoValue': 'bcrypt (12 rondas)',
  'settings.sessions': 'Sesiones',
  'settings.sessionsValue': 'JWT en cookies httpOnly',
  'settings.twoFactorSubtitle': '2FA · WebAuthn',
  'settings.twoFactorDev': '2FA y passkeys en desarrollo',
  'settings.noConnections': 'Sin conexiones activas',
  'settings.plaidHint': 'Importación automática desde tu banco vía Plaid.',
  'settings.exportHint':
    'Descarga todas tus cuentas y transacciones (sin filtros).',
  'settings.deleteAccountHint': 'Elimina permanentemente todos tus datos',
  'settings.deleteAccountTitle': '¿Eliminar tu cuenta para siempre?',
  'settings.deleteAccountBody':
    'Se eliminarán TODAS tus cuentas, transacciones, presupuestos, categorías y claves API. Esta acción NO se puede deshacer. Exporta tus datos primero si quieres conservarlos.',
  'settings.deleting': 'Eliminando…',
  'settings.deleteEverything': 'Sí, eliminar todo',
  'settings.accountDeleted': 'Cuenta eliminada. Adiós 👋',
  'settings.deleteAccountFailed': 'No se pudo eliminar la cuenta',
  'settings.signOut': 'Cerrar sesión',
  'settings.signOutHint': 'Salir de tu cuenta',
  'import.csvOnly': 'Solo se aceptan archivos .csv',
  'import.exportTitle': 'Exportar datos',
  'import.exportHint': 'Descarga tus transacciones.',
  'import.importCsvTitle': 'Importar CSV',
  'import.selectCsv': 'Selecciona CSV',
  'import.mapColumns': 'Mapea columnas. {n} filas.',
  'import.importCount': 'Importar {n} transacciones',
  'import.importedLabel': 'Importadas',
  'import.totalInFile': 'Total en archivo',
  'import.batchId': 'ID de lote',
  'import.seeTags': 'Ver etiquetas',
  'import.createAccountFirst': 'Crea una cuenta',
  'import.imported': '{n} importadas',
  'import.duplicatesSkipped': ', {n} duplicados omitidos',
  'import.uncategorized': ', {n} sin categoría',
  'import.invalid': ', {n} inválidas',
  'import.defaultDescription': 'Importada',
  'ocr.onlyImages': 'Solo imágenes',
  'ocr.ocrFailed': 'Error OCR',
  'ocr.createAccount': 'Crea cuenta',
  'ocr.expenseAdded': 'Gasto agregado',
  'ocr.scanReceipt': 'Escanear Recibo',
  'ocr.uploadReceipt': 'Sube foto del recibo',
  'ocr.processing': 'Procesando...',
  'ocr.merchant': 'Comercio',
  'ocr.createAccountWarning': '⚠ Crea cuenta',
  'ocr.saveExpense': 'Guardar Gasto',
  'ocr.expenseAddedTitle': '¡Gasto agregado!',
  'bank.createAccountFirst': 'Crea una cuenta',
  'bank.noTransactions': 'Sin transacciones',
  'bank.selectBank': 'Selecciona un banco',
  'bank.processError': 'Error al procesar el archivo',
  'bank.noValidTransactions': 'Sin transacciones válidas',
  'bank.rows': '{n} filas',
  'bank.continue': 'Continuar',
  'bank.income': 'ingresos',
  'bank.expenses': 'gastos',
  'bank.currencyMismatch':
    'El estado de cuenta está en {from} y la cuenta destino en {to} — verifica antes de importar',
  'bank.debit': 'Débito',
  'bank.credit': 'Crédito',
  'bank.defaultDescription': 'Estado de cuenta',
  'categories.management': 'Gestión de Categorías',
  'categories.editTitle': 'Editar categoría',
  'categories.newTitle': 'Nueva categoría',
  'categories.new': 'Nueva',
  'categories.expenses': 'Gastos',
  'categories.income': 'Ingresos',
  'categories.empty': 'Sin categorías aún — pulsa «Nueva» para crear la primera.',
  'categories.system': 'Sistema',
  'categories.deleteTitle': '¿Eliminar categoría?',
  'categories.deleteBody':
    'No se puede deshacer. Si tiene transacciones asociadas, no se podrá eliminar.',
  'categories.created': 'Categoría creada',
  'categories.updated': 'Categoría actualizada',
  'categories.deleted': 'Categoría eliminada',
  'categories.nameEs': 'Nombre (es)',
  'categories.nameEn': 'Nombre (en)',
  'categories.nameEsPlaceholder': 'ej. Restaurantes',
  'categories.direction': 'Tipo',
  'categories.expenseType': 'Gasto',
  'categories.incomeType': 'Ingreso',
  'categories.icon': 'Ícono',
  'categories.color': 'Color',
  'apiKeys.integration': 'Integración con Agentes IA',
  'apiKeys.new': 'Nueva Key',
  'apiKeys.emptyHint':
    'Crea una API key para que un agente IA (como Claude) pueda leer tus finanzas y registrar transacciones automáticamente.',
  'apiKeys.inactive': 'Inactiva',
  'apiKeys.used': 'Usada',
  'apiKeys.deactivate': 'Desactivar',
  'apiKeys.activate': 'Activar',
  'apiKeys.revokeTitle': '¿Revocar API key?',
  'apiKeys.revokeBody':
    'Esta acción no se puede deshacer. El agente IA perderá acceso inmediatamente.',
  'apiKeys.revoke': 'Revocar',
  'apiKeys.created': 'API key creada',
  'apiKeys.revoked': 'API key revocada',
  'apiKeys.deactivated': 'Desactivada',
  'apiKeys.activated': 'Activada',
  'apiKeys.copied': 'Copiado al portapapeles',
  'apiKeys.publicEndpoints': 'Endpoints públicos (API key):',
  'apiKeys.registerExpense': 'Registrar gasto (externo)',
  'apiKeys.listExpenses': 'Listar gastos (?limit=&month=)',
  'apiKeys.monthlySummary': 'Resumen mensual (?month=YYYY-MM)',
  'apiKeys.header': 'Cabecera:',
  'apiKeys.or': 'o',
  'apiKeys.createTitle': 'Crear API Key',
  'apiKeys.createdBody': 'API key creada. Cópiala ahora — no se mostrará de nuevo.',
  'apiKeys.useHeader': 'Para usarla, incluye esta cabecera en las peticiones:',
  'apiKeys.done': 'Listo',
  'apiKeys.agentName': 'Nombre del agente',
  'apiKeys.agentNamePlaceholder': 'ej. Claude, Mi GPT, Asistente',
  'apiKeys.permissions': 'Permisos',
  'apiKeys.readWrite': 'Leer y escribir',
  'apiKeys.readOnly': 'Solo lectura',
  'apiKeys.create': 'Crear API Key',
  'apiKeys.copy': 'Copiar',
  'tx.editTitle': 'Editar Transacción',
  'tx.updated': 'Transacción actualizada',
  'tx.deleted': 'Transacción eliminada',
  'tx.undo': 'Deshacer',
  'tx.restored': 'Transacción restaurada',
  'tx.restoreFailed': 'No se pudo restaurar',
  'tx.deleteFailed': 'Error al eliminar',
  'tx.closeConfirm': '¿Seguro que quieres cerrar? Perderás los cambios no guardados.',
  'tx.categorySource': 'Categoría (origen)',
  'tx.receiptSoon': 'Carga de recibo — próximamente',
  'tx.deleteTitle': '¿Eliminar transacción?',
  'tx.deleteBody':
    'Esta acción no se puede deshacer. La transacción se eliminará permanentemente.',
  'tx.invalidAmount': 'Monto inválido',
  'tx.selectSourceAccount': 'Selecciona la cuenta de origen',
  'tx.selectIncomeCategory': 'Selecciona la categoría de ingreso',
  'tx.selectDestinationAccount': 'Selecciona la cuenta de destino',
  'tx.selectBothAccounts': 'Selecciona ambas cuentas',
};

const en: Record<TranslationKey, string> = {
  'app.name': 'Shikin',
  'nav.dashboard': 'Dashboard',
  'nav.transactions': 'Transactions',
  'nav.add': 'Add',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.accounts': 'Accounts',
  'nav.budgets': 'Budgets',
  'nav.import': 'Import',
  'nav.lightMode': 'Light mode',
  'nav.darkMode': 'Dark mode',
  'nav.more': 'More',
  'nav.logout': 'Sign out',
  'auth.signIn': 'Sign In',
  'auth.signUp': 'Create Account',
  'auth.name': 'Name (optional)',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.passwordHint': 'At least 6 characters',
  'auth.noAccount': "No account? Sign up",
  'auth.hasAccount': 'Already have an account? Sign in',
  'auth.loginSubtitle': 'Sign in to continue',
  'auth.registerSubtitle': 'Create your account to get started',
  'auth.welcomeBack': 'Welcome back!',
  'auth.welcome': 'Welcome to Shikin!',
  'auth.invalidCredentials': 'Invalid email or password',
  'auth.errorRequired': 'Email and password are required',
  'auth.errorGeneric': 'Something went wrong. Please try again.',
  'auth.weakPassword': 'Password too short (min 6 characters)',
  'auth.passwordStrength': 'Strength',
  'auth.strength.weak': 'Weak',
  'auth.strength.fair': 'Fair',
  'auth.strength.strong': 'Strong',
  'auth.forgotPassword': 'Forgot your password?',
  'dashboard.greeting.morning': 'Good morning',
  'dashboard.greeting.afternoon': 'Good afternoon',
  'dashboard.greeting.evening': 'Good evening',
  'dashboard.netWorth': 'Net Worth',
  'dashboard.thisMonth': 'This month',
  'dashboard.income': 'Income',
  'dashboard.expenses': 'Expenses',
  'dashboard.savingsRatio': 'Savings Ratio',
  'dashboard.savingsTarget': 'Target 20%',
  'dashboard.cashFlow': 'Cash Flow',
  'dashboard.expenseDistribution': 'Expense Distribution',
  'dashboard.alerts': 'Alerts',
  'dashboard.recentTransactions': 'Recent Transactions',
  'dashboard.viewAll': 'View all',
  'dashboard.topCategories': 'Top Categories',
  'dashboard.forecast': 'Next Month Forecast',
  'transactions.title': 'Transactions',
  'transactions.search': 'Search...',
  'transactions.filter': 'Filter',
  'transactions.export': 'Export',
  'transactions.allCategories': 'All categories',
  'transactions.allMembers': 'All members',
  'transactions.allAccounts': 'All accounts',
  'transactions.allCurrencies': 'All currencies',
  'transactions.thisMonth': 'This month',
  'transactions.lastMonth': 'Last month',
  'transactions.thisQuarter': 'This quarter',
  'transactions.thisYear': 'This year',
  'transactions.lastYear': 'Last year',
  'transactions.noTransactions': 'No transactions',
  'transactions.emptyHint': 'Record your first expense or income to see it here.',
  'transactions.emptyCta': 'Add first transaction',
  'transactions.showing': 'Showing',
  'transactions.of': 'of',
  'transactions.today': 'TODAY',
  'transactions.yesterday': 'YESTERDAY',
  'transactions.income': 'Income',
  'transactions.expense': 'Expense',
  'transactions.transfer': 'Transfer',
  'transactions.adjustment': 'Adjustment',
  'tx.addTitle': 'New Transaction',
  'tx.amount': 'Amount',
  'tx.fromAccount': 'From account',
  'tx.toAccount': 'To account',
  'tx.toCategory': 'Category',
  'tx.source': 'Source',
  'tx.description': 'Description',
  'tx.descriptionPlaceholder': 'e.g. Supermarket',
  'tx.date': 'Date',
  'tx.pickDate': 'Pick a date',
  'tx.member': 'Member',
  'tx.save': 'Save Transaction',
  'tx.saving': 'Saving...',
  'tx.saved': 'Transaction saved',
  'tx.saveFailed': 'Failed to save',
  'tx.attachReceipt': 'Attach receipt',
  'tx.cancel': 'Cancel',
  'budgets.title': 'Budgets',
  'budgets.new': 'New',
  'budgets.overall': 'Overall',
  'budgets.spent': 'spent',
  'budgets.approaching': 'Approaching limit',
  'budgets.overBudget': 'Over budget',
  'budgets.left': 'left',
  'budgets.by': 'by',
  'budgets.suggestion': 'Suggestion',
  'reports.title': 'Reports',
  'reports.range': 'Range',
  'reports.totalIncome': 'Total Income',
  'reports.totalExpenses': 'Total Expenses',
  'reports.netSavings': 'Net Savings',
  'reports.incomeVsExpenses': 'Income vs Expenses',
  'reports.topCategories': 'Top Categories',
  'reports.export': 'Export',
  'reports.emptyTitle': 'No data yet',
  'reports.emptyHint': 'Record transactions to see your reports and analytics.',
  'reports.emptyCta': 'Add transaction',
  'reports.noExpenses': 'No expenses in this period',
  'import.title': 'Import Center',
  'import.csv': 'Import CSV',
  'import.csvDesc': 'Drop a .csv file',
  'import.receipt': 'Scan Receipt (OCR)',
  'import.receiptDesc': 'Take a photo or upload an image',
  'import.bank': 'Import from your bank',
  'import.bankDesc': 'Bank statements CSV or OFX/QFX',
  'import.bankChoose': 'Choose your bank',
  'import.bankUpload': 'Upload your statement',
  'import.bankUploadHint': "Download the statement (CSV or OFX/QFX) from your bank's online banking and upload it here.",
  'import.bankMapColumns': 'Confirm column mapping',
  'import.bankPreview': 'Preview',
  'import.bankTarget': 'Target account',
  'import.bankImport': 'Import transactions',
  'import.bankImported': 'Imported',
  'import.bankDuplicates': 'Duplicates skipped',
  'import.bankInvalid': 'Invalid rows',
  'import.bankDetected': 'transactions detected',
  'import.bankRange': 'Range',
  'import.bankOther': 'Other bank (generic)',
  'import.bankOfxAuto': 'OFX/QFX detected — automatic mapping',
  'import.recentImports': 'Recent imports',
  'settings.title': 'Settings',
  'settings.profile': 'Profile',
  'settings.household': 'Household',
  'settings.categories': 'Categories',
  'settings.security': 'Security',
  'settings.bankConnections': 'Bank Connections',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.currency': 'Base currency',
  'settings.dataExport': 'Export data',
  'settings.deleteAccount': 'Delete account',
  'common.light': 'Light',
  'common.dark': 'Dark',
  'common.system': 'System',
  'common.spanish': 'Spanish',
  'common.english': 'English',
  'common.other': 'Other',
  'common.today': 'Today',
  'common.all': 'All',
  'common.lastMonths': 'Last {n} months',
  'common.exportCsv': 'Export CSV',
  'common.exportJson': 'Export JSON',
  'common.selectMonth': 'Select month',
  'common.nameRequired': 'Name required',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.saveChanges': 'Save Changes',
  'common.create': 'Create',
  'common.close': 'Close',
  'common.soon': 'Soon',
  'common.noData': 'No data',
  'common.exported': 'Exported {format}',
  'common.selectAccount': 'Select account',
  'common.selectCategory': 'Select category',
  'common.invalidAmount': 'Invalid amount',
  'common.failed': 'Failed',
  'common.account': 'Account',
  'common.category': 'Category',
  'common.amount': 'Amount',
  'common.date': 'Date',
  'common.description': 'Description',
  'common.type': 'Type',
  'common.optional': 'optional',
  'common.currency': 'Currency',
  'common.more': 'more',
  'common.importCompleted': 'Import completed!',
  'common.emptyFile': 'Empty file',
  'common.csvError': 'CSV error',
  'a11y.skipToContent': 'Skip to main content',
  'a11y.loadingPanel': 'Loading',
  'a11y.sidebar': 'Sidebar navigation',
  'a11y.toggleSidebar': 'Toggle sidebar',
  'a11y.toggleTheme': 'Toggle theme',
  'a11y.switchLanguage': 'Switch language',
  'a11y.edit': 'Edit',
  'a11y.delete': 'Delete',
  'a11y.bottomNav': 'Bottom navigation',
  'a11y.moreMenu': 'More options menu',
  'accounts.errorHasTransactions':
    'This account has {n} linked transactions and cannot be deleted (history is preserved). To remove it from your net worth, edit its balance to 0.',
  'accounts.name': 'Name',
  'accounts.namePlaceholder': 'e.g. BHD Checking',
  'accounts.type': 'Account type',
  'accounts.asset': 'Asset (my money)',
  'accounts.liability': 'Liability (debt)',
  'accounts.subtype': 'Subtype',
  'accounts.debtAmount': 'Debt amount',
  'accounts.balance': 'Balance',
  'accounts.institution': 'Institution',
  'accounts.create': 'Create account',
  'accounts.new': 'New account',
  'accounts.edit': 'Edit account',
  'accounts.created': 'Account created',
  'accounts.updated': 'Account updated',
  'accounts.deleted': 'Account deleted',
  'accounts.deleteTitle': 'Delete account?',
  'accounts.deleteWithTx':
    'This account has {n} linked transactions and cannot be deleted (history is preserved). To remove it from your net worth, edit its balance to 0.',
  'accounts.deleteConfirm': 'Delete "{name}"?',
  'accounts.totalIn': 'Total in',
  'accounts.assets': 'Assets',
  'accounts.liabilities': 'Liabilities',
  'accounts.emptyTitle': 'No accounts yet',
  'accounts.emptyHint': 'Create your first account.',
  'accounts.debt': 'Debt',
  'accounts.deleteFailed': 'Could not delete: {message}',
  'budgets.deleteTitle': 'Delete budget item?',
  'budgets.deleteBody': 'Cannot be undone.',
  'budgets.cancel': 'Cancel',
  'budgets.delete': 'Delete',
  'budgets.editItem': 'Edit budget item',
  'budgets.newItem': 'New budget item',
  'budgets.category': 'Category',
  'budgets.amount': 'Amount',
  'budgets.alertPct': 'Alert (%)',
  'budgets.emptyTitle': 'No budget',
  'budgets.emptyHint': 'Create a monthly budget.',
  'budgets.updated': 'Budget updated',
  'budgets.added': 'Budget added',
  'budgets.deleted': 'Budget deleted',
  'budgets.duplicate': 'Already budgeted',
  'budgets.selectCategory': 'Select category',
  'budgets.invalidAmount': 'Invalid amount',
  'budgets.alertAt': 'Alert at',
  'budgets.saveChanges': 'Save Changes',
  'budgets.add': 'Add',
  'budgets.errorNotFound': 'The budget does not exist',
  'budgets.errorInvalidCategory': 'The category is not valid',
  'budgets.errorInvalidAmount': 'The amount is not valid',
  'dashboard.emptyHint':
    'Your database is clean. Start by creating your first account to record transactions and watch your finances grow.',
  'dashboard.emptyCreateAccount': '➕ Create account',
  'dashboard.emptyRecordTransaction': 'Record transaction',
  'dashboard.noAlerts': 'No alerts. All under control! ✓',
  'reports.rangeAll': 'All',
  'reports.exportMenu': 'Export reports',
  'transactions.noTransactionsToExport': 'No transactions to export',
  'transactions.exportedCount': '{n} exported as {format}',
  'transactions.specificMonth': 'Specific month...',
  'settings.myProfile': 'My profile',
  'settings.name': 'Name',
  'settings.email': 'Email',
  'settings.baseCurrency': 'Base currency',
  'settings.householdSubtitle': 'My Household · 1 member',
  'settings.members': 'Members',
  'settings.householdDev':
    'Multi-member management (invite your family, assign transactions) is in development.',
  'settings.categoriesSubtitle': '{n} categories',
  'settings.categoriesHint':
    'Manage, edit and create categories in the section below on this page.',
  'settings.passwords': 'Passwords',
  'settings.passwordAlgoValue': 'bcrypt (12 rounds)',
  'settings.sessions': 'Sessions',
  'settings.sessionsValue': 'JWT in httpOnly cookies',
  'settings.twoFactorSubtitle': '2FA · WebAuthn',
  'settings.twoFactorDev': '2FA & passkeys in development',
  'settings.noConnections': 'No active connections',
  'settings.plaidHint': 'Automatic bank import via Plaid.',
  'settings.exportHint': 'Download all your accounts and transactions (no filters).',
  'settings.deleteAccountHint': 'Permanently delete all your data',
  'settings.deleteAccountTitle': 'Delete your account forever?',
  'settings.deleteAccountBody':
    'ALL your accounts, transactions, budgets, categories and API keys will be deleted. This action CANNOT be undone. Export your data first if you want to keep it.',
  'settings.deleting': 'Deleting…',
  'settings.deleteEverything': 'Yes, delete everything',
  'settings.accountDeleted': 'Account deleted. Bye 👋',
  'settings.deleteAccountFailed': 'Failed to delete account',
  'settings.signOut': 'Sign out',
  'settings.signOutHint': 'Sign out of your account',
  'import.csvOnly': 'Only .csv files are accepted',
  'import.exportTitle': 'Export data',
  'import.exportHint': 'Download your transactions.',
  'import.importCsvTitle': 'Import CSV',
  'import.selectCsv': 'Select CSV',
  'import.mapColumns': 'Map columns. {n} rows.',
  'import.importCount': 'Import {n} transactions',
  'import.importedLabel': 'Imported',
  'import.totalInFile': 'Total in file',
  'import.batchId': 'Batch ID',
  'import.seeTags': 'See tags',
  'import.createAccountFirst': 'Create account',
  'import.imported': '{n} imported',
  'import.duplicatesSkipped': ', {n} duplicates skipped',
  'import.uncategorized': ', {n} uncategorized',
  'import.invalid': ', {n} invalid',
  'import.defaultDescription': 'Imported',
  'ocr.onlyImages': 'Only images',
  'ocr.ocrFailed': 'OCR failed',
  'ocr.createAccount': 'Create account',
  'ocr.expenseAdded': 'Expense added',
  'ocr.scanReceipt': 'Scan Receipt',
  'ocr.uploadReceipt': 'Upload receipt',
  'ocr.processing': 'Processing...',
  'ocr.merchant': 'Merchant',
  'ocr.createAccountWarning': '⚠ Create account',
  'ocr.saveExpense': 'Save Expense',
  'ocr.expenseAddedTitle': 'Expense added!',
  'bank.createAccountFirst': 'Create account first',
  'bank.noTransactions': 'No transactions found',
  'bank.selectBank': 'Select a bank',
  'bank.processError': 'Error processing file',
  'bank.noValidTransactions': 'No valid transactions',
  'bank.rows': '{n} rows',
  'bank.continue': 'Continue',
  'bank.income': 'income',
  'bank.expenses': 'expenses',
  'bank.currencyMismatch':
    'Statement is in {from} but target account is in {to} — double-check before importing',
  'bank.debit': 'Debit',
  'bank.credit': 'Credit',
  'bank.defaultDescription': 'Bank statement',
  'categories.management': 'Category Management',
  'categories.editTitle': 'Edit category',
  'categories.newTitle': 'New category',
  'categories.new': 'New',
  'categories.expenses': 'Expenses',
  'categories.income': 'Income',
  'categories.empty': 'No categories yet — press "New" to create the first one.',
  'categories.system': 'System',
  'categories.deleteTitle': 'Delete category?',
  'categories.deleteBody':
    'Cannot undo. If transactions use it, deletion will be blocked.',
  'categories.created': 'Category created',
  'categories.updated': 'Category updated',
  'categories.deleted': 'Category deleted',
  'categories.nameEs': 'Name (es)',
  'categories.nameEn': 'Name (en)',
  'categories.nameEsPlaceholder': 'e.g. Restaurants',
  'categories.direction': 'Direction',
  'categories.expenseType': 'Expense',
  'categories.incomeType': 'Income',
  'categories.icon': 'Icon',
  'categories.color': 'Color',
  'apiKeys.integration': 'AI Agent Integration',
  'apiKeys.new': 'New Key',
  'apiKeys.emptyHint':
    'Create an API key so an AI agent (like Claude) can read your finances and register transactions automatically.',
  'apiKeys.inactive': 'Inactive',
  'apiKeys.used': 'Used',
  'apiKeys.deactivate': 'Deactivate',
  'apiKeys.activate': 'Activate',
  'apiKeys.revokeTitle': 'Revoke API key?',
  'apiKeys.revokeBody':
    'This cannot be undone. The AI agent will lose access immediately.',
  'apiKeys.revoke': 'Revoke',
  'apiKeys.created': 'API key created',
  'apiKeys.revoked': 'API key revoked',
  'apiKeys.deactivated': 'Deactivated',
  'apiKeys.activated': 'Activated',
  'apiKeys.copied': 'Copied to clipboard',
  'apiKeys.publicEndpoints': 'Public endpoints (API key):',
  'apiKeys.registerExpense': 'Register expense (external)',
  'apiKeys.listExpenses': 'List expenses (?limit=&month=)',
  'apiKeys.monthlySummary': 'Monthly summary (?month=YYYY-MM)',
  'apiKeys.header': 'Header:',
  'apiKeys.or': 'or',
  'apiKeys.createTitle': 'Create API Key',
  'apiKeys.createdBody': 'API key created. Copy it now — it won\'t be shown again.',
  'apiKeys.useHeader': 'To use it, include this header in requests:',
  'apiKeys.done': 'Done',
  'apiKeys.agentName': 'Agent name',
  'apiKeys.agentNamePlaceholder': 'e.g. Claude, My GPT, Assistant',
  'apiKeys.permissions': 'Permissions',
  'apiKeys.readWrite': 'Read and write',
  'apiKeys.readOnly': 'Read only',
  'apiKeys.create': 'Create API Key',
  'apiKeys.copy': 'Copy',
  'tx.editTitle': 'Edit Transaction',
  'tx.updated': 'Transaction updated',
  'tx.deleted': 'Transaction deleted',
  'tx.undo': 'Undo',
  'tx.restored': 'Transaction restored',
  'tx.restoreFailed': 'Could not restore',
  'tx.deleteFailed': 'Failed to delete',
  'tx.closeConfirm': 'Are you sure you want to close? You will lose unsaved changes.',
  'tx.categorySource': 'Category (source)',
  'tx.receiptSoon': 'Receipt upload — coming soon',
  'tx.deleteTitle': 'Delete transaction?',
  'tx.deleteBody':
    'This action cannot be undone. The transaction will be permanently deleted.',
  'tx.invalidAmount': 'Invalid amount',
  'tx.selectSourceAccount': 'Select the source account',
  'tx.selectIncomeCategory': 'Select the income category',
  'tx.selectDestinationAccount': 'Select the destination account',
  'tx.selectBothAccounts': 'Select both accounts',
};

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  es,
  en,
};
