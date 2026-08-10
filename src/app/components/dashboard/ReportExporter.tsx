import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FileText, FileSpreadsheet, Download, Info, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';
import { aiPersistence, AITrade } from '@/app/services/AITradingPersistenceService';

/**
 * Exporta o histórico real de trades (Supabase `ai_trades`, sessões DEMO do
 * usuário) — antes gerava 50-100 trades inteiramente fictícios via
 * `Math.random()`, com ID de relatório fixo e "SECURE HASH" aleatório,
 * apresentados como relatório de conformidade/auditoria (auditoria 2026-07-29).
 * Sem trade real, não exporta nada fabricado — mostra estado vazio explícito.
 */
async function loadRealTradesForExport(userId: string) {
  const sessions = await aiPersistence.getUserSessions(userId, 50);
  if (sessions.length === 0) return [] as AITrade[];
  const bySession = await Promise.all(sessions.map(s => aiPersistence.getSessionTrades(s.id!)));
  return bySession.flat();
}

function toExportRow(t: AITrade) {
  return {
    id: t.id ?? '',
    date: t.entry_time ? new Date(t.entry_time).toISOString().split('T')[0] : '',
    asset: t.symbol,
    type: t.type,
    volume: t.quantity,
    entry: t.entry_price?.toFixed(4) ?? '',
    exit: t.exit_price?.toFixed(4) ?? '',
    profit: t.pnl?.toFixed(2) ?? '',
    status: t.status
  };
}

export function ReportExporter() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportPDF = async () => {
    if (!user?.id) return;
    setIsExporting('PDF');
    try {
      const trades = await loadRealTradesForExport(user.id);
      if (trades.length === 0) {
        toast.info('Nenhum trade real registrado ainda — nada para exportar.');
        return;
      }
      const data = trades.map(toExportRow);

      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text('Neural Day Trader - Histórico de Operações (DEMO)', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`${trades.length} operações reais desta conta`, 14, 36);

      autoTable(doc, {
        startY: 46,
        head: [['ID', 'Data', 'Ativo', 'Tipo', 'Vol', 'Entrada', 'Saída', 'P/L ($)', 'Status']],
        body: data.map(d => [d.id, d.date, d.asset, d.type, d.volume, d.entry, d.exit, d.profit, d.status]),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { fontSize: 8 }
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} — modo DEMO, não é histórico de dinheiro real`, 14, doc.internal.pageSize.height - 10);
      }

      doc.save('neural_trader_historico.pdf');
    } catch (e) {
      console.error('[ReportExporter] Falha ao exportar PDF:', e);
      toast.error('Falha ao gerar o PDF.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!user?.id) return;
    setIsExporting('EXCEL');
    try {
      const trades = await loadRealTradesForExport(user.id);
      if (trades.length === 0) {
        toast.info('Nenhum trade real registrado ainda — nada para exportar.');
        return;
      }
      const data = trades.map(toExportRow);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TradeData");
      XLSX.writeFile(wb, "neural_trader_historico.xlsx");
    } catch (e) {
      console.error('[ReportExporter] Falha ao exportar Excel:', e);
      toast.error('Falha ao gerar a planilha.');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                        <Download className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <CardTitle className="text-white text-lg">Exportação de Dados</CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            Histórico real de operações desta conta (modo DEMO)
                        </CardDescription>
                    </div>
                </div>
                <Badge variant="outline" className="border-slate-700 text-slate-400 bg-slate-900/50">
                    DEMO
                </Badge>
            </div>
        </CardHeader>

        <CardContent className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/80 border border-l-4 border-l-blue-500 border-slate-800 p-4 rounded-r-lg"
            >
                <div className="flex items-start gap-3">
                    <div className="mt-1">
                        <Info className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-200 mb-1">O que é exportado</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Todas as operações reais desta conta em modo DEMO (Supabase). Não é dinheiro real e não substitui
                            documento fiscal ou de auditoria — é só o seu histórico de uso da ferramenta.
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center gap-3 border-slate-800 hover:bg-slate-900 hover:border-red-500/50 hover:text-red-400 transition-all group"
                    onClick={handleExportPDF}
                    disabled={!!isExporting}
                >
                    {isExporting === 'PDF' ? (
                        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                    ) : (
                        <FileText className="h-8 w-8 text-slate-500 group-hover:text-red-500 transition-colors" />
                    )}
                    <div className="text-center">
                        <span className="block text-sm font-bold text-slate-300 group-hover:text-white">Relatório PDF</span>
                        <span className="block text-[10px] text-slate-500">Formatado para impressão</span>
                    </div>
                </Button>

                <Button
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center gap-3 border-slate-800 hover:bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-400 transition-all group"
                    onClick={handleExportExcel}
                    disabled={!!isExporting}
                >
                    {isExporting === 'EXCEL' ? (
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    ) : (
                        <FileSpreadsheet className="h-8 w-8 text-slate-500 group-hover:text-emerald-500 transition-colors" />
                    )}
                    <div className="text-center">
                        <span className="block text-sm font-bold text-slate-300 group-hover:text-white">Dados (Excel)</span>
                        <span className="block text-[10px] text-slate-500">Para análise própria</span>
                    </div>
                </Button>
            </div>
        </CardContent>
    </Card>
  );
}
