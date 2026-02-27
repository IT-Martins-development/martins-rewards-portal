import { Amplify } from "aws-amplify";

Amplify.configure({
  API: {
    REST: {
      "operatorApi": {
        // Esta URL utiliza o seu ID de App e região staging corretos
        endpoint: "https://d2ti6bqx2tfgyt.execute-api.us-east-2.amazonaws.com/staging", 
        region: "us-east-2"
      }
    }
  }
});

console.log("Configuração manual forçada aplicada.");