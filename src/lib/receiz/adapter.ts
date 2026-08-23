import {
  RECEIZ_DEFAULT_BASE_URL,
  RECEIZ_SDK_VERSION,
  RECEIZ_V124_APPLICATION_OPERATIONS,
  appendReceizIdentityArtifactTrailerToPng,
  createReceizClient,
  type ActionLedgerFeed,
  type CheckoutRequest,
  type CheckoutSessionResponse,
  type ConnectTransferRequest,
  type ConnectTransferResponse,
  type ConnectWalletResponse,
  type DocumentVerifyResponse,
  type JsonObject,
  type OidcTokenRequest,
  type OidcTokenResponse,
  type ReceizPublicProjectionRecord,
  type ReceizAppStateFeedResponse,
  type ReceizAppStateRecordResponse,
  type ReceizAppStateRestoreResult,
  type ReceizAssetManifest,
  type ReceizAssetManifestProjection,
  type ReceizAuditAppendRequest,
  type ReceizCapabilities,
  type ReceizCapabilitiesOptions,
  type ReceizClient,
  type ReceizClientOptions,
  type ReceizCommerceRuntimeRequest,
  type ReceizCustomerSessionBootstrapRequest,
  type ReceizCustomerSessionBootstrapResponse,
  type ReceizCustomerSessionRequest,
  type ReceizDeviceIdentity,
  type ReceizDoctorReport,
  type ReceizIdContinueRequest,
  type ReceizIdempotencyOptions,
  type ReceizEnsureTenantSessionInput,
  type ReceizEnsureTenantSessionResult,
  type ReceizIdentityAccountProjection,
  type ReceizIdentityLoginProof,
  type ReceizJobRequest,
  type ReceizMediaTransformRequest,
  type ReceizMediaUploadOptions,
  type ReceizMediaUploadResponse,
  type ReceizMerchantOnboardRequest,
  type ReceizOneClickCheckoutRequest,
  type ReceizOneClickCheckoutResponse,
  type ReceizPermissionCheckRequest,
  type ReceizPermissionGrantRequest,
  type ReceizPublicStoreAppendResult,
  type ReceizPublicStorePublishInput,
  type ReceizPublicStoreResolveInput,
  type ReceizPublicStoreResolveResult,
  type ReceizPublicStoreRestoreLatestInput,
  type ReceizPublicStoreSignedPublishInput,
  type ReceizReleasePinRequest,
  type ReceizSearchRequest,
  type ReceizKeyFile,
  type ReceizProofMemory,
  type ReceizProofMemoryAdditionsQuery,
  type ReceizProofMemoryOptions,
  type ReceizProofRegister,
  type ReceizSportsCardManifest,
  type ReceizSportsCardManifestProjection,
  type ReceizWorldProfileMessageRequest,
  type ReceizWorldProfileQuery,
  type ReceizWorldProfileResponse,
  type ReceizWorldPublicSnapshotResponse,
  type SaveTwinMarketMandateInput,
  type ReceizTenantRuntimeRequest,
  type CreateTwinMarketIntentInput,
  type TwinApprovalResponse,
  type TwinMarketIntentResponse,
  type TwinMarketIntentsResponse,
  type TwinMarketMandateResponse,
  type TwinMindImportSummaryResponse,
  type TwinPromotionApprovalInput,
  type ReceizWebhookEvent,
  type WalletLedgerFeed
} from "@receiz/sdk";
import type { GameResult, Product, ProofEvent, ReceizedAsset, Reward, VerifiedObject } from "@/types/domain";
import { makeId } from "@/lib/utils";
import { platform } from "@/lib/platform";
import { receizOidcScopesFromEnv } from "./oauth-scopes";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";

export type ReceizCommerceAdapter = {
  sdkVersion: string;
  client: ReceizClient;
  capabilities(options?: ReceizCapabilitiesOptions): Promise<ReceizCapabilities>;
  doctor(options?: ReceizCapabilitiesOptions): Promise<ReceizDoctorReport>;
  connectReceiz(): Promise<ReceizRailsStatus>;
  buildReceizIdAuthorizeUrl(input: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    scopes?: string[];
    state?: string;
    usernameHint?: string;
  }): string;
  exchangeReceizIdToken(
    body: OidcTokenRequest,
    options?: { authorization?: string }
  ): Promise<OidcTokenResponse>;
  userinfo(): Promise<JsonObject>;
  introspectAccessToken(): Promise<JsonObject>;
  createReceizId(input: {
    username: string;
    displayName: string;
    deviceName?: string;
    next?: string;
  }): Promise<{
    identity: ReceizDeviceIdentity;
    continueRequest: ReceizIdContinueRequest;
    projection: ReceizIdentityAccountProjection;
  }>;
  restoreIdentityArtifact(input: string | Uint8Array | ArrayBuffer | Blob): Promise<{
    keyFile: ReceizKeyFile;
    projection: ReceizIdentityAccountProjection;
  }>;
  appendIdentityArtifactTrailerToPng(pngBytes: Uint8Array, keyFile: ReceizKeyFile): Uint8Array;
  signIdentityLoginProof(input: {
    keyFile: ReceizKeyFile;
    challengeText?: string;
    challengeB64Url?: string;
  }): Promise<ReceizIdentityLoginProof>;
  verifyIdentityLoginProof(input: {
    keyFile: ReceizKeyFile;
    challengeB64Url: string;
    signatureB64Url: string;
  }): Promise<boolean>;
  continueReceizId(identity: ReceizDeviceIdentity, next?: string): Promise<JsonObject>;
  exchangeProofAuthorityV123: ReceizClient["identity"]["exchangeProofAuthority"];
  grantedScopesV124: ReceizClient["auth"]["grantedScopes"];
  qualifyRuntimeV124: ReceizClient["runtime"]["qualifyV124"];
  openAuthoritySessionV124: ReceizClient["runtime"]["openAuthoritySessionV124"];
  refreshAuthoritySessionV124: ReceizClient["runtime"]["refreshAuthoritySessionV124"];
  closeAuthoritySessionV124: ReceizClient["runtime"]["closeAuthoritySessionV124"];
  stageExecutionV124: ReceizClient["execution"]["stage"];
  stagePreparedExecutionV124: ReceizClient["execution"]["stagePrepared"];
  executeV124: ReceizClient["execution"]["execute"];
  resolveExecutionV124: ReceizClient["execution"]["resolve"];
  resolveExecutionByIdempotencyV124: ReceizClient["execution"]["resolveByIdempotencyKey"];
  cancelExecutionV124: ReceizClient["execution"]["cancel"];
  planAtomicOperationV124: ReceizClient["execution"]["planAtomicOperationV124"];
  ensureTenantSession(input: ReceizEnsureTenantSessionInput): ReceizEnsureTenantSessionResult;
  createProofRegister(ownerId?: string): ReceizProofRegister;
  createProofMemory(options?: ReceizProofMemoryOptions): Promise<ReceizProofMemory>;
  proofMemoryAdditionsQuery(
    value: ReceizProofRegister | ReceizProofMemory,
    limit?: number
  ): ReceizProofMemoryAdditionsQuery;
  verifyArtifact(file: Blob): Promise<DocumentVerifyResponse>;
  verifyAndOpenArtifact: ReceizClient["artifacts"]["verifyAndOpen"];
  downloadArtifact: ReceizClient["artifacts"]["download"];
  admitArtifact: ReceizClient["artifacts"]["admit"];
  planArtifactRecovery: ReceizClient["artifacts"]["planRecovery"];
  admitAndRecoverArtifact: ReceizClient["artifacts"]["admitAndRecover"];
  commitArtifactRecovery: ReceizClient["artifacts"]["commitRecovery"];
  claimBearerArtifact: ReceizClient["ownership"]["claimBearerAsset"];
  observePublicProof(body: { url: string; externalCreatorId?: string; title?: string }): Promise<ReceizPublicProjectionRecord>;
  getPublicProofByUrl(url: string): Promise<ReceizPublicProjectionRecord>;
  getPublicProofById(id: string): Promise<ReceizPublicProjectionRecord>;
  worldSnapshot(): Promise<ReceizWorldPublicSnapshotResponse>;
  worldProfile(username: string, query?: ReceizWorldProfileQuery): Promise<ReceizWorldProfileResponse>;
  worldMessage(username: string, body: ReceizWorldProfileMessageRequest): Promise<ReceizWorldProfileResponse>;
  resolveWorldSubject: ReceizClient["subjects"]["resolve"];
  admitSubjectV122: ReceizClient["subjects"]["admit"];
  resolveSubjectNamespacesV123: ReceizClient["subjects"]["resolveNamespaces"];
  resolveSubjectNamespacesV124: ReceizClient["subjects"]["resolveNamespacesV124"];
  subjectTwinProfile: ReceizClient["subjects"]["twin"]["profile"];
  subjectTwinMessage: ReceizClient["subjects"]["twin"]["message"];
  subjectTwinExportMind: ReceizClient["subjects"]["twin"]["exportMind"];
  subjectTwinImportMind: ReceizClient["subjects"]["twin"]["importMind"];
  subjectTwinMemorySummary: ReceizClient["subjects"]["twin"]["memorySummary"];
  subjectStateV122: ReceizClient["subjects"]["state"];
  createSubjectAccessKeyV122: ReceizClient["subjects"]["createAccessKey"];
  publishSubjectAccessKeyV122: ReceizClient["subjects"]["publishAccessKey"];
  replayWorld: ReceizClient["world"]["replay"];
  worldAdditions: ReceizClient["world"]["additions"];
  planWorldCommand: ReceizClient["world"]["planCommand"];
  planWorldCommandV122: ReceizClient["world"]["planCommandV122"];
  validateWorldCommand: ReceizClient["world"]["validateCommand"];
  executeWorldCommand: ReceizClient["world"]["executeCommand"];
  planWorldTransaction: ReceizClient["world"]["planTransaction"];
  planWorldTransactionV122: ReceizClient["world"]["planTransactionV122"];
  executeWorldTransaction: ReceizClient["world"]["executeTransaction"];
  planPrivateWorldCommandV122: ReceizClient["world"]["planPrivateCommand"];
  validateWorldTransactionV122: ReceizClient["world"]["validateTransaction"];
  executeWorldTransactionV122: ReceizClient["world"]["executeTransactionV122"];
  worldExecutionV122: ReceizClient["world"]["execution"];
  worldExecutionByIdempotencyKeyV122: ReceizClient["world"]["executionByIdempotencyKey"];
  worldAdditionsV122: ReceizClient["world"]["additionsV122"];
  planMultiWorldTransactionV122: ReceizClient["world"]["planMultiWorldTransaction"];
  executeMultiWorldTransactionV122: ReceizClient["world"]["executeMultiWorldTransaction"];
  verifiedDomainAdditionsV124: ReceizClient["domains"]["verifiedAdditionsV124"];
  verifiedDomainReplayV124: ReceizClient["domains"]["verifiedReplayV124"];
  verifiedDomainCheckpointV124: ReceizClient["domains"]["verifiedCheckpointV124"];
  verifiedPrivateDomainAdditionsV124: ReceizClient["domains"]["verifiedPrivateAdditionsV124"];
  exportDomainReplayProofObjectV124: ReceizClient["domains"]["exportVerifiedReplayProofObjectV124"];
  restoreDomainReplayProofObjectV124: ReceizClient["domains"]["restoreVerifiedReplayProofObjectV124"];
  resolvePublicRecipientV124: ReceizClient["identity"]["resolvePublicRecipientV124"];
  publishSealedSourceV124: ReceizClient["sources"]["publishSealedSourceV124"];
  planPhiSettlementV122: ReceizClient["value"]["planSettlement"];
  planPhiReserveV122: ReceizClient["value"]["planReserve"];
  validatePhiIntentV122: ReceizClient["value"]["validateIntent"];
  planPhiSettlementV123: ReceizClient["value"]["planSettlement"];
  planPhiReserveV123: ReceizClient["value"]["planReserve"];
  validatePhiIntentV123: ReceizClient["value"]["validateIntent"];
  executePhiSettlementV123: ReceizClient["value"]["executeSettlement"];
  executePhiReserveV123: ReceizClient["value"]["executeReserve"];
  phiExecutionByIdempotencyKeyV123: ReceizClient["value"]["executionByIdempotencyKey"];
  quotePhiDisplayUsdV122: ReceizClient["value"]["quoteDisplayUsd"];
  twinMarketMandate(): Promise<TwinMarketMandateResponse>;
  saveTwinMarketMandate(body: SaveTwinMarketMandateInput): Promise<TwinMarketMandateResponse>;
  twinMarketIntents(): Promise<TwinMarketIntentsResponse>;
  createTwinMarketIntent(body: CreateTwinMarketIntentInput): Promise<TwinMarketIntentResponse>;
  approveTwinMarketIntent(intentId: string): Promise<TwinMarketIntentResponse>;
  exportTwinMind(): Promise<Blob>;
  importTwinMind(file: Blob): Promise<TwinMindImportSummaryResponse>;
  importTwinMindSummary(): Promise<TwinMindImportSummaryResponse>;
  twinApproval(): Promise<TwinApprovalResponse>;
  approveTwinPromotion(body: TwinPromotionApprovalInput): Promise<TwinApprovalResponse>;
  oneClickCheckout(body: ReceizOneClickCheckoutRequest): Promise<ReceizOneClickCheckoutResponse>;
  customerBootstrapSession(
    body: ReceizCustomerSessionBootstrapRequest,
    idempotencyKey?: string
  ): Promise<ReceizCustomerSessionBootstrapResponse>;
  customerSession(body: ReceizCustomerSessionRequest, idempotencyKey?: string): Promise<JsonObject>;
  customerPortal(body: ReceizTenantRuntimeRequest): Promise<JsonObject>;
  customerOrders(query?: ReceizSearchRequest): Promise<JsonObject>;
  customerRewards(query?: ReceizSearchRequest): Promise<JsonObject>;
  customerAssets(query?: ReceizSearchRequest): Promise<JsonObject>;
  merchantOnboard(body: ReceizMerchantOnboardRequest, idempotencyKey?: string): Promise<JsonObject>;
  merchantProfile(query?: { tenantHost?: string }): Promise<JsonObject>;
  merchantCapabilities(query?: { tenantHost?: string }): Promise<JsonObject>;
  checkout(body: CheckoutRequest): Promise<CheckoutSessionResponse>;
  checkoutSession(query: { checkoutSessionId?: string; sessionId?: string }): Promise<CheckoutSessionResponse>;
  connectWallet(): Promise<ConnectWalletResponse>;
  walletSummary(): Promise<ConnectWalletResponse>;
  connectTransfer(body: ConnectTransferRequest, idempotencyKey?: string): Promise<ConnectTransferResponse>;
  connectRecord(body: JsonObject): Promise<JsonObject>;
  uploadMedia(file: Blob, options?: ReceizMediaUploadOptions): Promise<ReceizMediaUploadResponse>;
  transformMedia(body: ReceizMediaTransformRequest, idempotencyKey?: string): Promise<JsonObject>;
  reserveSubdomain(body: JsonObject, idempotencyKey?: string): Promise<JsonObject>;
  verifyCustomDomain(body: JsonObject, idempotencyKey?: string): Promise<JsonObject>;
  domainStatus(query?: { host?: string; domain?: string }): Promise<JsonObject>;
  resolveTenant<TData extends JsonObject = JsonObject>(
    host: string,
    options?: { schema?: string; state?: string; requiredDataKey?: string }
  ): Promise<ReceizAppStateRestoreResult<TData>>;
  publishPublicStore<TState extends JsonObject = JsonObject>(
    input: ReceizPublicStorePublishInput<TState>,
    options?: ReceizIdempotencyOptions
  ): Promise<ReceizAppStateFeedResponse>;
  publishPublicStoreWithIdentityProof<TState extends JsonObject = JsonObject>(
    input: ReceizPublicStoreSignedPublishInput<TState>,
    options?: ReceizIdempotencyOptions
  ): Promise<ReceizPublicStoreAppendResult>;
  restoreLatestPublicStore<TState extends JsonObject = JsonObject>(
    input: ReceizPublicStoreRestoreLatestInput
  ): Promise<ReceizPublicStoreResolveResult<TState>>;
  resolvePublicStore<TState extends JsonObject = JsonObject>(
    input: ReceizPublicStoreResolveInput
  ): Promise<ReceizPublicStoreResolveResult<TState>>;
  readAppStateByUrl(url: string): Promise<ReceizAppStateRecordResponse>;
  createRefund(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  createSubscription(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  cancelSubscription(
    subscriptionId: string,
    body: ReceizCommerceRuntimeRequest,
    options?: ReceizIdempotencyOptions
  ): Promise<JsonObject>;
  reserveInventory(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  adjustInventory(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  quoteShipping(body: ReceizCommerceRuntimeRequest): Promise<JsonObject>;
  updateShipping(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  quoteTax(body: ReceizCommerceRuntimeRequest): Promise<JsonObject>;
  createDiscount(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  redeemDiscount(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  issueGiftCard(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  redeemGiftCard(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  issueAccessPass(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  verifyAccessPass(body: ReceizCommerceRuntimeRequest): Promise<JsonObject>;
  updateFulfillment(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  createPayout(body: ReceizCommerceRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  payoutStatus(query?: { tenantHost?: string; payoutId?: string }): Promise<JsonObject>;
  auditAppend(body: ReceizAuditAppendRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  searchProducts(body: ReceizSearchRequest): Promise<JsonObject>;
  enqueueJob(body: ReceizJobRequest): Promise<JsonObject>;
  grantPermission(body: ReceizPermissionGrantRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  checkPermission(body: ReceizPermissionCheckRequest): Promise<JsonObject>;
  scorePaymentRisk(body: ReceizCommerceRuntimeRequest): Promise<JsonObject>;
  exportComplianceOrders(query: ReceizSearchRequest): Promise<JsonObject>;
  exportStorePortability(query: { tenantHost: string }): Promise<JsonObject>;
  importStorePortability(body: ReceizTenantRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  sendNotification(body: ReceizTenantRuntimeRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  releaseCheck(query?: { tenantHost?: string }): Promise<JsonObject>;
  releasePin(body: ReceizReleasePinRequest, options?: ReceizIdempotencyOptions): Promise<JsonObject>;
  walletLedger(query?: { limit?: number; cursor?: string; since?: string }): Promise<WalletLedgerFeed>;
  actionLedger(query?: { limit?: number; cursor?: string; since?: string }): Promise<ActionLedgerFeed>;
  signWebhook(input: { secret: string; timestamp: string; body: string | Uint8Array | ArrayBuffer | JsonObject }): Promise<string>;
  verifyWebhookSignature(input: {
    secret: string;
    timestamp: string;
    body: string | Uint8Array | ArrayBuffer | JsonObject;
    signature: string;
  }): Promise<boolean>;
  assertWebhookEvent(body: JsonObject): ReceizWebhookEvent;
  projectAssetManifest(manifest: ReceizAssetManifest): ReceizAssetManifestProjection;
  projectSportsCardManifest(manifest: ReceizSportsCardManifest): ReceizSportsCardManifestProjection;
  verifyObject(object: Pick<VerifiedObject, "label" | "objectType">): Promise<VerifiedObject>;
  sealProduct(product: Product): Promise<ProofEvent>;
  sealOrder(orderInput: { id: string; totalLabel: string }): Promise<ProofEvent>;
  sealReward(reward: Reward): Promise<ProofEvent>;
  sealAsset(asset: ReceizedAsset): Promise<ProofEvent>;
  sealGameResult(result: GameResult): Promise<ProofEvent>;
  recordGameResult(result: GameResult): Promise<ProofEvent>;
  issueReward(reward: Reward): Promise<ProofEvent>;
  listAsset(assetId: string): Promise<ProofEvent>;
  sellAsset(assetId: string, terms: string): Promise<ProofEvent>;
  tradeAsset(assetId: string): Promise<ProofEvent>;
  shareAsset(assetId: string): Promise<ProofEvent>;
  getProofTrail(): Promise<ProofEvent[]>;
};

export type ReceizRailKey =
  | "identity"
  | "identityArtifacts"
  | "connect"
  | "checkout"
  | "payments"
  | "verification"
  | "publicProof"
  | "appState"
  | "wallet"
  | "webhooks"
  | "manifests"
  | "proofMemory"
  | "customers"
  | "merchants"
  | "commerce"
  | "rewards"
  | "media"
  | "domains"
  | "events"
  | "search"
  | "permissions"
  | "jobs"
  | "audit"
  | "risk"
  | "compliance"
  | "portability"
  | "notifications"
  | "offline"
  | "releases"
  | "world"
  | "twin";

export type ReceizRailsStatus = {
  connected: true;
  sdkVersion: string;
  baseUrl: string;
  mode: "mock" | "live";
  hasAccessToken: boolean;
  doctor: {
    ok: boolean;
    missing: ReceizDoctorReport["missing"];
    warnings: ReceizDoctorReport["warnings"];
  };
  v124Runtime: {
    qualified: boolean;
    checkedOperations: number;
    unavailableOperations: readonly string[];
  };
  rails: Array<{
    key: ReceizRailKey;
    label: string;
    status: "configured" | "available" | "needs_env";
  }>;
};

function event(type: ProofEvent["type"], detail: string): ProofEvent {
  return {
    id: makeId("proof"),
    type,
    title: type,
    detail,
    status: type === "ASSET_RECEIZED" ? "sealed" : "verified",
    timestampLabel: "now",
    createdAt: new Date().toISOString()
  };
}

function receizClientOptionsFromEnv(): ReceizClientOptions {
  return {
    baseUrl: process.env.RECEIZ_BASE_URL || RECEIZ_DEFAULT_BASE_URL,
    accessToken: process.env.RECEIZ_CONNECT_ACCESS_TOKEN || undefined,
    applicationId: WILDZ_RECEIZ_APPLICATION_ID
  };
}

export function receizOAuthClientAuthorization(
  env?: Partial<Record<"RECEIZ_CLIENT_ID" | "RECEIZ_CLIENT_SECRET", string | undefined>>
) {
  const source = env ?? {
    RECEIZ_CLIENT_ID: process.env.RECEIZ_CLIENT_ID,
    RECEIZ_CLIENT_SECRET: process.env.RECEIZ_CLIENT_SECRET
  };
  const clientId = source.RECEIZ_CLIENT_ID?.trim();
  const clientSecret = source.RECEIZ_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function receizDoctorScopes() {
  return receizOidcScopesFromEnv(process.env);
}

function defaultDoctorOptions(): ReceizCapabilitiesOptions {
  return {
    tenantHost: process.env.NEXT_PUBLIC_DEFAULT_SUBDOMAIN || platform.domain,
    callbackUrl: process.env.RECEIZ_ID_CALLBACK_URL,
    scopes: receizDoctorScopes()
  };
}

export function createReceizCommerceAdapter(
  options: ReceizClientOptions = receizClientOptionsFromEnv()
): ReceizCommerceAdapter {
  const client = createReceizClient({
    ...options,
    applicationId: options.applicationId ?? WILDZ_RECEIZ_APPLICATION_ID
  });
  const hasAccessToken = Boolean(options.accessToken);
  const hasWebhookSecret = Boolean(process.env.RECEIZ_WEBHOOK_SECRET);
  const trail: ProofEvent[] = [];

  const push = (proofEvent: ProofEvent) => {
    trail.unshift(proofEvent);
    return proofEvent;
  };

  return {
    sdkVersion: RECEIZ_SDK_VERSION,
    client,
    capabilities(options) {
      return client.capabilities(options);
    },
    doctor(options) {
      return client.doctor(options);
    },
    async connectReceiz() {
      const [doctor, operational] = await Promise.all([
        client.doctor(defaultDoctorOptions()),
        hasAccessToken
          ? client.runtime.qualifyV124({
              applicationId: WILDZ_RECEIZ_APPLICATION_ID,
              operations: RECEIZ_V124_APPLICATION_OPERATIONS
            }).catch(() => null)
          : Promise.resolve(null)
      ]);
      const capabilityStatus = (
        capability: keyof ReceizCapabilities["capabilities"],
        key: ReceizRailKey,
        label: string
      ) => ({
        key,
        label,
        status: doctor.capabilities[capability]?.available ? ("configured" as const) : ("needs_env" as const)
      });
      const needsTenantToken = (key: ReceizRailKey, label: string) => ({
        key,
        label,
        status: hasAccessToken ? ("configured" as const) : ("needs_env" as const)
      });
      const needsToken = (key: ReceizRailKey, label: string) => ({
        key,
        label,
        status: hasAccessToken ? ("configured" as const) : ("needs_env" as const)
      });

      return {
        connected: true,
        sdkVersion: RECEIZ_SDK_VERSION,
        baseUrl: client.baseUrl,
        mode: hasAccessToken ? "live" : "mock",
        hasAccessToken,
        doctor: {
          ok: doctor.ok,
          missing: doctor.missing,
          warnings: doctor.warnings
        },
        v124Runtime: {
          qualified: operational !== null
            && operational.results.length === RECEIZ_V124_APPLICATION_OPERATIONS.length
            && operational.results.every((result) => result.status === "available"),
          checkedOperations: operational?.results.length ?? 0,
          unavailableOperations: Object.freeze(operational?.results
            .filter((result) => result.status !== "available")
            .map((result) => result.operation) ?? [])
        },
        rails: [
          { key: "identity", label: "Receiz ID creation and continuation", status: "available" },
          { key: "identityArtifacts", label: "Receiz Key, Identity Record, Identity Seal restore", status: "available" },
          { key: "manifests", label: "Manifest validation and display projections", status: "available" },
          { key: "proofMemory", label: "Admit-once proof memory and known-head sync", status: "available" },
          { key: "offline", label: "Offline proof queue for resilient appends", status: "available" },
          { key: "world", label: "Public World profiles and public Twin conversations", status: "available" },
          { key: "verification", label: "Artifact verification and seal calls", status: "available" },
          { key: "publicProof", label: "Public proof rendering and observation", status: "available" },
          needsToken("appState", "Public app-state projection publishing and cold-start recovery"),
          needsToken("twin", "Delegated Twin mandates, intents, mind import/export, and promotion approval"),
          needsTenantToken("customers", "Tenant-scoped customer sessions, orders, rewards, and assets"),
          needsTenantToken("merchants", "Merchant onboarding, profile, and runtime capability checks"),
          capabilityStatus("commerce", "commerce", "One-click checkout, refunds, subscriptions, discounts, inventory, fulfillment, tax, and payouts"),
          capabilityStatus("rewards", "rewards", "Receiz reward routes and benefit state"),
          capabilityStatus("media", "media", "Receiz media uploads and transformations"),
          capabilityStatus("domains", "domains", "Subdomain, custom-domain, and tenant resolution helpers"),
          capabilityStatus("events", "events", "Durable event subscriptions and replay"),
          capabilityStatus("search", "search", "Products, pages, posts, orders, customers, and proof search"),
          capabilityStatus("permissions", "permissions", "Tenant-scoped owner, staff, support, and customer permissions"),
          capabilityStatus("jobs", "jobs", "Durable background jobs"),
          capabilityStatus("audit", "audit", "Sealed tenant audit trail"),
          capabilityStatus("risk", "risk", "Payment, recovery, velocity, and proof-activity risk signals"),
          capabilityStatus("compliance", "compliance", "Orders, tax, payout, customer, and audit exports"),
          capabilityStatus("portability", "portability", "Receiz-native store import/export portability"),
          capabilityStatus("notifications", "notifications", "Tenant notifications, templates, and preferences"),
          capabilityStatus("releases", "releases", "Runtime release rail checks and pinning"),
          needsToken("connect", "Delegated Receiz Connect actions"),
          needsToken("checkout", "Receiz checkout sessions"),
          needsToken("payments", "Embedded Receiz payments and note claim"),
          needsToken("wallet", "Wallet and action ledger additions"),
          {
            key: "webhooks",
            label: "Receiz webhook delivery signatures",
            status: hasWebhookSecret ? "configured" : "needs_env"
          }
        ]
      };
    },
    buildReceizIdAuthorizeUrl(input) {
      return client.identity.authorizeUrl({
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: "S256",
        scope: input.scopes ?? receizOidcScopesFromEnv(process.env),
        state: input.state,
        usernameHint: input.usernameHint
      });
    },
    exchangeReceizIdToken(body, options) {
      return client.identity.token(body, options);
    },
    userinfo() {
      return client.identity.userinfo();
    },
    introspectAccessToken() {
      const authorization = receizOAuthClientAuthorization();
      return client.identity.introspect(
        { token: options.accessToken ?? "" },
        authorization ? { authorization } : undefined
      );
    },
    async createReceizId(input) {
      const identity = await client.identity.createReceizId({
        username: input.username,
        displayName: input.displayName,
        deviceName: input.deviceName ?? platform.productName
      });
      const continueRequest = await client.identity.buildReceizIdContinueRequest(identity, {
        next: input.next
      });
      const projection = await client.identity.projectAccount(identity.keyFile);

      return {
        identity,
        continueRequest,
        projection
      };
    },
    async restoreIdentityArtifact(input) {
      const keyFile = await client.identity.readArtifact(input);
      const projection = await client.identity.projectAccount(keyFile);

      return { keyFile, projection };
    },
    appendIdentityArtifactTrailerToPng(pngBytes, keyFile) {
      return appendReceizIdentityArtifactTrailerToPng(pngBytes, keyFile);
    },
    signIdentityLoginProof(input) {
      return client.identity.signLoginProof(input);
    },
    verifyIdentityLoginProof(input) {
      return client.identity.verifyLoginProof(input);
    },
    continueReceizId(identity, next) {
      return client.identity.continueReceizId(identity, { next });
    },
    exchangeProofAuthorityV123(input) {
      return client.identity.exchangeProofAuthority(input);
    },
    grantedScopesV124() {
      return client.auth.grantedScopes();
    },
    qualifyRuntimeV124(input) {
      return client.runtime.qualifyV124(input);
    },
    openAuthoritySessionV124(input) {
      return client.runtime.openAuthoritySessionV124(input);
    },
    refreshAuthoritySessionV124(input) {
      return client.runtime.refreshAuthoritySessionV124(input);
    },
    closeAuthoritySessionV124(input) {
      return client.runtime.closeAuthoritySessionV124(input);
    },
    stageExecutionV124(input) {
      return client.execution.stage(input);
    },
    stagePreparedExecutionV124(plan, transitions) {
      return client.execution.stagePrepared(plan, transitions);
    },
    executeV124(handle, session) {
      return client.execution.execute(handle, session);
    },
    resolveExecutionV124(input) {
      return client.execution.resolve(input);
    },
    resolveExecutionByIdempotencyV124(input) {
      return client.execution.resolveByIdempotencyKey(input);
    },
    cancelExecutionV124(handle, session) {
      return client.execution.cancel(handle, session);
    },
    planAtomicOperationV124(input) {
      return client.execution.planAtomicOperationV124(input);
    },
    ensureTenantSession(input) {
      return client.identity.ensureTenantSession(input);
    },
    createProofRegister(ownerId) {
      return client.proofMemory.createRegister({ ownerId });
    },
    createProofMemory(options) {
      return client.proofMemory.createMemory(options);
    },
    proofMemoryAdditionsQuery(value, limit) {
      return client.proofMemory.additionsQuery(value, limit);
    },
    verifyArtifact(file) {
      // The v120 local verifier returns a runtime-custodied verification object
      // for admission. This compatibility lane intentionally calls the Connect
      // document endpoint because callers still consume DocumentVerifyResponse.
      return client.connect.verifyArtifact(file);
    },
    verifyAndOpenArtifact(file) {
      return client.artifacts.verifyAndOpen(file);
    },
    downloadArtifact(artifact) {
      return client.artifacts.download(artifact);
    },
    admitArtifact(file, context) {
      return client.artifacts.admit(file, context);
    },
    planArtifactRecovery(admission, knownHistory) {
      return client.artifacts.planRecovery(admission, knownHistory);
    },
    admitAndRecoverArtifact(file, context) {
      return client.artifacts.admitAndRecover(file, context);
    },
    commitArtifactRecovery(plan, capability, idempotencyKey, store) {
      return client.artifacts.commitRecovery(plan, capability, idempotencyKey, store);
    },
    claimBearerArtifact(input) {
      return client.ownership.claimBearerAsset(input);
    },
    observePublicProof(body) {
      return client.publicProof.observe(body);
    },
    getPublicProofByUrl(url) {
      return client.publicProof.byUrl(url);
    },
    getPublicProofById(id) {
      return client.publicProof.byId(id);
    },
    worldSnapshot() {
      return client.world.publicSnapshot();
    },
    worldProfile(username, query) {
      return client.world.profile(username, query);
    },
    worldMessage(username, body) {
      return client.world.message(username, body);
    },
    resolveWorldSubject(subjectId) {
      return client.subjects.resolve(subjectId);
    },
    admitSubjectV122(input) {
      return client.subjects.admit(input);
    },
    resolveSubjectNamespacesV123(input) {
      return client.subjects.resolveNamespaces(input);
    },
    resolveSubjectNamespacesV124(input) {
      return client.subjects.resolveNamespacesV124(input);
    },
    subjectTwinProfile(subjectId) {
      return client.subjects.twin.profile(subjectId);
    },
    subjectTwinMessage(subjectId, input) {
      return client.subjects.twin.message(subjectId, input);
    },
    subjectTwinExportMind(subjectId) {
      return client.subjects.twin.exportMind(subjectId);
    },
    subjectTwinImportMind(subjectId, artifact) {
      return client.subjects.twin.importMind(subjectId, artifact);
    },
    subjectTwinMemorySummary(subjectId) {
      return client.subjects.twin.memorySummary(subjectId);
    },
    subjectStateV122(subjectId) {
      return client.subjects.state(subjectId);
    },
    createSubjectAccessKeyV122(input) {
      return client.subjects.createAccessKey(input);
    },
    publishSubjectAccessKeyV122(input) {
      return client.subjects.publishAccessKey(input);
    },
    replayWorld(input) {
      return client.world.replay(input);
    },
    worldAdditions(input) {
      return client.world.additions(input);
    },
    planWorldCommand(input) {
      return client.world.planCommand(input);
    },
    planWorldCommandV122(input) {
      return client.world.planCommandV122(input);
    },
    validateWorldCommand(plan) {
      return client.world.validateCommand(plan);
    },
    executeWorldCommand(plan, authority) {
      return client.world.executeCommand(plan, authority);
    },
    planWorldTransaction(input) {
      return client.world.planTransaction(input);
    },
    planWorldTransactionV122(input) {
      return client.world.planTransactionV122(input);
    },
    executeWorldTransaction(plan, authority) {
      return client.world.executeTransaction(plan, authority);
    },
    planPrivateWorldCommandV122(input) {
      return client.world.planPrivateCommand(input);
    },
    validateWorldTransactionV122(transaction) {
      return client.world.validateTransaction(transaction);
    },
    executeWorldTransactionV122(input) {
      return client.world.executeTransactionV122(input);
    },
    worldExecutionV122(input) {
      return client.world.execution(input);
    },
    worldExecutionByIdempotencyKeyV122(input) {
      return client.world.executionByIdempotencyKey(input);
    },
    worldAdditionsV122(input) {
      return client.world.additionsV122(input);
    },
    planMultiWorldTransactionV122(input) {
      return client.world.planMultiWorldTransaction(input);
    },
    executeMultiWorldTransactionV122(input) {
      return client.world.executeMultiWorldTransaction(input);
    },
    verifiedDomainAdditionsV124(input) {
      return client.domains.verifiedAdditionsV124(input);
    },
    verifiedDomainReplayV124(input) {
      return client.domains.verifiedReplayV124(input);
    },
    verifiedDomainCheckpointV124(input) {
      return client.domains.verifiedCheckpointV124(input);
    },
    verifiedPrivateDomainAdditionsV124(input) {
      return client.domains.verifiedPrivateAdditionsV124(input);
    },
    exportDomainReplayProofObjectV124(input) {
      return client.domains.exportVerifiedReplayProofObjectV124(input);
    },
    restoreDomainReplayProofObjectV124(input) {
      return client.domains.restoreVerifiedReplayProofObjectV124(input);
    },
    resolvePublicRecipientV124(input) {
      return client.identity.resolvePublicRecipientV124(input);
    },
    publishSealedSourceV124(input) {
      return client.sources.publishSealedSourceV124(input);
    },
    planPhiSettlementV122(input) {
      return client.value.planSettlement(input);
    },
    planPhiReserveV122(input) {
      return client.value.planReserve(input);
    },
    validatePhiIntentV122(input) {
      return client.value.validateIntent(input);
    },
    planPhiSettlementV123(input) {
      return client.value.planSettlement(input);
    },
    planPhiReserveV123(input) {
      return client.value.planReserve(input);
    },
    validatePhiIntentV123(input) {
      return client.value.validateIntent(input);
    },
    executePhiSettlementV123(intent, authority) {
      return client.value.executeSettlement(intent, authority);
    },
    executePhiReserveV123(intent, authority) {
      return client.value.executeReserve(intent, authority);
    },
    phiExecutionByIdempotencyKeyV123(idempotencyKey, authority) {
      return client.value.executionByIdempotencyKey(idempotencyKey, authority);
    },
    quotePhiDisplayUsdV122(amountPhiMicro, usdPerPhiMicrocents) {
      return client.value.quoteDisplayUsd(amountPhiMicro, usdPerPhiMicrocents);
    },
    twinMarketMandate() {
      return client.twin.marketMandate();
    },
    saveTwinMarketMandate(body) {
      return client.twin.saveMarketMandate(body);
    },
    twinMarketIntents() {
      return client.twin.marketIntents();
    },
    createTwinMarketIntent(body) {
      return client.twin.createMarketIntent(body);
    },
    approveTwinMarketIntent(intentId) {
      return client.twin.approveMarketIntent(intentId);
    },
    exportTwinMind() {
      return client.twin.exportMind();
    },
    importTwinMind(file) {
      return client.twin.importMind(file);
    },
    importTwinMindSummary() {
      return client.twin.importMindSummary();
    },
    twinApproval() {
      return client.twin.approval();
    },
    approveTwinPromotion(body) {
      return client.twin.approvePromotion(body);
    },
    oneClickCheckout(body) {
      return client.commerce.oneClickCheckout(body);
    },
    customerBootstrapSession(body, idempotencyKey) {
      return client.customers.bootstrapSession(body, { idempotencyKey });
    },
    customerSession(body, idempotencyKey) {
      return client.customers.session(body, { idempotencyKey });
    },
    customerPortal(body) {
      return client.customers.portal(body);
    },
    customerOrders(query) {
      return client.customers.orders(query);
    },
    customerRewards(query) {
      return client.customers.rewards(query);
    },
    customerAssets(query) {
      return client.customers.assets(query);
    },
    merchantOnboard(body, idempotencyKey) {
      return client.merchants.onboard(body, { idempotencyKey });
    },
    merchantProfile(query) {
      return client.merchants.profile(query);
    },
    merchantCapabilities(query) {
      return client.merchants.capabilities(query);
    },
    checkout(body) {
      return client.connect.checkout(body);
    },
    checkoutSession(query) {
      return client.connect.checkoutSession(query);
    },
    connectWallet() {
      return client.connect.wallet();
    },
    walletSummary() {
      return client.connect.wallet();
    },
    connectTransfer(body, idempotencyKey) {
      return client.connect.transfer(body, { idempotencyKey });
    },
    connectRecord(body) {
      return client.connect.record(body);
    },
    uploadMedia(file, options) {
      return client.media.upload(file, options);
    },
    transformMedia(body, idempotencyKey) {
      return client.media.transform(body, { idempotencyKey });
    },
    reserveSubdomain(body, idempotencyKey) {
      return client.domains.reserveSubdomain(body, { idempotencyKey });
    },
    verifyCustomDomain(body, idempotencyKey) {
      return client.domains.verifyCustomDomain(body, { idempotencyKey });
    },
    domainStatus(query) {
      return client.domains.status(query);
    },
    resolveTenant(host, options) {
      return client.domains.resolveTenant(host, options);
    },
    publishPublicStore(input, options) {
      return client.publicStore.publish(input, options);
    },
    publishPublicStoreWithIdentityProof(input, options) {
      return client.publicStore.publishWithIdentityProof(input, options);
    },
    restoreLatestPublicStore(input) {
      return client.publicStore.restoreLatest(input);
    },
    resolvePublicStore(input) {
      return client.publicStore.resolve(input);
    },
    readAppStateByUrl(url) {
      return client.appState.byUrl(url);
    },
    createRefund(body, options) {
      return client.commerce.refunds.create(body, options);
    },
    createSubscription(body, options) {
      return client.commerce.subscriptions.create(body, options);
    },
    cancelSubscription(subscriptionId, body, options) {
      return client.commerce.subscriptions.cancel(subscriptionId, body, options);
    },
    reserveInventory(body, options) {
      return client.commerce.inventory.reserve(body, options);
    },
    adjustInventory(body, options) {
      return client.commerce.inventory.adjust(body, options);
    },
    quoteShipping(body) {
      return client.commerce.shipping.quote(body);
    },
    updateShipping(body, options) {
      return client.commerce.shipping.update(body, options);
    },
    quoteTax(body) {
      return client.commerce.tax.quote(body);
    },
    createDiscount(body, options) {
      return client.commerce.discounts.create(body, options);
    },
    redeemDiscount(body, options) {
      return client.commerce.discounts.redeem(body, options);
    },
    issueGiftCard(body, options) {
      return client.commerce.giftCards.issue(body, options);
    },
    redeemGiftCard(body, options) {
      return client.commerce.giftCards.redeem(body, options);
    },
    issueAccessPass(body, options) {
      return client.commerce.accessPasses.issue(body, options);
    },
    verifyAccessPass(body) {
      return client.commerce.accessPasses.verify(body);
    },
    updateFulfillment(body, options) {
      return client.commerce.fulfillment.update(body, options);
    },
    createPayout(body, options) {
      return client.commerce.payouts.create(body, options);
    },
    payoutStatus(query) {
      return client.commerce.payouts.status(query);
    },
    auditAppend(body, options) {
      return client.audit.append(body, options);
    },
    searchProducts(body) {
      return client.search.products(body);
    },
    enqueueJob(body) {
      return client.jobs.enqueue(body);
    },
    grantPermission(body, options) {
      return client.permissions.grant(body, options);
    },
    checkPermission(body) {
      return client.permissions.check(body);
    },
    scorePaymentRisk(body) {
      return client.risk.scorePayment(body);
    },
    exportComplianceOrders(query) {
      return client.compliance.exportOrders(query);
    },
    exportStorePortability(query) {
      return client.portability.exportStore(query);
    },
    importStorePortability(body, options) {
      return client.portability.importStore(body, options);
    },
    sendNotification(body, options) {
      return client.notifications.send(body, options);
    },
    releaseCheck(query) {
      return client.releases.check(query);
    },
    releasePin(body, options) {
      return client.releases.pin(body, options);
    },
    walletLedger(query) {
      return client.wallet.publicLedger(query);
    },
    actionLedger(query) {
      return client.wallet.actionLedger(query);
    },
    signWebhook(input) {
      return client.webhooks.sign(input);
    },
    verifyWebhookSignature(input) {
      return client.webhooks.verifySignature(input);
    },
    assertWebhookEvent(body) {
      return client.webhooks.assertEvent(body);
    },
    projectAssetManifest(manifest) {
      return client.manifests.projectAsset(manifest);
    },
    projectSportsCardManifest(manifest) {
      return client.manifests.projectSportsCard(manifest);
    },
    async verifyObject(object) {
      const verified = {
        id: makeId("object"),
        label: object.label,
        objectType: object.objectType,
        sealedAt: new Date().toISOString()
      };
      push(event("OBJECT_VERIFIED", `${object.label} sealed`));
      return verified;
    },
    async sealProduct(product) {
      return push(event("OBJECT_VERIFIED", `${product.name} sealed`));
    },
    async sealOrder(orderInput) {
      return push(event("ORDER_VERIFIED", `Order #${orderInput.id} sealed`));
    },
    async sealReward(reward) {
      return push(event("REWARD_ISSUED", `${reward.name} sealed`));
    },
    async sealAsset(asset) {
      return push(event("ASSET_RECEIZED", `${asset.name} sealed`));
    },
    async sealGameResult(result) {
      return push(event("GAME_COMPLETED", `${result.beans} beans · ${result.score} score`));
    },
    async recordGameResult(result) {
      return push(event("GAME_COMPLETED", `${result.beans} beans · ${result.score} score`));
    },
    async issueReward(reward) {
      return push(event("REWARD_ISSUED", `${reward.name} issued`));
    },
    async listAsset(assetId) {
      return push(event("ASSET_RECEIZED", `${assetId} listed`));
    },
    async sellAsset(assetId, terms) {
      return push(event("ASSET_RECEIZED", `${assetId} listed for ${terms}`));
    },
    async tradeAsset(assetId) {
      return push(event("ASSET_RECEIZED", `${assetId} trade opened`));
    },
    async shareAsset(assetId) {
      return push(event("ASSET_RECEIZED", `${assetId} shared`));
    },
    async getProofTrail() {
      return trail;
    }
  };
}

export const receizCommerceAdapter = createReceizCommerceAdapter();
