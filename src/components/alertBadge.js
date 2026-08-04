export const alertBadge = ({ label = 'Sin alertas', count = 0, variant = 'secondary' } = {}) => `
  <span class="badge rounded-pill text-bg-${variant}" aria-label="${label}: ${count}">${label} <span>${count}</span></span>`
