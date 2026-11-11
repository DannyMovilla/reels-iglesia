# Prueba del instalador en una PC limpia

Versión: **0.2.0** · Instalador: `dist/Reels Iglesia Setup 0.2.0.exe`

El objetivo es instalar y usar Reels Iglesia en una computadora que **nunca tuvo** las herramientas de
desarrollo. Así se ven los problemas que en la PC de desarrollo no aparecen porque ya está todo instalado.

## Antes de empezar

- Una PC con **Windows 10 u 11** que no tenga Python, FFmpeg, Node ni Claude Code (otra PC, o la de alguien de
  la iglesia). Windows 11 Home no trae Windows Sandbox, así que no sirve una "PC dentro de la PC".
- Internet (el primer uso descarga unos 3 GB).
- Una cuenta de Claude con suscripción (Pro o Max) para iniciar sesión.
- Un video corto de un culto (5 a 10 minutos alcanza) en una carpeta con espacios en el nombre, por ejemplo
  `Documentos\Cultos de prueba\culto (1).mp4`.

Para cada paso, marca **OK** o anota **qué pasó** (y una foto de la pantalla si se puede).

## Pasos

| # | Qué hacer | Qué deberías ver | Resultado |
|---|---|---|---|
| 1 | Copiar el instalador a la PC y abrirlo con doble clic. | Windows muestra «Windows protegió su PC» (la app todavía no tiene firma). | |
| 2 | Tocar **Más información** → **Ejecutar de todas formas**. | Se abre el instalador de Reels Iglesia. | |
| 3 | Instalar con las opciones de siempre. | Termina sin errores y queda el acceso directo en el escritorio. | |
| 4 | Abrir Reels Iglesia. | Se abre el asistente de primer uso con lo que falta marcado. | |
| 5 | **Instalar FFmpeg** desde el asistente. | Puede pedir permiso de Windows. Al terminar, FFmpeg queda en verde (si no, cerrar y abrir la app). | |
| 6 | **Instalar Python** desde el asistente. | Igual que FFmpeg. | |
| 7 | **Preparar el entorno** (unos 3 GB). | Una barra de progreso con lo que instala; al final, «Python y modelos listos». Anotar cuánto tardó. | |
| 8 | **Iniciar sesión en Claude**. | Se abre la ventana de Claude; después de iniciar sesión, Claude queda en verde. | |
| 9 | **Nueva prédica** con el video corto; marcar inicio y fin; **Procesar prédica**. | Los 4 pasos terminan en verde. Anotar cuánto tardó cada uno. | |
| 10 | Abrir un clip, confirmar el versículo si lo hay, **Exportar este clip**. | «1 reel listo» y el MP4 en Exportados. Abrirlo y mirarlo entero. | |
| 11 | **Entregas → Crear SRT**. | «Listo: …srt». | |
| 12 | **Ajustes**: mirar Versión, Espacio y Diagnóstico. | «Reels Iglesia 0.2.0», cuánto ocupa la app, y los botones de diagnóstico. | |
| 13 | **Ajustes → Copiar diagnóstico** y pegarlo al final de esta nota. | Un texto con la versión, el sistema, los chequeos y el registro. | |
| 14 | **Prédicas → Más opciones → Borrar prédica** → Borrar. | La prédica desaparece y está en la Papelera de Windows. El video del culto sigue en su carpeta. | |

## Si algo falla

1. No cierres la app: anota el mensaje tal como aparece.
2. **Ajustes → Copiar diagnóstico** y pégalo en un mensaje.
3. **Ajustes → Abrir carpeta de registros** y adjunta el archivo `reels-<fecha>.log` de hoy.

## Diagnóstico de esta PC

(pegar aquí)
