/** Game gravity. Circular orbit at r=80 around mass 1000 lasts ~10s. */
export const G = 202;

export const SUN_MASS = 1000;
export const EARTH_MASS = 12;
export const PLANET_MASS_DEFAULT = 2;

/** Earth visual/physical radius at mass 1. */
export const RADIUS_REF = 2.4;
export const RADIUS_MASS_REF = 1;

export const SOFTENING = 0.8;
export const DT = 1 / 60;
export const MAX_BODIES = 12;
export const SIM_DURATION_SEC = 25;
export const STABLE_SEC = 18;
export const ESCAPE_DISTANCE = 520;
export const HEIGHT_MIN = -90;
export const HEIGHT_MAX = 90;
export const GRAVITY_SCALE_MIN = 0.15;
export const GRAVITY_SCALE_MAX = 4;
export const SIZE_MIN = 0.35;
export const SIZE_MAX = 4;
export const ESCAPE_FRAMES = 45;
export const CLOSE_APPROACH_FACTOR = 4;
export const MAX_SUBSTEPS = 8;

/**
 * Mutual gravity between non-central bodies (not sun/blackhole).
 * Full N-body at compressed distances blows up; sun still pulls fully.
 */
export const PLANET_PAIR_FACTOR = 0.2;

/** Soft solar tide on a bound moon. Full sun pull unbinds moons at this scale. */
export const BOUND_MOON_SUN_FACTOR = 0.28;

/** Inside this multiple of sun radius, bodies heat and can burn. */
export const SUN_HEAT_FACTOR = 1.55;
/** Instant burn when closer than this multiple of sun radius. */
export const SUN_BURN_FACTOR = 1.12;

/** Relative speed below this (in world units / s) merges. */
export const MERGE_SPEED = 18;
/** Above this, non-Earth bodies can be destroyed instead of merging. */
export const DESTROY_SPEED = 55;
