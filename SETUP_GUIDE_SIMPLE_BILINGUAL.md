# LocalFlow - Guía de Instalación Simplificada / Simple Setup Guide

## 📋 ¿Qué es LocalFlow? / What is LocalFlow?

**Español:** LocalFlow es un sistema que **convierte tu voz en texto escrito** automáticamente. Hablas, y el programa escribe lo que dijiste en cualquier aplicación (Word, Excel, AutoCAD, etc.). Es como tener un asistente que te ayuda a escribir rápidamente usando tu voz.

**English:** LocalFlow is a system that **converts your voice to written text** automatically. You speak, and the program types what you said into any application (Word, Excel, AutoCAD, etc.). It's like having an assistant that helps you write quickly using your voice.

---

## ⚡ Instalación Automática Rápida / Quick Automated Setup (Recomendado / Recommended)

> **Nota / Note:** ¡Hay un script de instalación automática que hace casi todo por ti! / There's an automated installation script that handles most of this for you!

### Paso 0 / Step 0: Descargar LocalFlow / Download LocalFlow

**Opción A / Option A: Descargar ZIP (Más Fácil / Easiest)**

**Español:**
1. Ve a: https://github.com/jarmen423/whispr_flow_clone_opus (o donde esté el repositorio)
2. Haz clic en el botón verde **"Code"**
3. Haz clic en **"Download ZIP"**
4. Extrae el ZIP a una carpeta (ej: `C:\LocalFlow` o `C:\Users\TuNombre\LocalFlow`)
5. ¡Recuerda esta ubicación!

**English:**
1. Go to: https://github.com/jarmen423/whispr_flow_clone_opus (or wherever this repo is)
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Extract the ZIP to a folder (e.g., `C:\LocalFlow` or `C:\Users\YourName\LocalFlow`)
5. Remember this location!

**Opción B / Option B: Clonar con Git (Si tienes Git instalado / If you have Git installed)**

```powershell
# Clonar a tu ubicación deseada / Clone to your desired location
cd C:\Users\TuNombre
git clone https://github.com/jarmen423/whispr_flow_clone_opus.git LocalFlow
cd LocalFlow
```

### Paso 1 / Step 1: Instalación con Un Clic / One-Click Install (Más Fácil / Easiest)

**Español:**
1. Abre **PowerShell** (búscalo en el menú de Windows)
2. Navega a **donde descargaste/extrajiste** LocalFlow:

```powershell
# Ejemplo - ajusta a TU ruta:
cd C:\Users\TuNombre\LocalFlow

# O si lo extrajiste en el Escritorio:
cd C:\Users\TuNombre\Desktop\LocalFlow

# O donde sea que lo hayas puesto:
cd "C:\Tu\Ruta\Real\A\LocalFlow"
```

3. Ejecuta el instalador:

```powershell
.\scripts\install-cli.ps1
```

Esto instala el comando `localflow` en tu sistema.

4. **Reinicia PowerShell**, luego simplemente ejecuta desde **cualquier lugar**:

```powershell
localflow
```

¡Listo! LocalFlow se iniciará automáticamente. Usa `Alt+L` para dictar en cualquier lugar.

Para detener:
```powershell
localflow -stop
```

**English:**
1. Open **PowerShell** (search for it in Windows menu)
2. Navigate to **where you downloaded/extracted** LocalFlow:

```powershell
# Example - adjust to YOUR path:
cd C:\Users\YourName\LocalFlow

# Or if you extracted to your Desktop:
cd C:\Users\YourName\Desktop\LocalFlow

# Or wherever you put it:
cd "C:\Your\Actual\Path\To\LocalFlow"
```

3. Run the installer:

```powershell
.\scripts\install-cli.ps1
```

This installs the `localflow` command to your system.

4. **Restart PowerShell**, then simply run from **anywhere**:

```powershell
localflow
```

Done! LocalFlow will start automatically. Use `Alt+L` to dictate anywhere.

To stop:
```powershell
localflow -stop
```

---

## 🔑 Paso 2 / Step 2: Configurar Claves API / Configure API Keys

**Español:** ¡El instalador anterior te **pedirá automáticamente las claves API**!

**English:** The installer above will **automatically prompt you for API keys!**

**Si las omitiste durante la instalación / If you skipped them during install:**
```powershell
cd C:\Tu\Ruta\Real\A\LocalFlow
.\scripts\setup-api-keys.ps1
```

### Claves que Necesitas / Keys You'll Need:

| Clave / Key | Propósito / Purpose | ¿Requerida? / Required? | Obtenerla Gratis / Get It Free |
|-------------|---------------------|-------------------------|--------------------------------|
| **Groq** | Voz a texto / Speech-to-text | ✅ Sí / Yes | [console.groq.com/keys](https://console.groq.com/keys) |
| **Cerebras** | Formato inteligente (Alt+M) / Smart formatting | ⭕ Opcional / Optional | [cloud.cerebras.ai](https://cloud.cerebras.ai/) |

## 🎮 Qué Esperar y Cómo Usar / What to Expect & How to Use

**Español:** Después de ejecutar `localflow`, verás esto:

**English:** After running `localflow`, you'll see output like this:

```
============================================================
LocalFlow Desktop Agent
============================================================
Hotkey (raw): alt+l
Hotkey (format): alt+m
Hotkey (translate): alt+t
Mode: developer
Processing: cloud
============================================================
Listening for hotkey: alt+l
Translation toggle: alt+t (currently OFF)
Press the hotkey to start recording, release to stop and transcribe.
Press Ctrl+C to exit.
```

### Teclas de Atajo Predeterminadas / Default Hotkeys:

| Tecla / Hotkey | Función / Function |
|----------------|-------------------|
| **Alt+L** | **Modo raw / Raw mode** - Mantén presionado para grabar, suelta para transcribir. Sin formato, máxima velocidad. / Hold to record, release to transcribe. No formatting, fastest speed. |
| **Alt+M** | **Modo formato / Format mode** - Mantén presionado para grabar, suelta para transcribir con formato inteligente (listas, viñetas, etc.) / Hold to record, release to transcribe with smart formatting (lists, bullets, etc.) |
| **Alt+T** | **Alternar traducción / Toggle translation** - Presiona una vez para activar/desactivar modo traducción (habla cualquier idioma → salida en inglés) / Press once to turn on/off translation mode (speak any language → English output) |

### Cómo Usar / How to Use:

**Español:**
1. **Abre cualquier aplicación** (Word, Excel, Notepad, PowerShell, etc.)
2. **Haz clic donde quieres que aparezca el texto**
3. **Mantén presionado Alt+L** (mantén ambas teclas presionadas)
4. **Habla** mientras mantienes las teclas presionadas
5. **Suelta** cuando termines de hablar
6. ¡El texto aparece automáticamente!

**English:**
1. **Open any application** (Word, Excel, Notepad, PowerShell, etc.)
2. **Click where you want text to appear**
3. **Hold Alt+L** (keep both keys pressed)
4. **Speak** while holding the keys
5. **Release** when done speaking
6. Text automatically appears!

### ¿Quieres Diferentes Teclas de Atajo? / Want Different Hotkeys?

**Español:** Si quieres personalizar las teclas de atajo (ej: usar Alt+V en lugar de Alt+L):

**English:** If you want to customize the hotkeys (e.g., use Alt+V instead of Alt+L):

**1. Navega a tu carpeta LocalFlow / Navigate to your LocalFlow folder:**
```powershell
cd C:\Tu\Ruta\Real\A\LocalFlow
```

**2. Crea/edita el archivo `.env` / Create/edit the `.env` file:**
```powershell
# Si .env no existe, copia el ejemplo / If .env doesn't exist, copy the example:
copy .env.example .env

# Edita con Bloc de Notas / Edit with Notepad:
notepad .env
```

**3. Agrega o modifica estas líneas / Add or modify these lines:**
```bash
# Personaliza tus teclas de atajo (usa letras, no símbolos) / Customize your hotkeys (use letter keys, not symbols):
LOCALFLOW_HOTKEY=alt+v          # Cambia tecla modo raw / Change raw mode hotkey
LOCALFLOW_FORMAT_HOTKEY=alt+f   # Cambia tecla modo formato / Change format mode hotkey
LOCALFLOW_TRANSLATE_HOTKEY=alt+t # Cambia tecla de traducción / Change translation toggle
```

**4. Guarda y reinicia LocalFlow / Save and restart LocalFlow:**
```powershell
localflow -stop
localflow
```

**Nota / Note:** Usa **teclas de letras** (a-z) para mejor confiabilidad. Las teclas de símbolos como `/`, `?`, `-` pueden ser poco confiables en Windows. / Use **letter keys** (a-z) for best reliability. Symbol keys like `/`, `?`, `-` can be unreliable on Windows.

---



---

## 🛠️ Instalación Manual / Manual Setup (Si la instalación automática falla / If Automated Install Fails)

**Español:** Si el script automático no funciona, sigue estos pasos:

**English:** If the automated script doesn't work, follow these steps:

### Paso 1 / Step 1: Instalar Programas Necesarios / Install Required Programs

#### A) Instalar Motor de JavaScript / Install Node.js Runtime

**Español - Si tienes Bun y funciona:**
```powershell
# Instalar Bun (motor rápido de JavaScript)
powershell -c "irm bun.sh/install.ps1|iex"

# Verificar
bun --version
```

**Español - Si Bun no funciona o tienes problemas (Específico de Windows):**

> Muchos usuarios de Windows tienen problemas con Bun. Usa Node.js + npm en su lugar:

1. Descarga Node.js de: https://nodejs.org/
2. Descarga la **versión LTS** (botón verde)
3. Ejecuta el instalador (mantén todas las opciones predeterminadas)
4. Verifica la instalación:

```powershell
node --version
npm --version
```

Ambos comandos deben mostrar números de versión.

**Nota Importante:** Si usas npm en lugar de bun, reemplaza todos los comandos `bun` con `npm` en esta guía:
- `bun install` → `npm install`
- `bun run dev:all` → `npm run dev:all`
- `bun run dev` → `npm run dev`

---

**English - If you have Bun and it works:**
```powershell
# Install Bun (fast JavaScript runtime)
powershell -c "irm bun.sh/install.ps1|iex"

# Verify
bun --version
```

**English - If Bun doesn't work or you encounter issues (Windows-specific):**

> Many Windows users face issues with Bun. Use Node.js + npm instead:

1. Download Node.js from: https://nodejs.org/
2. Download the **LTS version** (green button)
3. Run the installer (keep all default options)
4. Verify installation:

```powershell
node --version
npm --version
```

Both commands should show version numbers.

**Important Note:** If using npm instead of bun, replace all `bun` commands with `npm` throughout this guide:
- `bun install` → `npm install`
- `bun run dev:all` → `npm run dev:all`
- `bun run dev` → `npm run dev`

---

#### B) Instalar Python / Install Python

**Español:**
1. Ve a: https://www.python.org/downloads/
2. Descarga la última versión para Windows (botón amarillo "Download Python")
3. **IMPORTANTE:** Durante la instalación, marca la casilla **"Add Python to PATH"**
4. Haz clic en "Install Now"
5. Verifica:

```powershell
python --version
```

**English:**
1. Go to: https://www.python.org/downloads/
2. Download the latest version for Windows
3. **IMPORTANT:** During installation, check **"Add Python to PATH"**
4. Click "Install Now"
5. Verify:

```powershell
python --version
```

---

### Paso 2 / Step 2: Navegar a LocalFlow / Navigate to LocalFlow

```powershell
# Navega a donde extrajiste/clonaste LocalFlow / Navigate to wherever you extracted/cloned LocalFlow
cd C:\Tu\Ruta\Real\A\LocalFlow
```

---

### Paso 3 / Step 3: Instalar Dependencias / Install Dependencies

#### A) Instalar paquetes de JavaScript / Install JavaScript packages:

**Con Bun / With Bun:**
```powershell
bun install
```

**Con npm (si Bun no funciona) / With npm (if Bun doesn't work):**
```powershell
npm install
```

Espera unos minutos a que descargue todo / Wait a few minutes for it to download everything.

#### B) Instalar paquetes de Python / Install Python packages:

```powershell
cd agent
pip install pynput sounddevice scipy python-socketio pyperclip pyautogui numpy
cd ..
```

---

### Paso 4 / Step 4: Configurar Modo Cloud / Configure Cloud Mode (Modo de Procesamiento Más Fácil / Easiest Processing Mode)

**Español:** Este modo usa servicios en internet para procesar tu voz. **Cuesta aproximadamente $1-2/mes** con uso normal, o usa el nivel gratuito generoso.

**English:** This mode uses internet services to process your voice. **Costs about $1-2/month** with normal use, or use the generous free tier.

#### A) Obtener una Clave API de Groq / Get a Groq API Key (Gratis / Free):

**Español:**
1. Ve a: https://console.groq.com/playground
2. Crea una cuenta gratuita (puedes usar Google/Microsoft)
3. Haz clic en "API Keys" en el menú izquierdo
4. Haz clic en "Create API Key"
5. Dale un nombre (ejemplo: "LocalFlow")
6. **Copia la clave** (se ve como: `gsk_abcd1234...`)

**English:**
1. Go to: https://console.groq.com/playground
2. Create a free account (can use Google/Microsoft login)
3. Click "API Keys" in the left menu
4. Click "Create API Key"
5. Give it a name (e.g., "LocalFlow")
6. **Copy the key** (looks like: `gsk_abcd1234...`)

#### B) Configurar el archivo .env / Configure the .env file:

```powershell
# Copiar el archivo de ejemplo / Copy the example file
copy .env.example .env

# Editar con Bloc de Notas / Edit with Notepad
notepad .env
```

**Español:** En el Bloc de Notas, busca y modifica estas líneas:

**English:** In Notepad, find and modify these lines:

```bash
# Cambia esto / Change this:
PROCESSING_MODE=networked-local

# Por esto / To this:
PROCESSING_MODE=cloud

# Y agrega tu clave API de Groq / And add your Groq API key:
GROQ_API_KEY=gsk_pega_tu_clave_aqui
```

Guarda (Ctrl+S) y cierra el Bloc de Notas / Save (Ctrl+S) and close Notepad.

---

### Paso 5 / Step 5: Iniciar LocalFlow / Start LocalFlow

**Español:** Necesitas **DOS ventanas** de PowerShell:

**English:** You need **TWO PowerShell windows**:

**Ventana 1 / Window 1 - Aplicación Web y Servicio WebSocket / Web Application & WebSocket Service:**
```powershell
# Navega a tu carpeta LocalFlow / Navigate to your LocalFlow folder
cd C:\Tu\Ruta\Real\A\LocalFlow

# Con Bun / With Bun:
bun run dev:all

# O con npm / OR with npm:
npm run dev:all
```

**Ventana 2 / Window 2 - Agente de Escritorio / Desktop Agent:**
```powershell
# Navega a tu carpeta LocalFlow / Navigate to your LocalFlow folder
cd C:\Tu\Ruta\Real\A\LocalFlow\agent
python localflow-agent.py
```

✅ **Español:** Deberías ver:
✅ **English:** You should see:

```
============================================
LocalFlow Desktop Agent
============================================
Hotkey: alt+l
Mode: developer
Processing: cloud
============================================
Listening for hotkey: alt+l
```

---

### Paso 6 / Step 6: ¡Usar LocalFlow! / Use LocalFlow!

#### A) Probar en Navegador Web / Test in Web Browser:

**Español:**
1. Abre tu navegador
2. Ve a: http://localhost:3005
3. Haz clic en el botón del micrófono
4. Di algo
5. Haz clic de nuevo para detener
6. ¡Tu texto aparece!

**English:**
1. Open your browser
2. Go to: http://localhost:3005
3. Click the microphone button
4. Say something
5. Click again to stop
6. Your text appears!

#### B) Usar en Cualquier Aplicación / Use in Any Application (¡Lo Mejor! / The Best Part!):

**Español:**
1. Abre cualquier programa (Word, Excel, Notepad, etc.)
2. Haz clic donde quieres escribir
3. **Mantén presionado Alt+L** (ambas teclas juntas)
4. **Habla** mientras mantienes las teclas presionadas
5. **Suelta** cuando termines
6. ¡El texto aparece automáticamente!

**English:**
1. Open any program (Word, Excel, Notepad, etc.)
2. Click where you want to type
3. **Hold Alt+L** (both keys together)
4. **Speak** while holding the keys
5. **Release** when done
6. Text automatically appears!

---

## 🎤 Teclas de Atajo / Hotkeys

| Tecla / Key | Función / Function |
|-------------|-------------------|
| **Alt+L** | Modo normal (dicta exactamente lo que dices) / Normal mode (dictates exactly what you say) |
| **Alt+M** | Modo formato (crea listas, viñetas, estructura) / Format mode (creates lists, bullets, structure) |
| **Alt+T** | Activar/desactivar traducción (habla español, escribe inglés) / Toggle translation (speak Spanish, writes English) |

---

## 🌐 Modo Traducción / Translation Mode (Español → Inglés / Spanish → English)

**Español:**
1. Presiona **Alt+T** (verás una notificación)
2. Ahora cuando uses **Alt+L** o **Alt+M**:
   - Hablas en **español**
   - El sistema escribe en **inglés**
3. Presiona **Alt+T** de nuevo para desactivar

**English:**
1. Press **Alt+T** (you'll see a notification)
2. Now when you use **Alt+L** or **Alt+M**:
   - You speak in **Spanish**
   - The system writes in **English**
3. Press **Alt+T** again to turn off

---

## 📝 Comandos de Voz para Formato / Voice Commands for Formatting

**Español:** Cuando uses **Alt+M** (modo formato), puedes decir:

**English:** When using **Alt+M** (format mode), you can say:

- "nueva línea" / "new line" → Inserta un salto de línea / Insert line break
- "nuevo párrafo" / "new paragraph" → Inserta dos saltos de línea / Insert two line breaks
- "viñeta" / "bullet" / "punto" / "point" → Crea una lista con viñetas / Create bullet list
- "número" / "number" / "lista numerada" / "numbered list" → Crea una lista numerada / Create numbered list
- "sangría" / "indent" / "tab" → Agrega sangría / Add indentation
- "quitar sangría" / "outdent" / "back" → Quita la sangría / Remove indentation

---

## ❓ Resolución de Problemas / Troubleshooting

### Problema / Problem: "Bun no funciona en Windows" / "Bun doesn't work on Windows"

**Solución / Solution:** 

**Español:** Esto es común. Usa Node.js + npm en su lugar:
1. Instala Node.js de: https://nodejs.org/
2. Reemplaza comandos `bun` con `npm`:
   - `bun install` → `npm install`
   - `bun run dev:all` → `npm run dev:all`

**English:** This is common. Use Node.js + npm instead:
1. Install Node.js from: https://nodejs.org/
2. Replace `bun` commands with `npm`:
   - `bun install` → `npm install`
   - `bun run dev:all` → `npm run dev:all`

---

### Problema / Problem: "El micrófono no funciona" / "Microphone doesn't work"

**Solución / Solution:**

**Español:**
1. Ve a Configuración de Windows → Privacidad → Micrófono
2. Asegúrate de que "Permitir que las aplicaciones accedan al micrófono" está **Activado**
3. Reinicia el agente de Python

**English:**
1. Go to Windows Settings → Privacy → Microphone
2. Make sure "Allow apps to access your microphone" is **On**
3. Restart the Python agent

---

### Problema / Problem: "No aparece el texto" / "No text appears"

**Solución / Solution:**

**Español:**
1. Verifica que ambas ventanas de PowerShell estén abiertas (servidor web + agente)
2. Revisa que tu clave API de Groq esté correctamente configurada en `.env`
3. Asegúrate de tener conexión a internet (modo cloud requiere internet)

**English:**
1. Verify both PowerShell windows are open (web server + agent)
2. Check your Groq API key is correctly set in `.env`
3. Make sure you have internet connection (cloud mode requires internet)

---

### Problema / Problem: "Las teclas Alt+L no funcionan" / "Alt+L keys don't work"

**Solución / Solution:**

**Español:**
1. Cierra el agente de Python (Ctrl+C en la ventana)
2. Click derecho en PowerShell → "Ejecutar como administrador"
3. Navega a la carpeta y ejecuta el agente de nuevo

**English:**
1. Close the Python agent (Ctrl+C in the window)
2. Right-click PowerShell → "Run as administrator"
3. Navigate to folder and run agent again

---

### Problema / Problem: "Aparecen letras 'L' o 'M' repetidas" / "Repeated 'L' or 'M' letters appear"

**Solución / Solution:**

**Español:**
- Esto es normal en terminales PowerShell
- Usa LocalFlow en otras aplicaciones (Word, Excel, AutoCAD, etc.)

**English:**
- This is normal in PowerShell terminals
- Use LocalFlow in other apps (Word, Excel, AutoCAD, etc.)

---

### Problema / Problem: "npm install falla" / "npm install fails" o / or "Module not found"

**Solución / Solution:**

```powershell
# Limpiar caché de npm / Clear npm cache
npm cache clean --force

# Eliminar node_modules y reinstalar / Delete node_modules and reinstall
rmdir /s node_modules
npm install
```

---

## 💰 Costos del Modo Cloud / Cloud Mode Costs

**Español:**
- Groq ofrece un **nivel gratuito generoso**
- Si lo superas, cuesta aproximadamente **$0.001 por dictado**
- Uso típico: **$1-2/mes**
- **Alternativa:** Configurar modo local (gratis, pero configuración más compleja)

**English:**
- Groq offers a **generous free tier**
- If exceeded, costs approximately **$0.001 per dictation**
- Typical usage: **$1-2/month**
- **Alternative:** Configure local mode (free, but more complex setup)

---

## 🎓 Perfecto para Ingenieros Estructurales / Perfect for Structural Engineers

**Casos de uso / Use cases:**

**Español:**
- **Dictando cálculos:** "Viga de concreto reforzado con fc = 250 kilogramos por centímetro cuadrado"
- **Reportes técnicos:** Dicta tus observaciones de obra directamente
- **Notas de campo:** Convierte notas de voz en texto formateado
- **Traducción:** Habla español, obtén inglés para documentos técnicos internacionales
- **Listas de materiales:** Usa Alt+M para crear listas automáticamente

**English:**
- **Dictating calculations:** "Reinforced concrete beam with fc equals 250 kilograms per square centimeter"
- **Technical reports:** Dictate site observations directly
- **Field notes:** Convert voice notes to formatted text
- **Translation:** Speak Spanish, get English for international technical documents
- **Material lists:** Use Alt+M to create lists automatically

---

## ✅ Lista de Verificación / Checklist

**Antes de empezar / Before starting:**

- [ ] Node.js o Bun instalado / Node.js or Bun installed ✓
- [ ] Python instalado / Python installed ✓
- [ ] Dependencias instaladas / Dependencies installed (`npm install` o / or `bun install` + paquetes Python / Python packages) ✓
- [ ] Archivo `.env` configurado con clave API / `.env` file configured with API key ✓
- [ ] Servidor web funcionando / Web server running (puerto / port 3005) ✓
- [ ] Agente de Python funcionando / Python agent running ✓
- [ ] Probado con Alt+L en Word o similar / Tested with Alt+L in Word or similar ✓

---

## 📚 Recursos Adicionales / Additional Resources

**Español:**
- Documentación completa: `SETUP_GUIDE.md` y `CLAUDE.md` en la carpeta del proyecto
- Script de inicio automático: `.\scripts\start-all.ps1`
- Instalar comando CLI: `.\scripts\install-cli.ps1`

**English:**
- Full documentation: `SETUP_GUIDE.md` and `CLAUDE.md` in project folder
- Automated startup script: `.\scripts\start-all.ps1`
- Install CLI command: `.\scripts\install-cli.ps1`

---

**¡Listo! / You're all set!** 🎉

**Español:** Prueba primero en la interfaz web, luego usa Alt+L en tus programas favoritos.

**English:** Try it first in the web interface, then use Alt+L in your favorite programs.
