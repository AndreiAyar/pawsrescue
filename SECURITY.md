# Security policy

PawsRescue is a prototype. Security fixes target the current `main` branch;
there are no maintained release branches or guaranteed response times.

## Report a vulnerability

Use GitHub's **Security → Report a vulnerability** if private reporting is
available on [this repository](https://github.com/AndreiAyar/pawsrescue/security).
Describe the affected commit, impact, and a minimal reproduction with fictional data.

If that option is unavailable, open an issue asking for a private reporting
channel, without publishing the vulnerability, exploit steps, or sensitive data.
The maintainer can then arrange a private conversation. A `SECURITY.md` file
alone does not enable GitHub private reporting.

Do not include passwords, tokens, connection strings, real pet-owner contacts,
precise private locations, or unredacted logs. Test against your own local stack;
do not probe a deployment or another person's data without permission.

## For operators

Configure HTTPS, backups, restricted MapTiler origins, database TLS, and private
Redis networking before a public deployment. This project does not provide
moderation, abuse prevention, verified ownership, or a complete privacy workflow.
Review [the deployment guide](DEPLOY_DIGITALOCEAN.md) and test restore procedures.
A successful build is not a production security certification.
