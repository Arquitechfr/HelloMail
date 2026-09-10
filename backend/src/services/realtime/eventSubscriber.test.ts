import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ioredis — doit être une classe constructable (pas de arrow function).
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockQuit = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

let messageCallback: ((channel: string, message: string) => void) | null = null;

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      constructor() {}
      subscribe = mockSubscribe;
      quit = mockQuit;
      on = (event: string, cb: unknown) => {
        if (event === 'message') messageCallback = cb as typeof messageCallback;
        mockOn(event, cb);
      };
    },
  };
});

// Mock env pour forcer le mode non-test
vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'development',
    REDIS_URL: 'redis://127.0.0.1:6379',
    LOG_LEVEL: 'info',
  },
}));

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { subscribeToUserEvents, closeSubscriber } = await import('./eventSubscriber.js');
const { EVENTS_CHANNEL } = await import('./eventPublisher.js');

describe('eventSubscriber', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    messageCallback = null;
    // Ferme le subscriber singleton pour forcer une recréation à chaque test.
    await closeSubscriber();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('souscrit aux événements d\'un utilisateur et reçoit les messages filtrés', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToUserEvents('user1', callback);

    // Simule un message Redis pour user1.
    expect(messageCallback).not.toBeNull();
    messageCallback!(EVENTS_CHANNEL, JSON.stringify({
      type: 'message:new',
      accountId: 'abc',
      userId: 'user1',
      payload: { folder: 'INBOX', uid: 1 },
    }));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].type).toBe('message:new');

    unsubscribe();
  });

  it('ne reçoit pas les événements d\'un autre utilisateur', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToUserEvents('user1', callback);

    messageCallback!(EVENTS_CHANNEL, JSON.stringify({
      type: 'message:new',
      accountId: 'abc',
      userId: 'user2',
      payload: {},
    }));

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('désinscription supprime le callback', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToUserEvents('user1', callback);

    unsubscribe();

    messageCallback!(EVENTS_CHANNEL, JSON.stringify({
      type: 'message:new',
      accountId: 'abc',
      userId: 'user1',
      payload: {},
    }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('gère un message JSON invalide sans crash', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToUserEvents('user1', callback);

    // Ne lance pas d'erreur.
    messageCallback!(EVENTS_CHANNEL, 'invalid json');

    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('ferme la connexion Redis', async () => {
    subscribeToUserEvents('user1', vi.fn());
    await closeSubscriber();

    expect(mockQuit).toHaveBeenCalled();
  });
});
