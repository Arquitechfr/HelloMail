import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml } from './sanitize.js';

describe('sanitizeEmailHtml', () => {
  it('neutralise les balises <script>', () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script>';
    const clean = sanitizeEmailHtml(dirty);

    expect(clean).not.toContain('<script>');
    expect(clean).toContain('<p>Hello</p>');
  });

  it('neutralise les event handlers (onclick, onerror, onload)', () => {
    const dirty = '<img src="x" onerror="alert(1)"><div onclick="alert(2)">text</div>';
    const clean = sanitizeEmailHtml(dirty);

    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
  });

  it('neutralise les URIs javascript:', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = sanitizeEmailHtml(dirty);

    expect(clean).not.toContain('javascript:');
  });

  it('neutralise les balises <style>', () => {
    const dirty = '<style>body{color:red}</style><p>text</p>';
    const clean = sanitizeEmailHtml(dirty);

    expect(clean).not.toContain('<style>');
    expect(clean).toContain('<p>text</p>');
  });

  it('neutralise les balises <form> et <input>', () => {
    const dirty = '<form action="evil"><input name="x"></form><p>ok</p>';
    const clean = sanitizeEmailHtml(dirty);

    expect(clean).not.toContain('<form');
    expect(clean).not.toContain('<input');
    expect(clean).toContain('<p>ok</p>');
  });

  it('conserve les liens https et mailto valides', () => {
    const dirty = '<a href="https://example.com">lien</a><a href="mailto:test@test.com">mail</a>';
    const clean = sanitizeEmailHtml(dirty);

    expect(clean).toContain('https://example.com');
    expect(clean).toContain('mailto:test@test.com');
  });

  it('conserve les images avec src https', () => {
    const dirty = '<img src="https://example.com/img.png" alt="img">';
    const clean = sanitizeEmailHtml(dirty);

    expect(clean).toContain('https://example.com/img.png');
  });

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(sanitizeEmailHtml('')).toBe('');
  });

  it('conserve le texte simple sans balises', () => {
    const clean = sanitizeEmailHtml('Bonjour tout le monde');
    expect(clean).toBe('Bonjour tout le monde');
  });
});
