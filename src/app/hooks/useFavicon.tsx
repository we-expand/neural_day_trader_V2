import { useEffect } from 'react';

/**
 * Sets a clean SVG favicon for Neural Day Trader.
 * Does NOT touch document.title — title is managed by App.tsx only.
 */
export function useFavicon() {
  useEffect(() => {
    // Build a tiny SVG favicon from the Neural brand colours
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="6" fill="#000"/>
      <circle cx="16" cy="16" r="9" fill="none" stroke="#10b981" stroke-width="2"/>
      <path d="M10 16 L13 11 L16 19 L19 11 L22 16" stroke="#22d3ee" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    const svgBlob = new Blob([svgFavicon], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = svgUrl;

    return () => {
      URL.revokeObjectURL(svgUrl);
    };
  }, []);
}
