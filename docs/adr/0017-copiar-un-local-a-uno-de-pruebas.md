# ADR-0017. Copiar los cuadernos de un local a un local de pruebas

- **Estado:** aceptada, 09/11/2026.

## Contexto

Cuando Emanuel (o su hermano en El Criollo) dice "esto no me da", el equipo necesita ver lo mismo que ve él para entender qué pasa. Hoy la única forma es entrar a su local, y ahí cualquier prueba (cargar, corregir, anular) toca sus números de verdad.

El equipo ya tiene un local propio para probar, AB-Sistemas. Falta poder dejarlo igual al local del cliente cuando hace falta: categorías, caja, ingresos, gastos y ajustes. Las personas no: nadie del cliente tiene que ganar acceso al local de pruebas.

## Opciones

1. **Bajar el Excel del cliente y cargarlo a mano en el local de pruebas.** Lento, y se pierde información: quién cargó cada movimiento, cuándo, los anulados con su motivo, qué venta sale de qué gasto.
2. **Copiar en la base con SQL a mano.** Es justo lo que no se hace en producción (ADR-0015).
3. **Una acción en el admin, como la de vaciar.** Con confirmación, motivo y auditoría, y solo hacia locales marcados como de pruebas.

## Decisión

Opción 3.

- El local tiene una casilla nueva, **"Local de pruebas"** (en el admin, **Locales**). Solo se puede copiar **hacia** un local marcado. El servicio lo vuelve a revisar aunque la pantalla ya lo filtre: si alguien prueba con un local real, no copia nada.
- En **Cuadernos → Cuadernos por local**, la acción **"Copiar a un local de pruebas"** toma **un** local (el del cliente), pide elegir el local de pruebas y un **motivo**, y muestra antes qué se copia y qué se borra.
- El local de pruebas queda **igual** al del cliente: primero se borra todo lo que tenía (movimientos, haber inicial, categorías y ajustes) y después se copia:
  - los movimientos, también los anulados con su motivo, y cada venta apuntando a la copia de su gasto;
  - quién cargó cada movimiento y cuándo, para que la lista y los reportes se vean igual;
  - las categorías, también las desactivadas;
  - el haber inicial y los ajustes del local, con quién los cargó y cuándo.
- **No se copian las personas ni sus permisos.** Los movimientos muestran el nombre de quien los cargó, pero esa persona no entra al local de pruebas.
- El local del cliente **solo se lee**.
- Todo en una transacción, con el local de pruebas bloqueado para que dos copias a la vez no se mezclen.
- Auditoría en los dos locales: en el de pruebas, `notebooks.clone` con qué tenía antes y de dónde viene la copia; en el del cliente, `notebooks.copied` con quién lo copió, cuándo, a dónde y por qué. Ninguna de las dos aparece en "Cambios recientes", y en el local de pruebas esa lista arranca de cero después de la copia, como después de vaciar.
- Solo superusuarios, como vaciar.

## Consecuencias

- **Los datos del cliente quedan en otro local, dentro de la misma base de producción.** Siguen igual de protegidos (backups, accesos), pero cualquiera con acceso a AB-Sistemas los ve. Por eso al local de pruebas solo entra el equipo de desarrollo, nunca alguien del cliente ni de afuera.
- Copiar de nuevo reemplaza la copia anterior. Lo que el equipo haya cargado en el local de pruebas se pierde.
- No se copia la auditoría del cliente: en el local de pruebas no está el historial de cambios de cada movimiento, solo cómo quedó.
- Tiempo medido: 65.700 movimientos (tres años de 60 por día) en unos 13 segundos en una compu de desarrollo. Un local real va a tener bastante menos por un buen tiempo. Si algún día pasa del minuto, hay que moverlo a un job aparte.
- Migración `core/0004`: una columna booleana con valor por defecto. En PostgreSQL es inmediata y no bloquea la tabla.
- Cuando exista el ambiente de pruebas separado (staging), conviene copiar allá y no a un local dentro de producción. Esta acción sigue sirviendo mientras tanto.
