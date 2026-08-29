import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");

function main() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log("Nova carteira de TESTNET gerada:");
  console.log(`  Endereco:     ${account.address}`);
  console.log(`  Chave privada: ${privateKey}`);
  console.log(
    "\nEssa chave e SO para a Base Sepolia (testnet). Nao envie ETH real " +
      "para esse endereco, nem reutilize essa chave em nenhuma rede principal."
  );

  let envContent = existsSync(ENV_PATH)
    ? readFileSync(ENV_PATH, "utf-8")
    : readFileSync(join(__dirname, "..", ".env.example"), "utf-8");

  if (envContent.includes("AGENT_PRIVATE_KEY=")) {
    envContent = envContent.replace(/AGENT_PRIVATE_KEY=.*/, `AGENT_PRIVATE_KEY=${privateKey}`);
  } else {
    envContent += `\nAGENT_PRIVATE_KEY=${privateKey}\n`;
  }

  writeFileSync(ENV_PATH, envContent, "utf-8");
  console.log(`\nChave salva em ${ENV_PATH} (arquivo ja esta no .gitignore).`);
  console.log("\nProximo passo: use um faucet para mandar ETH de testnet para o endereco acima, ex:");
  console.log("  https://www.alchemy.com/faucets/base-sepolia");
}

main();
