
const getBackendUrl = () => {
  // Always use the AppSail Server URL for both local development and production
  return 'https://gca-50041716687.development.catalystappsail.in';
};

export const API_BASE_URL = getBackendUrl();
