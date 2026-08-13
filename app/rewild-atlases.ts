import datacenterAtlas from "../public/rewild/production/datacenter-modules-v1.json";
import facilityGroundAtlas from "../public/rewild/production/facility-ground-states-v1.json";
import worldConnectionAtlas from "../public/rewild/production/world-connections-v1.json";
import treeResponseAtlas from "../public/rewild/production/tree-response-states-v1.json";
import pondResponseAtlas from "../public/rewild/production/pond-response-states-v1.json";

export type RewildAtlasId = "datacenter" | "facilityGround" | "worldConnections" | "treeResponse" | "pondResponse";

export interface AtlasFrame {
  name: string;
  frame: { x: number; y: number; width: number; height: number };
  pivot: { x: number; y: number };
}

export interface RewildAtlas {
  image: string;
  width: number;
  height: number;
  frames: Record<string, AtlasFrame>;
}

const atlasSource: Record<RewildAtlasId, { file: string; metadata: typeof datacenterAtlas }> = {
  datacenter: { file: "/rewild/production/datacenter-modules-v1.png", metadata: datacenterAtlas },
  facilityGround: { file: "/rewild/production/facility-ground-states-v1.png", metadata: facilityGroundAtlas },
  worldConnections: { file: "/rewild/production/world-connections-v1.png", metadata: worldConnectionAtlas },
  treeResponse: { file: "/rewild/production/tree-response-states-v1.png", metadata: treeResponseAtlas },
  pondResponse: { file: "/rewild/production/pond-response-states-v1.png", metadata: pondResponseAtlas },
};

export const REWILD_ATLASES = Object.fromEntries(Object.entries(atlasSource).map(([id, atlas]) => [id, {
  image: atlas.file,
  width: atlas.metadata.size.width,
  height: atlas.metadata.size.height,
  frames: Object.fromEntries(atlas.metadata.frames.map((frame) => [frame.name, frame])),
}])) as Record<RewildAtlasId, RewildAtlas>;

export function atlasFrame(atlas: RewildAtlasId, frame: string) {
  const resolved = REWILD_ATLASES[atlas].frames[frame];
  if (!resolved) throw new Error(`Unknown Rewild atlas frame: ${atlas}/${frame}`);
  return resolved;
}
