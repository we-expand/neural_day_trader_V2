// Bootstrap do OpenTelemetry para o LLM Active Brain.
//
// Precisa ser importado ANTES de qualquer outro módulo em src/index.ts para
// que a instrumentação automática (fetch/undici, usada pelas chamadas HTTP
// deste projeto: Supabase, MetaAPI, LLM provider) consiga interceptar
// corretamente. Se OTEL_ENABLED não estiver setado como "true", o SDK nunca
// é iniciado -- este arquivo vira um no-op e getTracer() abaixo devolve o
// tracer no-op padrão da API do OTel (span.start/end funcionam, só não
// exportam nada), então instrumentar o código nunca quebra quem não
// configurou um backend.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { trace, type Tracer } from "@opentelemetry/api";

const OTEL_ENABLED = (process.env.OTEL_ENABLED ?? "false").toLowerCase() === "true";
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? "llm-active-brain";
// Endpoint OTLP/HTTP do coletor (Jaeger >=1.35 aceita OTLP nativo em
// :4318/v1/traces; Grafana Tempo idem via seu receiver otlphttp).
// Default aponta pro Jaeger local padrão do docker-compose de dev.
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces";
const CONSOLE_DEBUG = (process.env.OTEL_CONSOLE_DEBUG ?? "false").toLowerCase() === "true";

let sdk: NodeSDK | undefined;

if (OTEL_ENABLED) {
  const exporter = new OTLPTraceExporter({ url: OTLP_ENDPOINT });
  const spanProcessors: SpanProcessor[] = [new BatchSpanProcessor(exporter)];
  if (CONSOLE_DEBUG) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
      "deployment.environment": process.env.NODE_ENV ?? "development",
    }),
    spanProcessors,
    // Só undici (fetch nativo do Node) -- é o único transporte HTTP usado
    // neste processo (Supabase-js, MetaAPI, provedor de LLM). Instrumentações
    // automáticas de framework HTTP/DB não fazem sentido aqui (não é um
    // servidor web, não tem driver de banco direto).
    instrumentations: [new UndiciInstrumentation()],
  });

  try {
    sdk.start();
    console.log(`[tracing] OpenTelemetry ativo -- exportando para ${OTLP_ENDPOINT} (service.name=${SERVICE_NAME}).`);
  } catch (err) {
    console.error("[tracing] falha ao iniciar o SDK do OpenTelemetry (traces desativados neste processo):", err instanceof Error ? err.message : err);
  }

  process.on("SIGTERM", () => {
    sdk?.shutdown().catch(() => {});
  });
  process.on("SIGINT", () => {
    sdk?.shutdown().catch(() => {});
  });
} else {
  console.log("[tracing] OTEL_ENABLED != true -- OpenTelemetry desativado, nenhum trace será exportado.");
}

export const tracer: Tracer = trace.getTracer(SERVICE_NAME);

export async function shutdownTracing(): Promise<void> {
  if (sdk) await sdk.shutdown();
}
