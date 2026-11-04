@echo off
title Billing Entry
cd /d "%~dp0backend\target"
start "" /min powershell -NoProfile -Command "$i=0; do { Start-Sleep 1; $i++; try { $c=(Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/customers -TimeoutSec 2).StatusCode } catch { $c=0 } } while ($c -ne 200 -and $i -lt 90); Start-Process chrome 'http://localhost:8080'"
java -jar billing-entry-1.0.0.jar