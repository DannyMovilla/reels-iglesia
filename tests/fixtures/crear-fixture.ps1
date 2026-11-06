# Genera un video de prueba (~20 s) con voz en español.
# El nombre lleva espacio, paréntesis y ñ a propósito (rutas difíciles).
# Uso: powershell -ExecutionPolicy Bypass -File tests\fixtures\crear-fixture.ps1
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$salida = Join-Path $PSScriptRoot "salida"
New-Item -ItemType Directory -Force $salida | Out-Null
$wav = Join-Path $salida "voz.wav"
# La enie se arma con su codigo Unicode: PowerShell 5 lee este archivo como ANSI.
$enie = [string][char]0x00F1
$mp4 = Join-Path $salida ("culto (prueba) " + $enie + ".mp4")
if (Test-Path $mp4) { Write-Output $mp4; exit 0 }

Add-Type -AssemblyName System.Speech
$voz = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voz.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "es-*" } | Select-Object -First 1 | ForEach-Object { $voz.SelectVoice($_.VoiceInfo.Name) }
$voz.SetOutputToWaveFile($wav)
$voz.Speak("Hermanos, hoy quiero hablarles de la fidelidad de Dios. La fidelidad de Dios no depende de nuestras circunstancias. Romanos ocho veintiocho dice que todas las cosas ayudan a bien a los que aman a Dios. Tu prueba no es el final de tu historia. Amén.")
$voz.Dispose()

& ffmpeg -v error -y -f lavfi -i "testsrc2=size=1280x720:rate=30" -i $wav -map 0:v -map 1:a -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -shortest $mp4
Remove-Item $wav
Write-Output $mp4
