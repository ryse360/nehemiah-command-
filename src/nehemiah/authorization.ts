export type DataDomain = 'founder-private' | 'enterprise' | 'integration';
export type AuthorizationAction = 'read' | 'write' | 'append' | 'manage';

export type FounderPrincipal = {
  kind: 'founder';
  id: string;
};

export type EnterprisePrincipal = {
  kind: 'enterprise';
  id: string;
};

export type IntegrationPrincipal = {
  kind: 'integration';
  id: string;
  integrationId: string;
};

export type Principal = FounderPrincipal | EnterprisePrincipal | IntegrationPrincipal;

export type AuthorizationRequest = {
  principal: Principal;
  domain: DataDomain;
  action: AuthorizationAction;
  integrationId?: string;
};

export type AuthorizationDecision = {
  allowed: boolean;
  reason: string;
};

export function createFounderPrincipal(id: string): FounderPrincipal {
  return { kind: 'founder', id };
}

export function createEnterprisePrincipal(id: string): EnterprisePrincipal {
  return { kind: 'enterprise', id };
}

export function createIntegrationPrincipal(integrationId: string): IntegrationPrincipal {
  return { kind: 'integration', id: `integration:${integrationId}`, integrationId };
}

export function authorize(request: AuthorizationRequest): AuthorizationDecision {
  const { principal, domain, action, integrationId } = request;

  if (principal.kind === 'founder') {
    return { allowed: true, reason: 'Founder authority permits this bounded operation.' };
  }

  if (domain === 'founder-private') {
    return {
      allowed: false,
      reason: 'Founder-private data is accessible only to an authenticated Founder principal.',
    };
  }

  if (principal.kind === 'enterprise') {
    const allowed = domain === 'enterprise' && (action === 'read' || action === 'write');
    return {
      allowed,
      reason: allowed
        ? 'Enterprise principal is permitted within the enterprise boundary.'
        : 'Enterprise principals cannot administer integrations or cross into another data boundary.',
    };
  }

  const allowed = domain === 'integration'
    && action === 'append'
    && Boolean(integrationId)
    && integrationId === principal.integrationId;

  return {
    allowed,
    reason: allowed
      ? 'Integration principal may append to its own integration boundary.'
      : 'Integration principals may append only to their own integration boundary and cannot read private or enterprise data.',
  };
}

export class AuthorizationError extends Error {
  constructor(public readonly decision: AuthorizationDecision) {
    super(decision.reason);
    this.name = 'AuthorizationError';
  }
}

export function requireAuthorization(request: AuthorizationRequest): void {
  const decision = authorize(request);
  if (!decision.allowed) throw new AuthorizationError(decision);
}
