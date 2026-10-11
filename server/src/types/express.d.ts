declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: number;
    }
  }
}

declare module 'http' {
  interface IncomingMessage {
    requestId: string;
  }
}

export {};
