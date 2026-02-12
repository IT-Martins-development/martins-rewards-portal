// src/amplifyClient.ts
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import awsExports from "./aws-exports";

Amplify.configure(awsExports);

export const gqlClient = generateClient();