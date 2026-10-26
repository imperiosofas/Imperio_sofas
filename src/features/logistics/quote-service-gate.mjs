/** Ensures an operation with service-role privileges never runs when disabled. */
export async function executeWhenServiceConfigured(configured, operation) {
  if (!configured) return { status: "configuration_pending" };
  return { status: "executed", result: await operation() };
}
