// Bingo line definitions (rows, columns, diagonals).
export const LINES = [
  { id: 'R1', cells: [0, 1, 2], label: 'Row 1' },
  { id: 'R2', cells: [3, 4, 5], label: 'Row 2' },
  { id: 'R3', cells: [6, 7, 8], label: 'Row 3' },
  { id: 'C1', cells: [0, 3, 6], label: 'Col 1' },
  { id: 'C2', cells: [1, 4, 7], label: 'Col 2' },
  { id: 'C3', cells: [2, 5, 8], label: 'Col 3' },
  { id: 'D1', cells: [0, 4, 8], label: 'Diagonal ↘' },
  { id: 'D2', cells: [2, 4, 6], label: 'Diagonal ↙' },
];
