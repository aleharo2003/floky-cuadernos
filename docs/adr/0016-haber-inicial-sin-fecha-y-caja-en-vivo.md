# ADR-0016. El haber inicial es un solo monto, sin fecha ni turno, y la caja se refresca sola

- **Estado:** aceptada, 09/11/2026. Cambia el punto de partida de [ADR-0008](0008-haber-calculado-sin-espejo.md); la cuenta del haber por turno sigue igual.

## Contexto

El 09/11/2026 Emanuel cargó el haber inicial y después su día, y la caja no se movía: "nunca resta nada".

El haber inicial se guardaba como "el efectivo al cierre de tal día y turno", y solo contaba lo posterior. La pantalla pedía fecha y turno, con Noche marcado de entrada. Emanuel puso el día de hoy, y todo lo que cargó ese día quedó antes del punto de partida.

Para él el haber inicial es un número, no un momento: "es un haber inicial y luego se va actualizando con cada movimiento, no es necesario preguntar".

Además, la caja solo se actualizaba al guardar en el mismo dispositivo. Si cargaba otra persona, había que recargar la página.

## Decisión

- **El haber inicial es solo un monto.** Cada movimiento en efectivo que se carga, de la fecha que sea, lo suma o lo resta. La pantalla pide solo el monto, y el motivo si se cambia.
- **Refresco cada 15 segundos** de la burbuja de la caja, la caja del turno en Cargar y la lista del día, como estaba previsto en las notas del proyecto ("polling cada 10 a 15 s al principio"). Se frena con la pestaña en segundo plano y pide al volver. Mientras llega lo nuevo se sigue viendo lo anterior.

## Opciones que no se tomaron

- **Preguntar el arranque como "empiezo el lunes a la mañana"** y guardarlo como el cierre del turno anterior. Arreglaba la confusión, pero seguía preguntando algo que el cliente no necesita.
- **Fecha opcional**, por si un día se carga historial viejo. Se descartó por simple: hoy no hay historial para cargar.
- **WebSockets** (Django Channels). Más infraestructura para ganar unos segundos.

## Consecuencias

- Si algún día se carga historial viejo, también mueve la caja de hoy. Habría que restar ese efecto en el haber inicial, o volver a pensar esta decisión.
- La caja de un período anterior a todo lo cargado muestra el haber inicial.
- **Expandir y contraer:** la migración 0008 solo vuelve opcionales las columnas `date` y `shift`, sin tocar los datos. Si hubiera que volver a la versión anterior, sigue andando con el haber inicial que ya está cargado. En una versión próxima, una migración las borra.
- Con una pestaña abierta, el servidor recibe tres pedidos chicos cada 15 segundos por persona. Al volumen de estos locales no cambia el costo.
