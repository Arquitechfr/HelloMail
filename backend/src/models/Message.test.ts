import { describe, it, expect } from 'vitest';
import { MessageModel } from './Message.js';

describe('MessageModel Indexes', () => {
  it('contient les index composés pour le listing paginé et le tri par date et épinglage', () => {
    const indexes = MessageModel.schema.indexes();

    // Vérifie la présence de { accountId: 1, folder: 1, isPinned: -1, date: -1 }
    const listIndex = indexes.find(
      ([fields]) =>
        fields.accountId === 1 &&
        fields.folder === 1 &&
        fields.isPinned === -1 &&
        fields.date === -1,
    );
    expect(listIndex).toBeDefined();

    // Vérifie la présence de { accountId: 1, folder: 1, snoozedUntil: 1 }
    const snoozeFolderIndex = indexes.find(
      ([fields]) =>
        fields.accountId === 1 &&
        fields.folder === 1 &&
        fields.snoozedUntil === 1,
    );
    expect(snoozeFolderIndex).toBeDefined();

    // Vérifie la présence de l'index unique { accountId: 1, folder: 1, uid: 1 }
    const uniqueUidIndex = indexes.find(
      ([fields, options]) =>
        fields.accountId === 1 &&
        fields.folder === 1 &&
        fields.uid === 1 &&
        options?.unique === true,
    );
    expect(uniqueUidIndex).toBeDefined();
  });
});
