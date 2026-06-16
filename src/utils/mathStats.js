// Shared math helpers for predictive stats (Poisson probability + linear regression)

export function factorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// P(X = k) for a Poisson distribution with rate lambda
export function poissonPmf(lambda, k) {
  if (lambda < 0) return 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

// Distribution of P(X = k) for k = 0..maxK
export function poissonDistribution(lambda, maxK = 5) {
  const distribution = [];
  for (let k = 0; k <= maxK; k++) {
    distribution.push({ k, probability: poissonPmf(lambda, k) });
  }
  return distribution;
}

function transpose(matrix) {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]));
}

function multiplyMatrices(a, b) {
  return a.map((row) =>
    b[0].map((_, j) => row.reduce((sum, val, k) => sum + val * b[k][j], 0))
  );
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, val, i) => sum + val * vector[i], 0));
}

// Inverts a square matrix using Gauss-Jordan elimination
function invertMatrix(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col; r < n; r++) {
      if (Math.abs(augmented[r][col]) > Math.abs(augmented[pivotRow][col])) pivotRow = r;
    }
    [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];

    const pivot = augmented[col][col];
    if (pivot === 0) throw new Error("Matrix is not invertible");

    for (let j = 0; j < 2 * n; j++) augmented[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = augmented[r][col];
      for (let j = 0; j < 2 * n; j++) augmented[r][j] -= factor * augmented[col][j];
    }
  }

  return augmented.map((row) => row.slice(n));
}

// Ordinary least squares: X is an array of rows [1, x1, x2, ...], y is the target vector.
// Returns the coefficient vector [intercept, b1, b2, ...]
export function linearRegression(X, y) {
  const Xt = transpose(X);
  const XtX = multiplyMatrices(Xt, X);
  const XtXInv = invertMatrix(XtX);
  const XtY = multiplyMatrixVector(Xt, y);
  return multiplyMatrixVector(XtXInv, XtY);
}
