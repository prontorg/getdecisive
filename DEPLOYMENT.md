# Separate-Site Deployment Note

This planner/product app is intentionally separate from the current dashboard deployment.

Recommended separation:
- current dashboard remains on the existing dashboard site
- new product app deploys as a separate site/app host, e.g. `app.decisive.coach`

Reason:
- avoids breaking the current dashboard while the platform is built
- allows separate auth/session handling
- allows separate release cadence
- keeps product onboarding and planner routes isolated from the current coaching dashboard
