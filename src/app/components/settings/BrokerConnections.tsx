/**
 * ⚙️ BROKER CONNECTIONS
 * 
 * Painel para conectar diferentes brokers/exchanges:
 * - Infinox (MetaTrader 5 via MetaAPI)
 * - Binance
 * - Interactive Brokers
 * - etc.
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader, Plus, Trash2, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { brokerManager } from '@/app/services/brokers/BrokerAdapter';
import { InfinoxAdapter } from '@/app/services/brokers/InfinoxAdapter';
import { BinanceAdapter } from '@/app/services/brokers/BinanceAdapter';

interface BrokerConnection {
  id: string;
  name: string;
  type: 'infinox' | 'binance' | 'ib' | 'mt5';
  isConnected: boolean;
  credentials?: any;
}

export function BrokerConnections() {
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'infinox' | 'binance' | 'mt5'>('infinox');
  const [isConnecting, setIsConnecting] = useState(false);

  // Credentials forms
  const [infinoxAccountId, setInfinoxAccountId] = useState('');
  const [infinoxToken, setInfinoxToken] = useState('');

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = () => {
    // Carregar do localStorage
    const saved = localStorage.getItem('broker_connections');
    if (saved) {
      setConnections(JSON.parse(saved));
    }
  };

  const saveConnections = (conns: BrokerConnection[]) => {
    localStorage.setItem('broker_connections', JSON.stringify(conns));
    setConnections(conns);
  };

  const handleAddConnection = async () => {
    if (selectedType === 'infinox') {
      if (!infinoxAccountId || !infinoxToken) {
        toast.error('Preencha todos os campos');
        return;
      }

      setIsConnecting(true);

      try {
        // Criar adapter
        const adapter = new InfinoxAdapter();
        
        // Conectar
        await adapter.connect({
          accountId: infinoxAccountId,
          token: infinoxToken
        });

        // Registrar no broker manager
        const id = `infinox_${Date.now()}`;
        brokerManager.registerAdapter(id, adapter);
        brokerManager.setActiveAdapter(id);

        // Salvar conexão
        const newConnection: BrokerConnection = {
          id,
          name: 'Infinox MT5',
          type: 'infinox',
          isConnected: true,
          credentials: {
            accountId: infinoxAccountId,
            token: infinoxToken
          }
        };

        saveConnections([...connections, newConnection]);

        toast.success('Conectado à Infinox com sucesso!');
        setShowAddModal(false);
        setInfinoxAccountId('');
        setInfinoxToken('');
      } catch (error: any) {
        console.error('[BrokerConnections] Erro ao conectar:', error);
        toast.error(`Erro ao conectar: ${error.message}`);
      } finally {
        setIsConnecting(false);
      }
    } else if (selectedType === 'binance') {
      setIsConnecting(true);

      try {
        // Criar adapter
        const adapter = new BinanceAdapter();
        
        // Conectar (Binance não precisa de credenciais para dados públicos)
        await adapter.connect();

        // Registrar no broker manager
        const id = `binance_${Date.now()}`;
        brokerManager.registerAdapter(id, adapter);
        brokerManager.setActiveAdapter(id);

        // Salvar conexão
        const newConnection: BrokerConnection = {
          id,
          name: 'Binance',
          type: 'binance',
          isConnected: true
        };

        saveConnections([...connections, newConnection]);

        toast.success('Conectado à Binance com sucesso!');
        setShowAddModal(false);
      } catch (error: any) {
        console.error('[BrokerConnections] Erro ao conectar:', error);
        toast.error(`Erro ao conectar: ${error.message}`);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleDisconnect = (id: string) => {
    const updated = connections.map(c => 
      c.id === id ? { ...c, isConnected: false } : c
    );
    saveConnections(updated);
    toast.success('Desconectado');
  };

  const handleReconnect = async (connection: BrokerConnection) => {
    setIsConnecting(true);

    try {
      if (connection.type === 'infinox' && connection.credentials) {
        const adapter = new InfinoxAdapter();
        await adapter.connect(connection.credentials);
        
        brokerManager.registerAdapter(connection.id, adapter);
        brokerManager.setActiveAdapter(connection.id);
      } else if (connection.type === 'binance') {
        const adapter = new BinanceAdapter();
        await adapter.connect();
        
        brokerManager.registerAdapter(connection.id, adapter);
        brokerManager.setActiveAdapter(connection.id);
      }

      const updated = connections.map(c => 
        c.id === connection.id ? { ...c, isConnected: true } : c
      );
      saveConnections(updated);
      toast.success('Reconectado com sucesso!');
    } catch (error: any) {
      toast.error(`Erro ao reconectar: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDelete = (id: string) => {
    const updated = connections.filter(c => c.id !== id);
    saveConnections(updated);
    toast.success('Conexão removida');
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-400" />
            Conexões de Brokers
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Conecte sua conta via Infinox, Binance, MT5 ou outros brokers
          </p>
          
          {/* 🔥 INDICADOR DE CONEXÃO ATIVA */}
          {brokerManager.hasConnectedAdapter() && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Broker conectado e ativo ({brokerManager.getActiveAdapter()?.getName()})</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Broker
        </button>
      </div>

      {/* Lista de conexões */}
      <div className="space-y-4">
        {connections.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-8 text-center">
            <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">Nenhuma conexão configurada</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Adicionar Primeira Conexão
            </button>
          </div>
        ) : (
          connections.map(connection => (
            <div
              key={connection.id}
              className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                {connection.isConnected ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400" />
                )}
                <div>
                  <h3 className="text-white font-medium">{connection.name}</h3>
                  <p className="text-sm text-gray-400">
                    {connection.isConnected ? 'Conectado' : 'Desconectado'} • {connection.type.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connection.isConnected ? (
                  <button
                    onClick={() => handleDisconnect(connection.id)}
                    className="text-gray-400 hover:text-red-400 transition-colors px-3 py-1 rounded"
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    onClick={() => handleReconnect(connection)}
                    disabled={isConnecting}
                    className="text-gray-400 hover:text-blue-400 transition-colors px-3 py-1 rounded flex items-center gap-1"
                  >
                    <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
                    Reconectar
                  </button>
                )}
                <button
                  onClick={() => handleDelete(connection.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Adicionar Conexão */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">Adicionar Broker</h3>
            </div>

            <div className="p-6">
              {/* Seletor de tipo */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Broker
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="w-full bg-[#2a2a2a] border border-gray-700 text-white rounded-lg px-4 py-2"
                >
                  <option value="infinox">Infinox (MetaTrader 5)</option>
                  <option value="binance">Binance (Dados Públicos)</option>
                </select>
              </div>

              {/* Form: Infinox */}
              {selectedType === 'infinox' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      MetaAPI Account ID
                    </label>
                    <input
                      type="text"
                      value={infinoxAccountId}
                      onChange={(e) => setInfinoxAccountId(e.target.value)}
                      placeholder="ex: abc123def456"
                      className="w-full bg-[#2a2a2a] border border-gray-700 text-white rounded-lg px-4 py-2"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      MetaAPI Token
                    </label>
                    <input
                      type="password"
                      value={infinoxToken}
                      onChange={(e) => setInfinoxToken(e.target.value)}
                      placeholder="token..."
                      className="w-full bg-[#2a2a2a] border border-gray-700 text-white rounded-lg px-4 py-2"
                    />
                  </div>
                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-sm text-blue-300">
                    <p className="font-medium mb-1">ℹ️ Como obter credenciais MetaAPI:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Crie conta em <a href="https://metaapi.cloud" target="_blank" className="underline">metaapi.cloud</a></li>
                      <li>Conecte sua conta MT5 da Infinox</li>
                      <li>Copie o Account ID e Token</li>
                    </ol>
                  </div>
                </>
              )}

              {/* Form: Binance */}
              {selectedType === 'binance' && (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-sm text-yellow-300">
                  <p className="font-medium mb-1">ℹ️ Binance (Dados Públicos)</p>
                  <p className="text-xs">
                    Esta conexão usa dados públicos da Binance. 
                    Para trading, você precisará configurar API keys posteriormente.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={isConnecting}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddConnection}
                disabled={isConnecting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isConnecting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Conectar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
