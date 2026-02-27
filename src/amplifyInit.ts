import { Amplify } from "aws-amplify";

Amplify.configure({
  // Configuração de Autenticação (O que resolve o erro do navegador)
  Auth: {
    Cognito: {
      userPoolId: 'us-east-2_J1tQgVm42',
      userPoolClientId: '43rdma1om3vhmovk5hdr7desr2'
    }
  },
  // Configuração de API (Atualizada para o novo App ID d3g2ypezejhh8u)
  API: {
    GraphQL: {
      endpoint: 'https://wnpqbka2h5d3lfi3xznvmd4tcq.appsync-api.us-east-2.amazonaws.com/graphql',
      region: 'us-east-2',
      defaultAuthMode: 'userPool'
    },
    REST: {
      "operatorApi": {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging", 
        region: "us-east-2"
      }
    }
  }
});

console.log("Configuração manual forçada aplicada no novo App ID.");