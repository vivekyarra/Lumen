/**
 * CI-only type shim for Snap's LEAF package (Leaf.lspkg, installed from the Lens Studio Asset Library).
 * Signatures follow Snap's LEAF reference (ls-clad plugin, skills/specs-leaf-write-scenarios/references/
 * leaf-reference.md). In Lens Studio the real package's types are used; this file is never shipped.
 */
declare module "Leaf.lspkg/Scenarios/scenario/Scenario" {
  export abstract class Scenario extends BaseScriptComponent {
    static getTypeName(): string;
    abstract run(): Promise<void>;
  }
}
declare module "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata" {
  export interface ScenarioMetadata { id: string; typename: string }
}
declare module "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator" {
  export function scenariosIndex(target: any, key: string): void;
}
declare module "Leaf.lspkg/Utils/common/Expect" {
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeGreaterThan(n: number): void;
    toBeCloseTo(n: number, digits?: number): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
  }
  export function expect(value: unknown): Matchers & { not: Matchers };
}
declare module "Leaf.lspkg/Utils/common/Utils" {
  export function sleep(ms: number): Promise<void>;
  export function nextFrame(): Promise<void>;
  export function findSceneObjectByName(name: string): SceneObject;
}
declare module "Leaf.lspkg/Interactors/InteractableUtils" {
  import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
  export function findInteractableByName(name: string): Interactable | null;
  export function findInteractablesByName(name: string, root?: SceneObject, enabledOnly?: boolean): Interactable[];
}
declare module "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor" {
  import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
  export class DefaultLeafInteractor {
    trigger(target: Interactable): Promise<void>;
    drag(target: Interactable, delta: vec3, durationMs: number): Promise<void>;
    hover(target: Interactable, durationMs: number): Promise<void>;
  }
}
declare module "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar" {
  import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
  export function createIKInteractor(opts?: object): { trigger(target: Interactable | null, hand?: "left" | "right"): Promise<void> };
}
