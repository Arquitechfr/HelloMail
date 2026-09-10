import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import {
  listUserTags,
  createUserTag,
  updateUserTag,
  deleteUserTag,
  setMessageTags,
  batchSetMessageTags,
} from './tagService.js';
import { TagModel } from '../../models/Tag.js';
import { MessageModel } from '../../models/Message.js';
import { AccountModel } from '../../models/Account.js';

describe('tagService', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  const userId = new Types.ObjectId().toString();

  it('crée un tag avec couleur et ordre automatique', async () => {
    const tag1 = await createUserTag(userId, { name: 'Urgent', color: '#ef4444' });
    expect(tag1.name).toBe('Urgent');
    expect(tag1.color).toBe('#ef4444');
    expect(tag1.order).toBe(0);

    const tag2 = await createUserTag(userId, { name: 'Travail' });
    expect(tag2.name).toBe('Travail');
    expect(tag2.color).toBe('#3b82f6');
    expect(tag2.order).toBe(1);
  });

  it('rejette la création d\'un doublon insensible à la casse', async () => {
    await createUserTag(userId, { name: 'Personnel' });
    await expect(createUserTag(userId, { name: 'personnel' })).rejects.toThrow(
      'Un libellé avec ce nom existe déjà',
    );
  });

  it('liste les tags triés par ordre', async () => {
    await createUserTag(userId, { name: 'Tag B', order: 2 });
    await createUserTag(userId, { name: 'Tag A', order: 1 });

    const tags = await listUserTags(userId);
    expect(tags).toHaveLength(2);
    expect(tags[0]?.name).toBe('Tag A');
    expect(tags[1]?.name).toBe('Tag B');
  });

  async function createTestAccount(email: string) {
    return AccountModel.create({
      userId: new Types.ObjectId(userId),
      provider: 'imap',
      emailAddress: email,
      imapConfig: {
        host: 'imap.test.com',
        port: 993,
        secure: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 465,
        smtpSecure: true,
        username: 'u',
        encryptedPassword: { iv: 'iv', authTag: 'tag', ciphertext: 'cipher' },
      },
    });
  }

  async function createTestMessage(accountId: Types.ObjectId, uid: number, tags: string[] = []) {
    return MessageModel.create({
      accountId,
      folder: 'INBOX',
      uid,
      subject: 'Test Subject',
      from: { address: 'sender@example.com' },
      to: [{ address: 'dest@example.com' }],
      date: new Date(),
      flags: { seen: false, answered: false, flagged: false },
      size: 100,
      tags,
    });
  }

  it('met à jour un tag et répercute le renommage dans les messages', async () => {
    const account = await createTestAccount('test@example.com');
    const msg = await createTestMessage(account._id, 42, ['Projet X', 'Important']);

    const tag = await createUserTag(userId, { name: 'Projet X' });
    const updated = await updateUserTag(userId, tag._id.toString(), { name: 'Projet Alpha', color: '#10b981' });

    expect(updated.name).toBe('Projet Alpha');
    expect(updated.color).toBe('#10b981');

    const refreshedMsg = await MessageModel.findById(msg._id);
    expect(refreshedMsg?.tags).toContain('Projet Alpha');
    expect(refreshedMsg?.tags).not.toContain('Projet X');
    expect(refreshedMsg?.tags).toContain('Important');
  });

  it('supprime un tag et le retire de tous les messages', async () => {
    const account = await createTestAccount('test2@example.com');
    const msg = await createTestMessage(account._id, 10, ['À supprimer', 'Garder']);

    const tag = await createUserTag(userId, { name: 'À supprimer' });
    await deleteUserTag(userId, tag._id.toString());

    const exists = await TagModel.findById(tag._id);
    expect(exists).toBeNull();

    const refreshedMsg = await MessageModel.findById(msg._id);
    expect(refreshedMsg?.tags).not.toContain('À supprimer');
    expect(refreshedMsg?.tags).toEqual(['Garder']);
  });

  it('définit les tags sur un message individuel', async () => {
    const account = await createTestAccount('test3@example.com');
    await createTestMessage(account._id, 50, ['Ancien']);

    const updated = await setMessageTags(
      userId,
      account._id.toString(),
      'INBOX',
      50,
      ['Nouveau1', 'Nouveau2'],
    );
    expect(updated.tags).toEqual(['Nouveau1', 'Nouveau2']);
  });

  it('applique des tags en masse (modes set, add, remove)', async () => {
    const account = await createTestAccount('test4@example.com');
    await createTestMessage(account._id, 1, ['Initial']);
    await createTestMessage(account._id, 2, ['Initial']);

    // Mode add
    const addResult = await batchSetMessageTags(userId, account._id.toString(), {
      folder: 'INBOX',
      uids: [1, 2],
      tags: ['Extra'],
      mode: 'add',
    });
    expect(addResult.modifiedCount).toBe(2);

    let m1 = await MessageModel.findOne({ accountId: account._id, uid: 1 });
    expect(m1?.tags).toEqual(expect.arrayContaining(['Initial', 'Extra']));

    // Mode remove
    await batchSetMessageTags(userId, account._id.toString(), {
      folder: 'INBOX',
      uids: [1],
      tags: ['Initial'],
      mode: 'remove',
    });
    m1 = await MessageModel.findOne({ accountId: account._id, uid: 1 });
    expect(m1?.tags).toEqual(['Extra']);

    // Mode set
    await batchSetMessageTags(userId, account._id.toString(), {
      folder: 'INBOX',
      uids: [2],
      tags: ['Reset'],
      mode: 'set',
    });
    const m2 = await MessageModel.findOne({ accountId: account._id, uid: 2 });
    expect(m2?.tags).toEqual(['Reset']);
  });
});
