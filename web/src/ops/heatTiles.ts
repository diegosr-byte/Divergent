// Heat maps as MapLibre raster *tiles*, so they drape over the 3D terrain like the satellite imagery.
// (A MapLibre `image` source is drawn as one flat quad when terrain is on: hills poke through it.)
// Tiles are cut on demand from the current heat canvas through a `heat://` protocol. Two sources take turns:
// the new heat loads into the hidden one and the layers swap only once it has loaded, so updates don't flicker.
import maplibregl, { type Map as MLMap, type MapSourceDataEvent, type RasterTileSource } from 'maplibre-gl';
import { BOX_CORNERS } from './geo3d';

const IDS = ['heat-a', 'heat-b'] as const;
type HeatId = (typeof IDS)[number];
const TILE = 256;
// Canvases are kept while a source shows them (or one is queued): the camera follows the drones, so the visible source
// keeps asking for new tiles of its frame. Dropping it by age left those tiles blank (and cached) while playing.

const frames = new Map<number, HTMLCanvasElement>();
let protocolAdded = false;

// Box in lng/lat, matching the heat canvas: row 0 = north edge, column 0 = west edge.
const [[west, north], [east]] = BOX_CORNERS;
const south = BOX_CORNERS[3][1];

const tileLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tileLat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

async function renderTile(url: string): Promise<ArrayBuffer> {
  const out = document.createElement('canvas');
  out.width = out.height = TILE;
  const m = /^heat:\/\/(\d+)\/(\d+)\/(\d+)\/(\d+)/.exec(url);
  const src = m ? frames.get(Number(m[1])) : undefined;
  if (m && src) {
    const [z, x, y] = [Number(m[2]), Number(m[3]), Number(m[4])];
    const W = src.width, H = src.height;
    // Tile edges in heat-canvas pixels (linear in lat over a tile; fine at these zooms).
    const sx0 = ((tileLon(x, z) - west) / (east - west)) * W, sx1 = ((tileLon(x + 1, z) - west) / (east - west)) * W;
    const sy0 = ((north - tileLat(y, z)) / (north - south)) * H, sy1 = ((north - tileLat(y + 1, z)) / (north - south)) * H;
    const cx0 = Math.max(0, sx0), cx1 = Math.min(W, sx1), cy0 = Math.max(0, sy0), cy1 = Math.min(H, sy1);
    if (cx1 > cx0 && cy1 > cy0) {
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const dx = (v: number) => ((v - sx0) / (sx1 - sx0)) * TILE, dy = (v: number) => ((v - sy0) / (sy1 - sy0)) * TILE;
      ctx.drawImage(src, cx0, cy0, cx1 - cx0, cy1 - cy0, dx(cx0), dy(cy0), dx(cx1) - dx(cx0), dy(cy1) - dy(cy0));
    }
  }
  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'));
  return blob ? blob.arrayBuffer() : new ArrayBuffer(0);
}

type State = {
  active: HeatId; pending: { id: HeatId; opacity: number } | null; version: number; key: string; opacity: number;
  shows: Record<HeatId, number>; // frame version each source's tiles are cut from
  queued: { version: number; opacity: number } | null; // newest frame that arrived while another was loading
};
const states = new WeakMap<MLMap, State>();
const other = (id: HeatId): HeatId => (id === IDS[0] ? IDS[1] : IDS[0]);

// Call once the style has loaded, before the vector overlays so routes and rings draw on top of the heat.
export function addHeatLayers(map: MLMap) {
  if (!protocolAdded) {
    protocolAdded = true;
    maplibregl.addProtocol('heat', async (params) => ({ data: await renderTile(params.url) }));
  }
  for (const id of IDS) {
    map.addSource(id, { type: 'raster', tiles: [`heat://0/{z}/{x}/{y}`], tileSize: TILE, bounds: [west, south, east, north], maxzoom: 15 });
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } });
  }
  const st: State = { active: IDS[0], pending: null, version: 0, key: '', opacity: 0, shows: { 'heat-a': 0, 'heat-b': 0 }, queued: null };
  states.set(map, st);
  map.on('sourcedata', (e: MapSourceDataEvent) => {
    const p = st.pending;
    if (!p || e.sourceId !== p.id || !map.isSourceLoaded(p.id)) return;
    map.setPaintProperty(p.id, 'raster-opacity', p.opacity);
    map.setPaintProperty(other(p.id), 'raster-opacity', 0);
    st.active = p.id;
    st.pending = null;
    if (st.queued) {
      const q = st.queued;
      st.queued = null;
      load(map, st, q.version, q.opacity);
    }
  });
}

// Cut the hidden source's tiles from frame `version`; it swaps in once loaded.
function load(map: MLMap, st: State, version: number, opacity: number) {
  const next = other(st.active);
  st.pending = { id: next, opacity };
  st.shows[next] = version;
  const inUse = new Set(Object.values(st.shows));
  if (st.queued) inUse.add(st.queued.version);
  for (const v of frames.keys()) if (!inUse.has(v)) frames.delete(v);
  (map.getSource(next) as RasterTileSource).setTiles([`heat://${version}/{z}/{x}/{y}`]);
}

// Show `canvas` (or nothing) as the draped heat. `key` identifies the canvas contents; unchanged keys only restyle.
export function setHeat(map: MLMap, canvas: HTMLCanvasElement | null, key: string, opacity: number) {
  const st = states.get(map);
  if (!st) return;
  if (!canvas) {
    st.key = '';
    st.pending = null;
    st.queued = null;
    for (const id of IDS) map.setPaintProperty(id, 'raster-opacity', 0);
    return;
  }
  if (key === st.key) {
    st.opacity = opacity;
    if (st.queued) st.queued.opacity = opacity;
    if (st.pending) st.pending.opacity = opacity;
    else map.setPaintProperty(st.active, 'raster-opacity', opacity);
    return;
  }
  st.key = key;
  st.opacity = opacity;
  st.version += 1;
  frames.set(st.version, canvas);
  // While a frame is still loading, don't retarget it (on a slow machine it would never finish and the old heat
  // would stay up): let it land, then load only the newest frame that came in meanwhile.
  if (st.pending) {
    if (st.queued) frames.delete(st.queued.version);
    st.queued = { version: st.version, opacity };
    return;
  }
  load(map, st, st.version, opacity);
}
