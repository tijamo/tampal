# Bakes the Kong declarative-config TEMPLATE into the image (build time), rather
# than relying on a runtime bind-mount. The template still needs $SUPABASE_ANON_KEY
# / $SUPABASE_SERVICE_KEY substituted at container START (those are only known at
# runtime), so the entrypoint (set in docker-compose.yml) still runs envsubst on
# this baked-in file — but the file itself can no longer go missing.
FROM kong:2.8.1

COPY kong.yml /home/kong/kong.yml.template
