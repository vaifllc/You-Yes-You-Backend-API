// Simple image moderation service using Sightengine (no SDK required)
// Configure via environment variables:
//   SIGHTENGINE_USER, SIGHTENGINE_SECRET
// Fallback: returns isExplicit=false if not configured or on errors

const SIGHTENGINE_USER = process.env.SIGHTENGINE_USER;
const SIGHTENGINE_SECRET = process.env.SIGHTENGINE_SECRET;

const providerAvailable = () => Boolean(SIGHTENGINE_USER && SIGHTENGINE_SECRET);

const sightengineEndpoint = (imageUrl) =>
  `https://api.sightengine.com/1.0/check.json?models=nudity-2.0&url=${encodeURIComponent(imageUrl)}&api_user=${encodeURIComponent(
    SIGHTENGINE_USER || ''
  )}&api_secret=${encodeURIComponent(SIGHTENGINE_SECRET || '')}`;

/**
 * Analyze an image URL for explicit nudity using Sightengine
 * @param {string} imageUrl
 * @returns {Promise<{isExplicit:boolean, score:number, reasons:string[]}>}
 */
export const isImageExplicit = async (imageUrl) => {
  try {
    if (!providerAvailable()) {
      return { isExplicit: false, score: 0, reasons: ['provider_not_configured'] };
    }

    const res = await fetch(sightengineEndpoint(imageUrl));
    if (!res.ok) {
      return { isExplicit: false, score: 0, reasons: ['provider_http_' + res.status] };
    }
    const data = await res.json();
    const nudity = data?.nudity || {};
    const sexualActivity = Number(nudity.sexual_activity || 0);
    const sexualDisplay = Number(nudity.sexual_display || 0);
    const erotica = Number(nudity.erotica || 0);
    const suggestive = Number(nudity.suggestive || 0);

    // Strict thresholds
    // Block if sexual activity/display > 0.3, erotica > 0.5, suggestive > 0.8
    let isExplicit = false;
    const reasons = [];
    let score = 0;

    if (sexualActivity > 0.3) {
      isExplicit = true;
      reasons.push('sexual_activity');
      score = Math.max(score, sexualActivity);
    }
    if (sexualDisplay > 0.3) {
      isExplicit = true;
      reasons.push('sexual_display');
      score = Math.max(score, sexualDisplay);
    }
    if (erotica > 0.5) {
      isExplicit = true;
      reasons.push('erotica');
      score = Math.max(score, erotica);
    }
    if (suggestive > 0.8) {
      isExplicit = true;
      reasons.push('suggestive');
      score = Math.max(score, suggestive);
    }

    return { isExplicit, score, reasons };
  } catch (e) {
    return { isExplicit: false, score: 0, reasons: ['provider_error'] };
  }
};

export default { isImageExplicit };


