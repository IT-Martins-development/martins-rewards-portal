import { Amplify } from "aws-amplify";

// Forçamos a configuração manual para evitar o erro de InvalidApiName em produção
Amplify.configure({
  API: {
    REST: {
      "operatorApi": {
        // Substitua pela URL real do seu API Gateway (Staging)
        endpoint: "https://d2ti6bqx2tfgyt.execute-api.us-east-2.amazonaws.com/staging", 
        region: "us-east-2"
      }
    }
  }
});

console.log("Amplify configurado manualmente para operatorApi");