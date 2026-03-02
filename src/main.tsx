import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";

import App from "./App";
import "./index.css";
import "@aws-amplify/ui-react/styles.css";

// Configure ANTES de qualquer render
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: awsExports.aws_user_pools_id,
      userPoolClientId: awsExports.aws_user_pools_web_client_id,
      loginWith: { email: true },
    },
  },
  // (Opcional) se você usa REST no projeto:
  API: {
    REST: {
      operatorApi: {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging",
        region: "us-east-2",
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);