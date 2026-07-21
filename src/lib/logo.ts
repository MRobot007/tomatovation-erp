// Imported straight from the assets/ folder where the logo was dropped, rather
// than a copy under src/ — one file, one source of truth. Vite fingerprints it
// into the build.
import logoLockup from '../../assets/logo-text-dark.png'

/**
 * The white full lockup — mark over "TOMATOVATION" over the tagline.
 *
 * It is white, so it belongs only on dark surfaces: the rail and the login
 * panel. On the paper-coloured content area it would be invisible.
 *
 * Imported rather than referenced by URL so Vite fingerprints it and it is
 * never a 404 while the file is missing.
 */
export { logoLockup }

/**
 * The whole image is 746×452. The mark (the TVT monogram) occupies the top of
 * it and ends around y=290, comfortably before the wordmark begins. There is
 * only one asset, so the sidebar shows the mark by clipping the wordmark and
 * tagline off the bottom rather than needing a second file — see LogoMark.
 */
export const LOGO_MARK_ASPECT = '746 / 290'
