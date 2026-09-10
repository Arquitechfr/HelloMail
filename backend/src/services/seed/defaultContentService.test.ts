import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { seedUserDefaults } from './defaultContentService.js';
import { PRESET_TAGS, PRESET_RULES, PRESET_TEMPLATES } from './presetData.js';
import { UserModel } from '../../models/User.js';
import { TagModel } from '../../models/Tag.js';
import { RuleModel } from '../../models/Rule.js';
import { TemplateModel } from '../../models/Template.js';

async function createUser(email = 'seed@test.com') {
  return UserModel.create({ email, passwordHash: 'x'.repeat(60) });
}

describe('defaultContentService — seedUserDefaults', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('seme tags, règles et modèles avec isPreset: true', async () => {
    const user = await createUser();
    await seedUserDefaults(user._id);

    const tags = await TagModel.find({ userId: user._id }).lean();
    const rules = await RuleModel.find({ userId: user._id }).lean();
    const templates = await TemplateModel.find({ userId: user._id }).lean();

    expect(tags).toHaveLength(PRESET_TAGS.length);
    expect(rules).toHaveLength(PRESET_RULES.length);
    expect(templates).toHaveLength(PRESET_TEMPLATES.length);

    expect(tags.every((t) => t.isPreset)).toBe(true);
    expect(rules.every((r) => r.isPreset)).toBe(true);
    expect(templates.every((t) => t.isPreset)).toBe(true);

    expect(tags.map((t) => t.name)).toContain('Important');
    expect(rules.every((r) => r.isActive)).toBe(true);
    expect(rules.every((r) =>
      r.actions.every((a) => ['applyTag', 'markAsRead', 'markAsFlagged'].includes(a.type)),
    )).toBe(true);
  });

  it('positionne defaultsSeededAt sur l\'utilisateur', async () => {
    const user = await createUser();
    await seedUserDefaults(user._id);

    const reloaded = await UserModel.findById(user._id);
    expect(reloaded?.defaultsSeededAt).toBeInstanceOf(Date);
  });

  it('est idempotent : un 2e appel est un no-op', async () => {
    const user = await createUser();
    await seedUserDefaults(user._id);
    await seedUserDefaults(user._id);

    expect(await TagModel.countDocuments({ userId: user._id })).toBe(PRESET_TAGS.length);
    expect(await RuleModel.countDocuments({ userId: user._id })).toBe(PRESET_RULES.length);
    expect(await TemplateModel.countDocuments({ userId: user._id })).toBe(PRESET_TEMPLATES.length);
  });

  it('ne recrée pas un preset supprimé par l\'utilisateur', async () => {
    const user = await createUser();
    await seedUserDefaults(user._id);

    await TagModel.deleteOne({ userId: user._id, name: 'Important' });
    await seedUserDefaults(user._id);

    const names = (await TagModel.find({ userId: user._id }).lean()).map((t) => t.name);
    expect(names).not.toContain('Important');
    expect(names).toHaveLength(PRESET_TAGS.length - 1);
  });

  it('coexiste avec le contenu utilisateur homonyme (dédup par nom)', async () => {
    const user = await createUser();
    await TagModel.create({ userId: user._id, name: 'important', color: '#000000', order: 0 });

    await seedUserDefaults(user._id);

    const tags = await TagModel.find({ userId: user._id }).lean();
    expect(tags).toHaveLength(PRESET_TAGS.length);
    const important = tags.find((t) => t.name === 'important');
    expect(important?.color).toBe('#000000');
    expect(important?.isPreset).toBe(false);
  });

  it('ne fait rien pour un utilisateur inexistant', async () => {
    await expect(seedUserDefaults('507f1f77bcf86cd799439011')).resolves.toBeUndefined();
    expect(await TagModel.countDocuments()).toBe(0);
  });
});
