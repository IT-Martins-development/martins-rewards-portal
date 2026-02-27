import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-2_J1tQgVm42',
      userPoolClientId: '43rdma1om3vhmovk5hdr7desr2'
    }
  },
  API: {
    REST: {
      // O nome aqui deve ser exatamente 'operatorApi'
      "operatorApi": {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging", 
        region: "us-east-2"
      }
    }
  }
});

console.log("Configuração manual aplicada. API 'operatorApi' registrada.");