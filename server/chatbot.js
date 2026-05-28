export function buildBotReply(message, user) {
  const text = message.trim().toLowerCase();
  const latitude = user?.latitude;
  const longitude = user?.longitude;
  const hasCoordinates =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));
  const hasLocation =
    hasCoordinates || Boolean(user?.exact_location);

  if (!text) {
    return 'Type a message and I will help you search.';
  }

  if (/^(hi|hello|hey|hii|hola)\b/.test(text)) {
    return 'Hi, I am SearchSomething. What can I help you find nearby?';
  }

  if (text.includes('thank')) {
    return 'You are welcome. I am here when you want to search something nearby.';
  }

  if (text.includes('location') || text.includes('where am i')) {
    if (hasLocation) {
      return `I saved your location${user.exact_location ? ` near ${user.exact_location}` : ''}. Ask me for places around you.`;
    }

    return 'Share your location above and I can keep nearby searches more accurate.';
  }

  if (
    text.includes('near me') ||
    text.includes('nearby') ||
    text.includes('restaurant') ||
    text.includes('cafe') ||
    text.includes('hotel') ||
    text.includes('shop')
  ) {
    if (hasLocation) {
      return `I can use your saved location${user.exact_location ? ` near ${user.exact_location}` : ''}. Tell me the place type, like cafe, hotel, store, clinic, or restaurant.`;
    }

    return 'I can help with nearby searches. Share your location first for better accuracy.';
  }

  return 'Got it. I can handle basic chat and nearby-search prompts right now. Try asking for cafes, restaurants, hotels, shops, or clinics near you.';
}
