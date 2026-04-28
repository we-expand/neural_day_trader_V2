import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FileText, FileSpreadsheet, Download, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';

// Mock Data Generator for Reports
const generateMockTradeData = (count = 50) => {
  const data = [];
  const assets = ['EURUSD', 'BTCUSD', 'XAUUSD', 'US30', 'GBPUSD'];
  const types = ['BUY', 'SELL'];
  
  for (let i = 0; i < count; i++) {
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const entry = 1000 + Math.random() * 100;
    const exit = entry + (Math.random() * 10 - 5);
    const profit = (exit - entry) * (type === 'BUY' ? 1 : -1) * 100; // Mock profit
    
    data.push({
      id: `TRD-${10000 + i}`,
      date: newjhDate(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString().split('T')[0],
      asset,
      type,
      volume: (Math.random() * 2).toFixed(2),
      entry: entry.toFixed(4),
      exit: exit.toFixed(4),
      profit: profit.toFixed(2),
      status: profit > 0 ? 'PROFIT' : 'LOSS'
    });
  }
  return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

function newjhDate(arg0: number): Date {
    return new Date(arg0);
}

export function ReportExporter() {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportPDF = async () => {
    setIsExporting('PDF');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const doc = new jsPDF();
    const data = generateMockTradeData();

    // Header
    doc.setFontSize(20);
    doc.text('Neural Day Trader - Relatório de Performance', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);
    doc.text('ID do Relatório: NT-REP-2024-OX92', 14, 36);

    // AI Analysis Section in PDF
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 45, 182, 20, 'F');
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text('Análise da IA: Padrão de conformidade administrativa detectado. Auditoria interna recomendada.', 16, 58);

    // Table
    autoTable(doc, {
      startY: 70,
      head: [['ID', 'Data', 'Ativo', 'Tipo', 'Vol', 'Entrada', 'Saída', 'P/L ($)']],
      body: data.map(d => [d.id, d.date, d.asset, d.type, d.volume, d.entry, d.exit, d.profit]),
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      styles: { fontSize: 8 }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - Confidencial Neural Day Trader`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save('neural_trader_report.pdf');
    setIsExporting(null);
  };

  const handleExportExcel = async () => {
    setIsExporting('EXCEL');
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    const data = generateMockTradeData(100);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TradeData");
    
    XLSX.writeFile(wb, "neural_trader_dump.xlsx");
    setIsExporting(null);
  };

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm relative overflow-hidden">
        {/* Decorative background elements */}
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
                            Relatórios de conformidade e auditoria
                        </CardDescription>
                    </div>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    COMPLIANCE
                </Badge>
            </div>
        </CardHeader>

        <CardContent className="space-y-6">
            
            {/* AI Analysis Block */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/80 border border-l-4 border-l-amber-500 border-slate-800 p-4 rounded-r-lg"
            >
                <div className="flex items-start gap-3">
                    <div className="mt-1">
                        <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-200 mb-1">Análise da IA</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            <span className="text-amber-400 font-mono">DETECTADO:</span> Necessidade administrativa de registro externo. 
                            Recomenda-se exportação diária para fins de auditoria fiscal e conformidade regulatória (CVM/IRS).
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Export Actions */}
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
                        <span className="block text-sm font-bold text-slate-300 group-hover:text-white">Dados Raw (Excel)</span>
                        <span className="block text-[10px] text-slate-500">Para análise quantitativa</span>
                    </div>
                </Button>
            </div>

            <div className="text-center">
                <p className="text-[10px] text-slate-600 font-mono">
                    SECURE HASH: {Math.random().toString(36).substring(2, 15).toUpperCase()}
                </p>
            </div>

        </CardContent>
    </Card>
  );
}
