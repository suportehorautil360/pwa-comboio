# Comboio: tanque do caminhão (abastecer o próprio caminhão)

**Data:** 2026-06-20
**Repos afetados:** `back` (NestJS), `360-repository` (admin), `pwa-comboio` (PWA do comboista)
**Branch:** `feat/comboio-tanque-caminhao` (nos 3 repos) → PRs para `homolog`

## Problema / objetivo

Um comboio (caminhão de combustível) tem, na prática, **dois tanques**:

1. **Reservatório** — o tanque grande que carrega combustível para distribuir aos
   equipamentos (e ao próprio caminhão). É o que o sistema modela hoje.
2. **Tanque do caminhão** — o tanque de diesel que move o próprio caminhão do
   comboio. Hoje não existe no sistema.

Queremos:

- No **admin (360)**, ao criar/editar um equipamento `tipo: Comboio`, informar a
  **capacidade do tanque do caminhão** (além da capacidade do reservatório, que já
  existe).
- No **PWA (comboista)**, na tela **Abastecer**, poder abastecer esse **tanque do
  caminhão** do comboio.
- **Reabastecer comboio** continua igual: credita só o **reservatório** (que serve
  para abastecer o tanque do caminhão e os demais equipamentos).

## Estado atual (resumo do código)

- Comboio = `equipamento` com `tipo === "Comboio"` (match case-insensitive,
  `ehComboio()` em `back/.../equipamentos.service.ts`).
- `equipamentos.capacidadeTanque` (número): para equipamento comum é a capacidade
  do próprio tanque; para comboio é o **reservatório**, sincronizado para
  `tanks.capacity` por `ensureTankForComboio()` (`tank-saldo.helper.ts`).
- `tanks` (1 doc por comboio): `capacity` + `currentVolume` = reservatório.
- **Abastecimento** (`POST /abastecimentos`): resolve o equipamento alvo por
  `plateOrChassis`; valida `liters ≤ equipamento.capacidadeTanque`; se origem é um
  comboio (sem `postoId`), debita o reservatório (`debitarTanqueTx`); com `postoId`
  não toca o reservatório.
- **Reabastecimento** (`POST /reabastecimentos`): credita o reservatório
  (`creditarTanqueTx`), valida contra `tanks.capacity`.
- PWA `FuelFormScreen`: teto otimista `capEquip = equipSel?.capacidadeTanque`;
  origem (comboio/posto), saldo otimista, leitura monotônica, foto, GPS. Payload
  `submit("abastecimento", { plateOrChassis, comboioId, liters, measurementType,
  currentReading, meterPhoto, postoId, ... })`.

## Decisões (acordadas)

1. **Tanque do caminhão = só capacidade (limite).** Não rastreia saldo
   (`currentVolume`) — o tanque é consumido dirigindo, sem transações. O novo campo
   é apenas o teto de litros ao abastecer. O inventário controlado segue sendo o
   reservatório.
2. **Seleção implícita no PWA.** O comboista digita a placa/chassi do próprio
   comboio no campo de equipamento; o sistema detecta `tipo: Comboio` e valida pela
   capacidade do tanque do caminhão. **Sem nova UI de seleção / sem toggle.**
3. **Origem flexível (como hoje).** Abastecer o tanque do caminhão usa a mesma
   lógica de origem: reservatório de um comboio (o mesmo ou outro → debita) ou posto
   (não debita reservatório).
4. **Detecção pelo tipo do alvo, sem mudar o payload.** O `submit("abastecimento")`
   **não muda**. Backend e app apenas escolhem qual capacidade validar conforme o
   `tipo` do equipamento alvo.
5. Único dado novo no sistema: `capacidadeTanqueCaminhao` no doc do equipamento.

## Modelo de dados

- `equipamentos.capacidadeTanque`: **inalterado**. Para comboio continua sendo o
  **reservatório** (sincroniza com `tanks.capacity`). Sem migração.
- `equipamentos.capacidadeTanqueCaminhao` (number, opcional): **novo**. Só relevante
  para `tipo: Comboio`. Não vira saldo, não sincroniza tank — é só um teto.
- Comboio legado sem o campo → `0` = sem limite (igual ao comportamento atual de
  `capacidadeTanque = 0`).

## Regra de capacidade (o coração da feature)

Ao abastecer um equipamento alvo:

| Alvo | Capacidade (teto de litros) |
|------|------------------------------|
| Equipamento comum | `capacidadeTanque` (próprio tanque) — **inalterado** |
| Comboio (`tipo: Comboio`) | `capacidadeTanqueCaminhao` (tanque do caminhão) — **novo** |

Origem (débito) é **independente** do alvo e segue como hoje:
- Origem = reservatório de comboio (sem `postoId`) → debita o reservatório do
  `comboioId` selecionado (mesmo do alvo ou outro).
- Origem = posto (`postoId`) → não debita reservatório.

`0`/ausente = sem limite (não bloqueia no front; o back é o gate final).

## Mudanças por repo

### back (NestJS)

- `modules/equipamentos/dto/create-equipamento.dto.ts` e `update-equipamento.dto.ts`:
  adicionar `capacidadeTanqueCaminhao?: number` (validado, ≥ 0). Persiste no doc do
  equipamento. **Não** sincroniza tank.
- `modules/movimentacoes/shared/equipment.helper.ts`
  (`resolveEquipmentByPlateOrChassis`): expor `tipo` e `capacidadeTanqueCaminhao`
  (já retorna `raw`; é leve).
- Abastecimento (`abastecimentos.service.ts` / `abastecimentos-create.helper.ts`):
  na validação de capacidade do alvo, se `ehComboio(raw.tipo)` usar
  `capacidadeTanqueCaminhao`; senão `capacidadeTanque`. Débito da origem
  **inalterado**.
- `ehComboio` já existe em `equipamentos.service.ts`; extrair p/ helper compartilhado
  (ou duplicar a checagem simples) para uso no fluxo de abastecimento.

### 360-repository (admin) — `EquipamentoFormPage`

- `pages/prefeitura/sections/EquipamentoFormPage.tsx`:
  - Campo novo **"Capacidade do tanque do caminhão (L)"**, exibido só quando
    `ehComboio` (mesmo padrão condicional do `condutoresResponsaveis`).
  - Quando comboio, **renomear** o campo existente para
    **"Capacidade do reservatório (L)"**. Fora de comboio, segue
    "Capacidade do tanque (L)".
  - Carregar o valor na edição.
- `pages/prefeitura/sections/equipamentos/equipamentos-api.ts`:
  - `NovoEquip`: adicionar `capacidadeTanqueCaminhao: number`.
  - `montarPayload`: incluir `capacidadeTanqueCaminhao`.
  - Mapear o campo ao carregar para edição.

### pwa-comboio — `FuelFormScreen`

- `lib/api/abastecimento.ts` (`EquipamentoApi`): adicionar
  `capacidadeTanqueCaminhao?: number` (já há `tipo?`).
- `components/mobile/fuel-form-screen.tsx`:
  - Teto otimista: alvo comboio (`tipo?.trim().toLowerCase() === "comboio"`,
    case-insensitive como no back/360) → `capacidadeTanqueCaminhao`; senão →
    `capacidadeTanque`. Resto idêntico (origem, saldo, leitura, foto, GPS, payload).
  - Aviso quando o alvo é um comboio: *"Abastecendo o tanque do caminhão do
    comboio"*.
  - Conferir que comboios aparecem no autocomplete de equipamento (devem, pois
    `useEquipamentos` traz todos os equipamentos).

### Reabastecer comboio

**Sem alteração** — continua creditando só o reservatório.

## Casos de borda

- Comboio sem `capacidadeTanqueCaminhao` (legado) → teto 0 = sem limite até ser
  editado no admin.
- Abastecer o caminhão de um comboio A com origem no reservatório do próprio A
  (auto-fuel) ou de outro comboio B — ambos válidos; débito no reservatório da
  origem.
- Abastecer o caminhão do comboio em posto (`postoId`) — válido, não debita
  reservatório.
- Leitura monotônica (horímetro/km) do comboio continua valendo (o caminhão tem
  leitura como qualquer veículo).

## Testes

- **back:** caso de unidade garantindo que alvo `tipo: Comboio` usa
  `capacidadeTanqueCaminhao` e alvo comum usa `capacidadeTanque` (estende
  `equipment.helper.spec`/`abastecimentos-create.helper.spec`).
- **360:** lint + build do form (campo condicional + payload).
- **pwa:** teste do teto por tipo (comboio vs comum) + lint/build/unit.

## Entrega / rollout

- Branch `feat/comboio-tanque-caminhao` nos 3 repos → 3 PRs para `homolog`.
- Ordem de merge: **back → 360 → pwa** (o campo precisa existir/persistir antes dos
  consumidores). O app degrada com segurança se o campo ainda não existir (teto 0 =
  sem limite).

## Fora de escopo (YAGNI)

- Saldo/nível do tanque do caminhão.
- Novo campo no payload de abastecimento (`targetTank`).
- Qualquer mudança no fluxo de reabastecimento.
