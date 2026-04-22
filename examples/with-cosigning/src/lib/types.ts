// Activity webhook payload — protojson-serialized external activity sent by ACTIVITY_UPDATES
export interface ActivityWebhookPayload {
  id: string;
  organizationId: string;
  status: string;
  type: string;
  fingerprint: string;
  intent?: Record<string, unknown>;
  result?: {
    signRawPayloadResult?: {
      r: string;
      s: string;
      v: string;
    };
    [key: string]: unknown;
  };
  votes?: unknown[];
  canApprove?: boolean;
  canReject?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActivityEventEnvelope {
  id: string;
  receivedAt: string;
  payload: ActivityWebhookPayload;
  approved?: boolean;
}

export type ActivitySseMessage =
  | {
      type: "connected";
      connectedAt: string;
      recentEvents: ActivityEventEnvelope[];
    }
  | {
      type: "activity-update";
      event: ActivityEventEnvelope;
    }
  | {
      type: "heartbeat";
      sentAt: string;
    };
