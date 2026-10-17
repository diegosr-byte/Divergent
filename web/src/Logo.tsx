// Divergent mark: a light square with a stepped notch out of its bottom-left corner and a red core pushed up and to
// the right, drawn on the original 13 x 13 pixel grid so it stays crisp at any size. The light part follows the text
// color; the red is fixed.
export const LOGO_BODY = 'M0 0H13V13H7V11H2V6H0Z';
export const LOGO_CORE = 'M5 3H10V8H5Z';
export const LOGO_RED = '#ED1C24';

export default function Logo({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 13 13" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path d={LOGO_BODY} fill="currentColor" />
      <path d={LOGO_CORE} fill={LOGO_RED} />
    </svg>
  );
}
