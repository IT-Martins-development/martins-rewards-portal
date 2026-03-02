// src/aws-exports.ts
const awsExports = {
  aws_project_region: "us-east-2",
  aws_appsync_graphqlEndpoint: "https://wnpqbka2h5d3lfi3xznvmd4tcq.appsync-api.us-east-2.amazonaws.com/graphql",
  aws_appsync_region: "us-east-2",
  aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",

  // Se você usa Cognito (quase certo), coloque também:
  aws_cognito_region: "us-east-2",
  aws_user_pools_id: "us-east-2_J1tQgVm42",
  aws_user_pools_web_client_id: "43rdma1om3vhmovk5hdr7desr2",
};

export default awsExports;