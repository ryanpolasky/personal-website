type NavigationClick = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };

export function animateProjectNavigation(event: NavigationClick, reduced: boolean, saveData: boolean) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !reduced && !saveData;
}
