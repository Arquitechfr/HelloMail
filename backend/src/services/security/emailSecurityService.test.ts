import { describe, it, expect } from 'vitest';
import { parseEmailSecurityHeaders } from './emailSecurityService.js';

describe('emailSecurityService', () => {
  it('identifie un email parfaitement authentifié (DMARC pass, DKIM pass, SPF pass)', () => {
    const headers = {
      'authentication-results':
        'mx.google.com; dkim=pass header.i=@github.com header.s=s20150108; ' +
        'spf=pass (google.com: domain of support@github.com designates 192.30.252.206 as permitted sender); ' +
        'dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=github.com',
      'x-spam-status': 'No, score=-1.5 required=5.0',
    };

    const summary = parseEmailSecurityHeaders(headers, 'support@github.com');

    expect(summary.spf).toBe('pass');
    expect(summary.dkim).toBe('pass');
    expect(summary.dmarc).toBe('pass');
    expect(summary.isTrusted).toBe(true);
    expect(summary.isSpam).toBe(false);
    expect(summary.warningMessage).toBeUndefined();
    expect(summary.spamScore).toBe(-1.5);
  });

  it('détecte un échec DMARC et génère une alerte d\'usurpation', () => {
    const headers = {
      'authentication-results':
        'mx.google.com; dkim=fail; spf=fail; dmarc=fail (p=REJECT) header.from=banque.fr',
      'x-spam-status': 'No, score=2.0',
    };

    const summary = parseEmailSecurityHeaders(headers, 'alerte@banque.fr');

    expect(summary.dmarc).toBe('fail');
    expect(summary.dkim).toBe('fail');
    expect(summary.spf).toBe('fail');
    expect(summary.isTrusted).toBe(false);
    expect(summary.warningMessage).toContain('DMARC');
  });

  it('détecte un échec DKIM spécifique si DMARC n\'est pas en échec explicite', () => {
    const headers = {
      'authentication-results': 'mail.example.com; dkim=fail; spf=pass',
    };

    const summary = parseEmailSecurityHeaders(headers);

    expect(summary.dkim).toBe('fail');
    expect(summary.spf).toBe('pass');
    expect(summary.isTrusted).toBe(false);
    expect(summary.warningMessage).toContain('DKIM');
  });

  it('utilise Received-SPF en repli si Authentication-Results ne contient pas SPF', () => {
    const headers = {
      'authentication-results': 'mail.example.com; dkim=pass',
      'received-spf': 'pass (google.com: domain of user@test.com designates 1.2.3.4)',
    };

    const summary = parseEmailSecurityHeaders(headers);

    expect(summary.dkim).toBe('pass');
    expect(summary.spf).toBe('pass');
    expect(summary.isTrusted).toBe(true);
    expect(summary.details?.spfDetails).toContain('google.com');
  });

  it('détecte un email marqué spam par SpamAssassin (X-Spam-Flag ou X-Spam-Status: Yes)', () => {
    const headers = {
      'authentication-results': 'mail.example.com; spf=pass; dkim=pass; dmarc=pass',
      'x-spam-flag': 'YES',
      'x-spam-status': 'Yes, score=14.2 required=5.0',
    };

    const summary = parseEmailSecurityHeaders(headers);

    expect(summary.isSpam).toBe(true);
    expect(summary.spamScore).toBe(14.2);
    expect(summary.isTrusted).toBe(false);
    expect(summary.warningMessage).toContain('anti-spam');
  });

  it('gère correctement un message sans aucun en-tête d\'authentification', () => {
    const headers = {};

    const summary = parseEmailSecurityHeaders(headers);

    expect(summary.spf).toBe('unknown');
    expect(summary.dkim).toBe('unknown');
    expect(summary.dmarc).toBe('unknown');
    expect(summary.isTrusted).toBe(false);
    expect(summary.warningMessage).toBeUndefined();
  });
});
