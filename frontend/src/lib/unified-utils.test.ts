import { describe, it, expect } from "vitest";
import {
  resolveUnifiedFolders,
  DEFAULT_UNIFIED_FOLDERS,
  ALL_UNIFIED_TYPES,
  UNIFIED_FOLDER_DEFINITIONS,
} from "./unified-utils";
import type { UnifiedFolderConfig } from "./api-types";

describe("unified-utils", () => {
  it("contient les définitions de métadonnées pour tous les types de dossiers unifiés", () => {
    expect(ALL_UNIFIED_TYPES.length).toBe(9);
    for (const type of ALL_UNIFIED_TYPES) {
      expect(UNIFIED_FOLDER_DEFINITIONS[type]).toBeDefined();
      expect(UNIFIED_FOLDER_DEFINITIONS[type].defaultLabel).toBeTruthy();
      expect(UNIFIED_FOLDER_DEFINITIONS[type].icon).toBeDefined();
    }
  });

  it("retourne DEFAULT_UNIFIED_FOLDERS si aucune configuration n'est fournie", () => {
    expect(resolveUnifiedFolders(undefined)).toEqual(DEFAULT_UNIFIED_FOLDERS);
    expect(resolveUnifiedFolders([])).toEqual(DEFAULT_UNIFIED_FOLDERS);
  });

  it("complète les dossiers manquants tout en préservant l'ordre de la configuration personnalisée", () => {
    const customConfig: UnifiedFolderConfig[] = [
      { id: "starred", label: "Favoris", enabled: true, order: 0 },
      { id: "inbox", label: "Boîte", enabled: true, order: 1 },
    ];

    const resolved = resolveUnifiedFolders(customConfig);

    // Vérifie que tous les 9 types sont présents
    expect(resolved.length).toBe(ALL_UNIFIED_TYPES.length);

    // Les deux premiers sont ceux de la configuration
    expect(resolved[0].id).toBe("starred");
    expect(resolved[0].label).toBe("Favoris");
    expect(resolved[1].id).toBe("inbox");
    expect(resolved[1].label).toBe("Boîte");

    // Les types non mentionnés sont désactivés par défaut
    const pinned = resolved.find((r) => r.id === "pinned");
    expect(pinned).toBeDefined();
    expect(pinned?.enabled).toBe(false);
  });
});
