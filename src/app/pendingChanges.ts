let guard: (() => boolean) | undefined;

export function registerPendingChanges(check: () => boolean) {
  guard = check;
  return () => {
    if (guard === check) guard = undefined;
  };
}
export function allowNavigation() {
  return guard?.() ?? true;
}
