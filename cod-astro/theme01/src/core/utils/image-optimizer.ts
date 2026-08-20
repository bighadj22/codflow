/**
 * Cloudflare Image Resizing Utility
 * 
 * Generates optimized image URLs using Cloudflare's Image Resizing service.
 * Automatically resizes images to exact dimensions and converts to WebP format.
 */

interface ImageResizeOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
}

import { MEDIA_DOMAIN as _MEDIA_DOMAIN } from "astro:env/server";

// The media domain is configured via the MEDIA_DOMAIN env var (no scheme).
// When unset, image optimization is a no-op and original URLs pass through.
const MEDIA_DOMAIN = _MEDIA_DOMAIN ? `https://${_MEDIA_DOMAIN.replace(/^https?:\/\//, "")}` : "";

/**
 * Generate an optimized image URL using Cloudflare Image Resizing
 * 
 * @param originalUrl - The original image URL from R2
 * @param options - Resize and optimization options
 * @returns Optimized image URL
 */
export function optimizeImage(originalUrl: string, options: ImageResizeOptions): string {
  if (!MEDIA_DOMAIN || !originalUrl || !originalUrl.startsWith(MEDIA_DOMAIN)) {
    return originalUrl; // Return original if not from our media domain
  }

  const {
    width,
    height,
    quality = 85,
    format = 'webp',
    fit = 'cover'
  } = options;

  // Remove the media domain from the URL to get the path
  const imagePath = originalUrl.replace(MEDIA_DOMAIN + '/', '');
  
  // Build the Cloudflare Image Resizing URL
  const resizeParams = [
    `width=${width}`,
    `height=${height}`,
    `format=${format}`,
    `quality=${quality}`,
    `fit=${fit}`
  ].join(',');

  return `${MEDIA_DOMAIN}/cdn-cgi/image/${resizeParams}/${imagePath}`;
}

/**
 * Predefined image sizes for common use cases
 */
export const IMAGE_SIZES = {
  // Product cards (grid view)
  CARD: { width: 400, height: 400, quality: 85 },
  
  // Product gallery main image
  GALLERY_MAIN: { width: 800, height: 800, quality: 90 },
  
  // Product gallery thumbnails
  GALLERY_THUMB: { width: 80, height: 80, quality: 80 },
  
  // Hero/banner images
  HERO: { width: 1200, height: 600, quality: 90 },
  
  // Category images
  CATEGORY: { width: 300, height: 200, quality: 85 },
  
  // Logo/brand images
  LOGO: { width: 200, height: 80, quality: 90, fit: 'contain' as const }
} as const;

/**
 * Quick helper functions for common image sizes
 */
export const getCardImage = (url: string) => optimizeImage(url, IMAGE_SIZES.CARD);
export const getGalleryImage = (url: string) => optimizeImage(url, IMAGE_SIZES.GALLERY_MAIN);
export const getThumbnailImage = (url: string) => optimizeImage(url, IMAGE_SIZES.GALLERY_THUMB);
export const getHeroImage = (url: string) => optimizeImage(url, IMAGE_SIZES.HERO);
export const getCategoryImage = (url: string) => optimizeImage(url, IMAGE_SIZES.CATEGORY);
export const getLogoImage = (url: string) => optimizeImage(url, IMAGE_SIZES.LOGO);

/**
 * Generate responsive image srcset for different screen sizes
 * 
 * @param originalUrl - The original image URL
 * @param baseWidth - Base width for 1x display
 * @param baseHeight - Base height for 1x display
 * @returns srcset string for responsive images
 */
export function generateSrcSet(
  originalUrl: string, 
  baseWidth: number, 
  baseHeight: number
): string {
  const sizes = [
    { width: baseWidth, height: baseHeight, density: '1x' },
    { width: baseWidth * 1.5, height: baseHeight * 1.5, density: '1.5x' },
    { width: baseWidth * 2, height: baseHeight * 2, density: '2x' }
  ];

  return sizes
    .map(size => `${optimizeImage(originalUrl, size)} ${size.density}`)
    .join(', ');
}