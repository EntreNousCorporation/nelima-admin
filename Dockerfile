# L'image ne contient que la sortie Nitro : ni sources, ni node_modules de build.
FROM node:20-alpine
WORKDIR /app
COPY .output ./.output
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
