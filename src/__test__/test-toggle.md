# Test: Toggle Logic Improvements

## Nueva Funcionalidad Implementada

### Estado Global vs Individual

La extensión ahora maneja dos estados principales:

1. **Estado Global (`isEnabled`)**:
   - `true`: Extensión activada globalmente
   - `false`: Extensión desactivada globalmente

2. **Archivos Individuales**:
   - `disabledEditors`: Archivos desactivados cuando está activado globalmente
   - `individuallyEnabledEditors`: Archivos activados cuando está desactivado globalmente

### Flujo de Funcionamiento

#### Cuando está Activado Globalmente (`isEnabled = true`):
- Todos los archivos están activados por defecto
- Solo los archivos en `disabledEditors` están desactivados
- "Toggle Current File" agrega/quita archivos de `disabledEditors`

#### Cuando está Desactivado Globalmente (`isEnabled = false`):
- Todos los archivos están desactivados por defecto
- Solo los archivos en `individuallyEnabledEditors` están activados
- "Toggle Current File" agrega/quita archivos de `individuallyEnabledEditors`

### Casos de Uso

#### Caso 1: Desactivar Globalmente y Activar Archivo Individual
1. Usuario presiona "🌐 Toggle Global" → Extensión se desactiva globalmente
2. Usuario presiona "📝 Toggle Current File" → Archivo actual se activa individualmente
3. Otros archivos permanecen desactivados
4. Solo el archivo actual muestra decoraciones

#### Caso 2: Activar Globalmente desde Estado Individual
1. Usuario tiene algunos archivos activados individualmente
2. Usuario presiona "🌐 Toggle Global" → Extensión se activa globalmente
3. Todos los archivos se activan (excepto los que estaban en `disabledEditors`)
4. Lista de archivos individuales se limpia

#### Caso 3: Desactivar Archivo Específico en Modo Global
1. Extensión está activada globalmente
2. Usuario presiona "📝 Toggle Current File" → Archivo actual se desactiva
3. Archivo se agrega a `disabledEditors`
4. Otros archivos permanecen activados

### Persistencia

- `bracketLynx.globalEnabled`: Estado global (boolean)
- `bracketLynx.disabledFiles`: Lista de archivos desactivados (array)
- `bracketLynx.individuallyEnabledFiles`: Lista de archivos activados individualmente (array)

### Mejoras en la UI

- Menú dinámico que muestra el estado actual
- Indicadores visuales (🟢 Active / 🔴 Inactive) para mostrar estado
- Descripciones contextuales según el estado actual
- Manejo de errores mejorado con try-catch
- Logs de debug para diagnóstico
- Comando de debug para verificar estado actual

### Funciones Principales Modificadas

1. `isEditorEnabled()`: Ahora maneja ambos modos
2. `isDocumentEnabled()`: Ahora maneja ambos modos  
3. `isExtensionEnabled()`: **CORREGIDA** - Ahora considera archivos individuales cuando está desactivado globalmente
4. `toggleCurrentEditor()`: Lógica separada para cada modo con manejo de errores
5. `toggleBracketLynx()`: Limpia archivos individuales al activar globalmente
6. `cleanupClosedEditor()`: Limpia ambos mapas de archivos
7. `getMenuOptions()`: Indicadores de color corregidos (🟢 Active / 🔴 Inactive)
8. `reactivateExtension()`: Mejorada para forzar actualización de decoraciones
9. `getCurrentState()`: Nueva función de debug para diagnosticar problemas

### Compatibilidad

- Mantiene compatibilidad con configuraciones existentes
- Migración automática de estado anterior
- No afecta funcionalidad existente

### Troubleshooting

#### Si las decoraciones no aparecen:

1. **Usar el comando de debug**: 
   - Presiona `Ctrl+Shift+P` (o `Cmd+Shift+P` en Mac)
   - Busca "Bracket Lynx: Debug State 🔍"
   - Revisa la consola de desarrollador para ver el estado actual

2. **Verificar logs**:
   - Abre la consola de desarrollador (`Help > Toggle Developer Tools`)
   - Busca mensajes que empiecen con "🔄 Toggle Current Editor" o "🔍 Bracket Lynx Debug State"

3. **Forzar actualización**:
   - Cambia de archivo y vuelve al archivo original
   - O presiona "Toggle Current File" dos veces

#### Problema Principal Corregido:

**Antes**: `isExtensionEnabled()` solo retornaba `isEnabled`, por lo que cuando estaba desactivado globalmente, nunca se ejecutaban las decoraciones.

**Ahora**: `isExtensionEnabled()` considera tanto el modo global como los archivos individuales activados.

#### Comandos disponibles:

- `Bracket Lynx: Toggle & Refresh 🛠️` - Menú principal
- `Bracket Lynx: Debug State 🔍` - Ver estado actual
