import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ACCOUNT_COLORS, getNextAccountColor } from './accountColors.js';
import { AccountModel } from '../models/Account.js';

vi.mock('../models/Account.js', () => ({
  AccountModel: {
    find: vi.fn(),
  },
}));

describe('accountColors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fournit une palette de 12 couleurs distinctes', () => {
    expect(DEFAULT_ACCOUNT_COLORS.length).toBe(12);
    const unique = new Set(DEFAULT_ACCOUNT_COLORS.map((c) => c.toLowerCase()));
    expect(unique.size).toBe(12);
  });

  it('retourne la 1ère couleur si aucun compte existant', async () => {
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const color = await getNextAccountColor('user-1');
    expect(color).toBe(DEFAULT_ACCOUNT_COLORS[0]);
  });

  it('retourne la 2ème couleur sans doublon si la 1ère est déjà prise', async () => {
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ color: DEFAULT_ACCOUNT_COLORS[0] }]),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const color = await getNextAccountColor('user-1');
    expect(color).toBe(DEFAULT_ACCOUNT_COLORS[1]);
  });

  it('trouve un trou de couleur disponible sans doublon', async () => {
    // Supposons que 0 et 2 sont pris, 1 doit être choisi
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { color: DEFAULT_ACCOUNT_COLORS[0] },
          { color: DEFAULT_ACCOUNT_COLORS[2] },
        ]),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const color = await getNextAccountColor('user-1');
    expect(color).toBe(DEFAULT_ACCOUNT_COLORS[1]);
  });

  it('fait une rotation propre si toutes les couleurs de la palette sont utilisées', async () => {
    const allTaken = DEFAULT_ACCOUNT_COLORS.map((c) => ({ color: c }));
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(allTaken),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const color = await getNextAccountColor('user-1');
    // 12 comptes -> index 12 % 12 = 0
    expect(color).toBe(DEFAULT_ACCOUNT_COLORS[0]);
  });
});
