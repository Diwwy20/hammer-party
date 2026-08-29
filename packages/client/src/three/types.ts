/** The client-predicted transform of the local player, shared by the loop and avatar. */
export interface SelfTransform {
  x: number;
  z: number;
  dir: number;
  /** false until the first server snapshot has seeded the prediction. */
  ready: boolean;
}
