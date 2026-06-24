/**
 * CloudHawk brand logo — uses the real artwork at /public/cloudhawk.png.
 * The image already contains the cloud mark + "CloudHawk" wordmark, so we just
 * size it by height. On dark backgrounds a soft glow keeps it legible.
 *
 * @param {number}  height  pixel height of the logo
 * @param {boolean} dark    true on dark backgrounds (sidebar / footer)
 */
export default function BrandLogo({ height = 30, dark = false }) {
  return (
    <img
      src="/cloudhawk.png"
      alt="CloudHawk"
      style={{
        height,
        width: 'auto',
        display: 'block',
        // Subtle white glow so the colored logo stays crisp on dark panels.
        filter: dark ? 'drop-shadow(0 1px 2px rgba(255,255,255,0.25))' : 'none',
      }}
    />
  );
}
