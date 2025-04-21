import { Connection, WorkflowClient } from '@temporalio/client';
import { ConnectionOptions } from "@temporalio/client/src/connection";
import { temporalConfig } from './utils';

/**
 * Creates a Temporal connection with appropriate configuration
 * @returns A Promise that resolves to a Temporal Connection
 */
export async function createTemporalConnection(): Promise<Connection> {
  const connOpts: ConnectionOptions = {
    address: temporalConfig.hostPort,
  };
  
  if (temporalConfig.apiKey) {
    connOpts.tls = true;
    connOpts.apiKey = temporalConfig.apiKey;
    connOpts.metadata = {
      'temporal-namespace': temporalConfig.namespace
    };
  }
  
  return await Connection.connect(connOpts);
}

/**
 * Creates a WorkflowClient for interacting with Temporal
 * @returns A Promise that resolves to a configured WorkflowClient
 */
export async function createWorkflowClient(): Promise<WorkflowClient> {
  const connection = await createTemporalConnection();
  
  return new WorkflowClient({
    connection,
    namespace: temporalConfig.namespace,
  });
}

/**
 * Converts a base64 page token string to a Buffer for Temporal API use
 * @param nextPageToken The page token string in base64 format
 * @returns Buffer or undefined if the token is invalid
 */
export function convertPageToken(nextPageToken: string | undefined): Buffer | undefined {
  let tokenBuffer = undefined;
  
  if (nextPageToken && typeof nextPageToken === 'string' && nextPageToken.trim() !== '') {
    try {
      // Only try to use the token if it's a non-empty string that looks like proper base64
      if (/^[A-Za-z0-9+/=]+$/.test(nextPageToken)) {
        tokenBuffer = Buffer.from(nextPageToken, 'base64');
      }
    } catch (err) {
      console.error("Error converting token to buffer:", err);
      // Return undefined if conversion fails
    }
  }
  
  return tokenBuffer;
}

/**
 * Converts a Buffer token from Temporal API to a base64 string
 * @param tokenBuffer The token buffer from Temporal API
 * @returns A base64 string representation of the token, or empty string if conversion fails
 */
export function convertBufferToTokenString(tokenBuffer: Uint8Array | undefined): string {
  let nextPageTokenString = '';
  
  if (tokenBuffer && tokenBuffer.length > 0) {
    try {
      // Convert the Buffer to a Base64 string
      nextPageTokenString = Buffer.from(tokenBuffer).toString('base64');
    } catch (err) {
      console.error("Error encoding next page token:", err);
      // Return empty string if encoding fails
    }
  }
  
  return nextPageTokenString;
}