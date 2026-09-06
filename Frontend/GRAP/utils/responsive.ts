import { PixelRatio, Platform, useWindowDimensions } from 'react-native';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const useResponsive = () => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;
  const widthRatio = clamp(screenWidth / (isTablet ? 768 : 375), 0.88, isDesktop ? 1.2 : 1.1);
  const heightRatio = clamp(screenHeight / 812, 0.88, 1.15);
  const horizontalScale = (size: number) => Math.round(size * widthRatio);
  const verticalScale = (size: number) => Math.round(size * heightRatio);
  const moderateScale = (size: number, factor = 0.5) => Math.round(size + (horizontalScale(size) - size) * factor);
  const fontScale = (size: number) => PixelRatio.roundToNearestPixel(clamp(size * widthRatio, size * 0.9, size * 1.15));
  const maxContentWidth = isDesktop ? 1180 : isTablet ? 820 : '100%';
  const contentPadding = isDesktop ? 32 : isTablet ? 24 : horizontalScale(16);

  return {
    screenWidth,
    screenHeight,
    isWeb,
    isTablet,
    isDesktop,
    isLargeScreen: isTablet || isDesktop,
    isSmallScreen: screenWidth < 350,
    horizontalScale,
    verticalScale,
    moderateScale,
    fontScale,
    maxContentWidth,
    contentPadding,
  };
};

export const responsiveContainerStyle = (backgroundColor: string) => ({
  flex: 1,
  backgroundColor,
  maxWidth: 1180,
  width: '100%' as const,
  alignSelf: 'center' as const,
});

export const responsivePadding = (padding: number) => padding;
