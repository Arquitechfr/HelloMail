import { describe, it, expect } from 'vitest';
import { resolveSignatureVariables, AVAILABLE_SIGNATURE_VARIABLES } from './signature-utils';

describe('signature-utils', () => {
  it('contient les définitions des variables disponibles', () => {
    expect(AVAILABLE_SIGNATURE_VARIABLES.length).toBeGreaterThan(0);
    const keys = AVAILABLE_SIGNATURE_VARIABLES.map((v) => v.key);
    expect(keys).toContain('{{prenom}}');
    expect(keys).toContain('{{nom}}');
    expect(keys).toContain('{{email}}');
    expect(keys).toContain('{{telephone}}');
    expect(keys).toContain('{{poste}}');
    expect(keys).toContain('{{societe}}');
  });

  it('gère les chaînes vides ou sans variables', () => {
    expect(resolveSignatureVariables('', { emailAddress: 'test@example.com' })).toBe('');
    const text = 'Cordialement,\nL\'équipe';
    expect(resolveSignatureVariables(text, { emailAddress: 'test@example.com' })).toBe(text);
  });

  it('résout prénom et nom séparément lorsque les deux sont demandés', () => {
    const template = 'Bien cordialement,\n{{prenom}} {{nom}}\n{{email}}';
    const result = resolveSignatureVariables(template, {
      displayName: 'Alice Martin',
      emailAddress: 'alice.martin@example.com',
    });

    expect(result).toBe('Bien cordialement,\nAlice Martin\nalice.martin@example.com');
  });

  it('résout {{nom_complet}} et {{nom}} quand utilisé seul', () => {
    const template = '{{nom_complet}} ({{nom}})';
    const result = resolveSignatureVariables(template, {
      displayName: 'Bob Dylan',
      emailAddress: 'bob@example.com',
    });

    expect(result).toBe('Bob Dylan (Bob Dylan)');
  });

  it('résout les variables additionnelles (téléphone, poste, société) et leurs alias', () => {
    const template = `
      <p><strong>{{nom_complet}}</strong></p>
      <p>{{poste}} chez {{societe}}</p>
      <p>Tél : {{tel}} | Email : {{email}}</p>
    `;

    const result = resolveSignatureVariables(template, {
      displayName: 'Claire Dubois',
      emailAddress: 'claire@tech.fr',
      variables: {
        phone: '+33 6 99 88 77 66',
        jobTitle: 'Lead Dev',
        company: 'Tech Corp',
      },
    });

    expect(result).toContain('<strong>Claire Dubois</strong>');
    expect(result).toContain('Lead Dev chez Tech Corp');
    expect(result).toContain('Tél : +33 6 99 88 77 66 | Email : claire@tech.fr');
  });

  it('laisse intactes les variables inconnues', () => {
    const template = 'Hello {{unknown_variable}}, de la part de {{prenom}}';
    const result = resolveSignatureVariables(template, {
      displayName: 'David',
      emailAddress: 'david@test.com',
    });

    expect(result).toBe('Hello {{unknown_variable}}, de la part de David');
  });

  it('remplace par une chaîne vide les variables non renseignées', () => {
    const template = 'Poste : {{poste}} | Tél : {{tel}}';
    const result = resolveSignatureVariables(template, {
      displayName: 'Emma',
      emailAddress: 'emma@test.com',
    });

    expect(result).toBe('Poste :  | Tél : ');
  });
});
