import { SpanStatusCode, context, trace, type Attributes, type Span } from "@opentelemetry/api";
import { tracer } from "./tracing.js";

// Envolve uma função assíncrona num span do OpenTelemetry -- registra
// exceção real (nunca fabricada) e marca status ERROR quando a função
// lança, sempre fecha o span (inclusive em caminho de erro), e propaga o
// contexto do span pai automaticamente (permite aninhar: ciclo -> decisão do
// LLM -> execução de ferramenta -> ordem no broker vira uma única árvore).
export async function withSpan<T>(name: string, attributes: Attributes, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      span.recordException(err instanceof Error ? err : new Error(message));
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      throw err;
    } finally {
      span.end();
    }
  });
}

// Anexa atributos ao span ATIVO no momento da chamada (ex: preço real
// obtido, id da ordem na corretora) sem precisar repassar o objeto `span`
// por todas as funções intermediárias -- usa o contexto ambiente do OTel.
export function addAttributesToActiveSpan(attributes: Attributes): void {
  const span = trace.getSpan(context.active());
  if (span) span.setAttributes(attributes);
}

export function addEventToActiveSpan(name: string, attributes?: Attributes): void {
  const span = trace.getSpan(context.active());
  if (span) span.addEvent(name, attributes);
}
