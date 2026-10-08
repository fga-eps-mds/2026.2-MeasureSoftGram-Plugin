# Secrets que o CI precisa

Os workflows em `.github/workflows/` dependem dos secrets abaixo. Eles ficam em
**Settings → Secrets and variables → Actions** do repositório (ou da organização
`fga-eps-mds`). Só quem tem papel de **admin** consegue criar ou trocar.

| Secret | Usado por | Para quê | Quem cria | Como validar |
|---|---|---|---|---|
| `GITHUB_TOKEN` | `msgram.yml`, `metrics.yml`, `package.yml` | token automático do próprio workflow | ninguém (o GitHub fornece) | nada a fazer |
| `SONAR_TOKEN` | `test.yml` | enviar análise ao SonarCloud (`fga-eps-mds-1`) | admin do SonarCloud | o passo "Scanner do SonarCloud" termina verde |
| `MSGRAMPLUGINTOKEN` | `msgram.yml` | token de API do MeasureSoftGram para publicar métricas deste repo | quem tem conta no produto "Measure" em `msgram.lappis.rocks` | o job `msg` termina verde e o produto recebe uma coleta nova |
| `METRICAS_PLUGIN` | `metrics.yml` | token com **permissão de escrita** no repositório `fga-eps-mds/2026.2-MeasureSoftGram-DOC` | admin da org; token clássico com escopo `repo` ou fine-grained com *Contents: write* no repo DOC | o passo "Envia métricas para repo de Doc" faz `git push` sem `Invalid username or token` |
| `USER_EMAIL`, `USER_NAME` | `metrics.yml` | autor dos commits no repo DOC | admin da org | o commit no repo DOC aparece com esse autor |
| `VSCE_PAT` | `package.yml` | publicar o `.vsix` no VS Code Marketplace como `MeasureSoftGram` | quem administra o publisher no [Marketplace](https://marketplace.visualstudio.com/manage) (Azure DevOps PAT com escopo *Marketplace: Manage*) | `workflow_dispatch` com `dry_run=false` em uma tag `vX.Y.Z` publica a versão |

## Estado em 07/10/2026 (diagnóstico)

- `METRICAS_PLUGIN`: **inválido ou expirado**. O workflow "Export de métricas" falha em todo push desde 14/09 com `remote: Invalid username or token`. Precisa ser recriado.
- `GITHUBTOKEN` (sem underscore): **não existia**. O workflow `msg` passou a usar `GITHUB_TOKEN`, então esse secret não é mais necessário.
- `VSCE_PAT`: **não existe**. Sem ele o `package.yml` gera e anexa o `.vsix` à release, mas pula a publicação com um aviso.

## Rotação

Tokens pessoais expiram. Ao renovar, troque o valor do secret e dispare o workflow
correspondente manualmente (`workflow_dispatch`) para confirmar.
