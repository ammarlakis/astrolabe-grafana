/**
 * Utility functions for resource age handling and color coding
 */

/**
 * Parse age string and return milliseconds
 * Supports formats like: "2d", "5h", "30m", "45s"
 */
export function parseAge(ageString: string): number {
  if (!ageString) {
    return 0;
  }

  const match = ageString.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 0;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': // seconds
      return value * 1000;
    case 'm': // minutes
      return value * 60 * 1000;
    case 'h': // hours
      return value * 60 * 60 * 1000;
    case 'd': // days
      return value * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

/**
 * Get color for age based on how old the resource is
 * Green: < 1 hour (new/recently created)
 * Blue: 1 hour - 1 day (recent)
 * Gray: > 1 day (stable/old)
 */
export function getAgeColor(ageString: string): string {
  const ageMs = parseAge(ageString);
  
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  if (ageMs < oneHour) {
    return '#73BF69'; // Green - new
  } else if (ageMs < oneDay) {
    return '#5794F2'; // Blue - recent
  } else {
    return '#9E9E9E'; // Gray - stable
  }
}

/**
 * Get a human-readable description of the age category
 */
export function getAgeCategory(ageString: string): string {
  const ageMs = parseAge(ageString);
  
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  if (ageMs < oneHour) {
    return 'New';
  } else if (ageMs < oneDay) {
    return 'Recent';
  } else {
    return 'Stable';
  }
}

/**
 * Format age with relative time for tooltip
 */
export function formatAgeTooltip(ageString: string, creationTimestamp?: string): string {
  const category = getAgeCategory(ageString);
  
  if (creationTimestamp) {
    try {
      const created = new Date(creationTimestamp);
      const now = new Date();
      const diffMs = now.getTime() - created.getTime();
      
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
      
      let relativeTime = '';
      if (days > 0) {
        relativeTime = `${days} day${days !== 1 ? 's' : ''} ago`;
      } else if (hours > 0) {
        relativeTime = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      } else {
        relativeTime = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      }
      
      return `${category} (Created ${relativeTime})`;
    } catch (e) {
      return `${category} (Age: ${ageString})`;
    }
  }
  
  return `${category} (Age: ${ageString})`;
}
