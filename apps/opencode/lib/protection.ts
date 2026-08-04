const protectedPaths = [".opencode/plans", "docs/decisions"]
const mutationTools = new Set(["bash", "edit", "write", "patch", "apply_patch"])

export function guardProtectedPaths(toolName: string, args: unknown) {
  if (!mutationTools.has(toolName)) return
  const serialized = JSON.stringify(args).replaceAll("\\", "/")
  const target = protectedPaths.find((path) => serialized.includes(path))
  if (target) {
    throw new Error(
      `${target} is workflow-owned and immutable to general tools; use workflow_contract or workflow_checkpoint`,
    )
  }
}
