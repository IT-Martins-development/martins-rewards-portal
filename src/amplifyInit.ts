import { Amplify } from "aws-amplify";
import awsAuth from "./aws-auth";

// Se você quiser continuar usando o AppSync do aws-exports gerado,
// importe ele também. Mas o Auth fica manual e estável.
// força usar o arquivo gerado pelo "amplify pull"
import awsExports from "./aws-exports.js";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsAuth.userPoolId,
      userPoolClientId: awsAuth.userPoolClientId,
      loginWith: { email: true },
    },
  },

  API: {
    GraphQL: {
      endpoint: awsExports.aws_appsync_graphqlEndpoint,
      region: awsExports.aws_appsync_region,
      defaultAuthMode: "userPool",
    },
    REST: {
      operatorApi: {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging",
        region: "us-east-2",
      },
    },
  },
});
// Debug temporário
// @ts-ignore
window.__amplify_cfg = Amplify.getConfig();
console.log("AMPLIFY CFG", Amplify.getConfig());