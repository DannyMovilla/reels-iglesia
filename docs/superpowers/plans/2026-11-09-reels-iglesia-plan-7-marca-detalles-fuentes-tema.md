# Reels Iglesia — Plan 7: marca en el reel, detalles, fuentes y tema claro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Que la marca durante el reel pueda ser logo, texto o los dos; cerrar los detalles del plan 6; incluir las fuentes en la app y ofrecer un tema claro.

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md` (sección 18).

## Global Constraints
- Español sencillo; marcas y clips viejos se ven igual (marca durante el reel = texto, tema oscuro).
- Descargas: solo los paquetes @fontsource de Geist, Geist Mono y Fraunces (permiso dado). OFL, acreditados en NOTICE.
- No reconstruir `out/` con la app abierta.

## Review Focus
1. Marca vieja (sin el campo nuevo) → la marca durante el reel sigue siendo el texto. Prueba en Task 1.
2. «Logo» sin logo cargado o con logo SVG/PNG transparente → se ve bien o cae en texto. Prueba en Task 1.
3. Tema claro: textos y bordes con contraste suficiente en todas las pantallas (capturas). Task 4.
4. Cancelar una traducción a mitad → no queda un .srt a medias. Prueba en Task 2.

### Task 1: Marca durante el reel (texto, logo o los dos)
- `Marca.marcaReel?: { modo: "texto" | "logo" | "ambos"; tamano: number }` (sin el campo: texto, 1).
- Composición de prédica y de versículo: `#marca` con texto, imagen o ambos; vista previa y exportación (el logo ya se copia).
- Marca: grupo «Marca durante el reel» con Texto / Logo / Logo y texto y tamaño; la muestra de la marca la enseña.
- Pruebas: composición (3 modos, sin logo → texto, marca vieja), Marca (UI guarda), integración: render con logo visible.

### Task 2: Detalles del plan 6
Una prueba en rojo por detalle (sección 18, punto 2) y su arreglo.

### Task 3: Fuentes incluidas
- `npm i @fontsource/geist-sans @fontsource/geist-mono @fontsource/fraunces`; importar los pesos usados en `main.tsx`; quitar el `@import` de Google Fonts y su CSP; NOTICE.
- Prueba: el CSS de la app no pide nada de internet.

### Task 4: Tema claro
- Tokens del tema claro en `:root[data-tema="claro"]`; colores fijos del CSS pasados a tokens; «Como Windows» con `prefers-color-scheme`.
- Ajustes → Apariencia; se guarda en `localStorage` y se aplica antes de pintar (`index.html`).
- Pruebas: Ajustes cambia y guarda; capturas en claro de todas las pantallas.

### Task 5: Prueba completa
Suite + E2E + capturas antes/después en oscuro y claro; revisión final; subir solo con permiso.
