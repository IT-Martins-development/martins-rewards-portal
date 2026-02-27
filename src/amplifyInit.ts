import { Amplify } from "aws-amplify";

/**
 * CONFIGURAÇÃO MANUAL FORÇADA - AMBIENTE D3G2YPEZEJHH8U
 * Este arquivo substitui as configurações automáticas para garantir:
 * 1. Login via Cognito (User Pool)
 * 2. Conexão com a REST API (operatorApi)
 * 3. Conexão com o AppSync (GraphQL)
 */

Amplify.configure({
  // Configuração de Autenticação (Resolve o erro "Auth UserPool not configured")
  Auth: {
    Cognito: {
      userPoolId: 'us-east-2_J1tQgVm42',
      userPoolClientId: '43rdma1om3vhmovk5hdr7desr2'
    }
  },
  // Configuração de APIs
  API: {
    // GraphQL (Usado para queries específicas se necessário)
    GraphQL: {
      endpoint: 'https://wnpqbka2h5d3lfi3xznvmd4tcq.appsync-api.us-east-2.amazonaws.com/graphql',
      region: 'us-east-2',
      defaultAuthMode: 'userPool'
    },
    // REST API - O nome "operatorApi" deve ser idêntico ao usado no ProjectControl.tsx
    REST: {
      "operatorApi": {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging", 
        region: "us-east-2"
      }
    }
  }
});

console.log("Configuração manual forçada aplicada no novo App ID d3g2ypezejhh8u.");