# Bakes our role/auth-helper init script INTO the image, rather than relying on
# a runtime bind-mount (which proved fragile under some host/orchestrator path
# configurations — the script would silently be skipped if the mount resolved to
# an empty directory). COPY at build time always works.
FROM supabase/postgres:15.8.1.060

COPY init/00-init.sh /docker-entrypoint-initdb.d/00-init.sh
RUN chmod +x /docker-entrypoint-initdb.d/00-init.sh
