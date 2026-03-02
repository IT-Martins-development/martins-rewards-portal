import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsExports.aws_user_pools_id,
      userPoolClientId: awsExports.aws_user_pools_web_client_id,
      loginWith: { email: true },
    },
  },

  API: {
    GraphQL: {
      endpoint: awsExports.aws_appsync_graphqlEndpoint,
      region: awsExports.aws_appsync_region,
      defaultAuthMode: "userPool", // <<< CRÍTICO p/ não cair em IAM
    },

    REST: {
      operatorApi: {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging",
        region: "us-east-2",
      },
    },
  },
});