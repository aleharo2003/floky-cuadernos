# ADR-0005. Análisis estático de seguridad (SAST) en CI

- **Estado:** aceptada el 29/10/2026 (PR #1). Viene de ADR-0009 de floky, sin cambios de fondo.

## Contexto

El repositorio arranca público ([ADR-0004](0004-entornos-hosting-ci-cd.md)) y la idea es pasarlo a privado más adelante. CI ya va a revisar dependencias vulnerables (pip-audit, npm audit, Dependabot) y secretos (gitleaks, push protection). Falta revisar el código propio en busca de patrones inseguros: inyección SQL, `eval`, `subprocess` con shell, secretos escritos en el código, XSS en React.

Opciones gratuitas (verificado el 20/10/2026):

| Herramienta | Qué hace bien | Límite |
|---|---|---|
| Semgrep Community Edition | Open source, gratis para uso comercial, reglas para Django, Python, TypeScript y React. Funciona igual en repo público o privado | Analiza un archivo o una función por vez, sin seguir los datos entre archivos. Sus reglas se pueden usar sobre el código propio, no dentro de un producto o servicio que compita con Semgrep |
| CodeQL (code scanning de GitHub) | Sigue el flujo de datos entre archivos. Se activa sin escribir nada | Gratis solo en repos públicos. En privado pide GitHub Team más Code Security, que es pago |
| Ruff con el grupo `S` | Las mismas reglas que Bandit, dentro del linter que ya usamos | Solo Python, reglas simples |

## Decisión

1. **Semgrep CE es la herramienta base.** Corre en cada PR con las reglas de Python, Django, TypeScript y React.
2. **CodeQL con la configuración por defecto mientras el repo sea público.** Es un extra que se pierde al pasar a privado; nada depende de él.
3. **Ruff con el grupo `S` activado** en el backend.
4. **Bloquea el merge solo con hallazgos nuevos de severidad alta o crítica.** El resto aparece como aviso en el PR. Un falso positivo se marca con un comentario de supresión que explique por qué, y lo aprueba quien revisa el PR.
5. Se agrega **en el mismo PR que arma CI**, no antes: sin código no hay nada que escanear, y CodeQL falla si no encuentra lenguajes.

## Consecuencias

- Costo cero, con el repo público o privado.
- Al pasar a privado se apaga CodeQL y se pierde el análisis entre archivos. Ese día se decide si vale pagar Code Security o si alcanza con Semgrep CE.
- Los avisos de severidad media o baja no bloquean, pero se miran en la revisión del PR.

> Tip: una herramienta que bloquea todo termina desactivada a la segunda semana. Empezar exigente solo con lo grave y lo nuevo hace que el equipo la respete. Si en un mes no hay ruido, se sube la exigencia.

## Fuentes

- [GitHub Docs, CodeQL en repos privados](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/private-repository-enablement)
- [Semgrep, cambios en Semgrep OSS y licencia de reglas](https://semgrep.dev/blog/2024/important-updates-to-semgrep-oss)
- [¿Semgrep es gratis para uso comercial?](https://aicodereview.cc/blog/semgrep-free-commercial-use)
