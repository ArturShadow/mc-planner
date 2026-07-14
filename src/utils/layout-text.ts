const CHUNK_SIZE = 16;

export function createEmptyLayout(
  widthChunks: number,
  heightChunks: number,
): string {
  const width = widthChunks * CHUNK_SIZE;
  const height = heightChunks * CHUNK_SIZE;
  const emptyRow = '.'.repeat(width);

  return Array.from({ length: height }, () => emptyRow).join('\n');
}

export function parseLayoutText(layoutText: string): string[][] {
  return layoutText
    .replace(/\r/g, '')
    .split('\n')
    .filter((row) => row.length > 0)
    .map((row) => [...row]);
}

export function serializeLayout(grid: string[][]): string {
  return grid.map((row) => row.join('')).join('\n');
}

export function validateLayoutText(
  layoutText: string,
  widthChunks: number,
  heightChunks: number,
): boolean {
  const expectedWidth = widthChunks * CHUNK_SIZE;
  const expectedHeight = heightChunks * CHUNK_SIZE;

  const rows = layoutText
    .replace(/\r/g, '')
    .split('\n')
    .filter((row) => row.length > 0);

  return (
    rows.length === expectedHeight &&
    rows.every((row) => row.length === expectedWidth)
  );
}