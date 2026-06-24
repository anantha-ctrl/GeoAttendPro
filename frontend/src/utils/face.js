/**
 * Thin wrapper around face-api.js (loaded from CDN as window.faceapi).
 * Models are fetched from the matching jsDelivr package path.
 * Everything degrades gracefully if the library/models fail to load.
 */

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';

// Distance below which two descriptors are considered the same person.
export const MATCH_THRESHOLD = 0.55;

let modelsPromise = null;

/**
 * Wait for the face-api.js CDN script to become available on `window.faceapi`.
 * The script is loaded with `defer` in index.html, so it may not be ready
 * when React components first mount. This polls every 200ms up to ~8s.
 * Returns true if the library is available, false if it timed out.
 */
export function waitForFaceLib(timeoutMs = 8000) {
  if (window.faceapi) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const poll = setInterval(() => {
      if (window.faceapi) {
        clearInterval(poll);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        resolve(false);
      }
    }, 200);
  });
}

/** Check if the face library script has loaded on window. */
export function faceLibReady() {
  return Boolean(window.faceapi);
}

/** Lazy-load the three models we need; cached after first call. */
export function loadFaceModels() {
  if (modelsPromise) return modelsPromise;
  const faceapi = window.faceapi;
  if (!faceapi) {
    console.error('loadFaceModels failed: window.faceapi is not available');
    modelsPromise = Promise.reject(new Error('Face library not loaded.'));
    return modelsPromise;
  }
  console.log('Loading face-api.js models from CDN: ' + MODEL_URL);
  modelsPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]).then((res) => {
    console.log('Successfully loaded all face-api.js models.');
    return res;
  }).catch((e) => {
    console.error('Failed to load face-api.js models:', e);
    modelsPromise = null; // allow retry
    throw e;
  });
  return modelsPromise;
}

/**
 * High-level helper: wait for the CDN script, then load models.
 * Returns true if everything is ready, false on failure.
 */
export async function ensureFaceReady() {
  const libOk = await waitForFaceLib();
  if (!libOk) return false;
  try {
    await loadFaceModels();
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute a 128-float face descriptor from an <img>/<video>/<canvas> element.
 * Returns null when no face is detected.
 */
export async function getDescriptor(el) {
  const faceapi = window.faceapi;
  await loadFaceModels();
  const det = await faceapi
    .detectSingleFace(el, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det ? Array.from(det.descriptor) : null;
}

/** Euclidean distance between two descriptor arrays. */
export function distance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Load a data-URI / URL into an <img> element (resolves when decoded). */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = src;
  });
}
