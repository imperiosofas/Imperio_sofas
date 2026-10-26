export function executeWhenServiceConfigured<T>(
  configured: boolean,
  operation: () => Promise<T>,
): Promise<
  { status: "configuration_pending" } | { status: "executed"; result: T }
>;
