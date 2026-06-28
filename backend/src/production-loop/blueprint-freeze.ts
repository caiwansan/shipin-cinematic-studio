import crypto from "crypto"

export interface FrozenBlueprint {
  blueprintId: string
  version: number
  createdAt: number
  immutable: true
  hash: string
  data: any
}

export function freezeBlueprint(blueprint: any, version = 1): FrozenBlueprint {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(blueprint))
    .digest("hex")

  return {
    blueprintId: hash,
    version,
    createdAt: Date.now(),
    immutable: true,
    hash,
    data: Object.freeze(blueprint),
  }
}
