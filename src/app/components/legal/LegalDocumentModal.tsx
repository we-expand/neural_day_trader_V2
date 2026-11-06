import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, AlertTriangle } from 'lucide-react';

// 🚨 Criado 2026-09-09: não existia NENHUM documento real de Termos de Uso
// ou Política de Privacidade no projeto até agora -- o checkbox de aceite no
// onboarding (ExpandedOnboarding.tsx) linkava pra "#", vazio. Este texto foi
// escrito para cobrir de forma honesta o que a plataforma coleta de fato
// (dado de cadastro + telemetria de IP/geolocalização/dispositivo/presença,
// ver UserTracker.tsx e /telemetry/* em supabase/functions/server/index.ts)
// -- é um RASCUNHO funcional, não um documento revisado por advogado. Antes
// de tratar como juridicamente definitivo, recomenda-se revisão jurídica.
type LegalDocKind = 'terms' | 'privacy';

interface LegalDocumentModalProps {
  kind: LegalDocKind;
  onClose: () => void;
}

export function LegalDocumentModal({ kind, onClose }: LegalDocumentModalProps) {
  const title = kind === 'terms' ? 'Termos de Uso' : 'Política de Privacidade';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-neutral-950 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        >
          <div className="sticky top-0 bg-neutral-950 border-b border-white/10 p-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-6 space-y-5 text-sm text-slate-300 leading-relaxed">
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Rascunho funcional gerado para uso interno — cobre o essencial do que a
                plataforma coleta e faz, mas ainda não passou por revisão jurídica.
                Recomenda-se validação por um advogado antes de tratar como documento
                final.
              </span>
            </div>

            {kind === 'terms' ? (
              <>
                <Section title="1. Aceite">
                  Ao criar uma conta na Neural Day Trader, você concorda com estes
                  Termos de Uso e com a Política de Privacidade. Se não concordar,
                  não utilize a plataforma.
                </Section>
                <Section title="2. Natureza do serviço">
                  A plataforma oferece ferramentas de análise e execução de operações
                  financeiras (modo demonstração e, quando habilitado, execução real
                  via corretora conectada pelo usuário). Trading envolve risco real de
                  perda de capital — nenhum resultado passado garante resultado futuro.
                </Section>
                <Section title="3. Coleta de dados de sessão (IP, localização, dispositivo)">
                  Ao usar a plataforma autenticado, coletamos automaticamente: endereço
                  IP, localização geográfica aproximada (cidade/região/país, derivada do
                  IP), informações do dispositivo e navegador (sistema operacional,
                  resolução de tela, idioma, tipo de conexão) e registros de atividade
                  de sessão (incluindo quando sua conta esteve ativa). Essa coleta serve
                  para segurança da conta, prevenção de fraude e suporte técnico. Você
                  concorda com essa coleta ao aceitar estes Termos de Uso no cadastro.
                </Section>
                <Section title="4. Responsabilidade sobre execução real">
                  Ao conectar uma corretora própria e habilitar execução real, você é o
                  único responsável pelas ordens enviadas e pelo capital operado.
                </Section>
                <Section title="5. Alterações">
                  Podemos atualizar estes Termos periodicamente. Mudanças relevantes
                  serão comunicadas dentro da plataforma.
                </Section>
              </>
            ) : (
              <>
                <Section title="1. Dados que coletamos">
                  <strong className="text-white">Dados de cadastro:</strong> nome,
                  email, telefone, documento, endereço, dados profissionais e de perfil
                  de investidor, fornecidos por você no onboarding.
                  <br /><br />
                  <strong className="text-white">Dados de sessão (telemetria):</strong> endereço
                  IP, localização aproximada derivada do IP, informações de dispositivo
                  e navegador, e registros de quando sua conta esteve ativa. Essa coleta
                  é feita automaticamente enquanto você usa a plataforma autenticado,
                  amparada no aceite destes Termos — não exibimos um banner de
                  consentimento separado para ela.
                </Section>
                <Section title="2. Terceiros envolvidos na coleta">
                  Para resolver a localização aproximada a partir do seu IP, nosso
                  servidor consulta um serviço externo de geolocalização (ipapi.co).
                  Essa consulta acontece servidor-a-servidor — seu navegador nunca envia
                  seu IP diretamente a esse terceiro.
                </Section>
                <Section title="3. Como usamos os dados">
                  Segurança da conta, prevenção de fraude, suporte técnico e, quando
                  aplicável, cumprimento de obrigações legais/regulatórias do setor
                  financeiro.
                </Section>
                <Section title="4. Seus direitos (LGPD)">
                  Você pode solicitar acesso, correção ou exclusão dos seus dados
                  pessoais e de telemetria a qualquer momento, entrando em contato com o
                  suporte.
                </Section>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-white font-bold mb-1">{title}</h4>
      <p className="text-slate-400">{children}</p>
    </div>
  );
}
