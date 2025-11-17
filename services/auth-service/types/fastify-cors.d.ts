declare module '@fastify/cors' {
  import { FastifyPluginCallback } from 'fastify';
  interface FastifyCorsOptions {
    origin?: string | RegExp | (string | RegExp)[] | ((origin: string, cb: (err: Error | null, allow?: boolean) => void) => void);
    methods?: string[] | string;
    allowedHeaders?: string[] | string;
    exposedHeaders?: string[] | string;
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    strictPreflight?: boolean;
    hideOptionsRoute?: boolean;
  }
  const fastifyCors: FastifyPluginCallback<FastifyCorsOptions>;
  export default fastifyCors;
}
