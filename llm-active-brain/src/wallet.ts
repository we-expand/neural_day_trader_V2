import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, config } from "./config.js";

export const account = privateKeyToAccount(config.agentPrivateKey);

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(config.rpcUrl),
});

export const walletClient = createWalletClient({
  account,
  chain: CHAIN,
  transport: http(config.rpcUrl),
});

export async function getBalanceEth(): Promise<string> {
  const wei = await publicClient.getBalance({ address: account.address });
  return formatEther(wei);
}

export async function assertOnTestnet() {
  const chainId = await publicClient.getChainId();
  if (chainId !== CHAIN.id) {
    // Isso nunca deveria acontecer dado que o transport e fixo na chain,
    // mas e uma checagem barata para nunca deixar o agente operar em
    // uma rede que a gente nao valide explicitamente aqui.
    throw new Error(
      `Chain inesperada (chainId=${chainId}). Este agente so opera na Base Sepolia (${CHAIN.id}).`
    );
  }
}
