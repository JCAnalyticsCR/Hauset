/**
 * Decides whether a device can run the Three.js scenes and at which quality.
 * The 2D SVG versions remain the fallback whenever this returns 'none' or the
 * running scene later reports a lost context or a sustained low frame rate.
 */
export type GraphicsTier = 'full' | 'lite' | 'none';

type ExtendedNavigator = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

let cached: GraphicsTier | null = null;

export const prefersReducedMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/** `?3d=0`, `?3d=lite` or `?3d=full` override the detection for testing. */
function forcedTier(): GraphicsTier | null {
  const value = new URLSearchParams(location.search).get('3d');
  if (value === '0' || value === 'off' || value === 'no') return 'none';
  if (value === 'lite' || value === 'full') return value;
  return null;
}

function probe(): { ok: boolean; renderer: string; maxTexture: number } {
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | null = null;
  try {
    // Software rasterizers fail with the caveat flag; Three.js r186 needs WebGL2.
    gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
    });
  } catch {
    gl = null;
  }
  if (!gl) return { ok: false, renderer: '', maxTexture: 0 };
  let renderer = '';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (info)
    renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
  const maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return { ok: true, renderer, maxTexture };
}

function compute(): GraphicsTier {
  const forced = forcedTier();
  if (forced) return forced;
  const nav = navigator as ExtendedNavigator;
  if (nav.connection?.saveData) return 'none';
  const memory = nav.deviceMemory;
  if (memory !== undefined && memory < 2) return 'none';
  const result = probe();
  if (!result.ok) return 'none';
  if (/swiftshader|llvmpipe|software|basic render/i.test(result.renderer))
    return 'none';
  const cores = nav.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 700;
  if (
    (memory !== undefined && memory < 4) ||
    cores <= 2 ||
    result.maxTexture < 4096 ||
    coarse ||
    small
  )
    return 'lite';
  return 'full';
}

export function detectGraphicsTier(): GraphicsTier {
  if (!cached) {
    try {
      cached = compute();
    } catch {
      cached = 'none';
    }
  }
  return cached;
}
