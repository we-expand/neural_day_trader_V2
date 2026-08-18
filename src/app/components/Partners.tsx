/**
 * Ponto de entrada da seção de Parceiros.
 *
 * A implementação real vive em `partners/PartnersIB.tsx` desde 2026-08-18,
 * quando a seção foi reconstruída. Este arquivo continua existindo só como
 * fachada porque `App.tsx` (e o `App_BACKUP_COMPLETE.tsx`) importam
 * `{ Partners }` daqui — trocar o caminho em todo lugar não traria nada.
 *
 * O que havia aqui antes: uma maquete completa com indicados fictícios,
 * comissão fabricada em dólar, gráfico de receita com valores fixos no código e
 * uma escada de níveis ("Officer 20%", "Commander 25%", "ganhe até 30%
 * recorrente") que não correspondia a nenhum modelo econômico. Substituída por
 * dado real + um modelo de comissionamento calibrado e travado por asserção —
 * ver `SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md`.
 */
export { PartnersIB as Partners } from './partners/PartnersIB';
