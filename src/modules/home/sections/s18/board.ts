/**
 * The pipeline board as data: which deals sit in which stage, in order, and
 * where each card goes on screen. Pure functions; the components own the DOM.
 */
import { DEALS, INITIAL_BOARD, STAGE_IDS, type Currency, type Deal, type DealId, type StageId } from './data';

export type Board = Readonly<Record<StageId, readonly DealId[]>>;

export type BoardAction = { type: 'MOVE'; id: DealId; to: StageId; index?: number } | { type: 'RESET' };

export { STAGE_IDS };

export function stageOf(board: Board, id: DealId): StageId {
  return STAGE_IDS.find(stage => board[stage].includes(id)) ?? 'new';
}

export function nextStage(stage: StageId): StageId | null {
  const index = STAGE_IDS.indexOf(stage);
  return STAGE_IDS[index + 1] ?? null;
}

export function stepStage(stage: StageId, direction: -1 | 1): StageId {
  const index = Math.max(0, Math.min(STAGE_IDS.length - 1, STAGE_IDS.indexOf(stage) + direction));
  return STAGE_IDS[index];
}

export function boardReducer(board: Board, action: BoardAction): Board {
  if (action.type === 'RESET') return INITIAL_BOARD;
  const from = stageOf(board, action.id);
  const without = board[from].filter(id => id !== action.id);
  const target = from === action.to ? without : board[action.to];
  const index = Math.max(0, Math.min(target.length, action.index ?? target.length));
  const placed = [...target.slice(0, index), action.id, ...target.slice(index)];
  if (from === action.to && placed.every((id, i) => id === board[from][i])) return board;
  return { ...board, [from]: without, [action.to]: placed };
}

export function getDeal(id: DealId): Deal {
  return DEALS.find(deal => deal.id === id) ?? DEALS[0];
}

export function stageTotal(board: Board, stage: StageId, currency: Currency): number {
  return board[stage].reduce((sum, id) => sum + getDeal(id).amount[currency], 0);
}

/** Board geometry in the board's own coordinates (px), measured from the DOM. */
export interface BoardGeometry {
  columns: Record<StageId, { x: number; width: number }>;
  /** y of the first card in every column. */
  top: number;
  cardHeight: number;
  gap: number;
}

export interface Slot {
  x: number;
  y: number;
  width: number;
}

export function slotFor(geometry: BoardGeometry, stage: StageId, index: number): Slot {
  const column = geometry.columns[stage];
  return { x: column.x, y: geometry.top + index * (geometry.cardHeight + geometry.gap), width: column.width };
}

export function computeSlots(board: Board, geometry: BoardGeometry): Map<DealId, Slot> {
  const slots = new Map<DealId, Slot>();
  STAGE_IDS.forEach(stage => board[stage].forEach((id, index) => slots.set(id, slotFor(geometry, stage, index))));
  return slots;
}

/** Height the card layer needs for the fullest column. */
export function boardHeight(board: Board, geometry: BoardGeometry): number {
  const most = Math.max(...STAGE_IDS.map(stage => board[stage].length), 1);
  return geometry.top + most * (geometry.cardHeight + geometry.gap);
}

/** The stage under a board-local x, or null outside every column. */
export function stageAtX(geometry: BoardGeometry, x: number): StageId | null {
  return (
    STAGE_IDS.find(stage => x >= geometry.columns[stage].x - 6 && x <= geometry.columns[stage].x + geometry.columns[stage].width + 6) ??
    null
  );
}

/** Insertion index for a card whose centre is at board-local y. */
export function indexAtY(geometry: BoardGeometry, y: number, count: number): number {
  const raw = Math.round((y - geometry.top - geometry.cardHeight / 2) / (geometry.cardHeight + geometry.gap));
  return Math.max(0, Math.min(count, raw));
}
