module.exports = new Proxy(
  {},
  {
    get() {
      throw new Error(
        'sharp is not available on Cloudflare Workers. This app sets images.unoptimized: true, so image optimization must not run here.'
      );
    },
  }
);
