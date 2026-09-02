import { useMediaQuery } from 'react-responsive';

export const useResponsive = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1024 });
  const isDesktop = useMediaQuery({ minWidth: 1025 });
  const isPortrait = useMediaQuery({ orientation: 'portrait' });
  const isRetina = useMediaQuery({ minResolution: '2dppx' });

  return {
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
    isRetina,
    // Helper to check if screen is larger than mobile (Tablet + Desktop)
    isTabletOrDesktop: !isMobile,
    // Helper to check if screen is smaller than desktop (Mobile + Tablet)
    isMobileOrTablet: !isDesktop,
  };
};

export default useResponsive;
