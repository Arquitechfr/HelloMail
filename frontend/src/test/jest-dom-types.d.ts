import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// Vitest 5 : Assertion<R, T> a 2 paramètres de type (retour + valeur), alors que
// l'augmentation officielle de @testing-library/jest-dom en déclare un seul
// (Assertion<T>) — la fusion d'interfaces ne s'applique pas. On ré-augmente
// ici avec la bonne arité pour exposer les matchers DOM (toBeInTheDocument…).
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<R, T> extends TestingLibraryMatchers<T, R> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}
