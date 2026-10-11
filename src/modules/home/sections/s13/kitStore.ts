import { scrollToSection } from '../../global/scroll';
import { DEFAULT_KIT, type KitId } from './stack-data';

/**
 * The kit the stack shows, kept outside React: the shell unmounts the section
 * when it is far away and mounts it again on the way back, and the visitor
 * should find the tower (and the toolbox drawer) as they left them, at the
 * same height. Also the hook for other sections: a "how we build" chapter can
 * send the visitor here with its own kit standing (`showStackKit('web')`).
 */

let rememberedKit: KitId = DEFAULT_KIT;
let isToolboxOpen = false;
const listeners = new Set<(kit: KitId) => void>();

export function getRememberedKit(): KitId {
  return rememberedKit;
}

export function rememberKit(kit: KitId): void {
  rememberedKit = kit;
}

export function getToolboxOpen(): boolean {
  return isToolboxOpen;
}

export function rememberToolboxOpen(isOpen: boolean): void {
  isToolboxOpen = isOpen;
}

/** The mounted section listens; returns the unsubscribe. */
export function subscribeKitRequests(listener: (kit: KitId) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For other sections ("Tools for this →"): stand this kit's tower and go there. */
export function showStackKit(kit: KitId): void {
  if (listeners.size > 0) listeners.forEach(listener => listener(kit));
  else rememberedKit = kit;
  scrollToSection('stack-physics');
}

const openListeners = new Set<() => void>();

/** The mounted toolbox listens for "open me" from the tower's column; returns the unsubscribe. */
export function subscribeToolboxOpen(listener: () => void): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

/** Open the full toolbox drawer and bring it into view ("See all N tools"). */
export function requestToolboxOpen(): void {
  isToolboxOpen = true;
  openListeners.forEach(listener => listener());
}
