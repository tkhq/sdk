export type GrpcStatus = {
  message: string;
  code: number;
  details: unknown[] | null;
};

export enum MethodType {
  Get,
  List,
  Command
}

export type TStamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
}

export interface TStamper {
  stamp: (input: string) => Promise<TStamp>;
}

export type THttpConfig = {
  baseUrl: string;
}

export class TurnkeyRequestError extends Error {
  details: any[] | null;
  code: number;

  constructor(input: GrpcStatus) {
    let turnkeyErrorMessage = `Turnkey error ${input.code}: ${input.message}`;

    if (input.details != null) {
      turnkeyErrorMessage += ` (Details: ${JSON.stringify(input.details)})`;
    }

    super(turnkeyErrorMessage);

    this.name = "TurnkeyRequestError";
    this.details = input.details ?? null;
    this.code = input.code;
  }
}

export interface ActivityResponse {
  activity: {
    id: string;
    status: string;
  }
}
