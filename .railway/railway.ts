import { defineRailway, project, service } from 'railway/iac';

// Apply explicitly with Railway CLI after linking the intended project.
// The GitHub source is configured in Railway. This static site needs no secrets.
export default defineRailway(() => {
  const web = service('hausetcr', {
    build: 'npm run build',
    start: 'npm start',
    healthcheck: '/api/health',
    healthcheckTimeout: 60,
  });

  return project('hausetcr', { resources: [web] });
});
