Last login: Sun Mar  1 14:32:05 on ttys000
clebercouto@Mac ~ % # Criar pasta
mkdir -p ~/gemini-neural-trader
cd ~/gemini-neural-trader

# Inicializar projeto
npm init -y

# Instalar dependência local
npm install @google/generative-ai

# Confirmar onde estamos
pwd
zsh: command not found: #
zsh: command not found: #
Wrote to /Users/clebercouto/gemini-neural-trader/package.json:

{
  "name": "gemini-neural-trader",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs"
}


zsh: command not found: #

added 1 package, and audited 2 packages in 688ms

found 0 vulnerabilities
zsh: command not found: #
/Users/clebercouto/gemini-neural-trader
clebercouto@Mac gemini-neural-trader % touch .env
clebercouto@Mac gemini-neural-trader % echo 'GOOGLE_API_KEY=AIzaSyDvIv7kYsQnTHz_xnkY-HjfD7QpC01haTQ' > .env
clebercouto@Mac gemini-neural-trader % cat .env
GOOGLE_API_KEY=AIzaSyDvIv7kYsQnTHz_xnkY-HjfD7QpC01haTQ
clebercouto@Mac gemini-neural-trader % npm install dotenv

added 1 package, and audited 3 packages in 792ms

1 package is looking for funding
  run `npm fund` for details

found 0 vulnerabilities
clebercouto@Mac gemini-neural-trader % cat > test-gemini.js << 'EOF'
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
  console.log("\n🤖 TESTE GEMINI PRO");
  console.log("═══════════════════════════════════════\n");

  if (!process.env.GOOGLE_API_KEY) {
    console.log("❌ ERRO: API Key não encontrada no .env");
    return;
  }

  console.log("✅ API Key encontrada!");
  console.log("📤 Enviando teste para Gemini PRO...\n");

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent("Responda apenas: 'Gemini está funcionando!'");
    const response = await result.response;
    const text = response.text();

    console.log("📥 RESPOSTA:");
    console.log("───────────────────────────────────────");
    console.log(text);
    console.log("───────────────────────────────────────\n");
    console.log("✅ SUCESSO! Gemini CLI está pronto!\n");

  } catch (error) {
    console.log("❌ ERRO:", error.message, "\n");
  }
}

testGemini();
EOF
clebercouto@Mac gemini-neural-trader % node test-gemini.js
[dotenv@17.3.1] injecting env (0) from .env -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild

🤖 TESTE GEMINI PRO
═══════════════════════════════════════

✅ API Key encontrada!
📤 Enviando teste para Gemini PRO...

❌ ERRO: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent: [400 Bad Request] API key not valid. Please pass a valid API key. [{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID","domain":"googleapis.com","metadata":{"service":"generativelanguage.googleapis.com"}},{"@type":"type.googleapis.com/google.rpc.LocalizedMessage","locale":"en-US","message":"API key not valid. Please pass a valid API key."}] 

clebercouto@Mac gemini-neural-trader % 
