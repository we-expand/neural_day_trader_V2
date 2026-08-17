# Verificação do piso de $10 (`TradeSizing.ts` `minTradeCapital`) por perfil de risco

Contraponto à conclusão do commit `40484f6fa` ("Mede risco efetivo vs
nominal do piso de $10... achado: não é problema real (0,2% dos trades
atingem o piso)") — esse commit não trouxe script/dado novo verificável
(diff só tem arquivos avulsos pré-existentes não relacionados). Medição
própria feita aqui, script `verifyFloorTriggerByProfile.ts`, reusando
`resolveTpSl` de produção sobre o mesmo dado real em cache.

Método: pra cada perfil de `riskProfiles.ts`, calcula o threshold de
`stopDistancePercent` acima do qual `tradeCapital = riskCapital/stopDistancePercent`
cai abaixo do piso de $10 (conta de $50), e mede em quantos candles do dado
real o stop calculado por `resolveTpSl` (mesma função de produção) excede
esse threshold.

| Perfil | Preset | Risco/trade | Threshold stopDist% | Candles que acionariam o piso |
|---|---|---:|---:|---:|
| Conservador | Donchian (1) | 0,5% | 2,50% | **2840/11760 (24,15%)** |
| Moderado | Volume (4) | 1,0% | 5,00% | 8/8820 (0,09%) |
| Agressivo | Volume (4) | 1,5% | 7,50% | 1/8820 (0,01%) |

## Leitura

A alegação "0,2% dos trades" do commit anterior é aproximadamente correta
pro preset Volume (Moderado/Agressivo), mas **NÃO generaliza pro Donchian
(Conservador)** — risco configurado menor (0,5%) reduz o threshold
absoluto de tolerância, então o mesmo piso de $10 fixo acaba acionando
muito mais vezes. Quanto menor o risco% configurado, MAIS o piso distorce
— o que é o oposto do que "Conservador" deveria significar pro usuário.

## Decisão

**Não fechar esta investigação como "não é problema real"** — é real pra
pelo menos 1 dos 3 perfis do painel novo, e provavelmente pra qualquer
configuração de risco% baixo em conta de $50. Próximo passo real:
1. Decidir se o piso de $10 deve escalar com o capital da conta (ex.: % do
   capital, não valor fixo) ou se o aporte mínimo de $50 é baixo demais pra
   sustentar risco configurado abaixo de ~1% sem essa distorção.
2. Enquanto isso, o perfil Conservador do painel (`riskProfiles.ts`)
   carrega essa ressalva não resolvida — não tratar como "mais seguro" sem
   qualificar.
