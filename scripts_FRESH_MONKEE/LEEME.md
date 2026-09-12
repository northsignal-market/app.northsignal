# Retirado el 12/9/2026

Fresh Monkee quedó vinculada al MCC 641-902-5021 ese día, y el script semanal del
MCC ([scripts_MCC/northsignal_semanal_v11.js](../scripts_MCC/northsignal_semanal_v11.js))
pasó a procesarla junto con las otras tres cuentas.

La copia que vivía acá (`FM_1_semanal.js`) se retiró del repo — su historia completa
está en git — y **su programación en Google Ads debe quedar desactivada**: dos copias
corriendo a la misma hora se pisan los delete+insert por semana y duplican filas.

Si alguna vez FM se desvincula del MCC, la copia se reconstruye desde git y se
restaura el flag `soloCuentaUnica: true` en la config del script del MCC.
