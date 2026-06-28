declare module "*.json" {
  const value: {
    priorityWeight: number
    capabilityWeight: number
    latencyPenalty: number
    costPenalty: number
  }
  export default value
}
