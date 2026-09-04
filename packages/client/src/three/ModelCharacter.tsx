import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import {
  AnimationMixer,
  Mesh,
  MeshToonMaterial,
  type AnimationAction,
  type AnimationClip,
  type Group,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MODEL, type ModelClip } from "../config/view";
import { toonRampTexture } from "./textures";
import { ContactShadow } from "./ContactShadow";

/**
 * The character: an AUTHORED model, not a pile of primitives.
 *
 * The hand-built rig this replaces had a hard ceiling — cylinders and spheres
 * cannot make hair, cloth or a face, and no amount of rewriting gets past that. So
 * the geometry is now a KayKit model (CC0), stripped to the nine clips the game
 * actually plays by `tools/model-pipeline/strip-clips.mjs` and served out of
 * `public/models/`.
 *
 * Three properties of that pack carry the whole design, and every decision in this
 * file leans on one of them:
 *
 *   - **One material and one 16 KB texture per character.** So all 25 clones can
 *     SHARE a material and a crowd costs a handful of draw calls rather than
 *     hundreds. That is why the variants below are cached per source material and
 *     per look, never per player.
 *   - **One 41-bone rig for every character in both packs.** So one scale fits all
 *     of them, one bone name finds every hand, and — from Phase 08 — a hat modelled
 *     for the Knight will sit correctly on the Mage.
 *   - **The texture is a grid of flat swatches, not a painting.** Which is what
 *     makes the wardrobe cheap later: repaint three cells onto a canvas and the
 *     whole roster is redressed.
 *
 * This file is the RIG — it loads, clones, dresses and exposes handles.
 * `PlayerAvatar` is the driver that decides what those handles do.
 */

/** What `PlayerAvatar` is given to drive. Null until the model has mounted. */
export interface ModelCharacterHandles {
  /** advances every clip on this character; the driver owns the clock */
  mixer: AnimationMixer | null;
  /** one of the stripped clips, ready to fade in (null if the pack lacks it) */
  action(clip: ModelClip): AnimationAction | null;
  /** the right-hand bone our own hammer hangs off */
  handSlot: Object3D | null;
  /** the blob under the feet, shrunk by the driver as the body leaves the ground */
  shadow: Group | null;
}

export interface ModelCharacterProps {
  /** which `.glb` to wear — one id for everybody until Phase 08 offers a choice */
  characterId?: string;
  /** dead players are drawn pale and see-through, and only to those who may see them */
  ghost?: boolean;
  /** how solid a ghost is drawn (ignored when alive) */
  ghostOpacity?: number;
  /** your own character stands on a ring in your colour, so you can find yourself */
  isMe?: boolean;
  /** that ring's colour — the player's own tint, which no longer touches the body */
  ringColor?: string;
}

export const characterUrl = (id: string) => `${MODEL.dir}${id}.glb`;

/**
 * Every material this file has already built, keyed by its source and the look
 * wanted from it.
 *
 * This cache is the reason 25 players are cheap. `SkeletonUtils.clone` hands every
 * clone a REFERENCE to the same material, and the only thing that varies between
 * players is whether they are alive — so the whole crowd resolves to at most three
 * materials per character rather than one per person.
 */
const MATERIALS = new Map<string, MeshToonMaterial>();

/**
 * Toon-shade a pack material, keeping its texture.
 *
 * The models ship `MeshStandardMaterial`, but this arena is lit for drawn
 * characters standing in a real place: people go through a stepped ramp, the world
 * does not. The atlas is flat swatches to begin with, so stepping it costs nothing
 * and matches everything else on screen.
 */
function toonVariant(source: Material, opacity: number): MeshToonMaterial {
  const key = `${source.uuid}|${opacity}`;
  const cached = MATERIALS.get(key);
  if (cached) return cached;

  const standard = source as MeshStandardMaterial;
  const material = new MeshToonMaterial({
    map: standard.map ?? null,
    color: standard.color?.clone(),
    gradientMap: toonRampTexture(),
    transparent: opacity < 1,
    opacity,
    // a white emissive at zero strength costs nothing to draw and means any part
    // can be flashed on the frame a blow lands by turning one number up
    emissive: 0xffffff,
    emissiveIntensity: 0,
  });
  MATERIALS.set(key, material);
  return material;
}

export const ModelCharacter = forwardRef<ModelCharacterHandles, ModelCharacterProps>(
  function ModelCharacter(
    { characterId = MODEL.defaultId, ghost = false, ghostOpacity = 1, isMe = false, ringColor },
    ref,
  ) {
    const shadow = useRef<Group>(null);
    const { scene, animations } = useGLTF(characterUrl(characterId));

    /**
     * This player's own copy of the model.
     *
     * `SkeletonUtils.clone` is the one that matters: a plain `Object3D.clone()`
     * copies the meshes but leaves them bound to the ORIGINAL skeleton, so all 25
     * players in the room would move as one. It shares geometry and materials,
     * which is exactly what we want — only the bone hierarchy is duplicated.
     */
    const model = useMemo(() => {
      const root = cloneSkeleton(scene);

      const worn: Mesh[] = [];
      root.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        // the hammer is this game's only weapon; a Knight spawning with a longsword
        // he can never swing reads as a bug rather than as a character
        if (MODEL.builtInGear.test(node.name)) {
          node.visible = false;
          return;
        }
        node.receiveShadow = true;
        // a skinned mesh's bounds are its BIND pose, so a limb reaching outside them
        // mid-animation would pop the whole character out of view
        node.frustumCulled = false;
        worn.push(node);
      });

      const torso = worn.filter((node) => MODEL.shadowCaster.test(node.name));
      for (const node of torso.length > 0 ? torso : worn) node.castShadow = true;

      return root;
    }, [scene]);

    /**
     * Re-dress rather than re-clone when a player dies.
     *
     * Death is the only thing that changes how a character is drawn, and rebuilding
     * the clone for it would throw away the skeleton and the mixer's state mid-match
     * for a change of opacity.
     */
    const opacity = ghost ? ghostOpacity : 1;
    useEffect(() => {
      model.traverse((node) => {
        if (node instanceof Mesh && node.visible) {
          node.material = toonVariant(node.material as Material, opacity);
        }
      });
    }, [model, opacity]);

    const mixer = useMemo(() => new AnimationMixer(model), [model]);

    /** Every stripped clip, resolved to an action once and looked up by name after. */
    const actions = useMemo(() => {
      const built = new Map<string, AnimationAction>();
      for (const clip of animations as AnimationClip[]) built.set(clip.name, mixer.clipAction(clip));
      return built;
    }, [animations, mixer]);

    // a mixer holds on to every action it has ever made, and a party churns through
    // players — so the cache dies with the character it was built for
    useEffect(() => () => mixer.uncacheRoot(model), [mixer, model]);

    useImperativeHandle(
      ref,
      () => ({
        mixer,
        action: (clip: ModelClip) => actions.get(clip) ?? null,
        // GLTFLoader strips dots from node names, so `handslot.r` arrives as
        // `handslotr` — try the stripped name first, then the authored one
        handSlot:
          model.getObjectByName(MODEL.handSlotBone) ?? model.getObjectByName("handslot.r") ?? null,
        get shadow() {
          return shadow.current;
        },
      }),
      [mixer, actions, model],
    );

    return (
      <group>
        <ContactShadow groupRef={shadow} ring={isMe && !ghost ? ringColor : undefined} />
        <primitive object={model} scale={MODEL.scale} />
      </group>
    );
  },
);

/**
 * Pull the model down before the plaza is drawn.
 *
 * The loading splash already exists and is the right place to spend this time — a
 * character that streams in after the world does is a person popping into a room
 * that was empty a moment ago.
 */
export function preloadCharacters(): void {
  useGLTF.preload(characterUrl(MODEL.defaultId));
}
