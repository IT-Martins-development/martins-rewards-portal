import { generateClient } from "aws-amplify/api";

export const gqlClient = generateClient({
  authMode: "userPool",
});