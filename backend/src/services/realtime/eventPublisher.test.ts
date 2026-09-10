import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ioredis — doit être une classe constructable (pas de arrow function).
const mockPublish = vi.fn().mockResolvedValue(1);
const mockQuit = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      constructor() {}
      publish = mockPublish;
      quit = mockQuit;
      on = mockOn;
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

const { publishEvent, closePublisher, EVENTS_CHANNEL } = await import('./eventPublisher.js');

describe('eventPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publie un événement sur le canal Redis', async () => {
    const event = {
      type: 'message:new' as const,
      accountId: 'abc',
      userId: 'user1',
      payload: { folder: 'INBOX', uid: 1 },
    };

    await publishEvent(event);

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const [channel, message] = mockPublish.mock.calls[0];
    expect(channel).toBe(EVENTS_CHANNEL);
    expect(JSON.parse(message)).toEqual(event);
  });

  it('ne lance pas d\'erreur si la publication échoue', async () => {
    mockPublish.mockRejectedValueOnce(new Error('Redis down'));

    const event = {
      type: 'message:deleted' as const,
      accountId: 'abc',
      userId: 'user1',
      payload: { folder: 'INBOX', uid: 1 },
    };

    await expect(publishEvent(event)).resolves.not.toThrow();
  });

  it('ferme la connexion Redis', async () => {
    // Publie d'abord pour initialiser la connexion.
    await publishEvent({
      type: 'message:new',
      accountId: 'abc',
      userId: 'user1',
      payload: {},
    });

    await closePublisher();

    expect(mockQuit).toHaveBeenCalled();
  });
});
