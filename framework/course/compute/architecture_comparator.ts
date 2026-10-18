import {
  architectureCards,
  compareCards,
  type ArchitectureCard,
} from './architecture_cards';

export type ComparatorInputs = {
  selectedIds?: string[];
};

export function compute(inputs: ComparatorInputs = {}) {
  const selectedIds = inputs.selectedIds ?? ["deepseek-v3", "gpt-oss-120b"];
  const comparison = compareCards(selectedIds);
  return {
    ...comparison,
    availableCards: architectureCards.map((card: ArchitectureCard) => ({
      id: card.id,
      name: card.name,
      family: card.family,
    })),
  };
}
