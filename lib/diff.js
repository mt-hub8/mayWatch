export function diff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result = [];

  const n = oldLines.length;
  const m = newLines.length;
  const max = n + m;

  if (max === 0) return result;

  const v = new Int32Array(2 * max + 1);
  v.fill(-1);
  const trace = [];

  v[max + 1] = 0;

  for (let d = 0; d <= max; d++) {
    const snap = new Int32Array(v);
    trace.push(snap);

    for (let k = -d; k <= d; k += 2) {
      const idx = k + max;
      let x;
      if (k === -d || (k !== d && v[idx - 1] < v[idx + 1])) {
        x = v[idx + 1];
      } else {
        x = v[idx - 1] + 1;
      }
      let y = x - k;

      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }

      v[idx] = x;

      if (x >= n && y >= m) {
        return buildResult(trace, oldLines, newLines, max);
      }
    }
  }

  return buildResult(trace, oldLines, newLines, max);
}

function buildResult(trace, oldLines, newLines, max) {
  let x = oldLines.length;
  let y = newLines.length;
  const edits = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    const idx = k + max;

    let prevK;
    if (k === -d || (k !== d && v[idx - 1] < v[idx + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v[prevK + max];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: 'unchanged', value: oldLines[x] });
    }

    if (d > 0) {
      if (x === prevX) {
        edits.unshift({ type: 'added', value: newLines[y - 1] });
        y--;
      } else {
        edits.unshift({ type: 'removed', value: oldLines[x - 1] });
        x--;
      }
    }
  }

  return edits;
}

export function computeSummary(diffLines) {
  let addedLines = 0;
  let removedLines = 0;
  const addedSnippets = [];
  const removedSnippets = [];

  for (const line of diffLines) {
    if (line.type === 'added') {
      addedLines++;
      if (addedSnippets.length < 3 && line.value.trim()) {
        addedSnippets.push(line.value.trim());
      }
    } else if (line.type === 'removed') {
      removedLines++;
      if (removedSnippets.length < 3 && line.value.trim()) {
        removedSnippets.push(line.value.trim());
      }
    }
  }

  const changedLines = Math.min(addedLines, removedLines);

  return {
    addedLines,
    removedLines,
    changedLines,
    addedSnippets,
    removedSnippets,
  };
}
